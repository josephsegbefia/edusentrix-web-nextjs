import mongoose from "mongoose";
import { z } from "zod";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { PHRASE_DELETE_SCHOOL_PERMANENTLY } from "@/lib/platform/school-lifecycle-constants";
import { purgeSchoolCompletely } from "@/lib/schools/purge-school";
import { School } from "@/models/School";

const BodySchema = z.object({
  confirmationPhrase: z.string().min(1),
  schoolName: z.string().min(1),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requirePlatformAdmin();
    if (!gate.ok) return gate.res;

    const { id: schoolIdParam } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(schoolIdParam)) {
      return NextResponse.json({ success: false, error: "Invalid school id" }, { status: 400 });
    }
    const schoolId = new mongoose.Types.ObjectId(schoolIdParam);

    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    if (parsed.data.confirmationPhrase.trim() !== PHRASE_DELETE_SCHOOL_PERMANENTLY) {
      return NextResponse.json(
        {
          success: false,
          error: "Confirmation phrase does not match.",
          code: "CONFIRMATION_MISMATCH",
        },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const school = await School.findById(schoolId).select("name").lean<{ name?: string } | null>();
    if (!school) {
      return NextResponse.json({ success: false, error: "School not found." }, { status: 404 });
    }

    if (parsed.data.schoolName.trim() !== (school.name ?? "").trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "School name does not match. Type the school name exactly as shown.",
          code: "NAME_MISMATCH",
        },
        { status: 400 }
      );
    }

    const result = await purgeSchoolCompletely(schoolId);

    return NextResponse.json({
      success: true,
      data: {
        schoolId: schoolIdParam,
        ...result,
      },
    });
  } catch (error) {
    console.error("platform school permanent-delete:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete school",
      },
      { status: 500 }
    );
  }
}
