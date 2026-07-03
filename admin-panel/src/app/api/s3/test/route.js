import { NextResponse } from "next/server";
import { HeadBucketCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import s3, { S3_BUCKET } from "@/lib/s3";

export async function GET() {
  const env = {
    AWS_REGION:          process.env.AWS_REGION          || "MISSING",
    AWS_S3_BUCKET_NAME:  process.env.AWS_S3_BUCKET_NAME  || "MISSING",
    AWS_ACCESS_KEY_ID:   process.env.AWS_ACCESS_KEY_ID   ? process.env.AWS_ACCESS_KEY_ID.slice(0, 8) + "****" : "MISSING",
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ? "****set****" : "MISSING",
  };

  const results = { env, tests: {} };

  // Test 1: can we reach the bucket?
  try {
    await s3.send(new HeadBucketCommand({ Bucket: S3_BUCKET }));
    results.tests.headBucket = "PASS";
  } catch (err) {
    results.tests.headBucket = `FAIL: ${err.name} | ${err.message} | HTTP ${err.$metadata?.httpStatusCode}`;
  }

  // Test 2: can we upload a tiny file?
  try {
    await s3.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: "test/_connectivity_check.txt",
      Body: Buffer.from("ok"),
      ContentType: "text/plain",
    }));
    results.tests.putObject = "PASS";
  } catch (err) {
    results.tests.putObject = `FAIL: ${err.name} | ${err.message} | HTTP ${err.$metadata?.httpStatusCode}`;
  }

  // Test 3: clean up test file
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: "test/_connectivity_check.txt" }));
    results.tests.deleteObject = "PASS";
  } catch (err) {
    results.tests.deleteObject = `FAIL: ${err.name} | ${err.message}`;
  }

  return NextResponse.json(results, { status: 200 });
}
