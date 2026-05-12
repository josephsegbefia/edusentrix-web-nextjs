import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { PlatformStaffProfile } from "@/models/PlatformStaffProfile";
import {
  PLATFORM_ROLE_PRESETS,
  PLATFORM_STAFF_ROLE_PRESETS,
  type PlatformStaffRolePreset,
} from "@/lib/platform/permissions/presets";

const StaffListQuerySchema = z.object({
  q: z.string().trim().max(120).optional().default(""),
  status: z.enum(["all", "invited", "active", "suspended"]).optional().default("all"),
  rolePreset: z
    .enum(["all", ...PLATFORM_STAFF_ROLE_PRESETS])
    .optional()
    .default("all"),
});

type StaffProfileRow = {
  _id: unknown;
  userId: unknown;
  email: string;
  fullName: string;
  jobTitle: string;
  rolePreset: PlatformStaffRolePreset;
  permissions?: string[];
  status: "invited" | "active" | "suspended";
  accessMode: "all_schools" | "delegated_only";
  invitedAt?: Date | null;
  suspendedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function GET(req: NextRequest) {
  try {
    const gate = await requirePlatformPermission("platform.staff.read");
    if (!gate.ok) return gate.res;

    const parsed = StaffListQuerySchema.safeParse({
      q: req.nextUrl.searchParams.get("q") || "",
      status: req.nextUrl.searchParams.get("status") || "all",
      rolePreset: req.nextUrl.searchParams.get("rolePreset") || "all",
    });

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid staff filters" },
        { status: 400 }
      );
    }

    const { q, status, rolePreset } = parsed.data;
    await connectToDatabase();

    const query: Record<string, unknown> = {};
    if (status !== "all") {
      query.status = status;
    }
    if (rolePreset !== "all") {
      query.rolePreset = rolePreset;
    }
    if (q) {
      const pattern = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { fullName: { $regex: pattern, $options: "i" } },
        { email: { $regex: pattern, $options: "i" } },
        { jobTitle: { $regex: pattern, $options: "i" } },
      ];
    }

    const staff = await PlatformStaffProfile.find(query)
      .sort({ status: 1, fullName: 1, createdAt: -1 })
      .limit(200)
      .lean<StaffProfileRow[]>();

    return NextResponse.json({
      success: true,
      data: {
        staff: staff.map((profile) => ({
          id: String(profile._id),
          userId: String(profile.userId),
          fullName: profile.fullName,
          email: profile.email,
          jobTitle: profile.jobTitle,
          rolePreset: profile.rolePreset,
          rolePresetLabel:
            PLATFORM_ROLE_PRESETS[profile.rolePreset]?.label || profile.rolePreset,
          status: profile.status,
          accessMode: profile.accessMode,
          permissionCount: profile.permissions?.length || 0,
          invitedAt: profile.invitedAt?.toISOString() || null,
          suspendedAt: profile.suspendedAt?.toISOString() || null,
          createdAt: profile.createdAt.toISOString(),
          updatedAt: profile.updatedAt.toISOString(),
          lastActiveAt: null,
        })),
      },
    });
  } catch (error) {
    console.error("[platform/staff:GET]", error);
    return NextResponse.json(
      { success: false, error: "Failed to load platform staff" },
      { status: 500 }
    );
  }
}
