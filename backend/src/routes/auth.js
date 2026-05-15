const express = require("express");
const router = express.Router();
const { authenticate, requireManager } = require("../middleware/auth");
const { CognitoIdentityProviderClient, AdminUpdateUserAttributesCommand, ListUsersCommand } = require("@aws-sdk/client-cognito-identity-provider");
const { docClient } = require("../config/aws");
const { PutCommand } = require("@aws-sdk/lib-dynamodb");

const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.COGNITO_REGION });

// Assign role and team to a user (manager only)
router.post("/assign-role", authenticate, requireManager, async (req, res) => {
  try {
    const { username, role, teamId, teamName } = req.body;
    await cognitoClient.send(new AdminUpdateUserAttributesCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID,
      Username: username,
      UserAttributes: [
        { Name: "custom:role", Value: role },
        { Name: "custom:teamId", Value: teamId },
        { Name: "custom:teamName", Value: teamName }
      ]
    }));
    res.json({ message: "Role assigned successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all Cognito users (manager only)
router.get("/users", authenticate, requireManager, async (req, res) => {
  try {
    const result = await cognitoClient.send(new ListUsersCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID
    }));
    const users = result.Users.map(u => ({
      username: u.Username,
      email: u.Attributes.find(a => a.Name === "email")?.Value,
      role: u.Attributes.find(a => a.Name === "custom:role")?.Value || "employee",
      teamId: u.Attributes.find(a => a.Name === "custom:teamId")?.Value,
      teamName: u.Attributes.find(a => a.Name === "custom:teamName")?.Value,
      status: u.UserStatus
    }));
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
