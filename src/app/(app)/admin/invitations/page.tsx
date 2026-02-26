"use client";

import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns/format";
import {
  Mail,
  Search,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Trash2,
  Send,
  Ban,
  Download,
  FilterX,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useInvitations,
  useInvitationStats,
  useResendInvitation,
  useRevokeInvitation,
  useDeleteInvitation,
  type InvitationStatus,
  type InvitationRole,
} from "@/hooks/admin/useInvitations";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";
import { cn } from "@/lib/utils";

function StatusBadge({ status }: { status: InvitationStatus }) {
  const config: Record<
    InvitationStatus,
    {
      icon: React.ComponentType<{ className?: string }>;
      className: string;
      label: string;
    }
  > = {
    pending: {
      icon: Clock,
      className: "border-amber-500/30 bg-amber-500/10 text-amber-300",
      label: "Pending",
    },
    accepted: {
      icon: CheckCircle2,
      className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
      label: "Accepted",
    },
    expired: {
      icon: XCircle,
      className: "border-slate-500/30 bg-slate-500/10 text-slate-300",
      label: "Expired",
    },
    revoked: {
      icon: Ban,
      className: "border-rose-500/30 bg-rose-500/10 text-rose-300",
      label: "Revoked",
    },
    failed: {
      icon: AlertCircle,
      className: "border-red-500/30 bg-red-500/10 text-red-300",
      label: "Failed",
    },
  };

  const { icon: Icon, className, label } = config[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

function RoleBadge({ role }: { role: InvitationRole }) {
  const config: Record<
    InvitationRole,
    { label: string; className: string }
  > = {
    teacher: {
      label: "Teacher",
      className: "border-purple-500/30 bg-purple-500/10 text-purple-300",
    },
    staff: {
      label: "Staff",
      className: "border-blue-500/30 bg-blue-500/10 text-blue-300",
    },
    school_admin: {
      label: "School Admin",
      className: "border-brand/30 bg-brand/20 text-brand",
    },
    parent: {
      label: "Parent",
      className: "border-green-500/30 bg-green-500/10 text-green-300",
    },
    bursar: {
      label: "Bursar",
      className: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    },
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        config[role].className
      )}
    >
      {config[role].label}
    </span>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: "indigo" | "amber" | "emerald" | "slate" | "rose" | "red";
}) {
  const toneMap = {
    indigo:
      "border-indigo-500/30 bg-linear-to-br from-indigo-500/15 via-indigo-500/5 to-transparent text-indigo-200",
    amber:
      "border-amber-500/30 bg-linear-to-br from-amber-500/15 via-amber-500/5 to-transparent text-amber-200",
    emerald:
      "border-emerald-500/30 bg-linear-to-br from-emerald-500/15 via-emerald-500/5 to-transparent text-emerald-200",
    slate:
      "border-slate-500/30 bg-linear-to-br from-slate-500/15 via-slate-500/5 to-transparent text-slate-200",
    rose:
      "border-rose-500/30 bg-linear-to-br from-rose-500/15 via-rose-500/5 to-transparent text-rose-200",
    red: "border-red-500/30 bg-linear-to-br from-red-500/15 via-red-500/5 to-transparent text-red-200",
  } as const;

  return (
    <Card
      className={cn(
        "relative overflow-hidden border shadow-lg shadow-black/20 backdrop-blur",
        toneMap[tone]
      )}
    >
      <CardContent className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">
            {label}
          </p>
          <div className="rounded-lg border border-white/10 bg-white/10 p-1.5">
            <Icon className="h-3.5 w-3.5 text-white/80" />
          </div>
        </div>
        <p className="text-2xl font-bold text-white">{value.toLocaleString()}</p>
      </CardContent>
    </Card>
  );
}

export default function InvitationsPage() {
  const busy = useBusyToast();
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const [statusFilter, setStatusFilter] = useState<InvitationStatus | "all">(
    "all"
  );
  const [roleFilter, setRoleFilter] = useState<InvitationRole | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  const {
    data: invitationsData,
    isLoading,
    refetch: refetchInvitations,
  } = useInvitations({
    status: statusFilter !== "all" ? statusFilter : undefined,
    role: roleFilter !== "all" ? roleFilter : undefined,
    search: searchQuery || undefined,
    page,
    limit: 20,
  });

  const { data: stats } = useInvitationStats();
  const resendMutation = useResendInvitation();
  const revokeMutation = useRevokeInvitation();
  const deleteMutation = useDeleteInvitation();

  const invitations = invitationsData?.data || [];
  const pagination = invitationsData?.pagination;
  const isActionBusy =
    resendMutation.isPending || revokeMutation.isPending || deleteMutation.isPending;

  const rolePills = useMemo(
    () =>
      [
        { role: "teacher", label: "Teachers", count: stats?.byRole.teacher || 0 },
        { role: "staff", label: "Staff", count: stats?.byRole.staff || 0 },
        {
          role: "school_admin",
          label: "School Admins",
          count: stats?.byRole.school_admin || 0,
        },
        { role: "parent", label: "Parents", count: stats?.byRole.parent || 0 },
        { role: "bursar", label: "Bursars", count: stats?.byRole.bursar || 0 },
      ] as const,
    [stats]
  );

  const hasActiveFilters =
    Boolean(searchQuery.trim()) || statusFilter !== "all" || roleFilter !== "all";

  const handleResend = async (id: string) => {
    try {
      await busy.promise(resendMutation.mutateAsync(id), {
        loading: "Resending invitation...",
        success: "Invitation resent successfully",
        error: "Failed to resend invitation",
      });
    } catch {
      // Error handled by busy.promise
    }
  };

  const handleRevoke = async (id: string) => {
    const decision = await confirm({
      title: "Revoke Invitation?",
      description: "The invite link will no longer work for this user.",
      confirmLabel: "Revoke",
      cancelLabel: "Keep Active",
      intent: "warning",
    });
    if (decision !== "confirm") return;

    try {
      await busy.promise(revokeMutation.mutateAsync(id), {
        loading: "Revoking invitation...",
        success: "Invitation revoked successfully",
        error: "Failed to revoke invitation",
      });
    } catch {
      // Error handled by busy.promise
    }
  };

  const handleDelete = async (id: string) => {
    const decision = await confirm({
      title: "Delete Invitation?",
      description: "This action cannot be undone.",
      confirmLabel: "Delete",
      cancelLabel: "Keep Invitation",
      intent: "destructive",
    });
    if (decision !== "confirm") return;

    try {
      await busy.promise(deleteMutation.mutateAsync(id), {
        loading: "Deleting invitation...",
        success: "Invitation deleted successfully",
        error: "Failed to delete invitation",
      });
    } catch {
      // Error handled by busy.promise
    }
  };

  const handleExport = async () => {
    try {
      const searchParams = new URLSearchParams();
      if (statusFilter !== "all") searchParams.set("status", statusFilter);
      if (roleFilter !== "all") searchParams.set("role", roleFilter);

      const res = await fetch(`/api/admin/invitations/export?${searchParams}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error("Failed to export invitations");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invitations-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      busy.success("Invitations exported successfully");
    } catch (e: unknown) {
      const errorMessage =
        e instanceof Error ? e.message : "Failed to export invitations";
      busy.error(errorMessage);
    }
  };

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/90 via-slate-950/95 to-black p-6 shadow-2xl shadow-black/40">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gradient-to-br from-indigo-500/20 via-cyan-500/10 to-transparent blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-gradient-to-tr from-brand/10 via-brand/5 to-transparent blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
          aria-hidden="true"
        />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-indigo-500/30 bg-indigo-500/15">
                <ShieldCheck className="h-5 w-5 text-indigo-200" />
              </div>
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                  Invitations
                </h1>
                <p className="mt-1 text-sm text-white/70">
                  Monitor invitation delivery, acceptance, and access lifecycle.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => refetchInvitations()}
              variant="outline"
              className="gap-2 border-white/15 bg-white/5 text-white hover:bg-white/10"
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              Refresh
            </Button>
            <Button
              onClick={handleExport}
              className="gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>
      </section>

      {stats && (
        <section className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Total" value={stats.total} icon={Mail} tone="indigo" />
            <StatCard
              label="Pending"
              value={stats.pending}
              icon={Clock}
              tone="amber"
            />
            <StatCard
              label="Accepted"
              value={stats.accepted}
              icon={CheckCircle2}
              tone="emerald"
            />
            <StatCard
              label="Expired"
              value={stats.expired}
              icon={XCircle}
              tone="slate"
            />
            <StatCard
              label="Revoked"
              value={stats.revoked}
              icon={Ban}
              tone="rose"
            />
            <StatCard
              label="Failed"
              value={stats.failed}
              icon={AlertCircle}
              tone="red"
            />
          </div>

          <Card className="border border-white/10 bg-white/5">
            <CardContent className="p-3">
              <div className="flex flex-wrap items-center gap-2">
                {rolePills.map((item) => {
                  const active = roleFilter === item.role;
                  return (
                    <button
                      key={item.role}
                      onClick={() => {
                        setRoleFilter(active ? "all" : item.role);
                        setPage(1);
                      }}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-all",
                        active
                          ? "border-brand/40 bg-brand/20 text-brand"
                          : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                      )}
                    >
                      <span className="font-medium">{item.label}</span>
                      <Badge
                        variant="outline"
                        className="border-white/15 bg-black/20 px-1.5 py-0 text-[10px]"
                      >
                        {item.count}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      <Card className="border border-white/10 bg-white/5">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <Input
                type="text"
                placeholder="Search by email..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="h-10 border-white/10 bg-black/20 pl-10 text-white placeholder:text-white/40"
              />
            </div>

            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value as InvitationStatus | "all");
                setPage(1);
              }}
            >
              <SelectTrigger className="h-10 w-full border-white/10 bg-black/20 text-white lg:w-[180px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-neutral-950">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="revoked">Revoked</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={roleFilter}
              onValueChange={(value) => {
                setRoleFilter(value as InvitationRole | "all");
                setPage(1);
              }}
            >
              <SelectTrigger className="h-10 w-full border-white/10 bg-black/20 text-white lg:w-[200px]">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-neutral-950">
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="teacher">Teacher</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
                <SelectItem value="school_admin">School Admin</SelectItem>
                <SelectItem value="parent">Parent</SelectItem>
                <SelectItem value="bursar">Bursar</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
                setRoleFilter("all");
                setPage(1);
              }}
              disabled={!hasActiveFilters}
              className="h-10 gap-2 border-white/10 bg-black/20 text-white hover:bg-white/10"
            >
              <FilterX className="h-4 w-4" />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden border border-white/10 bg-white/5 shadow-xl shadow-black/30">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent"
          aria-hidden="true"
        />
        <CardHeader className="border-b border-white/10 pb-4">
          <CardTitle className="flex items-center justify-between gap-3 text-lg font-semibold text-white">
            <span className="inline-flex items-center gap-2">
              <Mail className="h-4 w-4 text-indigo-300" />
              Invitations
            </span>
            {!isLoading && (
              <span className="text-xs font-normal text-white/60">
                {pagination?.total ?? invitations.length} total
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {isLoading ? (
            <div className="py-14 text-center text-white/60">Loading invitations...</div>
          ) : invitations.length === 0 ? (
            <div className="py-14 text-center text-white/60">
              <Mail className="mx-auto mb-3 h-10 w-10 text-white/20" />
              <p className="text-sm">No invitations found for current filters</p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {invitations.map((invitation) => (
                  <motion.div
                    key={invitation._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="rounded-xl border border-white/10 bg-black/20 p-4 transition-all hover:border-white/20 hover:bg-black/30"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0 space-y-1">
                        <p className="truncate text-sm font-semibold text-white">
                          {invitation.email}
                        </p>
                        <p className="text-xs text-white/60">
                          {invitation.metadata?.firstName && invitation.metadata?.lastName
                            ? `${invitation.metadata.firstName} ${invitation.metadata.lastName}`
                            : "No profile name provided"}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/50">
                          <span>Sent {format(new Date(invitation.sentAt), "MMM d, yyyy")}</span>
                          <span className="text-white/30">•</span>
                          <span>
                            Expires {format(new Date(invitation.expiresAt), "MMM d, yyyy")}
                          </span>
                          {invitation.resendCount > 0 && (
                            <>
                              <span className="text-white/30">•</span>
                              <span>{invitation.resendCount} resend(s)</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <RoleBadge role={invitation.role} />
                        <StatusBadge status={invitation.status} />
                      </div>

                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        {invitation.status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleResend(invitation._id)}
                              disabled={isActionBusy}
                              className="h-8 gap-1.5 border-white/10 bg-white/5 text-white hover:bg-white/10"
                            >
                              <Send className="h-3 w-3" />
                              Resend
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRevoke(invitation._id)}
                              disabled={isActionBusy}
                              className="h-8 gap-1.5 border-white/10 bg-white/5 text-white hover:bg-white/10"
                            >
                              <Ban className="h-3 w-3" />
                              Revoke
                            </Button>
                          </>
                        )}

                        {(invitation.status === "expired" ||
                          invitation.status === "failed") && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResend(invitation._id)}
                            disabled={isActionBusy}
                            className="h-8 gap-1.5 border-white/10 bg-white/5 text-white hover:bg-white/10"
                          >
                            <RefreshCw className="h-3 w-3" />
                            Resend
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(invitation._id)}
                          disabled={isActionBusy}
                          className="h-8 border-white/10 bg-white/5 text-rose-300 hover:bg-white/10 hover:text-rose-200"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {pagination && pagination.totalPages > 1 && (
            <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-white/60">
                Showing {Math.min((page - 1) * pagination.limit + 1, pagination.total)} to{" "}
                {Math.min(page * pagination.limit, pagination.total)} of{" "}
                {pagination.total} invitations
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="h-8 gap-1 border-white/10 bg-white/5 text-white hover:bg-white/10"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Previous
                </Button>
                <span className="px-2 text-sm text-white/80">
                  Page {page} / {pagination.totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={page === pagination.totalPages}
                  className="h-8 gap-1 border-white/10 bg-white/5 text-white hover:bg-white/10"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      {confirmationDialog}
    </div>
  );
}
