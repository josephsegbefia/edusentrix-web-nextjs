# Gradescope Research Dossier

**Research cycle:** REA-R01B  
**Observation date:** 2026-10-15 (Africa/Accra)  
**Evidence boundary:** Public Gradescope Guides/Help Center and public Gradescope product pages. No authenticated course, paid feature, API, browser session, or REA target was used.

## Executive assessment

Gradescope's paper workflow turns scanned pages into question-level grading work. The documented flow uses a template/assignment outline, scan upload, automatic or assisted submission splitting, student matching, question grouping, rubric marking, regrade requests, grade publication, exports, and assignment statistics. Its strongest lesson for EduSentrix is not a proprietary algorithm; it is the operational decomposition of a physical script into reviewable question evidence and controlled grading state.

## Evidence classification

- **Vendor-documented:** Gradescope Guides/Help Center behavior.
- **Vendor-claimed:** product or feature availability statements, especially license-dependent or AI-related features.
- **Inferred:** EduSentrix requirement derived from documented workflow.
- **Unverified:** private persistence, recognition algorithms, concurrency, retention, and service-level behavior not exposed publicly.

## 1. Paper creation, identity, scanning, and page handling

Gradescope documents an instructor-uploaded scan workflow in which a template PDF is used to help create submissions. Uploaded PDFs can contain multiple students; the system attempts to split them into submissions, and the operator can inspect uncertain pages, reorder, split, merge, delete, and rotate pages. **Evidence:** vendor-documented. [Managing scans for exam/quiz assignments](https://guides.gradescope.com/hc/en-us/articles/23589009565709-Managing-Scans-for-Exam-Quiz-Assignments).

The same guide documents labeled printouts as a beta workflow. Each printed page receives a unique label, allowing pages to be regrouped even when scanned or uploaded out of order. It warns operators to protect the label/QR area when removing staples from multi-page or double-sided printouts. **Evidence:** vendor-documented and feature/version bounded. [Creating labeled printouts](https://guides.gradescope.com/hc/en-us/articles/23589009565709-Managing-Scans-for-Exam-Quiz-Assignments).

The public getting-started material describes scanning exams, uploading scans, associating submissions with students, and reviewing/publishing grades. **Evidence:** vendor-documented. [Gradescope getting started](https://www.gradescope.com/get_started).

### Reconstruction

```text
Create assignment + blank template/outline
  -> print and administer paper
  -> scan one or many PDFs
  -> auto-split or operator split/merge/reorder/rotate
  -> assign submission to student
  -> group by question or grade individually
  -> rubric marking and annotations
  -> review/regrade
  -> publish/export
```

This is a documented workflow reconstruction, not a claim about Gradescope's database model.

### EduSentrix implications

- Keep raw uploaded pages immutable; represent operator rotation, split, merge, deletion, and assignment as auditable transformations.
- Do not accept “auto-split complete” as proof of correct identity. Require an operator-visible review state for uncertain or structurally inconsistent pages.
- A QR/page label or equivalent paper identity should be independently verifiable against school, assessment version, packet, candidate, and page sequence.

## 2. Question-level grouping and marking

Gradescope documents answer grouping for supported assignment types, including manually grouped, multiple choice, math fill-in-the-blank, and text fill-in-the-blank. It describes reviewing proposed groups, removing exceptions, merging groups, navigating with keyboard controls, and reprocessing when new submissions arrive. **Evidence:** vendor-documented. [Gradescope Help Center](https://www.gradescope.com/help).

The documented workflow also supports grading each submission individually when grouping is not appropriate. **Evidence:** vendor-documented. [Gradescope Help Center](https://www.gradescope.com/help).

Gradescope documents rubrics, comments, annotations, question-level grading, student-visible rubric controls, graded-copy PDF export, and regrade requests. **Evidence:** vendor-documented. [Reviewing grades](https://guides.gradescope.com/hc/en-us/articles/22067099093517-Reviewing-Grades); [Markdown for assignments](https://guides.gradescope.com/hc/en-us/articles/23220012178573-Using-Markdown-for-Assignments).

### EduSentrix implications

- Make question grouping a reviewable recognition aid, never an unreviewed mark source.
- Allow both mark-by-question and mark-by-script, with a stable question/response evidence identity.
- Rubric application should append a marking event that records rubric version, item, points, annotation, actor, and timestamp.
- Regrading must recalculate from a declared rubric/content version and produce a correction event; it must not silently mutate a previously finalized score.

## 3. Bubble-sheet/objective grading

Gradescope documents a Bubble Sheet assignment type with a predefined answer key, scan processing, student matching, uncertain-mark review, grade publication, export, item analysis, and statistics. Availability is described as dependent on institutional or Gradescope Complete licensing. **Evidence:** vendor-documented and license-dependent. [Gradescope Help Center — Bubble Sheets](https://www.gradescope.com/help); [Bubble Sheet assignments](https://guides.gradescope.com/hc/en-us/sections/27893669397005-Bubble-Sheet-Assignments).

The public help content describes a 200-question template, mark areas, and review of uncertain marks. It also distinguishes bubble-sheet workflows from ordinary scanned written work. **Evidence:** vendor-documented. [Gradescope Help Center](https://www.gradescope.com/help).

### EduSentrix implications

- OMR answers need a confidence/ambiguity status, not only a boolean selected/unselected value.
- Multiple marks, blank answers, damaged regions, wrong form/version, and low-confidence recognition must be review queues.
- Objective recognition must retain the original image region and recognition decision before score finalization.

## 4. Collaboration, regrading, publication, and feedback

Gradescope's public review guide documents a review page with grading completeness, histogram/statistics, exports, grade publication/unpublication, email notification, student viewing status, and rubric visibility controls. Only assigned and fully graded submissions are visible to students after publication. **Evidence:** vendor-documented. [Reviewing grades](https://guides.gradescope.com/hc/en-us/articles/22067099093517-Reviewing-Grades).

The same guide documents regrading a question and student regrade requests. Regrade behavior is therefore a first-class workflow rather than an informal score edit. **Evidence:** vendor-documented. [Reviewing grades](https://guides.gradescope.com/hc/en-us/articles/22067099093517-Reviewing-Grades).

### EduSentrix implications

- Separate marked, reviewed, finalized, released, and regrade-requested states.
- Student feedback publication must be controlled independently from internal marking visibility and answer-key visibility.
- Regrade requests should identify the exact question and evidence, route to an authorized reviewer, and preserve both the original and corrected result.

## 5. Limitations and unverified areas

- Public material does not establish how Gradescope detects missing pages, beyond showing uncertainty and allowing operator correction when splitting fails.
- Public material does not establish whether physical pages carry a candidate identity on every workflow; labeled printouts provide one documented option, while other workflows rely on assignment/template/operator matching.
- The public content reviewed does not establish marker concurrency semantics, immutable event storage, backup/recovery guarantees, or API contracts.
- Product availability is license-dependent for some features; a public guide is not proof of EduSentrix-equivalent commercial access.
- No Gradescope mobile scan, live account, or provider integration was tested.

## Source inventory

All sources were reviewed on 2026-10-15:

1. [Gradescope Help Center](https://www.gradescope.com/help) — bubble sheets, grouping, grading, rubrics, publication, regrades, statistics.
2. [Gradescope getting started](https://www.gradescope.com/get_started) — end-to-end assignment workflow.
3. [Managing scans](https://guides.gradescope.com/hc/en-us/articles/23589009565709-Managing-Scans-for-Exam-Quiz-Assignments) — upload, splitting, reordering, merging, rotation, labeled printouts.
4. [Reviewing grades](https://guides.gradescope.com/hc/en-us/articles/22067099093517-Reviewing-Grades) — review, regrade, publication, exports, feedback visibility.
5. [Markdown for assignments](https://guides.gradescope.com/hc/en-us/articles/23220012178573-Using-Markdown-for-Assignments) — rubric/comment/annotation formatting.
6. [Bubble Sheet assignment guides](https://guides.gradescope.com/hc/en-us/sections/27893669397005-Bubble-Sheet-Assignments) — bubble-sheet workflow entry point.

