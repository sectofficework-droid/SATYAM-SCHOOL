"use client";

import { useState, useEffect } from "react";
import { getS3ViewUrl } from "@/lib/s3Upload";

// Resolves a private S3 object key into a short-lived presigned view URL.
// Renders `fallback` until resolved (or if there's no key / it fails to resolve).
export default function S3Image({ s3Key, alt, className, fallback = null }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    setUrl(null);
    if (!s3Key) return;
    getS3ViewUrl(s3Key).then((u) => { if (u) setUrl(u); }).catch(() => {});
  }, [s3Key]);

  if (!url) return fallback;
  return <img src={url} alt={alt} className={className} />;
}
