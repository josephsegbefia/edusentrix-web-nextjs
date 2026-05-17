/* eslint-disable @typescript-eslint/no-explicit-any */
// GET /api/admin/class-groups
import { NextRequest } from "next/server";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { requireSchoolAdminOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { ClassGroup } from "@/models/ClassGroup";
import mongoose from "mongoose";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_req: NextRequest) {
  try {
    let schoolId: mongoose.Types.ObjectId;
    try {
      const adminContext = await requireSchoolAdminOrDelegatedModuleView("grades");
      schoolId = adminContext.schoolId;
    } catch (error) {
      if (!(error instanceof Response)) throw error;
      const financeContext = await requireFinanceStaff();
      schoolId = financeContext.schoolId;
    }
    await connectToDatabase();

    const url = new URL(_req.url);
    const activeOnly = url.searchParams.get("active") === "1";
    const gradeId = url.searchParams.get("gradeId");

    const query: any = { schoolId };
    if (activeOnly) {
      query.isActive = true;
    }
    if (gradeId && mongoose.isValidObjectId(gradeId)) {
      query.gradeId = new mongoose.Types.ObjectId(gradeId);
    }

    const classGroups = await ClassGroup.find(query)
      .sort({ name: 1 })
      .lean();

    return Response.json({ success: true, data: classGroups }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    console.error(error);
    const message = error instanceof Error ? error.message : "Failed to fetch class groups";
    return new Response(message, { status: 500 });
  }
}
