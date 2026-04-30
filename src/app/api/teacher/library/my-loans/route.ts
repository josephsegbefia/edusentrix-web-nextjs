import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { listBorrowerLoanHistory } from "@/lib/library/library-loan.service";

export async function GET() {
  try {
    const ctx = await requireTeacher();
    await connectToDatabase();
    const { items, total } = await listBorrowerLoanHistory(
      ctx.schoolId,
      "teacher",
      ctx.teacherId,
      { page: 1, limit: 40 }
    );
    return NextResponse.json({
      success: true,
      data: { items, total },
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
