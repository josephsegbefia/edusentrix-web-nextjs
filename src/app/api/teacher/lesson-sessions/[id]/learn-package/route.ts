import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { gateLessonsModule } from "@/lib/lessons/lesson-gates";
import { getTeacherSessionLearnPackage } from "@/lib/lessons/learn-package-readiness";

type Params = { params: Promise<{ id: string }> };

function parseClassGroupId(req: Request): mongoose.Types.ObjectId | null {
  const value = new URL(req.url).searchParams.get("classGroupId");
  return value && mongoose.Types.ObjectId.isValid(value)
    ? new mongoose.Types.ObjectId(value)
    : null;
}

export async function GET(req: Request, { params }: Params) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    const gate = await gateLessonsModule(context.schoolId);
    if (!gate.ok) {
      return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
    }
    if (!can(context.permissions, PERMISSIONS.lessonsRead)) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Invalid session ID" }, { status: 400 });
    }

    const data = await getTeacherSessionLearnPackage({
      schoolId: context.schoolId,
      sessionId: new mongoose.Types.ObjectId(id),
      classGroupId: parseClassGroupId(req),
    });

    if (!data) {
      return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("[teacher/lesson-sessions/learn-package:GET]", error);
    return NextResponse.json(
      { success: false, error: "Failed to load Learn package." },
      { status: 500 },
    );
  }
}
