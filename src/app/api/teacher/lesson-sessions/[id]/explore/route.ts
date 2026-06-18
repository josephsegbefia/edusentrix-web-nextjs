import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import {
  generateTeacherSessionExplore,
  getTeacherSessionExploreStatus,
  publishTeacherSessionExplore,
} from "@/lib/learn/teacher-session-explore.service";
import { assertLessonsModuleEnabled } from "@/lib/lessons/settings";

type Params = { params: Promise<{ id: string }> };

function parseClassGroupId(req: Request): string | null {
  const value = new URL(req.url).searchParams.get("classGroupId");
  return value && mongoose.Types.ObjectId.isValid(value) ? value : null;
}

export async function GET(req: Request, { params }: Params) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    const gate = await assertLessonsModuleEnabled(context.schoolId);
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

    const data = await getTeacherSessionExploreStatus({
      schoolId: context.schoolId,
      sessionId: new mongoose.Types.ObjectId(id),
      classGroupId: parseClassGroupId(req),
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("[teacher/lesson-sessions/explore:GET]", error);
    return NextResponse.json(
      { success: false, error: "Failed to load Explore status." },
      { status: 500 },
    );
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    const gate = await assertLessonsModuleEnabled(context.schoolId);
    if (!gate.ok) {
      return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
    }
    if (!can(context.permissions, PERMISSIONS.lessonsUpdate)) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Invalid session ID" }, { status: 400 });
    }

    const result = await generateTeacherSessionExplore({
      schoolId: context.schoolId,
      teacherId: context.teacherId,
      userId: context.userId,
      sessionId: new mongoose.Types.ObjectId(id),
      isAdmin: context.isAdmin,
      classGroupId: parseClassGroupId(req),
    });

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("[teacher/lesson-sessions/explore:POST]", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate Explore mission." },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    const gate = await assertLessonsModuleEnabled(context.schoolId);
    if (!gate.ok) {
      return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
    }
    if (!can(context.permissions, PERMISSIONS.lessonsUpdate)) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Invalid session ID" }, { status: 400 });
    }

    const result = await publishTeacherSessionExplore({
      schoolId: context.schoolId,
      teacherId: context.teacherId,
      userId: context.userId,
      sessionId: new mongoose.Types.ObjectId(id),
      isAdmin: context.isAdmin,
      classGroupId: parseClassGroupId(req),
    });

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("[teacher/lesson-sessions/explore:PATCH]", error);
    return NextResponse.json(
      { success: false, error: "Failed to publish Explore mission." },
      { status: 500 },
    );
  }
}
