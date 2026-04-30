import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdminOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";
import { getLibraryDashboardData } from "@/lib/library/library-dashboard.service";

function toOid(id: unknown) {
  return new mongoose.Types.ObjectId(String(id));
}

export async function GET() {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedModuleView("library");
    await connectToDatabase();
    const data = await getLibraryDashboardData(toOid(schoolId));
    return NextResponse.json({ success: true, data });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json(
      { success: false, error: { code: "error", message: msg } },
      { status: 500 }
    );
  }
}
