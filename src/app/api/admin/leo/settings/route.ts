import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { requireSchoolMember } from "@/lib/auth/requireSchoolMember";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { mergeSchoolLeo } from "@/lib/leo/defaults";
import { getLeoPlatformConfig } from "@/lib/leo/platform-flag";
import { pickLeoAppRole } from "@/lib/leo/pick-app-role";
import { resolveLeoAccess } from "@/lib/leo/access";
import { SchoolSettings } from "@/models/SchoolSettings";

export const dynamic = "force-dynamic";

const PatchSchema = z
  .object({
    accessOverride: z.enum(["inherit", "enabled", "disabled"]).optional(),
    entitlementBypass: z.boolean().optional(),
    allowWriteActions: z.boolean().optional(),
    allowBulkActions: z.boolean().optional(),
    allowDrafting: z.boolean().optional(),
    allowMonitors: z.boolean().optional(),
    retentionDays: z.number().int().min(1).max(3650).optional(),
    defaultModelProfile: z.enum(["low_cost", "balanced", "high_quality"]).optional(),
    privacyMode: z.enum(["strict", "balanced"]).optional(),
    roleOverrides: z
      .object({
        school_admin: z.enum(["inherit", "enabled", "disabled"]).optional(),
        teacher: z.enum(["inherit", "enabled", "disabled"]).optional(),
        parent: z.enum(["inherit", "enabled", "disabled"]).optional(),
        student: z.enum(["inherit", "enabled", "disabled"]).optional(),
        bursar: z.enum(["inherit", "enabled", "disabled"]).optional(),
        billing_owner: z.enum(["inherit", "enabled", "disabled"]).optional(),
      })
      .optional(),
    ui: z
      .object({
        floatingPaneEnabled: z.boolean().optional(),
        homeSummaryCardsEnabled: z.boolean().optional(),
      })
      .optional(),
  })
  .strict();

export async function GET() {
  try {
    const member = await requireSchoolMember({
      allowedRoles: ["school_admin", "bursar", "billing_owner"],
    });
    const role = pickLeoAppRole(member.roles);
    const access = await resolveLeoAccess({
      schoolId: member.schoolId,
      role,
    });
    const platform = await getLeoPlatformConfig();
    const canSchoolEdit = platform.allowSchoolSelfService;

    return NextResponse.json({
      success: true,
      data: {
        access,
        canSchoolEdit,
        leo: access.schoolLeo,
        platform: {
          allowSchoolSelfService: platform.allowSchoolSelfService,
        },
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Admin Leo settings GET:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load Leo school settings" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { schoolId, userId } = await requireSchoolAdmin();
    const platform = await getLeoPlatformConfig();
    if (!platform.allowSchoolSelfService) {
      return NextResponse.json(
        {
          success: false,
          error: "School self-service for Leo is disabled. Contact the platform team.",
        },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const existing = (await SchoolSettings.findOne({ schoolId: schoolIdObj })
      .select("leo")
      .lean()) as { leo?: Record<string, unknown> } | null;
    const base = mergeSchoolLeo(existing?.leo);
    const merged = {
      ...base,
      ...parsed.data,
      roleOverrides: {
        ...base.roleOverrides,
        ...parsed.data.roleOverrides,
      },
      ui: {
        ...base.ui!,
        ...parsed.data.ui,
      },
    };

    const updated = await SchoolSettings.findOneAndUpdate(
      { schoolId: schoolIdObj },
      {
        $set: {
          leo: merged,
          updatedBy: new mongoose.Types.ObjectId(String(userId)),
        },
      },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "School settings not found. Open Settings once to initialize." },
        { status: 404 }
      );
    }

    const access = await resolveLeoAccess({
      schoolId: schoolIdObj,
      role: "school_admin",
    });

    return NextResponse.json({
      success: true,
      data: { leo: access.schoolLeo, access },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Admin Leo settings PATCH:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update Leo school settings" },
      { status: 500 }
    );
  }
}
