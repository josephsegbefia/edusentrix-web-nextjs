import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { LIBRARY_PERMISSIONS } from "@/lib/library/library.permissions";
import { returnLibraryLoanSchema } from "@/lib/library/library.validators";
import {
  libraryLoanListFromDocs,
  returnLibraryLoan,
} from "@/lib/library/library-loan.service";
import { auditLibraryLoanReturned } from "@/lib/library/library-audit";

function toOid(id: unknown) {
  return new mongoose.Types.ObjectId(String(id));
}

type RouteCtx = { params: Promise<{ loanId: string }> };

export async function POST(req: NextRequest, ctx: RouteCtx) {
  try {
    const { loanId } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(loanId)) {
      return NextResponse.json(
        { success: false, error: { code: "validation", message: "Invalid loan id" } },
        { status: 400 }
      );
    }
    await connectToDatabase();
    const body = (await req.json()) as unknown;
    const parsed = returnLibraryLoanSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "validation", message: parsed.error.message } },
        { status: 400 }
      );
    }
    const cond = parsed.data.returnCondition;
    const perms: string[] = [LIBRARY_PERMISSIONS.LOANS_RETURN];
    if (cond === "lost") perms.push(LIBRARY_PERMISSIONS.LOANS_MARK_LOST);
    if (cond === "damaged") perms.push(LIBRARY_PERMISSIONS.LOANS_MARK_DAMAGED);
    const { schoolId, userId } = await requireSchoolAdminOrDelegatedAnyPermission(perms);
    const schoolOid = toOid(schoolId);
    const userOid = toOid(userId);
    const loanOid = new mongoose.Types.ObjectId(loanId);
    const updated = await returnLibraryLoan(schoolOid, userOid, loanOid, parsed.data);
    if (!updated) {
      return NextResponse.json(
        { success: false, error: { code: "not_found", message: "Loan not found" } },
        { status: 404 }
      );
    }
    await auditLibraryLoanReturned(req, schoolOid, userOid, loanOid, {
      returnCondition: parsed.data.returnCondition,
      status: updated.status,
    });
    const [dto] = await libraryLoanListFromDocs(schoolOid, [updated]);
    return NextResponse.json({ success: true, data: dto });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Server error";
    const isBiz =
      msg.includes("already closed") ||
      msg.includes("Invalid") ||
      msg.includes("not found");
    return NextResponse.json(
      { success: false, error: { code: isBiz ? "validation" : "error", message: msg } },
      { status: isBiz ? 400 : 500 }
    );
  }
}
