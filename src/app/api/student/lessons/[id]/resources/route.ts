import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolMember } from "@/lib/auth/requireSchoolMember";
import { Student } from "@/models/Student";
import { Lesson, type ILesson } from "@/models/Lesson";
import { LessonResource, type ILessonResource } from "@/models/LessonResource";
import { LibraryBook } from "@/models/LibraryBook";
import { serializeLibraryBookPatron } from "@/lib/library/library.serialize";
import type { ILibraryBook } from "@/models/LibraryBook";
import type { StudentLessonResourceRow, StudentLessonResourcesResponse } from "@/types/lesson-resources";
import { assertLessonsFeatureEnabled, assertLessonsModuleEnabled } from "@/lib/lessons/settings";

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireSchoolMember({ allowedRoles: ["student"] });
    await connectToDatabase();
    const { id } = await params;
    const moduleGate = await assertLessonsModuleEnabled(context.schoolId);
    if (!moduleGate.ok) {
      return Response.json({ success: false, error: moduleGate.error }, { status: moduleGate.status });
    }
    const featureGate = assertLessonsFeatureEnabled(moduleGate.settings, "enableResources", "Lesson resources");
    if (!featureGate.ok) {
      return Response.json({ success: false, error: featureGate.error }, { status: featureGate.status });
    }

    const lessonId = toObjectIdOrNull(id);
    if (!lessonId) {
      return Response.json({ success: false, error: "Invalid lesson ID" }, { status: 400 });
    }

    const student = (await Student.findOne({
      userId: context.userId,
      schoolId: context.schoolId,
      status: "active",
    })
      .select("_id classGroupId")
      .lean()) as { _id: mongoose.Types.ObjectId; classGroupId: mongoose.Types.ObjectId } | null;

    if (!student) {
      return Response.json({ success: false, error: "Student not found" }, { status: 404 });
    }

    const lesson = (await Lesson.findOne({
      _id: lessonId,
      schoolId: context.schoolId,
      classGroupId: student.classGroupId,
      status: "published",
    })
      .select("_id")
      .lean()) as Pick<ILesson, "_id"> | null;

    if (!lesson) {
      return Response.json({ success: false, error: "Lesson not found" }, { status: 404 });
    }

    const rows = (await LessonResource.find({
      schoolId: context.schoolId,
      lessonId,
      visibility: { $in: ["students", "students_and_parents"] },
    })
      .sort({ order: 1, createdAt: 1 })
      .lean()) as ILessonResource[];

    const libraryIds = rows
      .filter((r) => r.kind === "library_book" && r.libraryBookId)
      .map((r) => r.libraryBookId as mongoose.Types.ObjectId);

    const uniqueBookIds = [...new Set(libraryIds.map(String))].map((s) => new mongoose.Types.ObjectId(s));
    const books =
      uniqueBookIds.length > 0
        ? ((await LibraryBook.find({
            _id: { $in: uniqueBookIds },
            schoolId: context.schoolId,
            status: "active",
          }).lean()) as ILibraryBook[])
        : [];

    const bookById = new Map(books.map((b) => [String(b._id), b]));

    const items: StudentLessonResourceRow[] = rows.map((r) => {
      if (r.kind === "link") {
        return {
          id: String(r._id),
          kind: "link",
          title: r.title,
          description: r.description ?? null,
          url: r.url || "#",
          linkType: r.linkType ?? null,
          order: r.order,
        };
      }
      if (r.kind === "file") {
        return {
          id: String(r._id),
          kind: "file",
          title: r.title,
          description: r.description ?? null,
          fileUrl: r.fileUrl || "#",
          fileName: r.fileName ?? null,
          fileSizeBytes: r.fileSizeBytes ?? null,
          mimeType: r.mimeType ?? null,
          fileType: r.fileType ?? null,
          order: r.order,
        };
      }
      const bid = r.libraryBookId ? String(r.libraryBookId) : "";
      const doc = bid ? bookById.get(bid) : undefined;
      const book = doc ? serializeLibraryBookPatron(doc) : null;
      return {
        id: String(r._id),
        kind: "library_book",
        title: r.title,
        description: r.description ?? null,
        order: r.order,
        libraryBookId: bid,
        book,
        libraryPath: `/student/library/${bid}`,
      };
    });

    const body: StudentLessonResourcesResponse = { success: true, data: { items } };
    return Response.json(body);
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to load student lesson resources:", e);
    const message = e instanceof Error ? e.message : "Failed to load resources";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
