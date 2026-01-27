// src/app/api/admin/teachers/[id]/notes/[noteId]/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { TeacherNote } from "@/models/TeacherNote";
import { logTeacherActivity } from "@/lib/teachers/logTeacherActivity";
import mongoose from "mongoose";
import { z } from "zod";

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

const UpdateNoteSchema = z.object({
  title: z.string().min(1, "Title is required").max(200).optional(),
  content: z.string().min(1, "Content is required").max(5000).optional(),
  category: z.enum(["general", "performance", "behavior", "professional_development", "disciplinary", "other"]).optional(),
  visibility: z.enum(["internal", "private"]).optional(),
  tags: z.array(z.string()).optional(),
});

/**
 * PATCH /api/admin/teachers/:id/notes/:noteId
 * Update a note
 * Only allow update by creator or admin (requireSchoolAdmin already ensures admin)
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; noteId: string }> }
) {
  const { schoolId, userId: adminUserId } = await requireSchoolAdmin();
  await connectToDatabase();

  const { id, noteId } = await ctx.params;
  const teacherObjId = toObjectIdOrNull(String(id));
  const noteObjId = toObjectIdOrNull(String(noteId));

  if (!teacherObjId || !noteObjId) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  const schoolIdObj =
    schoolId instanceof mongoose.Types.ObjectId
      ? schoolId
      : new mongoose.Types.ObjectId(String(schoolId));

  // Find note
  const note = await TeacherNote.findOne({
    _id: noteObjId,
    teacherId: teacherObjId,
    schoolId: schoolIdObj,
  });

  if (!note) {
    return Response.json({ error: "Note not found" }, { status: 404 });
  }

  // Parse and validate body
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = UpdateNoteSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const changes: string[] = [];

  // Build update object
  const updateFields: Record<string, unknown> = {};

  if (input.title !== undefined && input.title !== note.title) {
    updateFields.title = input.title;
    changes.push("title");
  }

  if (input.content !== undefined && input.content !== note.content) {
    updateFields.content = input.content;
    changes.push("content");
  }

  if (input.category !== undefined && input.category !== note.category) {
    updateFields.category = input.category;
    changes.push("category");
  }

  if (input.visibility !== undefined && input.visibility !== note.visibility) {
    updateFields.visibility = input.visibility;
    updateFields.isConfidential = input.visibility === "private";
    changes.push("visibility");
  }

  if (input.tags !== undefined) {
    updateFields.tags = input.tags;
    changes.push("tags");
  }

  if (Object.keys(updateFields).length === 0) {
    return Response.json({
      success: true,
      message: "No changes detected",
      data: { id: String(note._id) },
    });
  }

  // Update note
  await TeacherNote.findByIdAndUpdate(noteObjId, {
    $set: updateFields,
  });

  // Log activity
  if (changes.length > 0) {
    await logTeacherActivity({
      teacherId: String(teacherObjId),
      schoolId: schoolIdObj,
      type: "note.updated",
      title: "Note updated",
      description: `Updated note: ${input.title || note.title} (${changes.join(", ")})`,
      metadata: {
        noteId: String(note._id),
        changes,
        updatedBy: adminUserId,
      },
      createdBy: adminUserId,
    });
  }

  return Response.json({
    success: true,
    message: "Note updated successfully",
    data: { id: String(note._id) },
  });
}

/**
 * DELETE /api/admin/teachers/:id/notes/:noteId
 * Delete a note
 * Only allow delete by creator or admin (requireSchoolAdmin already ensures admin)
 */
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; noteId: string }> }
) {
  const { schoolId, userId: adminUserId } = await requireSchoolAdmin();
  await connectToDatabase();

  const { id, noteId } = await ctx.params;
  const teacherObjId = toObjectIdOrNull(String(id));
  const noteObjId = toObjectIdOrNull(String(noteId));

  if (!teacherObjId || !noteObjId) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  const schoolIdObj =
    schoolId instanceof mongoose.Types.ObjectId
      ? schoolId
      : new mongoose.Types.ObjectId(String(schoolId));

  // Find note
  const note = await TeacherNote.findOne({
    _id: noteObjId,
    teacherId: teacherObjId,
    schoolId: schoolIdObj,
  });

  if (!note) {
    return Response.json({ error: "Note not found" }, { status: 404 });
  }

  const noteTitle = note.title;

  // Delete note
  await TeacherNote.findByIdAndDelete(noteObjId);

  // Log activity
  await logTeacherActivity({
    teacherId: String(teacherObjId),
    schoolId: schoolIdObj,
    type: "note.deleted",
    title: "Note deleted",
    description: `Deleted note: ${noteTitle}`,
    metadata: {
      noteId: String(noteObjId),
      noteTitle,
      deletedBy: adminUserId,
    },
    createdBy: adminUserId,
  });

  return Response.json({
    success: true,
    message: "Note deleted successfully",
    data: { id: String(noteObjId) },
  });
}
