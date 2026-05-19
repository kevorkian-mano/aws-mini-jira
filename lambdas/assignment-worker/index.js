const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");

const {
  DynamoDBDocumentClient,
  PutCommand
} = require("@aws-sdk/lib-dynamodb");

const {
  CloudWatchClient,
  PutMetricDataCommand
} = require("@aws-sdk/client-cloudwatch");

const { v4: uuidv4 } = require("uuid");

const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: "us-east-1"
  })
);

const cloudwatch = new CloudWatchClient({
  region: "us-east-1"
});

exports.handler = async (event) => {
  try {

    for (const record of event.Records) {

      // SQS body
      const body = JSON.parse(record.body);

      // SNS message inside SQS
      const message = JSON.parse(body.Message);

      console.log("Assignment Event:", message);

      // Write activity log
      await dynamo.send(
        new PutCommand({
          TableName: "Comments",
          Item: {
            activityId: uuidv4(),
            type: "TASK_ASSIGNED",
            taskId: message.taskId,
            title: message.title,
            assigneeId: message.assigneeId,
            assigneeName: message.assigneeName,
            teamId: message.teamId,
            teamName: message.teamName,
            createdAt: new Date().toISOString()
          }
        })
      );

      // Publish CloudWatch metric
      await cloudwatch.send(
        new PutMetricDataCommand({
          Namespace: "MiniJira",
          MetricData: [
            {
              MetricName: "TasksAssignedPerTeam",
              Dimensions: [
                {
                  Name: "TeamName",
                  Value: message.teamName
                }
              ],
              Unit: "Count",
              Value: 1
            }
          ]
        })
      );

      console.log("Metric published successfully");
    }

    return {
      statusCode: 200,
      body: "Processed successfully"
    };

  } catch (error) {

    console.error(error);

    return {
      statusCode: 500,
      body: "Worker failed"
    };
  }
};