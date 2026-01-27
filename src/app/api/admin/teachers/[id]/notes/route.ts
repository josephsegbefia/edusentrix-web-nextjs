// src/app/api/admin/teachers/[id]/notes/route.ts
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

const CreateNoteSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  content: z.string().min(1, "Content is required").max(5000),
  category: z.enum(["general", "performance", "behavior", "professional_development", "disciplinary", "other"]).optional(),
  visibility: z.enum(["internal", "private"]).default("internal"),
  tags: z.array(z.string()).optional(),
});

/**
 * GET /api/admin/teachers/:id/notes
 * Get notes for a teacher
 * Query params: category, page, limit
 * Notes with visibility="private" are only visible to admins (already enforced by requireSchoolAdmin)
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { schoolId } = await requireSchoolAdmin();
  await connectToDatabase();

  const { id } = await ctx.params;
  const teacherObjId = toObjectIdOrNull(String(id));

  if (!teacherObjId) {
    return Response.json({ error: "Invalid teacher id" }, { status: 400 });
  }

  const schoolIdObj =
    schoolId instanceof mongoose.Types.ObjectId
      ? schoolId
      : new mongoose.Types.ObjectId(String(schoolId));

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") as
    | "general"
    | "performance"
    | "behavior"
    | "professional_development"
    | "disciplinary"
    | "other"
    | null;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));

  // Build query
  const query: Record<string, unknown> = {
    teacherId: teacherObjId,
    schoolId: schoolIdObj,
  };

  if (category) {
    query.category = category;
  }

  // Get total count
  const total = await TeacherNote.countDocuments(query);

  // Get notes - sort by createdAt (newest first)
  const notes = await TeacherNote.find(query)
    .populate("createdBy", "firstName lastName email")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const data = notes.map((note: any) => ({
    id: String(note._id),
    title: String(note.title || ""),
    content: String(note.content),
    category: note.category || null,
    visibility: note.visibility || "internal",
    isConfidential: note.visibility === "private" || note.isConfidential === true,
    tags: Array.isArray(note.tags) ? note.tags : [],
    createdBy: note.createdBy
      ? {
          id: String(note.createdBy._id),
          name: `${note.createdBy.firstName || ""} ${note.createdBy.lastName || ""}`.trim(),
          email: note.createdBy.email || null,
        }
      : null,
    createdAt: new Date(note.createdAt).toISOString(),
    updatedAt: new Date(note.updatedAt).toISOString(),
  }));

  return Response.json({
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

/**
 * POST /api/admin/teachers/:id/notes
 * Create a note for a teacher
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { schoolId, userId: adminUserId } = await requireSchoolAdmin();
  await connectToDatabase();

  const { id } = await ctx.params;
  const teacherObjId = toObjectIdOrNull(String(id));

  if (!teacherObjId) {
    return Response.json({ error: "Invalid teacher id" }, { status: 400 });
  }

  const schoolIdObj =
    schoolId instanceof mongoose.Types.ObjectId
      ? schoolId
      : new mongoose.Types.ObjectId(String(schoolId));

  // Parse and validate body
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = CreateNoteSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const input = parsed.data;

  // Create note
  const note = await TeacherNote.create({
    teacherId: teacherObjId,
    schoolId: schoolIdObj,
    title: input.title,
    content: input.content,
    category: input.category || undefined,
    visibility: input.visibility || "internal",
    isConfidential: input.visibility === "private",
    tags: input.tags || [],
    createdBy: adminUserId ? new mongoose.Types.ObjectId(String(adminUserId)) : undefined,
  });

  // Log activity
  await logTeacherActivity({
    teacherId: String(teacherObjId),
    schoolId: schoolIdObj,
    type: "note.added",
    title: "Note created",
    description: `Created note: ${input.title}`,
    metadata: {
      noteId: String(note._id),
      title: input.title,
      category: input.category,
      visibility: input.visibility,
      createdBy: adminUserId,
    },
    createdBy: adminUserId,
  });

  return Response.json({
    success: true,
    message: "Note created successfully",
    data: {
      id: String(note._id),
      title: note.title,
    },
  });
}
