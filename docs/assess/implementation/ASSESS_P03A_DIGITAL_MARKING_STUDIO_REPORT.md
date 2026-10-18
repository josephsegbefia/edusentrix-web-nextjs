# EduSentrix Assess — ASSESS-P03A
## Digital Marking Studio — Functional Manual Marking Report

**Date:** 2026-10-16 (Africa/Accra)  
**Status:** Bounded local implementation complete; production approval remains pending  
**Branch:** `feat/assess-rea-foundation`  
**Repository:** `edusentrix-web-nextjs`

## 1. Outcome and boundary

P03A is implemented as an additive manual-marking vertical slice over the existing P02 paper-delivery and evidence foundations. It supports assignment, blind marker projections, private verified-page access, question-level draft scoring, server totals, submission, independent school-admin review, return reasons and append-only submitted evaluation history.

This slice does not implement or invoke:

- CBT, OMR, scanner/mobile capture, AI marking or double marking;
- candidate attempts or candidate-facing answer submission;
- `AssessmentScore`, `SubjectResult`, `ReportCardRun`, `StudentReportCard` or any other Core academic score write;
- canonical score handoff or report-card contribution;
- real student evidence, live R2/storage providers, production databases, deployment, commits or pushes.

The implementation is not production approval. Real Clerk sessions, deployed browser behavior, subscription-provider behavior, storage-provider behavior, operational index rollout and independent security sign-off remain outstanding.

## 2. Product decision authorization

`docs/assess/rea/reports/REA_R02A_PRODUCT_DECISION_REGISTER.md` now records only the newly authorized decision:

- **R02A-PD-009 — Approved, 2026-10-15.** The approval source is the product owner’s explicit authorization communicated through ChatGPT and relayed in the ASSESS-P03A authorized implementation instruction.

The register explicitly limits this to product authorization. It does not approve PD-007, Core score handoff, production use, entitlement packaging, independent security verification or deployment. No unrelated decision was marked approved.

## 3. Domain and persistence contract

Three additive Mongoose models form the marking ledger:

### `AssessmentMarkingAssignment`

Represents who may mark an eligible script. It stores school, immutable definition/delivery/packet/packet-assignment/student identity, marker user and teacher identity, assigning actor, blind-marking flag, lifecycle status and idempotency key.

Statuses are `active`, `reassigned` and `closed`. The named partial unique index on `(schoolId, packetAssignmentId, status)` permits only one active marker assignment for a script. Reassignment closes the prior active assignment lifecycle and creates a new active assignment with an audit record; identity fields cannot be mutated.

### `AssessmentMarkingEvaluation`

Stores the current editable evaluation for one marking assignment. It contains immutable identity references, question score entries, criteria digests, draft version, server-computed total, unmarked count and review lifecycle metadata.

Statuses are `assigned`, `in_progress`, `submitted`, `returned` and `approved`. One evaluation is enforced per marking assignment. Draft writes use optimistic `draftVersion` checking. The server reconstructs the published question catalog and rejects unknown questions, duplicate entries, scores outside maximum marks, excessive precision and malformed feedback. An omitted score remains unmarked; it is never silently converted to zero.

### `AssessmentMarkingRevision`

Is the append-only history of submitted and reviewed evaluations. Each revision stores the complete question-score snapshot, total, unmarked count, actor, reason, idempotency key and monotonically increasing revision number. Unique assignment/revision and assignment/idempotency indexes prevent duplicate history entries. Mongoose mutation and deletion hooks reject updates and deletes after creation.

The current evaluation status is the operational state; revisions are the immutable evidence of submission, return and approval. No revision is written for an ordinary draft save.

## 4. Eligibility and evidence contract

Assignment and marking operations reuse P02 authoritative records rather than reconstructing candidate identity:

1. the packet assignment must be active and school-scoped;
2. the delivery must be published and match the published definition content hash;
3. the packet must be issued and match the delivery content hash;
4. pending packet corrections must not exist;
5. every packet page must have an accepted, verified evidence page with matching assignment identity;
6. a confirmed evidence receipt must exist; and
7. the associated `StoredAsset` must be same-school, private, ready and not deleted.

If any condition is missing, marking assignment, draft, submission and evidence-preview operations fail closed. Attachment-bearing publication remains governed by the existing P01A/P01A1 restriction; P03A does not weaken it or contact a storage provider.

## 5. API and authorization surface

Admin routes:

- `GET /api/admin/assess/marking-assignments?assessmentDeliveryVersionId=...` — eligible verified scripts, active teachers, assignments and submitted review queue;
- `POST /api/admin/assess/marking-assignments` — assign a script with an idempotency key;
- `POST /api/admin/assess/marking-assignments/[assignmentId]/reassign` — bounded reassignment with a required reason;
- `GET /api/admin/assess/marking-evaluations/[evaluationId]` — authorized review projection;
- `POST /api/admin/assess/marking-evaluations/[evaluationId]/review` — approve or return with a required reason.

Teacher routes:

- `GET /api/teacher/assess/marking-assignments` — assignments owned by the active teacher;
- `GET /api/teacher/assess/marking-assignments/[assignmentId]` — marking detail and published criteria;
- `PUT /api/teacher/assess/marking-assignments/[assignmentId]/draft` — optimistic draft save;
- `POST /api/teacher/assess/marking-assignments/[assignmentId]/submit` — complete-evaluation submission with idempotency key;
- `GET /api/teacher/assess/marking-assignments/[assignmentId]/evidence/[evidencePageId]/preview` — short-lived private page preview restricted to the assigned marker.

Admin operations use `requireSchoolAdmin`; teacher operations use `requireTeacher`. All operations apply active membership, school scope, marker ownership or school-admin role checks. Every Premium route reuses the existing fail-closed `assessment.premium_publication` gate and the current provisional Enterprise-only mapping. No new entitlement key or plan grant was introduced.

## 6. Confidentiality and blind marking

- Blind marker projections return an opaque script reference and do not return the candidate projection.
- Admin projections remain authorized to see candidate identity for operational assignment and review.
- Marking criteria, expected answers and guides are returned only through authenticated marker/reviewer projections; they are not public or candidate projections.
- Evidence preview checks the exact marking assignment, page assignment, school scope, evidence receipt and private ready asset before issuing a short-lived URL.
- A marker cannot approve or return their own evaluation.
- No client-supplied school or candidate identity is used as the authorization source.

Blind marking is an API projection boundary. It cannot remove identifiers physically visible in a scanned page; the admin UI states this limitation.

## 7. User surfaces

### Teacher

`src/app/(app)/teacher/assess/marking/page.tsx` exposes the authenticated teacher page, with `DigitalMarkingStudio` providing:

- assigned-script queue;
- blind/opaque identity display;
- page preview links;
- question navigation;
- published prompt, maximum marks, expected answer and marking criteria;
- question score and feedback entry;
- draft save/resume with server totals;
- two-step submission confirmation; and
- read-only state after submission.

The teacher sidebar links to `/teacher/assess/marking`.

### Admin

`AssessmentMarkingAssignmentPanel` is integrated into the existing assessment delivery workspace. It provides verified-script selection, active-marker selection, blind-marking choice, assignment, assignment status, submitted-review queue, question-level review, private evidence links and approve/return actions with rationale.

## 8. Core compatibility

P03A writes only the three new marking collections plus Tier-0 audit events. The service and routes do not import or call the Core score/result/report-card services. The existing Core examination, mark-entry, grading and report-card behavior remains outside this Premium marking ledger and was covered by the focused academic regression tests below.

## 9. Changed files

P03A implementation files:

- `docs/assess/rea/reports/REA_R02A_PRODUCT_DECISION_REGISTER.md` — recorded only PD-009 product-owner approval;
- `src/models/AssessmentMarkingAssignment.ts`;
- `src/models/AssessmentMarkingEvaluation.ts`;
- `src/models/AssessmentMarkingRevision.ts`;
- `src/lib/assess/assessment-marking-service.ts`;
- `src/lib/audit/policy.ts` — marking assignment, draft, submission, return and approval audit actions;
- `src/app/api/admin/assess/marking-assignments/route.ts`;
- `src/app/api/admin/assess/marking-assignments/[assignmentId]/reassign/route.ts`;
- `src/app/api/admin/assess/marking-evaluations/[evaluationId]/route.ts`;
- `src/app/api/admin/assess/marking-evaluations/[evaluationId]/review/route.ts`;
- `src/app/api/teacher/assess/marking-assignments/route.ts`;
- `src/app/api/teacher/assess/marking-assignments/[assignmentId]/route.ts`;
- `src/app/api/teacher/assess/marking-assignments/[assignmentId]/draft/route.ts`;
- `src/app/api/teacher/assess/marking-assignments/[assignmentId]/submit/route.ts`;
- `src/app/api/teacher/assess/marking-assignments/[assignmentId]/evidence/[evidencePageId]/preview/route.ts`;
- `src/components/teacher/assess/DigitalMarkingStudio.tsx`;
- `src/app/(app)/teacher/assess/marking/page.tsx`;
- `src/components/admin/assess/AssessmentMarkingAssignmentPanel.tsx`;
- `src/components/admin/assess/AssessmentDeliveryWorkspace.tsx`;
- `src/components/nav/sidebars/teacher-sidebar.tsx`;
- `tests/assessment-marking.test.ts`; and
- `tests/assessment-marking-route.test.ts`.

The repository contained broader pre-existing dirty changes from earlier Assess and unrelated work. They were preserved and are not attributed to P03A.

## 10. Verification evidence

All database-backed P03A tests used disposable `MongoMemoryReplSet` instances. Storage access used a fake local R2 port. No persistent school database, real student evidence or live provider was contacted.

| Command | Result |
|---|---:|
| `npx tsx --test tests/assessment-marking.test.ts tests/assessment-marking-route.test.ts` | exit 0; 5 passed, 0 failed |
| `npx tsx --test tests/assessment-evidence.test.ts` | exit 0; 7 passed, 0 failed |
| `npx tsx --test tests/assessment-paper-assignment.test.ts tests/assessment-paper-assignment-route.test.ts` | exit 0; 8 passed, 0 failed |
| `npx tsx --test tests/assessment-engine.assessment-mutations.test.ts tests/assessment-engine.score-atomicity.integration.test.ts tests/assessment-engine.score-writer-closure.integration.test.ts` | exit 0; 26 passed, 0 failed |
| `npx tsx --test tests/subscription.plan-map.test.ts` | exit 0; 23 passed, 0 failed |
| Targeted `npx eslint` over P03A models, service, routes, components and tests | exit 0 |
| P03A-filtered `npx tsc --noEmit --pretty false` scan | no P03A diagnostics |
| Repository-wide `npx tsc --noEmit --pretty false` | exit 2; 736 diagnostic lines, outside P03A scope |
| Sanitized `npm run build -- --experimental-build-mode compile --debug` with `mongodb://127.0.0.1:1/isolated-build-verification` | exit 0; compile completed and P03A routes appeared in the manifest |
| `git diff --check` | exit 0; no whitespace diagnostics |

The build was intentionally run in Next compile mode. It reported `Compiled successfully` and completed page-data collection, but Next states that a separate generate mode finalizes that build. This is local compile evidence only, not deployed-runtime verification. The output contained no MongoDB connection line and the URI was loopback-only.

A repository-wide TypeScript pass was not claimed. The full command exited 2 with 736 diagnostic lines, including existing generated Next validators and unrelated application, script and test diagnostics outside P03A. The P03A-targeted scan produced no matching diagnostics.

## 11. Remaining blockers and limitations

1. **Production entitlement mapping:** Enterprise-only Premium access remains provisional engineering policy pending explicit commercial packaging approval. Starter, Growth and Pilot were not granted access.
2. **Provider and deployment verification:** Clerk, subscription resolution, private storage URL behavior, browser rendering, real device behavior and deployed route verification were not performed.
3. **Evidence readiness:** P03A requires the existing verified private evidence contract. It does not add provider-backed digest computation or relax unsupported attachment/resource restrictions.
4. **Operational persistence:** The new model indexes were created only in disposable test databases. A separately reviewed production index rollout, duplicate scan, monitoring plan and rollback procedure are required.
5. **Score handoff:** Approved PD-009 does not approve Core score handoff. That requires a separate product/security decision and an explicit future bounded slice.
6. **Review scope:** Advanced moderation, multi-marker adjudication, analytics and AI assistance remain out of scope.

## 12. Recommended next slice

Do not automatically begin P03B. The recommended next decision is an independent review of this P03A ledger and its production-readiness blockers. If accepted, the next bounded slice should be separately authorized around either:

- production index/operational rollout preparation and signed-in/provider verification; or
- an explicitly approved post-review score-handoff contract, including academic-binding policy, audit semantics and Core regression requirements.

Neither path should bypass the separate PD-007 decision or convert P03A’s Premium marking ledger into a second academic result engine.
