# Crowdmark Research Dossier

**Research cycle:** REA-R01B  
**Observation date:** 2026-10-15 (Africa/Accra)  
**Evidence boundary:** Public Crowdmark Help Center and public product materials. No authenticated assessment, paid feature, browser session, API, or REA target was used.

## Executive assessment

Crowdmark is a strong reference for collaborative digitization and marking of paper work. Its documented administered-assessment workflow uses QR-coded booklets, question-location setup, page ordering independent of scan order, role-scoped team access, shared comment/rubric libraries, filters, multiple evaluations, primary-evaluation selection, double-blind grading, analytics, and controlled return of grades.

Its strongest lesson for EduSentrix is that script identity, question segmentation, marker collaboration, and student publication can be separate operational concerns. Crowdmark's public documentation does not establish private concurrency or persistence implementation; those must remain unverified.

## Evidence classification

- **Vendor-documented:** Crowdmark Help Center behavior.
- **Vendor-described:** public overview/marketing claims.
- **Inferred:** EduSentrix design implication.
- **Unverified:** private storage, transaction, concurrency, recovery, and performance details.

## 1. Paper digitization and script identity

Crowdmark documents an Administered assessment for in-person paper exams that are scanned into Crowdmark. The assessment template defines the location of each question so the system can separate responses for grading. QR codes keep pages organized even when exam pages are out of order. **Evidence:** vendor-documented. [Creating a QR-coded administered assessment](https://www.crowdmark.com/help/creating-an-administered-assessment/).

Crowdmark also documents paper or remote responses uploaded as PDF, JPG, or PNG, including photos taken with a mobile phone. **Evidence:** vendor-documented. [Introduction to Crowdmark](https://www.crowdmark.com/help/introduction-to-crowdmark/); [Remote assessments](https://www.crowdmark.com/help/remote-assessments/).

The public Help Center distinguishes administered assessments, assigned assessments, scanning/uploading, matching booklets to students, and question-based grading workflows. **Evidence:** vendor-documented. [Crowdmark Help Center](https://www.crowdmark.com/help/).

### Reconstruction

```text
Create administered assessment + question regions
  -> generate/print paper booklets with QR identity
  -> students complete paper
  -> scan/upload pages
  -> QR/order processing and candidate matching
  -> separate pages/responses by question
  -> assign grading team
  -> rubric/comments and annotations
  -> review multiple evaluations / select primary
  -> analytics/export
  -> send grades and marked work to students
```

This is a documented workflow reconstruction, not a claim about Crowdmark's internal data model.

### EduSentrix implications

- A page identity marker can solve out-of-order assembly, but it cannot alone prove candidate identity. Candidate reconciliation must be a separate verified step.
- Store the original page asset, page sequence, QR/packet identity, candidate match decision, and operator correction history.
- Support mobile photo capture as an input while preserving scan-quality diagnostics and review queues.

## 2. Mark-by-question, mark-by-script, and annotations

Crowdmark's public Help Center describes grading by question, section, booklet, status, score, team member, tag, and evaluation count through combinable filters. **Evidence:** vendor-documented. [Filtering responses](https://www.crowdmark.com/help/filtering-evaluations/).

Its public overview describes grouping and grading workflows, question-level responses, tags, filters, multiple evaluations, and comparison of work. **Evidence:** vendor-described/documented in Help Center material. [Crowdmark Help Center](https://www.crowdmark.com/help/).

Crowdmark documents a shared comment library in which comments can carry points and be dragged onto image/PDF or text responses. The library can be imported/exported as CSV and associates comments with question labels and, where applicable, question versions. **Evidence:** vendor-documented. [Using a rubric](https://www.crowdmark.com/help/using-a-rubric-2).

### EduSentrix implications

- Offer both script-oriented navigation and question-oriented queues over the same evidence graph.
- A rubric item should be versioned and associated with the exact question/version; labels alone are insufficient for a multi-version assessment.
- An annotation should identify page/region, actor, timestamp, visibility, points effect, and the marking event to which it belongs.

## 3. Roles, collaboration, and access

Crowdmark documents four roles: Instructor, Facilitator, Grader, and Printer-Uploader. The Grader role can grade and see progress but does not receive identifiable student information or administration access; Printer-Uploader has upload/printing access. Assessment-level access can be limited to selected team members. **Evidence:** vendor-documented. [Team member roles](https://www.crowdmark.com/help/what-is-the-difference-between-team-member-roles/); [Managing team members](https://www.crowdmark.com/help/managing-team-members-in-a-course/).

Crowdmark documents that removing a team member removes access while preserving past grading and data. **Evidence:** vendor-documented. [Managing team members](https://www.crowdmark.com/help/managing-team-members-in-a-course/).

### EduSentrix implications

- Use least-privilege marker roles. A marker should not need candidate identity, school administration, entitlement administration, or report-card access to mark assigned evidence.
- Assignment and assessment-team changes should be audited and should not erase prior marking evidence.
- School scope, class/subject/period scope, and candidate identity must remain server-enforced even when a marker works from an anonymized queue.

## 4. Multiple marking, double-blind review, moderation, and corrections

Crowdmark documents multiple evaluations on one student's work, a primary evaluation selected for student display, and instructor/facilitator ability to clone or override evaluations. It also documents double-blind grading: graders cannot see prior annotations/scoring, while a primary reviewer can inspect evaluations and choose or create the primary evaluation. It warns that certain Ready-to-grade workflows expose covers and do not guarantee anonymity. **Evidence:** vendor-documented. [Double-blind grading](https://www.crowdmark.com/help/double-blind-grading/); [Team member roles](https://www.crowdmark.com/help/what-is-the-difference-between-team-member-roles/).

Crowdmark exposes filters for responses with multiple evaluations and point discrepancies. **Evidence:** vendor-documented. [Filtering responses](https://www.crowdmark.com/help/filtering-evaluations/).

### EduSentrix implications

- Never overwrite a first marker's evaluation when a second marking or moderation step occurs. Store independent evaluations and a controlled primary/final decision.
- Anonymity should be an explicit policy with tests; removing names from one view does not prove that page covers, metadata, or search paths are anonymous.
- Disagreement queues should be first-class: point discrepancy, missing evaluation, outlier rubric use, and moderation-required status.

## 5. Results, feedback, analytics, and publication

Crowdmark documents sending grades to students so they can view marked-up assessments and progress reports. Public Help Center material also describes exportable scores, difficulty/discrimination/distractor analysis, responses by question, downloadable grades, and downloadable graded assessments. **Evidence:** vendor-documented/vendor-described. [Crowdmark Help Center](https://www.crowdmark.com/help/); [Grading process map](https://crowdmark.com/wp-content/uploads/2022/11/Crowdmark-Workflow-Comparison-Crowdmark-Grading-vs-Traditional-Grading.pdf).

The public material reviewed does not establish the exact score-finalization or external gradebook contract. Crowdmark's LMS integration and export descriptions are not proof that a destination system's canonical academic result rules are preserved. **Evidence:** unverified; architecture implication.

### EduSentrix implications

- Publication of marked work should be separate from finalization into School OS academic results.
- Analytics should be derived from authorized, versioned response/mark evidence and must distinguish provisional from finalized results.
- External export should include assessment version, student identity mapping, score scale, maximum score, status, and provenance—not only a number.

## 6. Operational errors and recovery

Public Crowdmark documentation exposes workflows for rearranging a student's submission, submitting on a student's behalf, removing mistaken blank booklets, resolving unknown multiple-choice responses, and reviewing submission issues/errors through Help Center topics and videos. **Evidence:** vendor-documented topic inventory; exact internal recovery semantics remain unverified. [Crowdmark FAQ](https://www.crowdmark.com/help/frequently-asked-support-questions/); [Grading videos](https://crowdmark.com/help/video-how-to-grading/).

The QR page-order behavior reduces one class of physical handling error, but the public material does not prove complete missing-page detection, image-quality thresholds, or automatic candidate-match correctness. **Evidence:** partially documented; remaining behavior unverified.

### EduSentrix implications

- Add explicit states for incomplete packet, unmatched candidate, duplicate page, missing page, wrong assessment version, unreadable image, and operator-corrected identity.
- Recovery must preserve the original asset and record the correction; re-uploading should be idempotent and linked to the prior failure.
- Do not finalize or hand off scores while required pages or question regions remain unresolved.

## 7. Limitations

- No live Crowdmark assessment or marking team was used.
- No proprietary concurrency/persistence behavior is claimed.
- Public workflows are primarily higher-education oriented; Ghanaian school operational fit is a hypothesis requiring pilot observation.
- Public help content does not establish service-level, retention, backup, or security guarantees.
- Exact differences among administered, assigned, and ready-to-grade workflows require hands-on verification before copying terminology or lifecycle rules.

## Source inventory

All sources were reviewed on 2026-10-15:

1. [Crowdmark Help Center](https://www.crowdmark.com/help/) — product workflow, roles, analytics, publication and collaboration overview.
2. [Creating a QR-coded administered assessment](https://www.crowdmark.com/help/creating-an-administered-assessment/) — QR identity, question regions, out-of-order pages.
3. [Introduction to Crowdmark](https://www.crowdmark.com/help/introduction-to-crowdmark/) — paper/mobile upload formats.
4. [Remote assessments](https://www.crowdmark.com/help/remote-assessments/) — paper/photo/PDF completion modes.
5. [Using a rubric](https://www.crowdmark.com/help/using-a-rubric-2) — shared comments, points, CSV and question versions.
6. [Team member roles](https://www.crowdmark.com/help/what-is-the-difference-between-team-member-roles/) — permissions and anonymity limits.
7. [Managing team members](https://www.crowdmark.com/help/managing-team-members-in-a-course/) — team access and preservation of past data.
8. [Double-blind grading](https://www.crowdmark.com/help/double-blind-grading/) — multiple evaluations and primary selection.
9. [Filtering responses](https://www.crowdmark.com/help/filtering-evaluations/) — progress, discrepancy and question/team filters.
10. [Frequently asked questions](https://www.crowdmark.com/help/frequently-asked-support-questions/) — recovery and result workflow topics.
11. [Grading process map](https://crowdmark.com/wp-content/uploads/2022/11/Crowdmark-Workflow-Comparison-Crowdmark-Grading-vs-Traditional-Grading.pdf) — public workflow and analytics overview.

