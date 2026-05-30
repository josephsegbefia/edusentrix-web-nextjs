# Legacy Gradebook Migration

The original teacher gradebook used hardcoded **CA** and **Exam** assessment type sets with fixed
`GradingScale.caWeight` / `examWeight` math. That path is **retired** as of Assessment Engine
**Slice 23**.

## Use instead

| Legacy | Successor |
|--------|-----------|
| `/teacher/gradebook` | `/teacher/marks` |
| `/teacher/gradebook/[classGroupId]/[subjectId]` | `/teacher/marks/[classGroupId]/[subjectId]` |
| `GET /api/teacher/gradebook/...` | `GET /api/teacher/marks/gradebooks/...` |
| `POST /api/teacher/gradebook/.../record` | Assessment items + bulk score APIs under `/api/teacher/marks/` |
| `POST /api/teacher/gradebook/.../publish` | `POST /api/teacher/marks/subject-results/submit` |
| `GET /api/teacher/gradebook/.../export` | Export from the marks workspace (or admin reports) |

## Official calculations

Report-ready subject results are computed from:

- **Grading policy** score components (dynamic weights, not CA/exam sets)
- **Assessment plan** items and recorded scores
- **Subject result** preview/submit flow (`SubjectResult` model)

Student-facing academics and released report cards prefer `SubjectResult` and
`StudentReportCard` snapshots. Legacy `SubjectGrade` / `TermResult` remain as read fallback only
(Slice 22 compatibility layer).

## Retired code (do not use for new features)

- `CA_TYPES` / `EXAM_TYPES` in legacy gradebook routes and UI
- `calculateGradeByStrategy()` in `src/lib/academics/grading-strategies.ts` (seed/reference only)
- `calculateSubjectGradeFromAssessments()` hardcoded exam split in `src/lib/academics/calculateGrades.ts`

## Admin setup checklist

1. Configure a **grading policy** with score components for the grade band.
2. Publish an **assessment plan** for the academic period.
3. Ask teachers to use **Marks & Reports** for mark entry and subject result submission.
4. Run **report card** compile/approval/release for official parent/student documents.

## Data already in legacy collections

Existing `Assessment`, `SubjectGrade`, and `TermResult` documents are not deleted automatically.
Schools migrating term-by-term should enter new marks in the assessment engine; the compatibility
layer continues to surface legacy rows where engine data is missing.
