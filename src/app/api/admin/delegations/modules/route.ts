import { NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { DELEGATION_REGISTRY, listImplementedModules } from "@/lib/delegations/registry";
import type { DelegationModule } from "@/lib/delegations/types";

export async function GET() {
  try {
    await requireSchoolAdmin();
    const implemented = listImplementedModules();
    const modules = implemented.map((id) => {
      const def = DELEGATION_REGISTRY[id as DelegationModule];
      return {
        id,
        label: def.label,
        description: def.description,
        adminHref: def.adminHref,
        presets: Object.entries(def.presets).map(([key, p]) => ({
          id: key,
          label: p.label,
          description: p.description,
        })),
      };
    });
    return NextResponse.json({ success: true, data: modules });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ success: false, error: "Failed to load modules" }, { status: 500 });
  }
}
