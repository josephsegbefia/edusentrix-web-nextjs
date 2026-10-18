# EduSentrix Assess — ASSESS-UI01
## Product UI Foundation, Dashboard and Navigation Report

**Verification date:** 2026-10-16
**Repository:** `edusentrix-web-nextjs`
**Branch:** `feat/assess-rea-foundation`
**Predecessor:** ASSESS-MVP-01
**Scope:** Assess workspace shell, administrator overview, navigation and teacher queue orientation

## 1. Outcome

ASSESS-UI01 adds a functional Assess workspace around the existing paper-assessment MVP. The new overview is powered by an authenticated, school-scoped read-only endpoint. Existing publication, delivery, packet, evidence, marking, moderation and Core handoff contracts remain the mutation authority.

The implementation is ready for independent UI/code review in the local environment. It is not visual-acceptance or deployment evidence: no authenticated browser session, screenshot, deployed route, provider, or device was available for this slice.

## 2. Design direction and product contract

| Decision | Applied contract |
|---|---|
| Purpose | Help a school administrator understand Assess work requiring attention and move directly to the existing operational workflow. |
| Audience | School administrators for the dashboard; assigned teachers for the marking queue. |
| Tone | Calm, light-first, professional and operational rather than promotional. |
| Visual direction | Existing `WorkspaceScope`, `WorkspacePageShell`, `WorkspacePageHeader`, `GlassPanel`, glass surface tokens and restrained violet/cyan/teal accents. |
| Memorable detail | A status-first attention rail that links each persisted issue to the exact operational section. |
| Responsive target | Narrow mobile navigation overflow, tablet wrapping and desktop multi-column metric/work panels. |
| Integrity constraint | No fabricated figures, duplicate mutation logic, changed score semantics or frontend-only authorization. |

The wider School OS theme was not changed. Assess-specific styling is contained in the Assess workspace and the existing workspace token system.

## 3. Implemented workspace and navigation

### Administrator workspace

`/admin/assessments` is now the Assess Overview dashboard. The existing delivery and paper operations remain available at:

`/admin/assessments/paper`

The shared `AssessWorkspaceNav` provides task-focused links to:

- Overview — `/admin/assessments`
- Examinations — existing Core authoring route `/admin/examinations`
- Paper exams — `/admin/assessments/paper#paper-delivery`
- Evidence & reconciliation — `/admin/assessments/paper#evidence`
- Marking & moderation — `/admin/assessments/paper#marking`
- Approved results — `/admin/assessments/paper#approved-results`

The existing administrator sidebar now exposes the same Assess destinations under Assessment & Exams. The main-content workspace classification includes nested `/admin/assessments/*` routes so the shell remains consistent.

### Teacher workspace

`/teacher/assess/marking` retains the existing Digital Marking Studio and now includes:

- shared teacher-safe Assess navigation;
- `All assigned`, `In progress`, `Submitted` and `Returned` queue filters;
- queue counts derived from the loaded assignment records;
- accessible pressed-state buttons and a truthful no-match state.

No administrator publication, candidate assignment, moderation or Core handoff action was added to the teacher navigation.

### Structural extraction boundary

The validated `AssessmentDeliveryWorkspace`, evidence reconciliation panel and marking/moderation panel were preserved. Only the minimum presentation changes were made to expose stable anchors for task navigation and correct the old copy that incorrectly said the workspace did not create candidate assignments.

## 4. Functional dashboard implementation

### Read-only endpoint

Added:

`GET /api/admin/assess/overview`

The endpoint requires:

1. an authenticated active-school context;
2. an authorized school-admin role;
3. the existing dedicated `assessment.premium_publication` entitlement;
4. the active school ID on every query.

Missing authentication, school selection, role authorization or Premium access returns a safe error without returning Assess records. The endpoint does not replace backend authorization on mutation routes.

### Metric definitions

| Dashboard metric | Source and semantics |
|---|---|
| Published examinations | Count of `AssessmentDefinitionVersion` records for the active school with `status: published`; these are immutable definitions, not mutable authoring papers. |
| Issued paper packets | Count of `AssessmentPaperPacket` records for the active school with `status: issued`. |
| Candidate assignments | Count of active `AssessmentPaperPacketAssignment` records for the active school. |
| Evidence attention | Count of non-deleted `AssessmentEvidencePage` records whose reconciliation outcome is not `valid`; this includes unresolved, missing and awaiting-upload states. |
| Marking awaiting review | Count of `AssessmentMarkingEvaluation` records with `status: submitted`. |
| Approved awaiting handoff | Current `AssessmentApprovedMarkingOutcome` records minus outcomes with a completed `AssessmentScoreHandoffReceipt`. |
| Recent examination activity | Six latest `AssessmentDeliveryVersion` records for the active school, sorted by `updatedAt`, exposing title, version, result-binding label and lifecycle status only. |

The dashboard intentionally does not show a packet-page total as a script count, does not calculate sensitive aggregates from broad client responses, and does not include an unassigned-packet metric until a dedicated bounded aggregate exists for that semantic.

### Needs-attention links

Attention items are only emitted when their persisted count is greater than zero:

- reviewed definitions awaiting publication → Core examinations;
- evidence with unresolved reconciliation → evidence anchor;
- submitted marking awaiting moderation → marking anchor;
- approved outcomes without completed handoff → approved-results anchor.

No placeholder activity, fake chart or invented count is rendered.

## 5. UI states and accessibility

Implemented states include:

| State | Behavior |
|---|---|
| Loading | Stable six-card skeleton grid with `aria-busy` and an accessible loading label. |
| Success | Live metrics, attention links, quick actions and recent persisted delivery activity. |
| Empty | Honest no-activity messages with links to Core examination authoring or paper operations. |
| Error | Specific visible error with a retry action. |
| Permission/entitlement | Locked panel explains that Premium Assess is unavailable without revealing protected school data; Core examinations remain linked. |
| Filter no-match | Teacher marking queue explains that the selected status has no records. |
| Partial data | Deliberately not represented as success; the overview endpoint returns a complete aggregate or an error so missing metrics are not mistaken for zero. |

Accessibility details include semantic navigation, `aria-current` on active workspace links, descriptive link titles, visible focus rings, native links/buttons, `aria-hidden` decorative icons, keyboard-reachable queue filters, `aria-pressed` filter state, and touch-sized controls. Status is communicated with text and badges, not color alone.

The rendered-finish gate was not completed because browser rendering was unavailable. No screenshot or visual acceptance claim is made.

## 6. Changed files

Added:

- `src/app/api/admin/assess/overview/route.ts`
- `src/app/(app)/admin/assessments/paper/page.tsx`
- `src/components/admin/assess/AssessWorkspaceNav.tsx`
- `src/components/admin/assess/AssessmentOverviewDashboard.tsx`
- `tests/assessment-overview-route.test.ts`
- this report

Modified:

- `src/app/(app)/admin/assessments/layout.tsx` — applies the existing Assess page feature gate to nested routes;
- `src/app/(app)/admin/assessments/page.tsx` — mounts the overview dashboard;
- `src/components/admin/assess/AssessmentDeliveryWorkspace.tsx` — navigation, section anchors and truthful workflow copy;
- `src/components/admin/assess/AssessmentMarkingAssignmentPanel.tsx` — marking/approved-results anchors;
- `src/components/teacher/assess/DigitalMarkingStudio.tsx` — teacher navigation and queue filters;
- `src/components/nav/sidebars/school-admin-sidebar.tsx` — Assess task navigation;
- `src/components/nav/sidebars/admin-main-content.tsx` — nested Assess routes use workspace layout.

Unrelated working-tree changes were preserved. No package, subscription plan, assessment model, score writer, handoff, storage provider, production configuration, database or deployment file was changed.

## 7. Verification evidence

All database-backed verification used disposable local MongoDB instances. The overview route test used two synthetic schools and verified School A cannot receive School B's published-definition count.

| Check | Result |
|---|---|
| `node --test --import tsx tests/assessment-overview-route.test.ts tests/assessment-publication-route.test.ts tests/assessment-delivery-route.test.ts tests/assessment-paper-packet-route.test.ts tests/assessment-paper-assignment-route.test.ts tests/assessment-marking-route.test.ts tests/assessment-score-handoff-route.test.ts` | **exit 0; 22 passed, 0 failed** |
| Consolidated Assess/Core suite covering P01A–P03C and ASSESS-MVP-01 | **exit 0; 96 passed, 0 failed** |
| `npm run test:subscriptions` | **exit 0; 155 passed, 0 failed** |
| Scoped ESLint over changed UI, route, sidebar and test files | **exit 0** |
| `git diff --check` | **exit 0; no whitespace errors** |

The 96-test suite passed after the UI changes, confirming that the existing publication, delivery, packet, assignment, evidence, marking, moderation, Core score and handoff contracts were not regressed.

## 8. TypeScript and build status

Full Web TypeScript was attempted:

```text
npx tsc --noEmit --pretty false
```

Observed result:

- exit code 1 on the captured run;
- 736 diagnostic output lines;
- zero matches for the UI01 route, dashboard, navigation, workspace, teacher marking and overview-test paths;
- diagnostics remain in generated and unrelated repository areas.

This is not reported as a repository-wide TypeScript pass.

The sanitized build was attempted only after the existing build-isolation tests had passed:

```text
NEXT_TELEMETRY_DISABLED=1 APP_RUNTIME_MODE=development APP_URL=http://localhost:3000 NEXT_PUBLIC_APP_URL=http://localhost:3000 MONGODB_URI=mongodb://127.0.0.1:1/isolated-ui01-build-verification MONGO_DB_NAME=isolated-ui01-build-verification npm run build -- --experimental-build-mode compile --debug
```

Observed result:

- Next.js 16.0.10 Turbopack started;
- `.env.local` was reported as loaded, while command-level isolated database variables were supplied;
- output reached `Creating an optimized production build ...`;
- no MongoDB connection line appeared;
- no progress occurred during the bounded observation window;
- the process was interrupted and exited 130.

The existing database guard remains protected by the separate build-isolation tests. This UI slice did not weaken that guard or change build configuration. The build is not a pass.

## 9. Browser and rendered verification limitation

No browser automation, authenticated synthetic session, screenshot capture, responsive viewport inspection, keyboard walkthrough, Clerk session, deployed route, live storage provider or mobile device was available. The following are therefore static/source and automated-contract findings only:

- route/page/component wiring was inspected;
- navigation destinations are real existing routes or anchors into the existing paper workspace;
- backend authorization remains the authority;
- loading, empty, error, permission and filter-no-match code paths are present;
- visual acceptance, real font rendering, contrast under the active browser theme, mobile reflow, focus traversal and signed-in behavior remain unverified.

No screenshot was fabricated or included.

## 10. Remaining UX issues

1. The existing paper workspace is still a dense operational surface. UI01 adds orientation and anchors, but page-level progressive disclosure and more granular loading states belong in UI02.
2. Evidence, marking and approved results currently depend on selecting a delivery inside the paper workspace. A dedicated read-only delivery/result context route would improve deep linking after the backend provides a bounded aggregate.
3. The overview does not yet show unassigned packet count because a dedicated bounded aggregate is not currently available; omitting it is safer than deriving it from an unrestricted client list.
4. No visual acceptance has been granted until browser screenshots and keyboard/responsive review are performed.
5. The existing Premium packaging and entitlement policy remain unchanged and provisional under the prior product decisions.

## 11. Recommended UI02 scope

UI02 should remain refinement, not a new assessment-engine phase:

- browser-based signed-in review at narrow mobile, tablet and desktop viewports;
- page-level refinement of paper delivery, evidence, marking and approved-results surfaces;
- delivery-context routing so evidence/marking/results can be opened directly without selecting a delivery first;
- bounded search/filter controls for large packet, evidence and result queues;
- granular partial/loading refresh behavior after browser observation;
- focus restoration and confirmation-dialog review for destructive packet operations;
- screenshot-backed visual evidence and keyboard/contrast review;
- only then, any small UI copy or spacing corrections found by actual observation.

UI02 must not add CBT, OMR, AI marking, report-card release, standalone onboarding, new entitlement packaging or unapproved academic correction workflows.

## 12. Completion boundary

ASSESS-UI01 is complete within its bounded local implementation scope and stops here for independent ChatGPT review. The result is a clean, functional Assess workspace foundation with real school-scoped dashboard data and coherent navigation, but visual/browser acceptance and deployment readiness remain explicitly open.
