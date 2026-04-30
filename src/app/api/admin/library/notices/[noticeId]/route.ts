import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { LIBRARY_PERMISSIONS } from "@/lib/library/library.permissions";
import {
  getLibraryNoticeById,
  serializeLibraryNoticeAdmin,
  updateLibraryNotice,
} from "@/lib/library/library-notice.service";
import { updateLibraryNoticeBodySchema } from "@/lib/library/library.validators";

function toOid(id: unknown) {
  return new mongoose.Types.ObjectId(String(id));
}

type RouteCtx = { params: Promise<{ noticeId: string }> };

export async function GET(_req: NextRequest, ctx: RouteCtx) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedAnyPermission([
      LIBRARY_PERMISSIONS.NOTICES_MANAGE,
    ]);
    const { noticeId } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(noticeId)) {
      return NextResponse.json(
        { success: false, error: { code: "validation", message: "Invalid notice id" } },
        { status: 400 }
      );
    }
    await connectToDatabase();
    const doc = await getLibraryNoticeById(toOid(schoolId), new mongoose.Types.ObjectId(noticeId));
    if (!doc) {
      return NextResponse.json(
        { success: false, error: { code: "not_found", message: "Notice not found" } },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: serializeLibraryNoticeAdmin(doc) });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json(
      { success: false, error: { code: "error", message: msg } },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  try {
    const { schoolId, userId } = await requireSchoolAdminOrDelegatedAnyPermission([
      LIBRARY_PERMISSIONS.NOTICES_MANAGE,
    ]);
    const { noticeId } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(noticeId)) {
      return NextResponse.json(
        { success: false, error: { code: "validation", message: "Invalid notice id" } },
        { status: 400 }
      );
    }
    await connectToDatabase();
    const body = (await req.json()) as unknown;
    const parsed = updateLibraryNoticeBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "validation", message: parsed.error.message } },
        { status: 400 }
      );
    }
    try {
      const doc = await updateLibraryNotice(
        toOid(schoolId),
        new mongoose.Types.ObjectId(noticeId),
        toOid(userId),
        parsed.data
      );
      if (!doc) {
        return NextResponse.json(
          { success: false, error: { code: "not_found", message: "Notice not found" } },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: serializeLibraryNoticeAdmin(doc) });
    } catch (err) {
      const m = err instanceof Error ? err.message : "Update failed";
      return NextResponse.json(
        { success: false, error: { code: "validation", message: m } },
        { status: 400 }
      );
    }
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json(
      { success: false, error: { code: "error", message: msg } },
      { status: 500 }
    );
  }
}
