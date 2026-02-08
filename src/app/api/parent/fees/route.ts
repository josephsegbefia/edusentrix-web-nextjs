// src/app/api/parent/fees/route.ts
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent } from "@/lib/auth/requireParent";
import { Student } from "@/models/Student";
import { Guardian } from "@/models/Guardian";
import { ClassGroup } from "@/models/ClassGroup";
import { Invoice } from "@/models/Invoice";
import { Payment } from "@/models/Payment";

type GuardianLink = {
  studentId: mongoose.Types.ObjectId;
};

type StudentRow = {
  _id: mongoose.Types.ObjectId;
  firstName?: string;
  lastName?: string;
  photoUrl?: string | null;
  classGroupId?: mongoose.Types.ObjectId;
  status?: string;
};

type ClassGroupRow = {
  _id: mongoose.Types.ObjectId;
  name?: string;
};

type InvoiceRow = {
  _id: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  title?: string;
  totalAmount?: number;
  amountPaid?: number;
  balanceDue?: number;
  dueDate?: Date | null;
  status?: string;
};

type RecentPaymentRow = {
  _id: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  amount?: number;
  paymentDate?: Date;
  paymentMethod?: string;
  reference?: string;
};

interface WardFeeSummary {
  wardId: string;
  wardName: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  classGroup: string;
  totalFees: number;
  amountPaid: number;
  balanceDue: number;
  paymentProgress: number;
  status: "clear" | "partial" | "owing";
  pendingInvoices: number;
  overdueInvoices: number;
}

interface PendingInvoice {
  id: string;
  wardId: string;
  wardName: string;
  title: string;
  amount: number;
  balanceDue: number;
  dueDate: string;
  status: "pending" | "partial" | "overdue";
  isOverdue: boolean;
}

export async function GET() {
  try {
    const context = await requireParent();
    await connectToDatabase();

    // Get all wards for this parent
    const guardians = await Guardian.find({ userId: context.userId })
      .select("studentId")
      .lean<GuardianLink[]>();

    if (!guardians.length) {
      return NextResponse.json({
        success: true,
        data: {
          wards: [],
          pendingInvoices: [],
          overallSummary: {
            totalFees: 0,
            totalPaid: 0,
            totalBalance: 0,
            paymentProgress: 0,
            pendingCount: 0,
            overdueCount: 0,
          },
          recentPayments: [],
        },
      });
    }

    const studentIds = guardians.map((g) => g.studentId);

    // Fetch students
    const students = await Student.find({
      _id: { $in: studentIds },
      schoolId: context.schoolId,
    })
      .select("_id firstName lastName photoUrl classGroupId status")
      .lean<StudentRow[]>();

    // Get class groups
    const classGroupIds = students
      .map((s) => s.classGroupId)
      .filter((classGroupId): classGroupId is mongoose.Types.ObjectId => Boolean(classGroupId));
    const classGroups = await ClassGroup.find({ _id: { $in: classGroupIds } })
      .select("_id name")
      .lean<ClassGroupRow[]>();
    const classGroupMap = new Map(
      classGroups.map((cg) => [String(cg._id), cg.name || ""])
    );

    // Fetch all invoices for wards
    const invoices = await Invoice.find({
      studentId: { $in: studentIds },
      schoolId: context.schoolId,
    })
      .select("studentId title totalAmount amountPaid balanceDue dueDate status")
      .sort({ dueDate: 1 })
      .lean<InvoiceRow[]>();

    // Group invoices by student
    const invoicesByStudent = new Map<string, InvoiceRow[]>();
    invoices.forEach((inv) => {
      const studentId = String(inv.studentId);
      if (!invoicesByStudent.has(studentId)) {
        invoicesByStudent.set(studentId, []);
      }
      invoicesByStudent.get(studentId)!.push(inv);
    });

    // Fetch recent payments
    const recentPayments = await Payment.find({
      studentId: { $in: studentIds },
      schoolId: context.schoolId,
      status: "completed",
    })
      .select("studentId amount paymentDate paymentMethod reference")
      .sort({ paymentDate: -1 })
      .limit(10)
      .lean<RecentPaymentRow[]>();

    // Build ward summaries
    const now = new Date();
    const wardSummaries: WardFeeSummary[] = [];
    const pendingInvoices: PendingInvoice[] = [];
    let overallTotalFees = 0;
    let overallTotalPaid = 0;
    let overallPendingCount = 0;
    let overallOverdueCount = 0;

    students.forEach((student) => {
      const studentId = String(student._id);
      const studentInvoices = invoicesByStudent.get(studentId) || [];
      const wardName = `${student.firstName || ""} ${student.lastName || ""}`.trim();

      let totalFees = 0;
      let amountPaid = 0;
      let pendingCount = 0;
      let overdueCount = 0;

      studentInvoices.forEach((inv) => {
        totalFees += inv.totalAmount || 0;
        amountPaid += inv.amountPaid || 0;

        const invoiceStatus = inv.status || "pending";
        if (invoiceStatus !== "paid" && invoiceStatus !== "cancelled") {
          const dueDate = inv.dueDate ? new Date(inv.dueDate) : null;
          const isOverdue = dueDate ? dueDate < now : false;
          pendingCount++;
          if (isOverdue) overdueCount++;

          pendingInvoices.push({
            id: String(inv._id),
            wardId: studentId,
            wardName,
            title: inv.title || "School Fees",
            amount: inv.totalAmount || 0,
            balanceDue: inv.balanceDue || 0,
            dueDate: inv.dueDate?.toISOString() || "",
            status: isOverdue ? "overdue" : invoiceStatus === "partial" ? "partial" : "pending",
            isOverdue,
          });
        }
      });

      const balanceDue = totalFees - amountPaid;
      const paymentProgress = totalFees > 0 ? (amountPaid / totalFees) * 100 : 100;
      const status: "clear" | "partial" | "owing" =
        balanceDue <= 0 ? "clear" : amountPaid > 0 ? "partial" : "owing";

      wardSummaries.push({
        wardId: studentId,
        wardName,
        firstName: student.firstName || "",
        lastName: student.lastName || "",
        photoUrl: student.photoUrl || null,
        classGroup: classGroupMap.get(String(student.classGroupId)) || "",
        totalFees,
        amountPaid,
        balanceDue,
        paymentProgress,
        status,
        pendingInvoices: pendingCount,
        overdueInvoices: overdueCount,
      });

      overallTotalFees += totalFees;
      overallTotalPaid += amountPaid;
      overallPendingCount += pendingCount;
      overallOverdueCount += overdueCount;
    });

    // Sort pending invoices by due date (overdue first)
    pendingInvoices.sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

    // Format recent payments
    const formattedPayments = recentPayments.map((p) => {
      const student = students.find((s) => String(s._id) === String(p.studentId));
      return {
        id: String(p._id),
        wardId: String(p.studentId),
        wardName: student
          ? `${student.firstName || ""} ${student.lastName || ""}`.trim()
          : "Unknown",
        amount: p.amount || 0,
        date: p.paymentDate?.toISOString() || "",
        method: p.paymentMethod || "cash",
        reference: p.reference || "",
      };
    });

    const overallBalance = overallTotalFees - overallTotalPaid;
    const overallProgress = overallTotalFees > 0 ? (overallTotalPaid / overallTotalFees) * 100 : 100;

    return NextResponse.json({
      success: true,
      data: {
        wards: wardSummaries,
        pendingInvoices: pendingInvoices.slice(0, 20),
        overallSummary: {
          totalFees: overallTotalFees,
          totalPaid: overallTotalPaid,
          totalBalance: overallBalance,
          paymentProgress: overallProgress,
          pendingCount: overallPendingCount,
          overdueCount: overallOverdueCount,
        },
        recentPayments: formattedPayments,
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Failed to fetch parent fees:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch fees",
      },
      { status: 500 }
    );
  }
}
