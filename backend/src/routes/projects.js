const express = require("express");
const router = express.Router();
const { authenticate, requireManager } = require("../middleware/auth");
const { docClient } = require("../config/aws");
const { PutCommand, GetCommand, ScanCommand, UpdateCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { v4: uuidv4 } = require("uuid");

// Create project (manager only)
router.post("/", authenticate, requireManager, async (req, res) => {
  try {
    const { name, description } = req.body;
    const projectId = uuidv4();
    const project = { projectId, name, description, createdBy: req.user.userId, createdAt: new Date().toISOString() };
    await docClient.send(new PutCommand({ TableName: process.env.DYNAMODB_PROJECTS_TABLE, Item: project }));
    res.status(201).json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/", authenticate, async (req, res) => {
  try {
    let result;
    
    if (req.user.role === "manager") {
      const { teamId } = req.query;
      if (teamId) {
        // Fetches projects for a specific team
        result = await docClient.send(new QueryCommand({
          TableName: process.env.DYNAMODB_PROJECTS_TABLE,
          IndexName: "teamId-index",
          KeyConditionExpression: "teamId = :teamId",
          ExpressionAttributeValues: { ":teamId": teamId }
        }));
      } else {
        // FIX: You MUST have this else block so result isn't undefined!
        result = await docClient.send(new ScanCommand({ 
          TableName: process.env.DYNAMODB_PROJECTS_TABLE 
        }));
      }
    }
    
    else {
      if (!req.user.teamId) {
         console.log("FAILED: User has no teamId in their token!");
         return res.status(403).json({ error: "No team assigned" });
      }

      result = await docClient.send(new QueryCommand({
        TableName: process.env.DYNAMODB_TASKS_TABLE,
        IndexName: "teamId-index",
        KeyConditionExpression: "teamId = :teamId",
        ExpressionAttributeValues: { ":teamId": req.user.teamId }
      }));
      
      // DEBUG 2: Check what DynamoDB actually returned
      console.log(`DynamoDB found ${result.Items.length} tasks for team ${req.user.teamId}`);
    }



    res.json(result.Items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get one project
router.get("/:projectId", authenticate, async (req, res) => {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: process.env.DYNAMODB_PROJECTS_TABLE,
      Key: { projectId: req.params.projectId }
    }));
    if (!result.Item) return res.status(404).json({ error: "Project not found" });
    res.json(result.Item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update project (manager only)
router.put("/:projectId", authenticate, requireManager, async (req, res) => {
  try {
    const { name, description } = req.body;
    const result = await docClient.send(new UpdateCommand({
      TableName: process.env.DYNAMODB_PROJECTS_TABLE,
      Key: { projectId: req.params.projectId },
      UpdateExpression: "set #n = :name, description = :desc",
      ExpressionAttributeNames: { "#n": "name" },
      ExpressionAttributeValues: { ":name": name, ":desc": description },
      ReturnValues: "ALL_NEW"
    }));
    res.json(result.Attributes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete project (manager only)
router.delete("/:projectId", authenticate, requireManager, async (req, res) => {
  try {
    await docClient.send(new DeleteCommand({
      TableName: process.env.DYNAMODB_PROJECTS_TABLE,
      Key: { projectId: req.params.projectId }
    }));
    res.json({ message: "Project deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
