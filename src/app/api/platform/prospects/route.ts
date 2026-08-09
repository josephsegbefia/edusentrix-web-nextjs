import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { PlatformProspect } from "@/models/PlatformProspect";
import { normalizeGhanaPhoneForStorage } from "@/lib/phone/ghana";

const ProspectStatusSchema = z.enum([
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

const ProspectPayloadSchema = z.object({
  schoolName: z.string().trim().min(2).max(180),
  location: z.string().trim().max(180).optional().nullable(),
  contactName: z.string().trim().max(140).optional().nullable(),
  contactTitle: z.string().trim().max(140).optional().nullable(),
  contactPhone: z.string().trim().max(40).optional().nullable(),
  contactEmail: z.string().trim().email().optional().or(z.literal("")).nullable(),
  source: z.string().trim().max(80).optional().nullable(),
  status: ProspectStatusSchema.optional(),
  priority: z.enum(["low", "normal", "high"]).optional(),
  notes: z.string().trim().max(3000).optional().nullable(),
  nextFollowUpAt: z.string().datetime().optional().nullable(),
  outcomeReason: z.string().trim().max(500).optional().nullable(),
});

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

function milestonePatch(status?: z.infer<typeof ProspectStatusSchema>) {
  const now = new Date();
  if (status === "contacted") return { contactedAt: now };
  if (status === "meeting_scheduled") return { meetingAt: now };
  if (status === "demo_done") return { demoAt: now };
  if (status === "proposal_sent") return { proposalSentAt: now };
  if (status === "follow_up_due") return { lastFollowUpAt: now };
  return {};
}

export async function GET(req: NextRequest) {
  try {
    const gate = await requirePlatformPermission("platform.proposals.read");
    if (!gate.ok) return gate.res;
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 25)));
    const status = searchParams.get("status");
    const q = searchParams.get("q")?.trim();
    const due = searchParams.get("due");

    const query: Record<string, unknown> = {};
    if (status && status !== "all") query.status = status;
    if (due === "today") {
      query.nextFollowUpAt = { $lte: new Date() };
      query.status = { $nin: ["won", "lost"] };
    }
    if (q) {
      query.$or = [
        { schoolName: { $regex: q, $options: "i" } },
        { contactName: { $regex: q, $options: "i" } },
        { contactEmail: { $regex: q, $options: "i" } },
        { contactPhone: { $regex: q, $options: "i" } },
        { location: { $regex: q, $options: "i" } },
      ];
    }

    const [prospects, total, statusCounts, dueToday] = await Promise.all([
      PlatformProspect.find(query)
        .sort({ nextFollowUpAt: 1, updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      PlatformProspect.countDocuments(query),
      PlatformProspect.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]) as Promise<{ _id: string; count: number }[]>,
      PlatformProspect.countDocuments({
        nextFollowUpAt: { $lte: new Date() },
        status: { $nin: ["won", "lost"] },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        prospects: prospects.map(serializeProspect),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
        stats: {
          dueToday,
          byStatus: Object.fromEntries(statusCounts.map((item) => [item._id, item.count])),
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to load prospects" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const gate = await requirePlatformPermission("platform.proposals.create");
    if (!gate.ok) return gate.res;
    await connectToDatabase();

    const parsed = ProspectPayloadSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || "Invalid prospect payload" },
        { status: 400 },
      );
    }

    const status = parsed.data.status || "new";
    const prospect = await PlatformProspect.create({
      ...parsed.data,
      contactPhone: normalizeGhanaPhoneForStorage(parsed.data.contactPhone) || "",
      status,
      priority: parsed.data.priority || "normal",
      nextFollowUpAt: parsed.data.nextFollowUpAt ? new Date(parsed.data.nextFollowUpAt) : null,
      ownerUserId: gate.actor.userId,
      createdByUserId: gate.actor.userId,
      updatedByUserId: gate.actor.userId,
      ...milestonePatch(status),
    });

    return NextResponse.json({ success: true, data: serializeProspect(prospect.toObject()) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to create prospect" },
      { status: 500 },
    );
  }
}
