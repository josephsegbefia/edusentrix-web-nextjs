# EduSentrix Assess — REA-R02A Product Decision Register

**Date:** 2026-10-15 (Africa/Accra)
**Status:** PD-001 through PD-005, PD-008, PD-009 and P03C score-handoff authorization approved by the product owner on 2026-10-15/2026-10-16; all other decisions retain their recorded statuses
**Owner:** Product owner with architecture/security review
**Evidence:** REA-00A/00B/00C1, REA-R01A/R01B/R01C, current repository interfaces

## Decision status vocabulary

- **Proposed:** recommended but not binding.
- **Needs product approval:** customer, commercial, privacy or operational choice.
- **Needs security approval:** security invariant or sensitive-data control.
- **Blocked:** implementation cannot safely proceed without the decision.
- **Verified current:** repository fact, not a future decision.

## Register

### R02A-PD-001 — Core versus Premium boundary

**Recommendation:** Core retains ordinary exam authoring/marks, grading, subject results and report cards; Premium gates advanced immutable publication, CBT, paper/OMR evidence, digital marking, moderation and analytics.

**Alternatives:** Gate all examinations behind Premium; create a separate Premium result engine. Both conflict with the approved Core continuity/canonical-engine rules.

**Evidence:** REA protocol §3; REA-00B; current `AssessmentPlan`/`AssessmentItem`/`AssessmentScore`/`SubjectResult` models.

**Consequence/risk:** Entitlement keys and route guards must eventually distinguish basic from advanced capabilities. Current broad/switch-controlled guards remain a known risk.

**Status:** **Approved — product owner, 2026-10-15.** Premium gate changes may proceed within the approved boundary.

### R02A-PD-002 — Publication and versioning

**Recommendation:** Snapshot mutable `ExamPaper`/`ExamQuestion`/`QuestionBankItem` content into immutable definition and delivery versions; corrections create new versions/events.

**Alternatives:** Freeze existing papers in place; copy separate mode artifacts. The former lacks historical isolation; the latter duplicates authority.

**Evidence:** Current authoring models and R01C contract.

**Consequence/risk:** Requires compatibility strategy and content/resource hashing; no migration is approved.

**Status:** **Approved — product owner, 2026-10-15.** Publication implementation may proceed subject to security, persistence and compatibility review.

### R02A-PD-003 — Score-bearing and non-reporting delivery binding

**Recommendation:** `assessmentPlanId`/`assessmentItemId` may be absent only for explicitly non-reporting deliveries. Score-bearing/report-contributing delivery requires existing canonical plan/item before assignment or handoff.

**Alternatives:** Require a plan for every delivery, including non-reporting practice; permit score-bearing deliveries without an item. The first over-constrains Core practice; the second duplicates or weakens result authority.

**Evidence:** `ExamPaper` has no plan requirement; `ExamTimetableEntry.assessmentItemId` is optional; `AssessmentItem` and `AssessmentScore` require plan context.

**Status:** **Approved — product owner, 2026-10-15.** Binding validation may proceed subject to the existing canonical academic-engine contract.

### R02A-PD-004 — Initial paper identity

**Recommendation:** Begin with a server-reconciled packet/form identity containing a non-authoritative machine marker plus visible fallback code; do not treat QR alone as candidate proof.

**Alternatives:** QR-only; visible code only; fully signed/offline packet. QR-only is weak against replay/forgery; visible-only increases operator work; signed offline is deferred complexity.

**Evidence:** R01B/R01C marker and reconciliation analysis.

**Status:** **Approved — product owner, 2026-10-15.** Initial packet identity implementation may proceed within this bounded contract. This approval records product authorization only and does not represent completed independent security verification.

### R02A-PD-005 — Candidate reconciliation authority

**Recommendation:** Authorized school role(s) reconcile identity mismatches with two-person or equivalent audit for high-risk changes; no automatic reassignment from weak identifiers.

**Alternatives:** Automatic QR assignment; unrestricted admin correction; central support-only reconciliation. Each has identity, insider or operational trade-offs.

**Evidence:** R01C security invariants and failure matrix.

**Status:** **Approved — product owner, 2026-10-15.** Explicit authorization was communicated through ChatGPT and relayed in the ASSESS-P02B authorized implementation instruction. This records product authorization only; independent security and production approval remain outstanding.

### R02A-PD-006 — Initial CBT mode

**Recommendation:** Reconnectable browser CBT with server-authoritative time and confirmed-save acknowledgements; fully offline is deferred.

**Alternatives:** Online-only; fully offline signed package. Connectivity evidence disfavors online-only; offline security/recovery evidence is absent.

**Evidence:** R01C decision register and field-validation plan.

**Status:** Needs product/security approval. **Implementation blocked:** CBT runtime.

### R02A-PD-007 — Entitlement-expiry continuity

**Recommendation:** Deny unrelated new Premium work after expiry. Permit only already-authorized attempts, assigned marking/moderation and captured-scan reconciliation inside a short fixed, per-school/delivery window with current authorization and audit. Preserve finalized Core results indefinitely under Core policy.

**Alternatives:** Immediate stop; indefinite completion; allow all reads/writes. Immediate stop risks evidence loss; indefinite completion weakens commercial/security boundaries; broad continuation grants unrelated work.

**Evidence:** R01C-D and subscription guard limitations.

**Status:** Needs product/legal/security approval. **Implementation blocked:** expiry behavior.

### R02A-PD-008 — Evidence retention and device security

**Recommendation:** Product-approved retention schedule, legal holds, authorized deletion events, encrypted local queues, account-bound cleanup only after server acknowledgement, and explicit lost-device/reconciliation handling.

**Alternatives:** Keep indefinitely; delete immediately after upload; unencrypted local queue. Each creates privacy, audit or data-loss risk.

**Evidence:** R01C security policy proposals; `StoredAsset` current lifecycle.

**Status:** **Approved — product owner, 2026-10-15.** Explicit authorization was communicated through ChatGPT and relayed in the ASSESS-P02C1 implementation instruction. This authorizes the bounded evidence-retention and capture-session controls in P02C1; it does not approve remote device erase, marking/moderation, entitlement-expiry continuity, or production release.

### R02A-PD-009 — Marking and moderation permissions

**Recommendation:** Scoped marker access to assigned evidence, optional blind marking, authorized moderator identity access, append-only evaluations and explicit discrepancy decisions.

**Alternatives:** Broad teacher access; last-writer-wins marks; destructive correction. Rejected due to tenant, privacy and audit risk.

**Evidence:** R01C marking contract and field matrix.

**Status:** **Approved — product owner, 2026-10-15.** Explicit authorization was communicated through ChatGPT and relayed in the ASSESS-P03A authorized implementation instruction. This records product authorization only; independent security verification, production use with real student scripts, entitlement-expiry policy and Core score handoff remain outside this approval.

### R02A-PD-010 — QTI timing and profile

**Recommendation:** Defer profile selection until representative fixtures, response-processing, accessibility, validator, round-trip and license review. Do not copy TAO/GPL implementation.

**Alternatives:** Promise QTI 2.1/2.2/3.x immediately; import only; no interoperability. Each requires evidence/product scope before commitment.

**Evidence:** R01A synthesis and R01C decision register.

**Status:** Needs architecture/product/legal approval. **Implementation blocked:** QTI implementation, not score-writer slice.

### R02A-PD-011 — Pilot scope

**Recommendation:** After synthetic validation, use two or more non-production school environments with varied paper, device and connectivity conditions, no automatic live report-card contribution.

**Alternatives:** Single-school pilot; production marks immediately; device-only lab. These under-sample operational variance or increase academic risk.

**Evidence:** R01C field-validation plan.

**Status:** Needs product/security/operations approval. **Implementation blocked:** pilot/release claims.

### ASSESS-P03C-AUTH — Guarded Core score handoff

**Recommendation authorized:** A current immutable independently approved marking outcome may be explicitly handed off to the existing canonical Core `AssessmentScore` writer only when the published delivery is score-bearing and has a same-school `AssessmentPlan`/`AssessmentItem` binding. The handoff must independently revalidate identity, delivery, approval, evidence provenance, academic binding, score bounds and entitlement, and must atomically persist the Core score, durable receipt and Tier 0 audit event. Conflicts, stale outcomes and unsupported score mappings fail closed. Handoff must not publish or release report cards, overwrite existing official scores or introduce a parallel result engine.

**Authorization source:** The EduSentrix product owner’s explicit authorization communicated through ChatGPT and relayed in the ASSESS-P03C implementation instruction.

**Status:** **Approved — product owner, 2026-10-16.** This authorizes bounded local P03C implementation and synthetic/disposable verification only. It does not represent independent security approval, production authorization, live student score writes, deployment, correction workflows, subscription packaging approval or approval of R02A-PD-007.

## Approval record

On 2026-10-15, the EduSentrix product owner explicitly approved R02A-PD-001, R02A-PD-002 and R02A-PD-003 through ChatGPT; that authorization was relayed in the ASSESS-P01A implementation instruction. In the ASSESS-P02A instruction, the product owner explicitly approved R02A-PD-004 through ChatGPT; that authorization was relayed in the P02A implementation instruction. In the ASSESS-P02B instruction, the product owner explicitly approved R02A-PD-005 through ChatGPT; that authorization was relayed in the P02B implementation instruction. In the ASSESS-P02C1 instruction, the product owner explicitly approved R02A-PD-008 through ChatGPT; that authorization was relayed in the P02C1 implementation instruction. In the ASSESS-P03A instruction, the product owner explicitly approved R02A-PD-009 through ChatGPT; that authorization was relayed in the P03A authorized implementation instruction. On 2026-10-16, the product owner explicitly authorized the bounded ASSESS-P03C Core score-handoff policy through ChatGPT; that authorization was relayed in the P03C authorized implementation instruction. These records product-owner approval only and do not represent completed independent security verification.

- **R02A-PD-001:** Approved by product owner on 2026-10-15.
- **R02A-PD-002:** Approved by product owner on 2026-10-15.
- **R02A-PD-003:** Approved by product owner on 2026-10-15.
- **R02A-PD-004:** Approved by product owner on 2026-10-15 for opaque server-recorded packet/page identity, QR routing markers, human-readable fallback codes, audited issuance/reprint, and retry-controlled issuance. Candidate identity reconciliation and evidence capture remain outside the approval.
- **R02A-PD-005:** Approved by product owner on 2026-10-15 for authorized school-admin assignment and independent correction review. This does not approve scanning, evidence capture, device retention, or PD-008.
- **R02A-PD-008:** Approved by product owner on 2026-10-15 for bounded evidence retention, legal-hold, deletion-request, audit, and account-bound capture-session controls. This does not approve remote erase of offline device copies, marking/moderation, entitlement-expiry continuity, or production release.
- **R02A-PD-009:** Approved by product owner on 2026-10-15 for scoped marking assignments, optional blind-marking projections, independent moderation, append-only evaluations and explicit correction decisions. This does not authorize real-student production use, AI/OMR/CBT, entitlement-expiry continuity, or Core score handoff.
- **ASSESS-P03C-AUTH:** Approved by product owner on 2026-10-16 for guarded local Core score handoff from current independently approved Premium outcomes using the canonical `AssessmentScore` writer, durable receipt and transactional Tier 0 audit. This does not approve production use, live student score writes, report-card release, score corrections, subscription continuity or R02A-PD-007.

No unrelated product decisions are approved by this record update. R02A-PD-006, R02A-PD-007, and R02A-PD-010 through R02A-PD-011 retain their existing statuses.
