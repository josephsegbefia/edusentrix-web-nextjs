import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { LessonNote } from "@/models/LessonNote";
import { TeacherAssignment } from "@/models/TeacherAssignment";

const ResourceSchema = z.object({
  title: z.string().min(1).max(200),
  url: z.string().min(1).max(1000),
  type: z.string().max(40).optional().nullable(),
});

const UpdateLessonNoteSchema = z.object({
  classGroupId: z.string().min(1).optional(),
  subjectId: z.string().optional().nullable(),
  weekOf: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  topic: z.string().min(1).max(200).optional(),
  objectives: z.string().max(2000).optional().nullable(),
  content: z.string().min(1).max(8000).optional(),
  status: z.enum(["draft", "published"]).optional(),
  resources: z.array(ResourceSchema).optional(),
  tags: z.array(z.string().max(40)).optional(),
});

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

function normalizeWeekOf(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = (day + 6) % 7; // Monday start
  d.setDate(d.getDate() - diff);
  return d;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    if (!can(context.permissions, PERMISSIONS.journalWrite)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const noteId = toObjectIdOrNull(params.id);
    if (!noteId) {
      return Response.json({ success: false, error: "Invalid lesson note ID" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const parsed = UpdateLessonNoteSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await LessonNote.findOne({
      _id: noteId,
      schoolId: context.schoolId,
      teacherId: context.teacherId,
    })
      .select("classGroupId subjectId")
      .lean();

    if (!existing) {
      return Response.json({ success: false, error: "Lesson note not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    const unsetData: Record<string, unknown> = {};

    let classGroupObjId = existing.classGroupId as mongoose.Types.ObjectId;
    if (parsed.data.classGroupId) {
      const nextClassGroupId = toObjectIdOrNull(parsed.data.classGroupId);
      if (!nextClassGroupId) {
        return Response.json({ success: false, error: "Invalid class group ID" }, { status: 400 });
      }
      classGroupObjId = nextClassGroupId;
      updateData.classGroupId = nextClassGroupId;
    }

    let subjectObjId = existing.subjectId as mongoose.Types.ObjectId | null | undefined;
    if ("subjectId" in parsed.data) {
      if (parsed.data.subjectId) {
        const nextSubjectId = toObjectIdOrNull(parsed.data.subjectId);
        if (!nextSubjectId) {
          return Response.json({ success: false, error: "Invalid subject ID" }, { status: 400 });
        }
        subjectObjId = nextSubjectId;
        updateData.subjectId = nextSubjectId;
      } else {
        subjectObjId = null;
        unsetData.subjectId = "";
      }
    }

    if (!context.isAdmin) {
      const assignmentQuery: Record<string, unknown> = {
        schoolId: context.schoolId,
        teacherId: context.teacherId,
        classGroupId: classGroupObjId,
        status: "active",
      };
      if (subjectObjId) assignmentQuery.subjectId = subjectObjId;

      const assignment = await TeacherAssignment.findOne(assignmentQuery)
        .select("_id")
        .lean();

      if (!assignment) {
        return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
    }

    if (parsed.data.weekOf) {
      const weekDate = normalizeWeekOf(new Date(parsed.data.weekOf));
      if (Number.isNaN(weekDate.getTime())) {
        return Response.json({ success: false, error: "Invalid week value" }, { status: 400 });
      }
      updateData.weekOf = weekDate;
    }

    if (parsed.data.topic) updateData.topic = parsed.data.topic;
    if (parsed.data.content) updateData.content = parsed.data.content;
    if (parsed.data.status) updateData.status = parsed.data.status;
    if (parsed.data.resources) updateData.resources = parsed.data.resources;
    if (parsed.data.tags) updateData.tags = parsed.data.tags;

    if ("objectives" in parsed.data) {
      if (parsed.data.objectives) {
        updateData.objectives = parsed.data.objectives;
      } else {
        unsetData.objectives = "";
      }
    }

    const updatePayload: Record<string, unknown> = { $set: updateData };
    if (Object.keys(unsetData).length > 0) {
      updatePayload.$unset = unsetData;
    }

    await LessonNote.updateOne({ _id: noteId }, updatePayload);

    return Response.json({ success: true });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to update lesson note:", e);
    const message = e instanceof Error ? e.message : "Failed to update lesson note";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    if (!can(context.permissions, PERMISSIONS.journalWrite)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const noteId = toObjectIdOrNull(params.id);
    if (!noteId) {
      return Response.json({ success: false, error: "Invalid lesson note ID" }, { status: 400 });
    }

    const result = await LessonNote.deleteOne({
      _id: noteId,
      schoolId: context.schoolId,
      teacherId: context.teacherId,
    });

    if (!result.deletedCount) {
      return Response.json({ success: false, error: "Lesson note not found" }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to delete lesson note:", e);
    const message = e instanceof Error ? e.message : "Failed to delete lesson note";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
