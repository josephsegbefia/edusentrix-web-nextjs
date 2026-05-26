import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent, verifyGuardianAccess } from "@/lib/auth/requireParent";
import { AuditEvent } from "@/models/AuditEvent";
import { LearnStudentAccount } from "@/models/LearnStudentAccount";
import { Notification } from "@/models/Notification";
import { UserMembership } from "@/models/UserMembership";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ studentId: string }> }
) {
  try {
    const parent = await requireParent();
    const { studentId } = await ctx.params;
    if (!Types.ObjectId.isValid(studentId)) {
      return NextResponse.json(
        { success: false, error: "Invalid student id." },
        { status: 400 }
      );
    }
    await connectToDatabase();
    await verifyGuardianAccess(parent.userId, studentId);

    const studentIdObj = new Types.ObjectId(studentId);
    const account = await LearnStudentAccount.findOne({
      schoolId: parent.schoolId,
      studentId: studentIdObj,
    })
      .select("_id username")
      .lean<{ _id: Types.ObjectId; username: string } | null>();
    if (!account) {
      return NextResponse.json(
        { success: false, error: "Learn account not found for this ward." },
        { status: 404 }
      );
    }

    const admins = await UserMembership.find({
      schoolId: parent.schoolId,
      status: "active",
      roles: "school_admin",
    })
      .select("userId")
      .lean<Array<{ userId: Types.ObjectId }>>();

    if (admins.length) {
      await Notification.insertMany(
        admins.map((admin) => ({
          schoolId: parent.schoolId,
          userId: admin.userId,
          type: "system",
          title: "Learn password reset requested",
          body: "A parent requested an EduSentrix Learn password reset for a linked ward.",
          priority: "normal",
          isRead: false,
          wardId: studentIdObj,
          entityType: "LearnStudentAccount",
          entityId: account._id,
          actionUrl: "/admin/learn/accounts",
          metadata: {
            requestedByUserId: String(parent.userId),
            username: account.username,
          },
        }))
      );
    }

    await AuditEvent.create({
      scopeType: "school",
      scopeId: parent.schoolId,
      domain: "identity",
      tier: 1,
      actionCode: "learn.account.password_reset_requested",
      result: "succeeded",
      occurredAt: new Date(),
      actorType: "user",
      actorId: parent.userId,
      targetEntityType: "LearnStudentAccount",
      targetEntityId: account._id,
      secondaryEntityType: "Student",
      secondaryEntityId: studentIdObj,
      metadata: { notifiedAdmins: admins.length },
      sensitivity: "high",
      redactionMode: "hidden",
      retentionClass: "identity_and_permissions",
    });

    return NextResponse.json({
      success: true,
      data: { requested: true, notifiedAdmins: admins.length },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("[parent/learn/request-password-reset:POST]", error);
    return NextResponse.json(
      { success: false, error: "Failed to request Learn password reset." },
      { status: 500 }
    );
  }
}
