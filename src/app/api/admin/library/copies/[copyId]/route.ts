import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  requireSchoolAdminOrDelegatedAnyPermission,
  requireSchoolAdminOrDelegatedModuleView,
} from "@/lib/delegations/requireDelegatedModulePermission";
import { LIBRARY_PERMISSIONS } from "@/lib/library/library.permissions";
import { updateLibraryBookCopySchema } from "@/lib/library/library.validators";
import { getCopyById, updateLibraryCopy } from "@/lib/library/library-copy.service";
import { serializeLibraryCopy } from "@/lib/library/library.serialize";
import { auditLibraryCopyUpdated } from "@/lib/library/library-audit";

function toOid(id: unknown) {
  return new mongoose.Types.ObjectId(String(id));
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ copyId: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedModuleView("library");
    const { copyId } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(copyId)) {
      return NextResponse.json(
        { success: false, error: { code: "invalid_id", message: "Invalid copy id" } },
        { status: 400 }
      );
    }
    await connectToDatabase();
    const copy = await getCopyById(toOid(schoolId), toOid(copyId));
    if (!copy) {
      return NextResponse.json(
        { success: false, error: { code: "not_found", message: "Copy not found" } },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: serializeLibraryCopy(copy) });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ success: false, error: { code: "error", message: msg } }, { status: 500 });
  }
}

export async function PATCH(
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
    const body = (await req.json()) as unknown;
    const parsed = updateLibraryBookCopySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "validation", message: parsed.error.message } },
        { status: 400 }
      );
    }
    const updated = await updateLibraryCopy(toOid(schoolId), toOid(copyId), toOid(userId), parsed.data);
    if (!updated) {
      return NextResponse.json(
        { success: false, error: { code: "not_found", message: "Copy not found" } },
        { status: 404 }
      );
    }
    await auditLibraryCopyUpdated(req, toOid(schoolId), toOid(userId), toOid(copyId), {
      ...parsed.data,
    } as Record<string, unknown>);
    return NextResponse.json({ success: true, data: serializeLibraryCopy(updated) });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Server error";
    const status = msg.includes("Cannot") ? 400 : 500;
    return NextResponse.json({ success: false, error: { code: "error", message: msg } }, { status });
  }
}
