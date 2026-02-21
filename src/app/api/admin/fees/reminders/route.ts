import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { randomUUID } from "crypto";
import { z } from "zod";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Invoice } from "@/models/Invoice";
import { Student } from "@/models/Student";
import { Guardian } from "@/models/Guardian";
import { User } from "@/models/User";
import { ClassGroup } from "@/models/ClassGroup";
import { School } from "@/models/School";
import { SchoolSettings } from "@/models/SchoolSettings";
import {
  dispatchFeeReminder,
  type FeeReminderChannel,
} from "@/lib/notifications/fee-reminders";
import { getWhatsAppProviderState } from "@/lib/notifications/whatsapp";
import { recordActivity } from "@/lib/audit/recordActivity";
import { getAppUrl } from "@/lib/utils/getAppUrl";

const OUTSTANDING_STATUSES = ["issued", "partially_paid", "overdue"] as const;
const MAX_RECIPIENT_CAP = 500;
const DEFAULT_MAX_RECIPIENTS = 200;

const FilterSchema = z.object({
  classGroupId: z.string().optional(),
  onlyPrimaryGuardian: z.boolean().optional(),
  maxRecipients: z.number().int().min(1).max(MAX_RECIPIENT_CAP).optional(),
});

const SendReminderSchema = z.object({
  channel: z.enum(["email", "sms", "whatsapp"]),
  subject: z.string().trim().max(160).optional(),
  message: z.string().trim().max(1200).optional(),
  filter: FilterSchema.optional(),
});

type ReminderRecipientStudent = {
  studentId: string;
  studentName: string;
  classGroupName: string | null;
  outstandingMinor: number;
  overdueInvoiceCount: number;
};

type ReminderRecipient = {
  userId: string;
  guardianName: string;
  email: string | null;
  phone: string | null;
  totalOutstandingMinor: number;
  overdueInvoiceCount: number;
  students: ReminderRecipientStudent[];
};

function toObjectIdOrNull(value?: string | null) {
  if (!value) return null;
  if (!mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

function parseBoolean(value: string | null, fallback: boolean) {
  if (value === null) return fallback;
  return value === "true";
}

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, MAX_RECIPIENT_CAP);
}

function buildGuardianName(input: {
  userFirstName?: string | null;
  userLastName?: string | null;
  userName?: string | null;
  fallbackEmail?: string | null;
}) {
  const fromSplit = [input.userFirstName, input.userLastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (fromSplit) return fromSplit;
  if (input.userName?.trim()) return input.userName.trim();
  return input.fallbackEmail || "Guardian";
}

function getChannelContact(recipient: ReminderRecipient, channel: FeeReminderChannel) {
  if (channel === "email") return recipient.email;
  return recipient.phone;
}

async function getChannelCapabilities(schoolId: mongoose.Types.ObjectId) {
  const [schoolSettingsRaw] = await Promise.all([
    SchoolSettings.findOne({ schoolId })
      .select("attendanceNotifications")
      .lean(),
  ]);

  const schoolSettings = Array.isArray(schoolSettingsRaw)
    ? schoolSettingsRaw[0]
    : schoolSettingsRaw;
  const channels =
    (schoolSettings as
      | {
          attendanceNotifications?: {
            enabled?: boolean;
            channels?: { whatsapp?: boolean; sms?: boolean; email?: boolean };
          };
        }
      | null
      | undefined)?.attendanceNotifications?.channels || {};

  const attendanceChannelEnabled =
    (schoolSettings as { attendanceNotifications?: { enabled?: boolean } } | null)
      ?.attendanceNotifications?.enabled ?? true;

  const emailReady = Boolean(
    process.env.BREVO_API_KEY && process.env.BREVO_FROM_EMAIL && process.env.BREVO_FROM_NAME
  );
  const whatsappState = getWhatsAppProviderState();

  return {
    email: {
      enabled: true,
      ready: emailReady,
      message: emailReady
        ? "Brevo email channel is configured."
        : "Brevo email channel is not fully configured.",
    },
    sms: {
      enabled: attendanceChannelEnabled && (channels.sms ?? false),
      ready: false,
      message: "SMS provider is not configured yet.",
    },
    whatsapp: {
      enabled: attendanceChannelEnabled && (channels.whatsapp ?? true),
      ready: whatsappState.canSend,
      message: whatsappState.message,
    },
  };
}

async function buildReminderAudience(params: {
  schoolId: mongoose.Types.ObjectId;
  classGroupId: mongoose.Types.ObjectId | null;
  onlyPrimaryGuardian: boolean;
  maxRecipients: number;
}) {
  const invoiceMatch: Record<string, unknown> = {
    schoolId: params.schoolId,
    totalOutstandingMinor: { $gt: 0 },
    status: { $in: OUTSTANDING_STATUSES },
  };

  const invoiceByStudent = await Invoice.aggregate<{
    _id: mongoose.Types.ObjectId;
    totalOutstandingMinor: number;
    overdueInvoiceCount: number;
  }>([
    { $match: invoiceMatch },
    {
      $group: {
        _id: "$studentId",
        totalOutstandingMinor: { $sum: "$totalOutstandingMinor" },
        overdueInvoiceCount: {
          $sum: { $cond: [{ $eq: ["$status", "overdue"] }, 1, 0] },
        },
      },
    },
  ]);

  if (invoiceByStudent.length === 0) {
    return {
      recipients: [] as ReminderRecipient[],
      totalPotentialRecipients: 0,
      truncated: false,
    };
  }

  const studentIds = invoiceByStudent.map((row) => row._id);
  const studentQuery: Record<string, unknown> = {
    _id: { $in: studentIds },
    schoolId: params.schoolId,
  };
  if (params.classGroupId) {
    studentQuery.classGroupId = params.classGroupId;
  }

  const students = await Student.find(studentQuery)
    .select("firstName middleName lastName classGroupId")
    .lean();

  if (students.length === 0) {
    return {
      recipients: [] as ReminderRecipient[],
      totalPotentialRecipients: 0,
      truncated: false,
    };
  }

  const classGroupIds = Array.from(
    new Set(
      students
        .map((student) => student.classGroupId)
        .filter(
          (classGroupId): classGroupId is mongoose.Types.ObjectId => Boolean(classGroupId)
        )
        .map((classGroupId) => String(classGroupId))
    )
  ).map((id) => new mongoose.Types.ObjectId(id));

  const [classGroups, guardians] = await Promise.all([
    classGroupIds.length > 0
      ? ClassGroup.find({ _id: { $in: classGroupIds } }).select("name").lean()
      : Promise.resolve([]),
    Guardian.find({
      studentId: { $in: students.map((student) => student._id) },
      ...(params.onlyPrimaryGuardian ? { isPrimary: true } : {}),
    })
      .select("studentId userId email phone")
      .lean(),
  ]);

  if (guardians.length === 0) {
    return {
      recipients: [] as ReminderRecipient[],
      totalPotentialRecipients: 0,
      truncated: false,
    };
  }

  const userIds = Array.from(
    new Set(
      guardians
        .map((guardian) => guardian.userId)
        .filter((userId): userId is mongoose.Types.ObjectId => Boolean(userId))
        .map((userId) => String(userId))
    )
  ).map((id) => new mongoose.Types.ObjectId(id));

  const users = await User.find({ _id: { $in: userIds } })
    .select("firstName lastName name email phone")
    .lean();

  const classGroupMap = new Map(
    classGroups.map((group) => [String(group._id), group.name || null])
  );
  const studentOutstandingMap = new Map(
    invoiceByStudent.map((row) => [
      String(row._id),
      {
        totalOutstandingMinor: row.totalOutstandingMinor || 0,
        overdueInvoiceCount: row.overdueInvoiceCount || 0,
      },
    ])
  );
  const studentMap = new Map(
    students.map((student) => [
      String(student._id),
      {
        studentName: [student.firstName, student.middleName, student.lastName]
          .filter(Boolean)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim(),
        classGroupName: classGroupMap.get(String(student.classGroupId || "")) || null,
      },
    ])
  );
  const userMap = new Map(users.map((user) => [String(user._id), user]));

  const recipientsByUser = new Map<string, ReminderRecipient>();
  const seenWardPerUser = new Set<string>();

  for (const guardian of guardians) {
    const userId = guardian.userId ? String(guardian.userId) : null;
    if (!userId) continue;

    const wardKey = `${userId}:${String(guardian.studentId)}`;
    if (seenWardPerUser.has(wardKey)) continue;
    seenWardPerUser.add(wardKey);

    const studentDetails = studentMap.get(String(guardian.studentId));
    const outstanding = studentOutstandingMap.get(String(guardian.studentId));
    if (!studentDetails || !outstanding) continue;

    const user = userMap.get(userId);
    const guardianName = buildGuardianName({
      userFirstName: user?.firstName || null,
      userLastName: user?.lastName || null,
      userName: user?.name || null,
      fallbackEmail: user?.email || guardian.email || null,
    });

    const existing = recipientsByUser.get(userId);
    if (!existing) {
      recipientsByUser.set(userId, {
        userId,
        guardianName,
        email: user?.email || guardian.email || null,
        phone: user?.phone || guardian.phone || null,
        totalOutstandingMinor: outstanding.totalOutstandingMinor,
        overdueInvoiceCount: outstanding.overdueInvoiceCount,
        students: [
          {
            studentId: String(guardian.studentId),
            studentName: studentDetails.studentName,
            classGroupName: studentDetails.classGroupName,
            outstandingMinor: outstanding.totalOutstandingMinor,
            overdueInvoiceCount: outstanding.overdueInvoiceCount,
          },
        ],
      });
      continue;
    }

    existing.totalOutstandingMinor += outstanding.totalOutstandingMinor;
    existing.overdueInvoiceCount += outstanding.overdueInvoiceCount;
    existing.students.push({
      studentId: String(guardian.studentId),
      studentName: studentDetails.studentName,
      classGroupName: studentDetails.classGroupName,
      outstandingMinor: outstanding.totalOutstandingMinor,
      overdueInvoiceCount: outstanding.overdueInvoiceCount,
    });
  }

  const recipients = Array.from(recipientsByUser.values()).sort(
    (a, b) => b.totalOutstandingMinor - a.totalOutstandingMinor
  );
  const totalPotentialRecipients = recipients.length;
  const limitedRecipients = recipients.slice(0, params.maxRecipients);

  return {
    recipients: limitedRecipients,
    totalPotentialRecipients,
    truncated: totalPotentialRecipients > limitedRecipients.length,
  };
}

function summarizeAudience(params: {
  recipients: ReminderRecipient[];
  channel: FeeReminderChannel;
  truncated: boolean;
  totalPotentialRecipients: number;
}) {
  const recipientCount = params.recipients.length;
  const studentCount = params.recipients.reduce(
    (sum, recipient) => sum + recipient.students.length,
    0
  );
  const totalOutstandingMinor = params.recipients.reduce(
    (sum, recipient) => sum + recipient.totalOutstandingMinor,
    0
  );
  const overdueInvoiceCount = params.recipients.reduce(
    (sum, recipient) => sum + recipient.overdueInvoiceCount,
    0
  );
  const deliverableCount = params.recipients.filter((recipient) =>
    Boolean(getChannelContact(recipient, params.channel))
  ).length;

  return {
    recipientCount,
    studentCount,
    totalOutstandingMinor,
    overdueInvoiceCount,
    deliverableCount,
    truncated: params.truncated,
    totalPotentialRecipients: params.totalPotentialRecipients,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireFinanceStaff();
    await connectToDatabase();

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const query = req.nextUrl.searchParams;
    const parsedChannel = z
      .enum(["email", "sms", "whatsapp"])
      .safeParse(query.get("channel") || "email");

    const channel: FeeReminderChannel = parsedChannel.success
      ? parsedChannel.data
      : "email";

    const classGroupId = toObjectIdOrNull(query.get("classGroupId"));
    const filter = {
      onlyPrimaryGuardian: parseBoolean(query.get("onlyPrimaryGuardian"), false),
      classGroupId,
      maxRecipients: parsePositiveInt(query.get("maxRecipients"), DEFAULT_MAX_RECIPIENTS),
    };

    const [capabilities, audience] = await Promise.all([
      getChannelCapabilities(schoolIdObj),
      buildReminderAudience({
        schoolId: schoolIdObj,
        classGroupId: filter.classGroupId,
        onlyPrimaryGuardian: filter.onlyPrimaryGuardian,
        maxRecipients: filter.maxRecipients,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        channel,
        capabilities,
        filters: {
          onlyPrimaryGuardian: filter.onlyPrimaryGuardian,
          classGroupId: filter.classGroupId ? String(filter.classGroupId) : null,
          maxRecipients: filter.maxRecipients,
        },
        summary: summarizeAudience({
          recipients: audience.recipients,
          channel,
          truncated: audience.truncated,
          totalPotentialRecipients: audience.totalPotentialRecipients,
        }),
        recipients: audience.recipients.map((recipient) => ({
          userId: recipient.userId,
          guardianName: recipient.guardianName,
          email: recipient.email,
          phone: recipient.phone,
          totalOutstandingMinor: recipient.totalOutstandingMinor,
          overdueInvoiceCount: recipient.overdueInvoiceCount,
          studentCount: recipient.students.length,
          students: recipient.students,
        })),
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Failed to preview fee reminders:", error);
    return NextResponse.json(
      { success: false, error: "Failed to preview fee reminders" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { schoolId, userId } = await requireFinanceStaff();
    await connectToDatabase();

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const parsed = SendReminderSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          issues: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const body = parsed.data;
    const classGroupId = toObjectIdOrNull(body.filter?.classGroupId || null);
    if (body.filter?.classGroupId && !classGroupId) {
      return NextResponse.json(
        { success: false, error: "Invalid class group filter" },
        { status: 400 }
      );
    }

    const filter = {
      onlyPrimaryGuardian: body.filter?.onlyPrimaryGuardian ?? false,
      classGroupId,
      maxRecipients: body.filter?.maxRecipients ?? DEFAULT_MAX_RECIPIENTS,
    };

    const [capabilities, audience, schoolRaw] = await Promise.all([
      getChannelCapabilities(schoolIdObj),
      buildReminderAudience({
        schoolId: schoolIdObj,
        classGroupId: filter.classGroupId,
        onlyPrimaryGuardian: filter.onlyPrimaryGuardian,
        maxRecipients: filter.maxRecipients,
      }),
      School.findById(schoolIdObj).select("name").lean(),
    ]);

    const school = Array.isArray(schoolRaw) ? schoolRaw[0] : schoolRaw;
    const schoolName = school?.name || "Your School";

    const selectedCapability =
      body.channel === "email"
        ? capabilities.email
        : body.channel === "sms"
        ? capabilities.sms
        : capabilities.whatsapp;

    if (!selectedCapability.enabled) {
      return NextResponse.json(
        {
          success: false,
          error: `${body.channel.toUpperCase()} reminders are disabled by school policy.`,
          code: "channel_disabled",
          capabilities,
        },
        { status: 400 }
      );
    }

    if (!selectedCapability.ready) {
      return NextResponse.json(
        {
          success: false,
          error: selectedCapability.message,
          code: `${body.channel}_channel_not_ready`,
          capabilities,
        },
        { status: body.channel === "sms" ? 501 : 400 }
      );
    }

    const recipients = audience.recipients;
    const runId = randomUUID();
    if (recipients.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          runId,
          channel: body.channel,
          summary: {
            attempted: 0,
            sent: 0,
            failed: 0,
            skipped: 0,
            totalOutstandingMinor: 0,
          },
          deliveries: [],
          failures: [],
          capabilities,
          message: "No recipients matched your reminder filters.",
        },
      });
    }

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const failures: Array<{ recipient: string; reason: string }> = [];
    const deliveries: Array<{
      recipientUserId: string;
      guardianName: string;
      contact: string | null;
      status: "sent" | "failed" | "skipped";
      reason?: string;
      totalOutstandingMinor: number;
      students: Array<{
        studentId: string;
        studentName: string;
        classGroupName: string | null;
        outstandingMinor: number;
      }>;
    }> = [];
    const appUrl = getAppUrl();

    const chunks: ReminderRecipient[][] = [];
    const concurrency = 5;
    for (let index = 0; index < recipients.length; index += concurrency) {
      chunks.push(recipients.slice(index, index + concurrency));
    }

    for (const chunk of chunks) {
      await Promise.all(
        chunk.map(async (recipient) => {
          const contact = getChannelContact(recipient, body.channel);
          if (!contact) {
            skipped += 1;
            const reason =
              body.channel === "email"
                ? "Missing guardian email"
                : "Missing guardian phone";
            deliveries.push({
              recipientUserId: recipient.userId,
              guardianName: recipient.guardianName,
              contact,
              status: "skipped",
              reason,
              totalOutstandingMinor: recipient.totalOutstandingMinor,
              students: recipient.students.map((student) => ({
                studentId: student.studentId,
                studentName: student.studentName,
                classGroupName: student.classGroupName,
                outstandingMinor: student.outstandingMinor,
              })),
            });
            if (failures.length < 20) {
              failures.push({
                recipient: recipient.guardianName,
                reason,
              });
            }
            return;
          }

          try {
            const dispatchResult = await dispatchFeeReminder({
              channel: body.channel,
              email: recipient.email,
              phone: recipient.phone,
              emailPayload: {
                schoolName,
                guardianName: recipient.guardianName,
                totalOutstandingMinor: recipient.totalOutstandingMinor,
                wards: recipient.students.map((student) => ({
                  studentName: student.studentName,
                  classGroupName: student.classGroupName || undefined,
                  outstandingMinor: student.outstandingMinor,
                  overdueInvoiceCount: student.overdueInvoiceCount,
                })),
                customMessage: body.message,
                actionLink: `${appUrl}/parent/fees`,
                subjectOverride: body.subject,
              },
            });

            if (dispatchResult.success) {
              sent += 1;
              deliveries.push({
                recipientUserId: recipient.userId,
                guardianName: recipient.guardianName,
                contact,
                status: "sent",
                totalOutstandingMinor: recipient.totalOutstandingMinor,
                students: recipient.students.map((student) => ({
                  studentId: student.studentId,
                  studentName: student.studentName,
                  classGroupName: student.classGroupName,
                  outstandingMinor: student.outstandingMinor,
                })),
              });
              return;
            }

            failed += 1;
            const reason = dispatchResult.reason || "Delivery failed";
            deliveries.push({
              recipientUserId: recipient.userId,
              guardianName: recipient.guardianName,
              contact,
              status: "failed",
              reason,
              totalOutstandingMinor: recipient.totalOutstandingMinor,
              students: recipient.students.map((student) => ({
                studentId: student.studentId,
                studentName: student.studentName,
                classGroupName: student.classGroupName,
                outstandingMinor: student.outstandingMinor,
              })),
            });
            if (failures.length < 20) {
              failures.push({
                recipient: recipient.guardianName,
                reason,
              });
            }
          } catch (dispatchError) {
            failed += 1;
            const reason =
              dispatchError instanceof Error
                ? dispatchError.message
                : "Delivery failed";
            deliveries.push({
              recipientUserId: recipient.userId,
              guardianName: recipient.guardianName,
              contact,
              status: "failed",
              reason,
              totalOutstandingMinor: recipient.totalOutstandingMinor,
              students: recipient.students.map((student) => ({
                studentId: student.studentId,
                studentName: student.studentName,
                classGroupName: student.classGroupName,
                outstandingMinor: student.outstandingMinor,
              })),
            });
            if (failures.length < 20) {
              failures.push({
                recipient: recipient.guardianName,
                reason,
              });
            }
          }
        })
      );
    }

    const totalOutstandingMinor = recipients.reduce(
      (sum, recipient) => sum + recipient.totalOutstandingMinor,
      0
    );

    await recordActivity({
      schoolId: String(schoolIdObj),
      userId: String(userId),
      type: "fee.reminder_sent",
      entityType: "fee_reminder_campaign",
      description: `Fee reminders sent via ${body.channel}: ${sent}/${recipients.length} successful`,
      metadata: {
        runId,
        channel: body.channel,
        filter: {
          onlyPrimaryGuardian: filter.onlyPrimaryGuardian,
          classGroupId: filter.classGroupId ? String(filter.classGroupId) : null,
          maxRecipients: filter.maxRecipients,
        },
        attempted: recipients.length,
        sent,
        failed,
        skipped,
        totalOutstandingMinor,
        truncated: audience.truncated,
        totalPotentialRecipients: audience.totalPotentialRecipients,
        deliveries: deliveries.slice(0, 250),
        deliveryCount: deliveries.length,
        deliveriesTruncated: deliveries.length > 250,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        runId,
        channel: body.channel,
        summary: {
          attempted: recipients.length,
          sent,
          failed,
          skipped,
          totalOutstandingMinor,
        },
        truncated: audience.truncated,
        totalPotentialRecipients: audience.totalPotentialRecipients,
        failures,
        deliveries,
        capabilities,
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Failed to send fee reminders:", error);
    return NextResponse.json(
      { success: false, error: "Failed to send fee reminders" },
      { status: 500 }
    );
  }
}
