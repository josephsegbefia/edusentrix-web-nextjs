import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  requireSchoolAdminOrDelegatedAnyPermission,
  requireSchoolAdminOrDelegatedModuleView,
} from "@/lib/delegations/requireDelegatedModulePermission";
import { LIBRARY_PERMISSIONS } from "@/lib/library/library.permissions";
import { createLibraryBookSchema, listLibraryBooksQuerySchema } from "@/lib/library/library.validators";
import { createLibraryBook, listLibraryBooks } from "@/lib/library/library-book.service";
import { serializeLibraryBook } from "@/lib/library/library.serialize";
import { auditLibraryBookCreated } from "@/lib/library/library-audit";

function toOid(id: unknown) {
  return new mongoose.Types.ObjectId(String(id));
}

export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedModuleView("library");
    await connectToDatabase();
    const raw = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = listLibraryBooksQuerySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "validation", message: parsed.error.message } },
        { status: 400 }
      );
    }
    const schoolOid = toOid(schoolId);
    const { items, total } = await listLibraryBooks(schoolOid, parsed.data);
    const page = parsed.data.page;
    const limit = parsed.data.limit;
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
    return NextResponse.json({
      success: true,
      data: {
        items: items.map(serializeLibraryBook),
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
    return NextResponse.json({ success: false, error: { code: "error", message: msg } }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { schoolId, userId } = await requireSchoolAdminOrDelegatedAnyPermission([
      LIBRARY_PERMISSIONS.BOOKS_CREATE,
    ]);
    await connectToDatabase();
    const body = (await req.json()) as unknown;
    const parsed = createLibraryBookSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "validation", message: parsed.error.message } },
        { status: 400 }
      );
    }
    const schoolOid = toOid(schoolId);
    const userOid = toOid(userId);
    const book = await createLibraryBook(schoolOid, userOid, parsed.data);
    await auditLibraryBookCreated(req, schoolOid, userOid, toOid(book._id), {
      title: book.title,
      initialCopies: parsed.data.initialCopies ?? 0,
    });
    return NextResponse.json({ success: true, data: serializeLibraryBook(book) }, { status: 201 });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ success: false, error: { code: "error", message: msg } }, { status: 500 });
  }
}
