import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdminOrTeacherRead } from "@/lib/auth/requireSchoolAdminOrTeacherRead";
import { serializeCommunication } from "@/lib/communications/api/serialize";
import { Communication } from "@/models/Communication";

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSchoolAdminOrTeacherRead();
    if (!auth.teacherId) {
      return Response.json({ success: false, error: "Teacher record is required" }, { status: 403 });
    }

    await connectToDatabase();
    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return Response.json({ success: false, error: "Invalid communication id" }, { status: 400 });
    }

    const communication = await Communication.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(id),
        schoolId: auth.schoolId,
        createdByUserId: auth.userId,
        senderRole: "teacher",
      },
      { $set: { status: "archived" } },
      { new: true },
    );

    if (!communication) {
      return Response.json({ success: false, error: "Communication not found" }, { status: 404 });
    }

    return Response.json({ success: true, data: serializeCommunication(communication) });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to archive communication" },
      { status: 500 },
    );
  }
}
