# EduSentrix Assess — REA-R01C Unified Delivery Contract

**Date:** 2026-10-15 (Africa/Accra)  
**Status:** Proposed architecture specification; product-owner approval required  
**Repository:** `edusentrix-web-nextjs`  
**Branch:** `feat/assess-rea-foundation`

## 1. Purpose and evidence boundary

This document converts REA-R01A and REA-R01B research into an original EduSentrix architecture proposal for CBT, paper/OMR, and handwritten-script workflows. It is not an implementation plan and does not claim that the proposed contracts already exist.

Evidence sources are the repository at inspection time, REA-00A/00B/00C1, REA-R01A, and REA-R01B. Repository facts are labelled **current**. New contracts, states, and fields are labelled **proposed**. Competitor-derived ideas are treated as design evidence, not as proof of private competitor architecture.

## 2. Non-negotiable architecture

1. School OS Core retains ordinary examinations, classwork marks, exam marks, grading, subject results, report cards, approval, release, and historical reads.
2. Assess Premium adds advanced authoring, delivery, paper/OMR capture, digital marking, moderation, and advanced analytics behind separate entitlements.
3. All delivery modes hand finalized evidence into the existing canonical academic path:

```text
AssessmentPlan / grading policy
        -> AssessmentItem
        -> AssessmentScore
        -> SubjectResult
        -> ReportCardRun / StudentReportCard snapshot
        -> approval -> release
```

4. Premium adapters must not write directly to `ReportCardRun` or `StudentReportCard` snapshots.
5. Raw capture, recognition, marking, moderation, finalized-score proposals, canonical scores, and released results are different evidence layers.
6. A green local check cannot prove device, provider, signed-in browser, production, or school-pilot readiness.

## 3. Current repository architecture map

| Current area | Verified current contract | Reusable boundary | Do not overclaim |
|---|---|---|---|
| `ExamPaper` | School-scoped paper metadata: exam type, academic period, grade/class groups, subject/subject offering, duration, total marks, instructions, lifecycle status | Authoring aggregate and paper identity source | It is mutable authoring state, not an immutable digital/paper delivery version |
| `ExamPaperSection` | School-scoped section linked to paper with order and marks | Section ordering and authoring validation | It does not pin immutable question/content versions |
| `ExamQuestion` | School-scoped question with type, prompt, options, subquestions, marks, expected answer, marking guide, attachments, order | Question authoring and paper rendering source | It does not provide response persistence, recognition confidence, or marking events |
| `QuestionBankItem` | School-scoped reusable question content with curriculum references, difficulty, tags, usage references and status | Authoring/reuse source | Reuse is not the same as published immutable versioning |
| `ExamSession` | School-scoped academic-period exam operation with scope, dates, status, policy, assessment-plan/grading-policy references and visibility flags | Institutional session/scheduling context | It is not a candidate attempt or delivery snapshot |
| `ExamTimetableEntry` | School-scoped date/time/venue/class-group entry with optional `assessmentItemId`, max score, instructions and status | Exam operation and canonical item link candidate | It does not assign a specific student or pin question content |
| `ExamInvigilatorAssignment` | School/session/entry/teacher assignment with role and acknowledgement/replacement status | Invigilation assignment and operational audit | It does not authorize candidate evidence access by itself |
| `ScriptSubmission` | School, exam paper, student, submitter, idempotency key, pages, upload/finalization/cancellation state and audit events | Current Konect paper-script intake foundation | Current page model is upload-oriented; it does not yet represent QR verification, page quality, recognition, marking or moderation |
| `StoredAsset` | School-scoped private/provider asset with association, status, failure and deletion fields | Raw private capture storage | Provider state is not academic evidence finalization |
| `AssessmentPlan` | School/period/grading-policy scope, grade/class applicability, component rules, completion rules and lifecycle | Canonical contribution and grading policy | It does not describe a delivery mode or candidate attempt |
| `AssessmentItem` | School/period/plan/class/grade/subject/teacher item with source reference, max score, contribution and visibility/status | Canonical academic item receiving finalized handoff | It is not a paper packet or CBT item-rendering snapshot |
| `AssessmentScore` | School/period/item/plan/class/subject/student/teacher score with max-score snapshot, status, source submission reference and unique item/student identity | Canonical per-student score authority | A separate writer, `studio-to-gradebook-service.ts`, remains an unresolved atomicity surface from REA-00C1 |
| `SubjectResult` | School/period/class/grade/subject/student calculated result with source item IDs, status, lock and snapshots | Canonical subject result authority | It is downstream of score evidence, not a capture ledger |
| `ReportCardRun` / `StudentReportCard` | School/period/class run lifecycle and immutable-ish compiled student snapshots with approval/release state | School OS reporting and release boundary | Premium delivery must not bypass readiness, approval or release |
| `UserMembership` / active-school context | User-school membership, roles, status and active school resolution | Tenant and role authority | Client school IDs, legacy user fields and page visibility are not sufficient authorization |
| Subscription services | `FEATURE_KEYS`, plan entitlements, access modes, guards and role rules exist; broad assessment keys and switch-controlled enforcement remain current limitations | Future entitlement decision boundary | Current configuration does not prove uniform premium enforcement |

## 4. Proposed shared contract family

The names below are conceptual. They do not authorize creating models or migrations in this phase.

### 4.1 `AssessmentDefinitionVersion`

An immutable, reviewable version of academic content that can be delivered through more than one mode.

```text
AssessmentDefinitionVersion {
  id
  schoolId
  assessmentPlanId?               // required when bound to canonical results
  sourcePaperId?                 // ExamPaper at publication time
  sourceQuestionBankItemIds[]
  academicPeriodId
  gradeId
  classGroupIds[]
  subjectId
  subjectOfferingId?
  title
  sections[]                     // ordered question references
  questionVersionRefs[]
  maximumMarks
  scoringPolicySnapshot
  contentHash
  resourceManifest[]
  accessibilityPolicySnapshot
  resultBinding: none | canonical_item
  assessmentItemId?                // required when resultBinding is canonical_item
  status: draft | review | approved | published | superseded | archived
  createdBy / approvedBy / publishedBy
  createdAt / approvedAt / publishedAt
}
```

The published version must not resolve mutable `ExamQuestion` content at delivery time. Existing authoring records may be copied into this conceptual snapshot later, but that is a product/implementation decision requiring migration and compatibility review. `assessmentPlanId` is optional only for an explicitly non-reporting delivery. A score-bearing or report-contributing delivery must bind to an existing school-scoped `AssessmentPlan` and `AssessmentItem` before candidate assignment or canonical handoff; it may not create a second results authority.

### 4.2 `AssessmentDeliveryVersion`

An immutable operational projection of an approved definition for a delivery mode.

```text
AssessmentDeliveryVersion {
  id
  schoolId
  assessmentDefinitionVersionId
  examSessionId?
  assessmentItemId?              // canonical handoff target, not a score
  mode: cbt | paper | omr | hybrid
  deliveryPolicySnapshot
  timingPolicySnapshot
  navigationPolicySnapshot?      // CBT
  paperTemplateSnapshot?          // paper/OMR
  identityPolicySnapshot
  markingPolicySnapshot
  entitlementEvidenceSnapshot
  contentHash
  status: draft | review | published | active | emergency_paused | closed |
          superseded | archived
  publishedAt / publishedBy
}
```

A shared envelope with mode-specific extensions is preferred over one flat record containing unrelated CBT and paper fields:

```text
DeliveryPolicy = CommonPolicy & (
  { mode: "cbt"; cbt: CbtPolicy } |
  { mode: "paper"; paper: PaperPolicy } |
  { mode: "omr"; omr: OmrPolicy } |
  { mode: "hybrid"; cbt: CbtPolicy; paper: PaperPolicy; omr?: OmrPolicy }
)
```

This avoids nullable-field ambiguity while preserving one identity, publication, entitlement, and canonical-handoff boundary.

### 4.3 `CandidateAssignment`

```text
CandidateAssignment {
  id
  schoolId
  deliveryVersionId
  examSessionId?
  examTimetableEntryId?
  studentId
  classGroupId
  subjectId
  academicPeriodId
  status: assigned | eligible | active | completed | withdrawn | blocked | expired
  readinessState: pending | ready       // transient operation state; not assignment status
  identityVerificationStatus: unverified | verified | disputed
  accommodationSnapshot
  candidateDeadlineSnapshot
  paperPacketId?                  // paper/OMR
  cbtAttemptId?                  // CBT
  assignedAt / assignedBy
}
```

A candidate assignment is a durable snapshot. Later roster changes must not silently move or merge an active attempt or paper packet.

### 4.4 `PaperPacketAssignment`

Mode-specific extension of `CandidateAssignment`:

```text
PaperPacketAssignment {
  id
  schoolId
  candidateAssignmentId
  deliveryVersionId
  packetCode
  formVersion
  pagePlan[]                     // page identity, expected sequence, question regions
  machineMarkerManifest[]        // QR/anchor positions and encoded claims
  studentIdentifierPolicy
  printBatchId?
  printProofHash?
  status: issued | printed | distributed | collected | capture_pending |
          reconciling | ready_for_marking | finalized | voided
}
```

### 4.5 `AssessmentAttempt`

Mode-specific extension for CBT or paper evidence review:

```text
AssessmentAttempt {
  id
  schoolId
  candidateAssignmentId
  deliveryVersionId
  mode: cbt | paper | omr
  lifecycleStatus: ready | in_progress | paused | recovery_pending |
                   submitted | timed_out | exception_review |
                   marking | finalized | voided
  operationState: normal | blocked  // transient gate; blocked is not a lifecycle transition
  timingSnapshot
  evidenceRefs[]
  finalizationStatus
  createdAt / startedAt / submittedAt / finalizedAt
}
```

For paper, the attempt is the logical candidate examination while `ScriptSubmission` remains a current intake asset unless and until an approved design chooses to extend or replace it. For CBT, the attempt owns server-confirmed responses, not merely browser-local state.

### 4.6 `FinalizedScoreProposal`

```text
FinalizedScoreProposal {
  id
  schoolId
  candidateAssignmentId
  deliveryVersionId
  assessmentItemId
  studentId
  subjectId
  academicPeriodId
  questionEvidenceRefs[]
  score
  maximumScore
  scoringMethod: objective | human | rubric | moderated | mixed
  markingEvaluationRefs[]
  moderationDecisionRef?
  sourceSubmissionId?             // existing ScriptSubmission when applicable
  idempotencyKey
  status: proposed | validating | accepted | canonical_score_written |
          conflicted | corrected | rejected
  sourceOperationId
  proposalVersion
  idempotencyScope
  sourceEvidenceHash
}
```

The proposal is not `AssessmentScore`. It is a validated handoff request that must be accepted conditionally by the canonical score service. `accepted` means the proposal passed validation but the canonical write is not yet confirmed; `canonical_score_written` means the conditional score write and its durable audit receipt succeeded. A lost acknowledgement must reconcile by `sourceOperationId`/idempotency scope rather than retrying as a new operation. Subject-result recalculation is a downstream effect after the canonical write, not a proposal status.

### 4.7 Authoritative lifecycle vocabulary

The following vocabulary is authoritative for the conceptual R01C contracts. A **durable status** is persisted on the entity. An **operation state** can temporarily block an action and is persisted only when needed for recovery. An **audit event** records what happened but is not itself an entity status.

| Contract | Durable status | Operation state / audit-only terms | Rule |
|---|---|---|---|
| `AssessmentDefinitionVersion` | `draft`, `review`, `approved`, `published`, `superseded`, `archived` | validation and correction events | Published content is immutable. |
| `AssessmentDeliveryVersion` | `draft`, `review`, `published`, `active`, `emergency_paused`, `closed`, `superseded`, `archived` | `blocked` operation gate; pause/resume events | `blocked` means an action was denied; `emergency_paused` is a durable operational stop. |
| `CandidateAssignment` | `assigned`, `eligible`, `active`, `completed`, `withdrawn`, `blocked`, `expired` | `ready` readiness state; identity-verification events | `ready` is not a second assignment lifecycle. |
| `PaperPacketAssignment` | `issued`, `printed`, `distributed`, `collected`, `capture_pending`, `reconciling`, `ready_for_marking`, `finalized`, `voided` | print/capture/reconciliation events | It owns packet custody, not academic score truth. |
| `AssessmentAttempt` | `ready`, `in_progress`, `paused`, `recovery_pending`, `submitted`, `timed_out`, `exception_review`, `marking`, `finalized`, `voided` | `interrupted` event; timeout and recovery events | An interruption moves the attempt to `recovery_pending` only when recovery work is required. |
| Script evidence reconciliation | `unreconciled`, `reconciling`, `reconciled`, `exception_review`, `finalized`, `voided` | upload retry, page-quality and identity events | Current `ScriptSubmission` values remain the production upload vocabulary. |
| Marking/moderation | `unassigned`, `assigned`, `in_progress`, `evaluation_saved`, `submitted_for_review`, `second_marking`, `discrepancy_review`, `moderation`, `final_evaluation` | correction and selection events | Evaluation evidence is append-only logical history. |
| `FinalizedScoreProposal` | `proposed`, `validating`, `accepted`, `canonical_score_written`, `conflicted`, `corrected`, `rejected` | retry, reconciliation and acknowledgement events | `accepted` never means the canonical score is already written. |

`returned` is not an `AssessmentDefinitionVersion` status. It is a review decision/event that returns a definition to `review` with required corrections. These proposed names do not rename existing repository enums. Existing production states remain authoritative until an approved compatibility decision maps them to the conceptual lifecycle.

## 5. Publication and immutability rules

### Proposed legal transitions

```text
Definition: draft -> review -> approved -> published -> superseded -> archived
Delivery:   draft -> review -> published -> active -> emergency_paused -> active
                                      |                         -> closed
                                      +-> closed -> superseded -> archived
Packet:     issued -> printed -> distributed -> collected -> reconciling -> ready_for_marking
Assignment: assigned -> eligible -> active -> completed
Attempt:    ready -> in_progress -> paused -> recovery_pending -> submitted -> marking -> finalized
```

Rules:

- No candidate access or packet issuance before a delivery version is published.
- Published definition, delivery, timing, identity, scoring, and accessibility snapshots are immutable.
- Corrections create a new version or append a correction event; they do not mutate evidence already used by an active candidate.
- A delivery cannot close while required assignments or evidence are unresolved unless an authorized exception is recorded.
- A score proposal must identify a published delivery and an active, school-scoped assessment item.
- `blocked` is an operation denial and audit outcome; it is not a delivery lifecycle state. `emergency_paused` is the durable delivery state used when already-issued work must stop pending an authorized decision.

## 6. Mode-specific contracts

### CBT

Required evidence fields:

- verified active-school identity and candidate eligibility;
- assignment and start authorization;
- server receipt sequence and client revision;
- question version reference and serialized response;
- last confirmed save timestamp and acknowledgement ID;
- timing snapshot and timing event ledger;
- submission idempotency key and submitted revision;
- pause/resume, late, timeout, operator intervention and recovery events.

Initial recommendation: **reconnectable browser CBT**, not fully offline CBT. It allows durable server confirmation, explicit reconnect behavior, and controlled complexity. Online-only is too fragile for variable school connectivity; fully offline requires a signed/encrypted package, local secure storage, conflict reconciliation, device-loss recovery, and stronger field validation than currently exists.

This recommendation is provisional and requires REA-R02 field validation.

### Paper and OMR

Required evidence fields:

- delivery/form version and print-batch/packet identity;
- expected page plan and question-region manifest;
- machine-marker decode result and verification status;
- candidate reconciliation status and evidence;
- original image asset reference, capture device/source and page quality result;
- page sequence, duplicate/missing/extra/wrong-version status;
- recognition result, confidence/status, answer-key version and correction events;
- marking/moderation evidence before finalization.

### Handwritten digital marking

Required evidence fields:

- script/page/question evidence references;
- marker assignment and anonymization policy;
- rubric version and applied rubric item;
- annotation coordinates and visibility;
- independent evaluation ID, score, comments, actor and timestamp;
- discrepancy/second-mark/moderation decision;
- selected final evaluation and correction chain.

### Hybrid examination semantics

One examination may contain multiple mode components, but they share one candidate assignment and one published delivery identity. Each component owns its own attempt/capture evidence: CBT owns server-confirmed response revisions; paper/OMR owns packet, page and recognition evidence; handwritten work owns marking evaluations. No component adapter writes another component's provisional mark.

For example, a 40-mark CBT component and a 60-mark paper component must declare their component maximums and contribution policy in the immutable delivery snapshot. Their validated evidence is aggregated only by the delivery finalization boundary, producing a 100-mark examination result. If they map to two academic items, each item receives one authorized handoff for that student; if they map to one combined item, exactly one aggregation proposal is handed off for that item. In both cases, each `(assessmentItemId, studentId)` has one logical canonical handoff, and duplicate component finalization is rejected or reconciled by operation identity.

Missing, incomplete, conflicted or unresolved component evidence prevents finalization unless an explicitly authorized academic exception changes the declared contribution policy. A component cannot silently contribute zero because capture or synchronization failed. Delivery-version or answer-key conflicts quarantine the component and prevent score aggregation until resolved.

## 7. Canonical score handoff

All modes must call one future handoff boundary that revalidates:

1. active school membership and role/capability;
2. `schoolId`, student, class group, subject and academic period ownership;
3. published delivery and assessment-definition version;
4. assessment-item identity, maximum score and contribution policy;
5. source evidence completeness and marking/moderation requirements;
6. unique `sourceOperationId`, proposal version, idempotency-key scope and prior handoff status;
7. current `AssessmentScore` lock/status using a conditional write;
8. subject-result recalculation eligibility without bypassing lifecycle.

The proposed operation identity is scoped to `(schoolId, assessmentItemId, studentId, deliveryVersionId, sourceOperationId)`. A proposal also records the source-evidence hash/reference, expected maximum score, proposal version and the unique `(assessmentItemId, studentId)` target. The service must atomically validate the unlocked target and create/update the score plus handoff receipt, or commit neither. Partial writes become a durable reconciliation state; they are never reported as success.

The network contract is at-least-once. Logical exactly-once application effects are achieved by a durable idempotency record, conditional unlocked-score write and reconciliation lookup after a lost acknowledgement. A concurrent retry with the same operation returns the existing receipt; a correction creates a new proposal version and explicit correction event. A different operation for an already finalized/locked target is rejected or routed to the authorized correction path. SubjectResult recalculation occurs after the canonical score effect and is itself retryable/audited; it must not be treated as evidence that the handoff was accepted.

The handoff must not update report-card snapshots. Report compilation remains responsible for snapshotting canonical results, and approval/release remains responsible for visibility.

### Known REA-00C1 dependencies

- The separate `studio-to-gradebook-service.ts` `AssessmentScore.bulkWrite` path must be reviewed and hardened before premium adapters claim all-ingress atomicity.
- Subject-result conditional source coverage exists, but dedicated real-database subject-result concurrency integration coverage remains outstanding.
- Existing score unique identity is `(assessmentItemId, studentId)`; future handoff idempotency must complement, not replace, that constraint.

## 8. Entitlement and expiration contract

An entitlement snapshot is historical evidence attached to a delivery/attempt; it is not permanent authorization.

At operation time, the service must separately evaluate:

```text
active membership -> school status -> product grant -> capability grant
-> role permission -> data scope -> lifecycle/access mode -> usage/state
```

Proposed bounded continuity policy, pending product-owner approval:

- School OS Core remains available according to its own grant when Assess is absent or expired.
- At expiry, deny new premium publication, assignments, attempts, scans, marking assignments and moderation starts. Existing active work receives only a product-owner-approved, bounded continuity window (proposed: a short fixed window recorded per school/delivery, never indefinite) for completion and reconciliation.
- During continuity, allow only operations already authorized before expiry and required to finish or reconcile them; deny unrelated new work, new candidates, new packets and new marking batches. Every continuation checks membership, role, school status, capability and lifecycle and records the expiry policy/version.
- Previously captured but unsynchronized scans may upload only within that bounded reconciliation window, with the original operation identity and evidence hash; after the window they become preserved read-only evidence requiring explicit support authorization.
- Existing marking/moderation may finish only for work already assigned before expiry and only within the bounded policy. Failed-upload reconciliation follows the same rule.
- Finalized `AssessmentScore`, `SubjectResult` and report-card data are preserved independently of Assess entitlement. Entitlement snapshots are historical evidence and never grant indefinite authorization.
- School suspension fails closed for new premium mutations and active continuation unless a separately authorized security/support exception permits a narrow read or reconciliation action. Core behavior follows its own approved suspension policy.

Current repository guards are switch-controlled and current feature keys are broad (`assessment.examinations`, `assessment.question_bank`). This proposal does not change them.

## 9. Security and evidence policy proposals

- Every entity and asset query carries or derives a verified active `schoolId`.
- Candidate identity is never trusted solely from a QR payload, typed/bubbled ID, browser body, or device-local record.
- QR/marker payloads are integrity and routing hints; they do not prove the paper is genuine, assigned to the candidate, unaltered, unused, or authorized for the current school.
- Reuse, replay, forgery, duplicate decode and cross-school marker collisions enter reconciliation/quarantine.
- Raw student images remain private and device-local queues must be encrypted/cleared only after confirmed server reconciliation under an approved policy.
- Answer keys, expected answers and marking guides are never sent to candidate delivery clients unless explicitly required and protected by delivery policy.
- Marker roles are scoped to assigned evidence; anonymous views must not leak names through covers, metadata, URLs, exports or search.
- Score handoff is conditional and idempotent; locked scores reject stale writes.
- Provider outages produce recoverable operational failures, not academic zeroes.
- Raw images and response evidence require a product-approved retention schedule, authorized deletion events and legal/operational hold exceptions. Deletion must not remove the audit reference needed to explain a finalized score.
- Device-local queues must be encrypted, bound to the active school/account context, cleared only after server acknowledgement and reconciliation, and made unusable or re-authenticated after logout, account switch or reported device loss. Failed reconciliation preserves a recoverable local state or gives an explicit loss/escalation outcome.
- Answer keys and marking guides remain outside candidate projections, local offline packages and unauthenticated asset URLs. QR replay/forgery is handled as routing evidence only; server assignment, school scope, version, non-reuse and packet reconciliation are required.
- Anonymized marking must remove identity from the view, metadata, filenames, URLs, exports and search results, while authorized moderators retain controlled access to the identity link.

## 10. Open decisions requiring approval

- Whether to introduce a versioned snapshot layer beside existing `ExamPaper` or extend existing paper lifecycle first.
- Whether a paper packet identity is QR-only, QR plus visible code, or another signed/verified marker.
- Which school roles may reconcile identities, override recognition, mark, moderate, finalize and release.
- Initial CBT mode and entitlement-expiry behavior for active attempts.
- QTI profile and whether import/export is required before premium delivery implementation.
- Retention, deletion, device-local encryption and cross-border provider policy for student images.

## 11. Confidence

| Area | Confidence | Reason |
|---|---|---|
| Existing canonical academic path | High | Direct repository models/services and REA-00A evidence |
| Existing paper authoring/session/scanner foundations | High | Direct repository inspection and prior reports |
| Shared immutable delivery proposal | Medium-high | Converges with R01A/R01B evidence and preserves current boundary; no implementation exists |
| Reconnectable browser CBT recommendation | Medium | Architecture judgement; requires field validation |
| QR security limits and reconciliation requirements | High | Security reasoning; marker alone cannot prove identity/authorization |
| Fully offline CBT feasibility | Low-medium | No device/provider/pilot evidence yet |
| QTI starting profile | Pending R01C decision register | Requires compatibility fixture and tooling review |

## 12. REA-R02 dependency summary

REA-R02 must not implement delivery features until the following are approved or explicitly deferred:

- versioning boundary and migration/compatibility strategy for existing authoring records;
- delivery-mode and initial CBT decision;
- paper identity and candidate reconciliation policy;
- evidence retention and device/provider security policy;
- QTI profile decision;
- canonical score-handoff contract and all score-writer inventory;
- entitlement lifecycle and active-attempt expiry policy;
- field validation results for representative school hardware and connectivity.
