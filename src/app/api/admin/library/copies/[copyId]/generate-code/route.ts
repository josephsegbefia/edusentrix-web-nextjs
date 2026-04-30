import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  requireSchoolAdminOrDelegatedAnyPermission,
} from "@/lib/delegations/requireDelegatedModulePermission";
import { LIBRARY_PERMISSIONS } from "@/lib/library/library.permissions";
import { getCopyById, ensureLibraryCopyScannableCodes } from "@/lib/library/library-copy.service";
import { serializeLibraryCopy } from "@/lib/library/library.serialize";
import { auditLibraryCopyUpdated } from "@/lib/library/library-audit";

function toOid(id: unknown) {
  return new mongoose.Types.ObjectId(String(id));
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ copyId: string }> }
) {
  try {
    const { schoolId, userId } = await requireSchoolAdminOrDelegatedAnyPermission([
      LIBRARY_PERMISSIONS.COPIES_UPDATE,
    ]);
    const { copyId } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(copyId)) {
      return NextResponse.json(
        { success: false, error: { code: "invalid_id", message: "Invalid copy id" } },
        { status: 400 }
      );
    }
    await connectToDatabase();
    const before = await getCopyById(toOid(schoolId), toOid(copyId));
    if (!before) {
      return NextResponse.json(
        { success: false, error: { code: "not_found", message: "Copy not found" } },
        { status: 404 }
      );
    }
    const updated = await ensureLibraryCopyScannableCodes(
      toOid(schoolId),
      toOid(copyId),
      toOid(userId)
    );
    if (!updated) {
      return NextResponse.json(
        { success: false, error: { code: "not_found", message: "Copy not found" } },
        { status: 404 }
      );
    }
    const changed =
      before.barcode !== updated.barcode || before.qrCode !== updated.qrCode;
    if (changed) {
      await auditLibraryCopyUpdated(req, toOid(schoolId), toOid(userId), toOid(copyId), {
        barcode: updated.barcode,
        qrCode: updated.qrCode,
      });
    }
    return NextResponse.json({ success: true, data: serializeLibraryCopy(updated) });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Server error";
    const status = msg.includes("conflict") ? 409 : 500;
    return NextResponse.json({ success: false, error: { code: "error", message: msg } }, { status });
  }
}
