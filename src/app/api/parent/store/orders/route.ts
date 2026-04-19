import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent } from "@/lib/auth/requireParent";
import { StoreOrder } from "@/models/StoreOrder";
import { Student } from "@/models/Student";

export async function GET() {
  try {
    const ctx = await requireParent();
    await connectToDatabase();

    const orders = await StoreOrder.find({
      schoolId: ctx.schoolId,
      parentUserId: ctx.userId,
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const studentIds = [...new Set(orders.map((o) => String(o.studentId)))];
    const students = await Student.find({ _id: { $in: studentIds } })
      .select("firstName lastName")
      .lean();
    const nameById = new Map(
      students.map((s) => [
        String(s._id),
        `${s.firstName} ${s.lastName}`,
      ])
    );

    return NextResponse.json({
      success: true,
      data: orders.map((o) => ({
        id: String(o._id),
        status: o.status,
        totalMinor: o.totalMinor,
        currency: o.currency || "GHS",
        lines: o.lines.map((l) => ({
          name: l.nameSnapshot,
          quantity: l.quantity,
          lineTotalMinor: l.lineTotalMinor,
        })),
        wardName: nameById.get(String(o.studentId)) || "Student",
        createdAt: o.createdAt?.toISOString() || null,
        paidAt: o.paidAt?.toISOString() || null,
      })),
    });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json(
      { success: false, error: "Failed to load orders" },
      { status: 500 }
    );
  }
}
