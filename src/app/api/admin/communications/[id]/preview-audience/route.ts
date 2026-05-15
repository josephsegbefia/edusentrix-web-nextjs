import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdminOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Communication } from "@/models/Communication";
import { previewCommunicationAudience } from "@/lib/communications/delivery/communicationDeliveryService";

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
    const communication = await Communication.findOne({ _id: id, schoolId });
    if (!communication) {
      return Response.json({ success: false, error: "Communication not found" }, { status: 404 });
    }
    const preview = await previewCommunicationAudience(communication);
    return Response.json({
      success: true,
      data: {
        summary: preview.summary,
        channelResults: preview.channelResults,
        sampleRecipients: preview.recipients.slice(0, 25).map((recipient) => ({
          key: recipient.key,
          name: recipient.name,
          role: recipient.role,
          email: recipient.email ?? null,
          phone: recipient.phone ?? null,
          whatsappPhone: recipient.whatsappPhone ?? null,
          reasonIncluded: recipient.reasonIncluded,
        })),
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ success: false, error: error instanceof Error ? error.message : "Failed to preview audience" }, { status: 500 });
  }
}
