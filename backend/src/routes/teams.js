const express = require('express');
const router = express.Router();
const { ScanCommand, PutCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { docClient } = require('../config/aws');
const { authenticate, requireManager } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const TABLE = process.env.DYNAMODB_TEAMS_TABLE; // 'mini-jira-teams'

// GET /api/teams — all users can fetch teams (needed for dropdowns)
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await docClient.send(new ScanCommand({ TableName: TABLE }));
    const teams = (result.Items || []).map(t => ({
      teamId:   t.teamId,
      teamName: t.teamName || t.name || 'Unnamed',
      createdAt: t.createdAt,
    }));
    console.log('TEAMS:', teams); // confirm shape — remove after testing
    res.json(teams);
  } catch (err) {
    console.error('GET /teams error:', err);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// POST /api/teams — managers only
router.post('/', authenticate, requireManager, async (req, res) => {
  try {
    const { teamName } = req.body;
    if (!teamName || !teamName.trim()) {
      return res.status(400).json({ error: 'teamName is required' });
    }

    const team = {
      teamId:    uuidv4(),
      teamName:  teamName.trim(),
      createdAt: new Date().toISOString(),
    };

    await docClient.send(new PutCommand({ TableName: TABLE, Item: team }));
    console.log('CREATED TEAM:', team); // confirm — remove after testing
    res.status(201).json(team);
  } catch (err) {
    console.error('POST /teams error:', err);
    res.status(500).json({ error: 'Failed to create team' });
  }
});

// DELETE /api/teams/:teamId — managers only
router.delete('/:teamId', authenticate, requireManager, async (req, res) => {
  try {
    await docClient.send(new DeleteCommand({
      TableName: TABLE,
      Key: { teamId: req.params.teamId },
    }));
    res.json({ message: 'Team deleted' });
  } catch (err) {
    console.error('DELETE /teams error:', err);
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

module.exports = router;