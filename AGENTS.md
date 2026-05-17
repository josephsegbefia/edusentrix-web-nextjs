# AGENTS.md

This file defines how coding agents should work in this repository. It exists to preserve EduSentrix product consistency, UI quality, and data integrity as the app grows.


## Existing Codebase / Legacy Reality

This project existed before this `AGENTS.md` file was introduced. Some existing files may still use older patterns, incomplete UI behavior, legacy subject references, raw date inputs, inconsistent response shapes, direct ObjectId construction, or older modal/dropdown patterns.

When editing an existing file:

- Do not assume an existing pattern is approved just because it exists in nearby code.
- Apply this `AGENTS.md` to the area being changed.
- Keep changes focused and avoid rewriting unrelated legacy code unless it is necessary for the task.
- If touching an old module, improve the changed surface toward the current standard.
- Preserve working behavior unless the user explicitly asks for redesign, refactor, migration, or cleanup.
- If a module conflicts with this file, follow this `AGENTS.md` and clearly report the conflict.
- Prefer incremental modernization over broad rewrites that may introduce regressions.

## Tech Stack Contract

Unless the user explicitly changes direction, preserve the current stack and project conventions:

- Next.js App Router.
- React 19.
- TypeScript.
- MongoDB with Mongoose.
- Clerk authentication.
- Tailwind CSS v4 / CSS-first theme conventions where already used.
- Existing shadcn/Radix-style primitives and internal UI primitives where available.
- TanStack React Query for client-side server state where applicable.
- Sonner/app toast conventions for user feedback.
- UploadThing/Cloudinary only where already integrated or explicitly requested.
- Server actions, API routes, hooks, and data-fetching utilities should follow the patterns already established in the relevant module.

Do not introduce a major dependency, state-management library, styling system, backend framework, database, auth provider, payment provider, or file-storage provider without explicit user approval.

## Repository Map

Use this as a starting point when navigating the codebase. Verify exact paths with `rg --files` because folders may evolve.

- `src/app`: Next.js App Router pages, layouts, route groups, and API routes.
- `src/app/api`: Next.js API routes.
- `src/app/(app)/admin`: school-admin-facing app surfaces where present.
- `src/app/(app)/teacher`: teacher-facing app surfaces where present.
- `src/app/(app)/parent`: parent-facing app surfaces where present.
- `src/app/(app)/student`: student-facing app surfaces where present.
- `src/app/(app)/platform`: platform admin/operator surfaces where present.
- `src/components`: shared and module-specific React components.
- `src/components/ui`: shared UI primitives and reusable UI building blocks.
- `src/components/admin/students`: current premium admin UI reference.
- `src/lib`: shared utilities, auth helpers, permission helpers, services, and server/client helpers.
- `src/models`: Mongoose models and database schemas.
- `src/hooks`: reusable React hooks where present.
- `src/types`: shared TypeScript types where present.
- `scripts`: seed, maintenance, migration, verification, and operational scripts.
- `tests` or colocated test files: automated tests where present.

If the actual repository structure differs, inspect first and follow the established structure of the module being changed.

## Agent Workflow

Before coding:

1. Read this file.
2. Inspect the existing module and nearby patterns.
3. Identify whether the change is school-scoped, platform-scoped, public, or cross-tenant.
4. Confirm the correct role, permission, and `schoolId` scoping rules.
5. Check whether the feature touches legacy subject relationships, subject offerings, timetables, finance, communications, subscriptions, or permissions.
6. Prefer small, focused changes that are easy to review.

While coding:

- Use existing UI primitives, hooks, models, services, and helpers before creating new abstractions.
- Keep behavior truthful. Do not add buttons, filters, tabs, or settings that are not wired to real behavior unless explicitly building a frontend-only prototype.
- Keep loading, empty, error, and success states in place.
- Avoid broad refactors unless the user explicitly asks for them.
- When modernizing a legacy area, improve only the touched surface unless a wider change is required for correctness.

After coding:

1. Run the most focused verification command that matches the change.
2. For edited TS/TSX files, prefer targeted lint first.
3. Run broader lint/build/test only when the change crosses route, API, model, or shared-boundary behavior.
4. Report changed files, checks run, and any checks skipped or blocked.
5. Mention known remaining legacy issues only if relevant to the task.

## Mock Data And Placeholder Rule

Mock data is allowed only when the user explicitly asks for frontend-only exploration, prototypes, visual design, or screens that are being prepared for future backend integration.

For production-facing admin, teacher, parent, student, bursar, platform, finance, communication, academic, subscription, and permission workflows:

- Do not show fake actions as if they work.
- Do not show fake unread counts, fake payment statuses, fake delivery states, fake review counts, fake AI results, or fake backend responses unless clearly marked as demo/mock.
- If backend support is missing, show an honest empty state, disabled state, or planned-state message.
- If a control is visible, it should either work, be explicitly disabled with a clear reason, or be part of an explicitly requested prototype.
- Seed data is acceptable in test/demo environments when clearly separated from production behavior.

## Product Context

EduSentrix is a school operating system with separate experiences for platform operators, school admins, bursars, teachers, parents, and students. The product is not a generic CRUD dashboard. It manages real school operations: admissions, students, grades, class groups, subject offerings, teachers, schemes of learning, lesson notes, timetables, fees, communications, examinations, subscriptions, and platform growth workflows.

When making changes, preserve these principles:

- School data must always be scoped by `schoolId` unless the feature is explicitly platform-wide.
- Platform admin features must use platform permissions and must not leak into school tenant behavior.
- Teacher, parent, student, bursar, and admin experiences are role-specific and should only expose actions that role can truthfully perform.
- Avoid placeholder features that pretend to work. If a control is not wired, either wire it properly or remove/hide it.
- Do not reintroduce removed concepts without checking current product direction.

## Current Product Decisions To Preserve

- The old legacy subject relationship system is being replaced by subject offerings.
- Subject offerings are the source of truth for primary, upper primary, and JHS academic subject setup.
- Preschool bands, including Creche, Nursery, KG1, and KG2, use learning areas on individual grade pages instead of the central subject offerings setup.
- Subject offerings should be grade-scoped first, then class-group applicable. Do not make schemes of learning depend on one class group when the scheme belongs to a whole grade and subject.
- Class schedules are class-group scoped. Never treat one grade timetable as shared by all class groups.
- Teacher schedules must come from the class schedule/timetable, not from separate ad hoc "assign schedule" actions on teacher-subject cards.
- Teacher-subject-class assignments may include contact hours. Timetable builders should warn when scheduled periods are above or below configured contact hours.
- Timetable conflict detection must happen on the fly and must include clear details and practical resolution suggestions.
- Lesson notes created by teachers should be submitted for admin review, not directly published by the teacher.
- Lesson note review needs a clear admin collection point, review status, and review tooling.
- Scheme of learning import is intended for NaCCA/GES style schools and should avoid confusing manual flows where upload/import is the better workflow.
- Communications center currently focuses on email and in-app/app-visible messages. Do not add WhatsApp or SMS UI unless the backend/provider story is intentionally restored.
- Settings pages must be truthful: a setting should control real behavior in web and companion app surfaces, or it should be removed/disabled with honest messaging.
- Platform Proposal Center is an internal Growth Center feature. Leo-generated proposal content must be editable draft content and must not invent pricing, dates, contracts, legal commitments, or customer claims.

## UI Standard

The premium glassy admin UI is currently best represented by `/admin/students` and its components under `src/components/admin/students`. New admin surfaces should feel consistent with that page unless a feature has a strong reason to use a different established module style.

### Visual Language

Use this general style for admin/workspace screens:

- Dark glass surfaces with restrained depth:
  - `border border-white/10`
  - `bg-white/5`
  - `bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black`
  - `shadow-2xl shadow-black/40`
  - `backdrop-blur-xl`
- Rounded containers should usually be `rounded-xl`, `rounded-2xl`, or `sm:rounded-2xl`. Avoid overly bubbly UI.
- Use subtle top shine lines and radial highlights sparingly:
  - `bg-linear-to-r from-transparent via-white/15 to-transparent`
  - small teal/cyan radial highlights are acceptable.
- Accent colors should be purposeful:
  - primary: teal/cyan for productive actions and active states
  - emerald for success/complete
  - amber for warnings/review/fallback
  - rose/red for destructive/error
  - violet only where the module already uses it meaningfully
- Avoid one-note palettes. Do not build whole screens dominated by one hue.
- Do not use decorative blobs/orbs as the main design idea. Any glow should support hierarchy, not clutter.

### Layout

- Build the actual working surface as the first screen, not a marketing landing page.
- Use strong page headers with icon, title, concise subtitle, and clear primary actions.
- Use cards for repeated items, modals, and contained tools. Do not nest cards inside cards.
- Prefer dense, scannable operational layouts over oversized decorative sections.
- For data-heavy screens, use:
  - tabs or filters for segmentation
  - search that does not blank the whole page into a global loading state
  - pagination that matches students/teachers patterns
  - empty states with a clear next action
  - inline loading indicators where possible
- Text must fit on mobile and desktop. Do not use viewport-width font scaling.

### Components

Use the established shared UI components:

- Dropdowns: `PremiumDropdownMenu` for action menus and `PremiumSelect` for selects.
- Dates: `CustomDatePicker` for date selection. Do not use raw browser date inputs in polished admin flows.
- Modals: `ResponsiveModal` or the established module modal pattern.
- Confirmation: use `useConfirmationDialog`/standard confirmation dialog for destructive actions. Do not use browser-native `window.confirm`, `alert`, or `prompt`.
- Icons: use `lucide-react` where a suitable icon exists.
- Toasts: use the app's toast conventions. Toast text should be short, visible, and specific.
- More-actions buttons must show pointer affordance and use premium dropdown styling.

### Forms

- Labels and helper text should make the next action obvious.
- Avoid clutter. Split complex flows into wizard steps where appropriate.
- Do not expose technical fields or lifecycle flags unless they are meaningful to the user.
- Use validation before submit and actionable error messages after submit.
- If the backend rejects an action, the UI should preserve user input where possible.

## Data And Domain Integrity

### MongoDB/Mongoose

- Validate ObjectIds before constructing `new Types.ObjectId(value)`.
- Never assume IDs from legacy fields are valid ObjectIds. Some subject names or legacy strings may exist.
- Query and write with `schoolId` for tenant-owned records.
- Be careful with existing data. Do not remove or rewrite school data unless explicitly requested.
- Avoid destructive scripts unless the user clearly asks for the data operation.
- When doing data cleanup, log the collection names, filters, and counts affected.
- Do not introduce duplicate unique index conflicts. If a model has case-insensitive unique indexes, use upsert/find-or-create logic carefully.

### API Routes

- Authenticate and authorize before reading or writing.
- Use existing role/permission helpers where available.
- Return consistent JSON:
  - success path: `{ success: true, data: ... }`
  - failure path: `{ success: false, error: "..." }`
- Keep errors specific enough for the UI to guide the user, but do not leak secrets or stack traces.
- Mutations should invalidate or refresh relevant frontend queries.
- Expensive or entitlement-bound operations should check subscription/entitlement rules where applicable.

### Realtime UI Expectations

- After assigning/removing teachers, subjects, homerooms, or schedules, update the visible UI immediately via state update or query invalidation.
- Do not require a full page refresh for routine updates.
- Debounced search should keep the current page shell visible and update results only.

## Module Rules

### Subject Offerings

- Central subject offerings should exclude preschool bands.
- Subject offerings should be grouped by grade band when the filter is "all".
- When filtered, show a clear heading such as "Now showing subject offerings for JHS".
- Grade detail pages should show no subjects if offerings have not been set up for that grade.
- Grade detail pages may offer grade-specific subject setup and custom subject addition.
- Custom subjects must be attachable without reviving the legacy subject system.

### Grades And Class Groups

- Grades contain class groups.
- Class group pages should show subject-teacher assignment from subject offerings and assignment records.
- Homeroom assignment must be reflected on both class and teacher detail pages.
- Teacher detail headers/cards should show homeroom information when assigned.

### Timetable / Class Scheduling

- Timetables are class-group scoped.
- Drag/drop schedule entries must require a valid `teacherId` when the scheduled subject has a teacher-specific slot.
- Conflict checks must detect teacher overlaps across different class groups in the same period/day.
- Conflict details should name the teacher, subject, class group, day, and period where possible.
- The class schedule is the source of truth for teacher schedules.

### Schemes Of Learning

- Use "scheme of learning" language unless quoting old documents.
- Schemes should tie to grade + subject offering, not a single class group, unless a specific exception is explicitly modeled.
- Upload/import should be clear and wizard-based.
- Leo may guide users, explain gaps, and suggest mapping, but generated/imported content should remain reviewable.

### Lesson Notes

- Teacher-created lesson notes should be submitted for review.
- Admin review should have a dedicated collection point and unread/review-count badge where applicable.
- Lesson notes should be based on the correct scheme of learning where available.
- Review tools should support comments/highlights and clear approve/request-change decisions.

### Examinations And Question Bank

- School admins and authorized teachers may set questions where permissions allow.
- Exam paper printouts should contain questions only; answer spaces are not required because answer booklets may be provided.
- Correct answers/marking guides should be captured for marking, not printed on student papers.
- Question editor should support WYSIWYG behavior, math/science symbols, multiple-choice options, correct answers, and spelling/grammar suggestions.
- Destructive actions such as deleting sections/questions must use the confirmation dialog.

### Finance / Fees

- Finance screens should feel like a serious finance center, not a simple list of cards.
- Use clear receivables, invoices, payments, balances, arrears, reconciliation, and audit language.
- Use `CustomDatePicker` in invoice/payment workflows.
- Installment breakdown counts must match the selected installment count exactly.

### Communications

- Email is the current external channel focus.
- In-app/app-visible messages should be treated as first-class because the companion app can surface them.
- If a message can target a single recipient, the UI should first ask for recipient type, then show a searchable picker with avatar/name/context.
- Admin email should support replies/inbox behavior only when backend ingestion exists or is clearly planned.
- Sidebar unread badges must come from real unread counts.

### Subscriptions / Entitlements

- Tiers, cadence, lifecycle/status, and pricing language must match the subscription spec.
- Do not show confusing internal lifecycle dropdowns to school operators.
- Use `CustomDatePicker` throughout subscription UI.
- Entitlement guards should protect expensive/write endpoints, not only front-end navigation.

### Platform Proposal Center

- Proposal pages belong to Platform Admin/Growth Center.
- Use official document language and layout for generated proposals.
- Section editor should show section completion state.
- Leo generation is section-scoped, editable, and draft-only.
- Proposal documents should avoid app-like cards; generated documents should look formal, printable, and official.

## Code Style

- Follow the existing Next.js App Router patterns.
- Prefer TypeScript types from local modules over broad `any`.
- Keep changes scoped. Do not refactor unrelated modules while fixing one issue.
- Prefer existing hooks, utilities, and UI primitives over new abstractions.
- Use `cn` from `@/lib/utils` for conditional classes.
- Keep comments sparse and useful.
- Use ASCII unless editing a file that already intentionally uses non-ASCII.

## File Editing Rules

- Use `rg`/`rg --files` for discovery.
- Use `apply_patch` for manual file edits.
- Do not use shell write tricks to create or edit source files.
- Do not revert user changes or unrelated generated work.
- Never use destructive git commands unless the user explicitly asks.

## Verification

Run focused checks after changes:

- Targeted lint for edited TS/TSX files:
  - `npx eslint path/to/file.tsx`
- Full lint when broad UI/API work changes many files:
  - `npm run lint`
- Full production build when route/API/model boundaries change:
  - `npm run build`
- Tests when touching tested logic:
  - `npm test`

Known build warnings may exist in the repo, such as dependency freshness notices or existing Mongoose duplicate index warnings. Do not ignore new warnings introduced by your changes.

## Database Safety

When the user asks for direct DB cleanup:

1. Identify the exact school/tenant first.
2. Preview counts before deleting/updating where practical.
3. Use narrow filters with `schoolId`.
4. Report affected collections and counts.
5. Do not run broad destructive operations without explicit user intent.

## UX Quality Bar

Before finishing a UI task, check:

- Is the next action obvious when the user lands on the page?
- Does the screen match the glassy premium admin standard?
- Are dropdowns, date pickers, modals, confirmations, and toasts using established components?
- Does the UI update without requiring a full refresh?
- Are empty, loading, error, and success states handled?
- Is the feature truthful, or does it display controls that do not work?
- Does it preserve school-specific scoping and role permissions?

