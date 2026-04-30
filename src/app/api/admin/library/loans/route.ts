import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  requireSchoolAdminOrDelegatedAnyPermission,
} from "@/lib/delegations/requireDelegatedModulePermission";
import { LIBRARY_PERMISSIONS } from "@/lib/library/library.permissions";
import {
  issueLibraryLoanSchema,
  listLibraryLoansQuerySchema,
} from "@/lib/library/library.validators";
import { issueLibraryLoan, libraryLoanListFromDocs, listLibraryLoans } from "@/lib/library/library-loan.service";
import { auditLibraryLoanIssued } from "@/lib/library/library-audit";

function toOid(id: unknown) {
  return new mongoose.Types.ObjectId(String(id));
}

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const raw = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = listLibraryLoansQuerySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "validation", message: parsed.error.message } },
        { status: 400 }
      );
    }
    const readPerms =
      parsed.data.bucket === "fines_pending"
        ? [LIBRARY_PERMISSIONS.LOANS_READ, LIBRARY_PERMISSIONS.FINES_READ]
        : [LIBRARY_PERMISSIONS.LOANS_READ];
    const { schoolId } = await requireSchoolAdminOrDelegatedAnyPermission(readPerms);
    const schoolOid = toOid(schoolId);
    const { items, total } = await listLibraryLoans(schoolOid, parsed.data);
    const page = parsed.data.page;
    const limit = parsed.data.limit;
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
    return NextResponse.json({
      success: true,
      data: {
        items,
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
      LIBRARY_PERMISSIONS.LOANS_ISSUE,
    ]);
    await connectToDatabase();
    const body = (await req.json()) as unknown;
    const parsed = issueLibraryLoanSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "validation", message: parsed.error.message } },
        { status: 400 }
      );
    }
    const schoolOid = toOid(schoolId);
    const userOid = toOid(userId);
    const loan = await issueLibraryLoan(schoolOid, userOid, parsed.data);
    const loanOid = loan._id as mongoose.Types.ObjectId;
    await auditLibraryLoanIssued(req, schoolOid, userOid, loanOid, {
      bookId: String(loan.bookId),
      bookCopyId: String(loan.bookCopyId),
      borrowerType: loan.borrowerType,
      borrowerId: String(loan.borrowerId),
      dueAt: loan.dueAt.toISOString(),
    });
    const [dto] = await libraryLoanListFromDocs(schoolOid, [loan]);
    return NextResponse.json({ success: true, data: dto }, { status: 201 });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Server error";
    const isBiz =
      msg.includes("not found") ||
      msg.includes("not available") ||
      msg.includes("maximum") ||
      msg.includes("Invalid") ||
      msg.includes("must be");
    return NextResponse.json(
      { success: false, error: { code: isBiz ? "validation" : "error", message: msg } },
      { status: isBiz ? 400 : 500 }
    );
  }
}
