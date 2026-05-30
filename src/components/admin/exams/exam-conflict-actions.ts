import type { ExamConflictDTO, ExamConflictType } from "@/types/academics/exam-scheduling-engine";

export type ConflictFixActionId =
  | "change_time"
  | "change_venue"
  | "add_invigilator"
  | "replace_invigilator";

export type ConflictFixAction = {
  id: ConflictFixActionId;
  label: string;
};

export type ConflictFixRequest = {
  action: ConflictFixActionId;
  conflict: ExamConflictDTO;
  entryId: string;
  teacherId?: string;
};

const ACTIONS: Record<ConflictFixActionId, Omit<ConflictFixAction, "id">> = {
  change_time: { label: "Change time" },
  change_venue: { label: "Change venue" },
  add_invigilator: { label: "Add invigilator" },
  replace_invigilator: { label: "Replace invigilator" },
};

const CONFLICT_ACTIONS: Record<ExamConflictType, ConflictFixActionId[]> = {
  class_overlap: ["change_time", "change_venue"],
  teacher_overlap: ["change_time", "replace_invigilator"],
  room_overlap: ["change_time", "change_venue"],
  outside_session_range: ["change_time"],
  missing_invigilator: ["add_invigilator"],
  missing_venue: ["change_venue"],
  invalid_duration: ["change_time"],
};

export function getConflictFixActions(conflict: ExamConflictDTO): ConflictFixAction[] {
  const ids = CONFLICT_ACTIONS[conflict.type] ?? [];
  return ids.map((id) => ({
    id,
    ...ACTIONS[id],
    label: id === "change_venue" && conflict.type === "missing_venue" ? "Add venue" : ACTIONS[id].label,
  }));
}

export function buildConflictFixRequest(input: {
  action: ConflictFixActionId;
  conflict: ExamConflictDTO;
  entryId?: string;
}): ConflictFixRequest | null {
  const entryId = input.entryId ?? input.conflict.affectedEntryIds[0];
  if (!entryId) return null;

  if (input.action === "replace_invigilator") {
    const teacherId = input.conflict.affectedTeacherIds[0];
    if (!teacherId) return null;
    return {
      action: input.action,
      conflict: input.conflict,
      entryId,
      teacherId,
    };
  }

  return {
    action: input.action,
    conflict: input.conflict,
    entryId,
  };
}
