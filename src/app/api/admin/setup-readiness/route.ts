import { NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { getSchoolSetupReadiness } from "@/lib/admin/school-setup-readiness";

export async function GET() {
  try {
    const { schoolId } = await requireSchoolAdmin();
    const data = await getSchoolSetupReadiness(schoolId);
    return NextResponse.json({ success: true, data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to load setup readiness";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
