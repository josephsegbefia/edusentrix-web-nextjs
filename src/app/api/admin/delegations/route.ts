import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Delegation } from "@/models/Delegation";
import { UserMembership, type IUserMembership } from "@/models/UserMembership";
import { Teacher } from "@/models/Teacher";
import { CreateDelegationBodySchema } from "@/schemas/delegations";
import { DELEGATION_REGISTRY, resolvePresetPermissions } from "@/lib/delegations/registry";
import type { DelegationModule } from "@/lib/delegations/types";
import {
  invalidateMergedDelegationCacheForSchool,
  invalidateMergedDelegationCacheForUser,
  revokeOtherActiveDelegationsForModule,
} from "@/lib/delegations/service";
import { recordActivity } from "@/lib/audit/recordActivity";
import {
  revokeAdmissionsOfficer,
  ADMISSIONS_OFFICER_SUBROLE_KEY,
} from "@/lib/admissions/access";
import { User } from "@/models/User";
import { School } from "@/models/School";
import { notifyDelegateAccessGranted } from "@/lib/delegations/notifications";

function oid(id: string) {
  return new mongoose.Types.ObjectId(id);
}

async function stripLegacyAdmissionsOfficers(schoolId: mongoose.Types.ObjectId) {
  const holders = await UserMembership.find({
    schoolId,
    subroles: ADMISSIONS_OFFICER_SUBROLE_KEY,
  })
    .select({ userId: 1 })
    .lean();
  for (const h of holders) {
    await revokeAdmissionsOfficer({ schoolId, userId: oid(String(h.userId)) });
  }
}

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireSchoolAdmin();
    await connectToDatabase();
    const schoolId = oid(String(ctx.schoolId));
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "active";
    const moduleFilter = searchParams.get("module");

    const q: Record<string, unknown> = { schoolId };
    if (status === "all") {
      /* no status filter */
    } else {
      q.status = status;
    }
    if (moduleFilter) q.module = moduleFilter;

    const rows = await Delegation.find(q).sort({ updatedAt: -1 }).limit(200).lean();

    const userIds = [...new Set(rows.map((r) => String(r.staffUserId)))];
    const granterIds = [...new Set(rows.map((r) => String(r.grantedByUserId)))];
    const users = await User.find({
      _id: { $in: [...userIds, ...granterIds].map((id) => oid(id)) },
    })
      .select({ firstName: 1, lastName: 1, email: 1 })
      .lean();
    const userMap = new Map(users.map((u) => [String(u._id), u]));

    const data = rows.map((r) => {
      const u = userMap.get(String(r.staffUserId));
      const g = userMap.get(String(r.grantedByUserId));
      const mod = DELEGATION_REGISTRY[r.module as DelegationModule];
      return {
        id: String(r._id),
        staffUserId: String(r.staffUserId),
        staffName: u ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() : "",
        staffEmail: u?.email ?? "",
        module: r.module,
        moduleLabel: mod?.label ?? r.module,
        preset: r.preset,
        status: r.status,
        expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
        grantedByName: g ? `${g.firstName ?? ""} ${g.lastName ?? ""}`.trim() : "",
        grantNote: r.grantNote ?? null,
        lastActivityAt: r.lastActivityAt ? r.lastActivityAt.toISOString() : null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json({ success: false, error: "Failed to list delegations" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireSchoolAdmin();
    await connectToDatabase();
    const schoolId = oid(String(ctx.schoolId));
    const adminUserId = oid(String(ctx.userId));

    const body = await req.json();
    const parsed = CreateDelegationBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { staffUserId, module, preset, expiresAt, note } = parsed.data;
    const staffOid = oid(staffUserId);

    const def = DELEGATION_REGISTRY[module as DelegationModule];
    if (!def?.implemented) {
      return NextResponse.json({ success: false, error: "Module not available" }, { status: 400 });
    }
    if (!def.presets[preset]) {
      return NextResponse.json({ success: false, error: "Invalid preset" }, { status: 400 });
    }

    const permissions = resolvePresetPermissions(module as DelegationModule, preset);
    if (!permissions?.length) {
      return NextResponse.json({ success: false, error: "Could not resolve permissions" }, { status: 400 });
    }

    const membership = await UserMembership.findOne({
      schoolId,
      userId: staffOid,
      status: "active",
    })
      .select({ roles: 1 })
      .lean<Pick<IUserMembership, "roles"> | null>();
    if (!membership) {
      return NextResponse.json({ success: false, error: "Staff not found" }, { status: 404 });
    }
    const roles = (membership.roles ?? []) as string[];
    if (!roles.includes("teacher") && !roles.includes("staff")) {
      return NextResponse.json(
        { success: false, error: "Only teacher or staff can receive delegations" },
        { status: 400 }
      );
    }

    let staffTeacherId: mongoose.Types.ObjectId | null = null;
    if (roles.includes("teacher")) {
      const teacher = await Teacher.findOne({ schoolId, userId: staffOid, status: "active" })
        .select({ _id: 1 })
        .lean();
      if (!teacher) {
        return NextResponse.json(
          { success: false, error: "Teacher record missing for this user" },
          { status: 400 }
        );
      }
      staffTeacherId = teacher._id as mongoose.Types.ObjectId;
    }

    let expDate: Date | null = null;
    if (expiresAt) {
      expDate = new Date(expiresAt);
      if (expDate.getTime() <= Date.now()) {
        return NextResponse.json({ success: false, error: "Expiry must be in the future" }, { status: 400 });
      }
    }

    const now = new Date();
    await Delegation.updateMany(
      {
        schoolId,
        staffUserId: staffOid,
        module,
        status: "active",
        $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
      },
      {
        $set: {
          status: "revoked",
          revokedAt: now,
          revokedByUserId: adminUserId,
          revokeReason: "Superseded by new grant",
        },
      }
    );

    if (module === "admissions") {
      await stripLegacyAdmissionsOfficers(schoolId);
      await revokeOtherActiveDelegationsForModule({
        schoolId,
        module: "admissions",
        keepStaffUserId: staffOid,
        revokedByUserId: adminUserId,
        reason: "Replaced by new delegation",
      });
    }

    const doc = await Delegation.create({
      schoolId,
      staffUserId: staffOid,
      staffTeacherId,
      module,
      preset,
      permissions,
      status: "active",
      startsAt: new Date(),
      expiresAt: expDate,
      grantedByUserId: adminUserId,
      grantNote: note?.trim() || null,
    });

    await recordActivity({
      schoolId,
      userId: adminUserId,
      type: "delegation.created",
      entityType: "Delegation",
      entityId: doc._id,
      description: `Delegation granted: ${module} (${preset})`,
      actorRole: "admin",
      metadata: {
        staffUserId,
        module,
        preset,
        permissions,
      },
    });

    const school = await School.findById(schoolId).select({ name: 1 }).lean<{ name?: string } | null>();
    void notifyDelegateAccessGranted({
      schoolId,
      staffUserId: staffOid,
      module: module as DelegationModule,
      preset,
      expiresAt: expDate,
      schoolName: school?.name,
    });

    if (module === "admissions") {
      invalidateMergedDelegationCacheForSchool(schoolId);
    } else {
      invalidateMergedDelegationCacheForUser(schoolId, staffOid);
    }

    return NextResponse.json({ success: true, data: { id: String(doc._id) } });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json({ success: false, error: "Failed to create delegation" }, { status: 500 });
  }
}
