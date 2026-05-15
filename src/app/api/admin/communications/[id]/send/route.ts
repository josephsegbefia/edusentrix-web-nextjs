import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { queueCommunication } from "@/lib/communications/delivery/communicationDeliveryService";
import { processCommunicationOutbox } from "@/lib/communications/delivery/processOutboxJobs";
import { serializeCommunication } from "@/lib/communications/api/serialize";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedAnyPermission([
      "communications.send",
    ]);
    await connectToDatabase();
    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return Response.json({ success: false, error: "Invalid communication id" }, { status: 400 });
    }
    const result = await queueCommunication(
      new mongoose.Types.ObjectId(id),
      new mongoose.Types.ObjectId(String(schoolId)),
    );
    const processed = await processCommunicationOutbox({
      schoolId: new mongoose.Types.ObjectId(String(schoolId)),
      communicationId: new mongoose.Types.ObjectId(id),
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
    return Response.json({ success: false, error: error instanceof Error ? error.message : "Failed to send communication" }, { status: 500 });
  }
}
