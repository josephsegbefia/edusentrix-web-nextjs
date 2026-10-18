# EduSentrix Assess — REA-R01C Architecture Decision Register

**Date:** 2026-10-15 (Africa/Accra)  
**Status:** Proposed decisions for independent ChatGPT and product-owner review  
**Scope:** Unified delivery, evidence, resilience, security, interoperability and REA-R02 readiness

## Decision status vocabulary

- **Proposed:** recommended architecture direction; not binding and not implemented.
- **Needs product approval:** commercial, policy, privacy, or customer-impacting choice.
- **Blocked:** cannot safely proceed until a stated dependency is resolved.
- **Verified current:** repository fact, not a future decision.

## ADR-R01C-001 — Preserve one canonical academic result engine

**Status:** Proposed; aligns with approved REA protocol  
**Confidence:** High

### Context

The repository already has `AssessmentPlan`, `AssessmentItem`, `AssessmentScore`, `SubjectResult`, `ReportCardRun` and `StudentReportCard` services/models. REA-00A and REA-00B define School OS Core as the owner of ordinary marks, grading and report cards.

### Decision

CBT, paper/OMR and handwritten marking adapters must produce validated score proposals into the existing canonical assessment engine. They must not create a parallel score/result/report-card authority or write directly to report-card snapshots.

### Alternatives

- **Separate premium score engine:** duplicates grading truth, complicates release/locking and risks Core/Premium divergence. Rejected.
- **Direct report-card writes:** bypasses canonical approval/readiness and provenance. Rejected.
- **Canonical handoff:** preserves existing behavior and centralizes score integrity. Recommended.

### Consequences

Premium work must conform to existing score identity, lock state, grading policy, subject-result and report-card lifecycle. The unresolved `studio-to-gradebook-service.ts` writer must be addressed before claiming all score ingress is safe.

## ADR-R01C-002 — Use immutable published definition and delivery versions

**Status:** Proposed; needs product/architecture approval  
**Confidence:** Medium-high

### Context

Current `ExamPaper`, `ExamQuestion` and `QuestionBankItem` records are authoring/reuse records. REA-R01A/R01B show that serious delivery workflows depend on templates, question versions, paper identity, timing and marking policies that must remain stable after issue.

### Decision

Introduce a conceptual immutable `AssessmentDefinitionVersion` plus `AssessmentDeliveryVersion` boundary. Do not automatically create models or migrate current records in REA-R01C. Existing authoring records map into a future published snapshot through an approved compatibility design.

### Alternatives

- **Treat current `ExamPaper` as immutable after approval:** minimal schema change, but existing record shape and mutation paths do not prove full snapshot semantics.
- **Copy all content into every mode-specific artifact:** strong isolation, but duplicates content and increases reconciliation complexity.
- **Shared definition snapshot plus mode-specific delivery policy:** preserves one content source while isolating CBT/paper behavior. Recommended.

### Consequences

Publication, correction, hashing, resource manifests and migration compatibility become explicit. Version storage, authoring UX and historical compatibility require design before implementation.

## ADR-R01C-003 — Use a common delivery envelope with mode-specific extensions

**Status:** Proposed  
**Confidence:** Medium-high

### Decision

Use one delivery identity, school scope, definition reference, publication lifecycle, entitlement evidence and canonical-handoff reference. Store CBT, paper and OMR fields in discriminated mode-specific extensions rather than a flat collection of unrelated nullable fields.

### Trade-off

This avoids invalid combinations and clarifies validation, at the cost of more explicit serializers and mode-specific UI. A fully separate model per mode would isolate concerns more strongly but would duplicate publication and authorization logic.

## ADR-R01C-004 — Start with reconnectable browser CBT

**Status:** Proposed; needs product/security approval  
**Confidence:** Medium

### Context

Online-only delivery is fragile for Ghanaian school connectivity. Fully offline delivery creates additional risks around signed packages, local storage, device loss, replay, timer authority, conflict reconciliation and answer-key protection. Current repository evidence does not show a CBT runtime.

### Decision

If CBT is initiated, start with reconnectable browser delivery: server-authoritative timing and submissions, durable save acknowledgements, explicit pending-local state, controlled recovery and no claim that local unsaved answers are durable.

### Alternatives

- **Online-only:** simpler implementation, but unacceptable connectivity assumptions for initial field use.
- **Fully offline:** better connectivity tolerance, but high security/recovery complexity and no current evidence.
- **Reconnectable browser:** balanced first mode; still requires device/network validation. Recommended provisionally.

### Consequences

Network loss becomes a first-class UX and state problem. Delivery must preserve confirmed revisions and distinguish pending local work from server state. Fully offline remains a later decision.

## ADR-R01C-005 — Treat paper/OMR as evidence capture adapters

**Status:** Proposed  
**Confidence:** High

### Decision

Paper scripts and OMR sheets share published delivery, candidate assignment, packet/form identity and finalization boundaries, but use different capture/review adapters. A `ScriptSubmission` remains the current Konect intake foundation; a future evidence model must not assume upload completion equals academic completion.

### Consequences

Raw pages, page assembly, recognition, human marking and moderation need separate states. Current scanner tests cover persistence/isolation, not QR/OMR recognition or final score handoff.

## ADR-R01C-006 — QR/marker identity is a routing signal, not proof of identity

**Status:** Proposed security invariant  
**Confidence:** High

### Decision

A QR or machine-readable marker may identify a delivery version, packet and page, but cannot alone prove authenticity, candidate ownership, school authorization, non-reuse, or absence of tampering. Every decode must be reconciled with server-side assignment and school scope.

### Consequences

Marker replay, forgery, duplicate, cross-school and swapped-packet cases require quarantine/reconciliation. Visible candidate identity and invigilator evidence may still be needed.

## ADR-R01C-007 — Preserve layered evidence

**Status:** Proposed  
**Confidence:** High

### Decision

Keep `RawCapture`, `PageArtifact`, `RecognitionResult`, `MarkingEvaluation`, `ModerationDecision`, `FinalizedScoreProposal`, canonical `AssessmentScore` and released report snapshots logically distinct.

### Consequences

Corrections and regrades become auditable and recovery is possible. Storage and UI complexity increase, but silent score mutation and evidence loss are reduced.

## ADR-R01C-008 — Confidence/ambiguity requires explicit disposition

**Status:** Proposed  
**Confidence:** High

### Decision

OMR and page recognition must distinguish blank, missing evidence, multiple mark, ambiguous, unreadable, wrong form and operator-corrected outcomes. Unresolved states cannot finalize.

### Consequences

The product requires review queues and operator explanations. No recognition accuracy threshold is claimed before field sampling.

## ADR-R01C-009 — Append-only logical marking and moderation evidence

**Status:** Proposed  
**Confidence:** High

### Decision

Marker evaluations, annotations, rubric applications, second marks, discrepancy decisions and corrections append evidence. A selected primary/final evaluation is a separate decision, not destructive replacement.

### Consequences

Concurrent markers need revision or independent-evaluation rules. Blind marking requires access tests against identities, covers, metadata and prior annotations.

## ADR-R01C-010 — Reconcile entitlement snapshots with current authorization

**Status:** Proposed; needs product-owner approval  
**Confidence:** Medium-high

### Decision

Store the product/capability decision used to publish or start a delivery as historical evidence, but re-evaluate current membership, role, school status, capability and lifecycle for later mutations. Assess expiry must not delete Core marks, results or report cards.

### Open policy

Product ownership must approve a bounded continuity window and deny unrelated new work. Proposed policy: permit only already-authorized active attempts, assigned marking/moderation, and previously captured scan reconciliation for a short fixed period recorded per school/delivery; require current membership, role, school status, capability, audit and operation identity on every continuation; preserve finalized Core results; require explicit support/security authorization after the window or during suspension. Historical entitlement snapshots never grant indefinite authorization.

## ADR-R01C-011 — Defer QTI profile selection until fixture review

**Status:** Proposed; blocked on interoperability spike  
**Confidence:** Medium

### Context

REA-R01A found TAO's historical QTI 2.1 documentation and current public QTI 2.2/3.0 positioning. EduSentrix has existing question types but no QTI import/export implementation.

### Decision

Do not copy TAO/GPL code. Compare a deliberately bounded QTI 2.2 profile with a QTI 3.x profile using representative EduSentrix fixtures, response-processing needs, media/accessibility requirements, validators, round-trip behavior and license-compatible tooling.

### Provisional direction

Begin design with a narrow versioned profile rather than promise full QTI conformance. The exact starting version remains open until fixture/tooling evidence exists.

## ADR-R01C-012 — Field validation before delivery implementation

**Status:** Proposed gate  
**Confidence:** High

### Decision

Before REA-R02 implementation, validate synthetic workflows across ordinary copier paper, low-cost printers, affordable Android devices, lighting/blur/glare, page ordering, duplicate/missing pages, identity swaps, interrupted uploads, local pending queues, concurrent marking and score handoff.

### Consequences

The first implementation slice should be selected from observed failure boundaries, not competitor feature lists. No accuracy, uptime or recovery-time promise is made before evidence.

## 4. Open decisions requiring product-owner approval

1. Core versus Assess ownership of current advanced paper authoring and question-bank operations.
2. Version snapshot strategy and compatibility for existing `ExamPaper`/`ExamQuestion` data.
3. Initial CBT mode and active-attempt entitlement-expiry policy.
4. Paper marker design and candidate-reconciliation policy.
5. Raw scan/device queue retention, encryption and deletion policy.
6. Marker, moderator, invigilator and identity-reconciliation permissions.
7. QTI profile and license-compatible implementation strategy.
8. Required Ghanaian school pilot scope and success criteria.

## 5. REA-R02 readiness gates

REA-R02 should not begin implementation until:

- the four deliverables in this cycle are independently reviewed;
- product ownership approves or explicitly defers the open decisions;
- contract/state fixtures and failure matrix are converted into an approved implementation slice;
- a score-writer inventory includes `studio-to-gradebook-service.ts` and subject-result concurrency coverage;
- field/device/provider validation boundaries are authorized;
- entitlement and privacy policies are explicit;
- no Core/Premium contradiction remains for ordinary exam marks and reports.

## 6. Decision confidence summary

| Decision area | Confidence | Main uncertainty |
|---|---|---|
| Canonical result handoff | High | Separate writer still needs hardening |
| Layered evidence | High | Future storage/retention design |
| Immutable delivery snapshot | Medium-high | Migration and authoring compatibility |
| Mode-specific delivery extension | Medium-high | Final schema/API ergonomics |
| Reconnectable CBT first mode | Medium | Field connectivity and UX evidence |
| QR as non-authoritative identity | High | Final marker integrity mechanism |
| QTI starting profile | Low-medium | Fixture/tooling/license comparison |
| Ghanaian differentiation hypotheses | Low-medium | Requires pilot-school evidence |

No decisions in this register authorize application implementation, migration, subscription changes, provider operations, commits or pushes.
