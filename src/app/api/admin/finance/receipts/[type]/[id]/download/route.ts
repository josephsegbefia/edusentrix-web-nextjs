import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { ensureReceiptVerification } from "@/lib/finance/receipt-verification";
import { learnReceiptNumber, renderLearnReceiptPdf } from "@/lib/learn/receipt-pdf";
import { getAppUrl } from "@/lib/utils/getAppUrl";
import { Invoice } from "@/models/Invoice";
import { LearnPaymentIntent } from "@/models/LearnPaymentIntent";
import { Payment } from "@/models/Payment";
import { School } from "@/models/School";
import { Student } from "@/models/Student";
import { User } from "@/models/User";

type Params = { params: Promise<{ type: string; id: string }> };

type ReceiptPaymentRow = {
  _id: Types.ObjectId;
  studentId: Types.ObjectId;
  invoiceId?: Types.ObjectId | null;
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

function absoluteAssetUrl(value?: string | null) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/")) return `${getAppUrl().replace(/\/$/, "")}${value}`;
  return value;
}

export async function GET(req: Request, { params }: Params) {
  try {
    const { type, id } = await params;
    if (!Types.ObjectId.isValid(id) || !["learn", "fee"].includes(type)) {
      return NextResponse.json({ success: false, error: "Invalid receipt." }, { status: 400 });
    }

    const admin = await requireSchoolAdmin();
    await connectToDatabase();

    const school = await School.findById(admin.schoolId)
      .select("name logo")
      .lean<{ name?: string | null; logo?: string | null } | null>();
    const schoolName = school?.name || "School";

    if (type === "learn") {
      const payment = await LearnPaymentIntent.findOne({
        _id: new Types.ObjectId(id),
        schoolId: admin.schoolId,
        status: "succeeded",
      }).lean();
      if (!payment) {
        return NextResponse.json({ success: false, error: "Receipt not found." }, { status: 404 });
      }
      const [student, payer] = await Promise.all([
        Student.findOne({ _id: payment.studentId, schoolId: admin.schoolId })
          .select("firstName middleName lastName")
          .lean<{ firstName?: string | null; middleName?: string | null; lastName?: string | null } | null>(),
        User.findById(payment.parentUserId)
          .select("firstName lastName email")
          .lean<{ firstName?: string | null; lastName?: string | null; email?: string | null } | null>(),
      ]);
      const payerName = [payer?.firstName, payer?.lastName].filter(Boolean).join(" ").trim() || payer?.email || null;
      const receiptNumber = learnReceiptNumber(String(payment._id));
      const issuedAt = payment.succeededAt || payment.updatedAt || new Date();
      const verification = await ensureReceiptVerification({
        schoolId: admin.schoolId,
        schoolName,
        issuedBy: admin.userId,
        receiptNumber,
        receiptTitle: "EduSentrix Learn Payment Receipt",
        issuedAt,
        amountPaidMinor: payment.amountMinor,
        balanceMinor: 0,
        studentName: nameOf(student),
        payerName,
        paymentReference: payment.paystackReference || null,
        sourceEntityType: "LearnPaymentIntent",
        sourceEntityId: String(payment._id),
      });
      const verificationPath = `/verify/receipt/${encodeURIComponent(verification.verificationId)}`;
      const pdf = await renderLearnReceiptPdf({
        receiptNumber,
        title: "Learn Payment Receipt",
        schoolName,
        schoolLogoUrl: absoluteAssetUrl(school?.logo),
        studentName: nameOf(student),
        payerName,
        amountMinor: payment.amountMinor,
        balanceMinor: 0,
        currency: payment.currency,
        status: payment.status,
        reference: payment.paystackReference,
        issuedAt,
        description: "EduSentrix Learn access",
        verificationId: verification.verificationId,
        verificationUrl: `${getAppUrl().replace(/\/$/, "")}${verificationPath}`,
      });
      return new NextResponse(pdf, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": contentDisposition(req, `${receiptNumber}.pdf`),
        },
      });
    }

    const payment = await Payment.findOne({
      _id: new Types.ObjectId(id),
      schoolId: admin.schoolId,
      status: "completed",
    }).lean<ReceiptPaymentRow | null>();
    if (!payment) {
      return NextResponse.json({ success: false, error: "Receipt not found." }, { status: 404 });
    }
    const student = await Student.findOne({ _id: payment.studentId, schoolId: admin.schoolId })
      .select("firstName middleName lastName")
      .lean<{ firstName?: string | null; middleName?: string | null; lastName?: string | null } | null>();
    const receiptNumber = payment.receiptNumber || `FEE-${String(payment._id).slice(-8).toUpperCase()}`;
    const invoice = payment.invoiceId
      ? await Invoice.findOne({ _id: payment.invoiceId, schoolId: admin.schoolId })
          .select("totalOutstandingMinor")
          .lean<{ totalOutstandingMinor?: number | null } | null>()
      : null;
    const issuedAt = payment.paymentDate || payment.createdAt || new Date();
    const verification = await ensureReceiptVerification({
      schoolId: admin.schoolId,
      schoolName,
      issuedBy: admin.userId,
      receiptNumber,
      receiptTitle: "School Fee Payment Receipt",
      issuedAt,
      amountPaidMinor: payment.amountMinor || 0,
      balanceMinor: Math.max(0, Number(invoice?.totalOutstandingMinor || 0)),
      studentName: nameOf(student),
      payerName: null,
      paymentReference: payment.paystackReference || payment.externalReference || payment.receiptNumber || null,
      sourceEntityType: "Payment",
      sourceEntityId: String(payment._id),
    });
    const verificationPath = `/verify/receipt/${encodeURIComponent(verification.verificationId)}`;
    const pdf = await renderLearnReceiptPdf({
      receiptNumber,
      title: "School Fee Payment Receipt",
      schoolName,
      schoolLogoUrl: absoluteAssetUrl(school?.logo),
      studentName: nameOf(student),
      amountMinor: payment.amountMinor || 0,
      balanceMinor: Math.max(0, Number(invoice?.totalOutstandingMinor || 0)),
      currency: "GHS",
      status: payment.status,
      reference: payment.paystackReference || payment.externalReference || payment.receiptNumber,
      issuedAt,
      description: "School fee payment",
      verificationId: verification.verificationId,
      verificationUrl: `${getAppUrl().replace(/\/$/, "")}${verificationPath}`,
    });
    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": contentDisposition(req, `${receiptNumber}.pdf`),
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("[admin/finance/receipts/download:GET]", error);
    return NextResponse.json({ success: false, error: "Failed to download receipt." }, { status: 500 });
  }
}
