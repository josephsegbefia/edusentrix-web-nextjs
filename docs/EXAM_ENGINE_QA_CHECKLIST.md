# Exam Scheduling & Invigilation Engine — QA Checklist

Use this checklist before enabling the module for a production school tenant.

---

## Setup

- [ ] School admin can open **Exam Sessions**, **Exam Venues**, and **Exam Operations** from the sidebar.
- [ ] Create exam session wizard validates period, grades, and date range.
- [ ] Exam venues can be created, edited, and deactivated without affecting unrelated class timetables.

---

## Timetable builder

- [ ] Generate draft papers creates unscheduled rows for selected classes/subjects.
- [ ] Smart schedule wizard generates a reviewable draft; **Apply** does not auto-publish.
- [ ] Smart schedule draft can be **discarded** without mutating entries.
- [ ] Manual edit drawer saves date, time, venue, and instructions.
- [ ] Export menu downloads CSV and PDF for published and working draft modes.
- [ ] Empty state shows when no papers exist; loading and error states recover with retry.

---

## Invigilation

- [ ] Invigilators can be assigned per paper with role and notes.
- [ ] Invigilator drawer shows Leo replacement suggestions as advisory only.
- [ ] Teacher **My Exams** shows invigilation duties and timetable for published sessions only.

---

## Conflicts and readiness

- [ ] Intentional teacher/room/class overlap appears in conflict review.
- [ ] Fix actions open the correct modals and refresh conflict state.
- [ ] Override workflow requires reason when policy demands it.
- [ ] Leo conflict explain returns readable guidance without applying fixes automatically.
- [ ] Publish modal blocks when readiness errors exist; warnings require acknowledgement.

---

## Assessment linking

- [ ] Report-contributing papers without links appear in readiness blockers.
- [ ] Link existing or create new assessment items per class group.
- [ ] Linked items appear on teacher marks surfaces after exam date.

---

## Publish and versioning

- [ ] First publish creates version 1 and sets session to published.
- [ ] Republish creates version 2+ with change summary preserved in version history.
- [ ] Calendar sync toggle adds/updates calendar events without duplicates on republish.
- [ ] Locked/cancelled/archived sessions cannot publish.

---

## Role-specific views

- [ ] Teacher sees only their invigilation duties and teaching timetable entries.
- [ ] Parent **Upcoming Exams** shows published data for selected ward only.
- [ ] Student **Upcoming Exams** shows own class published papers only.
- [ ] Parent/student views never show draft papers, conflicts, or readiness scores.

---

## Exam day operations

- [ ] Teacher can mark paper started and completed on permitted entries.
- [ ] Incident report submits and surfaces in admin audit trail where configured.

---

## Analytics

- [ ] Exam Operations dashboard loads summary cards and session highlights.
- [ ] Drilldown links open timetable and conflict review for the correct session.
- [ ] Marks pending count reflects linked assessment items with incomplete scores.

---

## Security and tenancy

- [ ] Admin API routes reject invalid session/entry ids.
- [ ] Records from another school are not readable or writable (spot-check with two test schools if available).
- [ ] Parent cannot request another ward’s timetable by tampering with query params.

---

## Regression — existing academic flows

- [ ] Class teaching timetables still publish independently.
- [ ] Assessment plan and report run compile paths still work for non-exam assessments.
- [ ] `/admin/examinations` question bank unaffected.
- [ ] Student academic profile APIs unchanged for non-exam surfaces.

---

## Automated checks (developer)

```bash
node --test --import tsx tests/exam-engine.*.test.ts
npx eslint src/lib/exams src/components/admin/exams src/app/api/admin/exams
```

Expected unit suites: conflicts, assessment-link, teacher, day-ops, readiness, scheduler, hardening.
