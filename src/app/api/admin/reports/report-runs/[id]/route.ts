import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { UserMembership } from "@/models/UserMembership";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import {
  getAdminReportRunById,
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

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSchoolAdminOrDelegatedAnyPermission(["reports.view"]);
    await connectToDatabase();

    const { id } = await ctx.params;
    const result = await getAdminReportRunById(await toApprovalContext(auth), id);

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    console.error("Admin report run GET:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load report run" },
      { status: 500 }
    );
  }
}
