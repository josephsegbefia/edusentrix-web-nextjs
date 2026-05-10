# Scheme of Learning Import Progress

This tracker records implementation progress for `SCHEME_OF_LEARNING_IMPORT_AND_LESSON_NOTES_SPEC.md`.

## Current Status

The Scheme of Learning import and Lesson Note integration feature is implemented end to end. The flow preserves GES-style scheme columns, ties every import to a class/grade/subject/period, supports teacher and admin imports, derives learning-structure nodes, and lets teachers create Lesson Notes directly from Scheme of Learning rows.

Estimated full-spec completion: **100%**.

## Done

- Created the feature specification.
- Expanded import row models and client types for:
  - week ending,
  - strand,
  - sub-strand,
  - content standard,
  - indicators,
  - resources,
  - row type,
  - raw source text.
- Updated PDF AI extraction to return GES-style columns.
- Updated spreadsheet parsing to recognize GES-style headers.
- Updated import confirmation to map rich rows into `SchemeItem`.
- Updated the import review UI to show Scheme of Learning columns and row quality counts.
- Added assigned class/subject selection to import confirmation.
- Added current academic period display to import confirmation.
- Required `academicPeriodId`, `gradeId`, and `subjectId` in the import confirmation API.
- Auto-generated draft scheme titles from grade, subject, and current period.
- Saved source file metadata and source type on confirmed imported schemes.
- Added duplicate prevention for same academic period, grade, class, and subject.
- Added visible save/confirm error feedback on the import review screen.
- Updated teacher-facing scheme library terminology to **Schemes of Learning**.
- Updated teacher scheme detail/wizard copy to **Scheme of Learning**.
- Updated Lesson Note scheme linking panel copy to **Scheme of Learning** and **scheme rows**.
- Lesson Note scheme linking now shows selected scheme-row details.
- Lesson Note scheme linking can apply strand, sub-strand, content standard, indicators, references, TLMs, and topic from selected scheme rows into the note.
- Renamed the admin review navigation to **Schemes of Learning**.
- Improved the admin review desk hero to explain the import, review, activation, and Lesson Notes flow.
- Added admin review cues for import source type and missing academic context.
- Updated admin scheme detail terminology to **Scheme of Learning** and **scheme rows**.
- Extracted shared Scheme of Learning import creation logic for teacher and admin flows.
- Added admin import APIs for create, load job, edit parsed rows, cancel, and confirm.
- Admin import confirmation creates an approved Scheme of Learning tied to academic period, grade, class, and subject.
- Added `/admin/schemes/import` as a four-step import wizard: upload, context, review, create.
- Added an admin import CTA from `/admin/schemes`.
- Added admin-side import hooks for create, load, save rows, confirm, and cancel.
- Removed the PDF-specific import gate; PDF imports now follow the same base Scheme of Learning import setting as CSV/XLSX.
- Added Learning Structure derivation from imported rows.
- Confirmed imports now create or reuse curriculum, curriculum subject, and strand/sub-strand/objective nodes.
- Confirmed Scheme rows now store derived `curriculumNodeIds` so Lesson Notes can inherit curriculum alignment.
- Added a teacher Lesson Note prefill endpoint for Scheme of Learning rows.
- Added “Lesson note” actions on approved/active Scheme of Learning rows.
- Lesson Note creation from a scheme row now preloads class, subject, topic, week/date, curriculum alignment, indicators, TLMs, assessment ideas, references, tags, and scheme row links.
- Teacher dashboard now shows this week’s active Scheme of Learning rows with a direct Lesson Note action.
- Scheme rows now show linked Lesson Note counts.
- Retired the standalone `/admin/curricula` UI from the admin navigation.
- `/admin/curricula` and `/admin/curricula/:id` now redirect to `/admin/schemes`.
- Scheme of Learning upload/import is now gated to Ghana NaCCA schools only in the API and UI.

## In Progress

- None.

## Not Started

- None.

## Verification Log

- Focused lint passed for changed import model, parsing, route, and UI files.
- `npm run build` passed. Existing warnings remain for deprecated Next middleware convention, stale `baseline-browser-mapping`, and pre-existing Mongoose duplicate/reserved schema warnings.
- Focused lint passed for context-hardening, terminology, and Lesson Note scheme-row application slices.
- Earlier `npm run build` passed before the final Lesson Note/dashboard additions. Existing warnings remain unchanged.
- Focused lint passed for PDF gate removal, curriculum derivation, Lesson Note from scheme row, teacher dashboard scheme cards, linked Lesson Note counts, and the curriculum UI redirect.
- Latest full `npm run build` attempt was blocked by the existing Next/Turbopack Google Fonts fetch failure from `fonts.gstatic.com`.
