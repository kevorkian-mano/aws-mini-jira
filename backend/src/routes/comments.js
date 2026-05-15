const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const { docClient } = require("../config/aws");
const { PutCommand, ScanCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { v4: uuidv4 } = require("uuid");

// Create comment
router.post("/", authenticate, async (req, res) => {
  try {
    const { taskId, content } = req.body;
    const task = await docClient.send(new GetCommand({
      TableName: process.env.DYNAMODB_TASKS_TABLE,
      Key: { taskId }
    }));
    if (!task.Item) return res.status(404).json({ error: "Task not found" });
    if (req.user.role !== "manager" && task.Item.teamId !== req.user.teamId) {
      return res.status(403).json({ error: "Access denied" });
    }
    const comment = {
      commentId: uuidv4(),
      taskId,
      content,
      authorId: req.user.userId,
      authorEmail: req.user.email,
      createdAt: new Date().toISOString()
    };
    await docClient.send(new PutCommand({ TableName: process.env.DYNAMODB_COMMENTS_TABLE, Item: comment }));
    res.status(201).json(comment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get comments for a task
router.get("/:taskId", authenticate, async (req, res) => {
  try {
    const task = await docClient.send(new GetCommand({
      TableName: process.env.DYNAMODB_TASKS_TABLE,
      Key: { taskId: req.params.taskId }
    }));
    if (!task.Item) return res.status(404).json({ error: "Task not found" });
    if (req.user.role !== "manager" && task.Item.teamId !== req.user.teamId) {
      return res.status(403).json({ error: "Access denied" });
    }
    const result = await docClient.send(new ScanCommand({
      TableName: process.env.DYNAMODB_COMMENTS_TABLE,
      FilterExpression: "taskId = :taskId",
      ExpressionAttributeValues: { ":taskId": req.params.taskId }
    }));
    res.json(result.Items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
