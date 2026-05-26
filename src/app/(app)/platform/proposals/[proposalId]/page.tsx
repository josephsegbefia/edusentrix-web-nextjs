import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye } from "lucide-react";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Proposal } from "@/models/Proposal";
import { ProposalActivity } from "@/models/ProposalActivity";
import { ProposalSendLog } from "@/models/ProposalSendLog";
import { serializeProposal, serializeProposalActivity, serializeProposalSendLog } from "@/lib/proposals/serialize";
import { PlatformPageHeader } from "@/components/platform/platform-page-primitives";
import { ProposalDetailClient } from "@/components/platform/proposals/ProposalDetailClient";

export default async function PlatformProposalDetailPage({
  params,
}: {
  params: Promise<{ proposalId: string }>;
}) {
  const gate = await requirePlatformPermission("platform.proposals.read");
  if (!gate.ok) return gate.res;
  await connectToDatabase();
  const { proposalId } = await params;
  const proposal = await Proposal.findById(proposalId).lean();
  if (!proposal) notFound();
  const [activities, sendLogs] = await Promise.all([
    ProposalActivity.find({ proposalId: proposal._id }).sort({ createdAt: -1 }).limit(50).lean(),
    ProposalSendLog.find({ proposalId: proposal._id }).sort({ createdAt: -1 }).limit(20).lean(),
  ]);

  return (
    <div className="space-y-6">
      <PlatformPageHeader
        eyebrow="Proposal Workspace"
        title={proposal.title}
        description="Manage the commercial record, edit sections, track follow-up, and prepare the proposal for PDF/send."
        actions={
          <>
            <Link href="/platform/proposals" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/75 hover:bg-white/10">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            <Link href={`/platform/proposals/${proposalId}/preview`} className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-500/15 px-3 py-2 text-sm text-cyan-100 hover:bg-cyan-500/20">
              <Eye className="h-4 w-4" />
              Preview
            </Link>
          </>
        }
      />

      <ProposalDetailClient
        initialData={{
          proposal: serializeProposal(proposal),
          activities: activities.map(serializeProposalActivity),
          sendLogs: sendLogs.map(serializeProposalSendLog),
        }}
      />
    </div>
  );
}
