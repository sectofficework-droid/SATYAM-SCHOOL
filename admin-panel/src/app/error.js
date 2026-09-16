"use client";

import { useEffect, useState } from "react";
import logger from "@/lib/logger";

// Catches render errors anywhere under the root layout's children
// (AGENTS.md §L — user sees a diagnostic ID, not a raw stack trace).
export default function Error({ error, reset }) {
  const [diagnosticId, setDiagnosticId] = useState(null);

  useEffect(() => {
    const id = logger.error(error?.message || "Unhandled render error", {
      stack: error?.stack,
      digest: error?.digest,
    });
    setDiagnosticId(id);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-xl font-semibold text-school-navy">Something went wrong</h1>
      <p className="text-sm text-slate-600">
        Please try again. If this keeps happening, share this ID with support:
      </p>
      <p className="rounded bg-slate-100 px-3 py-1 font-mono text-sm text-slate-800">
        {diagnosticId || "generating…"}
      </p>
      <button
        onClick={() => reset()}
        className="mt-2 rounded-md bg-school-navy px-4 py-2 text-sm font-medium text-white hover:bg-school-navy-dark"
      >
        Try again
      </button>
    </div>
  );
}
