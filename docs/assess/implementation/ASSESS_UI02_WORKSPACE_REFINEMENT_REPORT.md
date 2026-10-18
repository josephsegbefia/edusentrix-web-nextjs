# EduSentrix Assess — ASSESS-UI02
## Examination Workspaces, Evidence Review and Digital Marking UX

Verification date: 2026-10-16
Repository: edusentrix-web-nextjs
Branch: feat/assess-rea-foundation
Predecessor: ASSESS-UI01
Scope: bounded functional UI refinement

## 1. Outcome

UI02 refines the existing Assess paper and teacher marking surfaces without changing assessment publication, paper delivery, evidence integrity, marking, moderation, handoff, or Core academic score semantics.

Administrators can carry a school-valid delivery context through the existing paper workspace. Evidence reconciliation now exposes the backend's derived missing-page records separately from captured page states, with bounded search and filters. Teachers have a practical two-panel marking workspace with private script-page preview, page navigation, question navigation, progress state, and the existing server-protected draft and submission operations.

This is local implementation and automated-contract evidence. It is not browser acceptance, deployment approval, provider verification, or pilot approval.

## 2. Design and information architecture

The applied direction remains light-first, professional, calm and task-oriented, using the existing WorkspaceScope, WorkspacePageShell, WorkspacePageHeader, GlassPanel and workspace tokens.

The primary administrator entry point remains:

    /admin/assessments

The existing functional paper workspace remains:

    /admin/assessments/paper

It now accepts validated URL state:

    /admin/assessments/paper?delivery=<school-valid-delivery-id>&focus=<task>#<task>

Supported task values are paper-delivery, packets, assignments, evidence, marking and approved-results. The client accepts a delivery from URL state only when it is present in the authenticated, school-scoped delivery response and is published or active. A missing or unavailable delivery is not substituted with another delivery.

The teacher entry point remains:

    /teacher/assess/marking

No new domain authority or duplicate mutation route was introduced.

## 3. Delivery context and navigation

Changed:

- src/components/admin/assess/AssessWorkspaceNav.tsx
- src/components/admin/assess/AssessmentDeliveryWorkspace.tsx
- src/app/api/admin/assess/overview/route.ts

The administrator navigation now preserves the selected delivery when linking to packet, candidate, evidence, marking and approved-result sections. The paper workspace also shows:

- examination/delivery title;
- published or active status;
- immutable delivery version;
- paper mode;
- duration;
- score-bearing versus non-reporting classification;
- a delivery selector scoped to the already loaded delivery response;
- task links that retain delivery and focus state.

Recent persisted delivery activity on the dashboard now links directly to its delivery context. Broad attention counts still link to a task without inventing a single delivery when the aggregate may cover multiple deliveries.

The source API remains the authority for school and role scope. URL state only controls orientation; it does not grant access.

## 4. Paper, packet and assignment orientation

The existing paper delivery and packet operations remain unchanged. The UI continues to use the existing routes for:

- candidate-safe PDF download and reprint;
- packet generation and idempotency;
- packet voiding and reason capture;
- eligible candidate search;
- packet-to-student assignment;
- correction request and independent correction review.

The workspace copy continues to explain that packet markers and QR/fallback identifiers are not proof of student identity. No packet, correction, issuance or assignment rule was changed.

The existing candidate assignment panel remains delivery-scoped. The new context links place the administrator at the correct delivery workspace, while the underlying assignment route continues to enforce school, membership, role, entitlement and identity-correction fencing.

## 5. Evidence workflow refinements

Changed:

- src/components/admin/assess/AssessmentEvidenceReconciliationPanel.tsx

The component consumes the existing school-admin evidence endpoint:

    GET /api/admin/assess/evidence?assessmentDeliveryVersionId=<id>

The panel now shows five distinct persisted/derived measures:

- Expected — pages expected from issued packet manifests.
- Received — pages in verified or pending-reconciliation states returned by the service.
- Accepted — pages currently reconciled as valid.
- Missing — expected pages with no accepted evidence.
- Warnings — captured pages whose reconciliation outcome is not valid.

Missing pages are rendered as their own records and explicitly state that a missing page is not treated as an unanswered question. Captured pages show the backend status, integrity status and exact reconciliation outcome using human-readable labels. The UI does not add a revoked or other unsupported capture classification because the list endpoint does not return capture-session state.

Bounded controls include:

- search over observed packet, page and returned state fields;
- all evidence;
- needs attention;
- verified;
- missing pages.

Private preview remains an authorized route through the existing signed-access path. Storage keys and unrestricted provider URLs are not exposed. No evidence upload, digest verification, legal-hold or deletion behavior changed.

## 6. Digital Marking Studio refinements

Changed:

- src/components/teacher/assess/DigitalMarkingStudio.tsx

The teacher surface now uses a practical two-panel layout on larger screens and a stacked layout on narrow screens.

Script panel:

- authorized private page preview through the existing teacher evidence-preview route;
- page number and page-count context;
- previous/next page controls;
- direct page buttons;
- fit/large readability controls;
- preview loading and failure state;
- reconciliation-blocked state remains visible.

Marking panel:

- direct question navigation;
- marked/unmarked question indication;
- published prompt and sub-question content;
- read-only marking guide and expected answer projection;
- maximum-mark label;
- score and feedback fields;
- marked-question progress summary;
- unsaved versus saved draft status;
- existing server-calculated total and unmarked-question semantics;
- existing double-action submission confirmation;
- read-only state after submission or approval.

The implementation retains the existing draft-version concurrency check, numeric score validation, submission idempotency, returned-evaluation handling, marker-only route access, blind-marking projections and Premium/Core separation. It does not calculate or approve scores in the browser.

## 7. Moderation and approved results

No moderation or handoff business rule was changed. The existing administrator panel remains the mutation surface for:

- eligible script assignment;
- independent reviewer assignment;
- submitted evaluation review;
- approve or return with a required rationale;
- approved outcome inspection;
- explicit, separately initiated Core handoff.

The panel continues to show approved-result handoff status and does not automatically transfer or publish report-card data. Full approval-history browsing and a dedicated result-context API remain future refinement opportunities because the current queue response exposes current queue and outcome projections rather than a complete history collection.

The Core handoff action now requires a second explicit confirmation click in the administrator UI. The existing server authorization, idempotency and canonical score protections remain the authority.

## 8. Dashboard metric semantics

The existing UI01 aggregate definitions remain unchanged:

- published examinations are immutable published definition versions;
- issued paper packets are issued packet records;
- candidate assignments are active packet assignments;
- evidence attention counts non-valid evidence-page outcomes;
- marking awaiting review counts submitted evaluations;
- approved awaiting handoff subtracts completed receipts from current approved outcomes.

This slice only improves the recent-delivery links by retaining the persisted delivery ID and paper-delivery focus. It does not label a page count as a script count, derive an unassigned-packet metric, or claim that every approved outcome is transferable without the existing eligibility checks.

## 9. Data sources and authorization

The UI reads real existing sources:

- delivery and published-definition routes;
- packet route;
- candidate-assignment route;
- evidence reconciliation route;
- administrator marking queue route;
- teacher marking queue and assignment routes;
- existing private evidence preview routes;
- existing approved-outcome handoff route;
- the school-scoped overview route.

The relevant server routes continue to require the active authenticated school context, school-admin or assigned-teacher authorization as appropriate, active membership and the dedicated Premium Assess capability. Frontend visibility is not treated as authorization. No entitlement packaging or plan mapping changed.

No live student data, provider storage, production configuration, migration, deployment or persistent school database was used.

## 10. Accessibility and responsive implementation

Source-level improvements include:

- semantic headings and task sections;
- labelled evidence search;
- grouped filter controls with pressed-state semantics;
- keyboard-visible focus rings;
- labelled page and question navigation;
- descriptive icon-button labels;
- error alerts and status/live regions;
- status text alongside color;
- touch-sized navigation controls;
- responsive stacking for the marking studio;
- bounded scrolling for page and question navigation instead of a single continuous marking form.

The rendered-finish gate was not completed. No browser, authenticated synthetic account, screenshot capture or active-theme contrast inspection was available in this run. These source-level checks must not be read as visual acceptance.

## 11. Changed files

Added:

- docs/assess/implementation/ASSESS_UI02_WORKSPACE_REFINEMENT_REPORT.md

Modified for UI02:

- src/app/api/admin/assess/overview/route.ts
- src/components/admin/assess/AssessWorkspaceNav.tsx
- src/components/admin/assess/AssessmentDeliveryWorkspace.tsx
- src/components/admin/assess/AssessmentEvidenceReconciliationPanel.tsx
- src/components/admin/assess/AssessmentMarkingAssignmentPanel.tsx
- src/components/teacher/assess/DigitalMarkingStudio.tsx
- tests/assessment-overview-route.test.ts

The working tree contains many unrelated pre-existing Assess, REA, Core and platform changes. They were preserved. No package, configuration, schema, entitlement-policy, score-engine or storage-provider file was changed by UI02.

## 12. Verification evidence

Focused overview route test:

    node --test --import tsx tests/assessment-overview-route.test.ts

Result: exit 0; 3 passed, 0 failed. This includes the new delivery-context link assertion.

Assessment regression suite:

    node --test --import tsx tests/assessment-*.test.ts

Result: exit 0; 189 passed, 0 failed. The suite used disposable MongoMemoryServer/MongoMemoryReplSet instances outside the sandbox because the sandbox refused their localhost listeners. No persistent, demo or production database was used.

Subscription regressions:

    npm run test:subscriptions

Result: exit 0; 155 passed, 0 failed.

Scoped ESLint:

    npx eslint src/components/admin/assess/AssessWorkspaceNav.tsx src/components/admin/assess/AssessmentDeliveryWorkspace.tsx src/components/admin/assess/AssessmentEvidenceReconciliationPanel.tsx src/components/admin/assess/AssessmentMarkingAssignmentPanel.tsx src/components/teacher/assess/DigitalMarkingStudio.tsx src/app/api/admin/assess/overview/route.ts tests/assessment-overview-route.test.ts

Result: exit 0.

Targeted TypeScript observation:

    npx tsc --noEmit --pretty false

Result: exit 2 because the repository-wide baseline contains existing/generated diagnostics. A filtered rerun produced no diagnostics for the UI02 components, overview route or overview test. This is not reported as a repository-wide TypeScript pass.

Whitespace verification:

    git diff --check

Result: exit 0.

Sanitized build verification:

    NEXT_TELEMETRY_DISABLED=1 APP_RUNTIME_MODE=development APP_URL=http://localhost:3000 NEXT_PUBLIC_APP_URL=http://localhost:3000 MONGODB_URI=mongodb://127.0.0.1:1/isolated-ui02-build-verification MONGO_DB_NAME=isolated-ui02-build-verification npm run build -- --experimental-build-mode compile --debug

Result: bounded attempt reached Next.js 16.0.10 Turbopack and Creating an optimized production build. It loaded .env.local but no MongoDB connection line appeared. It made no observable progress in the bounded window and was stopped with exit 130. The build is not a pass and remains an existing release blocker referred to ASSESS-REL01.

## 13. Browser verification status

Not completed. Browser automation, authenticated synthetic sessions, screenshots, keyboard traversal, active-theme contrast review, signed storage preview, deployed route verification and device testing were unavailable. No screenshots or visual observations were fabricated.

## 14. Remaining UX and integration limitations

1. Packet, assignment and administrator moderation lists still use their existing delivery-scoped response shapes; large-school pagination and server-side search should be designed against bounded APIs before further scale work.
2. The evidence endpoint retains its existing bounded 1,000-page response limit and does not expose capture-session status in the reconciliation projection.
3. Full approval-history browsing is not yet a dedicated administrator view.
4. Academic period, grade and class labels are not added to the context header because the existing delivery list projection does not provide those display names.
5. Private image preview still depends on a valid authorized runtime and configured storage provider; local source/tests do not prove provider availability.
6. Browser visual acceptance and full production-build completion remain outstanding.

## 15. Recommended next slice

UI03 or release hardening should first complete browser walkthroughs at mobile, tablet and desktop sizes using synthetic isolated data. After that, prioritize:

- delivery-scoped bounded pagination for packet, evidence, moderation and approved-result queues;
- a read-only delivery-context projection with academic period, grade, class and subject labels;
- dedicated approval/review history presentation;
- focus restoration and modal confirmation review for sensitive packet actions;
- screenshot-backed visual and keyboard acceptance;
- ASSESS-REL01 build-stall investigation.

UI02 stops here. It does not start ASSESS-P02, REA-00C1B-B, a new entitlement phase, or release approval.
