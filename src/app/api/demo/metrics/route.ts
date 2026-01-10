// src/app/api/demo/metrics/route.ts
// Returns aggregated metrics for the demo dashboard

import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { getDemoContext } from "@/lib/demo/api-utils";
import { Student } from "@/models/Student";
import { Teacher } from "@/models/Teacher";
import { ClassGroup } from "@/models/ClassGroup";
import { Subject } from "@/models/Subject";
import { Invoice } from "@/models/Invoice";
import { AcademicPeriod } from "@/models/AcademicPeriod";

interface PeriodDoc {
  yearLabel: string;
  term: string;
  startDate: Date;
  endDate: Date;
}

export async function GET() {
  try {
    const demoContext = await getDemoContext();

    if (!demoContext.isDemo || !demoContext.demoTenantId) {
      return NextResponse.json({ error: "Demo session required" }, { status: 401 });
    }

    await connectToDatabase();
    const filter = { demoTenantId: demoContext.demoTenantId };

    // Fetch counts in parallel
    const [
      studentsCount,
      teachersCount,
      classGroupsCount,
      subjectsCount,
      invoices,
      currentPeriodRaw,
    ] = await Promise.all([
      Student.countDocuments(filter),
      Teacher.countDocuments(filter),
      ClassGroup.countDocuments(filter),
      Subject.countDocuments(filter),
      Invoice.find(filter).select("totalAmount paidAmount status").lean(),
      AcademicPeriod.findOne({ ...filter, isCurrent: true })
        .select("yearLabel term startDate endDate")
        .lean(),
    ]);

    const currentPeriod = currentPeriodRaw as PeriodDoc | null;

    // Calculate invoice metrics
    const collected = invoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
    const total = invoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
    const outstanding = total - collected;

    return NextResponse.json({
      students: { total: studentsCount },
      teachers: { total: teachersCount },
      classGroups: { total: classGroupsCount },
      subjects: { total: subjectsCount },
      invoices: {
        total: invoices.length,
        collected,
        outstanding,
      },
      period: currentPeriod
        ? {
            yearLabel: currentPeriod.yearLabel,
            term: currentPeriod.term,
            startDate: currentPeriod.startDate,
            endDate: currentPeriod.endDate,
          }
        : null,
    });
  } catch (error) {
    console.error("[Demo Metrics] Error:", error);
    return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 });
  }
}
