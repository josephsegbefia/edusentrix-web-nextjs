import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  requireSchoolAdminOrDelegatedAnyPermission,
  requireSchoolAdminOrDelegatedModuleView,
} from "@/lib/delegations/requireDelegatedModulePermission";
import { LIBRARY_PERMISSIONS } from "@/lib/library/library.permissions";
import { createLibraryBookCopyBodySchema } from "@/lib/library/library.validators";
import { getLibraryBookById } from "@/lib/library/library-book.service";
import { createLibraryCopy, listCopiesForBook } from "@/lib/library/library-copy.service";
import { serializeLibraryCopy } from "@/lib/library/library.serialize";
import { auditLibraryCopyCreated } from "@/lib/library/library-audit";

function toOid(id: unknown) {
  return new mongoose.Types.ObjectId(String(id));
}

export async function GET(
  req: NextRequest,
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
    const schoolOid = toOid(schoolId);
    const bookOid = toOid(bookId);
    const book = await getLibraryBookById(schoolOid, bookOid);
    if (!book) {
      return NextResponse.json(
        { success: false, error: { code: "not_found", message: "Book not found" } },
        { status: 404 }
      );
    }
    const includeArchived = req.nextUrl.searchParams.get("includeArchived") === "1";
    const copies = await listCopiesForBook(schoolOid, bookOid, { includeArchived });
    return NextResponse.json({
      success: true,
      data: { items: copies.map(serializeLibraryCopy) },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ success: false, error: { code: "error", message: msg } }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ bookId: string }> }
) {
  try {
    const { schoolId, userId } = await requireSchoolAdminOrDelegatedAnyPermission([
      LIBRARY_PERMISSIONS.COPIES_CREATE,
    ]);
    const { bookId } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(bookId)) {
      return NextResponse.json(
        { success: false, error: { code: "invalid_id", message: "Invalid book id" } },
        { status: 400 }
      );
    }
    await connectToDatabase();
    const body = (await req.json()) as unknown;
    const parsed = createLibraryBookCopyBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "validation", message: parsed.error.message } },
        { status: 400 }
      );
    }
    const copy = await createLibraryCopy(toOid(schoolId), toOid(bookId), toOid(userId), parsed.data);
    await auditLibraryCopyCreated(req, toOid(schoolId), toOid(userId), toOid(copy._id), toOid(bookId), {
      copyCode: copy.copyCode,
      status: copy.status,
    });
    return NextResponse.json({ success: true, data: serializeLibraryCopy(copy) }, { status: 201 });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Server error";
    const status = msg.includes("not found") ? 404 : msg.includes("already exists") ? 409 : 500;
    return NextResponse.json({ success: false, error: { code: "error", message: msg } }, { status });
  }
}
