import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import s3, { S3_BUCKET } from "@/lib/s3";

function isAllowedKey(key) {
  
  