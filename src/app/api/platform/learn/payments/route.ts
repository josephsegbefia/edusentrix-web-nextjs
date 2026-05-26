import { NextResponse } from "next/server";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { LearnPaymentIntent } from "@/models/LearnPaymentIntent";
import { School } from "@/models/School";
import { Student } from "@/models/Student";

export async function GET() {
  try {
    const gate = await requirePlatformPermission("platform.learn.payments.read");
    if (!gate.ok) return gate.res;
    await connectToDatabase();

    const payments = await LearnPaymentIntent.find({})
      .sort({ createdAt: -1 })
      .limit(100)
      .select("_id schoolId studentId amountMinor currency status paystackReference createdAt succeededAt")
      .lean();
    const schoolIds = Array.from(new Set(payments.map((payment) => String(payment.schoolId))));
    const studentIds = Array.from(new Set(payments.map((payment) => String(payment.studentId))));
    const [schools, students] = await Promise.all([
      School.find({ _id: { $in: schoolIds } }).select("_id name").lean(),
      Student.find({ _id: { $in: studentIds } }).select("_id firstName middleName lastName").lean(),
    ]);
    const schoolMap = new Map(schools.map((school) => [String(school._id), school.name]));
    const studentMap = new Map(
      students.map((student) => [
        String(student._id),
        [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" "),
      ])
    );

    return NextResponse.json({
      success: true,
      data: {
        payments: payments.map((payment) => ({
          id: String(payment._id),
          schoolId: String(payment.schoolId),
          schoolName: schoolMap.get(String(payment.schoolId)) || "School",
          studentId: String(payment.studentId),
          studentName: studentMap.get(String(payment.studentId)) || "Student",
          amountMinor: payment.amountMinor,
          currency: payment.currency,
          status: payment.status,
          paystackReference: payment.paystackReference || null,
          createdAt: payment.createdAt?.toISOString?.() || null,
          succeededAt: payment.succeededAt?.toISOString?.() || null,
        })),
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("[platform/learn/payments:GET]", error);
    return NextResponse.json(
      { success: false, error: "Failed to load Learn payments." },
      { status: 500 }
    );
  }
}
