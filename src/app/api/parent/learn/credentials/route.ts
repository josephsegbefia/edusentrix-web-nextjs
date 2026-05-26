import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent } from "@/lib/auth/requireParent";
import { getParentLearnOverview } from "@/lib/learn/parent-learn-overview";

export async function GET() {
  try {
    const ctx = await requireParent();
    await connectToDatabase();

    const overview = await getParentLearnOverview(ctx.schoolId, ctx.userId);
    return NextResponse.json({
      success: true,
      data: {
        credentials: overview.wards.map((ward) => ({
          studentId: ward.studentId,
          studentName: ward.name,
          username: ward.account?.username || null,
          accountStatus: ward.account?.status || null,
          mustChangePassword: ward.account?.mustChangePassword || false,
          credentialsDeliveredAt: ward.account?.credentialsDeliveredAt || null,
        })),
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("[parent/learn/credentials:GET]", error);
    return NextResponse.json(
      { success: false, error: "Failed to load Learn credentials." },
      { status: 500 }
    );
  }
}
