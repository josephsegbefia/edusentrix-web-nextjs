import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { TeacherImportJob, type ITeacherImportParsedRow } from "@/models/TeacherImportJob";
import { Teacher } from "@/models/Teacher";
import { ClassGroup } from "@/models/ClassGroup";
import { SubjectOffering } from "@/models/SubjectOffering";
import { serializeTeacherImportJob } from "@/lib/teachers/teacher-import-workflow";
import { assertTeacherImportId } from "@/lib/teachers/teacher-import-route";
import { resolvePersistedPhotoUrl } from "@/lib/storage/resolve-photo-url";

type AssignmentDraft = {
  classGroupId?: unknown;
  subjectOfferingIds?: unknown;
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function ids(value: unknown) {
  return Array.isArray(value)
    ? [...new Set(value.map(asString).filter((item) => mongoose.isValidObjectId(item)))]
    : [];
}

function emailIsValid(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSchoolAdmin();
    await connectToDatabase();
    const { id } = await ctx.params;
    const importId = assertTeacherImportId(id);
    if (!importId) return Response.json({ success: false, error: "Invalid teacher import id" }, { status: 400 });

    const job = await TeacherImportJob.findOne({ _id: importId, schoolId: actor.schoolId });
    if (!job) return Response.json({ success: false, error: "Teacher import not found" }, { status: 404 });
    if (job.workflow !== "identity_setup_v1") return Response.json({ success: false, error: "This import uses the older review workflow." }, { status: 409 });
    if (job.status !== "review_ready") return Response.json({ success: false, error: "This teacher import is not available for setup." }, { status: 409 });

    const body = (await req.json()) as Record<string, unknown>;
    const sourceRowNumber = Number(body.sourceRowNumber);
    const row = job.parsedRows.find((candidate) => candidate.sourceRowNumber === sourceRowNumber);
    if (!row) return Response.json({ success: false, error: "Teacher row not found" }, { status: 404 });
    if (row.setupStatus === "completed") return Response.json({ success: false, error: "This teacher has already been created." }, { status: 409 });

    const action = asString(body.action) || "save";
    if (action === "mark_created") {
      const teacherId = asString(body.teacherId);
      if (!mongoose.isValidObjectId(teacherId)) return Response.json({ success: false, error: "A valid teacher id is required." }, { status: 400 });
      const teacher = await Teacher.findOne({ _id: teacherId, schoolId: actor.schoolId }).select("_id").lean();
      if (!teacher) return Response.json({ success: false, error: "Teacher does not belong to this school." }, { status: 400 });
      row.teacherId = teacherId;
      row.rowState = "created";
      row.setupStatus = "completed";
      row.setupError = null;
      job.markModified("parsedRows");
      const remaining = job.parsedRows.filter((candidate) => candidate.setupStatus !== "completed").length;
      if (remaining === 0) {
        job.status = "completed";
        job.committedAt = new Date();
        job.fileBytes = null;
        job.result = { created: job.parsedRows.length, existing: 0, failed: 0 };
      }
      await job.save();
      return Response.json({ success: true, data: serializeTeacherImportJob(job) });
    }

    const firstName = asString(body.firstName);
    const lastName = asString(body.lastName);
    const email = asString(body.email).toLowerCase();
    if (action === "complete" && (!firstName || !lastName || !emailIsValid(email))) {
      return Response.json({ success: false, error: "Add a valid first name, last name, and email before creating this teacher." }, { status: 400 });
    }

    const homeroomClassGroupId = asString(body.homeroomClassGroupId);
    if (homeroomClassGroupId && !mongoose.isValidObjectId(homeroomClassGroupId)) {
      return Response.json({ success: false, error: "Choose a valid homeroom class." }, { status: 400 });
    }
    const assignmentDrafts = Array.isArray(body.assignments) ? body.assignments as AssignmentDraft[] : [];
    const classGroupIds = [...new Set([
      ...assignmentDrafts.map((item) => asString(item.classGroupId)),
      homeroomClassGroupId,
    ].filter((item) => mongoose.isValidObjectId(item)))];
    const classGroups = classGroupIds.length
      ? await ClassGroup.find({ _id: { $in: classGroupIds }, schoolId: actor.schoolId, isActive: true }).select("_id subjectOfferingIds").lean()
      : [];
    if (classGroups.length !== classGroupIds.length) return Response.json({ success: false, error: "One or more selected classes are no longer available in this school." }, { status: 400 });

    const offeringIds = ids(assignmentDrafts.flatMap((item) => Array.isArray(item.subjectOfferingIds) ? item.subjectOfferingIds : []));
    const offerings = offeringIds.length
      ? await SubjectOffering.find({ _id: { $in: offeringIds }, schoolId: actor.schoolId, isActive: true }).select("_id subjectId displayName").lean()
      : [];
    if (offerings.length !== offeringIds.length) return Response.json({ success: false, error: "One or more selected subjects are no longer available in this school." }, { status: 400 });

    const classById = new Map(classGroups.map((item) => [String(item._id), item]));
    const offeringById = new Map(offerings.map((item) => [String(item._id), item]));
    const explicitAssignments: Array<Record<string, unknown>> = [];
    const selectedOfferingIds: string[] = [];
    for (const draft of assignmentDrafts) {
      const classGroupId = asString(draft.classGroupId);
      if (!classGroupId) continue;
      const classGroup = classById.get(classGroupId);
      for (const offeringId of ids(draft.subjectOfferingIds)) {
        const offering = offeringById.get(offeringId);
        if (!offering) continue;
        const configured = Array.isArray(classGroup?.subjectOfferingIds) && classGroup.subjectOfferingIds.length > 0
          ? classGroup.subjectOfferingIds.map(String).includes(offeringId)
          : true;
        if (!configured) return Response.json({ success: false, error: `${offering.displayName || "This subject"} is not configured for the selected class.` }, { status: 400 });
        selectedOfferingIds.push(offeringId);
        explicitAssignments.push({ subjectOfferingId: offeringId, subjectId: String(offering.subjectId), classGroupId, status: "resolved" });
      }
    }

    row.firstName = firstName || row.firstName;
    row.lastName = lastName || row.lastName;
    row.email = email || row.email;
    row.phone = asString(body.phone) || null;
    row.employeeId = asString(body.employeeId) || null;
    row.department = asString(body.department) || null;
    row.status = asString(body.status) || "active";
    row.photoUrl = await resolvePersistedPhotoUrl({ schoolId: actor.schoolId, photoUrl: asString(body.photoUrl) || undefined }) || null;
    row.homeroomClassGroupId = homeroomClassGroupId || null;
    row.subjectOfferingIds = [...new Set(selectedOfferingIds)];
    row.subjectIds = [...new Set(offerings.filter((item) => selectedOfferingIds.includes(String(item._id))).map((item) => String(item.subjectId)))];
    row.explicitAssignments = explicitAssignments as unknown as ITeacherImportParsedRow["explicitAssignments"];
    row.setupStatus = "in_progress";
    row.setupError = null;
    row.resolutionStatus = "resolved";
    row.issues = [];
    job.markModified("parsedRows");
    await job.save();
    return Response.json({ success: true, data: serializeTeacherImportJob(job) });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ success: false, error: error instanceof Error ? error.message : "Could not save teacher setup" }, { status: 400 });
  }
}
