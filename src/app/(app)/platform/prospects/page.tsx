"use client";

import * as React from "react";
import Link from "next/link";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  FileText,
  FilePlus2,
  Loader2,
  Pencil,
  PhoneCall,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { GhanaPhoneInput } from "@/components/ui/ghana-phone-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import {
  PlatformMetricCard,
  PlatformMetricGrid,
  PlatformPageHeader,
  PlatformSection,
} from "@/components/platform/platform-page-primitives";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";
import { cn } from "@/lib/utils";

type ProspectStatus =
  | "new"
  | "contacted"
  | "meeting_scheduled"
  | "demo_done"
  | "proposal_preparing"
  | "proposal_sent"
  | "follow_up_due"
  | "won"
  | "lost"
  | "on_hold";

type Prospect = {
  id: string;
  schoolName: string;
  location: string;
  contactName: string;
  contactTitle: string;
  contactPhone: string;
  contactEmail: string;
  source: string;
  status: ProspectStatus;
  priority: "low" | "normal" | "high";
  notes: string;
  latestProposalId: string | null;
  proposalCount: number;
  nextFollowUpAt: string | null;
};

type PageData = {
  prospects: Prospect[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  stats: { dueToday: number; byStatus: Record<string, number> };
};

const STATUS_OPTIONS: Array<{ value: ProspectStatus | "all"; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "meeting_scheduled", label: "Meeting scheduled" },
  { value: "demo_done", label: "Demo done" },
  { value: "proposal_preparing", label: "Proposal preparing" },
  { value: "proposal_sent", label: "Proposal sent" },
  { value: "follow_up_due", label: "Follow-up due" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "on_hold", label: "On hold" },
];

const STATUS_TONES: Record<ProspectStatus, "slate" | "cyan" | "emerald" | "amber" | "rose" | "violet"> = {
  new: "cyan",
  contacted: "slate",
  meeting_scheduled: "violet",
  demo_done: "emerald",
  proposal_preparing: "amber",
  proposal_sent: "emerald",
  follow_up_due: "amber",
  won: "emerald",
  lost: "rose",
  on_hold: "slate",
};

const PRIORITY_TONES: Record<Prospect["priority"], "slate" | "amber" | "rose"> = {
  low: "slate",
  normal: "amber",
  high: "rose",
};

const BADGE_TONES = {
  slate: "border-white/10 bg-white/8 text-white/70 shadow-white/5",
  cyan: "border-cyan-300/25 bg-cyan-400/12 text-cyan-100 shadow-cyan-500/10",
  emerald: "border-emerald-300/25 bg-emerald-400/12 text-emerald-100 shadow-emerald-500/10",
  amber: "border-amber-300/25 bg-amber-400/12 text-amber-100 shadow-amber-500/10",
  rose: "border-rose-300/25 bg-rose-400/12 text-rose-100 shadow-rose-500/10",
  violet: "border-violet-300/25 bg-violet-400/12 text-violet-100 shadow-violet-500/10",
};

function CompactBadge({
  tone = "slate",
  children,
  className,
}: {
  tone?: keyof typeof BADGE_TONES;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11px] font-semibold uppercase tracking-[0.08em] shadow-sm",
        BADGE_TONES[tone],
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {children}
    </span>
  );
}

function IconAction({
  label,
  disabled,
  onClick,
  children,
  className,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
          className={cn(
            "h-9 w-9 rounded-xl border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white",
            className,
          )}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

function toIsoDate(date: Date | null) {
  if (!date) return null;
  const normalized = new Date(date);
  normalized.setHours(12, 0, 0, 0);
  return normalized.toISOString();
}

const blankForm = {
  schoolName: "",
  location: "",
  contactName: "",
  contactTitle: "",
  contactPhone: "",
  contactEmail: "",
  source: "notepad",
  status: "new" as ProspectStatus,
  priority: "normal",
  notes: "",
  nextFollowUpAt: null as Date | null,
};

export default function PlatformProspectsPage() {
  const [data, setData] = React.useState<PageData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  const [status, setStatus] = React.useState("all");
  const [query, setQuery] = React.useState("");
  const [dueOnly, setDueOnly] = React.useState(false);
  const [form, setForm] = React.useState(blankForm);
  const [editingProspect, setEditingProspect] = React.useState<Prospect | null>(null);
  const [editForm, setEditForm] = React.useState(blankForm);
  const { confirm, confirmationDialog } = useConfirmationDialog();

  const fetchData = React.useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (status !== "all") params.set("status", status);
      if (query.trim()) params.set("q", query.trim());
      if (dueOnly) params.set("due", "today");
      const res = await fetch(`/api/platform/prospects?${params}`);
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to load prospects");
      }
      setData(json.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load prospects");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dueOnly, page, query, status]);

  React.useEffect(() => {
    void fetchData();
  }, [fetchData]);

  function updateForm(key: keyof typeof form, value: string | Date | null) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateEditForm(key: keyof typeof editForm, value: string | Date | null) {
    setEditForm((prev) => ({ ...prev, [key]: value }));
  }

  function openEditProspect(prospect: Prospect) {
    setEditingProspect(prospect);
    setEditForm({
      schoolName: prospect.schoolName,
      location: prospect.location,
      contactName: prospect.contactName,
      contactTitle: prospect.contactTitle,
      contactPhone: prospect.contactPhone,
      contactEmail: prospect.contactEmail,
      source: prospect.source || "notepad",
      status: prospect.status,
      priority: prospect.priority,
      notes: prospect.notes,
      nextFollowUpAt: prospect.nextFollowUpAt ? new Date(prospect.nextFollowUpAt) : null,
    });
  }

  async function createProspect(event: React.FormEvent) {
    event.preventDefault();
    if (!form.schoolName.trim()) {
      toast.error("School name is required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/platform/prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          nextFollowUpAt: toIsoDate(form.nextFollowUpAt),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to add prospect");
      toast.success("Prospect added");
      setForm(blankForm);
      setPage(1);
      await fetchData(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add prospect");
    } finally {
      setSubmitting(false);
    }
  }

  async function patchProspect(id: string, payload: Record<string, unknown>) {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/platform/prospects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to update prospect");
      setData((prev) =>
        prev
          ? {
              ...prev,
              prospects: prev.prospects.map((prospect) =>
                prospect.id === id ? json.data : prospect,
              ),
            }
          : prev,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update prospect");
    } finally {
      setUpdatingId(null);
    }
  }

  async function saveEditedProspect(event: React.FormEvent) {
    event.preventDefault();
    if (!editingProspect) return;
    if (!editForm.schoolName.trim()) {
      toast.error("School name is required");
      return;
    }

    setUpdatingId(editingProspect.id);
    try {
      const res = await fetch(`/api/platform/prospects/${editingProspect.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editForm,
          nextFollowUpAt: toIsoDate(editForm.nextFollowUpAt),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to save prospect");
      setData((prev) =>
        prev
          ? {
              ...prev,
              prospects: prev.prospects.map((prospect) =>
                prospect.id === editingProspect.id ? json.data : prospect,
              ),
            }
          : prev,
      );
      toast.success("Prospect updated");
      setEditingProspect(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save prospect");
    } finally {
      setUpdatingId(null);
    }
  }

  async function deleteProspect(prospect: Prospect) {
    const decision = await confirm({
      title: "Delete prospect?",
      description: prospect.latestProposalId
        ? `This will delete "${prospect.schoolName}" from the prospect tracker and unlink its proposals. The proposals themselves will remain.`
        : `This will delete "${prospect.schoolName}" from the prospect tracker.`,
      confirmLabel: "Delete prospect",
      cancelLabel: "Keep prospect",
      intent: "destructive",
    });
    if (decision !== "confirm") return;

    setUpdatingId(prospect.id);
    try {
      const res = await fetch(`/api/platform/prospects/${prospect.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to delete prospect");
      toast.success("Prospect deleted");
      await fetchData(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete prospect");
    } finally {
      setUpdatingId(null);
    }
  }

  async function createProposal(prospect: Prospect) {
    setUpdatingId(prospect.id);
    try {
      const modules =
        prospect.status === "demo_done"
          ? ["Fees, Invoices & Payments", "Reports & Analytics", "Notices & Communication"]
          : ["Student Records", "Fees, Invoices & Payments", "Notices & Communication"];
      const res = await fetch("/api/platform/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospectId: prospect.id,
          source: "prospect",
          schoolName: prospect.schoolName,
          schoolLocation: prospect.location,
          recipientName: prospect.contactName,
          recipientTitle: prospect.contactTitle,
          recipientEmail: prospect.contactEmail,
          recipientPhone: prospect.contactPhone,
          proposalType: "general",
          selectedModules: modules,
          internalNotes: prospect.notes,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to create proposal");
      toast.success("Proposal created from prospect");
      await fetchData(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create proposal");
    } finally {
      setUpdatingId(null);
    }
  }

  const total = data?.pagination.total ?? 0;
  const totalPages = data?.pagination.totalPages ?? 1;
  const byStatus = data?.stats.byStatus ?? {};

  return (
    <div className="space-y-6 p-2 md:p-4">
      <PlatformPageHeader
        eyebrow="Growth pipeline"
        title="Prospects"
        description="Track schools from your notepad, calls, demos, proposal sends, and follow-ups without turning the workflow into a heavy CRM."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading || refreshing}
            onClick={() => void fetchData(true)}
            className="border-white/10 bg-white/5 text-white hover:bg-white/10"
          >
            {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        }
      />

      <PlatformMetricGrid>
        <PlatformMetricCard icon={Users} label="Prospects" value={total.toLocaleString()} note="Manual school contacts in the growth tracker." tone="cyan" />
        <PlatformMetricCard icon={CalendarClock} label="Due now" value={(data?.stats.dueToday ?? 0).toLocaleString()} note="Follow-ups due today or overdue." tone="amber" />
        <PlatformMetricCard icon={FileText} label="Proposal sent" value={(byStatus.proposal_sent ?? 0).toLocaleString()} note="Prospects with a sent proposal milestone." tone="emerald" />
        <PlatformMetricCard icon={Search} label="Open deals" value={((byStatus.new ?? 0) + (byStatus.contacted ?? 0) + (byStatus.follow_up_due ?? 0)).toLocaleString()} note="New, contacted, and follow-up due prospects." tone="violet" />
      </PlatformMetricGrid>

      <PlatformSection
        title="Add prospect"
        description="Capture the school and contact details directly from your notepad."
        className="overflow-hidden bg-linear-to-br from-white/8 via-white/5 to-cyan-500/5"
      >
        <form onSubmit={createProspect} className="space-y-5">
          <div className="grid gap-4 xl:grid-cols-[1fr_1fr_280px]">
            <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200/70">School</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-white/55">School name</Label>
                  <Input value={form.schoolName} onChange={(e) => updateForm("schoolName", e.target.value)} placeholder="Jacob's Preparatory School" className="h-11 border-white/10 bg-white/5 text-white placeholder:text-white/30" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-white/55">Location</Label>
                  <Input value={form.location} onChange={(e) => updateForm("location", e.target.value)} placeholder="Town / area" className="h-11 border-white/10 bg-white/5 text-white placeholder:text-white/30" />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200/70">Contact</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-white/55">Contact person</Label>
                  <Input value={form.contactName} onChange={(e) => updateForm("contactName", e.target.value)} placeholder="Name" className="h-11 border-white/10 bg-white/5 text-white placeholder:text-white/30" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-white/55">Role / title</Label>
                  <Input value={form.contactTitle} onChange={(e) => updateForm("contactTitle", e.target.value)} placeholder="Headteacher, admin, owner" className="h-11 border-white/10 bg-white/5 text-white placeholder:text-white/30" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-white/55">Mobile number</Label>
                  <GhanaPhoneInput value={form.contactPhone} onChange={(e) => updateForm("contactPhone", e.target.value)} className="h-11 border-white/10 bg-white/5 text-white placeholder:text-white/30" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-white/55">Email</Label>
                  <Input value={form.contactEmail} onChange={(e) => updateForm("contactEmail", e.target.value)} placeholder="name@school.com" className="h-11 border-white/10 bg-white/5 text-white placeholder:text-white/30" />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200/70">Follow-up</p>
              <div className="mt-4 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-white/55">Priority</Label>
                  <PremiumSelect value={form.priority} onValueChange={(value) => updateForm("priority", value)}>
                    <PremiumSelectTrigger className="h-11 border-white/10 bg-white/5 text-white"><PremiumSelectValue /></PremiumSelectTrigger>
                    <PremiumSelectContent>
                      <PremiumSelectItem value="low">Low priority</PremiumSelectItem>
                      <PremiumSelectItem value="normal">Normal priority</PremiumSelectItem>
                      <PremiumSelectItem value="high">High priority</PremiumSelectItem>
                    </PremiumSelectContent>
                  </PremiumSelect>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-white/55">Next follow-up</Label>
                  <CustomDatePicker value={form.nextFollowUpAt} onChange={(date) => updateForm("nextFollowUpAt", date)} placeholder="Pick a date" className="h-11 border-white/10 bg-white/5 text-white" />
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="space-y-1.5">
              <Label className="text-xs text-white/55">Notes</Label>
              <Textarea value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} placeholder="Short notes from visit, call, referral, or next action" className="min-h-24 border-white/10 bg-black/15 text-white placeholder:text-white/30" />
            </div>
            <Button disabled={submitting} className="h-12 min-w-[180px] bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30">
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Add prospect
            </Button>
          </div>
        </form>
      </PlatformSection>

      <PlatformSection
        title="Prospect queue"
        description="Move schools through contact, demo, proposal, and follow-up states."
        action={
          <div className="grid gap-2 sm:grid-cols-[220px_220px_auto]">
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search"
              className="border-white/10 bg-white/5 text-white"
            />
            <PremiumSelect value={status} onValueChange={(value) => { setStatus(value); setPage(1); }}>
              <PremiumSelectTrigger className="border-white/10 bg-white/5 text-white"><PremiumSelectValue /></PremiumSelectTrigger>
              <PremiumSelectContent>
                {STATUS_OPTIONS.map((option) => <PremiumSelectItem key={option.value} value={option.value}>{option.label}</PremiumSelectItem>)}
              </PremiumSelectContent>
            </PremiumSelect>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDueOnly((value) => !value);
                setPage(1);
              }}
              className="border-white/10 bg-white/5 text-white hover:bg-white/10"
            >
              {dueOnly ? "Showing due" : "Due only"}
            </Button>
          </div>
        }
      >
        <TooltipProvider delayDuration={150}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-white/45">
                <th className="pb-3 font-medium">School</th>
                <th className="pb-3 font-medium">Contact</th>
                <th className="pb-3 font-medium">Phone</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Priority</th>
                <th className="pb-3 font-medium">Follow-up</th>
                <th className="pb-3 font-medium">Proposal</th>
                <th className="pb-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && !data ? (
                <tr><td colSpan={8} className="py-12 text-center text-white/45"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading prospects...</td></tr>
              ) : !data?.prospects.length ? (
                <tr><td colSpan={8} className="py-12 text-center text-white/45">No prospects match this view.</td></tr>
              ) : (
                data.prospects.map((prospect) => (
                  <tr key={prospect.id} className="border-b border-white/5 align-middle hover:bg-white/2">
                    <td className="py-3 pr-4">
                      <div className="flex max-w-[250px] items-center gap-2">
                        <span className="truncate font-medium text-white">{prospect.schoolName}</span>
                        <span className="shrink-0 text-white/25">·</span>
                        <span className="truncate text-xs text-white/45">{prospect.location || "No location"}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex max-w-[260px] items-center gap-2">
                        <span className="truncate text-white/75">{prospect.contactName || "No contact"}</span>
                        <span className="shrink-0 text-white/25">·</span>
                        <span className="truncate text-xs text-white/45">{prospect.contactTitle || prospect.contactEmail || "No role/email"}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap text-white/60">{prospect.contactPhone || "—"}</td>
                    <td className="py-3 pr-4">
                      <PremiumSelect
                        value={prospect.status}
                        disabled={updatingId === prospect.id}
                        onValueChange={(value) => void patchProspect(prospect.id, { status: value })}
                      >
                        <PremiumSelectTrigger
                          className={cn(
                            "h-8 w-[190px] rounded-full px-3 text-[11px] font-semibold uppercase tracking-[0.08em] shadow-sm",
                            BADGE_TONES[STATUS_TONES[prospect.status]],
                          )}
                        >
                          <PremiumSelectValue />
                        </PremiumSelectTrigger>
                        <PremiumSelectContent>
                          {STATUS_OPTIONS.filter((option) => option.value !== "all").map((option) => (
                            <PremiumSelectItem key={option.value} value={option.value}>{option.label}</PremiumSelectItem>
                          ))}
                        </PremiumSelectContent>
                      </PremiumSelect>
                    </td>
                    <td className="py-3 pr-4">
                      <CompactBadge tone={PRIORITY_TONES[prospect.priority]}>{prospect.priority}</CompactBadge>
                    </td>
                    <td className="py-3 pr-4">
                      <CustomDatePicker
                        value={prospect.nextFollowUpAt ? new Date(prospect.nextFollowUpAt) : null}
                        onChange={(date) => void patchProspect(prospect.id, { nextFollowUpAt: toIsoDate(date) })}
                        placeholder="Set date"
                        className="h-9 min-w-[150px] border-white/10 bg-white/5 text-white"
                      />
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        {prospect.latestProposalId ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Link
                                href={`/platform/proposals/${prospect.latestProposalId}`}
                                aria-label="Open proposal"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20"
                              >
                                <FileText className="h-4 w-4" />
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent side="top">Open proposal</TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-white/35">—</span>
                        )}
                        <CompactBadge tone={prospect.proposalCount ? "cyan" : "slate"} className="normal-case tracking-normal">
                          {prospect.proposalCount}
                        </CompactBadge>
                      </div>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <IconAction
                          label="Create proposal"
                          disabled={updatingId === prospect.id}
                          onClick={() => void createProposal(prospect)}
                          className="border-cyan-400/20 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20"
                        >
                          <FilePlus2 className="h-4 w-4" />
                        </IconAction>
                        <IconAction
                          label="Mark contacted"
                          disabled={updatingId === prospect.id}
                          onClick={() => void patchProspect(prospect.id, { status: "contacted" })}
                        >
                          <PhoneCall className="h-4 w-4" />
                        </IconAction>
                        <IconAction
                          label="Edit prospect"
                          disabled={updatingId === prospect.id}
                          onClick={() => openEditProspect(prospect)}
                        >
                          <Pencil className="h-4 w-4" />
                        </IconAction>
                        <IconAction
                          label="Delete prospect"
                          disabled={updatingId === prospect.id}
                          onClick={() => void deleteProspect(prospect)}
                          className="border-rose-400/20 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
                        >
                          <Trash2 className="h-4 w-4" />
                        </IconAction>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        </TooltipProvider>

        {data && totalPages > 1 ? (
          <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-white/45">Page <span className="text-white/80">{page}</span> of <span className="text-white/80">{totalPages}</span></p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))} className="border-white/10 bg-white/5 text-white hover:bg-white/10"><ChevronLeft className="mr-1 h-4 w-4" />Previous</Button>
              <Button type="button" variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="border-white/10 bg-white/5 text-white hover:bg-white/10">Next<ChevronRight className="ml-1 h-4 w-4" /></Button>
            </div>
          </div>
        ) : null}
      </PlatformSection>

      <ResponsiveModal
        open={Boolean(editingProspect)}
        onOpenChange={(open) => {
          if (!open) setEditingProspect(null);
        }}
        title="Edit prospect"
        description="Update the school, contact, status, and follow-up details."
        className="sm:max-w-3xl"
      >
        <form onSubmit={saveEditedProspect} className="max-h-[70vh] space-y-5 overflow-y-auto p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-white/70">School name</Label>
              <Input value={editForm.schoolName} onChange={(e) => updateEditForm("schoolName", e.target.value)} className="border-white/10 bg-white/5 text-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-white/70">Location</Label>
              <Input value={editForm.location} onChange={(e) => updateEditForm("location", e.target.value)} className="border-white/10 bg-white/5 text-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-white/70">Contact person</Label>
              <Input value={editForm.contactName} onChange={(e) => updateEditForm("contactName", e.target.value)} className="border-white/10 bg-white/5 text-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-white/70">Role / title</Label>
              <Input value={editForm.contactTitle} onChange={(e) => updateEditForm("contactTitle", e.target.value)} className="border-white/10 bg-white/5 text-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-white/70">Phone</Label>
              <GhanaPhoneInput value={editForm.contactPhone} onChange={(e) => updateEditForm("contactPhone", e.target.value)} className="border-white/10 bg-white/5 text-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-white/70">Email</Label>
              <Input value={editForm.contactEmail} onChange={(e) => updateEditForm("contactEmail", e.target.value)} className="border-white/10 bg-white/5 text-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-white/70">Status</Label>
              <PremiumSelect value={editForm.status} onValueChange={(value) => updateEditForm("status", value)}>
                <PremiumSelectTrigger className="border-white/10 bg-white/5 text-white"><PremiumSelectValue /></PremiumSelectTrigger>
                <PremiumSelectContent>
                  {STATUS_OPTIONS.filter((option) => option.value !== "all").map((option) => (
                    <PremiumSelectItem key={option.value} value={option.value}>{option.label}</PremiumSelectItem>
                  ))}
                </PremiumSelectContent>
              </PremiumSelect>
            </div>
            <div className="space-y-2">
              <Label className="text-white/70">Priority</Label>
              <PremiumSelect value={editForm.priority} onValueChange={(value) => updateEditForm("priority", value)}>
                <PremiumSelectTrigger className="border-white/10 bg-white/5 text-white"><PremiumSelectValue /></PremiumSelectTrigger>
                <PremiumSelectContent>
                  <PremiumSelectItem value="low">Low priority</PremiumSelectItem>
                  <PremiumSelectItem value="normal">Normal priority</PremiumSelectItem>
                  <PremiumSelectItem value="high">High priority</PremiumSelectItem>
                </PremiumSelectContent>
              </PremiumSelect>
            </div>
            <div className="space-y-2">
              <Label className="text-white/70">Next follow-up</Label>
              <CustomDatePicker value={editForm.nextFollowUpAt} onChange={(date) => updateEditForm("nextFollowUpAt", date)} placeholder="Next follow-up" className="border-white/10 bg-white/5 text-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-white/70">Source</Label>
              <Input value={editForm.source} onChange={(e) => updateEditForm("source", e.target.value)} className="border-white/10 bg-white/5 text-white" />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-white/70">Notes</Label>
            <Textarea value={editForm.notes} onChange={(e) => updateEditForm("notes", e.target.value)} className="min-h-28 border-white/10 bg-white/5 text-white" />
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-white/10 pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setEditingProspect(null)} className="border-white/10 bg-white/5 text-white hover:bg-white/10">
              Cancel
            </Button>
            <Button disabled={Boolean(editingProspect && updatingId === editingProspect.id)} className="bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30">
              {editingProspect && updatingId === editingProspect.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save changes
            </Button>
          </div>
        </form>
      </ResponsiveModal>

      {confirmationDialog}
    </div>
  );
}
