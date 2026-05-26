import fs from "fs";
import path from "path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Proposal } from "@/models/Proposal";
import { ProposalBranding } from "@/models/ProposalBranding";
import { ensureDefaultProposalData } from "@/lib/proposals/utils";
import { renderProposalHtml } from "@/lib/proposals/render";
import { serializeProposal } from "@/lib/proposals/serialize";
import { PlatformPageHeader } from "@/components/platform/platform-page-primitives";
import { ProposalPreviewClient } from "@/components/platform/proposals/ProposalPreviewClient";

function getLogoDataUri(): string | null {
  const candidates = [
    path.join(process.cwd(), "public", "logo", "edusentrix-logo-transparent.png"),
    path.join(process.cwd(), "public", "logo", "edusentrix-logo.png"),
  ];
  for (const logoPath of candidates) {
    try {
      const data = fs.readFileSync(logoPath);
      return `data:image/png;base64,${data.toString("base64")}`;
    } catch {
      // try next
    }
  }
  return null;
}

export default async function PlatformProposalPreviewPage({
  params,
}: {
  params: Promise<{ proposalId: string }>;
}) {
  const gate = await requirePlatformPermission("platform.proposals.read");
  if (!gate.ok) return gate.res;
  await connectToDatabase();
  await ensureDefaultProposalData(gate.actor.userId);
  const { proposalId } = await params;
  const proposal = await Proposal.findById(proposalId).lean();
  if (!proposal) notFound();
  const branding = await ProposalBranding.findOne({}).lean();
  const html = renderProposalHtml(proposal, branding, getLogoDataUri());

  return (
    <div className="space-y-6">
      <PlatformPageHeader
        eyebrow="Proposal Preview"
        title={proposal.title}
        description="Review the client-facing proposal before generating the file and sending it by email."
        actions={
          <Link href={`/platform/proposals/${proposalId}`} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/75 hover:bg-white/10">
            <ArrowLeft className="h-4 w-4" />
            Back to workspace
          </Link>
        }
      />
      <ProposalPreviewClient proposal={serializeProposal(proposal)} html={html} />
    </div>
  );
}
