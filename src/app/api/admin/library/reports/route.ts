import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { LIBRARY_PERMISSIONS } from "@/lib/library/library.permissions";
import { libraryReportQuerySchema } from "@/lib/library/library.validators";
import { runLibraryReport } from "@/lib/library/library-report.service";

function toOid(id: unknown) {
  return new mongoose.Types.ObjectId(String(id));
}

export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedAnyPermission([
      LIBRARY_PERMISSIONS.REPORTS_VIEW,
    ]);
    await connectToDatabase();
    const raw = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = libraryReportQuerySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "validation", message: parsed.error.message } },
        { status: 400 }
      );
    }
    const schoolOid = toOid(schoolId);
    const d = parsed.data;
    const q = {
      type: d.type,
      from: d.from,
      to: d.to,
      limit: d.limit,
      classGroupId:
        d.classGroupId && mongoose.Types.ObjectId.isValid(d.classGroupId)
          ? new mongoose.Types.ObjectId(d.classGroupId)
          : undefined,
      gradeLevelId:
        d.gradeLevelId && mongoose.Types.ObjectId.isValid(d.gradeLevelId)
          ? new mongoose.Types.ObjectId(d.gradeLevelId)
          : undefined,
    };
    const data = await runLibraryReport(schoolOid, q);
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
