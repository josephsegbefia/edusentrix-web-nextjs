"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarDays, Eye, Loader2, Save, Send, Sparkles } from "lucide-react";
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
import { PlatformPill, PlatformSection, formatDate, formatTimestamp } from "@/components/platform/platform-page-primitives";
import { ProposalStatusBadge } from "@/components/platform/proposals/ProposalStatusBadge";
import type { PlatformProposal, ProposalActivity, ProposalSendLog } from "@/components/platform/proposals/types";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";

type DetailPayload = {
  proposal: PlatformProposal;
  activities: ProposalActivity[];
  sendLogs: ProposalSendLog[];
};

export function ProposalDetailClient({ initialData }: { initialData: DetailPayload }) {
  const [proposal, setProposal] = React.useState(initialData.proposal);
  const [activities, setActivities] = React.useState(initialData.activities);
  const [saving, setSaving] = React.useState(false);
  const [leoLoading, setLeoLoading] = React.useState(false);
  const [leoInstruction, setLeoInstruction] = React.useState("");
  const [activeSectionKey, setActiveSectionKey] = React.useState(proposal.sections[0]?.key || "");

  const activeSection = proposal.sections.find((section) => section.key === activeSectionKey) || proposal.sections[0];

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

  return (
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
              {proposal.sections.map((section) => (
                <button
                  key={section.key}
                  onClick={() => setActiveSectionKey(section.key)}
                  className={`w-full rounded-2xl border px-3 py-2 text-left text-sm transition ${
                    activeSection?.key === section.key
                      ? "border-cyan-400/30 bg-cyan-500/10 text-cyan-50"
                      : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                  }`}
                >
                  <span className="block font-medium">{section.title}</span>
                  <span className="text-xs text-white/40">Section {section.order}</span>
                </button>
              ))}
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
                <Textarea value={activeSection.content} onChange={(e) => updateActiveSection({ content: e.target.value })} className="min-h-72 border-white/10 bg-white/5 text-white" />
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

      <div className="space-y-6">
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

        <PlatformSection title="Activity" description="Recent proposal history.">
          <div className="space-y-3">
            {activities.slice(0, 8).map((activity) => (
              <div key={activity.id} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm">
                <div className="flex items-center gap-2 text-white">
                  <CalendarDays className="h-4 w-4 text-cyan-200" />
                  {activity.message}
                </div>
                <div className="mt-1 text-xs text-white/45">{formatTimestamp(activity.createdAt)}</div>
              </div>
            ))}
          </div>
        </PlatformSection>

        <PlatformSection title="Send logs" description="Email delivery attempts.">
          <div className="space-y-2">
            {initialData.sendLogs.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/50">
                No send logs yet.
              </div>
            ) : (
              initialData.sendLogs.map((log) => (
                <div key={log.id} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/65">
                  <div className="flex items-center gap-2 text-white">
                    <Send className="h-4 w-4 text-emerald-200" />
                    {log.recipientEmail}
                  </div>
                  <div className="mt-1 text-xs text-white/45">{log.status} · {formatTimestamp(log.createdAt)}</div>
                </div>
              ))
            )}
          </div>
        </PlatformSection>
      </div>
    </div>
  );
}
