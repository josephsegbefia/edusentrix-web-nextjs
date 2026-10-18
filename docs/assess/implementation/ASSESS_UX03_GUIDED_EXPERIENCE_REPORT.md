# ASSESS-UX03 — Guided User Experience and Human-Friendly Assessment Workflows

**Date:** 2026-10-16
**Repository:** `edusentrix-web-nextjs`
**Scope:** Administrator and teacher Assess experiences
**Status:** Implemented locally; independent product and browser review required

## Outcome

ASSESS-UX03 introduces a task-oriented, light-first presentation for the existing Assess workflows. The implementation keeps the existing API routes, request payloads, entitlement checks, school scoping, immutable delivery contracts, evidence controls, marking approvals and Core Gradebook handoff unchanged.

The main journey is now expressed as:

1. Prepare paper
2. Print papers
3. Assign students
4. Review scans
5. Mark and review
6. Send marks

The UI does not bypass Premium access restrictions. It explains the server-confirmed reason when the selected school is not eligible and provides a truthful Core examination path while the restriction is resolved.

## Evidence reviewed

- `src/app/(app)/admin/assessments/page.tsx`
- `src/app/(app)/admin/assessments/paper/page.tsx`
- `src/app/(app)/teacher/assess/marking/page.tsx`
- `src/components/admin/assess/AssessmentOverviewDashboard.tsx`
- `src/components/admin/assess/AssessmentDeliveryWorkspace.tsx`
- `src/components/admin/assess/AssessmentEvidenceReconciliationPanel.tsx`
- `src/components/admin/assess/AssessmentMarkingAssignmentPanel.tsx`
- `src/components/admin/assess/AssessWorkspaceNav.tsx`
- `src/components/teacher/assess/DigitalMarkingStudio.tsx`
- `src/lib/subscriptions/assess-premium-policy.ts`
- `src/lib/subscriptions/resolve-school-entitlements.ts`
- `src/lib/subscriptions/assess-premium.ts`
- `docs/assess/implementation/ASSESS_UI01_DASHBOARD_FOUNDATION_REPORT.md`
- `docs/assess/implementation/ASSESS_UI02_WORKSPACE_REFINEMENT_REPORT.md`
- `docs/assess/implementation/ASSESS_REL01_BUILD_RUNTIME_VERIFICATION_REPORT.md`

No production, demo, persistent school database, storage provider or subscription provider was contacted during this slice.

## Problems corrected

### First-use journey

The overview now distinguishes an empty first-use state from a returning school with saved work. A first-time administrator sees one primary action—`Create examination`—and a three-step explanation that starts in the existing Core examination authoring workflow. Metric cards are not shown as empty operational promises.

Returning administrators see a derived `Continue where you left off` action based only on the overview response’s real attention, recent-examination and metric data. The dashboard does not invent activity, statuses or counts.

### Paper workflow

The paper workspace now presents one named journey with compact progress navigation. Later steps remain visibly unavailable until a school-scoped published or active delivery is selected. Direct links retain `delivery`, `focus` and hash context, but invalid or unavailable delivery IDs are rejected by the existing client selection guard rather than silently opening another school’s context.

The active screen uses human labels and one primary task at a time:

- `Prepare paper`: choose a Core examination, create the delivery draft, review it and publish it.
- `Print papers`: generate candidate-safe packets, download, reprint or void them.
- `Assign students`: match issued papers to eligible students and request corrections where needed.
- `Review scans`: use the existing evidence reconciliation panel.
- `Mark and review`: use the existing assignment, submission, moderation and approval controls.
- `Send marks`: show approved results and preserve the existing explicit Gradebook handoff confirmation.

The implementation does not alter packet generation, assignment correction, evidence, marking, approval or handoff endpoints.

### Access blocker diagnosis

The server policy was inspected before changing the copy. `src/lib/subscriptions/assess-premium-policy.ts` refuses Premium publication when the selected school is not active, when the approved plan/capability is unavailable, when enforcement is not enabled, or when the subscription access mode is restricted. `resolve-school-entitlements.ts` supplies the school status and subscription snapshot used by that policy.

The UX now maps those known server messages to specific explanations. For the exact `requires an active school` response, it says:

> This school is not active yet

It explains that school selection and school lifecycle status are separate, asks a platform administrator to activate the school, and provides `Continue with Core examinations` as the safe immediate path. It does not change the entitlement result or suggest a client-side workaround.

This slice did not query a live school record, so it does not claim that any particular school is currently inactive. It verifies the observed policy/message mapping only.

### Navigation and terminology

The Assess navigation is now compact and task-based. Administrator items are `Overview`, `Create examination`, `Prepare paper`, `Print and assign`, `Review scans`, and `Mark and approve`. Teacher navigation is `Assigned marking` and `My Core examinations`.

Copy now consistently distinguishes:

- ordinary Core examinations and their existing marks, grading and report-card role;
- Premium paper delivery and evidence workflows;
- submitted marking that is not yet an approved canonical result;
- approved marks that may be explicitly sent to the Core Gradebook.

The teacher marking surface now uses `My marking`, `Assigned scripts` and plain-language empty states without changing the underlying assignment or approval contract.

## Accessibility and responsive UX changes

- Existing semantic headings were retained and new workflow regions have labelled sections.
- Error and loading states use `role="alert"`, `aria-live`, `role="status"` or `aria-busy` where appropriate.
- Icon-only decoration is marked `aria-hidden`; navigation uses links with `aria-current` for the active task.
- Form fields retain connected labels, including screen-reader-only labels for search and correction controls.
- Focus-visible styles are present on the new navigation and task links.
- Layouts continue to use responsive grids, horizontal overflow for compact navigation and stacked controls at narrow widths.
- No new animation, video, or motion-dependent interaction was introduced.

These are static implementation checks. They are not a substitute for keyboard traversal, screen-reader, contrast, or real viewport verification.

## Changed files

Added:

- `src/lib/assess/assessment-ux-guidance.ts`
- `tests/assessment-ux03-guidance.test.ts`
- `docs/assess/implementation/ASSESS_UX03_GUIDED_EXPERIENCE_REPORT.md`

Changed:

- `src/components/admin/assess/AssessmentOverviewDashboard.tsx`
- `src/components/admin/assess/AssessWorkspaceNav.tsx`
- `src/components/admin/assess/AssessmentDeliveryWorkspace.tsx`
- `src/components/admin/assess/AssessmentMarkingAssignmentPanel.tsx`
- `src/components/teacher/assess/DigitalMarkingStudio.tsx`

Not changed by this slice:

- API routes, service contracts, Mongoose models, indexes and migrations;
- Premium entitlement policy or commercial plan mapping;
- evidence storage/provider behavior;
- candidate packet, assignment, marking, approval or Gradebook handoff domain logic;
- package dependencies and application configuration.

## Verification evidence

| Command | Result |
| --- | --- |
| `npx eslint src/lib/assess/assessment-ux-guidance.ts src/components/admin/assess/AssessmentOverviewDashboard.tsx src/components/admin/assess/AssessWorkspaceNav.tsx src/components/admin/assess/AssessmentDeliveryWorkspace.tsx src/components/admin/assess/AssessmentMarkingAssignmentPanel.tsx src/components/teacher/assess/DigitalMarkingStudio.tsx tests/assessment-ux03-guidance.test.ts` | Exit 0 |
| `node --test --import tsx tests/assessment-ux03-guidance.test.ts` | Exit 0; 4 passed |
| `node --test --import tsx tests/assessment-ux03-guidance.test.ts tests/assessment-overview-route.test.ts` | Exit 0; 7 passed |
| `node --test --import tsx tests/assessment-*.test.ts` | Exit 0 using disposable local MongoDB; 193 passed, 0 failed, 45 suites |
| `npm run test:subscriptions` | Exit 0; 155 passed |
| `npx tsc --noEmit --pretty false --incremental false` | Exit 2 because of the known repository-wide baseline diagnostics; the changed-file filter found no diagnostics for this slice |
| `git diff --check` | Exit 0 |

The first sandboxed attempt at the full Assess suite was blocked by `mongodb-memory-server` receiving `listen EPERM` on `0.0.0.0`. The successful rerun used only disposable local test databases. No persistent or production database was used.

The full production build was not rerun. REL01 already documented that sanitized build verification stalls and exits 130; the current task did not change that build/runtime condition. No build pass is claimed.

## Browser and visual verification limitation

An in-app browser was not available in this execution, so there are no screenshots, signed-in route checks, console/network observations, keyboard traversal results, or real 375/768/1440 viewport observations to claim. Browser acceptance is therefore **INCONCLUSIVE**.

Before pilot or release approval, please perform a user-assisted review of:

1. `/admin/assessments` for a first-use school and a school with existing activity;
2. `/admin/assessments/paper` through each workflow step at mobile, tablet and desktop widths;
3. the inactive-school response using a synthetic test school fixture;
4. teacher `/teacher/assess/marking` with no assignments and with an assigned script;
5. keyboard-only navigation, visible focus, screen-reader announcements and contrast.

Capture screenshots and note any layout, copy, focus or authorization discrepancy. This review must remain on synthetic/test data and must not use a persistent school or production database.

## Remaining issues and release boundary

- The actual activation state of any named school remains unverified in this slice.
- The existing school/platform activation workflow remains outside this UI task; the new copy directs users to the responsible administrator rather than inventing an activation action.
- Browser, signed-in, provider-backed storage and deployed-runtime behavior remain unverified.
- The repository-wide TypeScript baseline still contains unrelated diagnostics.
- REL01’s sanitized build stall remains open and is not represented as a UX fix.

The implementation is ready for independent UX, accessibility and product review of the local code and disposable test evidence. It is not a pilot or production-readiness approval until the browser review and the existing REL01 build/runtime blocker are separately resolved or explicitly accepted by the release owner.

## Recommended next action

Run the user-assisted screenshot and keyboard review above, then record only concrete discrepancies as a bounded UX follow-up. Do not begin another Assess feature slice until the review confirms that the guided Paper Exams journey is understandable and usable at the intended pilot viewport sizes.
