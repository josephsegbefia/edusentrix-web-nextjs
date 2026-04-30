import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { mergedDelegationPermissions } from "@/lib/delegations/service";
import { requireSchoolAdminOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";
import { resolveLibraryCapabilities } from "@/lib/library/library-capabilities";

export async function GET() {
  try {
    const ctx = await requireSchoolAdminOrDelegatedModuleView("library");
    await connectToDatabase();
    const merged = ctx.isSchoolAdmin
      ? []
      : await mergedDelegationPermissions(ctx.schoolId, ctx.userId);
    const data = resolveLibraryCapabilities(ctx.isSchoolAdmin, merged);
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
