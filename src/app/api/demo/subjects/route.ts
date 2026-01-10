// src/app/api/demo/subjects/route.ts
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { getDemoContext } from "@/lib/demo/api-utils";
import { Subject } from "@/models/Subject";

export async function GET() {
  try {
    const demoContext = await getDemoContext();

    if (!demoContext.isDemo || !demoContext.demoTenantId) {
      return NextResponse.json({ error: "Demo session required" }, { status: 401 });
    }

    await connectToDatabase();
    const filter = { demoTenantId: demoContext.demoTenantId };

    const subjects = await Subject.find(filter)
      .sort({ name: 1 })
      .lean();

    const data = subjects.map((s) => ({
      _id: String(s._id),
      name: s.name,
      code: s.code,
      description: s.description,
      category: s.category,
      status: s.status || "active",
    }));

    return NextResponse.json({ data, total: data.length });
  } catch (error) {
    console.error("[Demo Subjects] Error:", error);
    return NextResponse.json({ error: "Failed to fetch subjects" }, { status: 500 });
  }
}
