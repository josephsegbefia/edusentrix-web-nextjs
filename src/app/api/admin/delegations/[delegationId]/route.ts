import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Delegation, type IDelegation } from "@/models/Delegation";
import { DELEGATION_REGISTRY, resolvePresetPermissions } from "@/lib/delegations/registry";
import type { DelegationModule } from "@/lib/delegations/types";
import { PatchDelegationBodySchema, RevokeDelegationBodySchema } from "@/schemas/delegations";
import { recordActivity } from "@/lib/audit/recordActivity";
import { School } from "@/models/School";
import {
  notifyDelegateAccessRevoked,
  notifyDelegateAccessUpdated,
} from "@/lib/delegations/notifications";
import { invalidateMergedDelegationCacheForUser } from "@/lib/delegations/service";

function oid(id: string) {
  return new mongoose.Types.ObjectId(id);
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ delegationId: string }> }
) {
  try {
    const adminCtx = await requireSchoolAdmin();
    await connectToDatabase();
    const { delegationId } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(delegationId)) {
      return NextResponse.json({ success: false, error: "Invalid id" }, { status: 400 });
    }
    const schoolId = oid(String(adminCtx.schoolId));
    const row = await Delegation.findOne({
      _id: oid(delegationId),
      schoolId,
    }).lean<IDelegation | null>();
    if (!row) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      data: {
        id: String(row._id),
        staffUserId: String(row.staffUserId),
        module: row.module,
        preset: row.preset,
        permissions: row.permissions,
        status: row.status,
        expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
        grantNote: row.grantNote,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ delegationId: string }> }
) {
  try {
    const adminCtx = await requireSchoolAdmin();
    await connectToDatabase();
    const { delegationId } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(delegationId)) {
      return NextResponse.json({ success: false, error: "Invalid id" }, { status: 400 });
    }
    const schoolId = oid(String(adminCtx.schoolId));
    const adminUserId = oid(String(adminCtx.userId));

    const doc = await Delegation.findOne({
      _id: oid(delegationId),
      schoolId,
    });
    if (!doc) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
    if (doc.status !== "active") {
      return NextResponse.json({ success: false, error: "Delegation is not active" }, { status: 400 });
    }

    const body = await req.json();
    const parsed = PatchDelegationBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const before = { preset: doc.preset, expiresAt: doc.expiresAt, permissions: doc.permissions };

    if (parsed.data.preset) {
      const mod = doc.module as DelegationModule;
      const perms = resolvePresetPermissions(mod, parsed.data.preset);
      if (!perms?.length) {
        return NextResponse.json({ success: false, error: "Invalid preset" }, { status: 400 });
      }
      doc.preset = parsed.data.preset;
      doc.permissions = perms;
    }

    if (parsed.data.expiresAt !== undefined) {
      if (parsed.data.expiresAt === null) {
        doc.expiresAt = null;
      } else {
        const d = new Date(parsed.data.expiresAt);
        if (d.getTime() <= Date.now()) {
          return NextResponse.json({ success: false, error: "Expiry must be in the future" }, { status: 400 });
        }
        doc.expiresAt = d;
      }
    }

    if (parsed.data.note !== undefined) {
      doc.grantNote = parsed.data.note?.trim() || null;
    }

    await doc.save();

    invalidateMergedDelegationCacheForUser(schoolId, doc.staffUserId);

    const accessChanged =
      before.preset !== doc.preset ||
      (before.expiresAt?.getTime() ?? null) !== (doc.expiresAt?.getTime() ?? null);
    if (accessChanged) {
      const school = await School.findById(schoolId).select({ name: 1 }).lean<{ name?: string } | null>();
      void notifyDelegateAccessUpdated({
        schoolId,
        staffUserId: doc.staffUserId,
        module: doc.module as DelegationModule,
        preset: doc.preset,
        expiresAt: doc.expiresAt ?? null,
        schoolName: school?.name,
      });
    }

    await recordActivity({
      schoolId,
      userId: adminUserId,
      type: "delegation.updated",
      entityType: "Delegation",
      entityId: doc._id,
      description: "Delegation updated",
      actorRole: "admin",
      metadata: {
        staffUserId: String(doc.staffUserId),
        before,
        after: { preset: doc.preset, expiresAt: doc.expiresAt, permissions: doc.permissions },
      },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ success: false, error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ delegationId: string }> }
) {
  try {
    const adminCtx = await requireSchoolAdmin();
    await connectToDatabase();
    const { delegationId } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(delegationId)) {
      return NextResponse.json({ success: false, error: "Invalid id" }, { status: 400 });
    }
    const schoolId = oid(String(adminCtx.schoolId));
    const adminUserId = oid(String(adminCtx.userId));

    let reason: string | null = null;
    try {
      const body = await req.json();
      const parsed = RevokeDelegationBodySchema.safeParse(body);
      if (parsed.success) reason = parsed.data.reason?.trim() ?? null;
    } catch {
      /* empty body ok */
    }

    const doc = await Delegation.findOne({
      _id: oid(delegationId),
      schoolId,
    });
    if (!doc) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
    if (doc.status !== "active") {
      return NextResponse.json({ success: true });
    }

    const staffUserId = doc.staffUserId;
    const delegationModule = doc.module as DelegationModule;

    doc.status = "revoked";
    doc.revokedAt = new Date();
    doc.revokedByUserId = adminUserId;
    doc.revokeReason = reason;
    await doc.save();

    const school = await School.findById(schoolId).select({ name: 1 }).lean<{ name?: string } | null>();
    void notifyDelegateAccessRevoked({
      schoolId,
      staffUserId,
      module: delegationModule,
      schoolName: school?.name,
    });

    invalidateMergedDelegationCacheForUser(schoolId, staffUserId);

    await recordActivity({
      schoolId,
      userId: adminUserId,
      type: "delegation.revoked",
      entityType: "Delegation",
      entityId: doc._id,
      description: "Delegation revoked",
      actorRole: "admin",
      metadata: { module: delegationModule, staffUserId: String(doc.staffUserId), reason },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ success: false, error: "Failed to revoke" }, { status: 500 });
  }
}
