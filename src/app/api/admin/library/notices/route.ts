import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { LIBRARY_PERMISSIONS } from "@/lib/library/library.permissions";
import {
  createLibraryNotice,
  listAdminLibraryNotices,
  serializeLibraryNoticeAdmin,
} from "@/lib/library/library-notice.service";
import {
  createLibraryNoticeBodySchema,
  listAdminLibraryNoticesQuerySchema,
} from "@/lib/library/library.validators";

function toOid(id: unknown) {
  return new mongoose.Types.ObjectId(String(id));
}

export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedAnyPermission([
      LIBRARY_PERMISSIONS.NOTICES_MANAGE,
    ]);
    await connectToDatabase();
    const sp = Object.fromEntries(new URL(req.url).searchParams);
    const parsed = listAdminLibraryNoticesQuerySchema.safeParse(sp);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "validation", message: parsed.error.message } },
        { status: 400 }
      );
    }
    const { items, total } = await listAdminLibraryNotices(toOid(schoolId), parsed.data);
    const limit = parsed.data.limit;
    const page = parsed.data.page;
    const totalPages = limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1;
    return NextResponse.json({
      success: true,
      data: {
        items: items.map(serializeLibraryNoticeAdmin),
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json(
      { success: false, error: { code: "error", message: msg } },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { schoolId, userId } = await requireSchoolAdminOrDelegatedAnyPermission([
      LIBRARY_PERMISSIONS.NOTICES_MANAGE,
    ]);
    await connectToDatabase();
    const body = (await req.json()) as unknown;
    const parsed = createLibraryNoticeBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "validation", message: parsed.error.message } },
        { status: 400 }
      );
    }
    try {
      const doc = await createLibraryNotice(toOid(schoolId), toOid(userId), parsed.data);
      return NextResponse.json(
        { success: true, data: serializeLibraryNoticeAdmin(doc) },
        { status: 201 }
      );
    } catch (err) {
      const m = err instanceof Error ? err.message : "Create failed";
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
