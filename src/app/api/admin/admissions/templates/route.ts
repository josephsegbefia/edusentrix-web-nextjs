// src/app/api/admin/admissions/templates/route.ts
// GET — list available cycle templates so the CreateCycleModal can show them.

import { NextResponse } from "next/server";
import { requireAdmissionsManager } from "@/lib/auth/requireAdmissionsManager";
import { connectToDatabase } from "@/db/connectToDatabase";
import { listAdmissionCycleTemplates } from "@/lib/admissions/templates";
import { School } from "@/models/School";

export async function GET() {
  try {
    const ctx = await requireAdmissionsManager();
    await connectToDatabase();
    const school = await School.findById(ctx.schoolId).select({ type: 1 }).lean();
    const templates = listAdmissionCycleTemplates()
      .filter((t) => t.id !== "standard_shs" || school?.type === "SHS")
      .map((t) => ({
        id: t.id,
        label: t.label,
        description: t.description,
        defaults: t.defaults,
        // Provide a thin preview without hard-coding sections; the modal does
        // not need the entire schema to advertise the template.
        previewCounts: previewCountsFor(t),
      }));
    return NextResponse.json({ success: true, data: templates });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Admissions templates GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load templates" },
      { status: 500 }
    );
  }
}

function previewCountsFor(t: ReturnType<typeof listAdmissionCycleTemplates>[number]) {
  const schema = t.buildSchema();
  return {
    sections: schema.sections.length,
    fields: schema.sections.reduce((sum, s) => sum + s.fields.length, 0),
    documents: schema.documentRequirements.length,
  };
}
