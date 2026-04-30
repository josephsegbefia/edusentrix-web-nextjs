import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { LIBRARY_PERMISSIONS } from "@/lib/library/library.permissions";
import { borrowerHistoryQuerySchema } from "@/lib/library/library.validators";
import { listBorrowerLoanHistory } from "@/lib/library/library-loan.service";

function toOid(id: unknown) {
  return new mongoose.Types.ObjectId(String(id));
}

type RouteCtx = { params: Promise<{ borrowerType: string; borrowerId: string }> };

export async function GET(req: NextRequest, ctx: RouteCtx) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedAnyPermission([
      LIBRARY_PERMISSIONS.LOANS_READ,
    ]);
    const { borrowerType, borrowerId } = await ctx.params;
    const t =
      borrowerType === "student" || borrowerType === "teacher" || borrowerType === "staff"
        ? borrowerType
        : null;
    if (!t || !mongoose.Types.ObjectId.isValid(borrowerId)) {
      return NextResponse.json(
        { success: false, error: { code: "validation", message: "Invalid borrower" } },
        { status: 400 }
      );
    }
    await connectToDatabase();
    const raw = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = borrowerHistoryQuerySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "validation", message: parsed.error.message } },
        { status: 400 }
      );
    }
    const schoolOid = toOid(schoolId);
    const { items, total } = await listBorrowerLoanHistory(schoolOid, t, new mongoose.Types.ObjectId(borrowerId), {
      page: parsed.data.page,
      limit: parsed.data.limit,
    });
    const limit = parsed.data.limit;
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
    return NextResponse.json({
      success: true,
      data: {
        items,
        pagination: {
          page: parsed.data.page,
          limit,
          total,
          totalPages,
          hasNextPage: parsed.data.page < totalPages,
          hasPreviousPage: parsed.data.page > 1,
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
