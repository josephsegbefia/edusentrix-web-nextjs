/* eslint-disable @typescript-eslint/no-explicit-any */
// GET /api/admin/subjects
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Subject } from "@/models/Subject";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const subjects = await Subject.find({ schoolId, isActive: true })
      .sort({ name: 1 })
      .lean();

    return Response.json({ success: true, data: subjects }, { status: 200 });
  } catch (error: any) {
    console.error(error);
    return new Response(error?.message ?? "Failed to fetch subjects", {
      status: 500,
    });
  }
}
