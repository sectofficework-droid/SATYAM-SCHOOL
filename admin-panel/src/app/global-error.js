"use client";

import { useEffect, useState } from "react";
import logger from "@/lib/logger";

// Catches errors in the root layout itself (rare) — Next.js requires this
// file to render its own <html>/<body> since it replaces the root layout
// when triggered. See also src/app/error.js for the normal (far more
// common) case of an error inside the layout's children.
export default function GlobalError({ error, reset }) {
  const [diagnosticId, setDiagnosticId] = useState(null);

  useEffect(() => {
    const id = logger.fatal(error?.message || "Unhandled root layout error", {
      stack: error?.stack,
      digest: error?.digest,
    });
    setDiagnosticId(id);
  }, [error]);

  return (
    <html lang="en-GB">
      <body className="antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-4 text-center">
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
      </body>
    </html>
  );
}
