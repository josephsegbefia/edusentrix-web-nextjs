import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { UserMembership } from "@/models/UserMembership";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import {
  listAdminReportRuns,
  type AdminReportApprovalContext,
} from "@/lib/academics/reporting/report-card-approval-service";

async function toApprovalContext(input: {
  schoolId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  isSchoolAdmin: boolean;
}): Promise<AdminReportApprovalContext> {
  if (input.isSchoolAdmin) {
    return {
      schoolId: input.schoolId,
      userId: input.userId,
      actorRole: "school_admin",
    };
  }

  const membership = await UserMembership.findOne({
    userId: input.userId,
    schoolId: input.schoolId,
    status: "active",
  })
    .select("roles")
    .lean<{ roles?: string[] } | null>();

  return {
    schoolId: input.schoolId,
    userId: input.userId,
    actorRole: membership?.roles?.[0] ?? "delegate",
  };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireSchoolAdminOrDelegatedAnyPermission(["reports.view"]);
    await connectToDatabase();

    const context = await toApprovalContext(auth);
    const status = req.nextUrl.searchParams.get("status");
    const academicPeriodId = req.nextUrl.searchParams.get("academicPeriodId");
    const classGroupId = req.nextUrl.searchParams.get("classGroupId");

    const result = await listAdminReportRuns(context, {
      status,
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
    console.error("Admin report runs GET:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load report runs" },
      { status: 500 }
    );
  }
}
