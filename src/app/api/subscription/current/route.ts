import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { getSchoolSubscriptionSnapshot } from "@/lib/billing/entitlements";
import { User } from "@/models/User";

export async function GET() {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized." },
        { status: 401 }
      );
    }

    await connectToDatabase();
    const user = await User.findOne({ clerkUserId })
      .select("schoolId")
      .lean<{ schoolId?: unknown } | null>();

    const schoolId = user?.schoolId ? String(user.schoolId) : null;
    if (!schoolId) {
      return NextResponse.json(
        { success: false, error: "No school is associated with this account." },
        { status: 400 }
      );
    }

    const snapshot = await getSchoolSubscriptionSnapshot(schoolId);

    if (!snapshot) {
      return NextResponse.json(
        { success: false, error: "School subscription not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: snapshot });
  } catch (error) {
    console.error("Failed to load current subscription:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to load current subscription",
      },
      { status: 500 }
    );
  }
}
