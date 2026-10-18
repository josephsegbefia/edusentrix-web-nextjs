# EduSentrix Assess — REA-R01C Field Validation Plan

**Date:** 2026-10-15 (Africa/Accra)  
**Status:** Proposed validation plan; no field trial performed  
**Purpose:** Validate delivery/evidence assumptions with synthetic data before REA-R02 implementation

## 1. Validation principles

- Use synthetic students, schools, papers, answer keys, scripts and scores only.
- Do not use production data or production provider credentials.
- Record device model, OS, app/build version, paper stock, printer/copier, lighting, network condition, operator role, input artifact hash and outcome.
- Measure workflow outcomes and failure classification, not unsupported recognition accuracy or uptime promises.
- Every failed case must preserve the raw artifact and a reproducible disposition.
- Separate local automated evidence from device, provider and pilot-school evidence.

## 2. Validation lanes

| Lane | Can be performed locally | Requires external boundary | Evidence output |
|---|---|---|---|
| Contract/state validation | Yes | No | Fixtures, transition tests, invariant report |
| Scan/PDF processing | Partly, with synthetic files | Real scanner/phone for field behavior | Input hash, diagnostics, disposition |
| Mobile capture | No | Authorized Android/iOS devices | Device matrix and capture artifacts |
| Provider/storage recovery | Fake provider locally | Authorized storage sandbox for final check | Provider receipt/failure/retry evidence |
| CBT reconnect/resume | Browser automation/local network shaping | Representative low-bandwidth devices | Attempt event log and save/recovery report |
| School operations | Synthetic staging only | Authorized pilot schools | Operator observation, issue log, signed acceptance |

## 3. Synthetic fixture set

Create only in an isolated test environment:

- School A and School B with non-overlapping students, teachers, memberships and subjects.
- One published assessment definition with objective, short-answer and handwritten-response questions.
- One paper delivery version, one OMR form version, and one reconnectable CBT delivery version.
- Candidate assignments for valid, absent, withdrawn, duplicate and cross-school cases.
- Packet/page fixtures: correct order, out-of-order, missing, duplicate, extra, rotated, wrong version, wrong student, damaged marker, faint mark, multiple mark, blank mark, glare, blur, crop and scale distortion.
- Marking fixtures with first evaluation, second evaluation, discrepancy, blind view, moderation decision, correction and released/non-released feedback.
- Score handoff fixtures for new, existing, duplicate, locked and cross-school `AssessmentScore` records.

Each fixture must have a stable identifier and source hash. Fixture creation must not imply that a proposed model already exists in production.

## 4. Contract and state validation matrix

| Test ID | Scenario | Lane | Method | Acceptance evidence |
|---|---|---|---|---|
| R01C-C-01 | Published content cannot be mutated by author edit | Local | Attempt versioned update after publication | Old content hash and delivery view unchanged; new version linked |
| R01C-C-02 | Delivery mode extension rejects unrelated fields | Local | Validate CBT, paper, OMR and hybrid payloads | Invalid mode payload rejected with actionable error |
| R01C-C-03 | Assignment cannot cross school/student scope | Local | Use School A assignment with School B student/packet | Non-disclosing rejection and no evidence write |
| R01C-C-04 | Illegal lifecycle transitions | Local | Enumerate transition table | Every forbidden transition rejected and audited |
| R01C-C-05 | Duplicate capture/handoff replay | Local | Repeat same idempotency key and artifact hash | One logical operation; stable response/reconciliation |
| R01C-C-06 | Locked score stale handoff | Local Mongo | Lock between read and write | Conditional write matches zero; locked value preserved |
| R01C-C-07 | Subject result concurrent transition | Local Mongo | Race submit/approve/lock paths | No stale overwrite; dedicated integration evidence |
| R01C-C-08 | Report-card boundary | Local | Attempt adapter write to snapshot boundary | Adapter has no direct snapshot write path |

## 5. Paper and scan validation matrix

| Test ID | Input variation | Method | Measure | Acceptance method |
|---|---|---|---|---|
| R01C-P-01 | Ordinary local copier paper | Print same form on representative school copier | Marker decode, page geometry, operator time, rejection reasons | No invented universal threshold; establish a product-approved supported profile from observed samples |
| R01C-P-02 | Low-cost printer scaling | Print at nominal, reduced and enlarged scale | Form/version/anchor detection and page usability | Unsupported scale is rejected or clearly flagged |
| R01C-P-03 | Faint pencil/pen marks | Synthetic controlled marks plus real volunteer samples if approved | Recognition state and review burden | Every non-confident response is reviewable; no silent score |
| R01C-P-04 | Multiple marks | Two or more marked choices | Recognition classification | `multiple_mark` or equivalent, source region retained |
| R01C-P-05 | Intentional blank | Empty answer region on valid page | Readability and detected accepted mark | `blank` means a verified readable region with no detected accepted mark; it does not infer candidate intention or equal missing evidence |
| R01C-P-06 | Glare/direct light | Same sheet under diffused/direct light | Diagnostic message and recognition disposition | Operator receives actionable retry/review result |
| R01C-P-07 | Blur/focus | Camera distance/focus variants | Quality classification | Unreadable/quality failure is explicit |
| R01C-P-08 | Rotation/skew/crop | Rotate or crop synthetic image | Marker/page detection | Recoverable transform or explicit rejection |
| R01C-P-09 | Wrong form/version | Scan another delivery/form | Form identity decision | Quarantine; no answer-key application |
| R01C-P-10 | Out-of-order pages | Shuffle page batch | Assembly result | Correct order from verified identity or exception queue |
| R01C-P-11 | Missing page | Remove required page | Completeness status | Cannot finalize without authorized exception |
| R01C-P-12 | Duplicate/extra page | Duplicate or inject unrelated page | Duplicate/extra detection | Preserve both assets and require disposition |
| R01C-P-13 | Wrong candidate/packet | Swap two synthetic packets | Candidate reconciliation | No automatic reassignment from weak identifiers |
| R01C-P-14 | PDF batch ingestion | Sheet-fed PDF at supported scan settings | Per-page status, failed-page download/retry | Batch summary includes each failed page and raw artifact |

### Measurements to record

- device/camera/printer/scanner model and software version;
- paper stock, size, orientation and print scaling;
- lighting description and optional lux measurement if available;
- source image dimensions, file size, format, orientation and hash;
- marker/form detection state and human disposition;
- time to successful capture/retry/reconciliation;
- operator-reported ambiguity and reason;
- whether raw evidence remained recoverable.

Do not publish a recognition-accuracy percentage until the sample design, ground truth, question distribution, confidence policy and independent review method are approved.

## 6. Mobile/offline and provider validation

| Test ID | Scenario | Lane | Method | Acceptance evidence |
|---|---|---|---|---|
| R01C-M-01 | Capture with no network | Device | Capture synthetic pages in airplane mode/blocked network | Local queue clearly shows pending; no server-confirmed claim |
| R01C-M-02 | Network returns during retry | Device + local test server/provider sandbox | Reconnect and resume | One idempotent upload; server receipt linked to local item |
| R01C-M-03 | App/browser termination before sync | Device | Kill/restart before and after capture | Pending raw evidence recoverable or explicit loss warning |
| R01C-M-04 | Logout/device switch with pending work | Device | Attempt logout/account switch | User warned; policy prevents silent loss or exposes reconciliation state |
| R01C-M-05 | Presign failure | Local fake provider | Reject presign | Owned asset becomes failed/retryable; siblings unaffected |
| R01C-M-06 | Upload timeout/partial provider failure | Fake/sandbox provider | Interrupt transfer | No false ready state; retry uses same operation identity |
| R01C-M-07 | Provider recovery | Sandbox | Recover provider and retry | Original evidence preserved; one final asset association |
| R01C-M-08 | Cross-school asset access | Local/sandbox | Use School B actor/ID for School A asset | Denied without disclosure |

Live provider tests require isolated credentials and explicit approval. REA-00C1 demonstrated fake-port reconciliation only; it did not prove live R2 behavior.

## 7. CBT validation matrix

| Test ID | Scenario | Lane | Method | Acceptance evidence |
|---|---|---|---|---|
| R01C-B-01 | Start outside window | Local/browser | Attempt before/after schedule | No attempt start; stable denial reason |
| R01C-B-02 | Accommodation snapshot | Local/browser | Planned extra time before start | Effective deadline recorded and reproducible |
| R01C-B-03 | Incident extra time | Local/browser | Authorized operator adds time | Separate event and revised deadline; actor/reason logged |
| R01C-B-04 | Network loss during autosave | Browser/network shaping | Drop network after local edit | UI distinguishes pending from confirmed; no false acknowledgement |
| R01C-B-05 | Out-of-order response saves | Local | Send revisions in reverse order | Older revision cannot overwrite newer server revision |
| R01C-B-06 | Duplicate final submit | Local | Repeat submission request | One submitted revision and stable idempotent result |
| R01C-B-07 | Refresh/device interruption | Browser | Refresh/close/reopen | Recovery follows policy; server-confirmed responses preserved |
| R01C-B-08 | Timeout | Local clock-controlled test | Reach effective deadline | Confirmed responses retained; timeout event distinct from save failure |
| R01C-B-09 | Late submission | Local | Attempt after primary deadline within/after allowed window | Explicit late status and policy disposition |
| R01C-B-10 | Answer-key/client leakage | Local route/payload inspection | Inspect candidate projection | No marking key/hidden answers in candidate response |

The initial recommended mode is reconnectable browser delivery. Fully offline delivery requires a separate security and recovery proof before consideration.

## 8. Marking, collaboration and moderation validation

| Test ID | Scenario | Method | Acceptance evidence |
|---|---|---|---|
| R01C-G-01 | Mark by question and by script | Same synthetic script through both views | Same evidence/evaluation identity and no duplicate mark |
| R01C-G-02 | Rubric version change | Create v1 evaluation, publish v2 | v1 remains historical; regrade explicitly references v2 |
| R01C-G-03 | Annotation coordinates | Mark image/PDF region | Coordinate system survives rendering/export or fails explicitly |
| R01C-G-04 | Concurrent marker saves | Two synthetic markers edit same assigned evidence | Stale revision rejected or independent evaluation created |
| R01C-G-05 | Blind marking | Marker A/B roles | B cannot see identity/A evaluation; moderator can see authorized evidence |
| R01C-G-06 | Discrepancy | Deliberately different scores | Discrepancy queue and moderation decision created |
| R01C-G-07 | Correction history | Correct recognition, rubric and mark separately | Distinct correction events and score deltas |
| R01C-G-08 | Feedback visibility | Internal notes, marker comments, student feedback | Role/release policy prevents answer-key or unreleased evidence leakage |

## 9. Pilot-school validation proposal

Only after synthetic/device validation passes, obtain product-owner approval for a small pilot. The pilot should include:

- at least two school environments with different printer/paper/connectivity conditions;
- primary/JHS/SHS workflows where relevant, without assuming one workflow represents all;
- school-admin, teacher-marker, invigilator and student-facing operators;
- synthetic or explicitly consented non-production assessments;
- signed pre/post acceptance criteria and incident reporting;
- no automatic contribution to live report cards.

Pilot questions:

1. Can operators identify why a capture failed without technical support?
2. Can a school recover from out-of-order, missing, duplicate and wrong-candidate pages?
3. Does the mobile workflow remain usable on affordable Android devices and ordinary school lighting?
4. Does the evidence trail explain how a final mark was produced?
5. Does the process reduce manual score transfer without hiding uncertainty?

## 10. Readiness gates

REA-R02 entry requires:

- approved synthetic contract fixtures and state-transition table;
- decision on the first paper identity/form strategy;
- device and paper sample plan;
- explicit data retention/device-security policy;
- fake-provider and local network-failure harness;
- score-writer inventory including `studio-to-gradebook-service.ts`;
- product-owner approval for any pilot and any entitlement-expiry policy;
- no unresolved cross-school or locked-score invariant failures.

This plan does not set accuracy, uptime, latency, or recovery-time promises. Such targets require approved sampling and operational evidence.
