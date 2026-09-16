import { NextResponse } from "next/server";
import logger from "./logger";

/**
 * Wraps an API route handler so an uncaught exception is logged with a
 * diagnosticId and returned as structured JSON instead of Next.js's default
 * unstructured 500 (AGENTS.md §L). Routes that already return their own
 * error response from an internal try/catch are unaffected — this only
 * fires for whatever they didn't already catch.
 */
export function withDiagnostics(handler) {
  return async function wrapped(request, ...rest) {
    try {
      return await handler(request, ...rest);
    } catch (err) {
      const diagnosticId = logger.error(`API error: ${request.method} ${new URL(request.url).pathname}`, {
        stack: err?.stack,
        message: err?.message,
      });
      return NextResponse.json({ error: "Something went wrong", diagnosticId }, { status: 500 });
    }
  };
}
