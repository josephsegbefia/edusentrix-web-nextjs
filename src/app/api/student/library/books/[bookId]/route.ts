import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolMember } from "@/lib/auth/requireSchoolMember";
import { getLibraryBookById } from "@/lib/library/library-book.service";
import { serializeLibraryBookPatron } from "@/lib/library/library.serialize";

type RouteCtx = { params: Promise<{ bookId: string }> };

export async function GET(_req: NextRequest, ctx: RouteCtx) {
  try {
    const member = await requireSchoolMember({ allowedRoles: ["student"] });
    const { bookId } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(bookId)) {
      return NextResponse.json(
        { success: false, error: { code: "validation", message: "Invalid book id" } },
        { status: 400 }
      );
    }
    await connectToDatabase();
    const schoolId = member.schoolId;
    const doc = await getLibraryBookById(schoolId, new mongoose.Types.ObjectId(bookId));
    if (!doc || doc.status !== "active") {
      return NextResponse.json(
        { success: false, error: { code: "not_found", message: "Book not found" } },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: serializeLibraryBookPatron(doc) });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json(
      { success: false, error: { code: "error", message: msg } },
      { status: 500 }
    );
  }
}
