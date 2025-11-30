// src/app/api/admin/grades/seed/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Grade } from "@/models/Grade";
import { School, type ISchool } from "@/models/School";
import { GRADE_TEMPLATES } from "@/constants/grade-templates";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const school = (await School.findById(schoolId).lean()) as ISchool | null;
    if (!school) return new Response("School not found", { status: 404 });

    const type: "Basic" | "SHS" = school.type === "SHS" ? "SHS" : "Basic";
    const tpl = GRADE_TEMPLATES[type];
    if (!tpl) return new Response("Unsupported school type", { status: 400 });

    // Idempotent upserts by (schoolId + code)
    await Promise.all(
      tpl.map((g) =>
        Grade.updateOne(
          { schoolId, code: g.code },
          {
            $setOnInsert: {
              schoolId,
              name: g.name,
              code: g.code,
              stage: g.stage,
              order: g.order,
              isActive: true,
            },
          },
          { upsert: true }
        )
      )
    );

    // No manual emit: metrics SSE doesn’t watch grades; UI should refetch via React Query invalidation.
    return Response.json({ success: true });
  } catch (e: unknown) {
    console.error(e);
    const message = e instanceof Error ? e.message : "Failed to seed grades";
    return new Response(message, { status: 500 });
  }
}
