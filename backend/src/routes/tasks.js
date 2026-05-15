const express = require("express");
const router = express.Router();
const { authenticate, requireManager } = require("../middleware/auth");
const { docClient, snsClient } = require("../config/aws");
const { PutCommand, GetCommand, UpdateCommand, DeleteCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { PublishCommand } = require("@aws-sdk/client-sns");
const { v4: uuidv4 } = require("uuid");

// Create task (manager only)
router.post("/", authenticate, requireManager, async (req, res) => {
  try {
    const { title, description, priority, deadline, assigneeId, assigneeName, teamId, teamName, projectId, imageUrl } = req.body;
    const taskId = uuidv4();
    const now = new Date().toISOString();
    const task = {
      taskId, title, description, priority, deadline,
      assigneeId, assigneeName, teamId, teamName, projectId,
      imageUrl: imageUrl || null,
      status: "To Do",
      createdBy: req.user.userId,
      createdAt: now,
      updatedAt: now,
      auditLog: [{ action: "created", by: req.user.userId, at: now }]
    };
    await docClient.send(new PutCommand({ TableName: process.env.DYNAMODB_TASKS_TABLE, Item: task }));

    // Publish to SNS for notification
    await snsClient.send(new PublishCommand({
      TopicArn: process.env.SNS_TOPIC_ARN,
      Message: JSON.stringify({ taskId, title, assigneeId, assigneeName, teamId, teamName }),
      Subject: `New task assigned: ${title}`
    }));

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
      // Manager sees everything — filter by teamId query param if provided
      const { teamId } = req.query;
      if (teamId) {
        result = await docClient.send(new QueryCommand({
          TableName: process.env.DYNAMODB_TASKS_TABLE,
          IndexName: "teamId-index",
          KeyConditionExpression: "teamId = :teamId",
          ExpressionAttributeValues: { ":teamId": teamId }
        }));
      } else {
        const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
        result = await docClient.send(new ScanCommand({ TableName: process.env.DYNAMODB_TASKS_TABLE }));
      }
    } else {
      // Employee — server-side enforce team filter using GSI
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
    // Team isolation — employee cannot fetch another team's task by guessing ID
    if (req.user.role !== "manager" && result.Item.teamId !== req.user.teamId) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(result.Item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update task status (employee can update their team's tasks)
router.put("/:taskId", authenticate, async (req, res) => {
  try {
    const { status, title, description, priority, deadline, imageUrl } = req.body;
    const now = new Date().toISOString();

    // First get the task to check team
    const existing = await docClient.send(new GetCommand({
      TableName: process.env.DYNAMODB_TASKS_TABLE,
      Key: { taskId: req.params.taskId }
    }));
    if (!existing.Item) return res.status(404).json({ error: "Task not found" });
    if (req.user.role !== "manager" && existing.Item.teamId !== req.user.teamId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const auditEntry = { action: `status changed to ${status}`, by: req.user.userId, at: now };
    const result = await docClient.send(new UpdateCommand({
      TableName: process.env.DYNAMODB_TASKS_TABLE,
      Key: { taskId: req.params.taskId },
      UpdateExpression: "set #s = :status, title = :title, description = :desc, priority = :priority, deadline = :deadline, updatedAt = :updatedAt, auditLog = list_append(auditLog, :audit)",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: {
        ":status": status,
        ":title": title,
        ":desc": description,
        ":priority": priority,
        ":deadline": deadline,
        ":updatedAt": now,
        ":audit": [auditEntry]
      },
      ReturnValues: "ALL_NEW"
    }));
    res.json(result.Attributes);
  } catch (err) {
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
