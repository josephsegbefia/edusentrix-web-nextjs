# EduSentrix Assess — REA-R01C State Machines and Failure Matrix

**Date:** 2026-10-15 (Africa/Accra)  
**Status:** Proposed verification and lifecycle specification  
**Scope:** Unified CBT, paper/OMR, script marking, moderation and canonical-score handoff

## 1. How to read this document

The repository already has several state machines. Existing states are listed as **current** and must not be silently renamed. New delivery/evidence states are **proposed**. A proposed transition is not evidence that a service currently permits it.

## 2. Current lifecycle anchors

| Area | Current states observed | Architectural use |
|---|---|---|
| `ExamPaper` | `draft`, `submitted`, `approved`, `printed`, `completed`, `archived` family via constants/lifecycle | Authoring/review/print lifecycle |
| `ExamSession` | `draft`, `scheduled`, `conflict_review`, `published`, `in_progress`, `completed`, `locked`, `archived`, `cancelled` | School exam operation |
| `ExamTimetableEntry` | `draft`, `ready`, `published`, `in_progress`, `completed`, `cancelled`, `rescheduled` | Scheduled exam slot |
| `ScriptSubmission` | `draft`, `awaiting_uploads`, `upload_incomplete`, `received`, `cancelled`, `failed` | Konect script intake |
| `StoredAsset` | `pending`, `ready`, `deleted`, `failed` | Private storage lifecycle |
| `AssessmentPlan` | `draft`, `active`, `locked`, `archived` | Grading/contribution plan |
| `AssessmentItem` | `draft`, `open`, `completed`, `submitted`, `locked`, `archived` | Canonical academic item |
| `AssessmentScore` | `draft`, `recorded`, `missing`, `excused`, `submitted`, `locked` | Canonical student score |
| `SubjectResult` | `draft`, `ready`, `submitted`, `returned`, `approved`, `locked` | Canonical subject result |
| `ReportCardRun` | `draft`, `opened`, `collecting_marks`, `ready_to_compile`, `compiled`, `submitted_for_approval`, `returned`, `approved`, `released`, `archived` | Report-card lifecycle |

## 3. Proposed state machines

The authoritative vocabulary is defined in the unified contract. In this report, durable entity status, transient operation state and audit event are deliberately shown separately. Existing repository lifecycle values remain unchanged.

### 3.1 Definition and delivery

```text
DEFINITION
draft -> review -> approved -> published -> superseded -> archived
                 |            |
                 +-> review (returned decision; correction required)
                              +-> correction creates new version

DELIVERY
draft -> review -> published -> active -> emergency_paused -> active/closed
                                      \-> closed -> superseded -> archived
```

| Transition | Preconditions | Evidence written | Forbidden shortcut |
|---|---|---|---|
| draft -> review | Required content, marks, resources and policy parse | validation result, actor, content hash | Publishing mutable authoring records directly |
| review -> approved | Authorized reviewer confirms content | review decision, version, reviewer | AI/teacher draft self-approving where policy requires admin |
| approved -> published | Delivery compatibility and entitlement check | publication event, snapshot hashes | Publishing after source records changed without new version |
| published -> active | Scheduled window and candidate/paper readiness | activation event | Candidate access from draft |
| active -> emergency_paused | Authorized incident/security/operational stop | pause reason, actor, scope and time | Treating a denied operation as a pause |
| emergency_paused -> active/closed | Authorized resume or closure decision | decision and impact audit | Resuming without rechecking version, scope and entitlement |
| active -> closed | End policy or controlled closure | closure reason/time | Deleting active delivery |
| any published state -> superseded | New approved replacement | supersession link | Mutating active version in place |

### 3.2 Candidate assignment and CBT attempt

```text
ASSIGNMENT
assigned -> eligible -> active -> completed
                    \-> blocked -> eligible
                    \-> expired

`ready` is a transient readiness state, not a durable assignment status. `blocked` is an operation denial/status only when the product needs a durable reason; it never silently changes the student or delivery.

CBT ATTEMPT
ready -> in_progress -> paused -> in_progress
                    \-> submitted -> marking -> finalized
                    \-> timed_out -> submitted/exception_review
                    \-> recovery_pending -> in_progress/submitted/exception_review
```

| Transition | Required condition | Failure disposition |
|---|---|---|
| assigned -> eligible | Student, class, subject, period, school and delivery scope still match | `blocked` with non-disclosing reason |
| eligible -> ready | Candidate authenticated and start window/policy permits | No attempt created if authorization fails |
| ready -> in_progress | Server records start time and effective deadline | Retry is idempotent by assignment/attempt key |
| in_progress -> paused | Authorized operator/system event with reason | Preserve last server-confirmed response and timer ledger |
| paused -> in_progress | Assignment/attempt still valid and resume policy permits | Recovery review if deadline or entitlement changed |
| in_progress -> submitted | Server accepts final revision once | Duplicate request returns original submission result |
| in_progress -> timed_out | Server clock reaches effective deadline | Persist confirmed responses; distinguish timeout from missing save |
| in_progress --interrupted event--> recovery_pending | Refresh/device/network interruption requires recovery | Never claim unsaved local answers are durable |
| submitted -> marking | Delivery is closed for candidate and evidence is readable | Route missing/invalid evidence to exception review |
| marking -> finalized | Required marking/moderation conditions satisfied | Remain marking or moderation_required |

### 3.3 Paper packet and script

```text
PACKET
issued -> printed -> distributed -> collected -> capture_pending
        \-> voided

SCRIPT EVIDENCE RECONCILIATION
unreconciled -> reconciling -> reconciled -> finalized
                              |             |
                              |             +-> exception_review
                              +-> upload_retry
reconciled -> marking_ready -> marking -> moderation -> finalized
```

The current `ScriptSubmission` states remain the upload foundation. `unreconciled`, `reconciled`, `reconciling`, `marking_ready`, `marking` and `moderation` are proposed higher-level evidence states and should not be retrofitted into current status values without an approved compatibility decision. `uploaded` and `assembled` are operation milestones/events unless an approved model makes them durable. Reconciliation completion is a prerequisite for marking; it is not itself a marking or moderation status.

| Failure | Required state | Recovery |
|---|---|---|
| Missing page | `exception_review` | Request/rescan page or authorized incomplete-script disposition |
| Duplicate page | `exception_review` | Preserve both assets; select/void with reason |
| Extra page | `exception_review` | Associate to packet, quarantine, or reject; never silently discard |
| Out-of-order page | `reconciling` | Use verified page marker/sequence, then operator review if conflict |
| Wrong delivery/form | `exception_review` | Quarantine and reassign only after school-scoped verification |
| Unreadable image | `exception_review` | Rescan/re-upload; retain original failure evidence |
| Candidate mismatch | `exception_review` | Require authorized reconciliation and audit |
| Provider upload failure | `upload_retry` | Keep local/raw evidence; retry idempotently; surface provider state |

### 3.4 OMR recognition

```text
captured -> form_detected -> recognition_pending -> recognized
                         |                         |
                         +-> wrong_form            +-> review_required
                                                   +-> failed
recognized -> accepted_for_marking -> finalized
           \-> operator_corrected -> accepted_for_marking
```

Proposed recognition statuses:

```text
blank | single_mark | multiple_mark | ambiguous | unreadable |
wrong_form | missing_evidence | operator_corrected
```

`blank` means a verified readable answer region contains no detected accepted mark; it does not assert the candidate's intention. `missing_evidence` means the region/page was absent or not verifiable. They must not collapse to one null value.

### 3.5 Digital marking and moderation

```text
unassigned -> assigned -> in_progress -> evaluation_saved -> submitted_for_review
                                              |                    |
                                              +-> correction        +-> second_marking
                                                                    -> discrepancy_review
                                                                    -> moderation
                                                                    -> final_evaluation
```

Each evaluation is append-only logical evidence. A new evaluation may supersede visibility or selection, but it must not erase the prior evaluation.

| State | Meaning | Required guard |
|---|---|---|
| `assigned` | Marker may access only scoped evidence | School, role, assessment and assignment checks |
| `evaluation_saved` | Draft evaluation persisted | Revision/actor conflict handling |
| `submitted_for_review` | Marker considers evaluation complete | Required questions/evidence validated |
| `second_marking` | Independent second evaluation required | Prior evaluation hidden if blind policy |
| `discrepancy_review` | Scores/decisions differ under policy | Authorized moderator resolution |
| `moderation` | Final review of evaluations | Original evaluations remain visible to authorized reviewer |
| `final_evaluation` | Selected result for score proposal | Immutable selection event and rationale |

### 3.6 Score handoff and result lifecycle

```text
proposed -> validating -> accepted -> canonical_score_written
                              |           |
                              +-> rejected
                              +-> conflicted -> authorized_correction/retry
```

The canonical path then follows current lifecycle rules:

```text
AssessmentScore draft/recorded/submitted -> locked
SubjectResult draft -> ready -> submitted -> approved -> locked
ReportCardRun ... -> compiled -> submitted_for_approval -> approved -> released
```

`validating` is durable while checks are in progress; `accepted` means validation passed but the canonical write receipt is not confirmed; `canonical_score_written` requires the conditional score effect and durable receipt. A lost acknowledgement reconciles by source operation identity and does not create a second effect. No proposal may bypass the current score lock, subject-result approval, or report-card release boundary.

After `canonical_score_written`, the score service schedules or performs subject-result recalculation under the existing result lifecycle. Recalculation is a downstream effect, not a score-proposal status and not proof that the handoff itself was accepted. A rejected/conflicted proposal does not recalculate; an authorized correction produces a new proposal version and a later recalculation.

## 4. Cross-machine invariants

1. Every stateful entity is school-scoped or reaches school scope through a verified parent.
2. Every active delivery references exactly one published content/delivery version.
3. A candidate assignment cannot point to a different student after evidence exists.
4. A page/response/mark event is idempotent by a stable operation key and cannot overwrite a newer revision.
5. Raw captures are immutable; corrections reference them.
6. Recognition is not marking; marking is not moderation; moderation is not canonical score release.
7. An accepted score proposal must identify a valid `AssessmentItem` and cannot overwrite a locked score.
8. A provider or network failure cannot be converted into a learner zero without an explicit academic decision.
9. Entitlement snapshots document the delivery context; current authorization is re-evaluated for new mutations and bounded continuation.
10. Report-card snapshots are downstream outputs, never capture or marking storage.

## 5. Failure and recovery matrix

| Boundary | Failure | Detection evidence | Safe response | Must not happen |
|---|---|---|---|---|
| Identity | Candidate impersonation or mismatched ID | Membership/student/assignment mismatch | Quarantine, non-disclosing error, authorized reconciliation | Attach evidence to guessed student |
| QR/page | Replay, forgery, duplicate, cross-school marker | Marker hash/version/assignment collision | Reject or exception-review; preserve asset | Treat QR payload as proof of identity |
| Storage | Presign/provider outage | Provider error and asset status | Mark failed/retry; preserve local/raw evidence | Leave misleading pending or delete sibling assets |
| Upload | Timeout/interrupted upload | No server receipt/partial object | Idempotent retry and visible pending state | Claim upload complete from client alone |
| Assembly | Missing/extra/out-of-order page | Page plan and marker/sequence mismatch | Reconcile with explicit operator action | Finalize incomplete script silently |
| Image | Blur/glare/crop/rotation/low contrast | Quality diagnostics or review | Rescan/review; retain original | Invent recognition confidence |
| OMR | Multiple/ambiguous/faint mark | Recognition status/confidence | Review or explicit correction | Convert ambiguity to wrong automatically |
| Marking | Concurrent edits/out-of-order saves | Revision mismatch/actor event | Reject stale write or append new evaluation | Last-writer-wins silently |
| Moderation | Discrepant evaluations | Score/rubric comparison | Moderator decision with rationale | Delete first/second evaluation |
| CBT | Network loss during autosave | Missing server acknowledgement | Keep local pending state; reconnect/reconcile | Show local answer as server-confirmed |
| CBT | Browser/device interruption | Attempt heartbeat/last receipt | Recovery pending; resume only under policy | Reset timer or duplicate attempt casually |
| Score handoff | Duplicate request or locked row | Idempotency/conditional filter | Return prior result or conflict | Create duplicate or overwrite lock |
| Entitlement | Expiry during active work | Current access mode versus snapshot | Apply approved grace/reconciliation policy | Delete evidence or suspend Core results |
| Reporting | Partial score/result write | Transaction/conditional result | Reconcile and retry; audit partial status | Mark report released from partial data |

## 6. Threat model summary

| Threat | Asset at risk | Control proposal | Verification |
|---|---|---|---|
| Cross-school query | Scores, scans, scripts | Active membership + parent-chain school filters | Negative tests using two schools |
| Candidate impersonation | Attempt/packet/result | Server assignment and identity revalidation | Wrong-student and changed-roster tests |
| QR replay/forgery | Paper evidence | Signed/versioned marker plus assignment lookup; QR is not sole proof | Synthetic replay/collision corpus |
| Lost device | Raw images/local queue | Encrypted local storage, logout warning, server reconciliation | Device-loss tabletop/pilot test |
| Answer-key leakage | Assessment integrity | Separate candidate and marker projections | Payload/route inspection and role tests |
| Marker escalation | Student identity/marks | Scoped roles, anonymized views, assignment checks | Role matrix tests and metadata inspection |
| Score race | Canonical academic truth | Conditional unlocked write + unique identities | Concurrent Mongo tests for every writer |
| Provider outage | Evidence durability | Explicit failed/retry/reconciled state | Fake provider and provider sandbox tests |

## 7. Entitlement lifecycle state policy

| Current access mode | New premium delivery | Active authorized work | School OS Core |
|---|---|---|---|
| `full` | Allow within capability/role/scope | Normal | Unchanged |
| `pilot_limited` | Only explicitly granted operations | Limits and expiry enforced | Unchanged |
| `grace` | Product decision required; recommended deny new expensive starts | Narrow completion/reconciliation may continue if approved | Unchanged |
| `restricted_read_only` | Deny | Preserve/read/audit; no new premium mutation | Core policy applies independently |
| `suspended` | Deny | Preserve; support access only through explicit authorization | Core access follows school suspension policy |

The entitlement snapshot stored on a delivery/attempt is historical evidence and cannot by itself authorize a later write.

## 8. Verification obligations

- State transition tests must reject illegal transitions and stale revisions.
- Integration tests must exercise two schools, two candidates, duplicate operations, replay, provider failure, and lock races.
- Device/pilot tests must measure workflow outcomes and failure classification without inventing accuracy or uptime guarantees.
- Any implementation must reconcile the separate `studio-to-gradebook-service.ts` writer and add subject-result concurrency coverage before claiming all-ingress canonical safety.
