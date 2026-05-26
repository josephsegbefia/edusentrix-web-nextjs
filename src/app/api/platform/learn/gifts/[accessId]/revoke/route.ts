import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { Guardian } from "@/models/Guardian";
import { LearnAccess } from "@/models/LearnAccess";
import { Notification } from "@/models/Notification";
import { PlatformAuditLog } from "@/models/PlatformAuditLog";

const BodySchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

type GuardianRow = {
  userId: Types.ObjectId;
};

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ accessId: string }> }
) {
  try {
    const gate = await requirePlatformPermission("platform.learn.giftAccess");
    if (!gate.ok) return gate.res;
    await connectToDatabase();

    const { accessId } = await ctx.params;
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success || !Types.ObjectId.isValid(accessId)) {
      return NextResponse.json(
        { success: false, error: "Invalid revoke payload." },
        { status: 400 }
      );
    }

    const access = await LearnAccess.findOneAndUpdate(
      {
        _id: new Types.ObjectId(accessId),
        source: "platform_gift",
        status: "active",
      },
      {
        $set: {
          status: "revoked",
          revokedAt: new Date(),
          revokedBy: gate.actor.userId,
          revokeReason: parsed.data.reason,
        },
      },
      { new: true }
    );

    if (!access) {
      return NextResponse.json(
        { success: false, error: "Active Learn gift not found." },
        { status: 404 }
      );
    }

    const guardians = await Guardian.find({ studentId: access.studentId })
      .select("userId")
      .lean<GuardianRow[]>();
    const guardianUserIds = Array.from(
      new Set(guardians.map((guardian) => String(guardian.userId)).filter(Boolean))
    );

    await Promise.all([
      PlatformAuditLog.create({
        actorId: gate.actor.userId,
        action: "platform.learn.gift_revoked",
        entityType: "LearnAccess",
        entityId: access._id,
        metadata: {
          schoolId: String(access.schoolId),
          studentId: String(access.studentId),
          reason: parsed.data.reason,
          guardiansNotified: guardianUserIds.length,
        },
      }),
      guardianUserIds.length
        ? Notification.insertMany(
            guardianUserIds.map((userId) => ({
              schoolId: access.schoolId,
              userId: new Types.ObjectId(userId),
              type: "system",
              title: "EduSentrix Learn gifted access revoked",
              body: "Gifted EduSentrix Learn access for a linked ward was revoked.",
              isRead: false,
              priority: "normal",
              wardId: access.studentId,
              entityType: "LearnAccess",
              entityId: access._id,
              actionUrl: `/parent/learn/wards/${access.studentId}`,
              metadata: {
                source: "platform_gift",
                accessId: String(access._id),
                reason: parsed.data.reason,
              },
            })),
            { ordered: false }
          )
        : Promise.resolve(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        id: String(access._id),
        status: access.status,
        revokedAt: access.revokedAt?.toISOString?.() || null,
        guardiansNotified: guardianUserIds.length,
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("[platform/learn/gifts/[accessId]/revoke:POST]", error);
    return NextResponse.json(
      { success: false, error: "Failed to revoke Learn gift." },
      { status: 500 }
    );
  }
}
