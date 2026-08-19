# UI-SPEC.md — SATYAM-SCHOOL

> Backfilled from the shipped UI (`admin-panel/tailwind.config.js` +
> component usage), not a pre-implementation design doc. UI DESIGN CONFIRMED
> is implicit (already shipped/iterated across many commits) — this file
> exists so future UI additions stay visually consistent, and so the
> checkbox-driven gate exists for genuinely new surfaces (e.g. a future
> parent portal) rather than for re-litigating what's live.

## Palette (`admin-panel/tailwind.config.js` → `theme.extend.colors.school`)
| Token | Hex |
|---|---|
| `school-navy` | `#1e3a5f` |
| `school-navy-dark` | `#152d4a` |
| `school-navy-light` | `#2a4f7c` |
| `school-gold` | `#f59e0b` |
| `school-gold-dark` | `#d97706` |
| `school-gold-light` | `#fbbf24` |

Plus the full shadcn/ui semantic token set (`background`, `foreground`,
`card`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`,
`input`, `ring`, `sidebar-*`) driven by CSS variables — standard shadcn
theming, not custom per-page colors. New UI should use the semantic tokens
first, `school-*` for brand accents only.

## Typography
No custom font is loaded — checked `admin-panel/src/app/layout.js` (no
`next/font` import) and `globals.css` (no `font-family` declaration).
The UI runs on Tailwind's default system font stack, with only `antialiased`
applied for smoothing. This is a real gap against a "professional, ERP-focused"
brand feel (original discovery doc §15) — flagged here, not fixed; adding a
brand typeface is a MODERATE candidate for `planning\TODO.md`, not something
to change inline while writing this spec.

## Component inventory
shadcn/ui component set (`shadcn: ^4.7.0` in `package.json`) + Lucide React
icons + Recharts for charts + Sonner for toasts. No separate component
library doc exists beyond the installed shadcn components themselves — the
`src/components/` tree (or equivalent) is the living inventory; don't
re-list it here where it will drift.

## Layout pattern
Sidebar-driven admin dashboard (per the original discovery doc's "left
sidebar, dashboard cards, data tables, filters, CRUD forms, search, bulk
actions" pattern, which the shipped UI does follow) — School/SEF org toggle
lives in the header (commit `d3080d7`), Settings tab is always last (same
commit).

## Page-by-page checklist
The real, current route map (23+ routes, 12-tab Settings, 2 SEF-parallel
route trees) is maintained in `governance\documentation\PROJECT_CONTEXT.md` §"Route Map — Admin
Panel" and §"Module Status" — treated as the live checklist. Do not
duplicate it here; it would go stale immediately since it's actively
maintained elsewhere.

## Interactions
Toasts via Sonner for success/error feedback; forms via React Hook Form +
Zod inline validation. No documented motion/animation system beyond
component-level (e.g. the birthdays celebration overlay, commit `ce21e22`).

## Responsive behavior
Mobile app (Flutter) is the mobile surface — the admin panel is desktop-first
per the original discovery doc's "Mobile responsive" note but is primarily
used on desktop by school staff; no explicit breakpoint audit has been done.
Flagged as a gap, not fixed here.

## Mobile app UI
Flutter Material-based UI per role (Teacher/Student/Attendance-kiosk), theme
in `lib/core/theme/` (per `PLAN.md` file map). `google_fonts`, `shimmer`
(loading states), `fl_chart` (charts), `confetti` (celebrations). Same brand
navy/gold expected but not cross-checked hex-for-hex against the web app in
this pass — flag if a mismatch is found.

## UI DESIGN CONFIRMED gate (§F)
Required by AGENTS.md §E.4 ("checkbox-driven for an explicit 'UI confirmed'
gate"). Existing surfaces are marked confirmed because they're already live
in production, not because a formal review just happened — that review
already happened implicitly, commit by commit, over the life of the project.
New surfaces get their own row here when they're proposed, and stay
unchecked until the user says "UI is final" / "confirm UI" for that surface
specifically.

- [x] Admin panel — Dashboard, Student, Fees, GR Book, Attendance, Syllabus,
      Employee, Inventory, Expenses, Notice, Queries, Report, Documents,
      Question Papers, Tasks, Settings (12 tabs), Super-admin — live in
      production, implicitly confirmed.
- [x] Admin panel — SEF module set (Dashboard/Student/Fees/Settings) — live,
      implicitly confirmed (commits `093a9d1`, `1e45848`).
- [x] Mobile — Teacher app, Student app, Attendance-kiosk app — live,
      implicitly confirmed.
- [ ] *(next new UI surface goes here, unchecked until explicitly confirmed)*
