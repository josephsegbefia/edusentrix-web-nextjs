import mongoose from "mongoose";
import type { IBackgroundJob } from "@/models/BackgroundJob";

type BackgroundInput = Record<string, unknown> | undefined;

export type BulkImportRouting =
  | {
      kind: "teacher_staged";
      importJobId: string;
      phase: "analysis" | "commit";
    }
  | {
      kind: "student_staged";
      importJobId: string;
      phase: "analysis" | "commit";
    }
  | {
      kind: "legacy";
      importJobId: string;
    };

export type BulkImportRoutingResult =
  | { ok: true; routing: BulkImportRouting }
  | { ok: false; code: "BULK_IMPORT_ROUTING_INVALID"; message: string };

function stringValue(input: BackgroundInput, key: string) {
  const value = input?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function sameObjectId(left: unknown, right: string) {
  return mongoose.isValidObjectId(left) && String(left) === right;
}

/**
 * BULK_IMPORT is a transport kind shared by several domain workflows. Its
 * subject type and input must agree exactly; falling through to another
 * importer could create people without the staged review gate.
 */
export function resolveBulkImportRouting(job: Pick<IBackgroundJob, "subjectType" | "subjectId" | "input">): BulkImportRoutingResult {
  const input = job.input;
  const teacherImportJobId = stringValue(input, "teacherImportJobId");
  const studentImportJobId = stringValue(input, "studentImportJobId");
  const bulkImportJobId = stringValue(input, "bulkImportJobId");
  const routeIds = [teacherImportJobId, studentImportJobId, bulkImportJobId].filter(Boolean);

  if (routeIds.length !== 1) {
    return {
      ok: false,
      code: "BULK_IMPORT_ROUTING_INVALID",
      message: "Bulk import routing must contain exactly one domain import identifier.",
    };
  }

  if (teacherImportJobId) {
    const phase = stringValue(input, "teacherImportPhase");
    if (
      job.subjectType !== "TeacherImportJob" ||
      !mongoose.isValidObjectId(teacherImportJobId) ||
      !sameObjectId(job.subjectId, teacherImportJobId) ||
      (phase !== "analysis" && phase !== "commit") ||
      stringValue(input, "studentImportPhase") ||
      stringValue(input, "targetKind")
    ) {
      return {
        ok: false,
        code: "BULK_IMPORT_ROUTING_INVALID",
        message: "Teacher staged import routing is inconsistent.",
      };
    }
    return { ok: true, routing: { kind: "teacher_staged", importJobId: teacherImportJobId, phase } };
  }

  if (studentImportJobId) {
    const phase = stringValue(input, "studentImportPhase");
    if (
      job.subjectType !== "StudentImportJob" ||
      !mongoose.isValidObjectId(studentImportJobId) ||
      !sameObjectId(job.subjectId, studentImportJobId) ||
      (phase !== "analysis" && phase !== "commit") ||
      stringValue(input, "teacherImportPhase") ||
      stringValue(input, "targetKind")
    ) {
      return {
        ok: false,
        code: "BULK_IMPORT_ROUTING_INVALID",
        message: "Student staged import routing is inconsistent.",
      };
    }
    return { ok: true, routing: { kind: "student_staged", importJobId: studentImportJobId, phase } };
  }

  if (
    job.subjectType !== "BulkImportJob" ||
    !bulkImportJobId ||
    !mongoose.isValidObjectId(bulkImportJobId) ||
    !sameObjectId(job.subjectId, bulkImportJobId) ||
    stringValue(input, "teacherImportPhase") ||
    stringValue(input, "studentImportPhase")
  ) {
    return {
      ok: false,
      code: "BULK_IMPORT_ROUTING_INVALID",
      message: "Legacy bulk import routing is inconsistent.",
    };
  }

  return { ok: true, routing: { kind: "legacy", importJobId: bulkImportJobId } };
}
