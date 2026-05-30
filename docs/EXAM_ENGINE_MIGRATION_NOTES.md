# Exam Scheduling & Invigilation Engine — Migration Notes

**Spec:** `EXAM_SCHEDULING_INVIGILATION_ENGINE_SPEC.md`  
**Audience:** Platform operators and school admins rolling out the module on existing tenants.

---

## 1. Net-new collections

The exam scheduling engine introduces MongoDB collections that did not exist before this module:

| Collection | Purpose |
|------------|---------|
| `ExamSession` | Exam period grouping (e.g. end-of-term exams) |
| `ExamTimetableEntry` | Individual exam papers / sittings |
| `ExamVenue` | Exam halls and rooms (separate from class timetable rooms) |
| `ExamInvigilatorAssignment` | Teacher invigilation duties per paper |
| `ExamConflictSnapshot` | Persisted conflict review state + overrides |
| `ExamTimetableVersion` | Published timetable snapshots |
| `ExamCalendarEventLink` | Deduped links to `AcademicCalendarEvent` |
| `ExamPolicy` | School exam scheduling policy defaults |
| `ExamIncidentReport` | Teacher exam-day incident reports |

No legacy exam timetable data is migrated automatically. Schools start fresh per exam session.

---

## 2. Relationship to existing modules

| Existing module | Relationship |
|-----------------|--------------|
| `/admin/examinations` (question bank) | **Separate.** Question papers vs exam **scheduling**. |
| Class timetables | **Separate.** Exam entries use calendar dates, not day-of-week slots. |
| Assessment engine / report cards | **Linked.** Report-contributing entries must link `AssessmentItem` before publish. |
| Academic calendar | **Optional sync** on publish when `syncToCalendar` is enabled. |
| Teacher duty assignments | **Separate.** Use `ExamInvigilatorAssignment`, not ad hoc duty cards. |

---

## 3. Recommended rollout order

1. Create or confirm **exam policy** defaults (`/admin/exams/settings` when available, or seeded defaults).
2. Add **exam venues** for halls and labs.
3. Create an **exam session** scoped to the current academic period and grades.
4. **Generate draft papers** from class groups and subject offerings.
5. Build the timetable manually, via **smart schedule**, or a mix.
6. Assign **invigilators** and resolve **conflicts**.
7. Link **assessment items** for report-contributing papers.
8. **Publish** with a change summary; enable calendar sync if parents/teachers should see events.
9. Teachers use **My Exams** for duties and day operations; parents/students see **Upcoming Exams** when visibility is enabled.

---

## 4. Parent and student visibility

Published data only appears to parents and students when **both** are true:

- Session `allowParentStudentVisibility` is enabled.
- Session status is in the published lifecycle (`published`, `in_progress`, `completed`, `locked`).
- Entries are scheduled (`isUnscheduled: false`) and in a published entry status.

Draft timetables, conflict snapshots, and readiness scores are **never** exposed on parent/student routes.

---

## 5. Report card integration

- Report-contributing exam entries should create or link an `AssessmentItem` with `sourceRefType` = exam timetable entry.
- Publish readiness blocks when required links are missing.
- After exam dates pass, teachers see **marks pending** for linked items; analytics surfaces school-wide pending counts.
- Report compile flows should continue to use the assessment engine — exam scheduling does not replace mark entry or report runs.

---

## 6. Entitlements and AI

- Admin exam scheduling routes are registered under **`assessment.examinations`** for subscription gating (same tier family as examinations / assessments).
- Leo advisory routes require **`ai_leo_copilot`** entitlement and return deterministic fallbacks when OpenAI is unavailable.
- Leo never publishes, overrides conflicts, or assigns invigilators directly.

---

## 7. Republish and calendar dedupe

- Each publish creates a new `ExamTimetableVersion` with an incrementing version number.
- Calendar sync upserts events by stable `sourceRefKey` per school; stale links are cancelled when papers drop out of the published set.
- Republish requires a new change summary; admins can disable calendar sync per publish.

---

## 8. Data safety checklist for operators

- All writes are scoped by `schoolId` from authenticated school admin context.
- Cross-school access is rejected at the service layer (session, entry, venue, and assignment lookups include `schoolId`).
- Cancelled, archived, and locked sessions cannot be published.
- In-progress and completed sessions have explicit publish guard messages.

---

## 9. Known legacy boundaries

- Preschool grades use learning areas, not central subject offerings — exam draft generation should respect grade scope.
- Some schools may still have legacy assessment data without exam `sourceRefType` links; use assessment link UI to connect or create items per class group.
- Class timetable `roomId` is not reused; configure `ExamVenue` records instead.
