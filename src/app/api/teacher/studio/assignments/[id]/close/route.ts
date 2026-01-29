import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { Homework } from "@/models/Homework";
import { requireTeacherStudioAccess } from "@/lib/features/teacherStudio";
import { PERMISSIONS } from "@/lib/rbac";

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    await requireTeacherStudioAccess(context, PERMISSIONS.assignmentsPublish);

    const { id } = await ctx.params;
    const homeworkId = toObjectIdOrNull(id);

    if (!homeworkId) {
      return Response.json({ success: false, error: "Invalid assignment ID" }, { status: 400 });
    }

    const homework = await Homework.findOne({
      _id: homeworkId,
      schoolId: context.schoolId,
      teacherId: context.teacherId,
    })
      .select("status")
      .lean();

    if (!homework) {
      return Response.json({ success: false, error: "Assignment not found" }, { status: 404 });
    }

    if (homework.status === "closed") {
      return Response.json({ success: true, data: { status: "closed" } });
    }

    await Homework.updateOne(
      { _id: homeworkId },
      { $set: { status: "closed", closedAt: new Date() } }
    );

    return Response.json({ success: true, data: { status: "closed" } });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to close assignment:", e);
    const message = e instanceof Error ? e.message : "Failed to close assignment";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
