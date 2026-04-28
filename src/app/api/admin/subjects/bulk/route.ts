/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/admin/subjects/bulk/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Subject } from "@/models/Subject";

type Body = { names: string[] };

export async function POST(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedAnyPermission([
      "subjects.edit",
    ]);
    await connectToDatabase();

    const body = (await req.json()) as Body;
    const names = (body?.names ?? [])
      .map((n) => (typeof n === "string" ? n.trim() : ""))
      .filter(Boolean);

    if (names.length === 0) {
      return new Response("No subjects provided", { status: 400 });
    }

    // Case-insensitive dedupe per school
    const existing = await Subject.find({
      schoolId,
      name: { $in: names },
    })
      .collation({ locale: "en", strength: 2 })
      .lean();

    const existingSet = new Set(existing.map((s) => s.name.toLowerCase()));
    const toCreate = names.filter((n) => !existingSet.has(n.toLowerCase()));

    if (toCreate.length > 0) {
      await Subject.insertMany(
        toCreate.map((name) => ({
          schoolId,
          name,
          code: null,
          isActive: true,
        })),
        { ordered: false }
      );
    }

    // No manual emit: your SSE route watches Subject and will push `subjects.updated`.
    return Response.json({
      success: true,
      created: toCreate.length,
      skipped: names.length - toCreate.length,
    });
  } catch (e: any) {
    console.error(e);
    return new Response(e?.message ?? "Failed to create subjects", {
      status: 500,
    });
  }
}
