import Link from "next/link";
import { FileText, Plus, Send, Timer, Trophy } from "lucide-react";
import { PlatformMetricCard, PlatformMetricGrid, PlatformPageHeader, PlatformSection } from "@/components/platform/platform-page-primitives";
import { ProposalListClient } from "@/components/platform/proposals/ProposalListClient";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Proposal } from "@/models/Proposal";

export default async function PlatformProposalsPage() {
  await connectToDatabase();
  const [total, sent, dueFollowUp, accepted] = await Promise.all([
    Proposal.countDocuments({ status: { $ne: "archived" } }),
    Proposal.countDocuments({ status: "sent" }),
    Proposal.countDocuments({
      status: { $in: ["sent", "followed_up", "demo_scheduled"] },
      nextFollowUpDate: { $lte: new Date() },
    }),
    Proposal.countDocuments({ status: "accepted" }),
  ]);

  return (
    <div className="space-y-6">
      <PlatformPageHeader
        eyebrow="Growth Center"
        title="Proposal Center"
        description="Create, tailor, preview, send, and track formal EduSentrix proposals for schools."
        actions={
          <Link
            href="/platform/proposals/new"
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/15 px-3 py-2 text-sm text-emerald-100 hover:bg-emerald-500/20"
          >
            <Plus className="h-4 w-4" />
            New proposal
          </Link>
        }
      />

      <PlatformMetricGrid>
        <PlatformMetricCard icon={FileText} label="Active proposals" value={total.toLocaleString()} note="Not archived" tone="cyan" />
        <PlatformMetricCard icon={Send} label="Sent" value={sent.toLocaleString()} note="Awaiting response or follow-up" tone="violet" />
        <PlatformMetricCard icon={Timer} label="Due follow-ups" value={dueFollowUp.toLocaleString()} note="Need attention" tone="amber" />
        <PlatformMetricCard icon={Trophy} label="Accepted" value={accepted.toLocaleString()} note="Converted opportunities" tone="emerald" />
      </PlatformMetricGrid>

      <PlatformSection
        title="All proposals"
        description="Search, filter, and open proposal workspaces. The detail page is the operational center for each proposal."
      >
        <ProposalListClient />
      </PlatformSection>
    </div>
  );
}
