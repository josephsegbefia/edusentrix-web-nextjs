import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  requireSchoolAdminOrDelegatedAnyPermission,
  requireSchoolAdminOrDelegatedModuleView,
} from "@/lib/delegations/requireDelegatedModulePermission";
import { LIBRARY_PERMISSIONS } from "@/lib/library/library.permissions";
import { patchLibrarySettingsSchema } from "@/lib/library/library.validators";
import { getOrCreateLibrarySettings, patchLibrarySettingsDb } from "@/lib/library/library-settings.service";
import { serializeLibrarySettings } from "@/lib/library/library.serialize";
import { auditLibrarySettingsUpdated } from "@/lib/library/library-audit";

function toOid(id: unknown) {
  return new mongoose.Types.ObjectId(String(id));
}

export async function GET() {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedModuleView("library");
    await connectToDatabase();
    const settings = await getOrCreateLibrarySettings(toOid(schoolId));
    return NextResponse.json({ success: true, data: serializeLibrarySettings(settings) });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ success: false, error: { code: "error", message: msg } }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { schoolId, userId } = await requireSchoolAdminOrDelegatedAnyPermission([
      LIBRARY_PERMISSIONS.SETTINGS_MANAGE,
    ]);
    await connectToDatabase();
    const body = (await req.json()) as unknown;
    const parsed = patchLibrarySettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "validation", message: parsed.error.message } },
        { status: 400 }
      );
    }
    if (Object.keys(parsed.data).length === 0) {
      return NextResponse.json(
        { success: false, error: { code: "validation", message: "No fields to update" } },
        { status: 400 }
      );
    }
    const updated = await patchLibrarySettingsDb(toOid(schoolId), parsed.data);
    await auditLibrarySettingsUpdated(
      req,
      toOid(schoolId),
      toOid(userId),
      toOid(updated._id),
      { ...parsed.data } as Record<string, unknown>
    );
    return NextResponse.json({ success: true, data: serializeLibrarySettings(updated) });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ success: false, error: { code: "error", message: msg } }, { status: 500 });
  }
}
