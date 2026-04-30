import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdminOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";
import { getLibraryBookById } from "@/lib/library/library-book.service";
import { lookupLibraryCopyByCode } from "@/lib/library/library-copy.service";
import { serializeLibraryBook, serializeLibraryCopy } from "@/lib/library/library.serialize";

function toOid(id: unknown) {
  return new mongoose.Types.ObjectId(String(id));
}

export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedModuleView("library");
    const code = new URL(req.url).searchParams.get("code")?.trim() ?? "";
    if (!code) {
      return NextResponse.json(
        { success: false, error: { code: "validation", message: "Missing code query" } },
        { status: 400 }
      );
    }
    await connectToDatabase();
    const copy = await lookupLibraryCopyByCode(toOid(schoolId), code);
    if (!copy) {
      return NextResponse.json(
        { success: false, error: { code: "not_found", message: "No copy matches that code" } },
        { status: 404 }
      );
    }
    const book = await getLibraryBookById(toOid(schoolId), copy.bookId);
    if (!book) {
      return NextResponse.json(
        { success: false, error: { code: "not_found", message: "Book for this copy was not found" } },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      data: {
        copy: serializeLibraryCopy(copy),
        book: serializeLibraryBook(book),
      },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ success: false, error: { code: "error", message: msg } }, { status: 500 });
  }
}
