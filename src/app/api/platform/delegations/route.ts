import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { validatePlatformPermissionKeys } from "@/lib/platform/permissions/registry";
import { serializePlatformDelegation } from "@/lib/platform/delegations/serialize-platform-delegation";
import { PlatformAuditLog } from "@/models/PlatformAuditLog";
import { PLATFORM_DELEGATION_SCOPES } from "@/lib/platform/delegations/scopes";
import { PlatformDelegation } from "@/models/PlatformDelegation";
import { PlatformStaffProfile } from "@/models/PlatformStaffProfile";
import { School } from "@/models/School";

const DelegationQuerySchema = z.object({
  status: z.enum(["all", "active", "expired", "revoked"]).optional().default("all"),
  staffProfileId: z.string().trim().optional().default(""),
  schoolId: z.string().trim().optional().default(""),
});

const CreateDelegationSchema = z.object({
  staffProfileId: z.string().trim().min(1),
  schoolId: z.string().trim().min(1),
  scope: z.enum(PLATFORM_DELEGATION_SCOPES),
  permissions: z.array(z.string().trim()).min(1),
  startsAt: z.string().trim().min(1),
  expiresAt: z.string().trim().optional().nullable().default(null),
  reason: z.string().trim().min(8).max(1000),
});

type SchoolRow = { _id: unknown; name?: string };
type StaffRow = {
  _id: unknown;
  userId: unknown;
  fullName: string;
  email: string;
  status: string;
};

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function buildDelegationResponse(query: Record<string, unknown>) {
  const delegations = await PlatformDelegation.find(query)
    .sort({ status: 1, startsAt: -1, createdAt: -1 })
    .limit(200)
    .lean();

  const schoolIds = Array.from(
    new Set(delegations.map((item) => (item.schoolId ? String(item.schoolId) : "")).filter(Boolean))
  );
  const staffProfileIds = Array.from(
    new Set(delegations.map((item) => (item.staffProfileId ? String(item.staffProfileId) : "")).filter(Boolean))
  );

  const [schools, staffProfiles] = await Promise.all([
    schoolIds.length
      ? School.find({ _id: { $in: schoolIds } }).select("name").lean<SchoolRow[]>()
      : [],
    staffProfileIds.length
      ? PlatformStaffProfile.find({ _id: { $in: staffProfileIds } })
          .select("fullName email")
          .lean<Array<{ _id: unknown; fullName: string; email: string }>>()
      : [],
  ]);

  const schoolMap = new Map(schools.map((school) => [String(school._id), school.name || "Unnamed School"]));
  const staffMap = new Map(
    staffProfiles.map((profile) => [
      String(profile._id),
      { staffName: profile.fullName, staffEmail: profile.email },
    ])
  );

  return delegations.map((delegation) => {
    const staffLookup = delegation.staffProfileId
      ? staffMap.get(String(delegation.staffProfileId))
      : null;
    return serializePlatformDelegation(delegation, {
      schoolName: delegation.schoolId ? schoolMap.get(String(delegation.schoolId)) : null,
      staffName: staffLookup?.staffName || "Unknown staff",
      staffEmail: staffLookup?.staffEmail || "",
    });
  });
}

export async function GET(req: NextRequest) {
  try {
    const gate = await requirePlatformPermission("platform.implementation.assignTasks");
    if (!gate.ok) return gate.res;

    const parsed = DelegationQuerySchema.safeParse({
      status: req.nextUrl.searchParams.get("status") || "all",
      staffProfileId: req.nextUrl.searchParams.get("staffProfileId") || "",
      schoolId: req.nextUrl.searchParams.get("schoolId") || "",
    });
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid delegation filters" },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const query: Record<string, unknown> = {};
    if (parsed.data.status !== "all") query.status = parsed.data.status;
    if (parsed.data.staffProfileId) {
      if (!mongoose.Types.ObjectId.isValid(parsed.data.staffProfileId)) {
        return NextResponse.json({ success: false, error: "Invalid staff profile id" }, { status: 400 });
      }
      query.staffProfileId = new mongoose.Types.ObjectId(parsed.data.staffProfileId);
    }
    if (parsed.data.schoolId) {
      if (!mongoose.Types.ObjectId.isValid(parsed.data.schoolId)) {
        return NextResponse.json({ success: false, error: "Invalid school id" }, { status: 400 });
      }
      query.schoolId = new mongoose.Types.ObjectId(parsed.data.schoolId);
    }

    return NextResponse.json({
      success: true,
      data: { delegations: await buildDelegationResponse(query) },
    });
  } catch (error) {
    console.error("[platform/delegations:GET]", error);
    return NextResponse.json(
      { success: false, error: "Failed to load platform delegations" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const gate = await requirePlatformPermission("platform.implementation.assignTasks");
    if (!gate.ok) return gate.res;

    const parsed = CreateDelegationSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid delegation payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const input = parsed.data;
    if (!mongoose.Types.ObjectId.isValid(input.staffProfileId)) {
      return NextResponse.json({ success: false, error: "Invalid staff profile id" }, { status: 400 });
    }
    if (!mongoose.Types.ObjectId.isValid(input.schoolId)) {
      return NextResponse.json({ success: false, error: "Invalid school id" }, { status: 400 });
    }

    const validation = validatePlatformPermissionKeys(input.permissions);
    if (!validation.ok) {
      return NextResponse.json(
        {
          success: false,
          error: "One or more selected permissions are invalid.",
          invalidPermissions: validation.invalid,
        },
        { status: 400 }
      );
    }

    const startsAt = parseDate(input.startsAt);
    const expiresAt = parseDate(input.expiresAt);
    if (!startsAt) {
      return NextResponse.json({ success: false, error: "Invalid start date" }, { status: 400 });
    }
    if (expiresAt && expiresAt <= startsAt) {
      return NextResponse.json(
        { success: false, error: "Expiry date must be after the start date" },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const staffProfile = await PlatformStaffProfile.findById(input.staffProfileId)
      .select("_id userId fullName email status permissions")
      .lean<StaffRow | null>();
    if (!staffProfile) {
      return NextResponse.json({ success: false, error: "Staff profile not found" }, { status: 404 });
    }
    if (staffProfile.status === "suspended") {
      return NextResponse.json(
        { success: false, error: "Cannot delegate work to a suspended staff profile" },
        { status: 400 }
      );
    }

    const school = await School.findById(input.schoolId).select("name").lean<SchoolRow | null>();
    if (!school) {
      return NextResponse.json({ success: false, error: "School not found" }, { status: 404 });
    }

    const permissions = Array.from(new Set(validation.permissions));
    const staffPermissionSet = new Set(staffProfile.permissions || []);
    const unsupportedPermissions = permissions.filter((permission) => !staffPermissionSet.has(permission));
    if (unsupportedPermissions.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Delegation permissions must already belong to the staff profile.",
          unsupportedPermissions,
        },
        { status: 400 }
      );
    }

    const delegation = await PlatformDelegation.create({
      schoolId: new mongoose.Types.ObjectId(input.schoolId),
      staffUserId: staffProfile.userId,
      staffProfileId: staffProfile._id,
      assignedByUserId: gate.actor.userId,
      scope: input.scope,
      permissions,
      startsAt,
      expiresAt,
      status: "active",
      reason: input.reason,
    });

    await PlatformAuditLog.create({
      actorId: gate.actor.userId,
      schoolId: new mongoose.Types.ObjectId(input.schoolId),
      action: "platform.delegation.created",
      entityType: "PlatformDelegation",
      entityId: delegation._id,
      metadata: {
        staffProfileId: String(staffProfile._id),
        staffEmail: staffProfile.email,
        schoolName: school.name || null,
        scope: input.scope,
        permissions,
        startsAt,
        expiresAt,
        reason: input.reason,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        delegation: serializePlatformDelegation(delegation.toObject(), {
          schoolName: school.name || null,
          staffName: staffProfile.fullName,
          staffEmail: staffProfile.email,
        }),
      },
    });
  } catch (error) {
    console.error("[platform/delegations:POST]", error);
    return NextResponse.json(
      { success: false, error: "Failed to create platform delegation" },
      { status: 500 }
    );
  }
}
