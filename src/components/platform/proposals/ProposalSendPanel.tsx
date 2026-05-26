"use client";

import * as React from "react";
import { useUser } from "@clerk/nextjs";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Mail,
  Paperclip,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { PlatformProposal, ProposalSendLog } from "@/components/platform/proposals/types";
import { formatTimestamp } from "@/components/platform/platform-page-primitives";

type Props = {
  proposal: PlatformProposal;
  sendLogs: ProposalSendLog[];
  fromEmail?: string;
  onSent: (log: ProposalSendLog) => void;
};

function resolveAdminName(user: ReturnType<typeof useUser>["user"]): string {
  if (!user) return "The EduSentrix Team";
  const full = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return full || user.fullName || "The EduSentrix Team";
}

/**
 * Build the default outbound email body.
 *
 * Salutation rules:
 * - If a name is known: "Dear [Name]," — no gendered title, works for any recipient.
 * - If no name: "Dear School Leadership," — professional, gender-neutral fallback.
 *
 * Sign-off uses the logged-in platform admin's real name from Clerk, not any
 * data stored on the proposal (which may be an email address).
 */
function defaultBody(proposal: PlatformProposal, adminName: string): string {
  const salutation = proposal.recipientName
    ? `Dear ${proposal.recipientName},`
    : "Dear School Leadership,";

  return [
    salutation,
    "",
    `We are reaching out to introduce EduSentrix and to share our formal proposal for ${proposal.schoolName}.`,
    "",
    "EduSentrix is a comprehensive school management platform built for Ghana's NaCCA curriculum, helping schools manage student records, lesson planning, attendance, fees, communications, and parent engagement — all in one place.",
    "",
    "Please find our proposal attached. It outlines the features, implementation approach, and pricing that best suits your school. We would love to discuss this further and answer any questions you may have.",
    "",
    "Please do not hesitate to reply to this email or reach out to schedule a brief demonstration at a time that is convenient for you.",
    "",
    "We look forward to hearing from you.",
    "",
    "Warm regards,",
    adminName,
    "EduSentrix",
    "hello@tryedusentrix.app",
  ].join("\n");
}

export function ProposalSendPanel({ proposal, sendLogs, fromEmail = "hello@tryedusentrix.app", onSent }: Props) {
  const { user, isLoaded } = useUser();
  const [open, setOpen] = React.useState(false);
  const [to, setTo] = React.useState(proposal.recipientEmail || "");
  const [subject, setSubject] = React.useState(`EduSentrix Proposal for ${proposal.schoolName}`);
  // Body is empty until Clerk resolves the admin name — usually < 100 ms.
  const [body, setBody] = React.useState<string>("");
  const [includePdf, setIncludePdf] = React.useState(proposal.hasPdf && !proposal.pdfIsStale);
  const [sending, setSending] = React.useState(false);
  const bodyInitialised = React.useRef(false);

  // Initialise the body exactly once, as soon as Clerk user data is available.
  React.useEffect(() => {
    if (isLoaded && !bodyInitialised.current) {
      bodyInitialised.current = true;
      setBody(defaultBody(proposal, resolveAdminName(user)));
    }
  }, [isLoaded, proposal, user]);

  const canIncludePdf = proposal.hasPdf && !proposal.pdfIsStale;
  const pdfWarning = proposal.hasPdf && proposal.pdfIsStale
    ? "PDF is stale — re-generate it before attaching."
    : !proposal.hasPdf
    ? "No PDF generated yet. Generate one in the preview before sending."
    : null;

  React.useEffect(() => {
    setIncludePdf(proposal.hasPdf && !proposal.pdfIsStale);
  }, [proposal.hasPdf, proposal.pdfIsStale]);

  async function handleSend() {
    if (!to.trim() || !subject.trim() || !body.trim()) {
      toast.error("Fill in the recipient, subject, and body before sending.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/platform/proposals/${proposal.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: to.trim(),
          subject: subject.trim(),
          bodyHtml: body.trim().replace(/\n/g, "<br />"),
          includeGeneratedFile: includePdf,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Send failed");
      }
      toast.success(`Proposal sent to ${to.trim()}`);
      onSent(json.data.sendLog as ProposalSendLog);
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send proposal");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03]">
      {/* header — always visible */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15">
            <Mail className="h-3.5 w-3.5 text-emerald-300" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Send proposal email</p>
            <p className="text-xs text-white/45">
              {sendLogs.length === 0
                ? "Not yet sent"
                : `Last sent ${formatTimestamp(sendLogs[0]?.sentAt ?? null)}`}
            </p>
          </div>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-white/40" />
        ) : (
          <ChevronDown className="h-4 w-4 text-white/40" />
        )}
      </button>

      {open && (
        <div className="space-y-3 border-t border-white/10 px-4 pb-4 pt-4">
          {/* from */}
          <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/5 px-3 py-2 text-xs text-white/50">
            <span className="shrink-0 text-white/30">From</span>
            <span className="font-medium text-white/70">{fromEmail}</span>
          </div>

          {/* to */}
          <div className="space-y-1">
            <label className="text-xs text-white/45">To</label>
            <Input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@school.edu.gh"
              className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
            />
          </div>

          {/* subject */}
          <div className="space-y-1">
            <label className="text-xs text-white/45">Subject</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="border-white/10 bg-white/5 text-white"
            />
          </div>

          {/* body */}
          <div className="space-y-1">
            <label className="text-xs text-white/45">Message body</label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="min-h-48 resize-y border-white/10 bg-white/5 font-mono text-xs leading-relaxed text-white placeholder:text-white/30"
              spellCheck
            />
            <p className="text-xs text-white/35">Plain text is fine — it will be sent as HTML.</p>
          </div>

          {/* pdf attachment */}
          <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
            <input
              id="include-pdf"
              type="checkbox"
              checked={includePdf}
              onChange={(e) => setIncludePdf(e.target.checked)}
              disabled={!canIncludePdf}
              className="mt-0.5 h-4 w-4 rounded border-white/30 accent-emerald-400 disabled:opacity-40"
            />
            <div className="min-w-0 flex-1">
              <label
                htmlFor="include-pdf"
                className={`flex items-center gap-1.5 text-sm font-medium ${canIncludePdf ? "cursor-pointer text-white/80" : "text-white/35"}`}
              >
                <Paperclip className="h-3.5 w-3.5" />
                Attach generated proposal file
              </label>
              {pdfWarning && (
                <p className="mt-1 flex items-center gap-1 text-xs text-amber-300">
                  <AlertCircle className="h-3 w-3" />
                  {pdfWarning}
                </p>
              )}
            </div>
          </div>

          {/* send button */}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleSend()}
              disabled={sending || !to.trim() || !subject.trim()}
              className="bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30 disabled:opacity-50"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {sending ? "Sending…" : "Send proposal"}
            </Button>
          </div>

          {/* send logs inline */}
          {sendLogs.length > 0 && (
            <div className="space-y-2 border-t border-white/10 pt-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-white/30">Send history</p>
              {sendLogs.slice(0, 5).map((log) => (
                <div
                  key={log.id}
                  className="flex items-start justify-between gap-2 rounded-xl border border-white/8 bg-white/5 px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <span className="block truncate text-white/70">{log.recipientEmail}</span>
                    <span className="text-white/40">{log.subject}</span>
                  </div>
                  <div className="shrink-0 text-right">
                    <span
                      className={`block font-medium ${
                        log.status === "sent" ? "text-emerald-300" : log.status === "failed" ? "text-rose-300" : "text-amber-300"
                      }`}
                    >
                      {log.status}
                    </span>
                    <span className="text-white/35">{formatTimestamp(log.sentAt ?? null)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
