# EduSentrix Assess — REA-R01B Paper Marking and OMR Synthesis

**Scope:** Gradescope, Crowdmark, and ZipGrade  
**Observation date:** 2026-10-15 (Africa/Accra)  
**Repository:** `edusentrix-web-nextjs`  
**Branch:** `feat/assess-rea-foundation`  
**Research mode:** Public documentation and product-material research only  
**Status:** Complete for independent ChatGPT review; no implementation authorized

## Executive conclusion

The three reference products cover different layers of physical assessment processing:

- Gradescope is a question-level digital marking workflow for scanned assignments, with template matching, page splitting/rotation, answer grouping, rubrics, regrades, publication, and analytics.
- Crowdmark is a collaborative script digitization and marking workflow, with QR-coded administered booklets, question-region separation, shared rubrics/comments, role-scoped teams, multiple evaluations, double-blind marking, primary evaluation selection, and controlled feedback publication.
- ZipGrade is a focused mobile OMR workflow optimized for inexpensive paper/camera operation, answer keys, form alignment, recognition correction, offline scanning, and item analysis.

EduSentrix should not choose one of these as its whole model. It should combine their useful operational patterns around one immutable paper-delivery contract and one canonical School OS result engine. Raw scans, page assembly, recognized answers, human marks, moderation decisions, and finalized academic scores must remain distinct layers with explicit handoffs.

## Evidence boundary and method

Sources were reviewed on 2026-10-15. Evidence came from official Gradescope Guides/Help Center pages, Crowdmark Help Center pages and public workflow material, and ZipGrade's official website/Support Center. No competitor account, live scan, mobile device workflow, paid feature, API, source installation, REA target, or production operation was used.

Claims are labeled in the dossiers as vendor-documented, vendor-claimed, inferred, or unverified. Public workflow documentation supports operational requirements; it does not reveal proprietary database schemas, transaction boundaries, recognition algorithms, concurrency semantics, retention guarantees, or service levels.

## 1. Comparative benchmark

| Dimension | Gradescope | Crowdmark | ZipGrade | EduSentrix implication |
|---|---|---|---|---|
| Primary job | Digitally mark scanned exams/assignments by question | Digitize and collaboratively mark paper booklets | Camera/PDF OMR grading | Support handwritten scripts and objective sheets as separate capture adapters |
| Paper identity | Template matching; optional labeled printouts with page labels | QR-coded administered booklets and question locations | Selected form identity, corner markers, optional student ID | Pin school, assessment, delivery, packet, form, candidate and page identity |
| Page handling | Auto-split plus inspect, reorder, split, merge, delete, rotate | QR keeps pages organized out of order; exact missing-page behavior unverified | One answer sheet per page for PDF; form geometry required | Preserve raw pages and explicit assembly/reconciliation states |
| Candidate matching | Assignment/submission association; operator review when uncertain | Booklet/candidate workflow; role-specific matching | Student IDs/records, class and quiz relationships; can operate without records | Never let an unverified ID become academic identity |
| Question segmentation | Template/question outline and answer grouping | Define question locations; responses by question | Fixed answer-sheet bubbles/questions | Stable question-region manifest pinned to delivery version |
| Objective recognition | Bubble Sheet assignments and uncertain-mark review | Multiple choice workflows and unknown-response resolution | OMR answer key, mark correction, alternate keys and scoring | Store recognition result, confidence/status, image region and correction event |
| Handwritten marking | Rubrics, annotations, question grouping and individual grading | Image/PDF marking, comments, points, annotations, script/question filters | Not a general handwritten marking system | Add mark-by-question and mark-by-script over one evidence graph |
| Collaboration | Rubric/regrade/publication workflows; exact concurrency unverified | Roles, assigned teams, multiple evaluations, double-blind and primary evaluation | Mostly teacher/operator workflow | Least-privilege marker assignment and immutable evaluations |
| Moderation | Regrades and publication controls; formal moderation not established in reviewed docs | Multiple evaluations and primary selection; explicit double-blind workflow | Recognition review, not formal moderation | Separate second marking, moderation, correction, finalization |
| Feedback | Rubric visibility, comments, graded PDF, regrade requests | Marked-up assessments, comments, progress reports | Review papers and quiz results | Release feedback independently from canonical report-card release |
| Analytics | Assignment statistics and bubble-sheet item analysis | Question responses, difficulty/discrimination/distractor views | Item analysis and class/result filters | Derive analytics from authorized evidence and label provisional/final |
| Field constraints | Scan PDF and page-processing workflow; public docs do not establish camera conditions | Mobile photo/PDF inputs; quality thresholds unverified | Detailed lighting, focus, paper, geometry, PPI and sync guidance | Design for low-bandwidth, low-cost Android, ordinary printers, and reviewable failure |

Detailed evidence is in [GRADESCOPE_RESEARCH_DOSSIER.md](../competitors/GRADESCOPE_RESEARCH_DOSSIER.md), [CROWDMARK_RESEARCH_DOSSIER.md](../competitors/CROWDMARK_RESEARCH_DOSSIER.md), and [ZIPGRADE_RESEARCH_DOSSIER.md](../competitors/ZIPGRADE_RESEARCH_DOSSIER.md).

## 2. Reconstructed cross-product workflow

The following is an EduSentrix-neutral reconstruction of documented physical-assessment workflows:

```text
Assessment authoring
  -> publish immutable paper/delivery version
  -> generate template, packet, answer sheet or booklet identity
  -> print and administer
  -> collect pages/sheets
  -> capture scan/photo/PDF
  -> validate form, page, packet and candidate identity
  -> assemble multi-page script or isolate answer sheet
  -> segment by question/region
  -> recognize objective marks and/or present evidence for human marking
  -> mark with rubric/annotations
  -> second mark/moderate/reconcile discrepancies
  -> finalize evidence and score
  -> hand off to canonical AssessmentScore/SubjectResult
  -> approve/release School OS results and feedback
```

This is a proposed EduSentrix workflow informed by public product documentation. It is not a claim that any competitor implements these exact states or data structures.

## 3. EduSentrix repository comparison

REA-00A established that EduSentrix already has:

- school-scoped exam paper/question authoring, review and PDF foundations;
- reusable question-bank services;
- exam sessions, scheduling, conflicts, publishing, invigilator assignment and operations;
- canonical assessment score, subject-result, report-card approval/release, and historical snapshot paths;
- Konect script submission, page initialization, private storage, finalization, cancellation, expiry and ownership foundations;
- REA-00C1 hardening for operation-owned asset retirement and presign-failure reconciliation.

REA-00A also found no focused implementation for:

- complete paper packet/answer-sheet identity and candidate reconciliation;
- OMR recognition and confidence/review handling;
- multi-page digital script assembly with missing/duplicate/wrong-page controls;
- question-level digital marking and immutable marker/moderation evidence;
- a full second-marking/moderation ledger;
- a CBT or paper delivery-mode-neutral finalization adapter.

These are repository findings, not competitor claims. Existing REA-00A/00B and REA-00C1 reports remain the source of truth for the current checkout.

## 4. Recommended architecture decisions

### Decision A — one immutable paper delivery version

**Recommendation:** Create an approved architecture boundary for an immutable published paper delivery version, without implementing it in this research cycle.

It should pin assessment/question versions, section/question order, maximum marks, answer regions, paper form/layout, QR/packet identity policy, student-ID policy, scoring policy, and resource/content hashes. Printed packets and answer sheets must reference this version. Author edits create a new version; they do not mutate issued paper.

**Evidence basis:** Gradescope templates/labeled printouts; Crowdmark QR-coded administered assessments and question locations; ZipGrade form selection and geometry requirements. **Classification:** evidence-backed recommendation.

### Decision B — separate capture modes, shared result handoff

**Recommendation:** Model handwritten script capture, OMR capture, and future CBT as adapters over the same published assessment and canonical result boundary.

```text
Published AssessmentVersion + DeliveryVersion
       |                         |
       |                         +--> Paper script/OMR capture
       +--> CBT delivery         +--> scan/recognition/mark evidence
       |                         |
       +-------------------------+--> finalization adapter
                                      -> AssessmentScore
                                      -> SubjectResult
                                      -> report-card lifecycle
```

The adapters may have different evidence and review states. They must not create separate grade engines or write directly to report-card snapshots.

### Decision C — evidence layers are not interchangeable

Recommended conceptual layers:

1. `RawCapture` — original scan/photo/PDF and immutable metadata.
2. `PageArtifact` — page identity, orientation, quality and assembly relationship.
3. `RecognitionResult` — detected form, candidate ID, bubble marks, confidence/status and algorithm version.
4. `MarkingEvaluation` — human/machine mark, rubric version, annotation, actor and timestamp.
5. `ModerationDecision` — second mark, discrepancy resolution, rationale and selected/final evaluation.
6. `FinalizedScoreProposal` — validated contribution to a canonical assessment item.
7. `AssessmentScore`/`SubjectResult` — School OS academic truth and downstream release lifecycle.

This is an EduSentrix proposal. It is deliberately compatible with the existing canonical result architecture and with REA-R01A's immutable delivery recommendation.

### Decision D — confidence and ambiguity are first-class

**Recommendation:** No recognition result should be silently treated as correct or wrong when it is blank, multi-marked, low-confidence, unreadable, wrong-form, or identity-ambiguous.

Every unresolved state should route to an authorized review queue, preserve the original image region, and require an explicit disposition before finalization.

### Decision E — mobile-first does not mean mobile-only

**Recommendation:** Support camera capture for low-cost field operations, but also support sheet-fed PDF/batch ingestion and manual review. Preserve a durable local queue and server reconciliation path.

**Evidence basis:** ZipGrade's mobile/PDF paths and sync guidance; Crowdmark's PDF/JPG/PNG/mobile-photo inputs. **Classification:** evidence-backed recommendation; Ghana-specific fit remains a pilot hypothesis.

## 5. Proposed acceptance criteria

These are original EduSentrix requirements, not claims about competitor implementation.

### R01B-REQ-01 — Paper identity and candidate reconciliation

- Every printed packet/sheet identifies the delivery version and packet/page identity.
- Candidate matching requires a validated school-scoped student or an explicit unresolved state.
- Wrong form, wrong assessment, duplicate identity, unknown ID, and cross-school ID are rejected or quarantined.
- Operator correction records old identity, new identity, actor, reason and timestamp.
- No unverified identity can produce a finalized canonical score.

### R01B-REQ-02 — Multi-page script assembly

- Pages can be received out of order and assembled deterministically.
- Missing, duplicate, extra, rotated, wrong-version and unreadable pages are explicit statuses.
- Original page assets remain immutable; transformations reference the source.
- Assembly completion is blocked until required pages/questions are resolved or an authorized exception is recorded.
- Replays and retries are idempotent by packet/page/capture identity.

### R01B-REQ-03 — Image quality and scan acceptance

- Capture records image dimensions, orientation, form/marker detection, quality diagnostics and processing version where available.
- Glare, blur, crop, skew, low contrast, damaged marker geometry and altered scale produce actionable review outcomes.
- Mobile and PDF ingestion expose per-page failures and preserve failed assets for retry.
- Acceptance thresholds are validated against representative Ghanaian printers, paper, lighting and Android devices before rollout.

### R01B-REQ-04 — OMR recognition and confidence handling

- Recognition distinguishes blank, single mark, multiple mark, ambiguous, unreadable and operator-corrected states.
- Each recognized answer retains the source image region, recognition version, confidence/status and answer-key version.
- Ambiguous or low-confidence responses require explicit review before finalization.
- Answer-key changes create a regrade/correction event and never rewrite raw recognition evidence.

### R01B-REQ-05 — Digital marking evidence

- Human and machine evaluations are append-only logical evidence, not silent overwrites.
- Each mark records question/version, points, rubric version, annotation region, actor, time, and source capture.
- Mark-by-question and mark-by-script views resolve to the same evidence identity.
- Autosave/retry or concurrent editor behavior cannot lose or duplicate a marking event.

### R01B-REQ-06 — Rubric versioning

- A rubric is immutable once used for a finalized evaluation.
- Rubric edits create a new version and identify affected questions/deliveries.
- Regrade operations identify rubric version, scope, actor, reason and resulting score delta.
- Student-visible rubric/feedback policy is separate from internal marker notes and answer keys.

### R01B-REQ-07 — Marker assignment and collaboration

- Marker access is limited by school, assessment, question/section assignment and role.
- An anonymized marker queue does not expose candidate identity, cover pages or unrelated metadata.
- Assignment changes preserve prior evaluations and audit history.
- The system exposes ungraded, multiple-evaluation, discrepancy, exception and moderation-required queues.

### R01B-REQ-08 — Second marking and moderation

- Second evaluations are stored independently from first evaluations.
- Double-blind mode hides prior marks/annotations where configured and proves the policy through access tests.
- A primary/final evaluation decision records reviewer, rationale and selected version.
- Moderation cannot delete or mutate original evidence.

### R01B-REQ-09 — Correction and finalization

- Recognition corrections, mark corrections, rubric regrades and identity corrections are distinct event types.
- Finalization requires required pages, identity, recognition review, marking, moderation and score validation to be complete.
- A finalized score handoff is idempotent, school-scoped and conditional on the current unlocked canonical score state.
- Corrected results create a new audit event and controlled canonical update; released snapshots follow existing School OS approval/release rules.

### R01B-REQ-10 — Konect/private storage and recovery

- `assess_script_page` assets remain private and school/submission scoped.
- Capture failures, provider failures and reconciliation failures are visible and retryable without leaving misleading pending state.
- Every page operation is idempotent and operation-scoped; one failed operation cannot retire sibling assets.
- Recovery preserves raw evidence and records operator/provider outcomes.

## 6. Mandatory baseline versus differentiation

### Mandatory baseline

- school/role/entitlement authorization at every read/write/provider boundary;
- immutable paper/delivery versioning;
- deterministic packet/page/candidate identity and reconciliation;
- raw evidence retention and explicit page/recognition quality states;
- question-level marking provenance and rubric versioning;
- independent second marking/moderation evidence;
- idempotent retries and recovery;
- canonical `AssessmentScore`/`SubjectResult` handoff;
- controlled publication and release;
- accessibility, privacy, retention and audit controls;
- no direct writes to report-card snapshots from capture or marking adapters.

### Differentiation hypotheses requiring pilots

- Android-first school scanning with a durable offline queue.
- Support for ordinary Ghanaian copier paper and low-cost printers without expensive specialist scanners.
- Guided class/grade/student reconciliation aligned to existing EduSentrix school records.
- NaCCA/GES-aligned subject/grade metadata and examination templates.
- Transparent “why this page/mark needs review” explanations for teachers.
- Batch scan rescue tools that reduce repeated trips to a central scanner.
- One workflow for paper, OMR and future CBT evidence without manual score re-entry.

These are product hypotheses, not established market facts. Validate them with pilot schools and representative devices/paper before committing to implementation.

## 7. Unresolved questions and live-observation needs

1. What physical answer-sheet format best fits Ghanaian primary, JHS and SHS exams: fixed OMR, mixed answer/working pages, QR booklet, or a hybrid?
2. Which candidate identity is reliable in practice: preassigned packet, student index, numeric ID, QR roster label, or invigilator reconciliation?
3. What are acceptable image-quality thresholds across local paper stock, copier scaling, lighting, phone cameras and PDF scanners?
4. How should an operator handle an absent student, swapped booklet, partially completed script, missing page, duplicate page, or damaged answer sheet?
5. Does the product need true question-level blind marking, or is script-level marking sufficient for early school workflows?
6. Which subjects require rubric/handwritten marking first, and which can start with objective OMR?
7. What second-marking policy is required by school governance: random sample, discrepancy threshold, all scripts, or moderator-selected cases?
8. How should student/parent feedback distinguish scan image, recognized answer, marker annotation, provisional score and released result?
9. What is the retention/deletion policy for original scans, failed captures, correction evidence and exported graded scripts?
10. Should QTI import/export cover paper forms and marking metadata, or only portable item/test content?
11. What legal/privacy requirements apply to student script images, device-local queues, provider storage and cross-border processing?
12. Which current `studio-to-gradebook-service.ts` score writer and other ingress paths must be hardened before a paper finalization adapter can rely on the canonical engine?

### Required permitted demonstrations before implementation

- Gradescope: upload a deliberately out-of-order, rotated, missing and extra-page batch; observe split confidence, correction history, identity matching and regrade effects.
- Crowdmark: create a QR booklet, scan pages out of order, assign two blind graders, create a discrepancy, select primary evaluation, and inspect export/publication behavior.
- ZipGrade: scan correct, blank, multi-mark, faint-pencil, glare, wrong-form, rotated and scaled sheets on representative Android devices; inspect local queue, retry, correction, sync and exports.

These demonstrations require authorized access and should not be attempted without permission.

## 8. Research limitations

- No live competitor environments, accounts, devices, or scans were used.
- No proprietary implementation, database model, API contract, performance metric, concurrency guarantee, recognition algorithm, or security control is claimed.
- Several features are license-, plan-, beta-, or workflow-dependent; public help pages do not establish availability for every account.
- Crowdmark and Gradescope documentation is largely higher-education-oriented; ZipGrade is objective/OMR-focused. Ghanaian school fit remains unverified.
- The proposed requirements are original EduSentrix architecture intelligence and require product-owner approval before becoming engineering scope.

## 9. Source inventory

### Local sources

- [REA Engineering Protocol](../REA_ENGINEERING_PROTOCOL.md)
- [REA-00A Repository Verification](REA_00A_REPOSITORY_VERIFICATION.md)
- [REA-00B Capability and Entitlement Architecture](REA_00B_CAPABILITY_ENTITLEMENT_ARCHITECTURE.md)
- [REA-00C1 Foundation Reliability Report](REA_00C1_FOUNDATION_RELIABILITY_REPORT.md)
- [REA-R01A Competitive Synthesis](REA_R01A_COMPETITIVE_SYNTHESIS.md)
- `src/lib/academics/assessment-engine/*`, `src/lib/examinations/*`, `src/lib/exams/*`, and `src/lib/konect/*` as identified by REA-00A/00C1.

### Gradescope

- [Gradescope Help Center](https://www.gradescope.com/help)
- [Gradescope getting started](https://www.gradescope.com/get_started)
- [Managing scans](https://guides.gradescope.com/hc/en-us/articles/23589009565709-Managing-Scans-for-Exam-Quiz-Assignments)
- [Reviewing grades](https://guides.gradescope.com/hc/en-us/articles/22067099093517-Reviewing-Grades)
- [Markdown for assignments](https://guides.gradescope.com/hc/en-us/articles/23220012178573-Using-Markdown-for-Assignments)
- [Bubble Sheet assignment guides](https://guides.gradescope.com/hc/en-us/sections/27893669397005-Bubble-Sheet-Assignments)

### Crowdmark

- [Crowdmark Help Center](https://www.crowdmark.com/help/)
- [Creating a QR-coded administered assessment](https://www.crowdmark.com/help/creating-an-administered-assessment/)
- [Introduction to Crowdmark](https://www.crowdmark.com/help/introduction-to-crowdmark/)
- [Using a rubric](https://www.crowdmark.com/help/using-a-rubric-2)
- [Team member roles](https://www.crowdmark.com/help/what-is-the-difference-between-team-member-roles/)
- [Managing team members](https://www.crowdmark.com/help/managing-team-members-in-a-course/)
- [Double-blind grading](https://www.crowdmark.com/help/double-blind-grading/)
- [Filtering responses](https://www.crowdmark.com/help/filtering-evaluations/)
- [Frequently asked questions](https://www.crowdmark.com/help/frequently-asked-support-questions/)

### ZipGrade

- [ZipGrade product page](https://www.zipgrade.com/)
- [Answer sheet forms](https://cloud.zipgrade.com/forms/)
- [How to get started](https://support.zipgrade.com/hc/en-us/articles/201168729-How-do-I-get-started-with-ZipGrade)
- [Answer sheet recognition troubleshooting](https://support.zipgrade.com/hc/en-us/articles/201493965-ZipGrade-isn-t-recognizing-an-answer-sheet-It-won-t-scan)
- [Lighting conditions](https://support.zipgrade.com/hc/en-us/articles/203172225-What-lighting-conditions-work-best)
- [Pen, pencil, marker](https://support.zipgrade.com/hc/en-us/articles/201168769-Can-ZipGrade-read-pen-pencil-marker)
- [Import students from CSV](https://support.zipgrade.com/hc/en-us/articles/201171309-How-do-I-import-a-CSV-file-of-students)
- [Connecting classes to a quiz](https://support.zipgrade.com/hc/en-us/articles/205545969-How-do-I-connect-multiple-classes-to-a-quiz-and-view-just-one)
- [Grading PDF files](https://support.zipgrade.com/hc/en-us/articles/37328081315981-Can-I-use-ZipGrade-without-a-mobile-device-Can-I-use-a-computer-to-grade-papers)
- [CSV answer-key import](https://support.zipgrade.com/hc/en-us/articles/37271000797453-CSV-Answer-Key-Import-File-Requirements-and-Options)
- [Gray/white scanning and sync](https://support.zipgrade.com/hc/en-us/articles/202354275-Why-am-I-getting-a-gray-or-white-image-when-trying-to-scan)

## 10. Verification and completion boundary

- Source URLs were checked against the corresponding claims during research and are preserved in each dossier.
- Product/version boundaries and unverified private behavior are explicitly labeled.
- `git diff --check` is required after document creation.
- No application tests are required or run for this documentation-only cycle.
- No application code, dependencies, configuration, subscriptions, database, production system, or competitor environment was changed or accessed.

REA-R01B stops here for independent ChatGPT review. Do not automatically begin REA-R01C or REA-R02.

