import { Types } from "mongoose";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { Teacher } from "@/models/Teacher";
import { User } from "@/models/User";

export type TimetableTeacherLinkSource =
  | "assignment"
  | "slot"
  | "fallback"
  | "unassigned";

export type TimetableTeacherLink = {
  teacherId: string;
  teacherName: string;
  teacherIds: string[];
  teacherNames: string[];
  source: TimetableTeacherLinkSource;
};

type SlotTeacherLinkInput = {
  classGroupId: Types.ObjectId | string;
  subjectId: Types.ObjectId | string;
  teacherId?: Types.ObjectId | string | null;
};

function toIdString(value: Types.ObjectId | string | null | undefined): string {
  if (!value) return "";
  return String(value);
}

function pairKey(classGroupId: Types.ObjectId | string, subjectId: Types.ObjectId | string): string {
  return `${String(classGroupId)}|${String(subjectId)}`;
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function movePreferredTeacherFirst(ids: string[], preferredTeacherId?: string | null): string[] {
  if (!preferredTeacherId) return ids;
  const index = ids.indexOf(preferredTeacherId);
  if (index <= 0) return ids;
  return [preferredTeacherId, ...ids.slice(0, index), ...ids.slice(index + 1)];
}

export function formatTeacherLinkLabel(names: string[]): string {
  const filtered = names.filter(Boolean);
  if (filtered.length === 0) return "Unassigned";
  if (filtered.length <= 2) return filtered.join(", ");
  return `${filtered[0]} +${filtered.length - 1} more`;
}

export async function resolveTeacherLinksForSlots(args: {
  schoolId: Types.ObjectId;
  academicPeriodId: Types.ObjectId;
  slots: SlotTeacherLinkInput[];
  preferredTeacherId?: Types.ObjectId | null;
  fallbackTeacherIdIfUnassigned?: Types.ObjectId | null;
}): Promise<TimetableTeacherLink[]> {
  if (args.slots.length === 0) return [];

  const pairConditions = uniqueStrings(
    args.slots.map((slot) => pairKey(slot.classGroupId, slot.subjectId))
  ).map((pair) => {
    const [classGroupId, subjectId] = pair.split("|");
    return {
      classGroupId: new Types.ObjectId(classGroupId),
      subjectId: new Types.ObjectId(subjectId),
    };
  });

  const assignmentRows =
    pairConditions.length > 0
      ? await TeacherAssignment.find({
          schoolId: args.schoolId,
          academicPeriodId: args.academicPeriodId,
          status: "active",
          $or: pairConditions,
        })
          .sort({ assignedAt: 1, createdAt: 1, _id: 1 })
          .select("classGroupId subjectId teacherId")
          .lean()
      : [];

  const teacherIdsByPair = new Map<string, string[]>();
  for (const row of assignmentRows as Array<{
    classGroupId: Types.ObjectId;
    subjectId: Types.ObjectId;
    teacherId: Types.ObjectId;
  }>) {
    const key = pairKey(row.classGroupId, row.subjectId);
    const current = teacherIdsByPair.get(key) || [];
    const teacherId = String(row.teacherId);
    if (!current.includes(teacherId)) current.push(teacherId);
    teacherIdsByPair.set(key, current);
  }

  const teacherIds = uniqueStrings([
    ...args.slots.map((slot) => toIdString(slot.teacherId)).filter(Boolean),
    ...Array.from(teacherIdsByPair.values()).flat(),
    ...(args.preferredTeacherId ? [String(args.preferredTeacherId)] : []),
    ...(args.fallbackTeacherIdIfUnassigned
      ? [String(args.fallbackTeacherIdIfUnassigned)]
      : []),
  ]);

  const teachers =
    teacherIds.length > 0
      ? await Teacher.find({
          schoolId: args.schoolId,
          _id: {
            $in: teacherIds.map((teacherId) => new Types.ObjectId(teacherId)),
          },
        })
          .select("_id userId")
          .populate({ path: "userId", select: "firstName lastName", model: User })
          .lean()
      : [];

  const teacherNameById = new Map<string, string>();
  for (const row of teachers as Array<{
    _id: Types.ObjectId;
    userId?: { firstName?: string; lastName?: string } | null;
  }>) {
    const firstName = row.userId?.firstName || "";
    const lastName = row.userId?.lastName || "";
    const fullName = `${firstName} ${lastName}`.trim();
    teacherNameById.set(String(row._id), fullName || String(row._id));
  }

  const preferredTeacherId = args.preferredTeacherId
    ? String(args.preferredTeacherId)
    : null;
  const fallbackTeacherId = args.fallbackTeacherIdIfUnassigned
    ? String(args.fallbackTeacherIdIfUnassigned)
    : null;

  return args.slots.map((slot) => {
    const slotTeacherId = toIdString(slot.teacherId);
    const assignmentTeacherIds =
      teacherIdsByPair.get(pairKey(slot.classGroupId, slot.subjectId)) || [];

    let resolvedIds =
      assignmentTeacherIds.length > 0
        ? [...assignmentTeacherIds]
        : slotTeacherId
          ? [slotTeacherId]
          : fallbackTeacherId
            ? [fallbackTeacherId]
            : [];

    resolvedIds = movePreferredTeacherFirst(
      uniqueStrings(resolvedIds),
      preferredTeacherId ||
        (slotTeacherId && assignmentTeacherIds.includes(slotTeacherId)
          ? slotTeacherId
          : null)
    );

    const teacherNames = resolvedIds.map((teacherId) => {
      const teacherName = teacherNameById.get(teacherId);
      return teacherName || teacherId;
    });

    const source: TimetableTeacherLinkSource =
      assignmentTeacherIds.length > 0
        ? "assignment"
        : slotTeacherId
          ? "slot"
          : fallbackTeacherId
            ? "fallback"
            : "unassigned";

    return {
      teacherId: resolvedIds[0] || "",
      teacherName: formatTeacherLinkLabel(teacherNames),
      teacherIds: resolvedIds,
      teacherNames,
      source,
    };
  });
}
