import crypto from "crypto";
import mongoose from "mongoose";
import { ProposalBranding } from "@/models/ProposalBranding";
import { ProposalTemplate } from "@/models/ProposalTemplate";
import { DEFAULT_PROPOSAL_TEMPLATE } from "@/lib/proposals/defaults";
import { ProposalActivity, type ProposalActivityAction } from "@/models/ProposalActivity";

export function replaceProposalPlaceholders(content: string, variables: Record<string, string>) {
  return content.replace(/\{\{(.*?)\}\}/g, (_, key) => {
    const normalizedKey = String(key).trim();
    return variables[normalizedKey] ?? "";
  });
}

export function proposalVariables(input: {
  schoolName: string;
  schoolLocation?: string | null;
  recipientName?: string | null;
  recipientTitle?: string | null;
  recipientEmail?: string | null;
  preparedBy: string;
  pilotDuration?: string | null;
  selectedModules?: string[];
  branding?: {
    website?: string | null;
    contactEmail?: string | null;
    whatsapp?: string | null;
  } | null;
}) {
  return {
    schoolName: input.schoolName,
    schoolLocation: input.schoolLocation || "",
    recipientName: input.recipientName || "",
    recipientTitle: input.recipientTitle || "",
    recipientEmail: input.recipientEmail || "",
    recipientTitleOrName: input.recipientTitle || input.recipientName || "Team",
    proposalDate: new Date().toLocaleDateString(),
    preparedBy: input.preparedBy,
    website: input.branding?.website || "https://www.tryedusentrix.app",
    email: input.branding?.contactEmail || "joseph.segbefia@tryedusentrix.app",
    whatsapp: input.branding?.whatsapp || "0504211501",
    pilotDuration: input.pilotDuration || "",
    selectedModules: (input.selectedModules || []).join(", "),
  };
}

export function hashProposalContent(input: unknown) {
  return crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export async function ensureDefaultProposalData(actorId?: mongoose.Types.ObjectId | null) {
  const [template, branding] = await Promise.all([
    ProposalTemplate.findOneAndUpdate(
      { name: DEFAULT_PROPOSAL_TEMPLATE.name, type: DEFAULT_PROPOSAL_TEMPLATE.type },
      {
        $setOnInsert: {
          ...DEFAULT_PROPOSAL_TEMPLATE,
          createdBy: actorId || null,
          updatedBy: actorId || null,
        },
      },
      { upsert: true, new: true },
    ),
    ProposalBranding.findOneAndUpdate(
      {},
      { $setOnInsert: {} },
      { upsert: true, new: true },
    ),
  ]);
  return { template, branding };
}

export async function logProposalActivity(input: {
  proposalId: mongoose.Types.ObjectId;
  action: ProposalActivityAction;
  message: string;
  actorId?: mongoose.Types.ObjectId | null;
  metadata?: Record<string, unknown> | null;
}) {
  return ProposalActivity.create({
    proposalId: input.proposalId,
    action: input.action,
    message: input.message,
    actorId: input.actorId || null,
    metadata: input.metadata || null,
  });
}

export function sanitizeProposalHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "");
}
