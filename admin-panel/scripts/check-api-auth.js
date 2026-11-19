#!/usr/bin/env node
// Guards against the exact bug class found 3 times during the
// 2026-11-18/19 full-system audit (REQ-SEC-012/024/025): a Next.js API
// route under src/app/api using the Supabase service-role key (which
// bypasses RLS entirely) with no caller-identity check at all. Run with
// `npm run check:auth` - exits non-zero (and fails CI, once CI exists) if
// any route fails the check, so this recurring mistake gets caught before
// merge instead of during the next full-system audit.
//
// Recognizes every auth pattern already proven in this codebase (see
// admin-panel/database/*.sql and mobile-app/*.sql REQ-SEC fixes for the
// history of each): requireAdminSession/requireAdminOrMobileSession
// (apiAuth.js), requireStaffAdminTier (reportsServerAuth.js), the
// CRON_SECRET bearer check (the 2 cron routes), and admin-users/route.js's
// own bespoke requireCaller(). A route using the service key with NONE of
// these present is flagged - it either needs one of them, or (if it's a
// deliberately public route) an explicit `// check-api-auth: public, because <reason>`
// comment acknowledging that choice.

const fs = require("fs");
const path = require("path");

const API_DIR = path.join(__dirname, "..", "src", "app", "api");

const SERVICE_KEY_SIGNALS = [
  "getAdminClient(",
  "supabaseServiceClient(",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const AUTH_GUARD_SIGNALS = [
  "requireAdminSession(",
  "requireAdminOrMobileSession(",
  "requireStaffAdminTier(",
  "requireCaller(",
  "CRON_SECRET",
];

const EXPLICIT_PUBLIC_MARKER = "check-api-auth: public";

function findRouteFiles(dir) {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(findRouteFiles(full));
    } else if (entry.name === "route.js") {
      results.push(full);
    }
  }
  return results;
}

function main() {
  const routeFiles = findRouteFiles(API_DIR);
  const problems = [];

  for (const file of routeFiles) {
    const content = fs.readFileSync(file, "utf8");
    const usesServiceKey = SERVICE_KEY_SIGNALS.some((s) => content.includes(s));
    if (!usesServiceKey) continue; // nothing privileged here, no check needed

    const hasGuard = AUTH_GUARD_SIGNALS.some((s) => content.includes(s));
    const explicitlyPublic = content.includes(EXPLICIT_PUBLIC_MARKER);
    if (!hasGuard && !explicitlyPublic) {
      problems.push(path.relative(path.join(__dirname, ".."), file));
    }
  }

  if (problems.length > 0) {
    console.error("check-api-auth: found service-role routes with no recognized auth guard:\n");
    for (const p of problems) console.error("  - " + p);
    console.error(
      "\nAdd one of: requireAdminSession/requireAdminOrMobileSession (@/lib/apiAuth), " +
      "requireStaffAdminTier (@/lib/reportsServerAuth), or a CRON_SECRET check - " +
      "or, if this route is deliberately public, add a `// check-api-auth: public, because <reason>` comment."
    );
    process.exit(1);
  }

  console.log(`check-api-auth: OK (${routeFiles.length} routes checked, all service-role routes guarded)`);
}

main();
