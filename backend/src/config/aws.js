const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");
const { S3Client } = require("@aws-sdk/client-s3");
const { SNSClient } = require("@aws-sdk/client-sns");
const { SQSClient } = require("@aws-sdk/client-sqs");

const REGION = process.env.AWS_REGION || "us-east-1";

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const s3Client = new S3Client({ region: REGION });
const snsClient = new SNSClient({ region: REGION });
const sqsClient = new SQSClient({ region: REGION });

module.exports = { docClient, s3Client, snsClient, sqsClient };
