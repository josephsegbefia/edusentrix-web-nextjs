import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detectExamSessionConflicts,
  groupExamConflictsBySeverity,
  computeExamReadinessScore,
  mergeConflictOverrides,
  summarizeActiveConflicts,
  type DetectExamSessionConflictsInput,
} from "../src/lib/exams/exam-conflict-detection";
import {
  buildConflictFixRequest,
  getConflictFixActions,
} from "../src/components/admin/exams/exam-conflict-actions";

const defaultPolicy: DetectExamSessionConflictsInput["policy"] = {
  requireVenue: true,
  requireInvigilator: true,
  preventRoomDoubleBooking: true,
  preventClassExamOverlap: true,
  preventTeacherInvigilationOverlap: true,
  allowConflictOverride: true,
};

const defaultSession: DetectExamSessionConflictsInput["session"] = {
  startDate: "2026-06-01T00:00:00.000Z",
  endDate: "2026-06-10T00:00:00.000Z",
};

test("detectExamSessionConflicts detects class overlap on same date", () => {
  const conflicts = detectExamSessionConflicts({
    session: defaultSession,
    policy: defaultPolicy,
    invigilators: [
      {
        id: "inv-1",
        examTimetableEntryId: "entry-a",
        teacherId: "teacher-a",
        status: "assigned",
      },
      {
        id: "inv-2",
        examTimetableEntryId: "entry-b",
        teacherId: "teacher-b",
        status: "assigned",
      },
    ],
    entries: [
      {
        id: "entry-a",
        date: "2026-06-02T00:00:00.000Z",
        startTime: "08:00",
        endTime: "10:00",
        durationMinutes: 120,
        venueId: "venue-1",
        roomLabel: null,
        classGroupIds: ["class-1"],
        status: "draft",
        isUnscheduled: false,
      },
      {
        id: "entry-b",
        date: "2026-06-02T00:00:00.000Z",
        startTime: "09:00",
        endTime: "11:00",
        durationMinutes: 120,
        venueId: "venue-2",
        roomLabel: null,
        classGroupIds: ["class-1"],
        status: "draft",
        isUnscheduled: false,
      },
    ],
  });

  const classConflict = conflicts.find((row) => row.type === "class_overlap");
  assert.ok(classConflict);
  assert.deepEqual(classConflict.affectedEntryIds.sort(), ["entry-a", "entry-b"]);
  assert.deepEqual(classConflict.affectedClassGroupIds, ["class-1"]);
});

test("detectExamSessionConflicts detects teacher overlap via invigilator assignments", () => {
  const conflicts = detectExamSessionConflicts({
    session: defaultSession,
    policy: defaultPolicy,
    entries: [
      {
        id: "entry-a",
        date: "2026-06-02T00:00:00.000Z",
        startTime: "08:00",
        endTime: "10:00",
        durationMinutes: 120,
        venueId: "venue-1",
        roomLabel: null,
        classGroupIds: ["class-1"],
        status: "draft",
        isUnscheduled: false,
      },
      {
        id: "entry-b",
        date: "2026-06-02T00:00:00.000Z",
        startTime: "09:00",
        endTime: "11:00",
        durationMinutes: 120,
        venueId: "venue-2",
        roomLabel: null,
        classGroupIds: ["class-2"],
        status: "draft",
        isUnscheduled: false,
      },
    ],
    invigilators: [
      {
        id: "inv-1",
        examTimetableEntryId: "entry-a",
        teacherId: "teacher-1",
        status: "assigned",
      },
      {
        id: "inv-2",
        examTimetableEntryId: "entry-b",
        teacherId: "teacher-1",
        status: "acknowledged",
      },
    ],
  });

  const teacherConflict = conflicts.find((row) => row.type === "teacher_overlap");
  assert.ok(teacherConflict);
  assert.deepEqual(teacherConflict.affectedTeacherIds, ["teacher-1"]);
});

test("detectExamSessionConflicts detects room overlap by venue", () => {
  const conflicts = detectExamSessionConflicts({
    session: defaultSession,
    policy: defaultPolicy,
    invigilators: [],
    entries: [
      {
        id: "entry-a",
        date: "2026-06-03T00:00:00.000Z",
        startTime: "08:00",
        endTime: "10:00",
        durationMinutes: 120,
        venueId: "venue-1",
        roomLabel: null,
        classGroupIds: ["class-1"],
        status: "draft",
        isUnscheduled: false,
      },
      {
        id: "entry-b",
        date: "2026-06-03T00:00:00.000Z",
        startTime: "09:30",
        endTime: "11:00",
        durationMinutes: 90,
        venueId: "venue-1",
        roomLabel: null,
        classGroupIds: ["class-2"],
        status: "draft",
        isUnscheduled: false,
      },
    ],
  });

  const roomConflict = conflicts.find((row) => row.type === "room_overlap");
  assert.ok(roomConflict);
  assert.deepEqual(roomConflict.affectedVenueIds, ["venue-1"]);
});

test("detectExamSessionConflicts detects outside session range, missing venue, and missing invigilator", () => {
  const conflicts = detectExamSessionConflicts({
    session: defaultSession,
    policy: defaultPolicy,
    invigilators: [],
    entries: [
      {
        id: "entry-a",
        date: "2026-06-20T00:00:00.000Z",
        startTime: "08:00",
        endTime: "10:00",
        durationMinutes: 120,
        venueId: null,
        roomLabel: null,
        classGroupIds: ["class-1"],
        status: "draft",
        isUnscheduled: false,
      },
    ],
  });

  assert.ok(conflicts.some((row) => row.type === "outside_session_range"));
  assert.ok(conflicts.some((row) => row.type === "missing_venue"));
  assert.ok(conflicts.some((row) => row.type === "missing_invigilator"));
});

test("detectExamSessionConflicts detects invalid duration", () => {
  const conflicts = detectExamSessionConflicts({
    session: defaultSession,
    policy: defaultPolicy,
    invigilators: [],
    entries: [
      {
        id: "entry-a",
        date: "2026-06-02T00:00:00.000Z",
        startTime: "08:00",
        endTime: "09:00",
        durationMinutes: 120,
        venueId: "venue-1",
        roomLabel: null,
        classGroupIds: ["class-1"],
        status: "draft",
        isUnscheduled: false,
      },
    ],
  });

  const invalidDuration = conflicts.find((row) => row.type === "invalid_duration");
  assert.ok(invalidDuration);
  assert.equal(invalidDuration.canOverride, false);
});

test("detectExamSessionConflicts skips overlap checks for unscheduled entries", () => {
  const conflicts = detectExamSessionConflicts({
    session: defaultSession,
    policy: defaultPolicy,
    invigilators: [],
    entries: [
      {
        id: "entry-a",
        date: "2026-06-02T00:00:00.000Z",
        startTime: "08:00",
        endTime: "10:00",
        durationMinutes: 120,
        venueId: null,
        roomLabel: null,
        classGroupIds: ["class-1"],
        status: "draft",
        isUnscheduled: true,
      },
      {
        id: "entry-b",
        date: "2026-06-02T00:00:00.000Z",
        startTime: "08:30",
        endTime: "10:30",
        durationMinutes: 120,
        venueId: null,
        roomLabel: null,
        classGroupIds: ["class-1"],
        status: "draft",
        isUnscheduled: true,
      },
    ],
  });

  assert.equal(conflicts.some((row) => row.type === "class_overlap"), false);
  assert.equal(conflicts.some((row) => row.type === "missing_venue"), false);
  assert.equal(conflicts.some((row) => row.type === "missing_invigilator"), false);
});

test("groupExamConflictsBySeverity groups error conflicts", () => {
  const grouped = groupExamConflictsBySeverity([
    {
      key: "a",
      type: "missing_venue",
      severity: "error",
      message: "Missing venue",
      affectedEntryIds: ["entry-a"],
      affectedTeacherIds: [],
      affectedClassGroupIds: [],
      affectedVenueIds: [],
      suggestion: null,
      canOverride: true,
    },
  ]);

  assert.equal(grouped.errors.length, 1);
  assert.equal(grouped.warnings.length, 0);
  assert.equal(grouped.info.length, 0);
});

test("computeExamReadinessScore penalizes errors and returns zero without entries", () => {
  assert.equal(
    computeExamReadinessScore({ errorCount: 0, warningCount: 0, entryCount: 0 }),
    0
  );
  assert.equal(
    computeExamReadinessScore({ errorCount: 0, warningCount: 0, entryCount: 3 }),
    100
  );
  assert.equal(
    computeExamReadinessScore({ errorCount: 2, warningCount: 1, entryCount: 5 }),
    65
  );
});

test("mergeConflictOverrides marks stored overrides on live conflicts", () => {
  const merged = mergeConflictOverrides(
    [
      {
        key: "missing_venue|entry-a",
        type: "missing_venue",
        severity: "error",
        message: "Missing venue",
        affectedEntryIds: ["entry-a"],
        affectedTeacherIds: [],
        affectedClassGroupIds: [],
        affectedVenueIds: [],
        suggestion: null,
        canOverride: true,
      },
    ],
    [
      {
        key: "missing_venue|entry-a",
        overriddenBy: "admin-1",
        overrideReason: "Hall unavailable; using outdoor backup.",
        overriddenAt: "2026-06-01T10:00:00.000Z",
      },
    ]
  );

  assert.equal(merged[0]?.isOverridden, true);
  assert.equal(merged[0]?.overrideReason, "Hall unavailable; using outdoor backup.");
});

test("summarizeActiveConflicts excludes overridden items from blocking counts", () => {
  const summary = summarizeActiveConflicts([
    {
      key: "a",
      type: "missing_venue",
      severity: "error",
      message: "Missing venue",
      affectedEntryIds: ["entry-a"],
      affectedTeacherIds: [],
      affectedClassGroupIds: [],
      affectedVenueIds: [],
      suggestion: null,
      canOverride: true,
    },
    {
      key: "b",
      type: "class_overlap",
      severity: "error",
      message: "Overlap",
      affectedEntryIds: ["entry-a", "entry-b"],
      affectedTeacherIds: [],
      affectedClassGroupIds: [],
      affectedVenueIds: [],
      suggestion: null,
      canOverride: true,
      isOverridden: true,
      overriddenBy: "admin-1",
      overrideReason: "Accepted",
      overriddenAt: "2026-06-01T10:00:00.000Z",
    },
  ]);

  assert.equal(summary.grouped.errors.length, 1);
  assert.equal(summary.overriddenCount, 1);
});

test("getConflictFixActions maps conflict types to fix actions", () => {
  const missingVenue = getConflictFixActions({
    key: "missing_venue|entry-a",
    type: "missing_venue",
    severity: "error",
    message: "Missing venue",
    affectedEntryIds: ["entry-a"],
    affectedTeacherIds: [],
    affectedClassGroupIds: [],
    affectedVenueIds: [],
    suggestion: "Add a venue",
    canOverride: true,
  });
  assert.deepEqual(
    missingVenue.map((action) => action.id),
    ["change_venue"]
  );
  assert.equal(missingVenue[0]?.label, "Add venue");

  const teacherOverlap = buildConflictFixRequest({
    action: "replace_invigilator",
    conflict: {
      key: "teacher_overlap|t1|a|b",
      type: "teacher_overlap",
      severity: "error",
      message: "Overlap",
      affectedEntryIds: ["entry-a", "entry-b"],
      affectedTeacherIds: ["teacher-1"],
      affectedClassGroupIds: [],
      affectedVenueIds: [],
      suggestion: "Replace",
      canOverride: true,
    },
  });
  assert.ok(teacherOverlap);
  assert.equal(teacherOverlap?.teacherId, "teacher-1");
});
