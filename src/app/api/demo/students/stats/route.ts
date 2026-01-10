// src/app/api/demo/students/stats/route.ts
// Demo students quick stats

import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { getDemoContext } from "@/lib/demo/api-utils";
import { Student } from "@/models/Student";

export async function GET() {
  try {
    const demoContext = await getDemoContext();

    if (!demoContext.isDemo || !demoContext.demoTenantId) {
      return NextResponse.json({ error: "Demo session required" }, { status: 401 });
    }

    await connectToDatabase();
    const filter = { demoTenantId: demoContext.demoTenantId };

    const [total, active, inactive, suspended, graduated] = await Promise.all([
      Student.countDocuments(filter),
      Student.countDocuments({ ...filter, status: "active" }),
      Student.countDocuments({ ...filter, status: "inactive" }),
      Student.countDocuments({ ...filter, status: "suspended" }),
      Student.countDocuments({ ...filter, status: "graduated" }),
    ]);

    return NextResponse.json({
      total,
      active,
      inactive,
      suspended,
      graduated,
    });
  } catch (error) {
    console.error("[Demo Students Stats] Error:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
