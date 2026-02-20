import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { JournalEntry } from "@/models/JournalEntry";
import { TeacherAssignment } from "@/models/TeacherAssignment";

const JournalEntryUpdateSchema = z.object({
  subjectId: z.string().optional().nullable(),
  date: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  title: z.string().max(200).optional().nullable(),
  content: z.string().min(1).max(8000).optional(),
  status: z.enum(["draft", "published"]).optional(),
  attachments: z
    .array(
      z.object({
        name: z.string().min(1),
        url: z.string().min(1),
        type: z.string().min(1),
        size: z.number().min(0).optional().nullable(),
      })
    )
    .optional(),
});

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

function serializeJournalEntry(entry: {
  _id: mongoose.Types.ObjectId;
  classGroupId: mongoose.Types.ObjectId;
  subjectId?: mongoose.Types.ObjectId;
  date?: Date;
  title?: string;
  content: string;
  status: "draft" | "published";
  attachments?: Array<{
    name: string;
    url: string;
    type: string;
    size?: number;
  }>;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: String(entry._id),
    classGroupId: String(entry.classGroupId),
    subjectId: entry.subjectId ? String(entry.subjectId) : null,
    date: entry.date ? new Date(entry.date).toISOString() : null,
    title: entry.title || null,
    content: entry.content,
    status: entry.status,
    attachments: entry.attachments || [],
    createdAt: entry.createdAt ? new Date(entry.createdAt).toISOString() : null,
    updatedAt: entry.updatedAt ? new Date(entry.updatedAt).toISOString() : null,
  };
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    if (!can(context.permissions, PERMISSIONS.journalView)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await ctx.params;
    const entryId = toObjectIdOrNull(id);
    if (!entryId) {
      return Response.json({ success: false, error: "Invalid journal entry ID" }, { status: 400 });
    }

    const query: Record<string, unknown> = {
      _id: entryId,
      schoolId: context.schoolId,
    };
    if (!context.isAdmin) query.teacherId = context.teacherId;

    const entry = await JournalEntry.findOne(query);
    if (!entry) {
      return Response.json({ success: false, error: "Journal entry not found" }, { status: 404 });
    }

    return Response.json({
      success: true,
      data: { entry: serializeJournalEntry(entry) },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to fetch journal entry:", e);
    const message = e instanceof Error ? e.message : "Failed to fetch journal entry";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    if (!can(context.permissions, PERMISSIONS.journalWrite)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await ctx.params;
    const entryId = toObjectIdOrNull(id);
    if (!entryId) {
      return Response.json({ success: false, error: "Invalid journal entry ID" }, { status: 400 });
    }

    const query: Record<string, unknown> = {
      _id: entryId,
      schoolId: context.schoolId,
    };
    if (!context.isAdmin) query.teacherId = context.teacherId;

    const entry = await JournalEntry.findOne(query);
    if (!entry) {
      return Response.json({ success: false, error: "Journal entry not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const parsed = JournalEntryUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const update = parsed.data;
    let subjectObjId: mongoose.Types.ObjectId | null | undefined = undefined;

    if (typeof update.subjectId !== "undefined") {
      if (update.subjectId === null) {
        subjectObjId = null;
      } else {
        subjectObjId = toObjectIdOrNull(update.subjectId);
        if (!subjectObjId) {
          return Response.json({ success: false, error: "Invalid subject ID" }, { status: 400 });
        }
      }
    }

    if (!context.isAdmin) {
      const assignmentQuery: Record<string, unknown> = {
        schoolId: context.schoolId,
        teacherId: context.teacherId,
        classGroupId: entry.classGroupId,
        status: "active",
      };

      if (typeof subjectObjId !== "undefined" && subjectObjId !== null) {
        assignmentQuery.subjectId = subjectObjId;
      } else if (subjectObjId === undefined && entry.subjectId) {
        assignmentQuery.subjectId = entry.subjectId;
      }

      const assignment = await TeacherAssignment.findOne(assignmentQuery).select("_id").lean();
      if (!assignment) {
        return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
    }

    if (typeof update.subjectId !== "undefined") {
      entry.subjectId = subjectObjId || undefined;
    }
    if (update.date) {
      const parsedDate = new Date(update.date);
      if (Number.isNaN(parsedDate.getTime())) {
        return Response.json({ success: false, error: "Invalid date" }, { status: 400 });
      }
      entry.date = parsedDate;
    }
    if (typeof update.title !== "undefined") {
      entry.title = update.title || undefined;
    }
    if (typeof update.content !== "undefined") {
      entry.content = update.content;
    }
    if (typeof update.status !== "undefined") {
      entry.status = update.status;
    }
    if (typeof update.attachments !== "undefined") {
      entry.attachments = update.attachments;
    }

    await entry.save();

    return Response.json({
      success: true,
      data: { entry: serializeJournalEntry(entry) },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to update journal entry:", e);
    const message = e instanceof Error ? e.message : "Failed to update journal entry";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    if (!can(context.permissions, PERMISSIONS.journalWrite)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await ctx.params;
    const entryId = toObjectIdOrNull(id);
    if (!entryId) {
      return Response.json({ success: false, error: "Invalid journal entry ID" }, { status: 400 });
    }

    const query: Record<string, unknown> = {
      _id: entryId,
      schoolId: context.schoolId,
    };
    if (!context.isAdmin) query.teacherId = context.teacherId;

    const deleted = await JournalEntry.findOneAndDelete(query).select("_id");
    if (!deleted) {
      return Response.json({ success: false, error: "Journal entry not found" }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to delete journal entry:", e);
    const message = e instanceof Error ? e.message : "Failed to delete journal entry";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
