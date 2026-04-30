import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { LIBRARY_PERMISSIONS } from "@/lib/library/library.permissions";
import { libraryBorrowersSearchQuerySchema } from "@/lib/library/library.validators";
import { searchLibraryBorrowers } from "@/lib/library/library-borrower.service";

function toOid(id: unknown) {
  return new mongoose.Types.ObjectId(String(id));
}

export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedAnyPermission([
      LIBRARY_PERMISSIONS.LOANS_READ,
      LIBRARY_PERMISSIONS.LOANS_ISSUE,
      LIBRARY_PERMISSIONS.RESERVATIONS_MANAGE,
    ]);
    await connectToDatabase();
    const raw = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = libraryBorrowersSearchQuerySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "validation", message: parsed.error.message } },
        { status: 400 }
      );
    }
    const items = await searchLibraryBorrowers(toOid(schoolId), {
      q: parsed.data.q,
      types: [...parsed.data.types],
      limit: parsed.data.limit,
    });
    return NextResponse.json({ success: true, data: { items } });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json(
      { success: false, error: { code: "error", message: msg } },
      { status: 500 }
    );
  }
}
