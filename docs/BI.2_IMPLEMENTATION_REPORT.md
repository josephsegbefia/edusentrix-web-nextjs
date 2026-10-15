# BI.2 Teacher Understanding Engine — Implementation Report

Status: implemented on top of BI.1. BI.3 review UI, BI.4 commit/invitation/resume redesign, and BI.5 student intelligence were not implemented.

## A. BI.1 preflight verification

- `LEO_IMPORT_ASSIST` remains separate from the normal Leo subscription entitlement; the shared access regression test passes for an authorized school admin without general Leo access.
- Import access still evaluates authorization, provider availability, runtime/platform enablement, and privacy controls.
- The unfinished global Ask Leo entry remains unmounted; purpose-built Leo surfaces remain available.
- Teacher and Student import domains contain no direct OpenAI SDK/client coupling. Provider-specific code remains behind the shared Leo import boundary.

These are static/unit-test verifications. They do not prove production provider, Cloudflare, Hetzner, Coolify, MongoDB, or Inngest delivery.

## B. Teacher files created/modified

Created or added for this slice:

- `src/lib/teachers/teacher-understanding.ts`
- `tests/teacher-import-bi2.test.ts`
- additive teacher serialization coverage and BI.2 documentation.

Modified for the Teacher path:

- `src/lib/teachers/parse-teacher-import.ts`
- `src/lib/teachers/analyze-teacher-import.ts`
- `src/lib/teachers/teacher-import-review.ts`
- `src/lib/teachers/teacher-import-workflow.ts`
- `src/lib/teachers/teacher-import-leo.ts`
- `tests/fixtures/teacher-import/real-teachers-18.csv`
- `tests/teacher-import-bi2v.test.ts`
- `tests/teacher-import-bi2v.test.ts` uses a catalog-backed external-Leo seam so provider success/failure behavior is tested without network access.
- `src/models/TeacherImportJob.ts`

## C. Teacher canonical row V2 structure

The parsed row retains `sourceRowNumber`, stable `rowRef`, raw `sourceValues`, first/middle/last names, email, normalized phone, employee id, department, status, subject values, grade scopes and ids, class scopes and ids, homeroom fields, subject-offering/profile ids, proposal-only explicit assignments, issue state, row state, and provenance.

## D. Flexible column understanding

The parser supports exact aliases, safe structural mappings, optional Leo header suggestions, and later admin mappings. It accepts arbitrary reasonable CSV/XLS/XLSX headers rather than requiring the official template. Repeated source columns are retained instead of collapsed.

## E. Name interpretation

Full-name-only rows are split into first, middle, and last names. Separate first/middle/last columns are preserved. Ambiguous or incomplete names remain reviewable; names and contact values are not sent to Leo.

## F. Grade/ClassGroup resolution

Grade aliases cover Primary/Basic/Grade/Form/Level/JHS vocabulary, codes, and number words. Class aliases combine the real active class name with its school grade/code. Resolved ids come only from the current school’s active `Grade` and `ClassGroup` records.

## G. Curriculum/grade-band resolver

The resolver uses active school `SubjectOffering` records, grade ids, grade bands, explicit stage markers, class-group offering restrictions, and subject-family aliases. Lower Primary, Upper Primary, JHS, and SHS boundaries are kept distinct.

BI.2V also caught and fixed a false class ambiguity: JHS grades no longer receive Primary aliases such as `primary1`, so `Primary 1 A` cannot match both Primary 1 A and JHS 1 A.

## H. Subject resolution hierarchy

The hierarchy is: trusted reviewed ids; exact/normalized offering labels and codes; deterministic aliases; grade/class/stage context; Leo suggestions constrained by the school catalog; then admin review or blocking. A unique validated active offering may be AUTO; ambiguity, mismatch, and semantic substitution require review or blocking.

## I. P4 → Upper Primary behavior

`Maths`/`Mathematics - Primary` in a real P4/P4A context resolves to the active Upper Primary offering when unique. A direct stage-specific value is not globally collapsed into another band.

## J. P1–P3 → Lower Primary behavior

Broad Mathematics/Science-style values in a P1–P3 context resolve against the active Lower Primary offering when the catalog contains one compatible target.

## K. Multiple subjects support

`Subject 1`, `Subject 2`, delimited lists, and repeated subject fields are expanded. Each subject is resolved independently and preserves its own source value/provenance.

## L. Multiple grades support

Grade scopes and repeated grade columns are expanded and resolved to multiple real grade ids. The same subject text receives separate resolution keys per grade context.

## M. Multiple class groups support

Classes taught are separate from homeroom. Repeated class columns and delimited class values resolve to multiple active class groups where unambiguous.

## N. Explicit assignment understanding

The engine understands structured values such as `P4A - Maths; P4B - Science`, arrows/colon forms, and subject-specific columns such as `Math Class` and `Science Class`. Each becomes a proposal with subject/class/grade candidates, status, issue code, note, and provenance.

## O. Subject profile vs TeacherAssignment safeguards

Teacher subject/profile ids are resolved for the Teacher row. BI.2 does not create or mutate `TeacherAssignment` records. Explicit assignments remain proposals only.

## P. Homeroom resolution/conflicts

Homeroom resolution is separate and school-scoped. Occupied homerooms become review decisions. Multiple imported teachers claiming one homeroom become a grouped review issue; no replacement occurs during analysis.

## Q. Cross-row conflict engine

The analyzer detects duplicate email, phone, employee id, and source-name signals, duplicate explicit assignments, and duplicate homeroom claims. It keeps the rows separate and emits actionable issues rather than silently merging people.

## R. Existing TeacherAssignment/co-teaching warnings

Explicit proposals are checked in one school-scoped query against active `TeacherAssignment` records. An overlap is marked `assignment_overlap` and described as a possible co-teaching decision. It is never overwritten or committed by BI.2.

## S. Leo holistic pass

The Teacher adapter sends bounded structural vocabulary, catalog labels, grade/class abstractions, and issue types through the shared Leo boundary. Leo can assist with headers, vocabulary, semantic explanations, and stage-mismatch explanations. A cross-family semantic substitution remains REVIEW and cannot become AUTO.

## T. Privacy behavior

Teacher names, email, phone, employee identifiers, raw rows, and database ids are excluded from Leo context. Logs retain safe metadata and counts rather than source PII. Catalog validation and persistence remain server-owned.

## U. Issue generation

The engine produces row issues and stable BI.1 `ImportIssueV2` records for missing/invalid identity, duplicate identity, ambiguous/not-found subjects and classes, stage mismatch, grade/class scope review, explicit assignment review/overlap, semantic substitution, occupied/duplicate homerooms, admin invalidation, and Leo degradation. Summary counts expose AUTO/review/blocked/conflict/Leo-assisted work.

## V. Persistence

The existing `TeacherImportJob` stores additive row, resolution, provenance, issue, interpretation, Leo metadata, version, and review state. `BackgroundJob` remains the execution receipt. No new collection was added.

## W. Retry/reanalysis behavior

Analysis retains source bytes through review/reanalysis, passes prior admin subject/class/issues as preserved state, and restores valid administrator decisions. Invalid catalog decisions reopen with an explicit issue. Provider failure falls back to deterministic analysis and retains retryable source state.

## X. Provided CSV verification

The permanent fixture is `tests/fixtures/teacher-import/real-teachers-18.csv`. The focused BI.2V test runs its bytes through the actual parser, column interpretation, canonical row construction, school catalog queries, grade/class resolution, subject resolution, holistic issues, and summary generation. The test catalog contains Primary 1-6, JHS 1-3, one A/B class group for each grade, stage-specific active offerings, and no canonical History offering; Our World and Our People is present only to test a Leo semantic-equivalent suggestion.

The deterministic/provider-failure result was:

| Result | Actual value |
| --- | ---: |
| Total rows | 18 |
| Ready rows | 4 |
| Review rows | 2 |
| Blocked rows | 12 |
| AUTO subject resolutions | 46 |
| REVIEW subject resolutions | 2 |
| Stage-mismatch issues | 2 |
| Expected analysis errors | 12 missing History offerings |
| Unexpected failures | 0 |

| Teacher | Homeroom | Representative source subject | Result | Resolution |
| --- | --- | --- | --- | --- |
| Abena Asante | Primary 1 A | Mathematics - Primary | Mathematics - Lower Primary; History remains unresolved | AUTO subject; expected blocking History issue |
| Emefa Amedzro | Primary 4 A | Mathematics - Primary | Mathematics - Upper Primary | AUTO; no Mathematics ambiguity |
| Mariam Sulemana | JHS 3 A | French - Primary | French Language - JHS retained; Primary French retained as source evidence | JHS subjects valid; stage mismatch REVIEW |
| Yaw Boakye | JHS 3 B | Computing - Primary | Computing - JHS and Physical Education and Health - JHS | valid JHS subjects; Primary Computing stage mismatch REVIEW |

The same `Mathematics - Primary` source value resolved to Lower Primary for P1-P3 and Upper Primary for P4-P6 in the same import. All 18 homerooms resolved to one unique active class-group id; no duplicate class candidate was produced. The fixture contains only subject profiles and homerooms, so it produced zero explicit TeacherAssignment proposals.

The Leo semantic variant suggested `Our World and Our People` for `History - Primary`. The result remained `REVIEW`, set `requiresHumanConfirmation`, exposed catalog candidates, preserved the original source subject, and did not add the candidate offering to the row. The provider-failure variant returned degraded/retryable Leo metadata (`provider_error`) while deterministic resolutions, parsed rows, issues, and source-backed analysis remained available; no re-upload was required.

## Y. Mongo collection impact

No new MongoDB collection, model, or index was introduced. Existing `TeacherImportJob`, `BackgroundJob`, `Teacher`, `User`, `Grade`, `ClassGroup`, `SubjectOffering`, and read-only `TeacherAssignment` paths are reused.

## Z. Tests/build/lint/typecheck

- Focused BI.2V fixture tests passed: **2 passed, 0 failed**.
- Focused BI.2, legacy Teacher parser/resolution/serialization, and BI.1 shared intelligence tests passed: **28 passed, 0 failed**.
- Full suite passed: **1,055 passed, 0 failed, 0 cancelled**.
- Targeted ESLint passed for edited Teacher/model/test files.
- `git diff --check` passed.
- Production `npm run build` passed. The build reports the existing stale browser-data and middleware-convention warnings and explicitly skips type validation by repository configuration. Static generation used the local `.env.local` development database; this is not production deployment verification.
- No `npm run typecheck` script exists. Filtered `npx tsc --noEmit` output is clean for the edited BI.2 Teacher files/model/tests, while the broad repository TypeScript run still reports unrelated pre-existing errors.

## AA. Remaining BI.3 dependencies

BI.3 still needs the issue-first review UI: grouped issue cards, source/evidence display, subject/class candidate selection, row-level corrections, admin action history, explicit assignment review, and readiness gating. It must consume the persisted `analysisIssues`, `columnInterpretations`, canonical rows, proposals, and summary counts delivered here. No BI.3 UI redesign was included in this slice.
