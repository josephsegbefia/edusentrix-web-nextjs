import { NextResponse } from "next/server";
import { requireSchoolAdminOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";
import { REPORT_DEFINITION_LIST } from "@/constants/reports";

/** Read-only, contact-free catalogue projection for Konect. */
export async function GET() {
  await requireSchoolAdminOrDelegatedModuleView("reports");
  return NextResponse.json({
    success: true,
    data: REPORT_DEFINITION_LIST.map((definition) => ({
      key: definition.key,
      title: definition.label,
      description: definition.description || null,
      category: definition.category,
      rangeMode: definition.rangeMode,
      formats: definition.formats,
    })),
  });
}
