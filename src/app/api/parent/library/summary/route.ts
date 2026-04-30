import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { getParentWardIds, requireParent } from "@/lib/auth/requireParent";
import { Student } from "@/models/Student";
import { LibraryLoan } from "@/models/LibraryLoan";
import { markOpenLoansOverdueForSchool } from "@/lib/library/library-jobs";
import { libraryLoanListFromDocs } from "@/lib/library/library-loan.service";

export async function GET() {
  try {
    const ctx = await requireParent();
    await connectToDatabase();
    const wardIds = await getParentWardIds(ctx.userId);
    if (wardIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: { wards: [], loans: [] as unknown[] },
      });
    }
    const wards = await Student.find({
      _id: { $in: wardIds },
      schoolId: ctx.schoolId,
      status: "active",
    })
      .select("firstName lastName")
      .lean();
    await markOpenLoansOverdueForSchool(ctx.schoolId);
    const openLoans = await LibraryLoan.find({
      schoolId: ctx.schoolId,
      borrowerType: "student",
      borrowerId: { $in: wardIds },
      isOpen: true,
    })
      .sort({ dueAt: 1 })
      .lean();
    const loanDtos = await libraryLoanListFromDocs(ctx.schoolId, openLoans);
    return NextResponse.json({
      success: true,
      data: {
        wards: wards.map((s) => ({
          id: String((s as { _id: mongoose.Types.ObjectId })._id),
          firstName: (s as { firstName: string }).firstName,
          lastName: (s as { lastName: string }).lastName,
        })),
        loans: loanDtos,
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
