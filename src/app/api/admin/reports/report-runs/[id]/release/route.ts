import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { UserMembership } from "@/models/UserMembership";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import {
  parseAdminReportReleaseBody,
  releaseAdminReportRun,
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

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSchoolAdminOrDelegatedAnyPermission(["reports.export"]);
    await connectToDatabase();

    const parsedBody = parseAdminReportReleaseBody(await req.json().catch(() => ({})));
    if (!parsedBody.ok) {
      return NextResponse.json({ success: false, error: parsedBody.error }, { status: 400 });
    }

    const { id } = await ctx.params;
    const result = await releaseAdminReportRun(
      await toApprovalContext(auth),
      id,
      parsedBody.data
    );

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    console.error("Admin report run release POST:", error);
    return NextResponse.json(
      { success: false, error: "Failed to release report run" },
      { status: 500 }
    );
  }
}
