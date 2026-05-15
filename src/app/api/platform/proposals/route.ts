import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Proposal } from "@/models/Proposal";
import { ProposalTemplate } from "@/models/ProposalTemplate";
import { CreateProposalSchema } from "@/lib/proposals/validators";
import {
  ensureDefaultProposalData,
  hashProposalContent,
  logProposalActivity,
  proposalVariables,
  replaceProposalPlaceholders,
  sanitizeProposalHtml,
} from "@/lib/proposals/utils";
import { serializeProposal } from "@/lib/proposals/serialize";

function objectIdOrNull(value?: string | null) {
  return value && mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : null;
}

export async function GET(req: NextRequest) {
  try {
    const gate = await requirePlatformPermission("platform.proposals.read");
    if (!gate.ok) return gate.res;
    await connectToDatabase();
    await ensureDefaultProposalData(gate.actor.userId);

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 15)));
    const status = searchParams.get("status");
    const proposalType = searchParams.get("proposalType");
    const q = searchParams.get("q")?.trim();

    const query: Record<string, unknown> = {};
    if (status && status !== "all") query.status = status;
    if (proposalType && proposalType !== "all") query.proposalType = proposalType;
    if (q) {
      query.$or = [
        { schoolName: { $regex: q, $options: "i" } },
        { recipientName: { $regex: q, $options: "i" } },
        { recipientEmail: { $regex: q, $options: "i" } },
        { title: { $regex: q, $options: "i" } },
      ];
    }

    const [proposals, total] = await Promise.all([
      Proposal.find(query)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Proposal.countDocuments(query),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        proposals: proposals.map(serializeProposal),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to load proposals" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const gate = await requirePlatformPermission("platform.proposals.create");
    if (!gate.ok) return gate.res;
    await connectToDatabase();
    const { template: defaultTemplate, branding } = await ensureDefaultProposalData(gate.actor.userId);

    const parsed = CreateProposalSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }

    const selectedTemplate =
      parsed.data.templateId && mongoose.Types.ObjectId.isValid(parsed.data.templateId)
        ? await ProposalTemplate.findById(parsed.data.templateId)
        : defaultTemplate;
    const template = selectedTemplate || defaultTemplate;
    const preparedByName = parsed.data.preparedByName || gate.actor.email || "EduSentrix";
    const variables = proposalVariables({
      ...parsed.data,
      preparedBy: preparedByName,
      branding,
    });
    const sections = (template.sections || [])
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((section) => ({
        key: section.key,
        title: replaceProposalPlaceholders(section.title, variables),
        subtitle: replaceProposalPlaceholders(section.subtitle || "", variables),
        content: sanitizeProposalHtml(replaceProposalPlaceholders(section.content, variables)),
        order: section.order,
        enabled: section.enabled,
        displayStyle: section.displayStyle || "standard",
        pageBreakBefore: Boolean(section.pageBreakBefore),
        pageBreakAfter: Boolean(section.pageBreakAfter),
      }));

    const contentHash = hashProposalContent({
      schoolName: parsed.data.schoolName,
      selectedModules: parsed.data.selectedModules,
      sections,
      pricing: parsed.data.pricing || { currency: "GHS" },
    });

    const proposal = await Proposal.create({
      schoolName: parsed.data.schoolName,
      schoolLocation: parsed.data.schoolLocation || "",
      schoolId: objectIdOrNull(parsed.data.schoolId),
      leadId: objectIdOrNull(parsed.data.leadId),
      applicationId: objectIdOrNull(parsed.data.applicationId),
      source: parsed.data.source,
      recipientName: parsed.data.recipientName || "",
      recipientTitle: parsed.data.recipientTitle || "",
      recipientEmail: parsed.data.recipientEmail || "",
      recipientPhone: parsed.data.recipientPhone || "",
      templateId: template._id,
      title: `Proposal for ${parsed.data.schoolName}`,
      proposalType: parsed.data.proposalType,
      selectedModules: parsed.data.selectedModules,
      sections,
      pricing: parsed.data.pricing || { currency: "GHS" },
      status: "draft",
      version: 1,
      contentHash,
      preparedByName,
      preparedByUserId: gate.actor.userId,
      ownerUserId: gate.actor.userId,
      visibility: "platform_admins",
      internalNotes: parsed.data.internalNotes || "",
    });

    await logProposalActivity({
      proposalId: proposal._id,
      action: "created",
      message: "Proposal created from template.",
      actorId: gate.actor.userId,
      metadata: { templateId: String(template._id) },
    });

    return NextResponse.json({ success: true, data: serializeProposal(proposal) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to create proposal" },
      { status: 500 },
    );
  }
}
