import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Activity } from "@/models/Activity";

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(30).default(8),
});

type ReminderDelivery = {
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
};

function getNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function parseDeliveryRows(value: unknown): ReminderDelivery[] {
  if (!Array.isArray(value)) return [];

  const deliveries: ReminderDelivery[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const data = row as Record<string, unknown>;
    const statusRaw = getString(data.status);
    const status: ReminderDelivery["status"] =
      statusRaw === "sent" || statusRaw === "failed" || statusRaw === "skipped"
        ? statusRaw
        : "skipped";

    const students =
      Array.isArray(data.students)
        ? data.students
            .map((student) => {
              if (!student || typeof student !== "object") return null;
              const ward = student as Record<string, unknown>;
              return {
                studentId: getString(ward.studentId),
                studentName: getString(ward.studentName, "Student"),
                classGroupName:
                  typeof ward.classGroupName === "string" ? ward.classGroupName : null,
                outstandingMinor: getNumber(ward.outstandingMinor),
              };
            })
            .filter(
              (
                student
              ): student is {
                studentId: string;
                studentName: string;
                classGroupName: string | null;
                outstandingMinor: number;
              } => Boolean(student)
            )
        : [];

    const delivery: ReminderDelivery = {
      recipientUserId: getString(data.recipientUserId),
      guardianName: getString(data.guardianName, "Guardian"),
      contact: typeof data.contact === "string" ? data.contact : null,
      status,
      totalOutstandingMinor: getNumber(data.totalOutstandingMinor),
      students,
    };

    if (typeof data.reason === "string") {
      delivery.reason = data.reason;
    }

    deliveries.push(delivery);
  }

  return deliveries;
}

export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireFinanceStaff();
    await connectToDatabase();

    const parsed = QuerySchema.safeParse({
      limit: req.nextUrl.searchParams.get("limit") || undefined,
    });
    const limit = parsed.success ? parsed.data.limit : 8;

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    const items = await Activity.find({
      schoolId: schoolIdObj,
      type: "fee.reminder_sent",
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("userId", "firstName lastName email")
      .lean();

    return NextResponse.json({
      success: true,
      data: {
        items: items.map((item) => {
          const metadata =
            item.metadata && typeof item.metadata === "object"
              ? (item.metadata as Record<string, unknown>)
              : {};
          const channelRaw = getString(metadata.channel, "email");
          const channel =
            channelRaw === "email" || channelRaw === "sms" || channelRaw === "whatsapp"
              ? channelRaw
              : "email";
          const actorRaw =
            item.userId && typeof item.userId === "object"
              ? (item.userId as unknown as Record<string, unknown>)
              : null;
          const createdAtRaw = item.createdAt;
          const createdAtDate =
            createdAtRaw instanceof Date ? createdAtRaw : new Date(String(createdAtRaw));
          const createdAt = Number.isNaN(createdAtDate.getTime())
            ? new Date().toISOString()
            : createdAtDate.toISOString();

          return {
            id: String(item._id),
            runId: getString(metadata.runId, String(item._id)),
            channel,
            createdAt,
            actor: actorRaw
              ? {
                  id: actorRaw._id ? String(actorRaw._id) : "",
                  firstName: getString(actorRaw.firstName) || undefined,
                  lastName: getString(actorRaw.lastName) || undefined,
                  email: getString(actorRaw.email) || undefined,
                }
              : null,
            summary: {
              attempted: getNumber(metadata.attempted),
              sent: getNumber(metadata.sent),
              failed: getNumber(metadata.failed),
              skipped: getNumber(metadata.skipped),
              totalOutstandingMinor: getNumber(metadata.totalOutstandingMinor),
            },
            deliveries: parseDeliveryRows(metadata.deliveries),
          };
        }),
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Failed to fetch fee reminder history:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch fee reminder history" },
      { status: 500 }
    );
  }
}
