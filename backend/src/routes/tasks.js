const express = require("express");
const router = express.Router();
const { authenticate, requireManager } = require("../middleware/auth");
const { docClient, snsClient } = require("../config/aws");
const { PutCommand, GetCommand, UpdateCommand, DeleteCommand, QueryCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { PublishCommand } = require("@aws-sdk/client-sns");
const { publishMetric } = require("../services/cloudwatch");
const { v4: uuidv4 } = require("uuid");

// Create task (manager only)
router.post("/", authenticate, requireManager, async (req, res) => {
  try {
    const { title, description, priority, deadline, assigneeId, assigneeName, teamId, teamName, projectId, imageUrl } = req.body;
    const taskId = uuidv4();
    const now = new Date().toISOString();
    
    const task = {
      taskId, 
      title, 
      description, 
      priority, 
      deadline,
      assigneeId, 
      assigneeName, 
      teamId, 
      teamName, 
      projectId,
      imageUrl: imageUrl || null,
      status: "To Do",
      createdBy: req.user.userId,
      createdAt: now,
      updatedAt: now,
      // THE FIX: Use req.user.email here instead of req.user.userId!
      auditLog: [{ action: "created", by: req.user.email, at: now }] 
    };
    
    await docClient.send(new PutCommand({ TableName: process.env.DYNAMODB_TASKS_TABLE, Item: task }));

    // Publish to SNS for notification + SQS worker
    await snsClient.send(new PublishCommand({
      TopicArn: process.env.SNS_TOPIC_ARN,
      Message: JSON.stringify({ taskId, title, assigneeId, assigneeName, teamId, teamName }),
      Subject: `New task assigned: ${title}`
    }));

    // CloudWatch metric — tasks created per day
    await publishMetric("TasksCreated", 1, [{ Name: "Team", Value: teamName || "Unknown" }]);

    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get tasks — manager sees all, employee sees only their team
router.get("/", authenticate, async (req, res) => {
  try {
    let result;
    if (req.user.role === "manager") {
      const { teamId } = req.query;
      if (teamId) {
        result = await docClient.send(new QueryCommand({
          TableName: process.env.DYNAMODB_TASKS_TABLE,
          IndexName: "teamId-index",
          KeyConditionExpression: "teamId = :teamId",
          ExpressionAttributeValues: { ":teamId": teamId }
        }));
      } else {
        result = await docClient.send(new ScanCommand({ TableName: process.env.DYNAMODB_TASKS_TABLE }));
      }
    } else {
      if (!req.user.teamId) return res.status(403).json({ error: "No team assigned" });
      result = await docClient.send(new QueryCommand({
        TableName: process.env.DYNAMODB_TASKS_TABLE,
        IndexName: "teamId-index",
        KeyConditionExpression: "teamId = :teamId",
        ExpressionAttributeValues: { ":teamId": req.user.teamId }
      }));
    }
    res.json(result.Items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get one task — enforce team check for employees
router.get("/:taskId", authenticate, async (req, res) => {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: process.env.DYNAMODB_TASKS_TABLE,
      Key: { taskId: req.params.taskId }
    }));
    if (!result.Item) return res.status(404).json({ error: "Task not found" });
    if (req.user.role !== "manager" && result.Item.teamId !== req.user.teamId) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(result.Item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update task
router.put("/:taskId", authenticate, async (req, res) => {
  try {
    const { status, title, description, priority, deadline } = req.body;
    const now = new Date().toISOString();

    // 1. Fetch the existing task
    const existing = await docClient.send(new GetCommand({
      TableName: process.env.DYNAMODB_TASKS_TABLE,
      Key: { taskId: req.params.taskId }
    }));
    
    if (!existing.Item) return res.status(404).json({ error: "Task not found" });
    if (req.user.role !== "manager" && existing.Item.teamId !== req.user.teamId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const existingTask = existing.Item;

    // 2. THE FIX: Merge incoming data with existing data.
    // If a field is undefined (not sent by frontend), keep the existing value.
    const finalStatus   = status !== undefined ? status : existingTask.status;
    const finalTitle    = title !== undefined ? title : existingTask.title;
    const finalDesc     = description !== undefined ? description : (existingTask.description || null);
    const finalPriority = priority !== undefined ? priority : existingTask.priority;
    const finalDeadline = deadline !== undefined ? deadline : (existingTask.deadline || null);

    // Only log the status change if it actually changed
    const auditLogUpdate = finalStatus !== existingTask.status 
      ? [{ action: `status changed from ${existingTask.status} to ${finalStatus}`, by: req.user.email, at: now }]
      : [];

    // 3. Send the merged data to DynamoDB
    const result = await docClient.send(new UpdateCommand({
      TableName: process.env.DYNAMODB_TASKS_TABLE,
      Key: { taskId: req.params.taskId },
      // Use list_append only if we have a new audit entry, otherwise just keep existing
      UpdateExpression: auditLogUpdate.length > 0 
        ? "set #s = :status, title = :title, description = :desc, priority = :priority, deadline = :deadline, updatedAt = :updatedAt, auditLog = list_append(auditLog, :audit)"
        : "set #s = :status, title = :title, description = :desc, priority = :priority, deadline = :deadline, updatedAt = :updatedAt",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: {
        ":status":   finalStatus,
        ":title":    finalTitle,
        ":desc":     finalDesc,
        ":priority": finalPriority,
        ":deadline": finalDeadline,
        ":updatedAt": now,
        ...(auditLogUpdate.length > 0 && { ":audit": auditLogUpdate })
      },
      ReturnValues: "ALL_NEW"
    }));

    // CloudWatch metric — tasks closed per team
    // Only trigger if the status is changing to Done right now
    if (finalStatus === "Done" && existingTask.status !== "Done") {
      await publishMetric("TasksClosed", 1, [{ Name: "Team", Value: existingTask.teamName || "Unknown" }]);
      
      const createdAt = new Date(existingTask.createdAt).getTime();
      const closedAt = new Date(now).getTime();
      const hoursToClose = (closedAt - createdAt) / (1000 * 60 * 60);
      
      await publishMetric("TimeToClose", hoursToClose, [{ Name: "Team", Value: existingTask.teamName || "Unknown" }]);
    }

    res.json(result.Attributes);
  } catch (err) {
    console.error("PUT ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// Delete task (manager only)
router.delete("/:taskId", authenticate, requireManager, async (req, res) => {
  try {
    await docClient.send(new DeleteCommand({
      TableName: process.env.DYNAMODB_TASKS_TABLE,
      Key: { taskId: req.params.taskId }
    }));
    res.json({ message: "Task deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
