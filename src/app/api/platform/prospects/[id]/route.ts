import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { PlatformProspect } from "@/models/PlatformProspect";
import { Proposal } from "@/models/Proposal";
import { normalizeGhanaPhoneForStorage } from "@/lib/phone/ghana";

const StatusSchema = z.enum([
  "new",
  "contacted",
  "meeting_scheduled",
  "demo_done",
  "proposal_preparing",
  "proposal_sent",
  "follow_up_due",
  "won",
  "lost",
  "on_hold",
]);

const PatchSchema = z.object({
  schoolName: z.string().trim().min(2).max(180).optional(),
  location: z.string().trim().max(180).optional().nullable(),
  contactName: z.string().trim().max(140).optional().nullable(),
  contactTitle: z.string().trim().max(140).optional().nullable(),
  contactPhone: z.string().trim().max(40).optional().nullable(),
  contactEmail: z.string().trim().email().optional().or(z.literal("")).nullable(),
  source: z.string().trim().max(80).optional().nullable(),
  status: StatusSchema.optional(),
  priority: z.enum(["low", "normal", "high"]).optional(),
  notes: z.string().trim().max(3000).optional().nullable(),
  nextFollowUpAt: z.string().datetime().optional().nullable(),
  outcomeReason: z.string().trim().max(500).optional().nullable(),
});

function milestonePatch(status?: z.infer<typeof StatusSchema>) {
  const now = new Date();
  if (status === "contacted") return { contactedAt: now };
  if (status === "meeting_scheduled") return { meetingAt: now };
  if (status === "demo_done") return { demoAt: now };
  if (status === "proposal_sent") return { proposalSentAt: now };
  if (status === "follow_up_due") return { lastFollowUpAt: now };
  return {};
}

function serializeProspect(doc: any) {
  return {
    id: String(doc._id),
    schoolName: doc.schoolName,
    location: doc.location || "",
    contactName: doc.contactName || "",
    contactTitle: doc.contactTitle || "",
    contactPhone: doc.contactPhone || "",
    contactEmail: doc.contactEmail || "",
    source: doc.source || "manual",
    status: doc.status,
    priority: doc.priority || "normal",
    notes: doc.notes || "",
    ownerUserId: doc.ownerUserId ? String(doc.ownerUserId) : null,
    latestProposalId: doc.latestProposalId ? String(doc.latestProposalId) : null,
    proposalCount: doc.proposalCount || 0,
    contactedAt: doc.contactedAt ? new Date(doc.contactedAt).toISOString() : null,
    meetingAt: doc.meetingAt ? new Date(doc.meetingAt).toISOString() : null,
    demoAt: doc.demoAt ? new Date(doc.demoAt).toISOString() : null,
    proposalSentAt: doc.proposalSentAt ? new Date(doc.proposalSentAt).toISOString() : null,
    lastFollowUpAt: doc.lastFollowUpAt ? new Date(doc.lastFollowUpAt).toISOString() : null,
    nextFollowUpAt: doc.nextFollowUpAt ? new Date(doc.nextFollowUpAt).toISOString() : null,
    outcomeReason: doc.outcomeReason || "",
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
  };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await requirePlatformPermission("platform.proposals.update");
    if (!gate.ok) return gate.res;
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Invalid prospect id" }, { status: 400 });
    }

    const parsed = PatchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || "Invalid prospect payload" },
        { status: 400 },
      );
    }

    await connectToDatabase();
    const update: Record<string, unknown> = {
      ...parsed.data,
      updatedByUserId: gate.actor.userId,
      ...milestonePatch(parsed.data.status),
    };

    if (typeof parsed.data.contactPhone !== "undefined") {
      update.contactPhone = normalizeGhanaPhoneForStorage(parsed.data.contactPhone) || "";
    }
    if (typeof parsed.data.nextFollowUpAt !== "undefined") {
      update.nextFollowUpAt = parsed.data.nextFollowUpAt
        ? new Date(parsed.data.nextFollowUpAt)
        : null;
    }

    const prospect = await PlatformProspect.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true },
    );
    if (!prospect) {
      return NextResponse.json({ success: false, error: "Prospect not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: serializeProspect(prospect.toObject()) });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to update prospect" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await requirePlatformPermission("platform.proposals.update");
    if (!gate.ok) return gate.res;
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Invalid prospect id" }, { status: 400 });
    }

    await connectToDatabase();
    const prospect = await PlatformProspect.findById(id).select("_id").lean();
    if (!prospect) {
      return NextResponse.json({ success: false, error: "Prospect not found" }, { status: 404 });
    }

    const [proposalUpdate, deleteResult] = await Promise.all([
      Proposal.updateMany(
        { prospectId: prospect._id },
        { $set: { prospectId: null, source: "manual" } },
      ),
      PlatformProspect.deleteOne({ _id: prospect._id }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        deletedId: id,
        unlinkedProposalCount: proposalUpdate.modifiedCount,
        deletedCount: deleteResult.deletedCount,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to delete prospect" },
      { status: 500 },
    );
  }
}
