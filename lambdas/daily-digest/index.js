const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");

const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: "us-east-1" })
);

const sns = new SNSClient({ region: "us-east-1" });

exports.handler = async () => {
  try {
    const today = new Date().toISOString().split("T")[0];
    console.log("Running daily digest for date:", today);

    const result = await dynamo.send(new ScanCommand({
      TableName: process.env.DYNAMODB_TASKS_TABLE,
      FilterExpression: "begins_with(deadline, :today) AND #s <> :done",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: {
        ":today": today,
        ":done":  "Done",
      },
    }));

    const tasks = result.Items || [];
    console.log(`Found ${tasks.length} tasks due today`);

    if (tasks.length === 0) {
      console.log("No tasks due today");
      return { statusCode: 200, body: "No tasks due today" };
    }

    for (const task of tasks) {
      await sns.send(new PublishCommand({
        TopicArn: process.env.SNS_TOPIC_ARN,
        Subject:  `[Mini-Jira] Task Due Today: ${task.title}`,
        Message:  `Daily Digest Reminder:\n\n` +
                  `Task: "${task.title}"\n` +
                  `Description: ${task.description || "No description"}\n` +
                  `Status: ${task.status}\n` +
                  `Priority: ${task.priority}\n` +
                  `Assignee: ${task.assigneeName || task.assigneeId}\n` +
                  `Team: ${task.teamName || task.teamId}\n` +
                  `Deadline: ${task.deadline}\n\n` +
                  `Please log in to Mini-Jira to update this task.`,
      }));
      console.log(`Sent digest for task: ${task.title}`);
    }

    return { statusCode: 200, body: `Processed ${tasks.length} tasks` };

  } catch (error) {
    console.error("Daily digest error:", error.message);
    throw error;
  }
};