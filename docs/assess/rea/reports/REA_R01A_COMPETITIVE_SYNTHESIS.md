# EduSentrix Assess — REA-R01A Competitive Synthesis

**Scope:** Inspera Assessment and TAO Testing  
**Observation date:** 2026-10-15 (Africa/Accra)  
**Repository:** `edusentrix-web-nextjs`  
**Branch:** `feat/assess-rea-foundation`  
**Research mode:** Documentation and public-source research only  
**Status:** Complete for independent ChatGPT review; no implementation authorized

## Executive conclusion

Inspera and TAO converge on a serious assessment-system pattern: reusable/versioned content, assembled assessment deliveries, candidate-specific assignment and timing, observable operational state, controlled exception handling, separate marking/moderation, and export/integration boundaries. They differ in emphasis:

- Inspera publicly emphasizes governed institutional operations, candidate monitoring, accommodations, offline resilience, role separation, and marking/moderation workflows.
- TAO publicly emphasizes QTI/LTI interoperability, open-source extensibility, portable item/test content, response processing, plugins, and custom interactions.

EduSentrix should borrow the patterns, not copy either product's private implementation. Our non-negotiable architecture remains intact: School OS Core owns ordinary examinations, mark entry, grading, subject results, and report cards; Assess Premium adds advanced capabilities while feeding the same canonical academic result engine.

The next architectural priority is a shared immutable delivery contract that can represent both CBT and paper examination delivery. Digital attempts and paper/scan submissions should be different capture modes over the same published assessment version and result-provenance boundary—not separate academic engines.

## Evidence boundary and method

Sources were reviewed on 2026-10-15. Inspera evidence came from its public product page, Help Center, API policy, and release-note pages. TAO evidence came from official TAO pages, OAT-maintained public GitHub repositories and technical articles. 1EdTech's public QTI specification index was used for standards scope and conformance context.

No authenticated competitor environment, paid feature, browser session, API request, source installation, REA target, provider operation, or performance test was used. Vendor product pages are treated as vendor-described claims. Help Center/repository behavior is treated as documented evidence, with version limits called out. Private architecture is not inferred as fact.

## 1. Comparative evidence-backed assessment

| Dimension | Inspera | TAO | EduSentrix consequence |
|---|---|---|---|
| Authoring | Question sets, reusable questions, 24 documented question types, marks/mark schemes/media/labels | QTI item authoring, import/export, composite items, QTI interaction model | Keep local authoring models, add versioned publication and a bounded QTI adapter |
| Assembly | Planner creates a test from question content, settings, candidates, contributors, schedule, security and grading workflow | QTI test structures and delivery configuration; public product material describes test assembly | Publish an immutable delivery snapshot before candidate access |
| Candidate delivery | Explicit candidate progress states, Monitor, timing, extra time, resubmission, offline path | QTI runner, review/mark-for-review options, result-variable events, LTI delivery adapter | Separate delivery, attempt, response, save, submission and exception contracts |
| Timing | Standard end, duration, individual deadlines, planned/incident extra time, late windows | Public source exposes timer/delivery-state feature flags; exact hosted behavior is version/configuration dependent | Server-authoritative timer policy snapshot and deterministic deadline calculation |
| Resilience | Save timestamp/warnings, documented offline submission recovery, autosave issue alerts | Public source documents asynchronous result transmission and restart/timer flags | Durable acknowledgements, idempotent retries, reconciliation and infrastructure-vs-learner failure states |
| Invigilation | Role-scoped Monitor actions, attendance, ID checks, flags, messages, extra time | Delivery plugins/extensions and LTI roles; exact operational model varies by deployment | Separate observe/intervene permissions and audited interventions |
| Marking | Collaborative grading, committees, mark schemes, moderation after grading confirmation | QTI response processing/outcomes plus platform reporting claims | Raw response, machine score, human mark, moderation and canonical score must remain distinct |
| Accessibility | Text-to-speech, candidate dashboard landmarks/headings/alt text claims, accommodations | QTI/rendering/custom interaction extensibility; accessibility depends on content/renderers | Accessibility is a delivery and custom-interaction acceptance requirement, not a checkbox |
| Interoperability | Public REST API for selected test/candidate/result/user operations | QTI 2.2/3.0 and LTI positioning; open repositories and SDK | Stable integration contracts with school/identity/entitlement safeguards |
| Extensibility | Public API and configurable roles/features; private implementation | Open extensions, PCI/PIC, plugins, event hooks, public source | Adapter/plugin boundary; no unreviewed third-party runtime code in core |
| Licensing | Proprietary service/documentation; terms not researched beyond public API policy | Reviewed OAT repositories show GPL-2.0 metadata | No TAO code reuse without legal and deployment review |

Primary evidence is detailed in [INSPERA_RESEARCH_DOSSIER.md](../competitors/INSPERA_RESEARCH_DOSSIER.md) and [TAO_RESEARCH_DOSSIER.md](../competitors/TAO_RESEARCH_DOSSIER.md).

## 2. What EduSentrix already has

The REA-00A repository verification established the following current foundations:

- Canonical academic result chain: `AssessmentPlan`/policy -> `AssessmentItem` -> `AssessmentScore` -> `SubjectResult` -> report-card snapshot and release.
- School-scoped assessment records, teacher/class/subject/period scope checks, grading policies, contribution rules, subject-result calculation, report-card compilation, approval, release, and historical snapshots.
- Exam paper authoring with sections, typed questions, options, subquestions, expected answers, marking guides, attachments, reviews, lifecycle transitions, and question-only PDF export.
- Reusable question-bank services and academic-reference validation.
- Exam sessions, timetable entries, venues, conflict detection, readiness, publishing, invigilator assignment, acknowledgement, and teacher operations.
- Konect scanner submission/page/private-storage foundation, including the REA-00C1 asset race and presign-failure hardening.
- Entitlement registries and proposed Core-vs-Assess capability vocabulary, though route/API enforcement and registry mappings remain incomplete.

These are repository findings, not competitor claims. REA-00A also found no focused implementation of a CBT attempt/response runtime, server-authoritative candidate timer, OMR recognition, or complete digital marking/moderation ledger.

## 3. What requires extension or is missing

### Extension of existing foundations

- Authoring needs explicit immutable versions, publication review, content/resource hashes, supported interaction profiles, and delivery compatibility checks.
- Exam sessions need a candidate assignment snapshot and a link to a specific published delivery version.
- Existing invigilation needs candidate-attempt state, live save/submission health, interventions, incident reasons, and capability-aware authority.
- Existing marking guides need question-level marking evidence, marker allocation, second marking/moderation, correction history, and finalization rules.
- QTI support needs an import/export boundary and a documented supported profile rather than direct exposure of arbitrary QTI.
- Scanner workflows need a paper identity/reconciliation contract that terminates in reviewed score evidence, not an unreviewed direct score write.

### Missing capability contracts

- `AssessmentDeliveryVersion` or equivalent immutable assembled delivery.
- Candidate `AssessmentAssignment` and `AssessmentAttempt` with school-scoped identity and lifecycle.
- Response envelope with sequence/revision, client/local timestamp, server receipt, save acknowledgement, and idempotency key.
- Server-authoritative timing and exception ledger.
- Paper packet/answer-sheet identity, QR/OMR capture, scan review, and reconciliation state.
- Digital marking event ledger and moderation decision ledger.
- Delivery-mode-neutral finalization adapter into `AssessmentItem`/`AssessmentScore`.
- Advanced assessment analytics with explicit finalized-data, retention, and role/release rules.

## 4. Architecture implications

### 4.1 Shared assessment authoring contract

Both CBT and paper delivery require one published source of truth:

```text
Authoring draft
  -> review and validation
  -> immutable AssessmentVersion
  -> immutable DeliveryVersion
  -> candidate assignment / paper packet
  -> capture evidence (CBT response or paper scan/mark)
  -> marking/moderation finalization
  -> canonical AssessmentScore
  -> SubjectResult and report-card pipeline
```

The diagram is an EduSentrix proposal, not a claim about either competitor's private model.

`AssessmentVersion` should pin question/item versions, structure, marks, scoring rules, resource references, accessibility options, and content hashes. `DeliveryVersion` should additionally pin delivery mode, navigation, timing, candidate policy, paper layout/identity rules, allowed tools, and accommodation policy. A candidate or paper packet must never resolve live authoring records after delivery starts.

### 4.2 CBT and paper as capture modes

CBT and paper should share:

- published assessment and delivery identity;
- school, period, subject, class, student and assignment scope;
- candidate eligibility and accommodation policy;
- lifecycle and exception ledger;
- provenance from prompt/question to response/evidence to mark;
- finalization, correction, moderation and canonical-score handoff.

They should differ only in capture and review adapters:

- CBT: response events, autosave, offline reconciliation, server receipt, timer, submission.
- Paper: packet/answer-sheet identity, QR/OMR/scanned pages, image quality/review, manual or assisted mark capture, reconciliation.

Neither adapter may write directly to report-card snapshots. Both must produce a validated, finalized score proposal for the canonical score service.

### 4.3 Immutable delivery contract

Proposed minimum fields, subject to architecture approval:

```text
deliveryVersionId
schoolId
assessmentVersionId
mode: CBT | PAPER | HYBRID
contentHash
structureHash
scoringPolicySnapshot
timingPolicySnapshot
accessibilityPolicySnapshot
paperIdentityPolicySnapshot
resourceManifest
publishedBy / publishedAt
entitlementSnapshot
```

Acceptance boundary: after first candidate access or packet issuance, edits create a new version. They do not mutate the active delivery. Any correction must identify whether it changes content, scoring, timing, or only an operational assignment.

### 4.4 Canonical result handoff

The handoff must include at least:

- canonical student, school, period, subject, class-group and assessment-item identity;
- delivery/attempt or paper-submission provenance;
- item/question version and response/evidence reference;
- machine mark and/or human mark with marking method;
- moderation/finalization decision;
- idempotency key and source event/version;
- actor, timestamp, correction/reason metadata.

The existing REA-00C1 conditional score-write hardening is necessary but not sufficient for this future boundary. Every new writer, including the separate `studio-to-gradebook-service.ts` writer identified in REA-00C1, must be reviewed before it is used by premium delivery.

## 5. Mandatory industry-standard behavior vs differentiation

### Mandatory baseline

These are requirements EduSentrix should treat as non-negotiable engineering behavior, even when the precise implementation is original:

1. Tenant and role authorization at every read/write/provider boundary.
2. Immutable/versioned published content and delivery snapshots.
3. Server-authoritative timing with explicit timezone and accommodation rules.
4. Idempotent autosave, submission, retry, callback, and score handoff.
5. Recoverable network/offline failure behavior and explicit infrastructure failure states.
6. Candidate assignment, identity, attendance, pause, withdrawal, late, blank, and resubmission states.
7. Auditability for operator interventions, marking, moderation, correction, release, and export.
8. Separation of raw evidence, machine scoring, human marking, moderation, finalized score, and released result.
9. Accessibility acceptance testing for keyboard, screen reader, focus, reflow/zoom, contrast, media alternatives, and accommodations.
10. Standards-aware import/export with validation, version/profile declaration, and unsupported-feature handling.
11. No direct premium delivery writes to report-card snapshots or duplicate academic result authority.

### Optional EduSentrix differentiation

These may distinguish EduSentrix after the baseline is reliable:

- Ghana/West African school templates, NaCCA/GES-aligned metadata, and local grading policies.
- A single operator workflow that can reconcile CBT, paper, and Konect evidence without changing the canonical academic result path.
- Low-bandwidth-first delivery with explicit resumability and school-level operational diagnostics.
- Teacher-friendly guided authoring and governed Leo assistance that remains draft-only and reviewable.
- Transparent score provenance visible to authorized school staff without exposing answer keys or unreleased evidence to learners/parents.
- Institution-controlled moderation policies that fit ordinary school committees rather than importing university-scale complexity by default.
- QTI interoperability as an export/import option while preserving a simpler local authoring experience.

## 6. Proposed original engineering requirements and acceptance criteria

These are research outputs, not approved implementation tasks.

### R01A-REQ-01 — Published delivery immutability

**Requirement:** A candidate or paper packet references an immutable delivery version.

**Acceptance criteria:**

- A published delivery has stable content, structure, scoring, timing, accessibility, and paper-policy hashes.
- Author edits cannot change an active delivery.
- Re-publication creates a new version with an audit event and explicit supersession.
- CBT and paper fixtures resolve the same pinned assessment version.

### R01A-REQ-02 — Delivery-mode-neutral provenance

**Requirement:** CBT response evidence and paper/scan evidence converge through one provenance contract.

**Acceptance criteria:**

- Every finalized mark identifies school, student, subject, period, assessment item, delivery version, mode, and source evidence.
- The canonical score service rejects missing or cross-school provenance.
- Duplicate handoff retries do not create duplicate scores or duplicate academic events.

### R01A-REQ-03 — Candidate timing and exception ledger

**Requirement:** Time and interventions are server-authoritative and auditable.

**Acceptance criteria:**

- The effective deadline is reproducible from the stored policy snapshot and event ledger.
- Planned accommodation and incident time are distinguishable.
- Pause, resume, late, blank, withdrawal, resubmission, operator submission, and timeout have explicit legal transitions.
- A failed save/network/provider operation never becomes a learner score of zero.

### R01A-REQ-04 — Durable response/save contract

**Requirement:** Candidate work can be acknowledged, retried, reconciled, and recovered.

**Acceptance criteria:**

- Each save has an idempotency key, sequence/revision, server receipt, and visible client state.
- Out-of-order retries cannot overwrite a newer response.
- Submission is idempotent and preserves the submitted revision.
- Offline or degraded-mode behavior is explicit for each delivery mode and tested with failure injection.

### R01A-REQ-05 — Marking and moderation evidence

**Requirement:** Human and machine scoring remain separately auditable.

**Acceptance criteria:**

- Marker changes append evidence rather than silently overwriting prior marks.
- Moderation records participants, scope, decision, rationale, and reviewed mark version.
- Finalization is blocked when required marking/moderation conditions are incomplete.
- Corrections produce a new event and controlled canonical-score update.

### R01A-REQ-06 — QTI profile boundary

**Requirement:** QTI interoperability is explicit, validated, and bounded.

**Acceptance criteria:**

- Each endpoint declares supported QTI version/profile.
- Invalid packages and unsupported scored constructs fail with actionable diagnostics.
- Imported content retains source hash, importer version, warnings, and mapping decisions.
- Supported fixtures round-trip without score or resource drift.

### R01A-REQ-07 — Accessibility and operator truthfulness

**Requirement:** Candidate and operator paths are accessible and capability truthful.

**Acceptance criteria:**

- Keyboard-only and screen-reader journeys complete the assigned assessment where the mode supports them.
- Focus, status, timing, error, save, and submission announcements are testable.
- Controls unavailable to a role, entitlement, or lifecycle state are absent or honestly disabled.
- Accessibility and accommodation policy is pinned to the delivery and visible to authorized operators.

### R01A-REQ-08 — Core/Assess boundary

**Requirement:** Premium delivery extends, but does not replace, School OS academic truth.

**Acceptance criteria:**

- School OS ordinary mark entry, grading, subject results, report-card approval, release, and historical reads function without Assess Premium.
- Assess expiry does not delete or invalidate finalized Core results.
- Premium handoff uses the canonical assessment score/result services.
- No premium route, job, provider callback, or internal service bypasses tenant/role/entitlement/state checks.

## 7. Open questions and research gaps

1. Which current EduSentrix exam-paper workflows are relied upon as School OS Core behavior, and which may be classified as Assess Premium without breaking existing schools?
2. What is the approved minimal CBT delivery mode for low-bandwidth Ghanaian school environments: online-only, resumable browser, managed offline package, or a staged combination?
3. Which paper identity approach is required first: QR packet identity, answer-sheet anchors, OMR, manual reconciliation, or all three in phases?
4. What exact score contribution semantics connect a premium delivery to an `AssessmentItem` and existing grading policy?
5. Which QTI version/profile should EduSentrix support first, and which QTI constructs are deliberately out of scope?
6. Are there legal or commercial reasons to integrate a separate QTI service rather than implement an independent adapter in TypeScript?
7. What retention, deletion, export, and learner-access rules apply to raw responses, scans, annotations, marking events, moderation notes, and provider receipts?
8. Which accessibility standard and independent audit process will product ownership approve for CBT and operator surfaces?
9. What invigilation evidence is appropriate for schools without proctoring infrastructure, and what must never be represented as proctoring assurance?
10. Which analytics are required for School OS operations versus premium item performance, and what release/role boundaries apply?

### Research gaps

- No authenticated competitor workflow observation or browser/network trace.
- No independent benchmark of concurrency, offline recovery, or autosave durability.
- No formal QTI package validation or round-trip fixture in EduSentrix.
- No license compatibility opinion for TAO/GPL components.
- No inspection of private Inspera or hosted TAO backend architecture.
- No evidence that competitor behavior maps directly to Ghanaian school policy, local connectivity, or EduSentrix's existing academic lifecycle.

## 8. Source inventory

### Local repository sources

- [REA Engineering Protocol](../REA_ENGINEERING_PROTOCOL.md) — research boundary, canonical result rule, evidence classifications, review stop.
- [REA-00A Repository Verification](REA_00A_REPOSITORY_VERIFICATION.md) — current implementation, gaps, route/entitlement findings.
- [REA-00B Capability and Entitlement Architecture](REA_00B_CAPABILITY_ENTITLEMENT_ARCHITECTURE.md) — Core-vs-Assess boundary and proposed capabilities.
- `src/lib/academics/assessment-engine/*` — canonical score/result path, verified in REA-00A.
- `src/lib/examinations/*`, `src/lib/exams/*`, `src/lib/konect/*` — existing authoring, exam operations, and scanner foundations, verified in REA-00A/00C1.

### Primary external sources

Inspera:

- [Inspera Assessment](https://inspera.com/inspera-assessment/)
- [How to create a question](https://support.inspera.com/hc/en-us/articles/360038890492-How-to-create-a-question)
- [How to create a test](https://support.inspera.com/hc/en-us/articles/360029761952-How-to-create-a-test)
- [Candidate progress in Monitor](https://support.inspera.com/hc/en-us/articles/360029788911-Candidate-progress-in-Monitor)
- [Monitor candidates](https://support.inspera.com/hc/en-us/articles/360055366852-Monitor-candidates-during-a-test)
- [Test duration and extra time](https://support.inspera.com/hc/en-us/articles/360041451112-Test-duration-and-extra-time)
- [Open for resubmission](https://support.inspera.com/hc/en-us/articles/360047371951-Open-for-resubmission)
- [Offline submission handling](https://support.inspera.com/hc/en-us/articles/360018405952-How-to-save-submission-as-file-and-upload-offline-submission)
- [Committee Moderator role](https://support.inspera.com/hc/en-us/articles/360019933877-Role-description-Committee-Moderator)
- [Inspera API policy](https://support.inspera.com/hc/en-us/articles/16192624197021-Inspera-API-policy)
- [Text to speech](https://support.inspera.com/hc/en-us/articles/360037981811-Text-to-speech-for-candidate-accessibility)

TAO/standards:

- [TAO official site](https://www.taotesting.com/)
- [TAO products](https://www.taotesting.com/products/)
- [TAO interoperability](https://www.taotesting.com/resources/interoperability/)
- [OAT GitHub organization](https://github.com/oat-sa)
- [TAO core](https://github.com/oat-sa/tao-core)
- [TAO QTI test extension](https://github.com/oat-sa/extension-tao-testqti)
- [TAO QTI SDK](https://github.com/oat-sa/qti-sdk)
- [QTI in TAO](https://github.com/oat-sa/taohub-articles/blob/master/forge/QTI-in-TAO.md)
- [TAO PCI/PIC guidance](https://github.com/oat-sa/taohub-articles/blob/master/forge/QTI/tao-pci-and-pic.md)
- [TAO LTI delivery provider](https://github.com/oat-sa/extension-tao-ltideliveryprovider)
- [1EdTech QTI specification documents](https://www.1edtech.org/standards/qti/index)

## 9. Verification and completion boundary

Documentation-only verification performed after writing:

- `git diff --check` — PASS; no whitespace errors reported.
- No application tests run, per task instruction.
- No application source, dependencies, configuration, database, production system, or competitor environment changed or accessed.

This cycle is complete for independent ChatGPT review. No automatic movement to an implementation phase or another REA cycle is authorized. Recommended next research domain: **CBT/paper shared delivery contract and low-bandwidth resilience**, including a standards/profile decision for QTI import/export and a threat-model/acceptance matrix for timing, autosave, offline recovery, paper identity, and canonical score handoff.
