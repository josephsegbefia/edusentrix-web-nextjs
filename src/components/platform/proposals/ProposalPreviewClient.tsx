"use client";

import * as React from "react";
import { Download, Loader2, Mail, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { PlatformProposal } from "@/components/platform/proposals/types";

export function ProposalPreviewClient({
  proposal,
  html,
}: {
  proposal: PlatformProposal;
  html: string;
}) {
  const [working, setWorking] = React.useState<"generate" | "send" | null>(null);
  const [subject, setSubject] = React.useState(`Proposal for the Introduction of EduSentrix to ${proposal.schoolName}`);
  const [bodyHtml, setBodyHtml] = React.useState(
    `<p>Dear ${proposal.recipientTitle || proposal.recipientName || "Team"},</p><p>Please find attached a proposal introducing EduSentrix, a modern school management platform designed to support ${proposal.schoolName}.</p><p>We would be grateful for the opportunity to schedule a short demo at your convenience.</p><p>Kind regards,<br />EduSentrix</p>`,
  );

  async function generate() {
    setWorking("generate");
    try {
      const res = await fetch(`/api/platform/proposals/${proposal.id}/generate-pdf`, { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to generate proposal file");
      toast.success("Proposal file generated");
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate proposal file");
    } finally {
      setWorking(null);
    }
  }

  async function send() {
    if (!proposal.recipientEmail) {
      toast.error("Add recipient email before sending");
      return;
    }
    setWorking("send");
    try {
      const res = await fetch(`/api/platform/proposals/${proposal.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: proposal.recipientEmail,
          subject,
          bodyHtml,
          includeGeneratedFile: true,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to send proposal");
      toast.success("Proposal sent");
      window.location.href = `/platform/proposals/${proposal.id}`;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send proposal");
    } finally {
      setWorking(null);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white">
        <iframe title="Proposal preview" srcDoc={html} className="h-[900px] w-full bg-white" />
      </div>

      <div className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-5 text-white">
        <div>
          <h2 className="text-lg font-semibold">Prepare delivery</h2>
          <p className="mt-1 text-sm text-white/55">
            Generate an up-to-date file before sending. The current implementation downloads an HTML proposal file; PDF worker support can replace this output later.
          </p>
        </div>
        <Button onClick={generate} disabled={working !== null} className="w-full bg-cyan-500/20 text-cyan-100 hover:bg-cyan-500/30">
          {working === "generate" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Generate file
        </Button>
        <Button asChild variant="outline" disabled={!proposal.hasPdf} className="w-full border-white/10 bg-white/5 text-white/70">
          <a href={`/api/platform/proposals/${proposal.id}/download`}>
            <Download className="h-4 w-4" />
            Download file
          </a>
        </Button>
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Email subject</label>
          <Textarea value={subject} onChange={(e) => setSubject(e.target.value)} className="min-h-20 border-white/10 bg-white/5 text-white" />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Email body</label>
          <Textarea value={bodyHtml} onChange={(e) => setBodyHtml(e.target.value)} className="min-h-48 border-white/10 bg-white/5 text-white" />
        </div>
        <Button onClick={send} disabled={working !== null || !proposal.hasPdf || proposal.pdfIsStale} className="w-full bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30">
          {working === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          Send to {proposal.recipientEmail || "recipient"}
        </Button>
      </div>
    </div>
  );
}
