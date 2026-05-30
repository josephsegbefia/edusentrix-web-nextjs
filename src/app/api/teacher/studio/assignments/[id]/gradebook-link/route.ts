import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { requireTeacherStudioAccess } from "@/lib/features/teacherStudio";
import {
  addStudioHomeworkToGradebook,
  getStudioGradebookLinkPreview,
  parseAddStudioToGradebookBody,
} from "@/lib/academics/assessment-engine/studio-to-gradebook-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    await requireTeacherStudioAccess(context, PERMISSIONS.assignmentsView);

    const { id } = await ctx.params;
    const result = await getStudioGradebookLinkPreview(
      {
        schoolId: context.schoolId,
        teacherId: context.teacherId,
        isAdmin: context.isAdmin,
      },
      id
    );

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Studio gradebook link GET:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load gradebook link status" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    await requireTeacherStudioAccess(context, PERMISSIONS.assignmentsGrade);

    if (!can(context.permissions, PERMISSIONS.gradebookRecord)) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const parsedBody = parseAddStudioToGradebookBody(await req.json());
    if (!parsedBody.ok) {
      return NextResponse.json({ success: false, error: parsedBody.error }, { status: 400 });
    }

    const { id } = await ctx.params;
    const result = await addStudioHomeworkToGradebook(
      {
        schoolId: context.schoolId,
        teacherId: context.teacherId,
        userId: context.userId,
        isAdmin: context.isAdmin,
      },
      id,
      parsedBody.data
    );

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json({ success: true, data: result.data }, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Studio gradebook link POST:", error);
    return NextResponse.json(
      { success: false, error: "Failed to add assignment marks to gradebook" },
      { status: 500 }
    );
  }
}
