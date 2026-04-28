// POST — Idempotent per-school migration: `admissions_officer` subrole → `Delegation`
// (admissions, decision_maker), then strip legacy subrole. School admin only.
//
// Body: `{ "dryRun"?: boolean }`
// Does not call school-wide "replace delegate" revocation; multiple legacy officers
// each receive their own row if missing. Admins can consolidate via the delegations UI.

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { UserMembership, type IUserMembership } from "@/models/UserMembership";
import { Teacher } from "@/models/Teacher";
import { Delegation, type IDelegation } from "@/models/Delegation";
import { resolvePresetPermissions } from "@/lib/delegations/registry";
import { recordActivity } from "@/lib/audit/recordActivity";
import {
  revokeAdmissionsOfficer,
  ADMISSIONS_OFFICER_SUBROLE_KEY,
} from "@/lib/admissions/access";
import {
  invalidateMergedDelegationCacheForSchool,
  isDelegationActive,
} from "@/lib/delegations/service";

function oid(id: string) {
  return new mongoose.Types.ObjectId(id);
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireSchoolAdmin();
    await connectToDatabase();

    const schoolId = oid(String(ctx.schoolId));
    const adminUserId = oid(String(ctx.userId));

    let dryRun = false;
    try {
      const body = await req.json();
      dryRun = Boolean(body?.dryRun);
    } catch {
      /* no body */
    }

    const holders = await UserMembership.find({
      schoolId,
      status: "active",
      subroles: ADMISSIONS_OFFICER_SUBROLE_KEY,
    })
      .select({ userId: 1, roles: 1 })
      .lean<Array<Pick<IUserMembership, "userId" | "roles">>>();

    const created: string[] = [];
    const strippedOnly: string[] = [];
    const skipped: string[] = [];

    const now = new Date();

    for (const h of holders) {
      const staffUserId = h.userId as mongoose.Types.ObjectId;
      const roles = (h.roles ?? []) as string[];
      if (!roles.includes("teacher") && !roles.includes("staff")) {
        skipped.push(String(staffUserId));
        continue;
      }

      const existing = await Delegation.find({
        schoolId,
        staffUserId,
        module: "admissions",
        status: "active",
        $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
      })
        .select({ status: 1, expiresAt: 1 })
        .lean<Array<Pick<IDelegation, "status" | "expiresAt">>>();

      const hasActive = existing.some((d) => isDelegationActive(d));

      if (hasActive) {
        if (!dryRun) {
          await revokeAdmissionsOfficer({ schoolId, userId: staffUserId });
          await recordActivity({
            schoolId,
            userId: adminUserId,
            type: "delegation.migrated",
            entityType: "Delegation",
            description: "Removed legacy admissions_officer subrole (active delegation already present)",
            metadata: { staffUserId: String(staffUserId), module: "admissions" },
          });
        }
        strippedOnly.push(String(staffUserId));
        continue;
      }

      if (dryRun) {
        created.push(String(staffUserId));
        continue;
      }

      let staffTeacherId: mongoose.Types.ObjectId | null = null;
      if (roles.includes("teacher")) {
        const teacher = await Teacher.findOne({ schoolId, userId: staffUserId, status: "active" })
          .select({ _id: 1 })
          .lean();
        if (!teacher) {
          skipped.push(String(staffUserId));
          continue;
        }
        staffTeacherId = teacher._id as mongoose.Types.ObjectId;
      }

      const preset = "decision_maker";
      const permissions = resolvePresetPermissions("admissions", preset);
      if (!permissions?.length) {
        skipped.push(String(staffUserId));
        continue;
      }

      const doc = await Delegation.create({
        schoolId,
        staffUserId,
        staffTeacherId,
        module: "admissions",
        preset,
        permissions,
        status: "active",
        startsAt: new Date(),
        expiresAt: null,
        grantedByUserId: adminUserId,
        grantNote: "Migrated from legacy admissions_officer subrole",
      });

      await revokeAdmissionsOfficer({ schoolId, userId: staffUserId });

      await recordActivity({
        schoolId,
        userId: adminUserId,
        type: "delegation.migrated",
        entityType: "Delegation",
        entityId: doc._id,
        description: `Migrated admissions access from subrole to delegation (${preset})`,
        metadata: {
          staffUserId: String(staffUserId),
          module: "admissions",
          preset,
          delegationId: String(doc._id),
        },
      });

      created.push(String(staffUserId));
    }

    if (!dryRun && (created.length > 0 || strippedOnly.length > 0)) {
      invalidateMergedDelegationCacheForSchool(schoolId);
    }

    return NextResponse.json({
      success: true,
      data: {
        dryRun,
        legacyHolders: holders.length,
        migratedUserIds: created,
        subroleStrippedOnlyUserIds: strippedOnly,
        skippedUserIds: skipped,
      },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json(
      { success: false, error: "Migration failed" },
      { status: 500 }
    );
  }
}
