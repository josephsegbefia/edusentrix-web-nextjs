import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import OpenAI from "openai";
import { z } from "zod";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Proposal } from "@/models/Proposal";
import { logProposalActivity, sanitizeProposalHtml } from "@/lib/proposals/utils";

const LeoSectionSchema = z.object({
  sectionKey: z.string().trim().min(1),
  instruction: z.string().trim().max(600).optional().nullable(),
  tone: z.enum(["formal", "executive", "warm", "simple"]).default("formal"),
});

function fallbackDraft(input: {
  sectionTitle: string;
  schoolName: string;
  selectedModules: string[];
  currentContent: string;
}) {
  const modules = input.selectedModules.slice(0, 6).join(", ");
  return [
    `${input.schoolName} can use EduSentrix to strengthen the way this area of school operations is planned, monitored, and reviewed.`,
    `For ${input.sectionTitle.toLowerCase()}, the platform brings the relevant information into one structured workspace, reducing manual follow-up and giving leadership clearer visibility.`,
    modules
      ? `The most relevant capabilities for this proposal include ${modules}.`
      : "The proposal can be tailored further after the school confirms its immediate priorities.",
    "This draft should be reviewed and adjusted to match the exact discussion held with the school.",
  ].join("\n\n");
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ proposalId: string }> },
) {
  try {
    const gate = await requirePlatformPermission("platform.proposals.update");
    if (!gate.ok) return gate.res;
    await connectToDatabase();
    const { proposalId } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(proposalId)) {
      return NextResponse.json({ success: false, error: "Invalid proposal id" }, { status: 400 });
    }
    const parsed = LeoSectionSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }

    const proposal = await Proposal.findById(proposalId);
    if (!proposal) return NextResponse.json({ success: false, error: "Proposal not found" }, { status: 404 });
    const section = proposal.sections.find((item) => item.key === parsed.data.sectionKey);
    if (!section) return NextResponse.json({ success: false, error: "Section not found" }, { status: 404 });

    let draft = "";
    let source: "leo" | "fallback" = "fallback";

    if (process.env.OPENAI_API_KEY) {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        temperature: 0.45,
        max_tokens: 1200,
        messages: [
          {
            role: "system",
            content:
              "You are Leo, EduSentrix's proposal assistant. Return JSON only. Write polished, official business proposal copy. Do not invent prices, dates, contracts, legal commitments, or customer claims. Output must be editable draft text, not final approval.",
          },
          {
            role: "user",
            content: JSON.stringify({
              task: "Rewrite or draft this proposal section.",
              expectedJson: { content: "plain text with short paragraphs only" },
              tone: parsed.data.tone,
              instruction: parsed.data.instruction || "",
              proposal: {
                schoolName: proposal.schoolName,
                schoolLocation: proposal.schoolLocation,
                proposalType: proposal.proposalType,
                selectedModules: proposal.selectedModules,
                pricing: proposal.pricing,
              },
              section: {
                title: section.title,
                currentContent: section.content,
              },
            }),
          },
        ],
      });
      const text = completion.choices[0]?.message?.content || "";
      const json = JSON.parse(text) as { content?: string };
      draft = sanitizeProposalHtml(String(json.content || ""));
      source = "leo";
    } else {
      draft = fallbackDraft({
        sectionTitle: section.title,
        schoolName: proposal.schoolName,
        selectedModules: proposal.selectedModules,
        currentContent: section.content,
      });
    }

    await logProposalActivity({
      proposalId: proposal._id,
      action: "updated",
      message: `Leo generated draft content for "${section.title}".`,
      actorId: gate.actor.userId,
      metadata: { sectionKey: section.key, source },
    });

    return NextResponse.json({
      success: true,
      isDraft: true,
      disclaimer: "Leo generated draft proposal copy. Review and edit before sending.",
      data: { content: draft, source },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Leo could not generate section content" },
      { status: 500 },
    );
  }
}
