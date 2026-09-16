"use client";

import { useEffect } from "react";
import logger from "@/lib/logger";

// Global error capture (AGENTS.md §L7) — catches failures even when a
// developer forgot a local log call.
export default function DiagnosticsInit() {
  useEffect(() => {
    // Fetch the on/off switch once per page load — auto-submission stays
    // OFF (the logger's default) until this confirms it's enabled.
    logger.refreshEnabledFlag();

    function handleError(event) {
      logger.error(event.message || "window.onerror", {
        source: event.filename,
        line: event.lineno,
        column: event.colno,
        stack: event.error?.stack,
      });
    }
    function handleRejection(event) {
      logger.error("Unhandled promise rejection", {
        reason: event.reason?.message || String(event.reason),
        stack: event.reason?.stack,
      });
    }
    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return null;
}
