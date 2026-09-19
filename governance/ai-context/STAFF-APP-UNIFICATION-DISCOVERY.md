# STAFF-APP-UNIFICATION-DISCOVERY.md

> Verbatim discovery input, received 2026-09-18, for evolving `mobile-app/`'s
> Teacher app into a single role-aware Staff App (Teacher + Admin
> workspaces). Kept verbatim per the same convention as `ai-context\SATYAM
> SCHOOL PROJECT UNDERSTANDING PROMPT.txt` — treat as historical intent
> input to `planning\STAFF-APP-UNIFICATION-PLAN.md`, not a live spec to
> re-read on its own; the plan file is what gets kept current.

---

You are working on an existing live school ERP project for **Satyam Stars International School, Surat**.

The project already contains:

* `admin-panel/` — existing Next.js 14 web Admin Panel / ERP
* `mobile-app/` — existing Flutter mobile application
* Shared Supabase backend/database
* Existing employee-code-based staff authentication
* Existing administrative roles:

  * `normal_admin`
  * `senior_admin`
  * `management`

The mobile application currently functions primarily as a Teacher/Staff application.

Your task is to evolve the existing mobile application into a **single role-based Staff App** that supports teaching staff and administrative staff, while preserving existing functionality, permissions, architecture, and production behavior.

Do not rebuild the application from scratch.

Do not create a separate Admin App unless the existing architecture makes that technically unavoidable.

The preferred solution is one Flutter Staff App with role-aware workspaces.

(Full 33-section spec — target architecture, role-resolution precedence,
centralized role context, failure rules, auth audit requirements, Admin
Panel feature-parity requirements, permission model, security rules,
Supabase audit requirements, mobile UX rules, dashboards, tasks, teacher
preservation, flavor preservation, navigation, phases, error handling,
diagnostic logging, performance, "do not invent business rules," "do not
silently remove features," UI consistency, acceptance criteria, required
test matrix, required final report, and non-negotiable development rules —
supplied in full by the user in-session on 2026-09-18. Reproduced in the
session's own transcript; summarized and mapped to this project's actual
state in `planning\STAFF-APP-UNIFICATION-PLAN.md` rather than duplicated
here a second time.)

Core non-negotiables carried into the plan file:
- Single Flutter Staff App, not a separate Admin App, unless technically unavoidable.
- Teacher status and Admin role are two independent dimensions — neither implies the other.
- `normal_admin` / `senior_admin` / `management` stay distinct — never flattened, never inherited.
- Role resolution must be centralized, deterministic, backend-authoritative — no per-screen guessing, no UI-only security.
- Every existing Admin Panel feature must be inventoried; each is either implemented on mobile or explicitly marked "Available only in Admin Panel" with a reason — never silently dropped.
- No new auth system; no unnecessary schema/duplication; existing Teacher functionality and existing Flutter flavors must not regress.
- Read-only audit first; no large rewrite before it; incremental phases; explicit test matrix across all role combinations the data actually supports.
