import { PlatformPill } from "@/components/platform/platform-page-primitives";
import type { PlatformProposal } from "@/components/platform/proposals/types";

const STATUS_TONES: Record<PlatformProposal["status"], "slate" | "cyan" | "emerald" | "amber" | "rose" | "violet"> = {
  draft: "amber",
  ready: "cyan",
  sent: "violet",
  followed_up: "cyan",
  demo_scheduled: "emerald",
  pilot_started: "emerald",
  accepted: "emerald",
  rejected: "rose",
  archived: "slate",
};

export function ProposalStatusBadge({ status }: { status: PlatformProposal["status"] }) {
  return (
    <PlatformPill tone={STATUS_TONES[status]}>
      {status.replace(/_/g, " ")}
    </PlatformPill>
  );
}
