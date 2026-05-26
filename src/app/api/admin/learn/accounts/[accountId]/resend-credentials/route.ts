import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { resendLearnAccountCredentials } from "@/lib/learn/admin-account-service";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ accountId: string }> }
) {
  try {
    const admin = await requireSchoolAdmin();
    const { accountId } = await ctx.params;
    if (!Types.ObjectId.isValid(accountId)) {
      return NextResponse.json(
        { success: false, error: "Invalid account id." },
        { status: 400 }
      );
    }

    const result = await resendLearnAccountCredentials({
      schoolId: admin.schoolId,
      accountId: new Types.ObjectId(accountId),
      actorUserId: admin.userId,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("[admin/learn/accounts/resend-credentials:POST]", error);
    return NextResponse.json(
      { success: false, error: "Failed to resend Learn credentials." },
      { status: 500 }
    );
  }
}
