"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, Eye, Loader2, MessageSquareQuote, Save, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
// TipTap v3 + Turbopack can cause "Maximum call stack size exceeded" during
// module initialisation. Lazy-loading with ssr:false defers TipTap entirely
// to the client bundle and avoids the Turbopack resolver collision.
//
// No `loading:` callback — providing one renders a <div> on the client during
// initial hydration while the server rendered null, shifting React's useId
// counter and causing aria-controls mismatches on all downstream Radix
// Select components. Without it, both sides render null initially.
const RichTextEditor = dynamic(
  () => import("@/components/ui/rich-text-editor").then((m) => ({ default: m.RichTextEditor })),
  { ssr: false },
);
import { PlatformPill, PlatformSection, formatDate, formatTimestamp } from "@/components/platform/platform-page-primitives";
import { ProposalStatusBadge } from "@/components/platform/proposals/ProposalStatusBadge";
import type { PlatformProposal, ProposalActivity, ProposalSendLog } from "@/components/platform/proposals/types";
import { ProposalSendPanel } from "@/components/platform/proposals/ProposalSendPanel";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";

type DetailPayload = {
  proposal: PlatformProposal;
  activities: ProposalActivity[];
  sendLogs: ProposalSendLog[];
};

export function ProposalDetailClient({ initialData }: { initialData: DetailPayload }) {
  const router = useRouter();
  const [proposal, setProposal] = React.useState(initialData.proposal);
  const [activities, setActivities] = React.useState(initialData.activities);
  const [sendLogs, setSendLogs] = React.useState(initialData.sendLogs);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [leoLoading, setLeoLoading] = React.useState(false);
  const [leoInstruction, setLeoInstruction] = React.useState("");
  const [activeSectionKey, setActiveSectionKey] = React.useState(proposal.sections[0]?.key || "");
  const [loggingReply, setLoggingReply] = React.useState(false);
  const [replyNote, setReplyNote] = React.useState("");
  const [showReplyLog, setShowReplyLog] = React.useState(false);
  const { confirm, confirmationDialog } = useConfirmationDialog();

  const activeSection = proposal.sections.find((section) => section.key === activeSectionKey) || proposal.sections[0];

  function hasSectionContent(content: string) {
    return content.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length > 0;
  }

  function updateProposal(patch: Partial<PlatformProposal>) {
    setProposal((prev) => ({ ...prev, ...patch }));
  }

  function updateActiveSection(patch: Partial<PlatformProposal["sections"][number]>) {
    if (!activeSection) return;
    setProposal((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
        section.key === activeSection.key ? { ...section, ...patch } : section,
      ),
    }));
  }

  async function save(patch?: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = await fetch(`/api/platform/proposals/${proposal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          patch || {
            title: proposal.title,
            schoolName: proposal.schoolName,
            schoolLocation: proposal.schoolLocation,
            recipientName: proposal.recipientName,
            recipientTitle: proposal.recipientTitle,
            recipientEmail: proposal.recipientEmail,
            recipientPhone: proposal.recipientPhone,
            selectedModules: proposal.selectedModules,
            sections: proposal.sections,
            pricing: proposal.pricing,
            nextFollowUpDate: proposal.nextFollowUpDate,
            followUpNotes: proposal.followUpNotes,
            internalNotes: proposal.internalNotes,
          },
        ),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to save proposal");
      setProposal(json.data);
      toast.success("Proposal saved");
      await refreshActivity();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save proposal");
    } finally {
      setSaving(false);
    }
  }

  async function refreshActivity() {
    const res = await fetch(`/api/platform/proposals/${proposal.id}/activity`, { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (res.ok && json?.success) setActivities(json.data.activities);
  }

  async function logReply() {
    if (!replyNote.trim()) {
      toast.error("Add a note describing the reply before logging it.");
      return;
    }
    setLoggingReply(true);
    try {
      const res = await fetch(`/api/platform/proposals/${proposal.id}/log-reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: replyNote.trim() }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Could not log reply");
      toast.success("Reply logged");
      setReplyNote("");
      setShowReplyLog(false);
      await refreshActivity();
      if (proposal.status === "sent") {
        setProposal((prev) => ({ ...prev, status: "followed_up" }));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not log reply");
    } finally {
      setLoggingReply(false);
    }
  }

  async function generateSectionWithLeo() {
    if (!activeSection) return;
    setLeoLoading(true);
    try {
      const res = await fetch(`/api/platform/proposals/${proposal.id}/leo-section`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionKey: activeSection.key,
          instruction: leoInstruction,
          tone: "formal",
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Leo could not generate content");
      }
      updateActiveSection({ content: json.data.content });
      toast.success(json.data.source === "fallback" ? "Draft inserted. Configure OpenAI for richer Leo output." : "Leo draft inserted");
      setLeoInstruction("");
      await refreshActivity();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Leo could not generate content");
    } finally {
      setLeoLoading(false);
    }
  }

  async function deleteProposal() {
    const isArchived = proposal.status === "archived";
    const decision = await confirm({
      title: isArchived ? "Permanently delete proposal?" : "Delete proposal?",
      description: isArchived
        ? `This will permanently delete "${proposal.title}" and remove its proposal activity and send logs. This cannot be undone.`
        : proposal.status === "draft"
          ? `This will remove "${proposal.title}" from the active proposal list. You can still find it under Archived.`
          : `This will archive "${proposal.title}" and remove it from the active proposal list while keeping history and send logs intact.`,
      confirmLabel: isArchived ? "Permanently delete" : "Delete proposal",
      cancelLabel: "Keep proposal",
      intent: "destructive",
    });
    if (decision !== "confirm") return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/platform/proposals/${proposal.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to delete proposal");
      toast.success(isArchived ? "Proposal permanently deleted" : "Proposal deleted");
      router.push("/platform/proposals");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete proposal");
      setDeleting(false);
    }
  }

  return (
    <>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <PlatformSection
          title="Proposal details"
          description="This is the operating record. Keep school, recipient, pricing, and follow-up context accurate."
          action={
            <div className="flex gap-2">
              <Button asChild variant="outline" className="border-white/10 bg-white/5 text-white/70">
                <Link href={`/platform/proposals/${proposal.id}/preview`}>
                  <Eye className="h-4 w-4" />
                  Preview
                </Link>
              </Button>
              <Button onClick={() => void save()} disabled={saving} className="bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void deleteProposal()}
                disabled={deleting}
                className="border-rose-400/20 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {proposal.status === "archived" ? "Permanently delete" : "Delete"}
              </Button>
            </div>
          }
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Input value={proposal.title} onChange={(e) => updateProposal({ title: e.target.value })} className="border-white/10 bg-white/5 text-white md:col-span-2" />
            <Input value={proposal.schoolName} onChange={(e) => updateProposal({ schoolName: e.target.value })} className="border-white/10 bg-white/5 text-white" />
            <Input value={proposal.schoolLocation} onChange={(e) => updateProposal({ schoolLocation: e.target.value })} className="border-white/10 bg-white/5 text-white" />
            <Input value={proposal.recipientName} onChange={(e) => updateProposal({ recipientName: e.target.value })} className="border-white/10 bg-white/5 text-white" />
            <Input value={proposal.recipientEmail} onChange={(e) => updateProposal({ recipientEmail: e.target.value })} className="border-white/10 bg-white/5 text-white" />
          </div>
        </PlatformSection>

        <PlatformSection title="Section editor" description="Edit proposal sections. Disabled sections stay in draft but do not render in the final preview.">
          <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
            <div className="space-y-2">
              {proposal.sections.map((section) => {
                const isActive = activeSection?.key === section.key;
                const isComplete = section.enabled && hasSectionContent(section.content);

                return (
                  <button
                    key={section.key}
                    onClick={() => setActiveSectionKey(section.key)}
                    className={`w-full rounded-2xl border px-3 py-2 text-left text-sm transition ${
                      isActive
                        ? "border-cyan-400/30 bg-cyan-500/10 text-cyan-50"
                        : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                    }`}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{section.title}</span>
                        <span className="text-xs text-white/40">
                          Section {section.order}
                          {!section.enabled ? " · Disabled" : ""}
                        </span>
                      </span>
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                          isComplete
                            ? "border-emerald-300/40 bg-emerald-400/15 text-emerald-100"
                            : "border-white/10 bg-white/5 text-white/25"
                        }`}
                        aria-label={isComplete ? "Section completed" : "Section not completed"}
                      >
                        {isComplete ? <Check className="h-3.5 w-3.5" /> : null}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            {activeSection ? (
              <div className="space-y-3">
                <Input value={activeSection.title} onChange={(e) => updateActiveSection({ title: e.target.value })} className="border-white/10 bg-white/5 text-white" />
                <PremiumSelect value={activeSection.displayStyle} onValueChange={(value) => updateActiveSection({ displayStyle: value as PlatformProposal["sections"][number]["displayStyle"] })}>
                  <PremiumSelectTrigger>
                    <PremiumSelectValue />
                  </PremiumSelectTrigger>
                  <PremiumSelectContent>
                    <PremiumSelectItem value="standard">Standard</PremiumSelectItem>
                    <PremiumSelectItem value="highlight">Highlight</PremiumSelectItem>
                    <PremiumSelectItem value="cards">Cards</PremiumSelectItem>
                    <PremiumSelectItem value="table">Table</PremiumSelectItem>
                    <PremiumSelectItem value="callout">Callout</PremiumSelectItem>
                  </PremiumSelectContent>
                </PremiumSelect>
                <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-3">
                  <div className="flex items-start gap-3">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div>
                        <p className="text-sm font-semibold text-amber-100">Leo section assistant</p>
                        <p className="text-xs text-white/55">Generate an editable official-draft version of this section.</p>
                      </div>
                      <Textarea
                        value={leoInstruction}
                        onChange={(event) => setLeoInstruction(event.target.value)}
                        placeholder="Optional instruction, e.g. emphasize mobile app and finance controls"
                        className="min-h-20 border-white/10 bg-black/20 text-white placeholder:text-white/35"
                      />
                      <Button
                        type="button"
                        onClick={() => void generateSectionWithLeo()}
                        disabled={leoLoading}
                        className="bg-amber-500/20 text-amber-100 hover:bg-amber-500/30"
                      >
                        {leoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        {leoLoading ? "Leo is drafting..." : "Generate with Leo"}
                      </Button>
                    </div>
                  </div>
                </div>
                <RichTextEditor
                  value={activeSection.content}
                  onChange={(content) => updateActiveSection({ content })}
                  placeholder={`Write the ${activeSection.title.toLowerCase()} section...`}
                  toolbarVariant="full"
                  minHeight="280px"
                  maxHeight="560px"
                  className="border-white/10 bg-white/5"
                  editorClassName="prose-p:text-white/85 prose-headings:text-white"
                />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => updateActiveSection({ enabled: !activeSection.enabled })} className="border-white/10 bg-white/5 text-white/70">
                    {activeSection.enabled ? "Disable section" : "Enable section"}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </PlatformSection>
      </div>

      <div className="space-y-4">
        {/* Send panel — primary action */}
        <ProposalSendPanel
          proposal={proposal}
          sendLogs={sendLogs}
          onSent={(log) => {
            setSendLogs((prev) => [log, ...prev]);
            setProposal((prev) => ({
              ...prev,
              status: "sent",
              sentAt: log.sentAt,
            }));
            void refreshActivity();
          }}
        />

        {/* Log a reply */}
        <div className="rounded-2xl border border-white/10 bg-white/3">
          <button
            type="button"
            onClick={() => setShowReplyLog((v) => !v)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/15">
              <MessageSquareQuote className="h-3.5 w-3.5 text-violet-300" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Log a reply</p>
              <p className="text-xs text-white/45">Record a reply or response you received from this school.</p>
            </div>
          </button>
          {showReplyLog && (
            <div className="space-y-3 border-t border-white/10 px-4 pb-4 pt-3">
              <Textarea
                value={replyNote}
                onChange={(e) => setReplyNote(e.target.value)}
                placeholder="e.g. Principal Mensah called back — interested, requested pricing breakdown for 450 students"
                className="min-h-24 border-white/10 bg-white/5 text-white placeholder:text-white/30"
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowReplyLog(false)}
                  className="border-white/10 bg-white/5 text-white/60"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => void logReply()}
                  disabled={loggingReply || !replyNote.trim()}
                  className="bg-violet-500/20 text-violet-100 hover:bg-violet-500/30 disabled:opacity-50"
                >
                  {loggingReply ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquareQuote className="h-4 w-4" />}
                  {loggingReply ? "Logging…" : "Log reply"}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Status */}
        <PlatformSection title="Status" description="Pipeline and document readiness.">
          <div className="space-y-3">
            <ProposalStatusBadge status={proposal.status} />
            <div className="grid grid-cols-2 gap-2 text-sm text-white/60">
              <span>Version</span>
              <span className="text-right text-white">{proposal.version}</span>
              <span>PDF</span>
              <span className="text-right">
                {proposal.hasPdf ? (
                  <PlatformPill tone={proposal.pdfIsStale ? "amber" : "emerald"}>{proposal.pdfIsStale ? "stale" : "ready"}</PlatformPill>
                ) : (
                  <PlatformPill>missing</PlatformPill>
                )}
              </span>
              <span>Sent</span>
              <span className="text-right text-white">{formatDate(proposal.sentAt)}</span>
            </div>
            <PremiumSelect value={proposal.status} onValueChange={(status) => void save({ status })}>
              <PremiumSelectTrigger>
                <PremiumSelectValue />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {["draft", "ready", "sent", "followed_up", "demo_scheduled", "pilot_started", "accepted", "rejected"].map((status) => (
                  <PremiumSelectItem key={status} value={status}>
                    {status.replace(/_/g, " ")}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
          </div>
        </PlatformSection>

        {/* Follow-up */}
        <PlatformSection title="Follow-up" description="Keep sales motion visible.">
          <div className="space-y-3">
            <CustomDatePicker
              value={proposal.nextFollowUpDate ? new Date(proposal.nextFollowUpDate) : undefined}
              onChange={(date) => updateProposal({ nextFollowUpDate: date ? date.toISOString() : null })}
              placeholder="Next follow-up date"
            />
            <Textarea value={proposal.followUpNotes || ""} onChange={(e) => updateProposal({ followUpNotes: e.target.value } as Partial<PlatformProposal>)} className="min-h-24 border-white/10 bg-white/5 text-white" />
          </div>
        </PlatformSection>

        {/* Activity */}
        <PlatformSection title="Activity" description="Recent proposal history.">
          <div className="space-y-2">
            {activities.length === 0 ? (
              <p className="text-sm text-white/40">No activity yet.</p>
            ) : (
              activities.slice(0, 12).map((activity) => (
                <div key={activity.id} className="rounded-xl border border-white/8 bg-white/3 px-3 py-2.5 text-sm">
                  <div className="flex items-start gap-2 text-white/80">
                    <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300/70" />
                    <span className="leading-snug">{activity.message}</span>
                  </div>
                  <div className="mt-1 pl-5.5 text-xs text-white/35">{formatTimestamp(activity.createdAt)}</div>
                </div>
              ))
            )}
          </div>
        </PlatformSection>
      </div>
    </div>
    {confirmationDialog}
    </>
  );
}
