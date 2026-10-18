# ASSESS-UX04 — EduSentrix Assess Premium Experience: Complete Administrator UI Overhaul

**Repository:** `edusentrix-web-nextjs`  
**Mode:** Implement, test, document. Local-only; stop at security/domain boundaries.  
**Visual authority:** Six user-approved concept wireframes in `design_references/01-overview.png` through `06-mark-and-approve.png`.  
**Scope:** Full visual and interaction overhaul of the **administrator Assess and connected Core examination-authoring surfaces**, not an assessment-engine rewrite. Teacher Digital Marking Studio redesign is explicitly deferred.

## Mission

The current Assess experience feels like an internal technical configuration tool. Replace it with a beautiful, cohesive, approachable **EduSentrix Premium** experience that a school administrator can understand without training. Make the next action obvious on every screen. Follow the six approved wireframes as layout/information-hierarchy references; adapt their visual styling to **the actual EduSentrix design system and both light/dark themes**, not an independent purple-only UI kit.

**Implement, don't simply produce designs or another plan.** Make scoped application changes, verify them, and report exactly what is and is not working. Preserve existing domain behavior, permissions, school-scoped access, entitlement gates, immutable definition/delivery publication, paper QR/packet identity, student assignment integrity, private scanning evidence, moderation, and canonical Gradebook handoff. Do not change a working backend contract to fit a screenshot.

## Phase 0 — Mandatory inspection and baseline

1. Read the repo's current `AGENTS.md`, assessment architecture/decision register, UX03/UI01/UI02 reports, and applicable current implementation reports. Inspect actual route trees, components, CSS theme tokens, existing design primitives, Premium gating and the real API contracts before editing.
2. Inventory real admin pages and connected Core authoring pages. Start with `/admin/assessments`, `/admin/assessments/paper`, `/admin/examinations` and `/admin/examinations/[examPaperId]`; discover nested routes, dialogs, review pages, question bank, delivery/packet, evidence, marking assignment, moderation and handoff surfaces. Do not assume every feature has its own route.
3. Trace the source of the Assess 'No published examinations are ready' state. A completed Core paper produced `GET /api/admin/assess/definitions?sourceExamPaperId=<id>` -> `{success:true,data:[]}` during manual QA. Check whether the missing action is immutable definition publication via the existing endpoint or another prerequisite; identify any preflight errors (including section marks mismatch) before wiring a user journey.
4. Trace what Core **Complete** changes, who may approve or complete, and whether self-approval is intentionally allowed. Document the actual status transition and side effects. Do not rename, auto-publish, or change approval permissions on assumption.
5. Record test/build/TypeScript baseline without modifying unrelated files. Previous work reports many unrelated TypeScript diagnostics and an unresolved sanitized build; keep these gates honest.

## Design-system rules — nonnegotiable

- **Light and dark themes:** Reuse current EduSentrix theme state, existing semantic design tokens, WorkspaceScope/PageShell/PageHeader primitives (if current in checkout), background/surface/border/text/hover/focus/disabled conventions. Light remains a fully polished first-class experience; dark must be equally readable. Respect the selected theme across navigation, overlays, charts, tables, rich-text editors, PDFs-as-previews, loading/empty states. Do not force an isolated Assess theme, hardcode white backgrounds or dark navy canvases, or use a giant purple wash everywhere.
- **Brand appearance:** Take the approved wireframes' clean spacing and hierarchy. Use the platform's own teal/cyan productive-action accents and its established violet premium accents judiciously; emerald for success, amber for attention, rose for errors. Premium badge may indicate this is a paid feature, but do not repeatedly plaster badges on every card. Modest radius, crisp typography, high contrast, responsive composition, subtle depth—no oversized decorative hero cards that push the actual task below the fold.
- **Existing shared components FIRST:** Use `PremiumSelect` for selects and `PremiumDropdownMenu` for action menus (and inspect any underlying `premium-dropdown` wrappers). Use `CustomDatePicker` for calendar/date fields. Use `ResponsiveModal` or approved module modal pattern, `useConfirmationDialog` or the standard confirmation system, existing Button/Input/Toast/Skeleton/Badge components, and lucide icons. NO native `<select>` for these workflows, NO browser-native date input, NO one-off dropdown library, NO `window.alert/confirm/prompt`. Adapt existing controls centrally if their modal portal, z-index, max-height, scroll, keyboard, focus-trap, or mobile positioning behavior is defective. Preserve accessible option filtering, controlled state and dependent selectors.
- Use accessible labels, clear helpers, semantic headings, `aria-current` for current navigation, keyboard focus, minimum useful touch targets and a reduced-motion-friendly interface. Responsive desktop/tablet/mobile—not a scaled-down desktop screenshot.
- Do not build a fake marketing dashboard; each primary button must trigger a REAL existing action or be absent/disabled with a truthful reason. No placeholder 'Watch tour', AI marking, student result release, invented analytics, fake counts, dates or sample records in live surfaces.

## Shared information architecture and interaction model

Make a calm administrator workspace with a consistent top header, one clear primary action, task-oriented navigation and an optional **compact** examination journey. Suggested destinations grounded in existing contracts:

1. **Overview** — what needs attention; first-time vs returning-school state.
2. **Examinations** — create, edit, submit, review, approve; connected Core authoring UI.
3. **Prepare paper** — choose an eligible approved source; safely publish an immutable Assess definition, configure/review/publish a delivery.
4. **Print & assign** — issue/reprint/void secure paper packets, then match **each issued packet to an eligible student**. Preselected class groups are only eligibility context, not candidate identity assignment.
5. **Review scans** — page/evidence reconciliation; private previews and accurate missing/unknown/duplicate status.
6. **Mark & approve** — assign authorized markers/reviewers, view moderated outcomes and send approved marks to the canonical Gradebook when eligible.

The wireframes sometimes group or omit stages for compactness. A horizontal navigation selection is **not** persisted exam progress. Derive actual availability/completion only from authenticated server state; never mark Step 5 complete just because the user clicked its tab. Allow jumping to accessible destinations and show specific blocked prerequisites. Preserve validated delivery query context (`delivery`, `focus`/hash where supported) and school scope. One source of truth for labels/navigation/status chips; handle browser Back, reload and direct links.

Use plain English: "Create an examination", "Review and approve", "Prepare for printing", "Print exam papers", "Assign copies to students", "Review scanned scripts", "Review marking", "Send approved marks to Gradebook". Avoid "immutable definition", "Tier 0", "result binding" and "reconciliation" in ordinary introductory copy; present complex internals only in genuinely necessary advanced disclosure/help.

## Page-by-page acceptance criteria

### A. Assess Overview — reference `01-overview.png`
- Premium branded header, concise description, optional collapsible explanation of how it works.
- First use: one prominent "Create examination" action and 3–4 brief understandable journey steps; no row of useless zero-stat cards or massive empty hero.
- Returning school: actual attention items, true counts, recent examinations/deliveries, and a smart but deterministic "Continue" action linked to eligible real records. No duplication of the primary action in three places.
- Real subscription/active school denial continues to be enforced by server; provide actionable, correct messaging and legitimate Core fallback, never feature bypass.

### B. Core Examination List and New/Edit Paper — reference `02-examinations.png`
- Connect the existing Core examination list/editor to the same visual language without moving its academic ownership into Assess. Show meaningful search/status filters, clear list and empty states, question-bank navigation without redundant buttons.
- A guided, compact creation form: title, academic period, exam type, grade, subject, class group(s), intended marks, duration, student instructions. Explain grade-wide versus single-class selection; reuse eligible configured subjects and display a genuine "Set up subjects" path when none are configured.
- **All selects** use `PremiumSelect`; **all date inputs** use `CustomDatePicker`; all action menus use `PremiumDropdownMenu`. Keep dependent options and validation intact. Field labels normal case rather than intimidating all caps.
- Teacher-authored and admin-authored Core exams remain supported, but admin approval is the normal journey. Do not weaken or invent self-approval policies.

### C. Paper/Question Builder and Preparation — reference `03-prepare-paper.png`
- **Do not create a competing second question-authoring system in Assess.** Use the existing Core authoring builder for sections/questions, and use Assess preparation for immutable publication and delivery configuration. The wireframe's Paper Builder pane is a visual inspiration only, not permission to duplicate mutable authoring inside Assess.
- In Core builder, make saved sections/questions immediately understandable and easy to edit; compact inline structure and running question/mark summaries; contextual "Add section", "Add question" and review/readiness actions. Keep rich-text and math/science editing tools, but collapse the large symbol palette and offer a focused, wider question editing surface. Answer keys and rubrics visible only to authorized editors/reviewers, never in student-facing print.
- Known QA finding: Section A showed **0 marks** even after two persisted 1-mark questions; total paper showed **2 marks**. Diagnose whether a manually stored section value, aggregation, or projection causes this. Do not paper over authoritative inconsistencies with fabricated frontend totals. If fix is solely a presentation selector, make it with regression tests. If correcting domain data/writes/validation is required, STOP that part, document minimal service-level correction and exact tests; do not silently alter the assessment engine under a UI-only brief. Publication must fail closed on invalid totals and clearly explain why.
- The Core source paper was manually completed but not published as Assess definition (`data: []`). Provide a discoverable, secured, step-by-step **Prepare in Assess** bridge using **existing** server-validated publication and delivery APIs: choose result mode (`none` vs `score_bearing`) with human explanation, require exact canonical plan/item binding only when score-bearing, preview readiness errors, explicit confirmation before freezing content, preserve original review attribution/idempotency. Do not automatically publish on Core Complete or bypass mark validation.
- Provide coherent stage transitions between Core approval, immutable Assess definition, delivery draft/review and delivery publication. Never conflate Core approval with Assess immutable publication.

### D. Print & Assign — reference `04-print-and-assign.png`
- Start with actual selected published delivery. Show a concise paper summary and candidate-safe preview. Offer existing issue, download, reprint, void flows with correct batch limits, audit and idempotency.
- **Critical correction to image:** class selection is already determined at exam creation; class counts can guide how many blank packets to issue, but packet-to-student association is **individual**, not merely assigning a batch to a class. Keep opaque packet/page QR and fallback IDs; never encode student name or ID into QR. School admin correction/second-person review controls stay protected.
- Print history must be sourced from real packet history, not invented dates or statuses. Avoid claiming an actual physical printing event from a PDF download unless recorded.
- Preserve student-safe print and all paper metadata/identity integrity.

### E. Review Scans — reference `05-review-scans.png`
- Task-specific heading even if no delivery selected. Explain that scanning happens in **EduSentrix Konect**, then show real existing evidence/reconciliation once available.
- Distinguish received pages, verified pages, missing pages, unknown/duplicate/wrong-delivery pages, and complete scripts. A page receipt is not a full script or confirmed student identity.
- Private page preview with existing signed/authorized server endpoints, pagination/zoom where currently supported; missing-page records must never be represented as captured images. Keep confidential previews and correction workflows fail closed.
- **Critical correction to image:** do not show named candidates in blind/scoped marking contexts or claim identity verified before packet assignment/reconciliation is actually confirmed. Do not expose unapproved 'Confirm' or 'Request recapture' operations if no corresponding secure contract exists.

### F. Mark & Approve / Gradebook Handoff — reference `06-mark-and-approve.png`
- Admin-specific view for genuine marking assignment, progress, submission, independent reviewer assignment, moderation, approved outcomes and explicit handoff. Preserve teacher queue and Digital Marking Studio functionality; redesign of that teacher screen is deferred.
- Use meaningful filters: assigned, in progress, submitted, returned, approved, awaiting handoff. Data must reflect persisted reality and role/school scope.
- Display answer/evidence/marking information only to the correct authorized role. No casual display of blind candidate identities.
- Two-person moderation permissions, append-only marking revisions, stale-evidence checks, approval freshness, transactional handoff and idempotent receipt **must remain unchanged**.
- **Critical correction to image:** "Send marks to Gradebook" means the existing canonical Core `AssessmentScore` handoff, **not** immediate release to students/parents or publication of report cards. Do not add student release, AI marking or cohort analytics that do not exist. Keep the explicit second confirmation before handoff.

## Examination PDF presentation requirement (visual rendering only)

Manual QA found literal `<p>` tags printed in the Core student question PDF and a plain, poor exam-paper layout. Within the UI/presentation scope, inspect the **existing Core question-paper PDF renderer and Assess packet-PDF renderer separately**, then improve safe rendering without changing domain scores, QR identity, audit, paper issuance or storage contracts.

A formal printer-safe A4 paper must show actual school name/logo (fallback text if no usable private branding asset), academic year/term, exam type, title/subject, grade/class scope, duration, total marks, candidate instructions, clear sections, readable multiple choice options and page numbering. Add blank **Student's name: ________** and **Class: ________** lines; these handwritten lines do not become authenticated candidate identity and must not alter opaque QR contents. Handle rich text safely (paragraphs/lists/math where supported) with **no literal HTML tags**, never leak expected answers, marking rubrics or correct-option flags. Avoid large decorative colored regions or expensive ink. Page wrapping must not clip questions, options, symbols or QR. Validate both Core and packet PDF independently. If changes require an unsafe domain/integrity rewrite, stop that part and report it.

## 120-second confidential exam-workspace lock: security boundary

Previously approved product requirement: sensitive question/answer-key/marking-guide and private-evidence screens should hide content after approximately 120 seconds of inactivity and require **fresh account reauthentication**; also protect on background/tab switch, navigation, refresh and account/school switch. **This cannot be satisfied by a CSS overlay or local timer alone.** This brief is UI-overhaul-only: inventory sensitive routes and create a separate, precise security implementation plan (`ASSESS-SECURE-LOCK`) identifying Clerk-supported fresh reverification, server enforcement/TTL, secure draft preservation, cache-control, multi-tab handling and device/passwordless users. Do NOT claim the security feature is implemented or production-safe without that independently approved and tested backend security work; do not ship a deceptive visual-only lock. Keep current permissions and response protection intact.

## Execution sequence (one coordinated pass, small verifiable checkpoints)

1. **Foundation:** inventory, design-system audit, unified shell, theme behavior, navigation semantics and visual states. Create actual reusable Assess UI primitives only when not already present in shared code.
2. **Core entry:** Assess overview, examination list, create/edit modal, section/question authoring surfaces and role-correct approval guidance.
3. **Paper operations:** Core-to-Assess publication bridge, readiness UX, immutable definition/delivery preparation, print and individual assignment views.
4. **Evidence/outcome operations:** review-scans admin view; marking assignment/moderation/admin outcome and Gradebook handoff view.
5. **Visual rendering and quality:** paper PDF presentation, server-consistent marks investigations, theme/viewport/accessibility/browser testing. Stop at any needed backend/domain mutation as outlined above.

Proceed through all safe UI-only checkpoints without repeatedly asking for permission. If a step would change authorization, scoring, tenant semantics, immutable publication, identity correction, or security contracts, leave that behavior unchanged, document the blocker and continue safe adjacent UI work; do not secretly widen scope.

## Tests and acceptance — mandatory

- Unit/integration coverage for routing, current vs completed step distinction, subscription denied states, school scope, validated delivery selection, no-record/partial-record states, editor form state, subject option filtering and change invalidation, real API wiring, publication preflight messaging, disabled actions and error recovery.
- Component tests for `PremiumSelect`, `PremiumDropdownMenu` and `CustomDatePicker` in a modal with keyboard/scroll/portal/focus handling; manual keyboard checks.
- Regression tests for preservation of Core exam lifecycle, P01 immutable publication and delivery, P02 packet/evidence/assignment correction, P03 marking/moderation/Gradebook handoff, subscriptions, privacy and route authorization. Avoid weakening tests to get green.
- **Real browser screenshot review** for first-use/returning-school, busy/empty/error/blocked states, both EduSentrix light and dark themes, 1440px desktop, approx. 1024px tablet and approx. 390px mobile. Compare directly against reference images and attach before/after screenshots. If browser cannot run, mark visual acceptance NOT verified; do not invent screenshots.
- Reinspect printed Core and packet PDFs for raw tags, logo/metadata/blank name/class fields, answer-key absence, page breaks, QR readability and header/footer; test on synthetic records. Do not change a completed real examination in place.
- Run targeted typecheck/lint, `git diff --check`, relevant tests, and sanitized build using repository-supported controls without persistent DB or provider credentials. Report baseline failures honestly (do not report an interrupted build as pass). Do not delete another process's dev-server lock or kill a running dev server without explicit authorization.
- No networked persistent/demo/production data mutation; no provider changes, migration, new entitlement policy, deployment, commit or push unless explicitly authorized.

## Deliverables

- Implemented, consistent administrator Assess UI and connected Core authoring experience, with existing app functionality preserved.
- Theme/component-use inventory and changed-file list.
- Route-to-wireframe mapping, screenshots and usability walkthrough: first use → teacher-set exam / admin review (where currently supported) → Approve → Prepare in Assess → publish safe paper version → issue packets → individual assignment → review scans → moderation → Gradebook handoff.
- Explicit unresolved-risk table for domain section marks, PDF renderer limits, actual meaning of Core Complete, API/role coverage, build diagnostics, 120-second secure workspace lock, and any unimplemented feature depicted in a concept image.
- Tests and their exact results, including regressions; no implied production approval.
- Report: `docs/assess/implementation/ASSESS_UX04_PREMIUM_UI_OVERHAUL_REPORT.md`.

**Completion criteria:** A first-time administrator can understand what to do without reading backend terminology, sees accurate progress and statuses, and can complete every eligible *implemented* Assess action through an attractive, consistent EduSentrix-branded light/dark experience. Nothing becomes merely decorative or misleading. Protect the backend above all else.
