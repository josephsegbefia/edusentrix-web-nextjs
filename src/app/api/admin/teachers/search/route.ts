// src/app/api/admin/teachers/search/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import mongoose from "mongoose";
import { Teacher } from "@/models/Teacher";
import { escapeRegex, parsePositiveInt } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const { searchParams } = new URL(req.url);

    const q = (searchParams.get("q") || "").trim();
    const limit = Math.min(parsePositiveInt(searchParams.get("limit"), 10), 25);

    const query: any = { schoolId: schoolIdObj, status: { $in: ["active", "on_leave"] } };

    const items = await Teacher.find(query)
      .select("_id userId")
      .populate("userId", "firstName lastName email avatarUrl")
      .limit(limit * 2) // Get more to filter after population
      .lean();

    // Filter by search query after population
    let filtered = items;
    if (q) {
      const searchLower = q.toLowerCase();
      filtered = items.filter((t: any) => {
        const user = t.userId;
        const firstName = (user?.firstName || "").toLowerCase();
        const lastName = (user?.lastName || "").toLowerCase();
        const email = (user?.email || "").toLowerCase();
        return (
          firstName.includes(searchLower) ||
          lastName.includes(searchLower) ||
          email.includes(searchLower) ||
          `${firstName} ${lastName}`.trim().includes(searchLower)
        );
      }).slice(0, limit);
    }

    return Response.json({
      success: true,
      data: (filtered || []).map((t: any) => {
        const user = t.userId;
        const firstName = user?.firstName || "";
        const lastName = user?.lastName || "";
        const fullName = `${firstName} ${lastName}`.trim() || user?.email?.split("@")[0] || "Unknown Teacher";

        return {
          id: String(t._id),
          firstName,
          lastName,
          fullName,
          email: user?.email || null,
          photoUrl: user?.avatarUrl || null,
        };
      }),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to search teachers";
    return Response.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
