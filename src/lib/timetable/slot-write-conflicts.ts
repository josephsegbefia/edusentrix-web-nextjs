import { Types } from "mongoose";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { Subject } from "@/models/Subject";
import { Teacher } from "@/models/Teacher";
import { TimetableSlot } from "@/models/TimetableSlot";
import { TimetableVersion } from "@/models/TimetableVersion";
import { User } from "@/models/User";
import { slotsOverlap } from "@/lib/timetable/validate";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export type TimetableWriteConflictCode = "TEACHER_OVERLAP" | "CLASS_OVERLAP" | "ROOM_OVERLAP";

export type TimetableWriteConflictSlotSummary = {
  slotId: string | null;
  classGroupId: string;
  className: string;
  gradeId: string;
  gradeName: string;
  subjectId: string;
  subjectName: string;
  teacherId: string | null;
  teacherName: string | null;
  roomId: string | null;
  dayOfWeek: number;
  dayName: string;
  startTime: string;
  endTime: string;
};

export type TimetableWriteConflict = {
  code: TimetableWriteConflictCode;
  severity: "error";
  message: string;
  attemptedSlot: TimetableWriteConflictSlotSummary;
  conflictingSlots: TimetableWriteConflictSlotSummary[];
  suggestions: string[];
};

type DetectSlotWriteConflictsInput = {
  schoolId: Types.ObjectId;
  academicPeriodId: Types.ObjectId;
  versionId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  gradeId: Types.ObjectId;
  subjectId: Types.ObjectId;
  teacherId: Types.ObjectId | null;
  roomId?: Types.ObjectId | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  excludeSlotId?: Types.ObjectId | null;
};

function fullName(user: { name?: string | null; firstName?: string | null; lastName?: string | null } | null) {
  if (!user) return null;
  const composed = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return user.name?.trim() || composed || null;
}

async function buildSlotSummaries(
  schoolId: Types.ObjectId,
  slots: Array<{
    _id?: Types.ObjectId | null;
    classGroupId: Types.ObjectId;
    gradeId: Types.ObjectId;
    subjectId: Types.ObjectId;
    teacherId?: Types.ObjectId | null;
    roomId?: Types.ObjectId | null;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }>
): Promise<TimetableWriteConflictSlotSummary[]> {
  const classIds = Array.from(new Set(slots.map((s) => String(s.classGroupId)))).map(
    (id) => new Types.ObjectId(id)
  );
  const gradeIds = Array.from(new Set(slots.map((s) => String(s.gradeId)))).map(
    (id) => new Types.ObjectId(id)
  );
  const subjectIds = Array.from(new Set(slots.map((s) => String(s.subjectId)))).map(
    (id) => new Types.ObjectId(id)
  );
  const teacherIds = Array.from(
    new Set(slots.map((s) => (s.teacherId ? String(s.teacherId) : "")).filter(Boolean))
  ).map((id) => new Types.ObjectId(id));

  const [classes, grades, subjects, teachers] = await Promise.all([
    ClassGroup.find({ _id: { $in: classIds }, schoolId }).select("_id name gradeId").lean(),
    Grade.find({ _id: { $in: gradeIds }, schoolId }).select("_id name").lean(),
    Subject.find({ _id: { $in: subjectIds }, schoolId }).select("_id name").lean(),
    teacherIds.length
      ? Teacher.find({ _id: { $in: teacherIds }, schoolId }).select("_id userId").lean()
      : Promise.resolve([]),
  ]);

  const userIds = Array.from(
    new Set(
      teachers
        .map((teacher) => (teacher.userId ? String(teacher.userId) : ""))
        .filter(Boolean)
    )
  ).map((id) => new Types.ObjectId(id));
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } }).select("_id name firstName lastName").lean()
    : [];

  const classMap = new Map(classes.map((item) => [String(item._id), item]));
  const gradeMap = new Map(grades.map((item) => [String(item._id), item]));
  const subjectMap = new Map(subjects.map((item) => [String(item._id), item]));
  const teacherMap = new Map(teachers.map((item) => [String(item._id), item]));
  const userMap = new Map(users.map((item) => [String(item._id), item]));

  return slots.map((slot) => {
    const classGroup = classMap.get(String(slot.classGroupId));
    const grade = gradeMap.get(String(slot.gradeId));
    const subject = subjectMap.get(String(slot.subjectId));
    const teacher = slot.teacherId ? teacherMap.get(String(slot.teacherId)) : null;
    const user = teacher?.userId ? userMap.get(String(teacher.userId)) ?? null : null;
    const gradeName = grade?.name || "Grade";
    const className = classGroup?.name ? `${gradeName} ${classGroup.name}` : gradeName;

    return {
      slotId: slot._id ? String(slot._id) : null,
      classGroupId: String(slot.classGroupId),
      className,
      gradeId: String(slot.gradeId),
      gradeName,
      subjectId: String(slot.subjectId),
      subjectName: subject?.name || "Subject",
      teacherId: slot.teacherId ? String(slot.teacherId) : null,
      teacherName: fullName(user),
      roomId: slot.roomId ? String(slot.roomId) : null,
      dayOfWeek: slot.dayOfWeek,
      dayName: DAY_NAMES[slot.dayOfWeek] || `Day ${slot.dayOfWeek}`,
      startTime: slot.startTime,
      endTime: slot.endTime,
    };
  });
}

function buildSuggestions(code: TimetableWriteConflictCode, attempted: TimetableWriteConflictSlotSummary) {
  if (code === "TEACHER_OVERLAP") {
    return [
      `Move ${attempted.className} ${attempted.subjectName} to a free period.`,
      `Assign a different ${attempted.subjectName} teacher for ${attempted.className}.`,
      "Check the conflicting class group before choosing another period.",
    ];
  }
  if (code === "ROOM_OVERLAP") {
    return [
      `Move ${attempted.className} ${attempted.subjectName} to a free room or period.`,
      "Change the class default room if this lesson is meant to happen elsewhere.",
      "A room cannot host two class groups at the same time.",
    ];
  }
  return [
    `Move this ${attempted.className} lesson to an empty period.`,
    "Remove the existing lesson in this period before adding another one.",
    "Use a separate combined-lesson workflow if this is intentionally shared.",
  ];
}

async function getDraftVersionScopeIds(input: {
  schoolId: Types.ObjectId;
  academicPeriodId: Types.ObjectId;
  versionId: Types.ObjectId;
}): Promise<Types.ObjectId[]> {
  const drafts = await TimetableVersion.find({
    schoolId: input.schoolId,
    academicPeriodId: input.academicPeriodId,
    status: "draft",
  })
    .select("_id")
    .lean<Array<{ _id: Types.ObjectId }>>();

  const ids = drafts.map((draft) => draft._id);
  if (!ids.some((id) => String(id) === String(input.versionId))) {
    ids.push(input.versionId);
  }
  return ids.length ? ids : [input.versionId];
}

export async function detectSlotWriteConflicts(
  input: DetectSlotWriteConflictsInput
): Promise<TimetableWriteConflict[]> {
  const versionScopeIds = await getDraftVersionScopeIds({
    schoolId: input.schoolId,
    academicPeriodId: input.academicPeriodId,
    versionId: input.versionId,
  });

  const query: Record<string, unknown> = {
    schoolId: input.schoolId,
    academicPeriodId: input.academicPeriodId,
    versionId: { $in: versionScopeIds },
    dayOfWeek: input.dayOfWeek,
    $or: [
      ...(input.teacherId ? [{ teacherId: input.teacherId }] : []),
      ...(input.roomId ? [{ roomId: input.roomId }] : []),
      { classGroupId: input.classGroupId },
    ],
  };
  if (input.excludeSlotId) {
    query._id = { $ne: input.excludeSlotId };
  }

  const existingSlots = await TimetableSlot.find(query)
    .select("_id classGroupId gradeId subjectId teacherId roomId dayOfWeek startTime endTime")
    .lean();

  const overlapping = existingSlots.filter((slot) =>
    slotsOverlap(
      { startTime: input.startTime, endTime: input.endTime },
      { startTime: slot.startTime, endTime: slot.endTime }
    )
  );
  if (!overlapping.length) return [];

  const attemptedBase = {
    _id: null,
    classGroupId: input.classGroupId,
    gradeId: input.gradeId,
    subjectId: input.subjectId,
    teacherId: input.teacherId,
    roomId: input.roomId,
    dayOfWeek: input.dayOfWeek,
    startTime: input.startTime,
    endTime: input.endTime,
  };
  const summaries = await buildSlotSummaries(input.schoolId, [attemptedBase, ...overlapping]);
  const attempted = summaries[0];
  const existingSummaries = summaries.slice(1);
  const output: TimetableWriteConflict[] = [];

  const teacherOverlaps = input.teacherId
    ? existingSummaries.filter((slot) => slot.teacherId === String(input.teacherId))
    : [];
  if (teacherOverlaps.length) {
    const teacherName = attempted.teacherName || "This teacher";
    output.push({
      code: "TEACHER_OVERLAP",
      severity: "error",
      message: `${teacherName} is already scheduled on ${attempted.dayName} during ${attempted.startTime}-${attempted.endTime}.`,
      attemptedSlot: attempted,
      conflictingSlots: teacherOverlaps,
      suggestions: buildSuggestions("TEACHER_OVERLAP", attempted),
    });
  }

  const classOverlaps = existingSummaries.filter(
    (slot) => slot.classGroupId === String(input.classGroupId)
  );
  if (classOverlaps.length) {
    output.push({
      code: "CLASS_OVERLAP",
      severity: "error",
      message: `${attempted.className} already has a lesson on ${attempted.dayName} during ${attempted.startTime}-${attempted.endTime}.`,
      attemptedSlot: attempted,
      conflictingSlots: classOverlaps,
      suggestions: buildSuggestions("CLASS_OVERLAP", attempted),
    });
  }

  const roomOverlaps = input.roomId
    ? existingSummaries.filter((slot) => slot.roomId === String(input.roomId))
    : [];
  if (roomOverlaps.length) {
    output.push({
      code: "ROOM_OVERLAP",
      severity: "error",
      message: `${attempted.className}'s room is already scheduled on ${attempted.dayName} during ${attempted.startTime}-${attempted.endTime}.`,
      attemptedSlot: attempted,
      conflictingSlots: roomOverlaps,
      suggestions: buildSuggestions("ROOM_OVERLAP", attempted),
    });
  }

  return output;
}
