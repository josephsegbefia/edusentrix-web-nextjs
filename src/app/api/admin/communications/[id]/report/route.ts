import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdminOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Communication } from "@/models/Communication";
import { CommunicationDelivery } from "@/models/CommunicationDelivery";
import { serializeCommunication } from "@/lib/communications/api/serialize";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedModuleView("communications");
    await connectToDatabase();
    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return Response.json({ success: false, error: "Invalid communication id" }, { status: 400 });
    }
    const communication = await Communication.findOne({ _id: id, schoolId }).lean();
    if (!communication) {
      return Response.json({ success: false, error: "Communication not found" }, { status: 404 });
    }
    const communicationId = new mongoose.Types.ObjectId(id);
    const [byStatus, byChannel, failures] = await Promise.all([
      CommunicationDelivery.aggregate([
        { $match: { communicationId, schoolId: new mongoose.Types.ObjectId(String(schoolId)) } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      CommunicationDelivery.aggregate([
        { $match: { communicationId, schoolId: new mongoose.Types.ObjectId(String(schoolId)) } },
        { $group: { _id: { channel: "$channel", status: "$status" }, count: { $sum: 1 } } },
      ]),
      CommunicationDelivery.find({
        communicationId,
        schoolId,
        status: { $in: ["failed", "skipped"] },
      }).select("channel status recipientName destination skippedReason failureReason").limit(25).lean(),
    ]);

    return Response.json({
      success: true,
      data: {
        communication: serializeCommunication(communication),
        byStatus: byStatus.reduce<Record<string, number>>((acc, row) => {
          acc[row._id] = row.count;
          return acc;
        }, {}),
        byChannel: byChannel.reduce<Record<string, Record<string, number>>>((acc, row) => {
          const channel = row._id.channel;
          acc[channel] ??= {};
          acc[channel][row._id.status] = row.count;
          return acc;
        }, {}),
        failures: failures.map((failure) => ({
          id: String(failure._id),
          channel: failure.channel,
          status: failure.status,
          recipientName: failure.recipientName ?? null,
          destination: failure.destination ?? null,
          reason: failure.failureReason || failure.skippedReason || null,
        })),
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ success: false, error: error instanceof Error ? error.message : "Failed to load report" }, { status: 500 });
  }
}
