import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { getSchoolLearnEligibility } from "@/lib/learn/eligibility";
import { getOrCreateLearnPlatformSettings } from "@/lib/learn/platform-settings";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { Guardian } from "@/models/Guardian";
import { LearnAccess } from "@/models/LearnAccess";
import { LearnStudentAccount } from "@/models/LearnStudentAccount";
import { Notification } from "@/models/Notification";
import { PlatformAuditLog } from "@/models/PlatformAuditLog";
import { School } from "@/models/School";
import { Student } from "@/models/Student";

const GiftSchema = z.object({
  studentId: z.string().min(1),
  note: z.string().trim().max(500).optional(),
});

type StudentRow = {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  status?: string | null;
};

type AccountRow = {
  _id: Types.ObjectId;
  status: string;
};

type PeriodRow = {
  _id: Types.ObjectId;
  endDate: Date;
};

type GuardianRow = {
  userId: Types.ObjectId;
};

function fullName(student: StudentRow) {
  return [student.firstName, student.middleName, student.lastName]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function GET() {
  try {
    const gate = await requirePlatformPermission("platform.learn.read");
    if (!gate.ok) return gate.res;
    await connectToDatabase();

    const accesses = await LearnAccess.find({ source: "platform_gift" })
      .sort({ createdAt: -1 })
      .limit(100)
      .select("_id schoolId studentId status startsAt expiresAt note grantedBy revokedAt revokeReason")
      .lean();
    const schoolIds = Array.from(new Set(accesses.map((access) => String(access.schoolId))));
    const studentIds = Array.from(new Set(accesses.map((access) => String(access.studentId))));
    const [schools, students] = await Promise.all([
      School.find({ _id: { $in: schoolIds } }).select("_id name").lean(),
      Student.find({ _id: { $in: studentIds } })
        .select("_id firstName middleName lastName")
        .lean<StudentRow[]>(),
    ]);
    const schoolMap = new Map(schools.map((school) => [String(school._id), school.name]));
    const studentMap = new Map(students.map((student) => [String(student._id), fullName(student)]));

    return NextResponse.json({
      success: true,
      data: {
        gifts: accesses.map((access) => ({
          id: String(access._id),
          schoolId: String(access.schoolId),
          schoolName: schoolMap.get(String(access.schoolId)) || "School",
          studentId: String(access.studentId),
          studentName: studentMap.get(String(access.studentId)) || "Student",
          status: access.status,
          startsAt: access.startsAt?.toISOString?.() || null,
          expiresAt: access.expiresAt?.toISOString?.() || null,
          note: access.note || null,
          revokedAt: access.revokedAt?.toISOString?.() || null,
          revokeReason: access.revokeReason || null,
        })),
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("[platform/learn/gifts:GET]", error);
    return NextResponse.json(
      { success: false, error: "Failed to load Learn gifts." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const gate = await requirePlatformPermission("platform.learn.giftAccess");
    if (!gate.ok) return gate.res;
    await connectToDatabase();

    const parsed = GiftSchema.safeParse(await req.json());
    if (!parsed.success || !Types.ObjectId.isValid(parsed.data.studentId)) {
      return NextResponse.json(
        { success: false, error: "Invalid Learn gift payload." },
        { status: 400 }
      );
    }

    const studentId = new Types.ObjectId(parsed.data.studentId);
    const student = await Student.findById(studentId)
      .select("_id schoolId firstName middleName lastName status")
      .lean<StudentRow | null>();
    if (!student) {
      return NextResponse.json(
        { success: false, error: "Student not found." },
        { status: 404 }
      );
    }

    const [settings, eligibility, account, currentPeriod] = await Promise.all([
      getOrCreateLearnPlatformSettings(gate.actor.userId),
      getSchoolLearnEligibility(student.schoolId),
      LearnStudentAccount.findOne({ schoolId: student.schoolId, studentId })
        .select("_id status")
        .lean<AccountRow | null>(),
      AcademicPeriod.findOne({ schoolId: student.schoolId, isCurrent: true })
        .select("_id endDate")
        .lean<PeriodRow | null>(),
    ]);

    if (!settings.allowPlatformGifts) {
      return NextResponse.json(
        { success: false, error: "Platform Learn gifts are disabled." },
        { status: 409 }
      );
    }
    if (!eligibility.eligible) {
      return NextResponse.json(
        { success: false, error: eligibility.reason || "School is not eligible." },
        { status: 409 }
      );
    }
    if (student.status !== "active") {
      return NextResponse.json(
        { success: false, error: "Only active students can receive gifted Learn access." },
        { status: 409 }
      );
    }
    if (!account || account.status === "disabled") {
      return NextResponse.json(
        { success: false, error: "Create a Learn student account before gifting access." },
        { status: 409 }
      );
    }

    const now = new Date();
    const existing = await LearnAccess.findOne({
      schoolId: student.schoolId,
      studentId,
      status: "active",
      expiresAt: { $gt: now },
    })
      .select("_id")
      .lean<{ _id: Types.ObjectId } | null>();
    if (existing) {
      return NextResponse.json(
        { success: false, error: "This student already has active Learn access." },
        { status: 409 }
      );
    }

    const fallbackExpiry = new Date(now);
    fallbackExpiry.setDate(fallbackExpiry.getDate() + 120);
    const access = await LearnAccess.create({
      schoolId: student.schoolId,
      studentId,
      accountId: account._id,
      academicPeriodId: currentPeriod?._id || null,
      source: "platform_gift",
      status: "active",
      startsAt: now,
      expiresAt:
        currentPeriod?.endDate && currentPeriod.endDate > now
          ? currentPeriod.endDate
          : fallbackExpiry,
      grantedBy: gate.actor.userId,
      note: parsed.data.note || null,
    });

    const guardians = await Guardian.find({ studentId })
      .select("userId")
      .lean<GuardianRow[]>();
    const guardianUserIds = Array.from(
      new Set(guardians.map((guardian) => String(guardian.userId)).filter(Boolean))
    );
    const studentName = fullName(student) || "A linked ward";

    await Promise.all([
      PlatformAuditLog.create({
        actorId: gate.actor.userId,
        action: "platform.learn.gift_created",
        entityType: "LearnAccess",
        entityId: access._id,
        metadata: {
          schoolId: String(student.schoolId),
          studentId: String(student._id),
          studentName,
          guardiansNotified: guardianUserIds.length,
        },
      }),
      guardianUserIds.length
        ? Notification.insertMany(
            guardianUserIds.map((userId) => ({
              schoolId: student.schoolId,
              userId: new Types.ObjectId(userId),
              type: "system",
              title: "EduSentrix Learn access gifted",
              body: `${studentName} has been gifted EduSentrix Learn access.`,
              isRead: false,
              priority: "normal",
              wardId: student._id,
              entityType: "LearnAccess",
              entityId: access._id,
              actionUrl: `/parent/learn/wards/${student._id}`,
              metadata: {
                source: "platform_gift",
                accessId: String(access._id),
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
        studentId: String(student._id),
        schoolId: String(student.schoolId),
        status: access.status,
        expiresAt: access.expiresAt.toISOString(),
        guardiansNotified: guardianUserIds.length,
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("[platform/learn/gifts:POST]", error);
    return NextResponse.json(
      { success: false, error: "Failed to gift Learn access." },
      { status: 500 }
    );
  }
}
