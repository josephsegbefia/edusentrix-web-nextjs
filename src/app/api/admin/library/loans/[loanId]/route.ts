import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { LIBRARY_PERMISSIONS } from "@/lib/library/library.permissions";
import {
  getLibraryLoanById,
  libraryLoanListFromDocs,
} from "@/lib/library/library-loan.service";

function toOid(id: unknown) {
  return new mongoose.Types.ObjectId(String(id));
}

type RouteCtx = { params: Promise<{ loanId: string }> };

export async function GET(_req: Request, ctx: RouteCtx) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedAnyPermission([
      LIBRARY_PERMISSIONS.LOANS_READ,
    ]);
    const { loanId } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(loanId)) {
      return NextResponse.json(
        { success: false, error: { code: "validation", message: "Invalid loan id" } },
        { status: 400 }
      );
    }
    await connectToDatabase();
    const schoolOid = toOid(schoolId);
    const loan = await getLibraryLoanById(schoolOid, new mongoose.Types.ObjectId(loanId));
    if (!loan) {
      return NextResponse.json(
        { success: false, error: { code: "not_found", message: "Loan not found" } },
        { status: 404 }
      );
    }
    const [dto] = await libraryLoanListFromDocs(schoolOid, [loan]);
    return NextResponse.json({ success: true, data: dto });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json(
      { success: false, error: { code: "error", message: msg } },
      { status: 500 }
    );
  }
}
