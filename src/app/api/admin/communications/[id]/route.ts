import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import {
  requireSchoolAdminOrDelegatedAnyPermission,
  requireSchoolAdminOrDelegatedModuleView,
} from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Communication } from "@/models/Communication";
import { serializeCommunication } from "@/lib/communications/api/serialize";

const PatchSchema = z.object({
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  title: z.string().trim().min(1).max(220).optional(),
  bodyHtml: z.string().min(1).optional(),
  bodyText: z.string().trim().min(1).optional(),
  channels: z.array(z.enum(["in_app", "email"])).min(1).optional(),
  scheduledFor: z.string().datetime().optional().nullable(),
  allowReplies: z.boolean().optional(),
  actionUrl: z.string().trim().max(500).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

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
    return Response.json({ success: true, data: serializeCommunication(communication) });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ success: false, error: error instanceof Error ? error.message : "Failed to load communication" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedAnyPermission([
      "communications.edit",
    ]);
    await connectToDatabase();
    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return Response.json({ success: false, error: "Invalid communication id" }, { status: 400 });
    }
    const parsed = PatchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json({ success: false, error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }

    const existing = await Communication.findOne({ _id: id, schoolId });
    if (!existing) {
      return Response.json({ success: false, error: "Communication not found" }, { status: 404 });
    }
    if (!["draft", "scheduled", "failed"].includes(existing.status)) {
      return Response.json({ success: false, error: "Only draft, scheduled, or failed communications can be edited" }, { status: 409 });
    }

    Object.assign(existing, {
      ...parsed.data,
      scheduledFor: parsed.data.scheduledFor ? new Date(parsed.data.scheduledFor) : parsed.data.scheduledFor === null ? null : existing.scheduledFor,
      status: parsed.data.scheduledFor ? "scheduled" : existing.status === "scheduled" && parsed.data.scheduledFor === null ? "draft" : existing.status,
    });
    await existing.save();
    return Response.json({ success: true, data: serializeCommunication(existing) });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ success: false, error: error instanceof Error ? error.message : "Failed to update communication" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedAnyPermission([
      "communications.edit",
    ]);
    await connectToDatabase();
    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return Response.json({ success: false, error: "Invalid communication id" }, { status: 400 });
    }
    const communication = await Communication.findOneAndUpdate(
      { _id: id, schoolId },
      { $set: { status: "archived" } },
      { new: true },
    );
    if (!communication) {
      return Response.json({ success: false, error: "Communication not found" }, { status: 404 });
    }
    return Response.json({ success: true, data: serializeCommunication(communication) });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ success: false, error: error instanceof Error ? error.message : "Failed to archive communication" }, { status: 500 });
  }
}
