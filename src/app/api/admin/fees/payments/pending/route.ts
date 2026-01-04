/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Payment } from "@/models/Payment";
import { Invoice } from "@/models/Invoice";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";

export async function GET(req: NextRequest) {
  const { schoolId } = await requireFinanceStaff();
  await connectToDatabase();

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");
  const invoiceId = searchParams.get("invoiceId");
  const academicPeriodId = searchParams.get("academicPeriodId");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);

  const query: any = {
    schoolId,
    status: "pending",
    approvalStatus: "pending",
  };

  if (studentId) query.studentId = new mongoose.Types.ObjectId(studentId);
  if (invoiceId) query.invoiceId = new mongoose.Types.ObjectId(invoiceId);

  // optional: filter by academic period via invoice join
  if (academicPeriodId) {
    const invs = await Invoice.find({
      schoolId,
      academicPeriodId: new mongoose.Types.ObjectId(academicPeriodId),
      ...(studentId
        ? { studentId: new mongoose.Types.ObjectId(studentId) }
        : {}),
    })
      .select("_id")
      .lean();

    query.invoiceId = { $in: invs.map((i: any) => i._id) };
  }

  const skip = (page - 1) * limit;

  const [payments, total] = await Promise.all([
    Payment.find(query)
      .sort({ paymentDate: -1 })
      .skip(skip)
      .limit(limit)
      .populate("studentId", "firstName lastName admissionNo")
      .populate("invoiceId", "invoiceNumber")
      .lean(),
    Payment.countDocuments(query),
  ]);

  return NextResponse.json({
    payments,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
}
