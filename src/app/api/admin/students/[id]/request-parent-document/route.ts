import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { randomBytes } from "crypto";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { Student } from "@/models/Student";
import { Guardian } from "@/models/Guardian";
import { School } from "@/models/School";
import { getAppUrl } from "@/lib/utils/getAppUrl";
import { sendStudentParentDocumentRequestEmail } from "@/lib/students/parent-notification-emails";

type Params = Promise<{ id: string }>;

const BodySchema = z.object({
  label: z.string().min(1).max(200),
  message: z.string().max(2000).optional().nullable(),
  sendEmail: z.boolean().optional(),
});

function toOid(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest, { params }: { params: Params }) {
  const { schoolId, userId } = await requireSchoolAdminOrDelegatedAnyPermission([
    "students.edit",
  ]);
  await connectToDatabase();

  const { id } = await params;
  const studentOid = toOid(id);
  if (!studentOid) {
    return NextResponse.json(
      { success: false, error: "Invalid student id" },
      { status: 400 }
    );
  }

  const schoolIdObj =
    schoolId instanceof mongoose.Types.ObjectId
      ? schoolId
      : new mongoose.Types.ObjectId(String(schoolId));

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const student = await Student.findOne({
    _id: studentOid,
    schoolId: schoolIdObj,
  });
  if (!student) {
    return NextResponse.json(
      { success: false, error: "Student not found" },
      { status: 404 }
    );
  }

  const guardians = await Guardian.find({ studentId: studentOid })
    .populate("userId", "firstName lastName email")
    .sort({ isPrimary: -1, createdAt: 1 })
    .lean();

  const g = guardians.find((row) => String(row.email || "").trim().length > 0);
  if (!g) {
    return NextResponse.json(
      {
        success: false,
        error:
          "No guardian with an email on file. Add a guardian before requesting documents.",
      },
      { status: 409 }
    );
  }

  const user = g.userId as
    | { firstName?: string; lastName?: string; email?: string | null }
    | null
    | undefined;
  const email = String(g.email).toLowerCase().trim();
  const firstName =
    (user?.firstName && String(user.firstName).trim()) ||
    email.split("@")[0] ||
    "Parent";
  const lastName = (user?.lastName && String(user.lastName).trim()) || "";

  const token = randomBytes(24).toString("base64url");
  student.parentDocumentRequests = student.parentDocumentRequests ?? [];
  student.parentDocumentRequests.push({
    token,
    label: parsed.data.label.trim(),
    message: parsed.data.message?.trim() ?? null,
    requestedAt: new Date(),
    requestedBy: userId,
    fulfilledAt: null,
  });
  await student.save();

  const uploadUrl = `${getAppUrl()}/upload/parent-document/${token}`;
  const sendEmail = parsed.data.sendEmail !== false;

  const school = await School.findById(schoolIdObj).select("name").lean<{
    name?: string;
  } | null>();
  const schoolName = school?.name ?? "Your school";

  const studentName = [student.firstName, student.middleName, student.lastName]
    .filter(Boolean)
    .join(" ");

  if (sendEmail) {
    await sendStudentParentDocumentRequestEmail({
      studentId: String(student._id),
      studentName,
      guardian: { firstName, lastName, email },
      documentLabel: parsed.data.label.trim(),
      message: parsed.data.message ?? null,
      uploadUrl,
      ctx: {
        schoolId: String(schoolIdObj),
        schoolName,
        actorId: String(userId),
        actorRole: "school_admin",
      },
    });
  }

  return NextResponse.json({
    success: true,
    data: {
      uploadUrl,
      token,
      emailSent: sendEmail,
      sentTo: sendEmail ? email : null,
    },
  });
}
