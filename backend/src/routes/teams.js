const express = require("express");
const router = express.Router();
const { authenticate, requireManager } = require("../middleware/auth");
const { docClient } = require("../config/aws");
const { PutCommand, GetCommand, ScanCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { v4: uuidv4 } = require("uuid");

// Create team (manager only)
router.post("/", authenticate, requireManager, async (req, res) => {
  try {
    const { name } = req.body;
    const teamId = uuidv4();
    const team = { teamId, name, createdAt: new Date().toISOString() };
    await docClient.send(new PutCommand({ TableName: process.env.DYNAMODB_TEAMS_TABLE, Item: team }));
    res.status(201).json(team);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all teams
router.get("/", authenticate, async (req, res) => {
  try {
    const result = await docClient.send(new ScanCommand({ TableName: process.env.DYNAMODB_TEAMS_TABLE }));
    res.json(result.Items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get one team
router.get("/:teamId", authenticate, async (req, res) => {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: process.env.DYNAMODB_TEAMS_TABLE,
      Key: { teamId: req.params.teamId }
    }));
    if (!result.Item) return res.status(404).json({ error: "Team not found" });
    res.json(result.Item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete team (manager only)
router.delete("/:teamId", authenticate, requireManager, async (req, res) => {
  try {
    await docClient.send(new DeleteCommand({
      TableName: process.env.DYNAMODB_TEAMS_TABLE,
      Key: { teamId: req.params.teamId }
    }));
    res.json({ message: "Team deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
