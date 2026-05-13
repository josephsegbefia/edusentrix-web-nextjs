import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { createSchoolFromPlatform } from "@/lib/platform/schools/create-school-from-platform";
import { getPlatformSchoolList } from "@/lib/platform-billing/platform-schools";

const CreatePlatformSchoolSchema = z.object({
  school: z.object({
    name: z.string().trim().min(2).max(180),
    type: z.enum(["Basic", "SHS"]),
    curriculumCode: z.enum([
      "ghana_nacca",
      "cambridge",
      "ib_pyp",
      "ib_myp",
      "british_nc",
      "american",
      "hybrid",
    ]),
    address: z.string().trim().max(240).optional().default(""),
    city: z.string().trim().max(80).optional().default(""),
    region: z.string().trim().max(80).optional().default(""),
    email: z.string().email().optional().or(z.literal("")).default(""),
    phone: z.string().trim().max(30).optional().default(""),
    gesSchoolCode: z.string().trim().max(80).optional().default(""),
  }),
  admin: z.object({
    fullName: z.string().trim().min(2).max(180),
    email: z.string().email(),
    phone: z.string().trim().max(30).optional().default(""),
    jobTitle: z.string().trim().max(120).optional().default(""),
  }),
  implementation: z.object({
    assignedOwnerUserId: z.string().trim().optional().nullable().default(null),
    startDate: z.string().trim().optional().nullable().default(null),
    targetGoLiveDate: z.string().trim().optional().nullable().default(null),
    priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
    notes: z.string().trim().max(1000).optional().nullable().default(null),
  }),
});

export async function GET() {
  try {
    const gate = await requirePlatformAdmin();
    if (!gate.ok) return gate.res;

    const schools = await getPlatformSchoolList();
    return NextResponse.json({ success: true, data: { schools } });
  } catch (error) {
    console.error("Failed to load platform schools:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to load platform schools",
      },
      { status: 500 }
    );
  }
}

function parseOptionalDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function POST(req: NextRequest) {
  try {
    const gate = await requirePlatformPermission("platform.schools.create");
    if (!gate.ok) return gate.res;

    const parsed = CreatePlatformSchoolSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid school creation payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await createSchoolFromPlatform({
      actorUserId: gate.actor.userId,
      school: parsed.data.school,
      admin: parsed.data.admin,
      implementation: {
        ...parsed.data.implementation,
        startDate: parseOptionalDate(parsed.data.implementation.startDate),
        targetGoLiveDate: parseOptionalDate(parsed.data.implementation.targetGoLiveDate),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        schoolId: String(result.school._id),
        implementationProjectId: String(result.project._id),
        setupTaskId: String(result.task._id),
      },
    });
  } catch (error) {
    console.error("Failed to create platform school:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create school",
      },
      { status: 500 }
    );
  }
}
