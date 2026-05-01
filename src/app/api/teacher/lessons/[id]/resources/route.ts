import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { Lesson, type ILesson } from "@/models/Lesson";
import { LibraryBook } from "@/models/LibraryBook";
import { LessonResource, type ILessonResource } from "@/models/LessonResource";
import type { LessonResourceDto, TeacherLessonResourcesResponse } from "@/types/lesson-resources";
import { recordLessonAudit } from "@/lib/lessons/lesson-audit";

const CreateBodySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("link"),
    title: z.string().trim().min(1).max(220),
    url: z.string().trim().url().max(2000),
    description: z.string().trim().max(500).optional().or(z.literal("")).nullable(),
    linkType: z.enum(["pdf", "video", "link", "image", "document", "audio", "slide", "worksheet", "other"]).optional(),
    visibility: z.enum(["teacher_only", "students", "students_and_parents"]).default("students"),
  }),
  z.object({
    kind: z.literal("library_book"),
    libraryBookId: z.string().trim().min(1),
    title: z.string().trim().max(220).optional().or(z.literal("")),
    description: z.string().trim().max(500).optional().or(z.literal("")).nullable(),
    visibility: z.enum(["teacher_only", "students", "students_and_parents"]).default("students"),
  }),
]);

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

function formatResource(r: ILessonResource): LessonResourceDto {
  return {
    id: String(r._id),
    lessonId: String(r.lessonId),
    kind: r.kind,
    title: r.title,
    description: r.description ?? null,
    url: r.url ?? null,
    linkType: r.linkType ?? null,
    libraryBookId: r.libraryBookId ? String(r.libraryBookId) : null,
    visibility: r.visibility,
    order: r.order,
    createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null,
    updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : null,
  };
}

async function loadLessonOwned(
  lessonId: mongoose.Types.ObjectId,
  schoolId: mongoose.Types.ObjectId,
  teacherId: mongoose.Types.ObjectId
) {
  return Lesson.findOne({
    _id: lessonId,
    schoolId,
    teacherId,
  })
    .select("_id")
    .lean() as Promise<Pick<ILesson, "_id"> | null>;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    if (!can(context.permissions, PERMISSIONS.journalView)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const lessonId = toObjectIdOrNull(id);
    if (!lessonId) {
      return Response.json({ success: false, error: "Invalid lesson ID" }, { status: 400 });
    }

    const lesson = await loadLessonOwned(lessonId, context.schoolId, context.teacherId);
    if (!lesson) {
      return Response.json({ success: false, error: "Lesson not found" }, { status: 404 });
    }

    const rows = (await LessonResource.find({
      schoolId: context.schoolId,
      lessonId,
    })
      .sort({ order: 1, createdAt: 1 })
      .lean()) as ILessonResource[];

    const body: TeacherLessonResourcesResponse = {
      success: true,
      data: { items: rows.map(formatResource) },
    };
    return Response.json(body);
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to load lesson resources:", e);
    const message = e instanceof Error ? e.message : "Failed to load resources";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    if (!can(context.permissions, PERMISSIONS.journalWrite)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const lessonId = toObjectIdOrNull(id);
    if (!lessonId) {
      return Response.json({ success: false, error: "Invalid lesson ID" }, { status: 400 });
    }

    const lesson = await loadLessonOwned(lessonId, context.schoolId, context.teacherId);
    if (!lesson) {
      return Response.json({ success: false, error: "Lesson not found" }, { status: 404 });
    }

    const raw = await req.json().catch(() => null);
    const parsed = CreateBodySchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues?.map((i) => i.message).join(", ") || "Invalid data";
      return Response.json({ success: false, error: `Validation failed: ${msg}` }, { status: 400 });
    }

    const maxOrder = await LessonResource.findOne({
      schoolId: context.schoolId,
      lessonId,
    })
      .sort({ order: -1 })
      .select("order")
      .lean() as { order?: number } | null;

    const nextOrder = (maxOrder?.order ?? -1) + 1;

    if (parsed.data.kind === "library_book") {
      const bookOid = toObjectIdOrNull(parsed.data.libraryBookId);
      if (!bookOid) {
        return Response.json({ success: false, error: "Invalid book id" }, { status: 400 });
      }
      const book = await LibraryBook.findOne({
        _id: bookOid,
        schoolId: context.schoolId,
        status: "active",
      })
        .select("title")
        .lean();
      if (!book) {
        return Response.json(
          { success: false, error: "Library book not found or not available" },
          { status: 400 }
        );
      }
      const title =
        parsed.data.title && parsed.data.title.trim().length > 0
          ? parsed.data.title.trim()
          : book.title;
      const created = await LessonResource.create({
        schoolId: context.schoolId,
        lessonId,
        teacherId: context.teacherId,
        kind: "library_book",
        title,
        description: parsed.data.description?.trim() || undefined,
        libraryBookId: bookOid,
        visibility: parsed.data.visibility,
        order: nextOrder,
      });
      void recordLessonAudit({
        schoolId: context.schoolId,
        lessonId,
        actorId: context.userId,
        action: "resource_added",
        metadata: { resourceId: String(created._id), kind: "library_book" },
        httpRequest: req,
        actorRole: context.isAdmin ? "school_admin" : "teacher",
      });
      return Response.json({ success: true, data: { id: String(created._id) } });
    }

    const desc = parsed.data.description?.trim();
    const created = await LessonResource.create({
      schoolId: context.schoolId,
      lessonId,
      teacherId: context.teacherId,
      kind: "link",
      title: parsed.data.title,
      url: parsed.data.url.trim(),
      description: desc || undefined,
      linkType: parsed.data.linkType,
      visibility: parsed.data.visibility,
      order: nextOrder,
    });

    void recordLessonAudit({
      schoolId: context.schoolId,
      lessonId,
      actorId: context.userId,
      action: "resource_added",
      metadata: { resourceId: String(created._id), kind: "link" },
      httpRequest: req,
      actorRole: context.isAdmin ? "school_admin" : "teacher",
    });

    return Response.json({ success: true, data: { id: String(created._id) } });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to create lesson resource:", e);
    const message = e instanceof Error ? e.message : "Failed to create resource";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
