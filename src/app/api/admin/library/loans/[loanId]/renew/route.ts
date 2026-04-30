import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { LIBRARY_PERMISSIONS } from "@/lib/library/library.permissions";
import { renewLibraryLoanSchema } from "@/lib/library/library.validators";
import {
  libraryLoanListFromDocs,
  renewLibraryLoan,
} from "@/lib/library/library-loan.service";
import { auditLibraryLoanRenewed } from "@/lib/library/library-audit";

function toOid(id: unknown) {
  return new mongoose.Types.ObjectId(String(id));
}

type RouteCtx = { params: Promise<{ loanId: string }> };

export async function POST(req: NextRequest, ctx: RouteCtx) {
  try {
    const { schoolId, userId } = await requireSchoolAdminOrDelegatedAnyPermission([
      LIBRARY_PERMISSIONS.LOANS_RENEW,
    ]);
    const { loanId } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(loanId)) {
      return NextResponse.json(
        { success: false, error: { code: "validation", message: "Invalid loan id" } },
        { status: 400 }
      );
    }
    await connectToDatabase();
    const body = (await req.json()) as unknown;
    const parsed = renewLibraryLoanSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "validation", message: parsed.error.message } },
        { status: 400 }
      );
    }
    const schoolOid = toOid(schoolId);
    const userOid = toOid(userId);
    const loanOid = new mongoose.Types.ObjectId(loanId);
    const updated = await renewLibraryLoan(schoolOid, userOid, loanOid, parsed.data);
    if (!updated) {
      return NextResponse.json(
        { success: false, error: { code: "not_found", message: "Loan not found" } },
        { status: 404 }
      );
    }
    await auditLibraryLoanRenewed(req, schoolOid, userOid, loanOid, {
      newDueAt: parsed.data.newDueAt.toISOString(),
      renewalCount: updated.renewalCount,
    });
    const [dto] = await libraryLoanListFromDocs(schoolOid, [updated]);
    return NextResponse.json({ success: true, data: dto });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Server error";
    const isBiz =
      msg.includes("disabled") ||
      msg.includes("Maximum") ||
      msg.includes("closed") ||
      msg.includes("after") ||
      msg.includes("Invalid");
    return NextResponse.json(
      { success: false, error: { code: isBiz ? "validation" : "error", message: msg } },
      { status: isBiz ? 400 : 500 }
    );
  }
}
