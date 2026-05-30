# Academic Assessment & Report Card Engine — Implementation Map

**Spec:** `ACADEMIC_ASSESSMENT_REPORT_CARD_ENGINE_SPEC.md`  
**Created:** Slice 0 — Discovery and Safety Map  
**Status:** Discovery complete; no source behavior changed.

---

## 1. Old System Boundary (preserve until migration)

### Data models (keep; do not delete)

| Model | Role | Legacy assumptions |
|-------|------|-------------------|
| `src/models/Assessment.ts` | Per-student score row mixed with item definition | `assessmentType` enum; no separate item/score split |
| `src/models/GradingScale.ts` | School grading scale | `caWeight` / `examWeight`; `gradeMappings[].letter` |
| `src/models/SubjectGrade.ts` | Published term subject result | `caTotal`, `examScore`, `gradeLetter` |
| `src/models/TermResult.ts` | Term rollup | Class position, GPA, promotion |
| `src/models/StudentAttendance.ts` | Daily homeroom/period attendance | `type: homeroom \| period` |
| `src/models/ReportTemplate.ts` | Report card layout config | Section-based template |

### Teacher gradebook (current)

```
src/app/(app)/teacher/gradebook/
src/app/api/teacher/gradebook/
src/components/teacher/gradebook/
src/hooks/teacher/useTeacherGradebook*.ts
```

### Student academics read path (current)

```
src/lib/academics/buildStudentAcademicsDTO.ts
src/types/admin/student-academics.ts
src/app/api/admin/students/[id]/academics/
src/components/admin/students/detail/StudentAcademicsTab.tsx (+ related)
src/components/parent/academics/*
```

### Report cards (partial)

```
src/app/api/admin/reports/cards/route.ts
src/components/admin/reports/ReportCardView.tsx  (orphaned — not mounted)
src/hooks/admin/useReportCard.ts                 (unused)
```

---

## 2. New Engine Boundary (build in parallel)

### Planned types & constants (Slice 1)

```
src/types/academics/assessment-engine.ts
src/constants/academics/assessment-engine.ts
```

### Planned models (Slice 2)

```
AcademicGradingPolicy
AssessmentPlan
AssessmentItem
AssessmentScore
SubjectResult
ReportCardRun
StudentReportCard
ReportAttendanceSnapshot
ReportApprovalLog
```

### Planned calculation utilities (Slice 3)

```
src/lib/academics/assessment-engine/calculate-component.ts
src/lib/academics/assessment-engine/calculate-subject-result.ts
src/lib/academics/assessment-engine/resolve-grade-boundary.ts
src/lib/academics/assessment-engine/validate-assessment-plan.ts
```

### Planned admin routes (Slices 4–7)

```
/api/admin/academics/grading-policies
/api/admin/academics/assessment-plans
/admin/academics/grading
/admin/academics/assessment-plans
```

### Planned teacher marks v2 (Slices 8–15)

```
/api/teacher/marks/gradebooks/[classGroupId]/[subjectId]
/api/teacher/marks/assessment-items
/api/teacher/marks/scores/bulk
/api/teacher/marks/subject-results/preview
/api/teacher/marks/subject-results/submit
/teacher/marks/[classGroupId]/[subjectId]
```

### Planned homeroom & approval (Slices 16–20)

```
/api/teacher/homeroom/report-runs
/api/teacher/homeroom/report-runs/[id]
/api/teacher/homeroom/report-runs/[id]/compile
/api/teacher/homeroom/report-runs/[id]/submit
/api/admin/reports/report-runs
/api/admin/reports/report-runs/[id]
/api/admin/reports/report-runs/[id]/approve
/api/admin/reports/report-runs/[id]/return
/api/admin/reports/report-runs/[id]/release
/teacher/homeroom/reports
/teacher/homeroom/reports/[classGroupId]
```
src/lib/academics/reporting/build-attendance-snapshot.ts
src/lib/academics/reporting/report-card-approval-service.ts
```
/admin/reports/report-runs
/admin/reports/report-runs/[id]
```
src/lib/academics/reporting/build-attendance-snapshot.ts
src/lib/academics/reporting/report-card-approval-service.ts
src/components/admin/reports/AdminReportRunsClient.tsx
src/components/admin/reports/AdminReportRunDetailClient.tsx
src/components/admin/reports/ReportCardView.tsx
src/lib/academics/reporting/build-student-report-card-view.ts
src/lib/academics/reporting/resolve-student-report-card-view.ts
Compatibility layer
src/lib/academics/compatibility/subject-result-adapters.ts
src/lib/academics/compatibility/load-subject-results.ts
src/lib/academics/buildStudentAcademicsDTO.ts (SubjectResult-first + legacy fallback)
src/components/academics/AcademicsDataSourceNotice.tsx
src/app/api/parent/academics/route.ts
tests/assessment-engine.subject-result-adapters.test.ts
Deprecation (Slice 23)
docs/LEGACY_GRADEBOOK_MIGRATION.md
src/lib/academics/legacy-gradebook-deprecation.ts
src/app/api/teacher/gradebook/** (410 retired)
src/app/(app)/teacher/gradebook/** (redirect to marks)
tests/assessment-engine.legacy-gradebook-deprecation.test.ts
Teacher Studio → gradebook (Slice 15)
src/lib/academics/assessment-engine/studio-to-gradebook-service.ts
src/app/api/teacher/studio/assignments/[id]/gradebook-link/route.ts
src/components/teacher/studio/AddToGradebookPanel.tsx
src/hooks/teacher/useStudioGradebookLink.ts
tests/assessment-engine.studio-to-gradebook.test.ts
```

---

## 3. Hardcoded CA/Exam Hotspots (retired in Slice 23)

Legacy gradebook routes return **HTTP 410** and `/teacher/gradebook/*` redirects to `/teacher/marks/*`.
See `docs/LEGACY_GRADEBOOK_MIGRATION.md`.

| Location | Status |
|----------|--------|
| `src/app/api/teacher/gradebook/**` | Retired — 410 + successor links |
| `src/app/(app)/teacher/gradebook/**` | Redirects to `/teacher/marks/**` |
| `src/components/teacher/gradebook/*` | Deprecated UI (unused after redirect) |
| `src/lib/academics/grading-strategies.ts` | `@deprecated` — seed/reference only |
| `src/lib/academics/calculateGrades.ts` | `@deprecated` CA/exam helper — seed/reference only |
| `src/models/GradingScale.ts` | Legacy model fields retained for old data |
| `src/models/SubjectGrade.ts` | Legacy read fallback via compatibility layer |
| `scripts/seed-academics.ts` | Seed-only legacy math |

Official calculations use **grading policy score components** via the assessment engine (`SubjectResult`).

---

## 4. Adjacent Systems (integrate later, do not conflate)

| System | Path | Notes |
|--------|------|-------|
| Teacher Studio | `src/app/(app)/teacher/studio/`, `Homework`, `Submission` | Assignments/quizzes; linked to gradebook via Add to Gradebook (Slice 15) |
| Examinations | `ExamType`, `ExamPaper` | Parallel track; `appearsOnReportCard` flag |
| Lesson attendance | `LessonAttendance.ts` | Not report-card attendance source |
| Period reports | `PeriodReport.ts` | AI narrative; not student report cards |

---

## 5. Auth & Scoping Rules

- All new tenant records: `schoolId` required.
- Admin grading/plan routes: admin permission helpers.
- Teacher marks: assigned class/subject only (unless admin override).
- Homeroom report runs: homeroom teacher for class group.
- Parent/student: released snapshots only.

---

## 6. Migration Phases (from spec §17)

1. Build new models/APIs beside old system.
2. Gradebook v2 surfaces use new models.
3. Teacher Studio pushes marks into assessment items.
4. Report-card runs generate snapshots.
5. Student Academic Profile reads new data first, old fallback.
6. Phase out `SubjectGrade`/`TermResult` from official reporting.
7. Remove hardcoded CA/exam logic.

---

## 7. Slice Progress Tracker

| Slice | Name | Status |
|-------|------|--------|
| 0 | Discovery and Safety Map | ✅ Complete |
| 1 | Domain Types and Constants | ✅ Complete |
| 2 | New Mongoose Models | ✅ Complete |
| 3 | Calculation Utilities | ✅ Complete |
| 4 | Grading Policy Admin Backend | ✅ Complete |
| 5 | Grading Policy Admin UI | ✅ Complete |
| 6 | Assessment Plan Backend | ✅ Complete |
| 7 | Assessment Plan Admin UI | ✅ Complete |
| 8 | Teacher Gradebook v2 Read API | ✅ Complete |
| 9 | Assessment Item and Score Mutations | ✅ Complete |
| 10 | Teacher Gradebook v2 UI Shell | ✅ Complete |
| 11 | Teacher Assessment Item UI | ✅ Complete |
| 12 | Teacher Mark Entry UI | ✅ Complete |
| 13 | Report Contribution UI | ✅ Complete |
| 14 | Subject Result Preview and Submit | ✅ Complete |
| 15 | Teacher Studio Link to Gradebook | ✅ Complete |
| 16 | Homeroom Report Run Backend | ✅ Complete |
| 17 | Homeroom Report Run UI | ✅ Complete |
| 18 | Attendance Snapshot Service | ✅ Complete |
| 19 | Admin Report Approval Backend | ✅ Complete |
| 20 | Admin Report Approval UI | ✅ Complete |
| 21 | StudentReportCard View Integration | ✅ Complete |
| 22 | Compatibility Layer | ✅ Complete |
| 23 | Deprecation of Hardcoded CA/Exam Logic | ✅ Complete |

**Overall:** 24 / 24 slices complete (100%)
