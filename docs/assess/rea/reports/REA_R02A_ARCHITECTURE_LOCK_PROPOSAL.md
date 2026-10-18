# EduSentrix Assess — REA-R02A Architecture Lock Proposal

**Date:** 2026-10-15 (Africa/Accra)  
**Status:** Proposed architecture lock; not product-owner approval  
**Scope:** Architecture and implementation-readiness only  
**Evidence boundary:** Repository inspection and approved REA documentation; no database, provider, device, pilot or production evidence.

## 1. Purpose and authority

This proposal turns REA-00A/00B/00C1 and REA-R01A/R01B/R01C into a bounded architecture baseline. It does not create models, authorize migrations, approve commercial policy or claim that proposed Assess capabilities exist.

Source-of-truth order:

1. Explicit product/security approval.
2. Verified repository behavior and existing data-integrity invariants.
3. This proposed architecture and the R01C contract.
4. Repository engineering instructions and relevant ECC guidance.

Where a proposal conflicts with current behavior, current production behavior remains in force until an approved implementation and compatibility decision exists.

## 2. Locked invariants proposed for approval

- School OS Core retains ordinary examinations, exam marks, grading, subject results and report cards.
- Assess Premium adds advanced delivery, evidence, marking, moderation and analytics capabilities through separate entitlements.
- `AssessmentPlan -> AssessmentItem -> AssessmentScore -> SubjectResult -> ReportCardRun/StudentReportCard` remains the only canonical academic result path.
- No mode adapter writes report-card snapshots or creates a second score/result authority.
- Every tenant-owned read/write derives and verifies `schoolId` through active membership context.
- Published content, delivery policy, timing, identity, scoring and accessibility snapshots are immutable.
- Raw capture, recognition, marking, moderation, score proposal, canonical score and released report evidence remain distinct layers.
- A QR/marker is routing evidence only; candidate ownership and school authorization require server reconciliation.
- Locked scores reject stale writes; corrections append a new proposal/evidence version.
- Entitlement snapshots are historical evidence, not indefinite authorization.

These are proposed architecture invariants pending product-owner and security approval; they are not implemented by this document.

## 3. Current repository boundary

| Current component | Verified role | Lock implication |
|---|---|---|
| `ExamPaper`, `ExamPaperSection`, `ExamQuestion`, `QuestionBankItem` | Mutable school-scoped authoring/reuse records | They are inputs to publication, not historical delivery snapshots. |
| `ExamSession`, `ExamTimetableEntry`, `ExamInvigilatorAssignment` | Exam operation, scheduling and invigilation foundations | They do not represent candidate attempts or marking evidence. |
| `ScriptSubmission`, `StoredAsset` | Script upload and private asset foundations | Upload/provider readiness is not academic completion. |
| `AssessmentPlan`, `AssessmentItem` | Canonical period, contribution and item context | Score-bearing Assess deliveries must bind to these existing records. |
| `AssessmentScore` | Unique `(assessmentItemId, studentId)` canonical score | Future handoff identity complements this unique index. |
| `SubjectResult`, `ReportCardRun`, `StudentReportCard` | Canonical calculation, approval and release boundaries | Premium must hand off before these downstream stages. |
| Active-school context and membership | Tenant, role and school status authority | Client-provided school IDs are insufficient. |
| Subscription guards | Broad assessment keys and switch-controlled enforcement | Premium enforcement is not yet uniform and is not changed here. |

Direct evidence: `src/models/*.ts`, `src/lib/auth/active-school-context.ts`, `src/lib/subscriptions/*`, `src/lib/academics/assessment-engine/*`, `src/lib/konect/script-submission-service.ts`.

## 4. Proposed domain architecture

### 4.1 Immutable definition and delivery

`AssessmentDefinitionVersion` is an immutable content snapshot assembled from current authoring records. It stores ordered question/version references, maximum marks, scoring/accessibility/resource snapshots and a content hash. A review return is an event that moves the definition back to `review`; it is not a new durable `returned` status.

`AssessmentDeliveryVersion` is an immutable operational projection of one definition. It stores mode, timing, navigation, paper/form, identity, marking, entitlement evidence and result-binding snapshots. It uses one common envelope with discriminated CBT, paper, OMR or hybrid extensions.

`assessmentPlanId` and `assessmentItemId` are optional only when `resultBinding=none` and the delivery is explicitly non-reporting. Any score-bearing or report-contributing delivery requires an existing school-scoped plan and item before assignment/handoff. This is a compatibility rule, not a migration instruction.

### 4.2 Candidate, packet and attempt ownership

`CandidateAssignment` owns student, class, subject, period, delivery and accommodation snapshots. It is immutable with respect to student identity after evidence exists. `PaperPacketAssignment` owns packet/form/page custody and print evidence. `AssessmentAttempt` owns the logical candidate examination and references mode-specific evidence.

In a hybrid delivery, one assignment and delivery identity is shared, but each component owns its evidence: CBT response revisions, paper/OMR page and recognition evidence, or handwritten marking evaluations. Component adapters cannot overwrite one another.

### 4.3 Paper identity and OMR

The initial paper identity decision remains pending. Any proposed marker must identify delivery/form/packet/page routing claims only. Server-side assignment, school scope, version, non-reuse and candidate reconciliation are mandatory. Wrong, duplicate, replayed, forged or cross-school markers enter quarantine/exception review.

OMR evidence distinguishes a verified readable blank region, single mark, multiple mark, ambiguous, unreadable, wrong form, missing evidence and operator correction. `blank` does not infer candidate intention. Recognition is not marking and neither can finalize unresolved evidence.

### 4.4 Marking and moderation

Marker evaluations, annotations, rubric applications, second marks, discrepancy decisions and corrections are append-only logical evidence. A final evaluation is a separate authorized selection. Blind marking must remove identity from views, metadata, URLs, exports and search, while authorized moderation can reconcile identity.

### 4.5 Hybrid aggregation

For 40 CBT marks plus 60 paper marks, the immutable delivery declares component maximums and contribution policy. Each component must produce complete, version-compatible, ambiguity-resolved evidence before aggregation. If components map to separate academic items, each receives one handoff for the student. If they map to one combined item, one aggregate proposal capped at 100 is handed off. Missing or failed synchronization is not silently converted to zero.

## 5. Canonical score handoff

The future handoff boundary validates active membership, school/student/class/subject/period ownership, published versions, target item/max/contribution, evidence completeness, marking/moderation requirements, source operation identity, proposal version, idempotency scope, evidence hash, and current score lock/status.

The operation is at-least-once over the network. Logical exactly-once application effects require:

- durable operation identity scoped to school, delivery, item, student and source operation;
- a unique handoff receipt/index concept;
- conditional unlocked-score write;
- durable status for `proposed -> validating -> accepted -> canonical_score_written` or conflict/rejection;
- reconciliation lookup after lost acknowledgement;
- explicit correction version for authorized changes;
- downstream SubjectResult recalculation only after the canonical score effect.

No transaction design can promise exactly-once network delivery. MongoDB transaction use, retry behavior and receipt placement are specified in the 00C1B implementation document.

## 6. Core/Premium and standalone Assess

Core paper authoring and ordinary exam marks remain available through current Core behavior. Premium gates advanced publication, delivery, capture, marking, moderation and analytics operations. A standalone Assess customer still needs school/tenant membership plus academic period, class/grade and subject/subject-offering context. If results contribute to School OS, the same canonical plan/item/score/result/report path is mandatory. No separate standalone result engine is proposed.

## 7. Entitlement and security policy boundary

The proposed bounded continuity policy denies new Premium publication, assignments, attempts, scans, marking batches and moderation starts after expiry. A product-approved fixed continuity window may allow only already-authorized active work and previously captured scan reconciliation, with current authorization, audit and operation identity on every mutation. Finalized Core scores/results/reports remain preserved. Suspension fails closed except explicitly authorized support/security reconciliation.

Raw evidence retention/deletion, encrypted device queues, logout/device-loss handling, answer-key secrecy and anonymized marking remain policy decisions pending approval. No implementation or security control is claimed here.

## 8. Architecture-lock checklist

| Gate | Proposed evidence | Status |
|---|---|---|
| Contract vocabulary | R01C unified contract and state matrix reconciled | Ready for review |
| Core/Premium boundary | REA protocol, 00A/00B, current model map | Ready for review |
| Score integrity | 00C1 and 00C1B specification | Pending implementation approval |
| Compatibility | Current optional timetable item and required score-engine context documented | Ready for product decision |
| Security/data integrity | R01C policy proposals and security review | Pending approval |
| Synthetic fixtures | R01C field-validation plan | Ready for implementation planning |
| Bounded first slice | `REA_00C1B_IMPLEMENTATION_SPEC.md` | Prepared, not authorized |
| Device/provider/pilot validation | R02B+ boundary | Not performed; not an R02A blocker for planning, but blocks field/release claims |

## 9. Explicit limitations

No proposed Assess model, immutable snapshot, CBT runtime, OMR recognizer, marking ledger, handoff receipt or premium entitlement boundary is verified as implemented. Existing `studio-to-gradebook-service.ts` and subject-result concurrency gaps remain implementation dependencies.

**Recommendation:** approve this as an architecture-review baseline only. Do not treat it as implementation authorization until the product owner and security reviewer record decisions in the product decision register.
