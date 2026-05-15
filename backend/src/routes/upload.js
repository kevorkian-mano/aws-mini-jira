const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const { s3Client, docClient } = require("../config/aws");
const { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { UpdateCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");

const upload = multer({ storage: multer.memoryStorage() });

// Upload image for a task
router.post("/:taskId", authenticate, upload.single("image"), async (req, res) => {
  try {
    const { taskId } = req.params;

    // Check task exists and user has access
    const task = await docClient.send(new GetCommand({
      TableName: process.env.DYNAMODB_TASKS_TABLE,
      Key: { taskId }
    }));
    if (!task.Item) return res.status(404).json({ error: "Task not found" });
    if (req.user.role !== "manager" && task.Item.teamId !== req.user.teamId) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (!req.file) return res.status(400).json({ error: "No image provided" });

    // Upload to S3 originals bucket
    // S3 versioning is enabled so old versions are automatically retained
    const key = `tasks/${taskId}/image`;
    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.S3_ORIGINALS_BUCKET,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    }));

    const imageUrl = `https://${process.env.S3_ORIGINALS_BUCKET}.s3.amazonaws.com/${key}`;

    // Link image URL to task in DynamoDB
    await docClient.send(new UpdateCommand({
      TableName: process.env.DYNAMODB_TASKS_TABLE,
      Key: { taskId },
      UpdateExpression: "set imageUrl = :imageUrl, updatedAt = :updatedAt",
      ExpressionAttributeValues: {
        ":imageUrl": imageUrl,
        ":updatedAt": new Date().toISOString()
      }
    }));

    res.json({ imageUrl, message: "Image uploaded successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete image from a task
router.delete("/:taskId", authenticate, async (req, res) => {
  try {
    const { taskId } = req.params;

    const task = await docClient.send(new GetCommand({
      TableName: process.env.DYNAMODB_TASKS_TABLE,
      Key: { taskId }
    }));
    if (!task.Item) return res.status(404).json({ error: "Task not found" });
    if (req.user.role !== "manager" && task.Item.teamId !== req.user.teamId) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Delete from S3
    const key = `tasks/${taskId}/image`;
    await s3Client.send(new DeleteObjectCommand({
      Bucket: process.env.S3_ORIGINALS_BUCKET,
      Key: key
    }));

    // Remove imageUrl from task in DynamoDB
    await docClient.send(new UpdateCommand({
      TableName: process.env.DYNAMODB_TASKS_TABLE,
      Key: { taskId },
      UpdateExpression: "remove imageUrl set updatedAt = :updatedAt",
      ExpressionAttributeValues: {
        ":updatedAt": new Date().toISOString()
      }
    }));

    res.json({ message: "Image deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get presigned URL to view image (secure, temporary access)
router.get("/:taskId/url", authenticate, async (req, res) => {
  try {
    const { taskId } = req.params;

    const task = await docClient.send(new GetCommand({
      TableName: process.env.DYNAMODB_TASKS_TABLE,
      Key: { taskId }
    }));
    if (!task.Item) return res.status(404).json({ error: "Task not found" });
    if (req.user.role !== "manager" && task.Item.teamId !== req.user.teamId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const key = `tasks/${taskId}/image`;
    const url = await getSignedUrl(s3Client, new GetObjectCommand({
      Bucket: process.env.S3_ORIGINALS_BUCKET,
      Key: key
    }), { expiresIn: 3600 }); // URL valid for 1 hour

    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
