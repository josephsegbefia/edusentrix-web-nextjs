/* eslint-disable @typescript-eslint/no-explicit-any */
// GET /api/admin/grades
import { NextRequest } from "next/server";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Grade } from "@/models/Grade";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_req: NextRequest) {
  try {
    const { schoolId } = await requireFinanceStaff();
    await connectToDatabase();

    const url = new URL(_req.url);
    const activeOnly = url.searchParams.get("active") === "1" || url.searchParams.get("isActive") === "true";

    const query: any = { schoolId };
    if (activeOnly) {
      query.isActive = true;
    }

    const grades = await Grade.find(query)
      .sort({ order: 1, name: 1 })
      .lean();

    const data = grades.map((g: any) => ({
      id: String(g._id),
      name: g.name,
      code: g.code || null,
      stage: g.stage || "Basic",
      order: g.order ?? 0,
      isActive: g.isActive ?? true,
    }));

    return Response.json({ success: true, data }, { status: 200 });
  } catch (error: unknown) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Failed to fetch grades";
    return new Response(message, { status: 500 });
  }
}
