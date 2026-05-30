import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import {
  listHomeroomReportRuns,
  openHomeroomReportRun,
  parseOpenReportCardRunBody,
} from "@/lib/academics/reporting/report-card-run-service";

function toHomeroomContext(context: Awaited<ReturnType<typeof requireTeacher>>) {
  return {
    schoolId: context.schoolId,
    teacherId: context.teacherId,
    userId: context.userId,
    homeroomClassGroupId: context.homeroomClassGroupId,
    isAdmin: context.isAdmin,
  };
}

export async function GET(req: NextRequest) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    if (!can(context.permissions, PERMISSIONS.gradebookView)) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const academicPeriodId = req.nextUrl.searchParams.get("academicPeriodId");
    const classGroupId = req.nextUrl.searchParams.get("classGroupId");

    const result = await listHomeroomReportRuns(toHomeroomContext(context), {
      academicPeriodId,
      classGroupId,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    console.error("Homeroom report runs GET:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load report runs" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    if (!can(context.permissions, PERMISSIONS.gradebookPublish)) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const parsedBody = parseOpenReportCardRunBody(await req.json());
    if (!parsedBody.ok) {
      return NextResponse.json({ success: false, error: parsedBody.error }, { status: 400 });
    }

    const result = await openHomeroomReportRun(toHomeroomContext(context), parsedBody.data);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json({ success: true, data: result.data }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    console.error("Homeroom report runs POST:", error);
    return NextResponse.json(
      { success: false, error: "Failed to open report run" },
      { status: 500 }
    );
  }
}
