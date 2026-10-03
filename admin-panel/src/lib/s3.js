import { S3Client } from "@aws-sdk/client-s3";

// Server-side only — never import this file from a client component.
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  // SDK v3's default ("WHEN_SUPPORTED") attaches x-amz-checksum-*/
  // x-amz-sdk-checksum-algorithm headers to every presigned PutObject URL -
  // the bucket's CORS AllowedHeaders predates this and doesn't list them,
  // so the browser's preflight OPTIONS for a direct browser->S3 presigned
  // upload (see uploadFileToS3Presigned in s3Upload.js, used by the App
  // Update feature) gets a 403 before the real PUT is ever sent. PutObject
  // doesn't require a checksum, so WHEN_REQUIRED stops the SDK from adding
  // these headers at all, rather than requiring a bucket CORS change.
  requestChecksumCalculation: "WHEN_REQUIRED",
});

export const S3_BUCKET = process.env.AWS_S3_BUCKET_NAME;

export default s3;
