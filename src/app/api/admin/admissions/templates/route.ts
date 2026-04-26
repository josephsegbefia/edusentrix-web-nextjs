// src/app/api/admin/admissions/templates/route.ts
// GET — list available cycle templates so the CreateCycleModal can show them.

import { NextResponse } from "next/server";
import { requireAdmissionsManager } from "@/lib/auth/requireAdmissionsManager";
import { listAdmissionCycleTemplates } from "@/lib/admissions/templates";

export async function GET() {
  try {
    await requireAdmissionsManager();
    const templates = listAdmissionCycleTemplates().map((t) => ({
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
