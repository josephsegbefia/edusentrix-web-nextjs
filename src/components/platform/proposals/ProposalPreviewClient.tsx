"use client";

import * as React from "react";
import { Download, FileText, Loader2, Printer, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { PlatformProposal } from "@/components/platform/proposals/types";

export function ProposalPreviewClient({
  proposal,
  html,
}: {
  proposal: PlatformProposal;
  html: string;
}) {
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const [generating, setGenerating] = React.useState(false);

  async function regenerate() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/platform/proposals/${proposal.id}/generate-pdf`, { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to regenerate");
      toast.success("Proposal file updated — preview refreshed");
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to regenerate");
    } finally {
      setGenerating(false);
    }
  }

  function printAsPdf() {
    const win = iframeRef.current?.contentWindow;
    if (!win) {
      toast.error("Preview not ready — try again in a moment");
      return;
    }
    win.focus();
    win.print();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      {/* Preview iframe */}
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white shadow-xl">
        <iframe
          ref={iframeRef}
          title="Proposal preview"
          srcDoc={html}
          className="h-[900px] w-full bg-white"
        />
      </div>

      {/* Action panel */}
      <div className="space-y-5 rounded-3xl border border-white/10 bg-white/5 p-5 text-white">

        {/* Regenerate */}
        <div className="rounded-2xl border border-white/10 bg-white/4 p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-white">Update proposal file</p>
            <p className="mt-1 text-xs text-white/50">
              Re-renders the document from the latest section content. Run this whenever you edit the proposal.
            </p>
          </div>
          <Button
            onClick={regenerate}
            disabled={generating}
            className="w-full bg-cyan-500/20 text-cyan-100 hover:bg-cyan-500/30"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {generating ? "Regenerating…" : "Regenerate file"}
          </Button>
          {proposal.pdfIsStale && (
            <p className="text-xs text-amber-300">
              ⚠ The file is out of date — regenerate before saving or sending.
            </p>
          )}
          {!proposal.hasPdf && (
            <p className="text-xs text-white/45">No file yet — regenerate first.</p>
          )}
        </div>

        {/* Save as PDF */}
        <div className="rounded-2xl border border-white/10 bg-white/4 p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-white">Save as PDF</p>
            <p className="mt-1 text-xs text-white/50">
              Opens your browser&apos;s print dialog. Choose <strong className="text-white/70">Save as PDF</strong> as the destination — no printer required.
            </p>
          </div>
          <Button
            onClick={printAsPdf}
            className="w-full bg-violet-500/20 text-violet-100 hover:bg-violet-500/30"
          >
            <Printer className="h-4 w-4" />
            Print / Save as PDF
          </Button>
        </div>

        {/* Download HTML backup */}
        <div className="rounded-2xl border border-white/10 bg-white/4 p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-white">Download HTML file</p>
            <p className="mt-1 text-xs text-white/50">
              Downloads the raw HTML document. Open it in any browser and use <strong className="text-white/70">Print → Save as PDF</strong> to convert it.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              asChild
              variant="outline"
              disabled={!proposal.hasPdf}
              className="flex-1 border-white/10 bg-white/5 text-white/70 disabled:opacity-40"
            >
              <a href={`/api/platform/proposals/${proposal.id}/download`}>
                <Download className="h-4 w-4" />
                Download
              </a>
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const blob = new Blob([html], { type: "text/html" });
                const url = URL.createObjectURL(blob);
                window.open(url, "_blank");
              }}
              className="flex-1 border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            >
              <FileText className="h-4 w-4" />
              Open in tab
            </Button>
          </div>
        </div>

        {/* Back to workspace hint */}
        <p className="text-center text-xs text-white/30">
          Use the Send panel in the workspace to email the proposal with a custom message.
        </p>
      </div>
    </div>
  );
}
