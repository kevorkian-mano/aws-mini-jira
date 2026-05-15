const { CloudWatchClient, PutMetricDataCommand } = require("@aws-sdk/client-cloudwatch");

const cwClient = new CloudWatchClient({ region: process.env.AWS_REGION || "us-east-1" });

const publishMetric = async (metricName, value, dimensions) => {
  try {
    await cwClient.send(new PutMetricDataCommand({
      Namespace: "MiniJira",
      MetricData: [{
        MetricName: metricName,
        Value: value,
        Unit: "Count",
        Dimensions: dimensions || [],
        Timestamp: new Date()
      }]
    }));
  } catch (err) {
    console.error("CloudWatch metric error:", err.message);
  }
};

module.exports = { publishMetric };
