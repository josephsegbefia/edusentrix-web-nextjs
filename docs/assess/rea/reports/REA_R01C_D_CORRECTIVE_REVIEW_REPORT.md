# EduSentrix Assess — REA-R01C-D Corrective Review Report

**Date:** 2026-10-15 (Africa/Accra)  
**Status:** Documentation correction completed; independent review required  
**Scope:** Reconciliation of the four R01C documents and preparation for R02A  
**Evidence boundary:** Repository-local documentation and source inspection only; no REA target, database, provider, device, browser, pilot or production operation was used.

## 1. Outcome

The four R01C documents were reconciled without changing the proposed architecture, School OS Core/Premium boundary, canonical academic result engine, application source, configuration or dependencies. The unified contract is now the authoritative source for proposed lifecycle vocabulary and score-handoff semantics. The state-machine, field-validation and decision-register documents now point to that vocabulary rather than introducing competing meanings.

## 2. Inconsistencies found and exact resolutions

| Finding | Resolution | Modified source |
|---|---|---|
| `CandidateAssignment` used `ready` as a status while the state diagram treated it as a transition. | Durable assignment status now uses `assigned`, `eligible`, `active`, `completed`, `withdrawn`, `blocked`, `expired`; `ready` is a transient readiness state. | Unified contract; state/failure matrix |
| Delivery used `blocked` and `emergency_paused` ambiguously. | `emergency_paused` is a durable operational delivery status; `blocked` is an operation denial/gate with an audit reason. | Unified contract; state/failure matrix |
| Attempt showed `interrupted` as a lifecycle status even though interruption is an event. | `interrupted` is an audit event; an attempt requiring recovery enters durable `recovery_pending`. `timed_out` remains distinct from save/recovery failure. | Unified contract; state/failure matrix |
| Score handoff showed `validating`, `accepted` and `canonical_score_written` without defining acknowledgement semantics. | `validating` is in-progress durable handoff work; `accepted` means validation passed only; `canonical_score_written` requires the conditional score effect and durable receipt. | Unified contract; state/failure matrix |
| Script states mixed current `ScriptSubmission` upload values with proposed reconciliation/marking values. | Current upload statuses remain unchanged. Proposed evidence reconciliation is separately named `unreconciled`, `reconciling`, `reconciled`, `exception_review`, `finalized`, `voided`; upload/assembly milestones are not claimed as current model statuses. | Unified contract; state/failure matrix |
| Hybrid delivery did not specify ownership, maximums or multi-item handoff behavior. | Added one shared candidate/delivery identity with per-mode evidence ownership, declared component maximums, 40 CBT + 60 paper example, incomplete-evidence rules and one logical handoff per `(assessmentItemId, studentId)`. | Unified contract |
| Handoff contract did not fully specify retry/lost-ack/partial-write behavior. | Added `sourceOperationId`, proposal version, scoped idempotency, evidence hash/reference, conditional locked-score write, durable reconciliation, concurrent retry and correction rules. Network exactly-once delivery is not promised; logical exactly-once effects are proposed through idempotency and reconciliation. | Unified contract; state/failure matrix |
| Current compatibility boundary was implicit. | Clarified that existing `ExamPaper` need not already have an `AssessmentPlan`; an Assess delivery contributing to academic results must resolve a canonical `AssessmentItem` before publication/assignment. Core paper authoring remains available through existing behavior; standalone Assess still needs minimum school/membership/period/class/subject context and cannot create a second result engine. | Corrective report; existing unified contract model map |
| Expiry policy was open-ended. | Added a bounded continuity proposal for already-authorized attempts, assigned marking/moderation and unsynchronized scans, with current authorization, audit, denial of unrelated new work, support exceptions and preservation of finalized Core results. | Unified contract; decision register |
| Evidence security requirements were incomplete. | Added proposed retention/deletion holds, encrypted local queue, logout/account-switch/lost-device, acknowledgement cleanup, recovery escalation, answer-key secrecy, QR replay/forgery and anonymized-marking requirements. | Unified contract |
| OMR `blank` wording could imply candidate intention. | Corrected to “verified readable region with no detected accepted mark”; it does not infer intention and is distinct from missing evidence. | State/failure matrix; field-validation plan |

No inconsistency justified a redesign or application-model decision in this corrective pass.

## 3. Current repository compatibility findings

These are repository observations, not proposed implementation contracts:

- `ExamPaper` is a mutable authoring record and does not currently require `assessmentPlanId`.
- `ExamSession` may reference an `assessmentPlanId`, while `ExamTimetableEntry.assessmentItemId` is optional.
- Therefore an existing Core exam paper can remain usable through current Core behavior without requiring Premium Assess publication. A future Premium delivery that contributes to canonical academic results must resolve an appropriate `AssessmentItem` before assignment or score handoff; publication may be allowed only if the approved product contract explicitly distinguishes a non-reporting delivery.
- Existing `ExamPaper`, `ExamQuestion` and `QuestionBankItem` records can be inputs to a future immutable publication snapshot, but the repository does not yet prove snapshot storage, migration, content hashing or historical serializer behavior.
- A standalone Assess customer still requires the minimum school/tenant context, active membership, academic period, class/grade and subject/subject-offering identity needed by the canonical engine. It must reuse `AssessmentPlan`, `AssessmentItem`, `AssessmentScore`, `SubjectResult` and report-card boundaries when results contribute to School OS outputs; no separate premium result authority is approved.
- `ScriptSubmission` and `StoredAsset` currently provide upload/storage foundations, not OMR recognition, candidate reconciliation, marking or moderation completion.
- `studio-to-gradebook-service.ts` still contains a separate `AssessmentScore.bulkWrite` path, and dedicated real-database subject-result concurrency coverage remains an explicit dependency.

## 4. Hybrid scoring contract example

For a 100-mark examination with 40 CBT marks and 60 paper marks:

1. One published delivery and candidate assignment identify the examination and student.
2. The CBT attempt owns its response revisions and produces a component evidence result capped at 40.
3. The paper packet/script evidence owns pages, OMR/handwritten marking and produces a component evidence result capped at 60.
4. Finalization verifies both component maximums, contribution policy, version identity, evidence completeness, ambiguity disposition and marking/moderation requirements.
5. If the components map to separate academic items, each item receives one authorized proposal for that student. If they map to one combined item, the delivery boundary creates one aggregated proposal capped at 100.
6. A component adapter cannot overwrite the other component's score. Duplicate finalization is resolved by scoped operation identity; corrections create a new proposal version and explicit audit event.

## 5. Decisions still pending

Product/architecture/security ownership must still decide or explicitly defer:

- immutable snapshot storage and compatibility strategy for existing authoring records;
- whether Premium publication requires an `AssessmentItem` for every delivery or permits explicitly non-reporting deliveries;
- first paper identity/form strategy and candidate reconciliation authority;
- reconnectable CBT details and the bounded expiry-continuity duration;
- raw evidence retention, deletion/legal hold and device-local encryption policy;
- marking, moderation, invigilation and identity-reconciliation permissions;
- QTI profile and license-compatible tooling after fixture review;
- pilot-school scope and approved success criteria.

## 6. Unresolved code and security risks

- The separate `studio-to-gradebook-service.ts` score writer may bypass the future common handoff safeguards until reviewed and hardened.
- Subject-result concurrency behavior lacks the required dedicated real-database evidence.
- Current subscription feature keys and guards are broad and switch-controlled; this corrective pass did not change or claim uniform Premium enforcement.
- No CBT runtime, OMR recognition, encrypted device queue, immutable publication snapshot, handoff receipt or moderation subsystem was verified as implemented.
- Retention, deletion, legal hold, provider access, device loss and anonymized-marking controls remain policy proposals.
- No accuracy, uptime, recovery-time or field-operability claim is established.

## 7. R02A versus later operational gates

### R02A — architecture lock and implementation authorization

R02A may begin only after independent review and explicit approval or deferral of the contract vocabulary, Core/Premium invariants, canonical score-handoff rules, security/data-integrity policy proposals, current-model compatibility choices, synthetic fixtures/state table and a bounded first implementation slice. R02A is an authorization gate; it does not prove runtime or field readiness.

### R02B and later — engineering and operational validation

Later gates must provide code and integration tests, isolated Mongo/provider evidence, device and paper validation, browser/network resilience checks, pilot-school acceptance and production release evidence. These require separate authorization and cannot be satisfied by this documentation pass or by a passing `git diff --check`.

## 8. Readiness recommendation

**Recommendation: R02A not yet implementation-authorized; conditionally ready for architecture-lock review.** The documents are internally reconciled enough for product-owner and independent ChatGPT review. Do not begin implementation until the pending decisions are approved or explicitly deferred, the score-writer/concurrency dependencies are recorded in the first slice, and the bounded entitlement/privacy policy is accepted.

## 9. Verification performed

| Check | Result |
|---|---|
| Four R01C documents cross-read and reconciled | PASS |
| Current model/interface claims checked against repository source | PASS for claims stated above; proposed models remain unimplemented |
| Core/Premium and canonical result-engine boundary preserved | PASS |
| `blank` OMR terminology corrected | PASS |
| Field validation claimed as completed | NO — explicitly not performed |
| Application tests | NOT RUN — documentation-only task |
| `git diff --check` | PASS |
| Source/dependency/config/migration/database/provider/production changes | NONE from this task |

The working tree contains pre-existing source, test and REA documentation changes; they were preserved and not attributed to this corrective pass beyond the four updated R01C reports and this report.

## 10. Stop boundary

This corrective documentation pass is complete. It does not start REA-R02A, REA-R02B, REA-00C2 or Premium implementation. Stop here for independent ChatGPT review.
