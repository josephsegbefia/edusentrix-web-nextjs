# ZipGrade Research Dossier

**Research cycle:** REA-R01B  
**Observation date:** 2026-10-15 (Africa/Accra)  
**Evidence boundary:** Public ZipGrade website and Support Center documentation. No ZipGrade account, device app, paid feature, camera scan, or REA target was used.

## Executive assessment

ZipGrade is a focused, low-cost OMR workflow: select or create a form, print it, define an answer key, scan with a mobile camera or upload a sheet-fed PDF, review papers, correct recognition, and inspect/export results. Its public support material is unusually useful for operational constraints: expected form identity, four-corner alignment, paper quality, lighting/glare, camera focus, mark style, sheet strictness, scan resolution, file size, and pending synchronization.

ZipGrade is therefore a strong reference for Ghanaian school affordability and field conditions, but not a complete model for handwritten multi-page script marking, rubric moderation, or canonical academic result governance.

## Evidence classification

- **Vendor-documented:** ZipGrade Support Center instructions and troubleshooting.
- **Vendor-claimed:** public product positioning.
- **Inferred:** EduSentrix requirement derived from documented constraints.
- **Unverified:** recognition algorithm, confidence calculation, private sync/storage, concurrency, and recovery internals.

## 1. Forms, printing, and answer-sheet identity

ZipGrade provides standard 20-, 50-, and 100-question answer sheets and a custom answer-sheet wizard. Its public forms page documents student-ID capacity for the larger standard forms, form variants, and the requirement that the quiz be configured with the same form the physical paper uses. It recommends standard white copier paper. **Evidence:** vendor-documented. [ZipGrade answer sheet forms](https://cloud.zipgrade.com/forms/).

ZipGrade's getting-started guide requires printing the answer sheet, creating a quiz with the selected form, defining/scanning an answer key, and scanning papers by aligning the four corner squares in the camera view. **Evidence:** vendor-documented. [How to get started](https://support.zipgrade.com/hc/en-us/articles/201168729-How-do-I-get-started-with-ZipGrade).

Custom forms carry a form name/number; the troubleshooting guide states that using the wrong selected form is a common reason a paper is not recognized. **Evidence:** vendor-documented. [Answer sheet recognition troubleshooting](https://support.zipgrade.com/hc/en-us/articles/201493965-ZipGrade-isn-t-recognizing-an-answer-sheet-It-won-t-scan).

### EduSentrix implications

- Paper packets need a stable assessment/delivery/form version identity, and the scanner must reject or quarantine a wrong form rather than guess.
- Print profiles should record paper size, scale, form version, marker geometry, student-ID layout, and supported printer/scanner conditions.
- Student identity must be independently reconciled to the School OS student record; a handwritten or bubbled ID is an input requiring validation, not authority by itself.

## 2. Camera scanning and environment constraints

ZipGrade documents camera scanning using corner alignment and gives live recognition messages such as autofocus, bright light, form verification, and hold-paper-flat conditions. **Evidence:** vendor-documented. [Answer sheet recognition troubleshooting](https://support.zipgrade.com/hc/en-us/articles/201493965-ZipGrade-isn-t-recognizing-an-answer-sheet-It-won-t-scan).

ZipGrade states that diffused/reflected light is preferable and direct light can cause glare that makes graphite marks appear white; the app may warn about glare, but captured conditions affect accuracy. **Evidence:** vendor-documented. [Lighting conditions](https://support.zipgrade.com/hc/en-us/articles/203172225-What-lighting-conditions-work-best).

ZipGrade documents camera-lens cleanliness, image sharpness settings, sheet strictness, internal black-square geometry, and the risk that altered/copied forms may not be recognized. **Evidence:** vendor-documented. [Answer sheet recognition troubleshooting](https://support.zipgrade.com/hc/en-us/articles/201493965-ZipGrade-isn-t-recognizing-an-answer-sheet-It-won-t-scan).

### EduSentrix implications

- Scanning must expose quality diagnostics and a retry path rather than return a silent score.
- Store the original image, device/app metadata available under the approved privacy policy, recognition diagnostics, and operator disposition.
- A mobile-first workflow should optimize for low-cost Android hardware, variable lighting, and ordinary school desks without claiming that all conditions are safe for unattended scoring.

## 3. Marks, blanks, multiple marks, and correction

ZipGrade instructs students to fill circles fully with minimal stray marks and documents support for pen and pencil. Its support material allows a teacher to edit recognized answers in Review Papers, including overriding which bubbles count as dark; the paper is then regraded. **Evidence:** vendor-documented. [Pen, pencil, marker](https://support.zipgrade.com/hc/en-us/articles/201168769-Can-ZipGrade-read-pen-pencil-marker).

ZipGrade documents answer keys, alternate answers, key versions, question points, tags, and an “Attempted, but Incorrect” point value for negative or partial scoring scenarios. **Evidence:** vendor-documented. [CSV answer-key import](https://support.zipgrade.com/hc/en-us/articles/37271000797453-CSV-Answer-Key-Import-File-Requirements-and-Options); [Attempted but incorrect scoring](https://support.zipgrade.com/hc/en-us/articles/21880513310989-What-does-the-a-i-on-the-answer-key-mean).

The public material reviewed confirms review/correction of recognition, but it does not provide a full public specification for how ambiguous multiple marks, blank responses, confidence scores, or changed answers are persisted and audited. **Evidence:** partially documented; implementation unverified.

### EduSentrix implications

- Represent `blank`, `single_mark`, `multiple_mark`, `ambiguous`, `unreadable`, and `operator_corrected` distinctly.
- Preserve the raw recognition result and correction event. Regrading must identify the answer-key version and whether the operator changed recognition or the scoring policy.
- Do not treat a blank as a missing response and do not silently convert an ambiguous mark to wrong.

## 4. Students, classes, batch workflows, and exports

ZipGrade can grade without student records, but its documentation recommends student records and IDs for useful exports. CSV student import supports names, numeric ZipGrade IDs, external IDs, and class names. **Evidence:** vendor-documented. [Import students from CSV](https://support.zipgrade.com/hc/en-us/articles/201171309-How-do-I-import-a-CSV-file-of-students).

ZipGrade documents that a paper, student/class association, and quiz/class association are needed to place results properly. If student IDs/records are not used, separate quiz records may be needed for different classes. Results can be filtered/grouped by class and exported. **Evidence:** vendor-documented. [Connecting classes to a quiz](https://support.zipgrade.com/hc/en-us/articles/205545969-How-do-I-connect-multiple-classes-to-a-quiz-and-view-just-one); [Blank class field in CSV export](https://support.zipgrade.com/hc/en-us/articles/202088299-Why-is-the-class-field-blank-on-CSV-export).

ZipGrade documents sheet-fed PDF upload at 75–300 PPI, one answer sheet per page, grayscale or color, and a 100 MB maximum. It warns that phone PDF-scanner apps may alter layout. Failed pages can be linked and downloaded for review. **Evidence:** vendor-documented. [Grading PDF files](https://support.zipgrade.com/hc/en-us/articles/37328081315981-Can-I-use-ZipGrade-without-a-mobile-device-Can-I-use-a-computer-to-grade-papers).

### EduSentrix implications

- Batch ingestion should report per-page/per-paper status, not only one batch status.
- Student mapping must be school-scoped and reject duplicate/unknown IDs into a reconciliation queue.
- PDF/image ingestion must preserve page boundaries and identify altered scale, wrong page count, unreadable page, and failed recognition.

## 5. Offline/mobile sync and operational recovery

ZipGrade's public product page claims scanning/grading without internet and sync between Android, iPad, and website. Its support guidance says to verify pending local data/images are synchronized before uninstalling or reinstalling the app. **Evidence:** vendor-claimed plus vendor-documented operational guidance. [ZipGrade product page](https://www.zipgrade.com/); [Gray/white scanning and pending sync](https://support.zipgrade.com/hc/en-us/articles/202354275-Why-am-I-getting-a-gray-or-white-image-when-trying-to-scan).

The public documentation does not establish conflict resolution when the same paper is edited on multiple devices, exactly-once sync semantics, encryption, retention, or server reconciliation internals. **Evidence:** unverified.

### EduSentrix implications

- A mobile scan queue should be durable and resumable, with explicit pending/uploaded/processed/rejected/reconciled states.
- Sync must be idempotent by scan/packet identity and preserve the earliest raw asset plus later corrections.
- The operator must see unsynchronized evidence before logout, device reset, account change, or deletion.

## 6. Analytics and result generation

ZipGrade documents Review Papers, Item Analysis, exports, class filters, and question tags/standards-related key data. **Evidence:** vendor-documented. [How to get started](https://support.zipgrade.com/hc/en-us/articles/201168729-How-do-I-get-started-with-ZipGrade); [CSV answer-key import](https://support.zipgrade.com/hc/en-us/articles/37271000797453-CSV-Answer-Key-Import-File-Requirements-and-Options).

These are quiz/OMR results, not evidence of a school report-card engine, moderation ledger, or canonical subject-result integration. **Evidence:** scope limitation/inference.

### EduSentrix implications

- OMR item analysis should be derived from recognized responses and marked evidence, with recognition uncertainty visible.
- Final academic result generation must remain in the canonical School OS engine and obey grading policy, contribution rules, approval, release, and audit constraints.

## 7. Limitations

- No live mobile scan or device/browser observation was performed.
- Camera resolution and lighting guidance are operational documentation, not a universal accuracy guarantee.
- Private recognition, confidence, sync, encryption, and persistence details are unverified.
- ZipGrade is primarily an objective/OMR workflow; it is not evidence for multi-page handwritten script marking or moderation.
- Some support articles are older than the observation date; current product pages and article dates are retained in the source inventory.

## Source inventory

All sources were reviewed on 2026-10-15:

1. [ZipGrade product page](https://www.zipgrade.com/) — mobile/offline/sync product claims.
2. [Answer sheet forms](https://cloud.zipgrade.com/forms/) — standard/custom forms, IDs and printing.
3. [How to get started](https://support.zipgrade.com/hc/en-us/articles/201168729-How-do-I-get-started-with-ZipGrade) — form/key/scan/review workflow.
4. [Answer sheet recognition troubleshooting](https://support.zipgrade.com/hc/en-us/articles/201493965-ZipGrade-isn-t-recognizing-an-answer-sheet-It-won-t-scan) — wrong form, camera, glare, focus, strictness.
5. [Lighting conditions](https://support.zipgrade.com/hc/en-us/articles/203172225-What-lighting-conditions-work-best) — glare and lighting guidance.
6. [Pen, pencil, marker](https://support.zipgrade.com/hc/en-us/articles/201168769-Can-ZipGrade-read-pen-pencil-marker) — mark quality and correction.
7. [Import students from CSV](https://support.zipgrade.com/hc/en-us/articles/201171309-How-do-I-import-a-CSV-file-of-students) — roster/ID mapping.
8. [Connecting classes to a quiz](https://support.zipgrade.com/hc/en-us/articles/205545969-How-do-I-connect-multiple-classes-to-a-quiz-and-view-just-one) — student/class/quiz relationships.
9. [Blank class field in CSV export](https://support.zipgrade.com/hc/en-us/articles/202088299-Why-is-the-class-field-blank-on-CSV-export) — export scope limitation.
10. [Grading PDF files](https://support.zipgrade.com/hc/en-us/articles/37328081315981-Can-I-use-ZipGrade-without-a-mobile-device-Can-I-use-a-computer-to-grade-papers) — sheet-fed PDF constraints and failed-page review.
11. [Attempted but incorrect scoring](https://support.zipgrade.com/hc/en-us/articles/21880513310989-What-does-the-a-i-on-the-answer-key-mean) — answer-key scoring options.
12. [CSV answer-key import](https://support.zipgrade.com/hc/en-us/articles/37271000797453-CSV-Answer-Key-Import-File-Requirements-and-Options) — key versions, mappings, points and tags.
13. [Gray/white scanning and sync](https://support.zipgrade.com/hc/en-us/articles/202354275-Why-am-I-getting-a-gray-or-white-image-when-trying-to-scan) — camera permissions and pending synchronization.

