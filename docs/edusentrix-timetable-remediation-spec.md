# EduSentrix Timetable & Class Scheduling Remediation Spec

## Document Status

**Product:** EduSentrix Web  
**Area:** Class scheduling / timetables / teacher assignments / subject-class links  
**Purpose:** Resolve scheduling conflicts, accidental cross-class deletion, stale linked-module data, and legacy scheduling ambiguity.  
**Compatibility stance:** Backwards compatibility is **not required** because there are no real schools using the system yet. Existing test data may be reset or migrated.

---

## 1. Problem Summary

EduSentrix currently supports class group timetable creation. A grade can have multiple class groups, for example:

- Primary 6 A
- Primary 6 B

A teacher may teach the same subject across multiple class groups. For example, one teacher may teach Mathematics in both Primary 6 A and Primary 6 B.

The system must prevent this teacher from being scheduled in two class groups at the same time. If the admin schedules Mathematics for Primary 6 A from `08:00–09:00`, then tries to schedule the same teacher for Mathematics in Primary 6 B from `08:00–09:00`, the system must immediately flag the conflict before the review/publish step.

Current issues observed:

1. Teacher conflicts may not be caught immediately.
2. Some conflicts are discovered too late in the flow.
3. A timetable slot may be created without a teacher, weakening teacher conflict detection.
4. Teacher, subject, class group, and timetable modules are linked but may not update consistently across the UI without refresh.
5. Deleting one class group’s schedule can appear to delete or affect another class group’s schedule.
6. Legacy assignment-level scheduling creates ambiguity between `TeacherAssignment` and `TimetableSlot`.

---

## 2. Remediation Goal

Build a clean, reliable, school-wide timetable system where:

1. `TeacherAssignment` defines **who teaches what**.
2. `TimetableSlot` defines **when teaching happens**.
3. Teacher, class, subject, and room conflicts are caught immediately during slot creation or update.
4. No timetable operation on one class group accidentally deletes or mutates another class group’s timetable.
5. Linked modules stay consistent through targeted cache invalidation and live schedule events.
6. Legacy scheduling fields and dual-write behavior are removed.
7. Published timetables are treated as immutable snapshots.
8. Draft timetables remain editable and conflict-aware.
9. The system is ready for world-class scheduling features such as teacher availability, room conflicts, contact-hour validation, and live collaborative updates.

---

## 3. Key Design Decision

### 3.1 Source of Truth Rule

The system must follow this rule:

```txt
TeacherAssignment = teaching responsibility
TimetableSlot = actual scheduled lesson time
```

This means:

- `TeacherAssignment` must not store lesson times.
- `TimetableSlot` must be the only source of truth for scheduled periods.
- Teacher workload/contact-hour planning may exist on `TeacherAssignment`, but the actual placed times must live only in `TimetableSlot`.

---

## 4. Current Problem Areas to Remove or Refactor

### 4.1 Remove Legacy Assignment-Level Schedule Fields

The existing `TeacherAssignment` model contains legacy schedule fields similar to:

```ts
schedule?: {
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
  location?: string;
};

schedules?: Array<{
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  location?: string;
  roomId?: Types.ObjectId;
}>;
```

These fields must be removed or permanently ignored.

#### Required Action

Remove from `TeacherAssignment`:

```ts
schedule
schedules
```

Remove all form inputs, payload handling, validation logic, or controller logic that attempts to create or update assignment-level schedules.

#### Reason

These fields compete with `TimetableSlot` and make it unclear whether the timetable source of truth is:

- teacher assignment schedule, or
- class timetable slot.

This ambiguity can cause sync bugs, stale displays, duplicate writes, and cross-module inconsistency.

---

### 4.2 Remove or Disable Dual-Write Scheduling Logic

Any dual-write logic that writes from assignment-level schedules into timetable slots must be removed.

Likely code area:

```txt
src/lib/timetable/dual-write.ts
```

#### Required Action

Remove or retire dual-write logic.

The system must no longer try to keep assignment schedules and timetable slots in sync, because only timetable slots should contain actual time placements.

#### Replacement

When a teacher assignment changes, the system should not create hidden schedule writes. Instead, it should:

1. Update the teacher assignment.
2. Identify affected timetable slots.
3. Update affected **draft** slots if safe.
4. Mark affected published timetable versions as stale.
5. Notify the admin that timetable review/republish is needed.

---

### 4.3 Stop Silently Mutating Published Timetables

A published timetable should be treated as a historical/live snapshot.

If a teacher assignment changes after publishing, the system must not silently rewrite the published timetable.

#### Required Action

Refactor any sync function that updates both draft and published timetable slots.

For example, any logic similar to:

```ts
status: { $in: ["draft", "published"] }
```

should be changed to:

```ts
status: "draft"
```

#### Correct Behavior

When a teacher/subject/class assignment changes:

- update the draft timetable if possible,
- mark published timetable as stale,
- show a UI warning:

```txt
The published timetable may be outdated because teacher assignments changed. Review and republish the timetable.
```

---

## 5. Target Data Model

### 5.1 TimetableVersion

Represents the timetable version for a school and academic period.

#### Fields

```ts
{
  _id: ObjectId;
  schoolId: ObjectId;
  academicPeriodId: ObjectId;
  status: "draft" | "published" | "archived";
  versionLabel?: string;
  createdBy?: ObjectId;
  publishedBy?: ObjectId;
  publishedAt?: Date;
  archivedAt?: Date;
  stale?: boolean;
  staleReasons?: Array<{
    sourceModule:
      | "teacher"
      | "subject"
      | "subjectOffering"
      | "classGroup"
      | "teacherAssignment"
      | "schoolDailySchedule";
    sourceEntityId?: ObjectId;
    message: string;
    createdAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}
```

#### Required Indexes

Only one draft version per school and academic period:

```ts
timetableVersionSchema.index(
  { schoolId: 1, academicPeriodId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "draft" },
  }
);
```

Only one published version per school and academic period:

```ts
timetableVersionSchema.index(
  { schoolId: 1, academicPeriodId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "published" },
  }
);
```

---

### 5.2 TeacherAssignment

Defines who teaches which subject/class/offering.

#### Fields

```ts
{
  _id: ObjectId;
  schoolId: ObjectId;
  academicPeriodId: ObjectId;

  teacherId: ObjectId;
  classGroupId: ObjectId;
  subjectId: ObjectId;
  subjectOfferingId?: ObjectId | null;

  contactHoursPerWeek?: number;
  status: "active" | "inactive" | "archived";

  assignedAt?: Date;
  assignedBy?: ObjectId;

  createdAt: Date;
  updatedAt: Date;
}
```

#### Forbidden Fields

Do not keep:

```ts
schedule
schedules
```

#### Required Indexes

Prevent duplicate active assignment for same teacher/subject/class/period:

```ts
teacherAssignmentSchema.index(
  {
    schoolId: 1,
    academicPeriodId: 1,
    teacherId: 1,
    classGroupId: 1,
    subjectId: 1,
    subjectOfferingId: 1,
    status: 1,
  },
  {
    unique: true,
    partialFilterExpression: { status: "active" },
  }
);
```

Support lookup by class and subject:

```ts
teacherAssignmentSchema.index({
  schoolId: 1,
  academicPeriodId: 1,
  classGroupId: 1,
  subjectId: 1,
  subjectOfferingId: 1,
  status: 1,
});
```

Support lookup by teacher:

```ts
teacherAssignmentSchema.index({
  schoolId: 1,
  academicPeriodId: 1,
  teacherId: 1,
  status: 1,
});
```

---

### 5.3 TimetableSlot

Defines actual scheduled teaching time.

#### Fields

```ts
{
  _id: ObjectId;
  schoolId: ObjectId;
  academicPeriodId: ObjectId;
  versionId: ObjectId;

  classGroupId: ObjectId;
  gradeId?: ObjectId | null;

  subjectId: ObjectId;
  subjectOfferingId?: ObjectId | null;

  teacherId: ObjectId;

  dayOfWeek: number; // 1-5 or 1-7 depending system convention
  startTime: string; // HH:mm
  endTime: string; // HH:mm

  roomId?: ObjectId | null;
  classroomLabel?: string | null;

  source: "manual" | "ai_generated" | "imported";
  status: "active" | "draft_removed";

  createdBy?: ObjectId;
  updatedBy?: ObjectId;

  createdAt: Date;
  updatedAt: Date;
}
```

#### Important Rule

For normal teaching slots, `teacherId` should be required.

If a slot is intentionally created without a teacher, it should use a separate explicit mode:

```ts
teacherAssignmentMode: "assigned" | "unassigned_placeholder"
```

Default behavior should not allow missing teacher IDs.

#### Required Indexes

Support overlap queries:

```ts
timetableSlotSchema.index({
  schoolId: 1,
  academicPeriodId: 1,
  versionId: 1,
  teacherId: 1,
  dayOfWeek: 1,
  startTime: 1,
  endTime: 1,
});
```

```ts
timetableSlotSchema.index({
  schoolId: 1,
  academicPeriodId: 1,
  versionId: 1,
  classGroupId: 1,
  dayOfWeek: 1,
  startTime: 1,
  endTime: 1,
});
```

```ts
timetableSlotSchema.index({
  schoolId: 1,
  academicPeriodId: 1,
  versionId: 1,
  roomId: 1,
  dayOfWeek: 1,
  startTime: 1,
  endTime: 1,
});
```

Prevent exact duplicate class slots:

```ts
timetableSlotSchema.index(
  {
    schoolId: 1,
    academicPeriodId: 1,
    versionId: 1,
    classGroupId: 1,
    dayOfWeek: 1,
    startTime: 1,
    endTime: 1,
  },
  { unique: true }
);
```

Prevent exact duplicate teacher slots:

```ts
timetableSlotSchema.index(
  {
    schoolId: 1,
    academicPeriodId: 1,
    versionId: 1,
    teacherId: 1,
    dayOfWeek: 1,
    startTime: 1,
    endTime: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      teacherId: { $exists: true, $ne: null },
    },
  }
);
```

Note: These indexes do not catch partial overlaps like `08:00–09:00` and `08:30–09:30`. Partial overlaps must still be handled by application-level validation.

---

### 5.4 TimetableConflict

Stores detected timetable issues.

#### Fields

```ts
{
  _id: ObjectId;
  schoolId: ObjectId;
  academicPeriodId: ObjectId;
  versionId: ObjectId;

  code:
    | "TEACHER_OVERLAP"
    | "CLASS_OVERLAP"
    | "ROOM_OVERLAP"
    | "INVALID_TIME_RANGE"
    | "MISSING_TEACHER"
    | "MISSING_SUBJECT"
    | "MISSING_CLASSGROUP"
    | "MISSING_CLASSROOM_LABEL"
    | "OUTSIDE_PERIOD_RANGE"
    | "TEACHER_PENDING_ASSIGNMENT"
    | "TEACHER_NOT_ASSIGNED_TO_SUBJECT_CLASS"
    | "SUBJECT_NOT_ASSIGNED_TO_CLASS"
    | "TEACHER_UNAVAILABLE"
    | "INACTIVE_TEACHER"
    | "INACTIVE_SUBJECT"
    | "INACTIVE_CLASSGROUP"
    | "SUBJECT_CONTACT_HOURS_EXCEEDED"
    | "SUBJECT_CONTACT_HOURS_SHORTFALL"
    | "BREAK_OVERLAP";

  severity: "error" | "warning" | "info";

  slotId?: ObjectId;
  relatedSlotId?: ObjectId;

  classGroupId?: ObjectId;
  teacherId?: ObjectId;
  subjectId?: ObjectId;
  roomId?: ObjectId;

  message: string;
  metadata?: Record<string, unknown>;

  resolved: boolean;
  resolvedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}
```

---

### 5.5 ScheduleChangeEvent

Powers live frontend consistency without manual refresh.

#### Fields

```ts
{
  _id: ObjectId;
  schoolId: ObjectId;
  academicPeriodId?: ObjectId;

  entityType:
    | "teacher"
    | "subject"
    | "subjectOffering"
    | "classGroup"
    | "teacherAssignment"
    | "timetableSlot"
    | "timetableVersion"
    | "schoolDailySchedule";

  entityId: ObjectId;

  action:
    | "created"
    | "updated"
    | "deleted"
    | "published"
    | "archived"
    | "stale_marked";

  affectedClassGroupIds?: ObjectId[];
  affectedTeacherIds?: ObjectId[];
  affectedSubjectIds?: ObjectId[];
  affectedRoomIds?: ObjectId[];

  message?: string;
  createdBy?: ObjectId;
  createdAt: Date;
}
```

---

## 6. Backend Slot Creation Flow

### 6.1 Endpoint

Likely route:

```txt
POST /api/admin/classes/[id]/timetable/slots
```

### 6.2 Required Behavior

When creating a timetable slot:

1. Authenticate user.
2. Resolve `schoolId`.
3. Validate class group belongs to school.
4. Resolve current academic period.
5. Find or create the single school-wide draft timetable version.
6. Validate subject belongs to class group or subject offering.
7. Resolve teacher from explicit payload or active teacher assignment.
8. Validate teacher assignment exists.
9. Validate time range.
10. Run immediate conflict detection.
11. Block hard conflicts.
12. Create slot.
13. Recompute related conflict summaries.
14. Write schedule change event.
15. Return created slot and warnings.

### 6.3 Teacher Resolution

The backend must not rely only on the frontend to send `teacherId`.

Implement:

```ts
async function resolveTeacherForTimetableSlot({
  schoolId,
  academicPeriodId,
  classGroupId,
  subjectId,
  subjectOfferingId,
  explicitTeacherId,
}: {
  schoolId: Types.ObjectId;
  academicPeriodId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  subjectId: Types.ObjectId;
  subjectOfferingId?: Types.ObjectId | null;
  explicitTeacherId?: Types.ObjectId | null;
}) {
  if (explicitTeacherId) return explicitTeacherId;

  const assignment = await TeacherAssignment.findOne({
    schoolId,
    academicPeriodId,
    classGroupId,
    subjectId,
    ...(subjectOfferingId ? { subjectOfferingId } : {}),
    status: "active",
  })
    .sort({ assignedAt: 1, createdAt: 1, _id: 1 })
    .select("teacherId")
    .lean();

  return assignment?.teacherId ?? null;
}
```

### 6.4 Missing Teacher Behavior

If no teacher can be resolved:

```http
409 Conflict
```

Response:

```json
{
  "success": false,
  "error": "No active teacher assignment exists for this subject and class group.",
  "code": "MISSING_TEACHER",
  "issues": [
    {
      "code": "MISSING_TEACHER",
      "severity": "error",
      "message": "Assign a teacher to this subject and class group before scheduling it."
    }
  ]
}
```

Unless the product explicitly supports placeholder/unassigned lessons, missing teacher should block normal slot creation.

---

## 7. Conflict Detection Rules

### 7.1 Time Overlap Logic

Two slots overlap if:

```ts
existing.startTime < newEndTime && existing.endTime > newStartTime
```

This catches:

- same exact time,
- partial overlap,
- contained intervals,
- enclosing intervals.

Example:

```txt
Existing: 08:00–09:00
New:      08:30–09:30
Conflict: yes
```

---

### 7.2 Hard Conflicts

Hard conflicts must block creation/update.

#### TEACHER_OVERLAP

Same teacher scheduled at overlapping time in the same timetable version.

Query:

```ts
{
  schoolId,
  academicPeriodId,
  versionId,
  teacherId,
  dayOfWeek,
  _id: { $ne: currentSlotId },
  startTime: { $lt: newEndTime },
  endTime: { $gt: newStartTime },
}
```

Message:

```txt
This teacher is already scheduled for another class group during this time.
```

#### CLASS_OVERLAP

Same class group has another lesson at overlapping time.

Query:

```ts
{
  schoolId,
  academicPeriodId,
  versionId,
  classGroupId,
  dayOfWeek,
  _id: { $ne: currentSlotId },
  startTime: { $lt: newEndTime },
  endTime: { $gt: newStartTime },
}
```

Message:

```txt
This class group already has another lesson during this time.
```

#### ROOM_OVERLAP

Same room used by another class at overlapping time.

Only applies when `roomId` exists.

Query:

```ts
{
  schoolId,
  academicPeriodId,
  versionId,
  roomId,
  dayOfWeek,
  _id: { $ne: currentSlotId },
  startTime: { $lt: newEndTime },
  endTime: { $gt: newStartTime },
}
```

Message:

```txt
This room is already assigned to another lesson during this time.
```

#### INVALID_TIME_RANGE

`endTime` must be after `startTime`.

#### MISSING_TEACHER

No teacher was sent and no active teacher assignment could be resolved.

#### SUBJECT_NOT_ASSIGNED_TO_CLASS

The selected subject or subject offering is not part of the class group’s valid subject set.

#### TEACHER_NOT_ASSIGNED_TO_SUBJECT_CLASS

The selected teacher is not actively assigned to teach that subject in that class group for the academic period.

#### INACTIVE_TEACHER / INACTIVE_SUBJECT / INACTIVE_CLASSGROUP

A slot cannot be created with inactive/deleted linked entities.

---

### 7.3 Soft Conflicts / Warnings

Soft conflicts should show warnings but may allow continuation depending on permission and business rules.

Examples:

```txt
SUBJECT_CONTACT_HOURS_EXCEEDED
SUBJECT_CONTACT_HOURS_SHORTFALL
TEACHER_PENDING_ASSIGNMENT
CLASS_DAILY_LOAD_EXCEEDED
CLASS_SUBJECT_DUPLICATE_SAME_DAY
```

However:

```txt
TEACHER_OVERLAP
CLASS_OVERLAP
ROOM_OVERLAP
```

should be hard blockers by default.

---

## 8. Override Policy

The current UI behavior allows conflict override for some schedule creation flows.

This must be restricted.

### 8.1 Non-Overrideable Conflicts

The following must not be overrideable:

```txt
TEACHER_OVERLAP
CLASS_OVERLAP
ROOM_OVERLAP
INVALID_TIME_RANGE
MISSING_TEACHER
TEACHER_NOT_ASSIGNED_TO_SUBJECT_CLASS
SUBJECT_NOT_ASSIGNED_TO_CLASS
INACTIVE_TEACHER
INACTIVE_SUBJECT
INACTIVE_CLASSGROUP
```

### 8.2 Overrideable Warnings

The following may be overrideable by school admin:

```txt
SUBJECT_CONTACT_HOURS_EXCEEDED
SUBJECT_CONTACT_HOURS_SHORTFALL
CLASS_SUBJECT_DUPLICATE_SAME_DAY
TEACHER_PENDING_ASSIGNMENT
```

### 8.3 UI Copy Change

Do not show:

```txt
Override and add
```

for hard conflicts.

Instead show:

```txt
Choose another time
```

or:

```txt
Resolve conflict
```

---

## 9. Backend Slot Update Flow

### 9.1 Endpoint

Likely route:

```txt
PATCH /api/admin/classes/[id]/timetable/slots/[slotId]
```

### 9.2 Required Behavior

Same as slot creation, except:

1. Existing slot must belong to:
   - current school,
   - current class group,
   - current academic period,
   - current draft version.
2. Conflict query must exclude the current slot ID.
3. If `subjectId`, `subjectOfferingId`, or `teacherId` changes, revalidate assignment.
4. Write schedule change event after successful update.
5. Recompute conflicts for affected class group, teacher, room, and timetable version.

---

## 10. Backend Slot Delete Flow

### 10.1 Single Slot Delete Endpoint

Likely route:

```txt
DELETE /api/admin/classes/[id]/timetable/slots/[slotId]
```

### 10.2 Required Query Scope

Single slot deletion must always include:

```ts
{
  _id: slotId,
  schoolId,
  academicPeriodId,
  classGroupId,
  versionId: draftVersionId
}
```

This prevents deleting a slot outside the current class group or version.

### 10.3 Required Behavior

1. Delete only the selected slot.
2. Recompute conflicts related to:
   - class group,
   - teacher,
   - room,
   - timetable version.
3. Write schedule change event:

```ts
{
  entityType: "timetableSlot",
  action: "deleted",
  affectedClassGroupIds: [classGroupId],
  affectedTeacherIds: [teacherId],
  affectedSubjectIds: [subjectId],
  affectedRoomIds: roomId ? [roomId] : []
}
```

4. Frontend must optimistically remove only that slot from the current class group’s timetable query.

---

## 11. Whole Class Timetable Delete Flow

If the product supports deleting all slots for a class group, this must be a separate explicit endpoint/action.

### 11.1 Endpoint

```txt
DELETE /api/admin/classes/[id]/timetable
```

or:

```txt
DELETE /api/admin/classes/[id]/timetable/slots
```

### 11.2 Confirmation Required

The UI must require a confirmation phrase:

```txt
DELETE CLASS TIMETABLE
```

### 11.3 Copy

```txt
This will delete all draft timetable slots for Primary 6 A only. It will not delete schedules for other class groups.
```

### 11.4 Required Query Scope

```ts
{
  schoolId,
  academicPeriodId,
  classGroupId,
  versionId: draftVersionId
}
```

### 11.5 Must Not Delete

This action must never delete:

- slots from another class group,
- slots from another academic period,
- slots from another school,
- slots from another timetable version unless explicitly selected.

---

## 12. Published Timetable Delete / Unpublish Flow

Published timetable deletion must be handled separately from draft slot deletion.

### 12.1 Product Language

Prefer:

```txt
Archive published timetable
```

instead of:

```txt
Delete published timetable
```

### 12.2 Correct Behavior

Archiving a published timetable should:

1. Mark published `TimetableVersion` as `archived`.
2. Leave slots intact for audit/history unless test-data cleanup mode is used.
3. Create schedule change event.
4. Show UI that no timetable is currently published.

### 12.3 Dangerous Cleanup Mode

Since there are no real schools yet, a development-only cleanup endpoint may delete published slots physically, but it must be gated by environment:

```env
ENABLE_DESTRUCTIVE_TEST_TOOLS=true
```

Do not expose physical published timetable deletion in normal production UI.

---

## 13. Draft Version Consistency

### 13.1 Rule

There must be exactly one active draft timetable version per school and academic period.

### 13.2 Required Function

`findOrCreateDraftVersion()` must be concurrency-safe.

Pseudo-code:

```ts
async function findOrCreateDraftVersion({ schoolId, academicPeriodId, actorId }) {
  const existing = await TimetableVersion.findOne({
    schoolId,
    academicPeriodId,
    status: "draft",
  });

  if (existing) return existing._id;

  try {
    const created = await TimetableVersion.create({
      schoolId,
      academicPeriodId,
      status: "draft",
      createdBy: actorId,
    });

    return created._id;
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      const existingAfterRace = await TimetableVersion.findOne({
        schoolId,
        academicPeriodId,
        status: "draft",
      });

      if (existingAfterRace) return existingAfterRace._id;
    }

    throw error;
  }
}
```

### 13.3 Reason

Without this, Primary 6 A and Primary 6 B may accidentally use different draft versions. If conflict detection is scoped to version ID, teacher overlaps across class groups would not be detected.

---

## 14. Publish Flow

### 14.1 Rule

Publishing should publish the **school-wide timetable version**, not just one class group.

### 14.2 UI Copy

The UI must make this clear:

```txt
Publish school timetable
```

not:

```txt
Publish class timetable
```

If the user is viewing Primary 6 A, the publish action should say:

```txt
This will publish the full school timetable for the selected academic period, including all class groups in this draft.
```

### 14.3 Publish Preconditions

Before publishing:

1. Recompute all timetable conflicts for the draft version.
2. Block publish if any hard conflicts exist.
3. Allow publish only if warnings are acknowledged.
4. Archive existing published version.
5. Mark draft version as published.
6. Create a fresh draft version for future edits.
7. Write `ScheduleChangeEvent`.

---

## 15. Linked Module Consistency

### 15.1 Modules That Affect Timetables

The following modules can affect schedules:

```txt
Teacher
Subject
SubjectOffering
ClassGroup
TeacherAssignment
SchoolDailySchedule
AcademicPeriod
Room/Classroom
```

### 15.2 Required Impact Handling

When any linked module changes, run impact detection.

#### Teacher Updated

If teacher name/photo changes:

- timetable display should update automatically through populated/refetched data.
- no schedule invalidation required unless status changes.

If teacher is deactivated:

- mark affected draft slots with conflict `INACTIVE_TEACHER`.
- mark published timetable stale.
- emit schedule event.

#### Subject Updated

If subject display name/code changes:

- timetable display should refetch.
- no conflict unless subject becomes inactive or removed from class.

If subject is deactivated:

- mark affected draft slots with `INACTIVE_SUBJECT`.
- mark published timetable stale.

#### Subject Removed From Class Group

If a subject offering is removed from a class group:

- affected draft slots should be marked with `SUBJECT_NOT_ASSIGNED_TO_CLASS`.
- admin should choose to remove or replace those slots.
- published timetable should be marked stale.

#### TeacherAssignment Changed

If teacher assignment changes for a class group + subject:

- update teacher on matching draft slots if unambiguous.
- if ambiguous, mark draft slots with `TEACHER_NOT_ASSIGNED_TO_SUBJECT_CLASS`.
- mark published timetable stale.
- emit schedule event.

#### ClassGroup Renamed

- timetable displays should refetch.
- no slot mutation required.

#### ClassGroup Deleted/Archived

- block deletion if active timetable slots exist, or require explicit archive cascade.
- do not silently delete schedules unless admin confirms.

---

## 16. Live UI Consistency

### 16.1 React Query Keys

Use specific query keys.

Recommended keys:

```ts
["class-timetable-slots", schoolId, academicPeriodId, classGroupId]
["class-subject-teachers", schoolId, academicPeriodId, classGroupId]
["teacher-assignments", schoolId, academicPeriodId]
["teacher-timetable", schoolId, academicPeriodId, teacherId]
["timetable-conflicts", schoolId, academicPeriodId, versionId]
["school-timetable-version", schoolId, academicPeriodId]
```

Avoid broad invalidation like:

```ts
queryClient.invalidateQueries({ queryKey: ["class-timetable-slots"] });
```

unless a school-wide timetable publish/archive happens.

### 16.2 Single Slot Delete Cache Update

When deleting one slot:

```ts
queryClient.setQueryData(
  ["class-timetable-slots", schoolId, academicPeriodId, classGroupId],
  (old) => {
    if (!old) return old;

    return {
      ...old,
      data: old.data.filter((slot) => slot.id !== deletedSlotId),
    };
  }
);
```

Then invalidate only the affected class group:

```ts
queryClient.invalidateQueries({
  queryKey: ["class-timetable-slots", schoolId, academicPeriodId, classGroupId],
});
```

Also invalidate related conflict/teacher timetable queries:

```ts
queryClient.invalidateQueries({
  queryKey: ["timetable-conflicts", schoolId, academicPeriodId],
  exact: false,
});

queryClient.invalidateQueries({
  queryKey: ["teacher-timetable", schoolId, academicPeriodId, teacherId],
});
```

### 16.3 SSE Schedule Events

Add endpoint:

```txt
GET /api/admin/schedule-events/stream
```

Frontend hook:

```ts
useScheduleEvents({
  schoolId,
  academicPeriodId,
  onEvent(event) {
    switch (event.entityType) {
      case "timetableSlot":
      case "teacherAssignment":
      case "classGroup":
      case "subject":
      case "subjectOffering":
      case "teacher":
        invalidateAffectedQueries(event);
        break;
    }
  },
});
```

### 16.4 Fallback Polling

If SSE is not implemented immediately, add short-term polling for timetable-critical pages:

```ts
refetchInterval: 30_000
```

Use SSE as the long-term solution.

---

## 17. Frontend UX Requirements

### 17.1 Immediate Conflict Feedback

When a user tries to add a timetable slot and the teacher is already booked:

Show a blocking modal or inline panel:

```txt
Teacher conflict detected

Mr. Kofi Mensah is already scheduled to teach Mathematics in Primary 6 A from 08:00–09:00 on Monday.

Choose another time for Primary 6 B or assign a different teacher.
```

Buttons:

```txt
Choose another time
View conflicting lesson
Cancel
```

Do not show:

```txt
Override and add
```

for this case.

---

### 17.2 Class Conflict Feedback

```txt
Class group conflict detected

Primary 6 A already has English Language scheduled from 08:00–09:00 on Monday.

A class group cannot have two lessons at the same time.
```

---

### 17.3 Room Conflict Feedback

```txt
Room conflict detected

Room 3 is already assigned to Primary 5 B from 08:00–09:00 on Monday.

Choose another room or another time.
```

---

### 17.4 Stale Published Timetable Banner

If the published timetable is stale:

```txt
Published timetable needs review

Some teacher, subject, or class group information changed after this timetable was published. Review the draft and republish to keep the live timetable accurate.
```

Buttons:

```txt
Review affected items
Open draft timetable
Republish
```

---

### 17.5 Dangerous Actions

For full class timetable deletion:

```txt
Delete Primary 6 A draft timetable?

This will remove all draft timetable slots for Primary 6 A only. It will not affect Primary 6 B or any other class group.

Type DELETE CLASS TIMETABLE to continue.
```

---

## 18. API Response Standard

### 18.1 Conflict Response

```json
{
  "success": false,
  "error": "This teacher is already scheduled for another class group during this time.",
  "code": "TEACHER_OVERLAP",
  "issues": [
    {
      "code": "TEACHER_OVERLAP",
      "severity": "error",
      "message": "Mr. Kofi Mensah is already scheduled to teach Mathematics in Primary 6 A from 08:00 to 09:00.",
      "relatedSlotId": "..."
    }
  ]
}
```

### 18.2 Successful Slot Creation Response

```json
{
  "success": true,
  "data": {
    "id": "...",
    "classGroupId": "...",
    "subjectId": "...",
    "subjectOfferingId": "...",
    "teacherId": "...",
    "dayOfWeek": 1,
    "startTime": "08:00",
    "endTime": "09:00"
  },
  "warnings": []
}
```

### 18.3 Successful Slot Creation With Warning

```json
{
  "success": true,
  "data": {
    "id": "..."
  },
  "warnings": [
    {
      "code": "SUBJECT_CONTACT_HOURS_EXCEEDED",
      "severity": "warning",
      "message": "Mathematics now exceeds the recommended weekly contact hours for Primary 6 A."
    }
  ]
}
```

---

## 19. Migration / Cleanup Plan

Because there are no real schools yet, use the cleanest path.

### 19.1 Option A: Reset Timetable Data

Recommended if current data is only test data.

1. Backup current database.
2. Delete all `TimetableSlot` documents.
3. Delete all `TimetableConflict` documents.
4. Delete all `TimetableVersion` documents.
5. Remove legacy schedule fields from all `TeacherAssignment` documents.
6. Recreate test assignments.
7. Recreate test timetables using new flow.

### 19.2 Option B: Lightweight Migration

If preserving test data matters:

1. For each `TeacherAssignment`, remove:
   - `schedule`
   - `schedules`
2. For each `TimetableSlot` with missing `teacherId`:
   - resolve teacher from active assignment.
   - if one assignment found, set `teacherId`.
   - if none found, mark slot invalid or delete it.
3. Ensure all draft slots point to the single active draft version per school/academic period.
4. Recompute all conflicts.
5. Mark all published timetables stale if linked assignment data changed.

---

## 20. Implementation Phases

### Phase 1 — Critical Bug Fixes

1. Add backend teacher resolver for slot creation/update.
2. Require teacher resolution for normal teaching slots.
3. Make `TEACHER_OVERLAP`, `CLASS_OVERLAP`, and `ROOM_OVERLAP` hard blockers.
4. Ensure one draft timetable version per school and academic period.
5. Fix single-slot delete scoping with `schoolId`, `academicPeriodId`, `classGroupId`, and `versionId`.
6. Narrow frontend React Query invalidation for slot delete/update/create.
7. Update UI copy to prevent unsafe “override” behavior.

### Phase 2 — Remove Legacy Scheduling

1. Remove `TeacherAssignment.schedule`.
2. Remove `TeacherAssignment.schedules`.
3. Remove assignment-level schedule inputs and validation.
4. Remove or retire `dual-write.ts`.
5. Make `TimetableSlot` the only schedule-time source.
6. Update tests and seed data.

### Phase 3 — Linked Module Consistency

1. Add schedule impact detection for teacher/subject/class/assignment changes.
2. Mark draft slots with relevant conflicts.
3. Mark published timetable as stale instead of silently mutating it.
4. Add stale published timetable banner.
5. Add `ScheduleChangeEvent` model.
6. Emit events from affected module mutations.

### Phase 4 — Live Updates

1. Add SSE endpoint.
2. Add frontend `useScheduleEvents()` hook.
3. Invalidate only affected queries based on event payload.
4. Add fallback polling where needed.
5. Test multi-tab and multi-admin update behavior.

### Phase 5 — World-Class Scheduling

1. Add teacher availability.
2. Add room/resource scheduling.
3. Add contact-hour validation.
4. Add break overlap detection.
5. Add class daily workload limits.
6. Add schedule health dashboard.
7. Add full timetable simulation tests.

---

## 21. Testing Requirements

### 21.1 Unit Tests

Test time overlap function:

```txt
08:00–09:00 overlaps 08:00–09:00
08:00–09:00 overlaps 08:30–09:30
08:00–09:00 overlaps 07:30–08:30
08:00–09:00 overlaps 07:30–09:30
08:00–09:00 does not overlap 09:00–10:00
08:00–09:00 does not overlap 07:00–08:00
```

### 21.2 Backend Integration Tests

#### Teacher Double Booking

Setup:

- Primary 6 A
- Primary 6 B
- Mathematics
- Same teacher assigned to both classes

Steps:

1. Create slot for Primary 6 A, Monday `08:00–09:00`.
2. Create slot for Primary 6 B, Monday `08:00–09:00`.

Expected:

```txt
Second request returns 409 TEACHER_OVERLAP.
```

#### Class Double Booking

1. Create Mathematics for Primary 6 A, Monday `08:00–09:00`.
2. Create English for Primary 6 A, Monday `08:30–09:30`.

Expected:

```txt
Second request returns 409 CLASS_OVERLAP.
```

#### Room Double Booking

1. Create slot in Room 3 for Primary 6 A, Monday `08:00–09:00`.
2. Create slot in Room 3 for Primary 6 B, Monday `08:30–09:30`.

Expected:

```txt
Second request returns 409 ROOM_OVERLAP.
```

#### Missing Teacher

1. Add subject to class group.
2. Do not assign teacher.
3. Try to schedule subject.

Expected:

```txt
Request returns 409 MISSING_TEACHER.
```

#### Delete One Slot

1. Create one slot for Primary 6 A.
2. Create one slot for Primary 6 B.
3. Delete Primary 6 A slot.

Expected:

```txt
Primary 6 A slot deleted.
Primary 6 B slot remains.
```

#### Delete Class Timetable

1. Create multiple slots for Primary 6 A.
2. Create multiple slots for Primary 6 B.
3. Delete Primary 6 A draft timetable.

Expected:

```txt
Only Primary 6 A slots deleted.
Primary 6 B slots remain.
```

#### Assignment Change

1. Create teacher assignment.
2. Create timetable slot.
3. Change teacher assignment.
4. Check draft slot.

Expected:

```txt
Draft slot updates if unambiguous, otherwise conflict is created.
Published version is marked stale if one exists.
```

---

## 22. Acceptance Criteria

The remediation is complete when:

1. A teacher cannot be scheduled in two class groups at overlapping times.
2. A class group cannot have two lessons at overlapping times.
3. A room cannot be used by two classes at overlapping times.
4. Slot creation fails immediately with a clear conflict response.
5. Hard conflicts cannot be overridden from the UI.
6. Slot creation resolves teacher from active assignment if the frontend omits teacher ID.
7. Missing teacher assignment blocks scheduling.
8. Deleting one slot does not delete another class group’s slot.
9. Deleting a class timetable deletes only that class group’s draft slots.
10. Publishing clearly applies to the full school timetable version.
11. Assignment-level schedule fields are removed or fully ignored.
12. `TimetableSlot` is the only source of truth for scheduled lesson times.
13. Published timetables are not silently mutated after linked module changes.
14. Changed teacher/subject/class group data updates the UI without manual refresh through targeted invalidation or SSE.
15. Conflict recomputation runs after slot create/update/delete and linked module changes.
16. Tests cover teacher overlap, class overlap, room overlap, missing teacher, stale published timetable, and delete isolation.

---

## 23. Developer Notes

### 23.1 Do Not Break Existing Working Code

Implement changes in this order:

1. Add tests around current behavior.
2. Add teacher resolver.
3. Strengthen conflict rules.
4. Fix delete scoping/cache invalidation.
5. Add draft version uniqueness.
6. Remove legacy schedule fields.
7. Add schedule events and live updates.

This order reduces the chance of breaking working timetable UI before the new architecture is stable.

### 23.2 No Backwards Compatibility Requirement

Because there are no real schools yet, prefer clean removal over compatibility layers.

Avoid carrying:

- old assignment schedules,
- hidden dual-write sync,
- mixed timetable sources,
- silent published timetable mutation.

A clean data model now will prevent serious production bugs later.

---

## 24. Final Target Behavior Example

Scenario:

- Primary 6 A has Mathematics with Mr. Mensah on Monday `08:00–09:00`.
- Primary 6 B also uses Mr. Mensah for Mathematics.
- Admin tries to schedule Primary 6 B Mathematics on Monday `08:00–09:00`.

Expected result:

```txt
Blocked immediately.
```

UI message:

```txt
Teacher conflict detected

Mr. Mensah is already scheduled to teach Mathematics in Primary 6 A from 08:00–09:00 on Monday.

Choose another time for Primary 6 B or assign another teacher.
```

Backend response:

```json
{
  "success": false,
  "code": "TEACHER_OVERLAP",
  "error": "This teacher is already scheduled for another class group during this time.",
  "issues": [
    {
      "code": "TEACHER_OVERLAP",
      "severity": "error",
      "message": "Mr. Mensah is already scheduled to teach Mathematics in Primary 6 A from 08:00 to 09:00 on Monday."
    }
  ]
}
```

This is the expected standard for the entire timetable engine.
