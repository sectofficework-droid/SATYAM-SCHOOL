// Centralized diagnostic logger (AGENTS.md §L). Structured JSON entries,
// auto-redacted, kept in a capped in-memory ring buffer and mirrored to
// console so Vercel/browser logs capture them too. error()/fatal() also
// submit to Supabase's diagnostic_reports table (REQ-HYG-006) so the admin
// panel UI and an AI agent (via this project's Supabase MCP connection) can
// retrieve them without a manual "report" step — unlike the mobile apps, no
// user action is needed here.
//
// Auto-submission is OFF by default and gated by diagnostic_settings.enabled
// (a single admin-toggled switch, see the "Logging" toggle on /diagnostics) —
// this logging exists for development/debugging, not to passively collect
// what users do, per the project owner's explicit instruction. Also
// throttled (per unique message, per session) so a single repeating bug
// can't flood the table regardless of the toggle.
import supabase from "./supabase";

const MAX_BUFFER = 200;
const SENSITIVE_KEY_PATTERN = /password|token|secret|apikey|api_key|authorization/i;
const AUTO_SUBMIT_COOLDOWN_MS = 5 * 60 * 1000; // don't resubmit the same message within 5 min
const AUTO_SUBMIT_SESSION_CAP = 20; // hard stop regardless of message variety

const buffer = [];
let sessionId = null;
let diagnosticsEnabled = false; // default OFF until refreshEnabledFlag() confirms otherwise
const recentAutoSubmits = new Map(); // message -> last-submitted-at ms
let sessionSubmitCount = 0;

function getSessionId() {
  if (typeof window === "undefined") return "server";
  if (sessionId) return sessionId;
  try {
    sessionId = window.sessionStorage.getItem("diag_session_id");
    if (!sessionId) {
      sessionId = `S-${Math.random().toString(36).slice(2, 10)}`;
      window.sessionStorage.setItem("diag_session_id", sessionId);
    }
  } catch {
    sessionId = `S-${Math.random().toString(36).slice(2, 10)}`;
  }
  return sessionId;
}

function redact(value) {
  if (value === null || value === undefined) return value;
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE_KEY_PATTERN.test(k) ? "[REDACTED]" : redact(v);
    }
    return out;
  }
  return value;
}

function newDiagnosticId() {
  return `ERR-${Math.random().toString(36).slice(2, 8)}`;
}

async function isEnabled() {
  // Client-side: use the cached flag (refreshed once by DiagnosticsInit) —
  // avoids a network round-trip on every single error. Server-side (API
  // routes): there's no long-lived process to cache it in across
  // serverless invocations, but server errors are rare enough that a live
  // read per occurrence is fine.
  if (typeof window !== "undefined") return diagnosticsEnabled;
  try {
    const { data, error } = await supabase.from("diagnostic_settings").select("enabled").eq("id", 1).single();
    return !error && !!data?.enabled;
  } catch {
    return false;
  }
}

/** Fire-and-forget — never let diagnostics reporting break the app it's diagnosing. */
async function submitReport(entry) {
  if (!(await isEnabled())) return;

  const now = Date.now();
  const last = recentAutoSubmits.get(entry.message);
  if (last && now - last < AUTO_SUBMIT_COOLDOWN_MS) return;
  if (sessionSubmitCount >= AUTO_SUBMIT_SESSION_CAP) return;
  recentAutoSubmits.set(entry.message, now);
  sessionSubmitCount++;

  supabase
    .from("diagnostic_reports")
    .insert({
      app: "admin-panel",
      platform: typeof window === "undefined" ? "server" : "web",
      session_id: entry.sessionId,
      log_entries: [entry],
      status: "New",
    })
    .then(({ error }) => {
      if (error) console.warn("[logger] failed to submit diagnostic report:", error.message);
    })
    .catch(() => {});
}

function write(level, message, context) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    sessionId: getSessionId(),
    message,
    ...(context ? { context: redact(context) } : {}),
  };

  buffer.push(entry);
  if (buffer.length > MAX_BUFFER) buffer.shift();

  const line = JSON.stringify(entry);
  if (level === "error" || level === "fatal") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);

  return entry;
}

export const logger = {
  debug: (message, context) => write("debug", message, context),
  info: (message, context) => write("info", message, context),
  warn: (message, context) => write("warn", message, context),
  /** Logs at error level, submits a diagnostic report, and returns a short diagnosticId to surface to the user. */
  error: (message, context) => {
    const diagnosticId = newDiagnosticId();
    const entry = write("error", message, { ...context, diagnosticId });
    submitReport(entry);
    return diagnosticId;
  },
  /** Same as error(), for failures severe enough to block the current flow entirely. */
  fatal: (message, context) => {
    const diagnosticId = newDiagnosticId();
    const entry = write("fatal", message, { ...context, diagnosticId });
    submitReport(entry);
    return diagnosticId;
  },
  getBuffer: () => [...buffer],
  /** Fetches the current on/off switch once (called from DiagnosticsInit on mount). */
  refreshEnabledFlag: async () => {
    try {
      const { data, error } = await supabase.from("diagnostic_settings").select("enabled").eq("id", 1).single();
      if (!error && data) diagnosticsEnabled = !!data.enabled;
    } catch {
      // leave as-is (default OFF) if this fails
    }
  },
};

export default logger;
