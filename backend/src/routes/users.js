const express = require("express");
const router = express.Router();
const { authenticate, requireManager } = require("../middleware/auth");
const { docClient } = require("../config/aws");
const { PutCommand, GetCommand, ScanCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");

// Create/register user profile in DynamoDB after Cognito signup
router.post("/", authenticate, async (req, res) => {
  try {
    const { userId, email, role, teamId, teamName } = req.body;
    const user = { userId, email, role: role || "employee", teamId, teamName, createdAt: new Date().toISOString() };
    await docClient.send(new PutCommand({ TableName: process.env.DYNAMODB_USERS_TABLE, Item: user }));
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all users (manager only)
router.get("/", authenticate, requireManager, async (req, res) => {
  try {
    const result = await docClient.send(new ScanCommand({ TableName: process.env.DYNAMODB_USERS_TABLE }));
    res.json(result.Items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get one user
router.get("/:userId", authenticate, async (req, res) => {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: process.env.DYNAMODB_USERS_TABLE,
      Key: { userId: req.params.userId }
    }));
    if (!result.Item) return res.status(404).json({ error: "User not found" });
    res.json(result.Item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update user team (manager only)
router.put("/:userId", authenticate, requireManager, async (req, res) => {
  try {
    const { teamId, teamName, role } = req.body;
    const result = await docClient.send(new UpdateCommand({
      TableName: process.env.DYNAMODB_USERS_TABLE,
      Key: { userId: req.params.userId },
      UpdateExpression: "set teamId = :teamId, teamName = :teamName, #r = :role",
      ExpressionAttributeNames: { "#r": "role" },
      ExpressionAttributeValues: { ":teamId": teamId, ":teamName": teamName, ":role": role },
      ReturnValues: "ALL_NEW"
    }));
    res.json(result.Attributes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
