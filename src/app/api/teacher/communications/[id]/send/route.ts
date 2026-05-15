import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdminOrTeacherRead } from "@/lib/auth/requireSchoolAdminOrTeacherRead";
import { serializeCommunication } from "@/lib/communications/api/serialize";
import { queueCommunication } from "@/lib/communications/delivery/communicationDeliveryService";
import { processCommunicationOutbox } from "@/lib/communications/delivery/processOutboxJobs";
import { Communication } from "@/models/Communication";

export async function POST(
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

    const communicationId = new mongoose.Types.ObjectId(id);
    const communication = await Communication.findOne({
      _id: communicationId,
      schoolId: auth.schoolId,
      createdByUserId: auth.userId,
      senderRole: "teacher",
    }).select("_id").lean();

    if (!communication) {
      return Response.json({ success: false, error: "Communication not found" }, { status: 404 });
    }

    const result = await queueCommunication(communicationId, auth.schoolId);
    const processed = await processCommunicationOutbox({
      schoolId: auth.schoolId,
      communicationId,
      limit: 100,
    });

    return Response.json({
      success: true,
      data: {
        communication: serializeCommunication(result.communication),
        queuedCount: result.queuedCount,
        skippedCount: result.skippedCount,
        recipientCount: result.recipientCount,
        processed,
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to send communication" },
      { status: 500 },
    );
  }
}
