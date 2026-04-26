import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Student } from "@/models/Student";
import { School } from "@/models/School";

type Params = Promise<{ token: string }>;

function normalizeUploadToken(raw: string | undefined): string {
  if (!raw) return "";
  try {
    return decodeURIComponent(raw.trim());
  } catch {
    return raw.trim();
  }
}

export async function GET(_req: NextRequest, { params }: { params: Params }) {
  try {
    const token = normalizeUploadToken((await params).token);
    if (!token || token.length < 24) {
      return NextResponse.json(
        { success: false, error: "Invalid link" },
        { status: 404 }
      );
    }

    await connectToDatabase();

    const student = await Student.findOne({
      parentDocumentRequests: {
        $elemMatch: { token, fulfilledAt: null },
      },
    })
      .select({
        schoolId: 1,
        firstName: 1,
        lastName: 1,
        middleName: 1,
        admissionNo: 1,
        parentDocumentRequests: 1,
      })
      .lean();

    if (!student) {
      return NextResponse.json(
        { success: false, error: "This upload link is invalid or already used." },
        { status: 404 }
      );
    }

    const sub = (student.parentDocumentRequests ?? []).find(
      (r) => r.token === token && !r.fulfilledAt
    );
    if (!sub) {
      return NextResponse.json(
        { success: false, error: "This upload link is invalid or already used." },
        { status: 404 }
      );
    }

    const school = await School.findById(student.schoolId).select("name logo").lean<{
      name?: string;
      logo?: string | null;
    } | null>();

    const fullName = [student.firstName, student.middleName, student.lastName]
      .filter(Boolean)
      .join(" ");

    return NextResponse.json({
      success: true,
      data: {
        schoolName: school?.name ?? "School",
        schoolLogoUrl: school?.logo ?? null,
        studentName: fullName,
        admissionNo: student.admissionNo ?? null,
        documentLabel: sub.label,
        message: sub.message ?? null,
      },
    });
  } catch (error) {
    console.error("Public student parent-document GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load upload page" },
      { status: 500 }
    );
  }
}
