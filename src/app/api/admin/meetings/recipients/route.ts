import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import {
  searchMeetingRecipients,
  type MeetingRecipientRole,
} from "@/lib/meetings/admin";

const ALLOWED_ROLES = new Set<MeetingRecipientRole>([
  "parent",
  "teacher",
  "bursar",
]);

export async function GET(req: NextRequest) {
  try {
    const context = await requireSchoolAdmin();
    await connectToDatabase();

    const role = (req.nextUrl.searchParams.get("role") || "parent") as MeetingRecipientRole;
    const query = req.nextUrl.searchParams.get("q") || "";
    const all = req.nextUrl.searchParams.get("all") === "1";
    const limit = Number(req.nextUrl.searchParams.get("limit") || "20");

    if (!ALLOWED_ROLES.has(role)) {
      return NextResponse.json(
        { success: false, error: "Unsupported recipient role." },
        { status: 400 }
      );
    }

    const data = await searchMeetingRecipients({
      schoolId: context.schoolId,
      role,
      query,
      limit,
      all,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Failed to search meeting recipients:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to search meeting recipients",
      },
      { status: 500 }
    );
  }
}
