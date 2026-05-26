import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { AuditEvent } from "@/models/AuditEvent";
import { LearnAccess } from "@/models/LearnAccess";
import { LearnStudentAccount } from "@/models/LearnStudentAccount";

const UpdateSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("disable"),
    reason: z.string().trim().min(1).max(500),
  }),
  z.object({
    action: z.literal("enable"),
  }),
]);

type AccountRow = {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  studentId: Types.ObjectId;
  status: string;
};

async function auditAccountStatus(input: {
  schoolId: Types.ObjectId;
  actorUserId: Types.ObjectId;
  accountId: Types.ObjectId;
  studentId: Types.ObjectId;
  actionCode: string;
  beforeStatus: string;
  afterStatus: string;
  reason?: string | null;
  revokedAccessCount?: number;
}) {
  await AuditEvent.create({
    scopeType: "school",
    scopeId: input.schoolId,
    domain: "identity",
    tier: 1,
    actionCode: input.actionCode,
    result: "succeeded",
    occurredAt: new Date(),
    actorType: "user",
    actorId: input.actorUserId,
    targetEntityType: "LearnStudentAccount",
    targetEntityId: input.accountId,
    secondaryEntityType: "Student",
    secondaryEntityId: input.studentId,
    before: { status: input.beforeStatus },
    after: { status: input.afterStatus },
    changedFields: ["status"],
    reason: input.reason || null,
    metadata: {
      revokedAccessCount: input.revokedAccessCount || 0,
    },
    sensitivity: "high",
    redactionMode: "hidden",
    retentionClass: "identity_and_permissions",
  });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ accountId: string }> }
) {
  try {
    const admin = await requireSchoolAdmin();
    const { accountId } = await ctx.params;
    if (!Types.ObjectId.isValid(accountId)) {
      return NextResponse.json(
        { success: false, error: "Invalid account id." },
        { status: 400 }
      );
    }

    const parsed = UpdateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid Learn account update payload." },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const account = await LearnStudentAccount.findOne({
      _id: new Types.ObjectId(accountId),
      schoolId: admin.schoolId,
    })
      .select("_id schoolId studentId status")
      .lean<AccountRow | null>();

    if (!account) {
      return NextResponse.json(
        { success: false, error: "Learn account not found." },
        { status: 404 }
      );
    }

    if (parsed.data.action === "disable") {
      const now = new Date();
      await LearnStudentAccount.updateOne(
        { _id: account._id, schoolId: admin.schoolId },
        {
          $set: {
            status: "disabled",
            disabledAt: now,
            disabledBy: admin.userId,
            disabledReason: parsed.data.reason,
          },
        }
      );
      const accessUpdate = await LearnAccess.updateMany(
        {
          schoolId: admin.schoolId,
          accountId: account._id,
          status: "active",
        },
        {
          $set: {
            status: "revoked",
            revokedAt: now,
            revokedBy: admin.userId,
            revokeReason: `Account disabled: ${parsed.data.reason}`,
          },
        }
      );
      await auditAccountStatus({
        schoolId: admin.schoolId,
        actorUserId: admin.userId,
        accountId: account._id,
        studentId: account.studentId,
        actionCode: "learn.account.disabled",
        beforeStatus: account.status,
        afterStatus: "disabled",
        reason: parsed.data.reason,
        revokedAccessCount: accessUpdate.modifiedCount,
      });
      return NextResponse.json({
        success: true,
        data: { id: String(account._id), status: "disabled" },
      });
    }

    await LearnStudentAccount.updateOne(
      { _id: account._id, schoolId: admin.schoolId },
      {
        $set: {
          status: "pending_first_login",
          disabledAt: null,
          disabledBy: null,
          disabledReason: null,
          mustChangePassword: true,
        },
      }
    );
    await auditAccountStatus({
      schoolId: admin.schoolId,
      actorUserId: admin.userId,
      accountId: account._id,
      studentId: account.studentId,
      actionCode: "learn.account.enabled",
      beforeStatus: account.status,
      afterStatus: "pending_first_login",
    });

    return NextResponse.json({
      success: true,
      data: { id: String(account._id), status: "pending_first_login" },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("[admin/learn/accounts/[accountId]:PATCH]", error);
    return NextResponse.json(
      { success: false, error: "Failed to update Learn account." },
      { status: 500 }
    );
  }
}
