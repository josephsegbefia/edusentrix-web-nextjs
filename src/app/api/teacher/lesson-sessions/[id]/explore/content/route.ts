import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { databaseUnavailableMessage, isDatabaseConnectionError } from "@/lib/api/database-errors";
import { guidedAdventureContentV2Schema } from "@/lib/learn/explore/explore-schemas";
import {
  getTeacherSessionExploreDetailForReview,
  updateTeacherSessionExploreContent,
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

    const result = await getTeacherSessionExploreDetailForReview({
      schoolId: context.schoolId,
      teacherId: context.teacherId,
      sessionId: new mongoose.Types.ObjectId(id),
      isAdmin: context.isAdmin,
      classGroupId: parseClassGroupId(req),
    });

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    if (isDatabaseConnectionError(error)) {
      console.error("[teacher/lesson-sessions/explore/content:GET] database unavailable", error);
      return NextResponse.json(
        { success: false, error: databaseUnavailableMessage },
        { status: 503 },
      );
    }
    console.error("[teacher/lesson-sessions/explore/content:GET]", error);
    return NextResponse.json(
      { success: false, error: "Failed to load Explore mission." },
      { status: 500 },
    );
  }
}

const patchBodySchema = z.object({
  content: guidedAdventureContentV2Schema,
});

export async function PATCH(req: Request, { params }: Params) {
  try {
    const context = await requireTeacher();
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

    const json = await req.json().catch(() => null);
    const parsed = patchBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid Explore content." }, { status: 400 });
    }

    const result = await updateTeacherSessionExploreContent({
      schoolId: context.schoolId,
      teacherId: context.teacherId,
      sessionId: new mongoose.Types.ObjectId(id),
      isAdmin: context.isAdmin,
      classGroupId: parseClassGroupId(req),
      content: parsed.data.content,
    });

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    if (isDatabaseConnectionError(error)) {
      console.error("[teacher/lesson-sessions/explore/content:PATCH] database unavailable", error);
      return NextResponse.json(
        { success: false, error: databaseUnavailableMessage },
        { status: 503 },
      );
    }
    console.error("[teacher/lesson-sessions/explore/content:PATCH]", error);
    const message =
      error instanceof Error ? error.message : "Failed to save Explore content.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
