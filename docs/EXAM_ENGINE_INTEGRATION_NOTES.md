# Exam Scheduling & Invigilation Engine — Integration Notes

**Spec:** `EXAM_SCHEDULING_INVIGILATION_ENGINE_SPEC.md`  
**Created:** Slice 1 — Domain Audit and Integration Map  
**Status:** Discovery complete; no functional behavior changed.

---

## 1. Purpose

Map existing EduSentrix structures before building the exam scheduling engine. This module is **net-new** — no `ExamSession`, `ExamTimetableEntry`, or related models exist yet.

---

## 2. Core Domain Models (existing — integrate with)

| Model | Path | Exam engine use |
|-------|------|-----------------|
| `AcademicPeriod` | `src/models/AcademicPeriod.ts` | Session scope; entries must match period |
| `Grade` | `src/models/Grade.ts` | Session `appliesToGradeIds`; entry grade scope |
| `ClassGroup` | `src/models/ClassGroup.ts` | Entry `classGroupIds`; parent/student visibility |
| `Subject` | `src/models/Subject.ts` | Entry subject; offering validation |
| `SubjectOffering` | `src/models/SubjectOffering.ts` | Validate subject offered for class/grade |
| `Teacher` | `src/models/Teacher.ts` | Invigilator assignment; subject teacher for assessment link |
| `TeacherAssignment` | `src/models/TeacherAssignment.ts` | Resolve subject teacher for assessment item auto-create |
| `User` | `src/models/User.ts` | Actor IDs; notification recipients |
| `SchoolSettings` | `src/models/SchoolSettings.ts` | `defaultExamWeekDuration`, working days, period slots |

---

## 3. Assessment & Report Card Engine (primary downstream)

**Status:** Complete (24/24 slices). See `docs/ASSESSMENT_ENGINE_IMPLEMENTATION_MAP.md`.

| Model / service | Path | Integration |
|-----------------|------|-------------|
| `AssessmentPlan` | `src/models/AssessmentPlan.ts` | Session `assessmentPlanId`; component rules for exam linking |
| `AcademicGradingPolicy` | `src/models/AcademicGradingPolicy.ts` | Session `gradingPolicyId` |
| `AssessmentItem` | `src/models/AssessmentItem.ts` | Entry `assessmentItemId`; use `sourceRefType`/`sourceRefId` for exam link |
| `AssessmentScore` | `src/models/AssessmentScore.ts` | Marks after exam |
| `SubjectResult` | `src/models/SubjectResult.ts` | Report compilation |
| `ReportCardRun` / `StudentReportCard` | `src/models/` | Report readiness guards (Slice 18+) |
| `createAssessmentItem` | `src/lib/academics/assessment-engine/assessment-item-service.ts` | Auto-create linked items from timetable entries |
| `assessment-item-rules` | `src/lib/academics/assessment-engine/assessment-item-rules.ts` | Component key / contribution validation |
| Teacher marks UI | `src/app/(app)/teacher/marks/` | "Marks pending" after exam date |
| Admin report runs | `src/app/(app)/admin/reports/report-runs/` | Block compile if exam marks missing |

**Link rule (spec §21):** Report-contributing exam entries must create or link an `AssessmentItem` before publish/report readiness.

---

## 4. Student Academic Profile (read surfaces — later slices)

| Path | Notes |
|------|-------|
| `src/types/academics/student-academic-profile.ts` | DTO types for profile |
| `src/lib/academics/profile/buildStudentAcademicProfileDTO` | Profile builder |
| `GET /api/admin/students/[id]/academic-profile` | Admin read |
| `GET /api/parent/wards/[id]/academic-profile` | Parent read — **published exam data only** |
| `GET /api/student/academic-profile` | Student read — **published exam data only** |

Do not expose draft timetables or conflict data to parent/student UIs.

---

## 5. Class Timetable System (reuse patterns, do not conflate)

Exam timetables are **separate** from class teaching timetables but should reuse conflict/publish patterns.

| Asset | Path | Reuse for exam engine |
|-------|------|----------------------|
| Conflict detection | `src/lib/timetable/conflicts.ts` | Time overlap logic (`slotsOverlap`, `parseTimeToMinutes`) |
| Recompute conflicts | `src/lib/timetable/recompute-conflicts.ts` | Pattern for persist + severity grouping |
| Publish flow | `src/lib/timetable/publish.ts` | Block publish on open error conflicts |
| `TimetableVersion` | `src/models/TimetableVersion.ts` | Model for `ExamTimetableVersion` (Slice 21) |
| `TimetableConflict` | `src/models/TimetableConflict.ts` | Pattern for `ExamConflictSnapshot` |
| Class editor UI | `src/components/admin/classes/detail/ClassTimetableEditor.tsx` | UX reference for builder table/drawer |
| Planner hook | `src/hooks/admin/useTimetablePlanner.ts` | React Query + mutation patterns |

**Important:** Class timetables use `dayOfWeek`; exam entries use **calendar date + HH:mm**. Exam conflict service must use date-based overlap, not day-of-week slots.

---

## 6. Parallel “Examinations” Module (do not conflate)

Question-bank / exam-paper authoring is a **different product track**:

```
src/models/ExamType.ts
src/models/ExamPaper.ts
src/models/ExamPaperSection.ts
src/models/ExamQuestion.ts
src/app/api/teacher/examinations/
src/app/(app)/admin/examinations/
```

Admin nav already has "Examinations" → `/admin/examinations`. New exam **scheduling** nav should use distinct labels (e.g. "Exam Timetables" under Academics) to avoid confusion.

---

## 7. Teacher Duties (partial overlap)

| Model | Path | Notes |
|-------|------|-------|
| `TeacherDutyAssignment` | `src/models/TeacherDutyAssignment.ts` | Has `DutyCategory` including `"exam"` |

Spec defines dedicated `ExamInvigilatorAssignment` with acknowledgement/replacement lifecycle. Prefer the spec model for exam sessions; do not merge into generic duties unless explicitly reconciled in a later slice.

---

## 8. Notifications

| Asset | Path | Exam events (Slice 23) |
|-------|------|------------------------|
| `Notification` model | `src/models/Notification.ts` | Types: `grade`, `fee`, `attendance`, etc. — extend with `system` + metadata or add `exam` type when implementing |
| Academic calendar notifications | `src/lib/academic-calendar/notifications.ts` | Pattern for event-driven in-app notifications |
| Lesson notes notifications | `src/lib/lesson-notes/notifications.ts` | Pattern for create + deep link |
| Admin hooks | `src/hooks/admin/useAdminNotifications.ts` | Client read/mark-read |
| Teacher hooks | `src/hooks/teacher/useTeacherNotifications.ts` | Client read/mark-read |
| API routes | `src/app/api/admin/notifications/`, `src/app/api/teacher/notifications/`, `src/app/api/parent/notifications/` | Existing CRUD |

Spec events: `exam_timetable_published`, `invigilator_assigned`, `exam_reminder_*`, etc.

---

## 9. Calendar Integration (Slice 28)

| Model | Path | Notes |
|-------|------|-------|
| `AcademicCalendar` | `src/models/AcademicCalendar.ts` | School calendar container |
| `AcademicCalendarEvent` | `src/models/AcademicCalendarEvent.ts` | Already has `eventType: "exam"` — use for published exam entries |
| Admin calendar | `src/app/(app)/admin/academic-calendar/page.tsx` | Admin UI |
| Teacher calendar API | `src/app/api/teacher/calendar/route.ts` | Aggregated events |
| Parent calendar API | `src/app/api/parent/calendar/route.ts` | Ward-scoped events |

Republish must update/replace events by stable `sourceRefId` to avoid duplicates.

---

## 10. Auth, Permissions, Scoping

| Helper | Path | Use |
|--------|------|-----|
| `requireSchoolAdmin` | `src/lib/auth/requireSchoolAdmin.ts` | Admin mutations |
| `requireSchoolAdminOrDelegatedPermission` | `src/lib/auth/requireSchoolAdminOrDelegatedPermission.ts` | Granular `exam.*` permissions (add in later slice) |
| `requireSchoolMember` | `src/lib/auth/requireSchoolMember.ts` | Teacher/parent/student reads |
| `mergedDelegationPermissions` | `src/lib/delegations/` | Delegate exam officer access |
| Delegation registry | `src/lib/delegations/registry.ts` | Has `timetable` module — add `exams` module in Slice 4+ |

**All exam records:** `schoolId` required. Cross-school access forbidden.

Suggested permission keys (spec §9): `exam.sessions.*`, `exam.timetable.*`, `exam.invigilators.*`, etc.

---

## 11. Audit Trail

| Asset | Path | Exam audit (Slice 17+) |
|-------|------|------------------------|
| `writeTransactionalAuditEvent` | `src/lib/audit/writeTransactionalAuditEvent.ts` | Tier-0 transactional audit |
| `AuditEvent` | `src/models/AuditEvent.ts` | Normalized audit stream |
| Timetable audit | `src/lib/timetable/audit.ts` | Domain-specific change log pattern |
| Assessment marks audit | `src/lib/academics/assessment-engine/assessment-marks-audit.ts` | Marks-specific audit |

---

## 12. Exports / PDF (Slice 29)

| Pattern | Path |
|---------|------|
| Proposal PDF (react-pdf) | `src/lib/proposals/render-pdf.tsx`, `src/app/api/platform/proposals/[proposalId]/generate-pdf/route.ts` |
| Exam paper PDF | `src/app/api/teacher/examinations/[examPaperId]/export/pdf/route.ts` |
| Parent report download | `src/app/api/parent/reports/download/route.ts` |

Use existing PDF/branding conventions for timetable exports.

---

## 13. Leo AI (Slices 32)

| Asset | Path |
|-------|------|
| Tool registry | `src/lib/leo/tool-registry.ts` |
| Action registry | `src/lib/leo/action-registry.ts` |
| Timetable status tool | `src/lib/leo/tools/class-timetable-status.ts` |
| Teacher conflict tool | `src/lib/leo/tools/teacher-assignment-conflicts.ts` |

Leo exam scheduling must remain **advisory only** — draft proposals, conflict explanations, no auto-publish.

---

## 14. UI Primitives (use for all exam pages)

Premium glass workspace standard per `AGENTS.md`:

| Primitive | Path |
|-----------|------|
| `WorkspacePageShell` | `src/components/ui/workspace-page-shell.tsx` |
| `WorkspacePageHeader` | `src/components/ui/workspace-page-header.tsx` |
| `GlassPanel` | `src/components/ui/glass-panel.tsx` |
| Glass tokens | `src/lib/ui/glass-surfaces.ts` |
| `ResponsiveModal` | `src/components/ui/responsive-modal.tsx` |
| `useConfirmationDialog` | `src/components/ui/confirmation-dialog.tsx` |
| `CustomDatePicker` | `src/components/ui/custom-date-picker.tsx` |
| `PremiumSelect` / `PremiumDropdownMenu` | `src/components/ui/premium-select.tsx`, `premium-dropdown-menu.tsx` |
| Reference UI | `src/components/admin/students/detail/StudentOverviewTab.tsx` |

Assessment admin reference (forms/wizards):

```
src/app/(app)/admin/academics/assessment-plans/page.tsx
src/components/admin/academics/assessment-plans/AssessmentPlanWizard.tsx
src/components/admin/academics/grading/GradingPolicyDrawer.tsx
```

---

## 15. Planned New Module Boundary

### Types & constants (Slice 2)

```
src/types/academics/exam-scheduling-engine.ts
src/constants/academics/exam-scheduling-engine.ts
src/models/academics/exam-scheduling-engine-schemas.ts
```

### Models (Slices 2–3, 21)

```
ExamSession              (Slice 2)
ExamTimetableEntry       (Slice 2)
ExamInvigilatorAssignment (Slice 2)
ExamVenue                (Slice 2)
ExamPolicy               (Slice 3)
ExamTimetableVersion     (Slice 21) ✅
ExamConflictSnapshot     (Slice 17)
ExamIncidentReport       (Slice 26) ✅
ExamStudentSittingStatus (Slice 26 stub) ✅
```

### Services (Slices 4–21)

```
src/lib/exams/exam-session-service.ts
src/lib/exams/exam-venue-service.ts
src/lib/exams/exam-timetable-entry-service.ts
src/lib/exams/exam-invigilator-service.ts
src/lib/exams/exam-conflict-service.ts
src/lib/exams/exam-publish-service.ts
src/lib/exams/exam-assessment-link-service.ts
src/lib/exams/exam-readiness-service.ts
src/lib/exams/exam-notifications.ts
src/lib/exams/exam-teacher-service.ts
src/lib/exams/exam-day-operations-service.ts
src/lib/exams/exam-published-view-service.ts
```

### Admin API routes (Slices 4–21)

```
src/app/api/admin/exams/sessions/
src/app/api/admin/exams/venues/
src/app/api/admin/exams/sessions/[sessionId]/entries/
src/app/api/admin/exams/sessions/[sessionId]/invigilators/
src/app/api/admin/exams/sessions/[sessionId]/conflicts/
src/app/api/admin/exams/sessions/[sessionId]/entries/[entryId]/assessment-link/
src/app/api/admin/exams/sessions/[sessionId]/entries/[entryId]/assessment-link/candidates/
src/app/api/admin/exams/sessions/[sessionId]/missing-assessment-links/
src/app/api/admin/exams/sessions/[sessionId]/publish/
src/app/api/admin/exams/sessions/[sessionId]/publish/readiness/
src/app/api/admin/exams/sessions/[sessionId]/versions/
src/app/api/admin/exams/sessions/[sessionId]/versions/[versionId]/
```

### Admin UI (Slices 6–22)

```
src/app/(app)/admin/exams/sessions/
src/app/(app)/admin/exams/sessions/[sessionId]/timetable/
src/app/(app)/admin/exams/sessions/[sessionId]/conflicts/
src/app/(app)/admin/exams/venues/
src/app/(app)/admin/exams/settings/
```

### Teacher UI (Slices 24–26)

```
src/app/(app)/teacher/exams/
src/app/api/teacher/exams/
```

### Parent / student UI (Slice 27)

```
src/app/(app)/parent/academics/ (extend or sub-route)
src/app/(app)/student/academics/ (extend or sub-route)
src/app/api/parent/exams/
src/app/api/student/exams/
```

### Calendar sync (Slice 28)

```
src/models/ExamCalendarEventLink.ts
src/lib/exams/exam-calendar-sync-service.ts
src/lib/exams/exam-scheduler-validation.ts (combineExamDateAndTime, buildExamCalendarSourceRefKey)
ExamPublishModal syncToCalendar toggle → POST publish body syncToCalendar
```

Republish upserts by `sourceRefKey`; stale links cancelled when entries drop from publish set.

### Exports (Slice 29)

```
src/lib/exams/exam-export-service.ts
src/lib/exams/exam-timetable-export-pdf.ts
GET /api/admin/exams/sessions/[sessionId]/export/csv
GET /api/admin/exams/sessions/[sessionId]/export/pdf
ExamTimetableBuilder Export menu (published + working draft modes)
```

### Smart scheduler backend (Slice 30)

```
src/lib/exams/exam-smart-scheduler-service.ts
POST /api/admin/exams/sessions/[sessionId]/scheduler/generate
POST /api/admin/exams/sessions/[sessionId]/scheduler/apply
tests/exam-engine.scheduler.test.ts
```

Does not auto-publish. Slice 31 adds the assisted scheduling wizard UI.

### Smart scheduler UI (Slice 31)

```
src/components/admin/exams/ExamSmartSchedulerModal.tsx
src/hooks/admin/useExamSmartScheduler.ts
ExamTimetableBuilder Smart schedule action
```

### Leo advisory (Slice 32)

```
src/lib/leo/exam-scheduling-advisory-shared.ts
POST /api/admin/exams/sessions/[sessionId]/leo/*
src/hooks/admin/useExamSchedulingLeo.ts
src/components/admin/exams/ExamSchedulingLeoPanel.tsx
```

Integrated on timetable builder, conflict review, publish modal, and invigilator drawer. Advisory only.

### Analytics (Slice 33)

```
src/lib/exams/exam-analytics-service.ts
GET /api/admin/exams/analytics
src/app/(app)/admin/exams/analytics/page.tsx
src/components/admin/exams/ExamAnalyticsDashboard.tsx
```

### Hardening (Slice 34)

```
src/lib/exams/exam-hardening.ts
src/components/admin/exams/ExamWorkspaceErrorState.tsx
tests/exam-engine.hardening.test.ts
docs/EXAM_ENGINE_MIGRATION_NOTES.md
docs/EXAM_ENGINE_QA_CHECKLIST.md
```

Publish guardrails, parent/student visibility helpers, shared error states, route + API registry entries, migration notes, and QA checklist.

---

## 16. Navigation Placement (recommended)

Add under **Academics** in `src/components/nav/sidebars/school-admin-sidebar.tsx`:

```
Exam Sessions        → /admin/exams/sessions
Exam Venues          → /admin/exams/venues
Exam Settings        → /admin/exams/settings
```

Teacher sidebar (`src/components/nav/sidebars/teacher-sidebar.tsx`):

```
My Exams             → /teacher/exams
```

Keep `/admin/examinations` (question bank) separate from `/admin/exams/*` (scheduling).

---

## 17. Subscription / Feature Gating

Check `src/lib/subscriptions/route-registry.ts` when adding admin routes. New exam module may need a `FEATURE_KEYS` entry and route registry row before production gating.

---

## 18. Slice Dependency Order (from spec §25.4)

```
Slice 1  → Integration map (this file)
Slice 2  → Core models
Slice 3  → ExamPolicy
Slice 4–5 → Session + venue APIs
Slice 6–8 → Session + venue UI
Slice 9–11 → Timetable entry API + builder UI + bulk draft
Slice 12–13 → Invigilator backend + UI
Slice 14–17 → Conflicts + override
Slice 18–19 → Assessment linking
Slice 20–22 → Publish + version UI
Slice 23–29 → Notifications, teacher/parent views, calendar, exports
Slice 30–32 → Smart scheduler + Leo
Slice 33–34 → Analytics + hardening
```

Do not build parent view before publish/versioning. Do not build smart scheduling before manual + conflicts.

---

## 19. Risks & Decisions Logged

1. **No Room model** — exam venues are net-new (`ExamVenue`), not class timetable `roomId`.
2. **ExamPaper vs ExamSession** — naming collision in product language; use "Exam Timetables" in UI.
3. **AssessmentItem auto-create** — requires `assessmentPlanId`, `teacherId`; resolve via `TeacherAssignment` + grade plan lookup.
4. **Notification type enum** — may need extending beyond current `NotificationType` values.
5. **TeacherDutyAssignment** — keep separate from `ExamInvigilatorAssignment` unless reconciled explicitly.

---

## 20. Slice Progress Tracker

| Slice | Name | Status |
|-------|------|--------|
| 1 | Domain Audit and Integration Map | ✅ Complete |
| 2 | Core Models and Types | ✅ Complete |
| 3 | Exam Policy Model and Defaults | ✅ Complete |
| 4 | Exam Session Server Actions/API | ✅ Complete |
| 5 | Venues Server Actions/API | ✅ Complete |
| 6 | Exam Sessions UI | ✅ Complete |
| 7 | Create Exam Session Wizard | ✅ Complete |
| 8 | Venues UI | ✅ Complete |
| 9 | Timetable Entry Server Actions/API | ✅ Complete |
| 10 | Timetable Builder UI - Basic Table | ✅ Complete |
| 11 | Bulk Draft Entry Generation | ✅ Complete |
| 12 | Invigilator Assignment Backend | ✅ Complete |
| 13 | Invigilator Assignment UI | ✅ Complete |
| 14 | Conflict Detection Engine - Core | ✅ Complete |
| 15 | Conflict Review UI | ✅ Complete |
| 16 | Conflict Resolution Actions | ✅ Complete |
| 17 | Conflict Override Workflow | ✅ Complete |
| 18 | Assessment Item Linking Backend | ✅ Complete |
| 19 | Assessment Link UI | ✅ Complete |
| 20 | Publishing Readiness Backend | ✅ Complete |
| 21 | Timetable Publishing and Versioning | ✅ Complete |
| 22 | Publish UI and Version History | ✅ Complete |
| 23 | Notifications Integration | ✅ Complete |
| 24 | Teacher My Exams Backend | ✅ Complete |
| 25 | Teacher My Exams UI | ✅ Complete |
| 26 | Exam Day Operations | ✅ Complete |
| 27 | Parent/Student Published Exam View | ✅ Complete |
| 28 | Calendar Integration | ✅ Complete |
| 29 | Export System | ✅ Complete |
| 30 | Smart-Assisted Scheduler Backend | ✅ Complete |
| 31 | Smart Scheduler UI | ✅ Complete |
| 32 | Leo-Assisted Scheduling | ✅ Complete |
| 33 | Analytics and Readiness Dashboard | ✅ Complete |
| 34 | Final Hardening and Migration Notes | ✅ Complete |

**Overall:** 34 / 34 slices complete (100%)

See also:

- `docs/EXAM_ENGINE_MIGRATION_NOTES.md` — rollout and tenancy notes
- `docs/EXAM_ENGINE_QA_CHECKLIST.md` — manual QA before production enablement
