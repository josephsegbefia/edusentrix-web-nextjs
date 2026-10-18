# EduSentrix Assess — REA-R02A Implementation Sequence

**Date:** 2026-10-15 (Africa/Accra)  
**Status:** Proposed dependency-ordered roadmap; no slice authorized  
**Scope:** Bounded engineering sequence after architecture review

## 1. Sequencing recommendation

The recommended order is:

```text
A score-writer hardening
        ↓
B immutable definition/delivery contracts
        ↓
C paper packet identity/reconciliation
        ↓
D digital script marking/moderation
        ↓
E OMR recognition adapter
        ↓
F reconnectable browser CBT
```

This order stabilizes canonical academic writes before adding new evidence producers, then validates the lower-connectivity paper path before CBT. It does not authorize implementation.

## 2. Candidate evaluation

| Candidate | Dependencies | Value/risk | Recommendation |
|---|---|---|---|
| A. Foundation score-writer hardening | Existing score/result services, isolated Mongo test lane | Highest integrity leverage; touches canonical data | First slice: REA-00C1B |
| B. Published definition/delivery contracts | A for safe handoff; product decisions | Establishes immutable boundary | Second |
| C. Paper packet identity/reconciliation | B, paper identity decision, storage policy | Exercises offline-friendly workflow and identity risk | Third |
| D. Digital script marking | B/C evidence references, role decision | Required for handwritten evidence | Fourth |
| E. OMR recognition | C, paper samples, recognition review policy | High field/quality uncertainty | Fifth |
| F. Reconnectable CBT | A/B, timing/security decisions, browser/network tests | Highest runtime/resilience scope | Sixth |

## 3. Bounded slices

### Slice A — REA-00C1B canonical score-writer and concurrency closure

**Scope:** inventory all `AssessmentScore` writers, harden `studio-to-gradebook-service.ts`, preserve existing teacher/school authorization, add real Mongo subject-result races, locked-score and idempotency behavior, and report-card regressions.

**Focused tests:** score writer authorization/tenant boundaries, duplicate operation, locked score, partial failure, concurrent subject-result transitions, Core exam/report-card regression. See `REA_00C1B_IMPLEMENTATION_SPEC.md`.

**Exit gate:** no known unguarded score writer in the inventoried scope; atomicity and concurrency evidence passes in isolated Mongo; no canonical lifecycle regression; provider/deployed evidence remains explicitly out of scope.

### Slice B — Immutable definition and delivery publication

**Scope:** implement only the approved publication contract and snapshot serializer around existing authoring records. Bind score-bearing deliveries to canonical plan/item context; preserve Core authoring.

**Focused tests:** mutation-after-publication, content/resource hash stability, authorization, school isolation, non-reporting versus score-bearing binding, correction/new-version behavior.

**Exit gate:** published payload cannot resolve mutable authoring content; no report-card direct write; migration/compatibility review approved.

### Slice C — Paper packet identity and reconciliation

**Scope:** create packet/form/page routing evidence and reconciliation workflow without OMR scoring. Extend/reuse `ScriptSubmission` only through an approved compatibility map.

**Focused tests:** replay/forgery/duplicate/cross-school markers, wrong candidate, missing/out-of-order/extra pages, provider retry, raw evidence retention, role/audit checks.

**Exit gate:** unresolved identity never finalizes; no scan failure becomes a score; isolated provider/storage checks pass.

### Slice D — Digital script marking and moderation

**Scope:** append-only evaluations, rubric/version references, annotations, blind access, second marking, discrepancy and final-selection evidence.

**Focused tests:** role matrix, concurrent marker revisions, identity masking, rubric correction, moderation and correction audit.

**Exit gate:** final evaluation requires complete evidence and authorized moderation policy; no direct `AssessmentScore` write except common handoff.

### Slice E — OMR recognition adapter

**Scope:** recognition result/evidence classification and operator review; no silent inference and no unreviewed canonical handoff.

**Focused tests:** readable blank, single/multiple/ambiguous/unreadable marks, wrong form, page quality, answer-key version, operator correction and raw-artifact preservation.

**Exit gate:** approved sample corpus and field validation; no accuracy promise without approved ground truth and review method.

### Slice F — Reconnectable browser CBT

**Scope:** server-authoritative timing, confirmed response revisions, pending-local state, reconnect/resume, timeout, duplicate submit and answer-key isolation.

**Focused tests:** browser/network shaping, out-of-order revisions, lost acknowledgement, interruption, accommodation, timeout and candidate payload inspection.

**Exit gate:** browser/network resilience evidence and security review; device/pilot evidence still required before release.

## 4. Cross-slice security gates

- Active-school context and role authorization are enforced server-side.
- Every school-owned query and mutation is tenant-scoped.
- No client-provided school/student/assignment identity is trusted without server reconciliation.
- Raw evidence is private and retention/deletion policy is approved.
- Answer keys and marking guides are excluded from candidate projections.
- Score writes use conditional lock/version checks and durable operation identity.
- Existing Core behavior and report-card release remain regression-tested.

## 5. R02A versus R02B+

R02A authorizes at most architecture lock and a bounded development slice after product/security approval. R02B+ is where implementation tests, isolated Mongo/provider checks, device/paper tests, browser/network resilience, pilot-school acceptance and release evidence occur. No R02A document can substitute for those operational gates.

## 6. Rollback and compatibility posture

Each slice must preserve current Core behavior and use additive, reversible boundaries where possible. No migration or destructive rewrite is included in the sequence. Before any schema/index change, document compatibility window, backfill/recovery, rollback condition and irreversible effects. If common score handoff cannot preserve existing writers, stop and do not add new adapters.

## 7. Readiness status

The sequence is ready for independent review and product-owner prioritization. Slice A is specified but not authorized or executed. All later slices remain blocked by the decision register and their stated evidence gates.
