"use client";

import React, { Suspense, useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns/format";
import {
  Activity,
  CalendarClock,
  Share2,
  Plus,
  Pencil,
  Ban,
  RefreshCw,
  Loader2,
  FilterX,
  Search,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { cn } from "@/lib/utils";
import { useBusyToast } from "@/hooks/useBusyToast";
import {
  useDelegationList,
  useDelegationModules,
  useEligibleDelegationStaff,
  useCreateDelegation,
  usePatchDelegation,
  useRevokeDelegation,
  useDelegationActivity,
  type DelegationListRow,
} from "@/hooks/admin/useDelegations";
import {
  formatActivityActorPrimary,
  formatActivityDelegateStaffSummary,
} from "@/lib/audit/activityActorPresentation";

const fieldClass =
  "w-full border-white/10 bg-[#111827] text-white shadow-none placeholder:text-white/35 [&_svg]:text-white/50 focus-visible:border-cyan-400/40 focus-visible:ring-cyan-400/20";

const panelClass =
  "border border-white/10 bg-[#0b101a] text-white shadow-xl shadow-black/25";

function statusBadgeClass(status: string) {
  switch (status) {
    case "active":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "expired":
      return "border-slate-500/30 bg-slate-500/10 text-slate-300";
    case "revoked":
      return "border-rose-500/30 bg-rose-500/10 text-rose-300";
    default:
      return "border-white/20 bg-white/5 text-white/70";
  }
}

function endOfDayIso(d: Date): string {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x.toISOString();
}

function initials(name: string, email: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

function timeLabel(input?: string | null) {
  if (!input) return "No activity yet";
  return format(new Date(input), "MMM d, yyyy · HH:mm");
}

function AdminDelegationsPageInner() {
  const busy = useBusyToast();
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [moduleFilter, setModuleFilter] = useState<string>("__all");
  const [staffSearch, setStaffSearch] = useState("");
  const [summaryNow] = useState(() => Date.now());

  const { data: modules = [], isLoading: modulesLoading } = useDelegationModules();
  const { data: staff = [], isLoading: staffLoading } = useEligibleDelegationStaff();
  const { data: activityRows = [], isLoading: activityLoading } = useDelegationActivity();
  const {
    data: summaryRows = [],
    isLoading: summaryLoading,
  } = useDelegationList({ status: "all", module: null });
  const {
    data: rows = [],
    isLoading: listLoading,
    refetch,
    isFetching,
  } = useDelegationList({
    status: statusFilter,
    module: moduleFilter === "__all" ? null : moduleFilter,
  });

  const createMut = useCreateDelegation();
  const patchMut = usePatchDelegation();
  const revokeMut = useRevokeDelegation();

  const presetLabel = useMemo(() => {
    const m = new Map<string, Map<string, string>>();
    for (const mod of modules) {
      m.set(mod.id, new Map(mod.presets.map((p) => [p.id, p.label])));
    }
    return (moduleId: string, presetId: string) =>
      m.get(moduleId)?.get(presetId) ?? presetId;
  }, [modules]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createStaffId, setCreateStaffId] = useState("");
  const [createModuleId, setCreateModuleId] = useState("");
  const [createPresetId, setCreatePresetId] = useState("");
  const [createExpiryEnabled, setCreateExpiryEnabled] = useState(false);
  const [createExpiry, setCreateExpiry] = useState<Date | null>(null);
  const [createNote, setCreateNote] = useState("");

  const [editRow, setEditRow] = useState<DelegationListRow | null>(null);
  const [editPreset, setEditPreset] = useState("");
  const [editExpiry, setEditExpiry] = useState<Date | null>(null);
  const [editNote, setEditNote] = useState("");

  const [revokeRow, setRevokeRow] = useState<DelegationListRow | null>(null);
  const [revokeReason, setRevokeReason] = useState("");

  React.useEffect(() => {
    if (modules.length && !createModuleId) {
      setCreateModuleId(modules[0].id);
    }
  }, [modules, createModuleId]);

  const createModule = modules.find((m) => m.id === createModuleId);
  React.useEffect(() => {
    if (createModule?.presets.length && createPresetId === "") {
      setCreatePresetId(createModule.presets[0].id);
    }
    if (
      createModule &&
      createPresetId &&
      !createModule.presets.some((p) => p.id === createPresetId)
    ) {
      setCreatePresetId(createModule.presets[0]?.id ?? "");
    }
  }, [createModule, createPresetId]);

  const openCreate = useCallback(
    (prefillModuleId?: string | null) => {
      setCreateStaffId("");
      setCreateNote("");
      setCreateExpiryEnabled(false);
      setCreateExpiry(null);
      const match =
        prefillModuleId && modules.some((m) => m.id === prefillModuleId)
          ? modules.find((m) => m.id === prefillModuleId)!
          : modules[0];
      if (match) {
        setCreateModuleId(match.id);
        setCreatePresetId(match.presets[0]?.id ?? "");
      }
      setCreateOpen(true);
    },
    [modules]
  );

  React.useEffect(() => {
    if (!modules.length) return;
    const add = searchParams.get("add");
    if (add !== "1") return;
    const m = searchParams.get("module");
    openCreate(m);
  }, [modules, searchParams, openCreate]);

  function openEdit(row: DelegationListRow) {
    setEditRow(row);
    setEditPreset(row.preset);
    setEditNote(row.grantNote ?? "");
    setEditExpiry(row.expiresAt ? new Date(row.expiresAt) : null);
  }

  async function submitCreate() {
    if (!createStaffId || !createModuleId || !createPresetId) return;
    if (createExpiryEnabled && !createExpiry) return;
    await busy.promise(
      createMut.mutateAsync({
        staffUserId: createStaffId,
        module: createModuleId,
        preset: createPresetId,
        expiresAt: createExpiryEnabled && createExpiry ? endOfDayIso(createExpiry) : null,
        note: createNote.trim() || null,
      }),
      { loading: "Creating delegation…", success: "Delegation created", error: (e) => String(e) }
    );
    setCreateOpen(false);
  }

  async function submitEdit() {
    if (!editRow) return;
    const body: {
      delegationId: string;
      preset?: string;
      expiresAt?: string | null;
      note?: string | null;
    } = { delegationId: editRow.id };
    if (editPreset !== editRow.preset) body.preset = editPreset;

    const prevYmd = editRow.expiresAt
      ? format(new Date(editRow.expiresAt), "yyyy-MM-dd")
      : null;
    const nextYmd = editExpiry ? format(editExpiry, "yyyy-MM-dd") : null;
    if (prevYmd !== nextYmd) {
      body.expiresAt = editExpiry ? endOfDayIso(editExpiry) : null;
    }

    const noteTrim = editNote.trim() || null;
    if (noteTrim !== (editRow.grantNote ?? null)) body.note = noteTrim;

    if (Object.keys(body).length <= 1) {
      setEditRow(null);
      return;
    }

    await busy.promise(patchMut.mutateAsync(body), {
      loading: "Saving…",
      success: "Delegation updated",
      error: (e) => String(e),
    });
    setEditRow(null);
  }

  async function submitRevoke() {
    if (!revokeRow) return;
    await busy.promise(
      revokeMut.mutateAsync({
        delegationId: revokeRow.id,
        reason: revokeReason.trim() || null,
      }),
      { loading: "Revoking…", success: "Delegation revoked", error: (e) => String(e) }
    );
    setRevokeRow(null);
    setRevokeReason("");
  }

  const editModule = modules.find((m) => m.id === editRow?.module);

  const minExpDate = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const delegationSummary = useMemo(() => {
    const weekMs = 7 * 86400000;
    const active = summaryRows.filter((r) => r.status === "active");
    const expiringSoon = active.filter((r) => {
      if (!r.expiresAt) return false;
      const t = new Date(r.expiresAt).getTime();
      return t > summaryNow && t <= summaryNow + weekMs;
    }).length;
    const start = new Date(summaryNow);
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const revokedThisMonth = summaryRows.filter((r) => {
      if (r.status !== "revoked") return false;
      const u = new Date(r.updatedAt).getTime();
      return u >= start.getTime();
    }).length;
    return { active: active.length, expiringSoon, revokedThisMonth };
  }, [summaryRows, summaryNow]);

  const visibleRows = useMemo(() => {
    const q = staffSearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        (r.staffName || "").toLowerCase().includes(q) ||
        (r.staffEmail || "").toLowerCase().includes(q)
    );
  }, [rows, staffSearch]);

  const createStaffLabel = useMemo(() => {
    const s = staff.find((x) => x.userId === createStaffId);
    if (!s) return "";
    const name = `${s.firstName} ${s.lastName}`.trim();
    return name || s.email;
  }, [staff, createStaffId]);

  const grantConfirmation = useMemo(() => {
    if (!createStaffLabel || !createModule || !createPresetId) return "";
    const preset = createModule.presets.find((p) => p.id === createPresetId);
    const level = preset?.label ?? createPresetId;
    const mod = createModule.label;
    if (createExpiryEnabled && createExpiry) {
      return `${createStaffLabel} will get ${level} access to ${mod} until ${format(createExpiry, "MMM d, yyyy")}.`;
    }
    return `${createStaffLabel} will get ${level} access to ${mod} until you revoke it.`;
  }, [
    createStaffLabel,
    createModule,
    createPresetId,
    createExpiryEnabled,
    createExpiry,
  ]);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#080d16] p-5 text-white shadow-2xl shadow-black/25 sm:p-6">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-cyan-300/60 to-transparent"
          aria-hidden
        />
        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-100">
              <ShieldCheck className="h-3.5 w-3.5" />
              Controlled staff access
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Delegations
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/62">
              Give trusted staff access to specific work areas without making them admins. Access is
              scoped, revocable, and recorded in the audit trail.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-white/10 bg-[#111827] text-white hover:bg-[#172033] hover:text-white"
              onClick={() => void refetch()}
              disabled={isFetching}
            >
              {isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-2">Refresh</span>
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"
              onClick={() => openCreate()}
              disabled={modulesLoading || modules.length === 0}
            >
              <Plus className="h-4 w-4" />
              <span className="ml-2">Add delegation</span>
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Active delegations",
            value: summaryLoading ? "—" : String(delegationSummary.active),
            icon: UserRoundCheck,
            tone: "text-emerald-200 bg-emerald-500/10 border-emerald-500/20",
          },
          {
            label: "Expiring soon",
            value: summaryLoading ? "—" : String(delegationSummary.expiringSoon),
            icon: CalendarClock,
            tone: "text-amber-200 bg-amber-500/10 border-amber-500/20",
          },
          {
            label: "Revoked this month",
            value: summaryLoading ? "—" : String(delegationSummary.revokedThisMonth),
            icon: Ban,
            tone: "text-rose-200 bg-rose-500/10 border-rose-500/20",
          },
          {
            label: "Recent activity",
            value: activityLoading ? "—" : String(Math.min(activityRows.length, 80)),
            icon: Activity,
            tone: "text-cyan-200 bg-cyan-500/10 border-cyan-500/20",
          },
        ].map((s) => {
          const Icon = s.icon;
          return (
          <div
            key={s.label}
            className="rounded-2xl border border-white/10 bg-[#0e1420] p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/42">
                  {s.label}
                </p>
                <p className="mt-2 text-3xl font-semibold text-white">{s.value}</p>
              </div>
              <div className={cn("rounded-xl border p-2", s.tone)}>
                <Icon className="h-4 w-4" />
              </div>
            </div>
          </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(280px,0.38fr)] lg:items-start">
      <Card className={cn("relative overflow-hidden", panelClass)}>
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-teal-300/50 to-transparent"
          aria-hidden
        />
        <CardHeader className="relative z-10 border-b border-white/10">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <CardTitle className="flex items-center gap-3 text-lg font-semibold text-white">
              <div className="rounded-xl border border-teal-500/25 bg-teal-500/12 p-2">
                <Share2 className="h-4 w-4 text-teal-200" />
              </div>
              <span>Active access</span>
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <PremiumSelect value={statusFilter} onValueChange={setStatusFilter}>
                <PremiumSelectTrigger className={cn(fieldClass, "h-9 w-[140px]")}>
                  <PremiumSelectValue placeholder="Status" />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  <PremiumSelectItem value="active">Active</PremiumSelectItem>
                  <PremiumSelectItem value="all">All statuses</PremiumSelectItem>
                </PremiumSelectContent>
              </PremiumSelect>
              <PremiumSelect value={moduleFilter} onValueChange={setModuleFilter}>
                <PremiumSelectTrigger className={cn(fieldClass, "h-9 min-w-[170px]")}>
                  <PremiumSelectValue placeholder="Module" />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  <PremiumSelectItem value="__all">All modules</PremiumSelectItem>
                  {modules.map((m) => (
                    <PremiumSelectItem key={m.id} value={m.id}>
                      {m.label}
                    </PremiumSelectItem>
                  ))}
                </PremiumSelectContent>
              </PremiumSelect>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                <Input
                  placeholder="Search staff"
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                  className={cn(fieldClass, "h-9 w-[200px] pl-9 lg:w-[220px]")}
                />
              </div>
              {moduleFilter !== "__all" || statusFilter !== "active" || staffSearch ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-white/60 hover:bg-white/[0.08] hover:text-white"
                  onClick={() => {
                    setModuleFilter("__all");
                    setStatusFilter("active");
                    setStaffSearch("");
                  }}
                >
                  <FilterX className="h-4 w-4" />
                  Reset
                </Button>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="relative z-10">
          {modulesLoading || listLoading ? (
            <div className="flex items-center justify-center py-16 text-white/50">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : modules.length === 0 ? (
            <p className="py-12 text-center text-sm text-white/60">
              No delegatable modules are enabled yet. Enable a module in the registry to grant access
              here.
            </p>
          ) : rows.length === 0 ? (
            <div className="py-14 text-center">
              <p className="text-base font-medium text-white">No delegations yet</p>
              <p className="mt-2 text-sm text-white/55">
                Start by giving a trusted staff member access to one work area, such as Admissions or
                Polls.
              </p>
              <Button
                type="button"
                className="mt-6 bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                onClick={() => openCreate()}
                disabled={modulesLoading || modules.length === 0}
              >
                <Plus className="h-4 w-4" />
                <span className="ml-2">Add delegation</span>
              </Button>
            </div>
          ) : visibleRows.length === 0 ? (
            <p className="py-12 text-center text-sm text-white/60">
              No rows match your staff search.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#080d16]">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-white/10 bg-[#111827] text-[11px] font-semibold uppercase tracking-wider text-white/45">
                  <tr>
                    <th className="px-4 py-3">Staff</th>
                    <th className="px-4 py-3">Module</th>
                    <th className="px-4 py-3">Preset</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Expires</th>
                    <th className="px-4 py-3">Granted by</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {visibleRows.map((row) => (
                    <tr key={row.id} className="text-white/85 transition hover:bg-white/[0.04]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#172033] text-xs font-semibold text-white">
                            {initials(row.staffName || "", row.staffEmail)}
                          </div>
                          <div>
                            <div className="font-medium text-white">{row.staffName || "—"}</div>
                            <div className="text-xs text-white/45">{row.staffEmail}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-white/80">
                          {row.moduleLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {presetLabel(row.module, row.preset)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={cn("capitalize", statusBadgeClass(row.status))}
                        >
                          {row.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-white/70">
                        {row.expiresAt
                          ? format(new Date(row.expiresAt), "MMM d, yyyy")
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-white/70">
                        <div>{row.grantedByName || "—"}</div>
                        <div className="text-xs text-white/35">
                          {timeLabel(row.lastActivityAt)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          {row.status === "active" ? (
                            <>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-white/60 hover:bg-white/10 hover:text-white"
                                aria-label="Edit delegation"
                                onClick={() => openEdit(row)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-rose-300/80 hover:bg-rose-500/10 hover:text-rose-200"
                                aria-label="Revoke delegation"
                                onClick={() => setRevokeRow(row)}
                              >
                                <Ban className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <span className="text-xs text-white/35">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={cn("relative overflow-hidden", panelClass)}>
        <CardHeader className="border-b border-white/10 pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
            <Sparkles className="h-4 w-4 text-cyan-200" />
            Recent activity
          </CardTitle>
        </CardHeader>
        <CardContent className="max-h-[min(520px,60vh)] overflow-y-auto pt-4">
          {activityLoading ? (
            <div className="flex justify-center py-10 text-white/50">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : activityRows.length === 0 ? (
            <p className="text-sm text-white/50">No delegation events recorded yet.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {activityRows.map((a) => (
                <li key={a.id} className="relative pl-5">
                  <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full border border-cyan-300/40 bg-cyan-400/25" />
                  <div className="rounded-xl border border-white/8 bg-[#111827] px-3 py-2.5">
                    <p className="text-white/88">{a.description}</p>
                    <p className="mt-1 text-xs text-white/50">
                      {formatActivityActorPrimary(
                        a.performedBy
                          ? {
                              firstName: a.performedBy.firstName,
                              lastName: a.performedBy.lastName,
                              email: a.performedBy.email,
                            }
                          : null,
                        a.metadata
                      )}
                    </p>
                    {formatActivityDelegateStaffSummary(a.metadata) ? (
                      <p className="mt-0.5 text-xs text-white/40">
                        Staff: {formatActivityDelegateStaffSummary(a.metadata)}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-white/35">
                      {format(new Date(a.createdAt), "MMM d, yyyy · HH:mm")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg overflow-hidden border-white/10 bg-[#080d16] p-0 text-white shadow-2xl sm:max-w-lg">
          <DialogHeader className="border-b border-white/10 bg-[#0e1420] px-5 py-4 text-left">
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-cyan-400/25 bg-cyan-400/10 p-2">
                <Plus className="h-4 w-4 text-cyan-100" />
              </div>
              <div>
                <DialogTitle>Add delegation</DialogTitle>
                <p className="mt-1 text-sm text-white/55">
                  Pick one staff member, one work area, and a clear access level.
                </p>
              </div>
            </div>
          </DialogHeader>
          <div className="max-h-[min(72vh,720px)] space-y-4 overflow-y-auto px-5 py-5">
            <div className="rounded-2xl border border-white/10 bg-[#0e1420] p-4">
              <div className="space-y-2">
              <Label className="text-white/80">Staff member</Label>
              <PremiumSelect
                value={createStaffId || undefined}
                onValueChange={setCreateStaffId}
                disabled={staffLoading}
              >
                <PremiumSelectTrigger className={fieldClass}>
                  <PremiumSelectValue placeholder={staffLoading ? "Loading…" : "Select staff"} />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  {staff.map((s) => (
                    <PremiumSelectItem key={s.userId} value={s.userId}>
                      {`${s.firstName} ${s.lastName}`.trim() || s.email} ({s.email}) ·{" "}
                      {s.roles.filter((r) => r === "teacher" || r === "staff").join(", ")}
                    </PremiumSelectItem>
                  ))}
                </PremiumSelectContent>
              </PremiumSelect>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0e1420] p-4">
              <div className="space-y-2">
              <Label className="text-white/80">Module</Label>
              <PremiumSelect value={createModuleId} onValueChange={setCreateModuleId}>
                <PremiumSelectTrigger className={fieldClass}>
                  <PremiumSelectValue />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  {modules.map((m) => (
                    <PremiumSelectItem key={m.id} value={m.id}>
                      {m.label}
                    </PremiumSelectItem>
                  ))}
                </PremiumSelectContent>
              </PremiumSelect>
              {createModule ? (
                <>
                  <p className="text-xs text-white/45">{createModule.description}</p>
                  <p className="text-xs text-sky-200/70">
                    This gives access only to {createModule.label}. It does not make the user a school
                    admin.
                  </p>
                </>
              ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0e1420] p-4">
              <div className="space-y-2">
              <Label className="text-white/80">Access level</Label>
              <PremiumSelect value={createPresetId} onValueChange={setCreatePresetId}>
                <PremiumSelectTrigger className={fieldClass}>
                  <PremiumSelectValue />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  {createModule?.presets.map((p) => (
                    <PremiumSelectItem key={p.id} value={p.id}>
                      {p.label}
                    </PremiumSelectItem>
                  ))}
                </PremiumSelectContent>
              </PremiumSelect>
              {createModule?.presets.find((p) => p.id === createPresetId)?.description ? (
                <p className="text-xs text-white/50">
                  {createModule.presets.find((p) => p.id === createPresetId)?.description}
                </p>
              ) : null}
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-white/10 bg-[#0e1420] p-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="delegation-expiry"
                  checked={createExpiryEnabled}
                  onCheckedChange={(c) => {
                    const on = c === true;
                    setCreateExpiryEnabled(on);
                    if (!on) setCreateExpiry(null);
                  }}
                />
                <Label htmlFor="delegation-expiry" className="cursor-pointer text-white/80">
                  Set an expiry date
                </Label>
              </div>
              {createExpiryEnabled ? (
                <CustomDatePicker
                  label="Expires"
                  value={createExpiry}
                  onChange={setCreateExpiry}
                  minDate={minExpDate}
                  className={fieldClass}
                />
              ) : null}
            </div>

            <div className="space-y-2 rounded-2xl border border-white/10 bg-[#0e1420] p-4">
              <Label className="text-white/80">Admin note (optional)</Label>
              <Textarea
                value={createNote}
                onChange={(e) => setCreateNote(e.target.value)}
                className={cn(fieldClass, "min-h-[80px] resize-y")}
                placeholder="Why is this access being granted?"
              />
            </div>
            {grantConfirmation ? (
              <p className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-50">
                {grantConfirmation}
              </p>
            ) : null}
          </div>
          <DialogFooter className="border-t border-white/10 bg-[#0b101a] px-5 py-4">
            <Button
              type="button"
              variant="ghost"
              className="text-white/70 hover:bg-white/[0.08] hover:text-white"
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"
              disabled={
                !createStaffId ||
                !createModuleId ||
                !createPresetId ||
                createMut.isPending ||
                (createExpiryEnabled && !createExpiry)
              }
              onClick={() => void submitCreate()}
            >
              {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Grant access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="max-w-lg overflow-hidden border-white/10 bg-[#080d16] p-0 text-white shadow-2xl">
          <DialogHeader className="border-b border-white/10 bg-[#0e1420] px-5 py-4 text-left">
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-teal-400/25 bg-teal-400/10 p-2">
                <Pencil className="h-4 w-4 text-teal-100" />
              </div>
              <div>
                <DialogTitle>Edit delegation</DialogTitle>
                <p className="mt-1 text-sm text-white/55">
                  Adjust the access level, expiry, or note.
                </p>
              </div>
            </div>
          </DialogHeader>
          {editRow ? (
            <>
              <div className="space-y-4 px-5 py-5">
                <div className="rounded-2xl border border-white/10 bg-[#0e1420] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/40">
                    Current delegate
                  </p>
                  <p className="mt-1 text-sm font-medium text-white">
                    {editRow.staffName} · {editRow.moduleLabel}
                  </p>
                </div>
                <div className="space-y-2 rounded-2xl border border-white/10 bg-[#0e1420] p-4">
                  <Label className="text-white/80">Access level</Label>
                  <PremiumSelect value={editPreset} onValueChange={setEditPreset}>
                    <PremiumSelectTrigger className={fieldClass}>
                      <PremiumSelectValue />
                    </PremiumSelectTrigger>
                    <PremiumSelectContent>
                      {editModule?.presets.map((p) => (
                        <PremiumSelectItem key={p.id} value={p.id}>
                          {p.label}
                        </PremiumSelectItem>
                      ))}
                    </PremiumSelectContent>
                  </PremiumSelect>
                </div>
                <div className="space-y-2 rounded-2xl border border-white/10 bg-[#0e1420] p-4">
                  <CustomDatePicker
                    label="Expiry"
                    value={editExpiry}
                    onChange={setEditExpiry}
                    minDate={minExpDate}
                    className={fieldClass}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="px-0 text-teal-300 hover:bg-transparent hover:text-teal-200"
                    onClick={() => setEditExpiry(null)}
                  >
                    Clear expiry (no end date)
                  </Button>
                </div>
                <div className="space-y-2 rounded-2xl border border-white/10 bg-[#0e1420] p-4">
                  <Label className="text-white/80">Note</Label>
                  <Textarea
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    className={cn(fieldClass, "min-h-[80px] resize-y")}
                  />
                </div>
              </div>
              <DialogFooter className="border-t border-white/10 bg-[#0b101a] px-5 py-4">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-white/70 hover:bg-white/[0.08] hover:text-white"
                  onClick={() => setEditRow(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                  disabled={patchMut.isPending}
                  onClick={() => void submitEdit()}
                >
                  {patchMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Save
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!revokeRow}
        onOpenChange={(o) => {
          if (!o) {
            setRevokeRow(null);
            setRevokeReason("");
          }
        }}
      >
        <DialogContent className="max-w-md overflow-hidden border-white/10 bg-[#080d16] p-0 text-white shadow-2xl">
          <DialogHeader className="border-b border-rose-500/20 bg-[#0e1420] px-5 py-4 text-left">
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-rose-400/25 bg-rose-500/10 p-2">
                <Ban className="h-4 w-4 text-rose-100" />
              </div>
              <div>
                <DialogTitle>Revoke access?</DialogTitle>
                <p className="mt-1 text-sm text-white/55">
                  This removes delegated access immediately.
                </p>
              </div>
            </div>
          </DialogHeader>
          {revokeRow ? (
            <>
              <div className="space-y-4 px-5 py-5">
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-50">
                  {revokeRow.staffName} will no longer see {revokeRow.moduleLabel} in their sidebar.
                  Their past activity remains in the audit trail.
                </div>
              <div className="space-y-2 rounded-2xl border border-white/10 bg-[#0e1420] p-4">
                <Label className="text-white/80">Reason (optional)</Label>
                <Textarea
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  className={cn(fieldClass, "min-h-[72px] resize-y")}
                  placeholder="Shown in audit history"
                />
              </div>
              </div>
              <DialogFooter className="border-t border-white/10 bg-[#0b101a] px-5 py-4">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-white/70 hover:bg-white/[0.08] hover:text-white"
                  onClick={() => {
                    setRevokeRow(null);
                    setRevokeReason("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={revokeMut.isPending}
                  onClick={() => void submitRevoke()}
                >
                  {revokeMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Revoke access
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminDelegationsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-white/60">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <AdminDelegationsPageInner />
    </Suspense>
  );
}
