const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { CloudWatchClient, PutMetricDataCommand } = require("@aws-sdk/client-cloudwatch");
const { randomUUID } = require("crypto");
const nodemailer = require("nodemailer");

const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: "us-east-1" })
);
const cloudwatch = new CloudWatchClient({ region: "us-east-1" });

// Create SMTP transporter using Gmail
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

exports.handler = async (event) => {
  try {
    for (const record of event.Records) {

      const body = JSON.parse(record.body);
      const message = JSON.parse(body.Message);

      console.log("Assignment Event:", JSON.stringify(message));

      // ── 1. Write audit log to DynamoDB ──────────────────────────────
      await dynamo.send(new PutCommand({
        TableName: "mini-jira-activity-log",
        Item: {
          logId: randomUUID(),
          type: "TASK_ASSIGNED",
          taskId: message.taskId || "",
          title: message.title || "",
          assigneeId: message.assigneeId || "",
          assigneeName: message.assigneeName || "",
          assigneeEmail: message.assigneeEmail || "",
          teamId: message.teamId || "",
          teamName: message.teamName || "Unknown",
          priority: message.priority || "",
          deadline: message.deadline || "",
          createdAt: new Date().toISOString(),
        },
      }));

      console.log("Audit log written successfully");

      // ── 2. Send targeted email ONLY to the assignee ─────────────────
      if (message.assigneeEmail) {
        await transporter.sendMail({
          from: `"Mini-Jira" <${process.env.SMTP_FROM}>`,
          to: message.assigneeEmail,   // ← ONLY Sara gets this
          subject: `[Mini-Jira] New Task Assigned: ${message.title}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #2563eb; padding: 20px; border-radius: 8px 8px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 20px;">Mini-Jira</h1>
              </div>
              <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
                <h2 style="color: #111827;">Hi ${message.assigneeName},</h2>
                <p style="color: #6b7280;">A new task has been assigned to you:</p>

                <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280; width: 100px;">Task</td>
                      <td style="padding: 8px 0; color: #111827; font-weight: bold;">${message.title}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280;">Team</td>
                      <td style="padding: 8px 0; color: #111827;">${message.teamName || "N/A"}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280;">Priority</td>
                      <td style="padding: 8px 0; color: #111827;">${message.priority || "N/A"}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280;">Deadline</td>
                      <td style="padding: 8px 0; color: #111827;">${message.deadline || "N/A"}</td>
                    </tr>
                  </table>
                </div>

                <a href="${process.env.CLOUDFRONT_URL || "#"}"
                   style="display: inline-block; background: #2563eb; color: white;
                          padding: 12px 24px; border-radius: 6px; text-decoration: none;
                          font-weight: bold; margin-top: 10px;">
                  View Task in Mini-Jira
                </a>

                <p style="color: #9ca3af; font-size: 12px; margin-top: 30px;">
                  This is an automated notification from Mini-Jira.
                </p>
              </div>
            </div>
          `,
        });

        console.log(`Email sent to: ${message.assigneeEmail}`);
      } else {
        console.log("No assignee email — skipping email");
      }

      // ── 3. Publish CloudWatch metric ────────────────────────────────
      await cloudwatch.send(new PutMetricDataCommand({
        Namespace: "MiniJira",
        MetricData: [{
          MetricName: "TasksAssignedPerTeam",
          Dimensions: [{
            Name: "TeamName",
            Value: message.teamName || "Unknown",
          }],
          Unit: "Count",
          Value: 1,
          Timestamp: new Date(),
        }],
      }));

      console.log("CloudWatch metric published");
    }

    return { statusCode: 200, body: "Processed successfully" };

  } catch (error) {
    console.error("Worker error:", error.message);
    throw error;
  }
};