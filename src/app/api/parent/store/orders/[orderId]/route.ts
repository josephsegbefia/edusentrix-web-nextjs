import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent } from "@/lib/auth/requireParent";
import { StoreOrder } from "@/models/StoreOrder";
import { Student } from "@/models/Student";

type Params = Promise<{ orderId: string }>;

export async function GET(_req: Request, { params }: { params: Params }) {
  try {
    const ctx = await requireParent();
    const { orderId } = await params;
    await connectToDatabase();
    const order = await StoreOrder.findOne({
      _id: orderId,
      schoolId: ctx.schoolId,
      parentUserId: ctx.userId,
    }).lean();
    if (!order) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    }
    const student = await Student.findOne({ _id: order.studentId, schoolId: ctx.schoolId })
      .select("firstName lastName")
      .lean();
    return NextResponse.json({
      success: true,
      data: {
        id: String(order._id),
        orderNumber: String(order._id).slice(-8).toUpperCase(),
        status: order.status === "paid" ? "confirmed" : order.status === "pending_payment" ? "pending" : order.status,
        totalAmount: (order.totalMinor || 0) / 100,
        items: order.lines.map((line) => ({
          productId: String(line.productId),
          productName: line.nameSnapshot,
          quantity: line.quantity,
          unitPrice: (line.unitPriceMinor || 0) / 100,
          total: (line.lineTotalMinor || 0) / 100,
        })),
        createdAt: order.createdAt?.toISOString?.() || new Date().toISOString(),
        wardId: String(order.studentId),
        wardName: student ? `${student.firstName} ${student.lastName}` : null,
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Failed to load order";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
