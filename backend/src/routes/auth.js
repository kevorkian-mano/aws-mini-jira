const express = require("express");
const router = express.Router();
const { authenticate, requireManager } = require("../middleware/auth");
const { CognitoIdentityProviderClient, AdminUpdateUserAttributesCommand, ListUsersCommand } = require("@aws-sdk/client-cognito-identity-provider");
const { docClient } = require("../config/aws");
const { PutCommand } = require("@aws-sdk/lib-dynamodb");

const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.COGNITO_REGION });

// Assign role and team to a user (manager only)
router.post('/assign-role', authenticate, requireManager, async (req, res) => {
  try {
    const { userId, email, username, role, teamId, teamName } = req.body;
    const cognitoUsername = username || email || userId;
    if (!cognitoUsername) {
      return res.status(400).json({ error: 'No valid user identifier provided' });
    }
    if (!role) {
      return res.status(400).json({ error: 'role is required' });
    }
    console.log('Assigning role to:', cognitoUsername, '→', role, teamId);
    const userAttributes = [
      { Name: 'custom:role', Value: role },
      { Name: 'custom:teamId', Value: teamId || '' },
      { Name: 'custom:teamName', Value: teamName || '' },
    ];
    const { CognitoIdentityProviderClient, AdminUpdateUserAttributesCommand } = require('@aws-sdk/client-cognito-identity-provider');
    const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.COGNITO_REGION });
    await cognitoClient.send(new AdminUpdateUserAttributesCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID,
      Username:   cognitoUsername,  
      UserAttributes: userAttributes,
    }));

    // Also update in DynamoDB Users table if you have one
    try {
      const { UpdateCommand } = require('@aws-sdk/lib-dynamodb');
      const { docClient } = require('../config/aws');

      await docClient.send(new UpdateCommand({
        TableName: process.env.DYNAMODB_USERS_TABLE,
        Key: { userId: userId || cognitoUsername },
        UpdateExpression: 'SET #role = :role, teamId = :teamId, teamName = :teamName',
        ExpressionAttributeNames: { '#role': 'role' },
        ExpressionAttributeValues: {
          ':role':     role,
          ':teamId':   teamId || '',
          ':teamName': teamName || '',
        },
      }));
    } catch (dbErr) {
      // DynamoDB update failed but Cognito succeeded — log and continue
      console.warn('DynamoDB user update failed (non-critical):', dbErr.message);
    }

    res.json({ message: 'Role assigned successfully' });
  } catch (err) {
    console.error('assign-role error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get all Cognito users (manager only)
router.get("/users", authenticate, requireManager, async (req, res) => {
  try {
    const result = await cognitoClient.send(new ListUsersCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID
    }));
    
    const users = result.Users.map(u => {
      // Helper function to easily grab attributes
      const getAttr = (name) => u.Attributes.find(a => a.Name === name)?.Value;
      
      return {
        username: u.Username,
        email: getAttr("email"),
        name: getAttr("name") || getAttr("given_name") || null, 
        role: getAttr("custom:role") || "employee",
        teamId: getAttr("custom:teamId"),
        teamName: getAttr("custom:teamName"),
        status: u.UserStatus
      };
    });
    
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Register user profile in DynamoDB after Cognito signup
router.post("/register-profile", authenticate, async (req, res) => {
  try {
    const user = {
      userId: req.user.userId,
      email: req.user.email,
      role: req.user.role,
      teamId: req.user.teamId,
      teamName: req.user.teamName,
      createdAt: new Date().toISOString()
    };
    await docClient.send(new PutCommand({
      TableName: process.env.DYNAMODB_USERS_TABLE,
      Item: user
    }));
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
