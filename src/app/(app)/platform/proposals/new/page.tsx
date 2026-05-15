import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { PlatformPageHeader, PlatformSection } from "@/components/platform/platform-page-primitives";
import { ProposalCreateForm } from "@/components/platform/proposals/ProposalCreateForm";

export default function NewPlatformProposalPage() {
  return (
    <div className="space-y-6">
      <PlatformPageHeader
        eyebrow="Growth Center"
        title="New Proposal"
        description="Create a structured EduSentrix proposal from the default full-school template, then refine sections before sending."
        actions={
          <Link
            href="/platform/proposals"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/75 hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to proposals
          </Link>
        }
      />

      <PlatformSection
        title="Proposal setup"
        description="Capture the school, recipient, modules, and pricing context. Content sections are generated after creation."
      >
        <ProposalCreateForm />
      </PlatformSection>
    </div>
  );
}
