import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { StoreOrder } from "@/models/StoreOrder";
import { User } from "@/models/User";
import { Student } from "@/models/Student";

export async function GET() {
  try {
    const { schoolId } = await requireFinanceStaff();
    await connectToDatabase();

    const orders = await StoreOrder.find({ schoolId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const parentIds = [
      ...new Set(orders.map((o) => String(o.parentUserId))),
    ].map((id) => new mongoose.Types.ObjectId(id));
    const studentIds = [
      ...new Set(orders.map((o) => String(o.studentId))),
    ].map((id) => new mongoose.Types.ObjectId(id));

    const [users, students] = await Promise.all([
      User.find({ _id: { $in: parentIds } })
        .select("email firstName lastName")
        .lean(),
      Student.find({ _id: { $in: studentIds } })
        .select("firstName lastName")
        .lean(),
    ]);

    const parentName = new Map(
      users.map((u) => [
        String(u._id),
        [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || "Parent",
      ])
    );
    const studentName = new Map(
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
        parentLabel: parentName.get(String(o.parentUserId)) || "—",
        studentLabel: studentName.get(String(o.studentId)) || "—",
        lines: o.lines.map((l) => ({
          name: l.nameSnapshot,
          quantity: l.quantity,
          lineTotalMinor: l.lineTotalMinor,
        })),
        createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : null,
        paidAt: o.paidAt ? new Date(o.paidAt).toISOString() : null,
        paystackReference: o.paystackReference || null,
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
