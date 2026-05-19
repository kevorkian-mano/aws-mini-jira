const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand
} = require("@aws-sdk/client-s3");

const sharp = require("sharp");

const s3 = new S3Client({
  region: "us-east-1"
});

exports.handler = async (event) => {
  try {
    const bucket = event.Records[0].s3.bucket.name;

    const key = decodeURIComponent(
      event.Records[0].s3.object.key.replace(/\+/g, " ")
    );

    console.log("Processing image:", key);

    // only resize task images
    if (!key.startsWith("tasks/")) {
      return {
        statusCode: 200,
        body: "Skipped non-task image"
      };
    }

    // download image
    const getResult = await s3.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key
      })
    );

    const chunks = [];

    for await (const chunk of getResult.Body) {
      chunks.push(chunk);
    }

    const imageBuffer = Buffer.concat(chunks);

    // resize image
    const resized = await sharp(imageBuffer)
      .resize(300, 300, {
        fit: "inside"
      })
      .jpeg({
        quality: 80
      })
      .toBuffer();

    // upload resized image
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.RESIZED_BUCKET,
        Key: key,
        Body: resized,
        ContentType: "image/jpeg"
      })
    );

    console.log(`Successfully resized ${key}`);

    return {
      statusCode: 200,
      body: "Image resized successfully"
    };

  } catch (error) {
    console.error(error);

    return {
      statusCode: 500,
      body: "Resize failed"
    };
  }
};