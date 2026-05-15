import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdminOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Communication } from "@/models/Communication";
import { CommunicationDelivery } from "@/models/CommunicationDelivery";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedModuleView("communications");
    await connectToDatabase();
    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return Response.json({ success: false, error: "Invalid communication id" }, { status: 400 });
    }
    const exists = await Communication.exists({ _id: id, schoolId });
    if (!exists) {
      return Response.json({ success: false, error: "Communication not found" }, { status: 404 });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const channel = url.searchParams.get("channel");
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 50)));
    const query: Record<string, unknown> = { communicationId: new mongoose.Types.ObjectId(id), schoolId };
    if (status && status !== "all") query.status = status;
    if (channel && channel !== "all") query.channel = channel;

    const [items, total] = await Promise.all([
      CommunicationDelivery.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      CommunicationDelivery.countDocuments(query),
    ]);

    return Response.json({
      success: true,
      data: {
        items: items.map((item) => ({
          id: String(item._id),
          communicationId: String(item.communicationId),
          channel: item.channel,
          status: item.status,
          recipientName: item.recipientName ?? null,
          recipientRole: item.recipientRole,
          destination: item.destination ?? null,
          skippedReason: item.skippedReason ?? null,
          failureReason: item.failureReason ?? null,
          outputEntityType: item.outputEntityType ?? null,
          outputEntityId: item.outputEntityId ? String(item.outputEntityId) : null,
          createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : null,
          updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : null,
        })),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ success: false, error: error instanceof Error ? error.message : "Failed to load deliveries" }, { status: 500 });
  }
}
