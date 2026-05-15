import { NextRequest, NextResponse } from "next/server";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { ensureDefaultProposalData } from "@/lib/proposals/utils";
import { ProposalTemplate } from "@/models/ProposalTemplate";

export async function GET() {
  try {
    const gate = await requirePlatformPermission("platform.proposals.read");
    if (!gate.ok) return gate.res;
    await connectToDatabase();
    await ensureDefaultProposalData(gate.actor.userId);

    const templates = await ProposalTemplate.find({})
      .sort({ isDefault: -1, updatedAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: {
        templates: templates.map((template) => ({
          id: String(template._id),
          name: template.name,
          type: template.type,
          description: template.description || "",
          sectionsCount: template.sections?.length || 0,
          isDefault: Boolean(template.isDefault),
          updatedAt: template.updatedAt?.toISOString?.() || null,
        })),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to load proposal templates" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const gate = await requirePlatformPermission("platform.proposals.manageTemplates");
    if (!gate.ok) return gate.res;
    await connectToDatabase();
    const body = await req.json().catch(() => null);
    const template = await ProposalTemplate.create({
      name: String(body?.name || "Untitled Proposal Template").trim(),
      type: body?.type || "general",
      description: String(body?.description || "").trim(),
      sections: Array.isArray(body?.sections) ? body.sections : [],
      isDefault: Boolean(body?.isDefault),
      createdBy: gate.actor.userId,
      updatedBy: gate.actor.userId,
    });

    return NextResponse.json({ success: true, data: { id: String(template._id) } }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to create proposal template" },
      { status: 500 },
    );
  }
}
