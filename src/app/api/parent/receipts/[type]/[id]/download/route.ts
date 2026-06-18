import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent, verifyGuardianAccess } from "@/lib/auth/requireParent";
import { learnReceiptNumber, renderLearnReceiptPdf } from "@/lib/learn/receipt-pdf";
import { LearnPaymentIntent } from "@/models/LearnPaymentIntent";
import { Payment } from "@/models/Payment";
import { School } from "@/models/School";
import { Student } from "@/models/Student";
import { User } from "@/models/User";

type Params = { params: Promise<{ type: string; id: string }> };

type ReceiptPaymentRow = {
  _id: Types.ObjectId;
  studentId: Types.ObjectId;
  amountMinor?: number;
  status: string;
  paystackReference?: string | null;
  externalReference?: string | null;
  receiptNumber?: string | null;
  paymentDate?: Date | null;
  createdAt?: Date;
};

function nameOf(row: { firstName?: string | null; middleName?: string | null; lastName?: string | null } | null) {
  return [row?.firstName, row?.middleName, row?.lastName].filter(Boolean).join(" ").trim() || "Student";
}

function contentDisposition(req: Request, filename: string) {
  const url = new URL(req.url);
  const disposition = url.searchParams.get("disposition") === "inline" ? "inline" : "attachment";
  return `${disposition}; filename="${filename}"`;
}

export async function GET(req: Request, { params }: Params) {
  try {
    const { type, id } = await params;
    if (!Types.ObjectId.isValid(id) || !["learn", "fee"].includes(type)) {
      return NextResponse.json({ success: false, error: "Invalid receipt." }, { status: 400 });
    }

    const parent = await requireParent();
    await connectToDatabase();

    const school = await School.findById(parent.schoolId).select("name").lean<{ name?: string | null } | null>();
    const payer = await User.findById(parent.userId)
      .select("firstName lastName email")
      .lean<{ firstName?: string | null; lastName?: string | null; email?: string | null } | null>();
    const payerName = [payer?.firstName, payer?.lastName].filter(Boolean).join(" ").trim() || payer?.email || null;

    if (type === "learn") {
      const payment = await LearnPaymentIntent.findOne({
        _id: new Types.ObjectId(id),
        schoolId: parent.schoolId,
        parentUserId: parent.userId,
        status: "succeeded",
      }).lean();
      if (!payment) {
        return NextResponse.json({ success: false, error: "Receipt not found." }, { status: 404 });
      }
      await verifyGuardianAccess(parent.userId, String(payment.studentId));
      const student = await Student.findOne({ _id: payment.studentId, schoolId: parent.schoolId })
        .select("firstName middleName lastName")
        .lean<{ firstName?: string | null; middleName?: string | null; lastName?: string | null } | null>();
      const pdf = await renderLearnReceiptPdf({
        receiptNumber: learnReceiptNumber(String(payment._id)),
        title: "Learn Payment Receipt",
        schoolName: school?.name || "School",
        studentName: nameOf(student),
        payerName,
        amountMinor: payment.amountMinor,
        currency: payment.currency,
        status: payment.status,
        reference: payment.paystackReference,
        issuedAt: payment.succeededAt || payment.updatedAt,
        description: "EduSentrix Learn access",
      });
      return new NextResponse(pdf, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": contentDisposition(req, `${learnReceiptNumber(String(payment._id))}.pdf`),
        },
      });
    }

    const payment = await Payment.findOne({
      _id: new Types.ObjectId(id),
      schoolId: parent.schoolId,
      status: "completed",
    }).lean<ReceiptPaymentRow | null>();
    if (!payment) {
      return NextResponse.json({ success: false, error: "Receipt not found." }, { status: 404 });
    }
    await verifyGuardianAccess(parent.userId, String(payment.studentId));
    const student = await Student.findOne({ _id: payment.studentId, schoolId: parent.schoolId })
      .select("firstName middleName lastName")
      .lean<{ firstName?: string | null; middleName?: string | null; lastName?: string | null } | null>();
    const receiptNumber = payment.receiptNumber || `FEE-${String(payment._id).slice(-8).toUpperCase()}`;
    const pdf = await renderLearnReceiptPdf({
      receiptNumber,
      title: "School Fee Payment Receipt",
      schoolName: school?.name || "School",
      studentName: nameOf(student),
      payerName,
      amountMinor: payment.amountMinor || 0,
      currency: "GHS",
      status: payment.status,
      reference: payment.paystackReference || payment.externalReference || payment.receiptNumber,
      issuedAt: payment.paymentDate || payment.createdAt,
      description: "School fee payment",
    });
    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": contentDisposition(req, `${receiptNumber}.pdf`),
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("[parent/receipts/download:GET]", error);
    return NextResponse.json({ success: false, error: "Failed to download receipt." }, { status: 500 });
  }
}
