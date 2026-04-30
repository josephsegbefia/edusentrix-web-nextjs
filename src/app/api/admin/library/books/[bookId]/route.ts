import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  requireSchoolAdminOrDelegatedAnyPermission,
  requireSchoolAdminOrDelegatedModuleView,
} from "@/lib/delegations/requireDelegatedModulePermission";
import { LIBRARY_PERMISSIONS } from "@/lib/library/library.permissions";
import { updateLibraryBookSchema } from "@/lib/library/library.validators";
import { getLibraryBookById, updateLibraryBook } from "@/lib/library/library-book.service";
import { serializeLibraryBook } from "@/lib/library/library.serialize";
import { auditLibraryBookUpdated } from "@/lib/library/library-audit";

function toOid(id: unknown) {
  return new mongoose.Types.ObjectId(String(id));
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ bookId: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedModuleView("library");
    const { bookId } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(bookId)) {
      return NextResponse.json(
        { success: false, error: { code: "invalid_id", message: "Invalid book id" } },
        { status: 400 }
      );
    }
    await connectToDatabase();
    const book = await getLibraryBookById(toOid(schoolId), toOid(bookId));
    if (!book) {
      return NextResponse.json(
        { success: false, error: { code: "not_found", message: "Book not found" } },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: serializeLibraryBook(book) });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ success: false, error: { code: "error", message: msg } }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ bookId: string }> }
) {
  try {
    const { bookId } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(bookId)) {
      return NextResponse.json(
        { success: false, error: { code: "invalid_id", message: "Invalid book id" } },
        { status: 400 }
      );
    }
    await connectToDatabase();
    const body = (await req.json()) as unknown;
    const parsed = updateLibraryBookSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "validation", message: parsed.error.message } },
        { status: 400 }
      );
    }
    const definedKeys = Object.keys(parsed.data).filter(
      (k) => parsed.data[k as keyof typeof parsed.data] !== undefined
    );
    const archiveOnly =
      definedKeys.length === 1 && parsed.data.status === "archived";
    const { schoolId, userId } = archiveOnly
      ? await requireSchoolAdminOrDelegatedAnyPermission([
          LIBRARY_PERMISSIONS.BOOKS_ARCHIVE,
        ])
      : await requireSchoolAdminOrDelegatedAnyPermission([
          LIBRARY_PERMISSIONS.BOOKS_UPDATE,
        ]);
    const updated = await updateLibraryBook(toOid(schoolId), toOid(bookId), toOid(userId), parsed.data);
    if (!updated) {
      return NextResponse.json(
        { success: false, error: { code: "not_found", message: "Book not found" } },
        { status: 404 }
      );
    }
    await auditLibraryBookUpdated(req, toOid(schoolId), toOid(userId), toOid(bookId), {
      ...parsed.data,
    } as Record<string, unknown>);
    return NextResponse.json({ success: true, data: serializeLibraryBook(updated) });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ success: false, error: { code: "error", message: msg } }, { status: 500 });
  }
}
