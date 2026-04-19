import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { ClassGroup } from "@/models/ClassGroup";
import { Invoice } from "@/models/Invoice";
import { Payment } from "@/models/Payment";
import { Student } from "@/models/Student";

function toObjectIdOrNull(value: string | null | undefined) {
  if (!value) return null;
  try {
    return new mongoose.Types.ObjectId(String(value));
  } catch {
    return null;
  }
}

function round(value: number, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function percent(part: number, whole: number, decimals = 1) {
  if (!whole) return 0;
  return round((part / whole) * 100, decimals);
}

const ACTIVE_INVOICE_STATUSES = new Set([
  "issued",
  "partially_paid",
  "paid",
  "overdue",
]);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { id } = await params;
    const classId = toObjectIdOrNull(id);
    if (!classId) {
      return NextResponse.json(
        { success: false, error: "Invalid class ID" },
        { status: 400 }
      );
    }

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    const classDoc = await ClassGroup.findOne({
      _id: classId,
      schoolId: schoolIdObj,
    })
      .populate("gradeId", "name")
      .lean();

    if (!classDoc) {
      return NextResponse.json(
        { success: false, error: "Class not found" },
        { status: 404 }
      );
    }

    const periods = await AcademicPeriod.find({ schoolId: schoolIdObj })
      .sort({ startDate: 1, endDate: 1, createdAt: 1 })
      .lean();

    const { searchParams } = new URL(req.url);
    const requestedPeriod = searchParams.get("academicPeriodId");
    const useAllPeriods = requestedPeriod === "all";
    const requestedPeriodId = useAllPeriods
      ? null
      : toObjectIdOrNull(requestedPeriod);

    const selectedPeriod =
      useAllPeriods
        ? null
        : periods.find((period) => String(period._id) === String(requestedPeriodId)) ??
          periods.find((period) => period.isCurrent) ??
          periods[periods.length - 1] ??
          null;
    const selectedPeriodId = selectedPeriod?._id
      ? new mongoose.Types.ObjectId(String(selectedPeriod._id))
      : null;

    const students = await Student.find({
      schoolId: schoolIdObj,
      classGroupId: classId,
      status: "active",
    })
      .select("firstName lastName admissionNo photoUrl")
      .sort({ lastName: 1, firstName: 1 })
      .lean();

    const gradeName = (classDoc as any).gradeId?.name ?? "Class";
    const classLabel = `${gradeName} ${(classDoc as any).name}`.trim();

    if (students.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          classGroup: {
            id: String((classDoc as any)._id),
            name: (classDoc as any).name,
            fullLabel: classLabel,
          },
          filters: {
            academicPeriodId: useAllPeriods
              ? "all"
              : selectedPeriodId
              ? String(selectedPeriodId)
              : null,
            academicPeriodLabel: useAllPeriods
              ? "All periods"
              : selectedPeriod
              ? `${selectedPeriod.yearLabel} • ${selectedPeriod.term}`
              : null,
          },
          summary: {
            studentCount: 0,
            invoiceCount: 0,
            totalBilledMinor: 0,
            totalPaidMinor: 0,
            totalOutstandingMinor: 0,
            collectionRate: 0,
            defaultersCount: 0,
            overdueInvoiceCount: 0,
            recentCollectionsMinor: 0,
          },
          byStatus: {
            clear: 0,
            partial: 0,
            overdue: 0,
            unbilled: 0,
          },
          students: [],
          spotlight: {
            topDefaulters: [],
            onTrack: [],
            recentPayments: [],
          },
          leo: {
            riskLevel: "low",
            headline: "Fee insights will appear once students and invoices exist.",
            summary:
              "There are no active students in this class yet, so fee analytics are empty.",
            insights: [
              "Once students are billed, this view will highlight collection and risk patterns for the class.",
            ],
            predictions: [],
          },
        },
      });
    }

    const studentIds = students.map((student) => student._id);
    const studentMap = new Map(
      students.map((student) => [
        String(student._id),
        {
          fullName: `${student.firstName} ${student.lastName}`.trim(),
          admissionNo: student.admissionNo ?? null,
          photoUrl: student.photoUrl ?? null,
        },
      ])
    );

    const invoiceQuery: Record<string, unknown> = {
      schoolId: schoolIdObj,
      studentId: { $in: studentIds },
      status: { $in: Array.from(ACTIVE_INVOICE_STATUSES) },
    };
    if (!useAllPeriods && selectedPeriodId) {
      invoiceQuery.academicPeriodId = selectedPeriodId;
    }

    const invoices = await Invoice.find(invoiceQuery)
      .select(
        "studentId invoiceNumber status totalAmountMinor totalPaidMinor totalOutstandingMinor dueDate issueDate"
      )
      .sort({ dueDate: 1, createdAt: -1 })
      .lean();

    const invoiceIds = invoices.map((invoice) => invoice._id);
    const recentPayments = invoiceIds.length
      ? await Payment.find({
          schoolId: schoolIdObj,
          studentId: { $in: studentIds },
          invoiceId: { $in: invoiceIds },
          status: "completed",
        })
          .select("studentId amountMinor paymentDate paymentMethod")
          .sort({ paymentDate: -1, createdAt: -1 })
          .limit(8)
          .lean()
      : [];

    const allScopedPayments = invoiceIds.length
      ? await Payment.find({
          schoolId: schoolIdObj,
          studentId: { $in: studentIds },
          invoiceId: { $in: invoiceIds },
          status: "completed",
        })
          .select("studentId amountMinor paymentDate")
          .lean()
      : [];

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let totalBilledMinor = 0;
    let totalPaidMinor = 0;
    let totalOutstandingMinor = 0;
    let overdueInvoiceCount = 0;

    const studentRows = students.map((student) => ({
      studentId: String(student._id),
      fullName: `${student.firstName} ${student.lastName}`.trim(),
      admissionNo: student.admissionNo ?? null,
      photoUrl: student.photoUrl ?? null,
      invoiceCount: 0,
      totalBilledMinor: 0,
      totalPaidMinor: 0,
      totalOutstandingMinor: 0,
      overdueInvoiceCount: 0,
      lastPaymentDate: null as string | null,
      nextDueDate: null as string | null,
      status: "unbilled" as "clear" | "partial" | "overdue" | "unbilled",
    }));
    const studentRowMap = new Map(studentRows.map((row) => [row.studentId, row]));

    for (const invoice of invoices) {
      const row = studentRowMap.get(String(invoice.studentId));
      if (!row) continue;
      row.invoiceCount += 1;
      row.totalBilledMinor += Number(invoice.totalAmountMinor || 0);
      row.totalPaidMinor += Number(invoice.totalPaidMinor || 0);
      row.totalOutstandingMinor += Number(invoice.totalOutstandingMinor || 0);
      if (invoice.status === "overdue") {
        row.overdueInvoiceCount += 1;
        overdueInvoiceCount += 1;
      }
      if (
        Number(invoice.totalOutstandingMinor || 0) > 0 &&
        invoice.dueDate &&
        (!row.nextDueDate || new Date(invoice.dueDate).getTime() < new Date(row.nextDueDate).getTime())
      ) {
        row.nextDueDate = new Date(invoice.dueDate).toISOString();
      }
      totalBilledMinor += Number(invoice.totalAmountMinor || 0);
      totalPaidMinor += Number(invoice.totalPaidMinor || 0);
      totalOutstandingMinor += Number(invoice.totalOutstandingMinor || 0);
    }

    for (const payment of allScopedPayments) {
      const row = studentRowMap.get(String(payment.studentId));
      if (!row) continue;
      const nextPaymentDate = new Date(payment.paymentDate).toISOString();
      if (!row.lastPaymentDate || new Date(nextPaymentDate).getTime() > new Date(row.lastPaymentDate).getTime()) {
        row.lastPaymentDate = nextPaymentDate;
      }
    }

    for (const row of studentRows) {
      if (row.invoiceCount === 0) row.status = "unbilled";
      else if (row.totalOutstandingMinor <= 0) row.status = "clear";
      else if (row.overdueInvoiceCount > 0) row.status = "overdue";
      else row.status = "partial";
    }

    const defaultersCount = studentRows.filter(
      (row) => row.totalOutstandingMinor > 0
    ).length;
    const collectionRate = percent(totalPaidMinor, totalBilledMinor);
    const recentCollectionsMinor = allScopedPayments
      .filter((payment) => new Date(payment.paymentDate).getTime() >= thirtyDaysAgo.getTime())
      .reduce((sum, payment) => sum + Number(payment.amountMinor || 0), 0);

    const byStatus = studentRows.reduce(
      (acc, row) => {
        if (row.status === "clear") acc.clear += 1;
        if (row.status === "partial") acc.partial += 1;
        if (row.status === "overdue") acc.overdue += 1;
        if (row.status === "unbilled") acc.unbilled += 1;
        return acc;
      },
      { clear: 0, partial: 0, overdue: 0, unbilled: 0 }
    );

    const topDefaulters = [...studentRows]
      .filter((row) => row.totalOutstandingMinor > 0)
      .sort(
        (a, b) =>
          b.totalOutstandingMinor - a.totalOutstandingMinor ||
          a.fullName.localeCompare(b.fullName)
      )
      .slice(0, 6);
    const onTrack = [...studentRows]
      .filter((row) => row.status === "clear")
      .sort(
        (a, b) => b.totalPaidMinor - a.totalPaidMinor || a.fullName.localeCompare(b.fullName)
      )
      .slice(0, 6);

    const spotlightRecentPayments = recentPayments.map((payment) => {
      const studentMeta = studentMap.get(String(payment.studentId));
      return {
        paymentId: String(payment._id),
        studentId: String(payment.studentId),
        fullName: studentMeta?.fullName ?? "Unknown student",
        photoUrl: studentMeta?.photoUrl ?? null,
        amountMinor: Number(payment.amountMinor || 0),
        paymentDate: new Date(payment.paymentDate).toISOString(),
        paymentMethod: payment.paymentMethod,
      };
    });

    const leoRiskLevel =
      collectionRate < 65 || totalOutstandingMinor > totalPaidMinor || byStatus.overdue >= 3
        ? "high"
        : collectionRate < 82 || byStatus.partial >= Math.max(2, Math.ceil(studentRows.length * 0.2))
        ? "medium"
        : "low";

    const leoInsights = [
      `${studentRows.length} active students are in the fee cohort for ${classLabel}.`,
      `${defaultersCount} student${defaultersCount === 1 ? "" : "s"} currently owe fees in the selected scope.`,
      byStatus.overdue > 0
        ? `${byStatus.overdue} student${byStatus.overdue === 1 ? "" : "s"} have overdue exposure that needs follow-up.`
        : "No students are currently overdue in the selected scope.",
      recentCollectionsMinor > 0
        ? `Recent collections in the last 30 days total ${recentCollectionsMinor} minor units.`
        : "No completed collections have landed in the last 30 days for this class.",
    ];

    const leoPredictions: string[] = [];
    if (byStatus.overdue > 0) {
      leoPredictions.push(
        "Without targeted follow-up, the overdue group is the most likely source of reconciliation and cash-flow pressure for this class."
      );
    }
    if (collectionRate < 75) {
      leoPredictions.push(
        "The current collection pace suggests this class could miss its expected fee recovery target unless follow-up improves this month."
      );
    }
    if (onTrack.length >= Math.ceil(Math.max(1, studentRows.length * 0.3))) {
      leoPredictions.push(
        "A healthy on-track segment exists. Use it to benchmark payment plans and messaging against the slower-paying tail."
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        classGroup: {
          id: String((classDoc as any)._id),
          name: (classDoc as any).name,
          fullLabel: classLabel,
        },
        filters: {
          academicPeriodId: useAllPeriods
            ? "all"
            : selectedPeriodId
            ? String(selectedPeriodId)
            : null,
          academicPeriodLabel: useAllPeriods
            ? "All periods"
            : selectedPeriod
            ? `${selectedPeriod.yearLabel} • ${selectedPeriod.term}`
            : null,
        },
        summary: {
          studentCount: studentRows.length,
          invoiceCount: invoices.length,
          totalBilledMinor,
          totalPaidMinor,
          totalOutstandingMinor,
          collectionRate,
          defaultersCount,
          overdueInvoiceCount,
          recentCollectionsMinor,
        },
        byStatus,
        students: [...studentRows].sort(
          (a, b) =>
            b.totalOutstandingMinor - a.totalOutstandingMinor ||
            a.fullName.localeCompare(b.fullName)
        ),
        spotlight: {
          topDefaulters,
          onTrack,
          recentPayments: spotlightRecentPayments,
        },
        leo: {
          riskLevel: leoRiskLevel,
          headline:
            leoRiskLevel === "high"
              ? "This class needs fee collection intervention."
              : leoRiskLevel === "medium"
              ? "Collections are mixed, with a visible recovery tail."
              : "Fee collection is healthy across the class.",
          summary:
            leoRiskLevel === "high"
              ? "Outstanding balances and overdue exposure are large enough to warrant targeted follow-up."
              : leoRiskLevel === "medium"
              ? "The class is collecting, but a meaningful share of balances still needs active follow-up."
              : "Most fee activity is on track for the selected scope.",
          insights: leoInsights,
          predictions: leoPredictions,
        },
      },
    });
  } catch (error) {
    console.error("Failed to fetch class fee analytics:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch class fee analytics",
      },
      { status: 500 }
    );
  }
}
