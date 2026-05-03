import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requirePlatformInternalTestAccess } from "@/lib/auth/requirePlatformInternalTest";
import { User } from "@/models/User";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requirePlatformInternalTestAccess();
    if (!gate.ok) return gate.res;

    const { id: schoolIdParam } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(schoolIdParam)) {
      return NextResponse.json({ success: false, error: "Invalid school id" }, { status: 400 });
    }
    const schoolId = new mongoose.Types.ObjectId(schoolIdParam);

    await connectToDatabase();

    const rows = await User.find({
      schoolId,
      isTestUser: true,
    })
      .select("email firstName lastName role testUserSource")
      .sort({ role: 1, email: 1 })
      .limit(300)
      .lean();

    return NextResponse.json({
      success: true,
      data: {
        items: rows.map((u) => ({
          id: String(u._id),
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          role: u.role,
          testUserSource: u.testUserSource ?? null,
        })),
      },
    });
  } catch (e) {
    console.error("internal-test test-users GET", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to load test users" },
      { status: 500 }
    );
  }
}
