"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import {
  useInvitations,
  useInvitationStats,
  useCreateInvitation,
  useResendInvitation,
  useRevokeInvitation,
  useDeleteInvitation,
  type InvitationStatus,
  type InvitationRole,
} from "@/hooks/admin/useInvitations";
import { useBusyToast } from "@/hooks/useBusyToast";
import { format } from "date-fns/format";
import { motion, AnimatePresence } from "framer-motion";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";

function StatusBadge({ status }: { status: InvitationStatus }) {
  const config = {
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
      className: "border-gray-500/30 bg-gray-500/10 text-gray-300",
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
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${className}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

function RoleBadge({ role }: { role: InvitationRole }) {
  const config: Record<InvitationRole, string> = {
    teacher: "bg-purple-500/10 text-purple-300 border-purple-500/30",
    staff: "bg-blue-500/10 text-blue-300 border-blue-500/30",
    school_admin: "bg-brand/20 text-brand border-brand/30",
    parent: "bg-green-500/10 text-green-300 border-green-500/30",
    bursar: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${config[role]}`}
    >
      {role.replace("_", " ")}
    </span>
  );
}

export default function InvitationsPage() {
  const busy = useBusyToast();
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const [statusFilter, setStatusFilter] = useState<InvitationStatus | "all">("all");
  const [roleFilter, setRoleFilter] = useState<InvitationRole | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");

  const { data: invitationsData, isLoading } = useInvitations({
    status: statusFilter !== "all" ? statusFilter : undefined,
    role: roleFilter !== "all" ? roleFilter : undefined,
    search: searchQuery || undefined,
    page,
    limit: 20,
  });

  const { data: stats } = useInvitationStats();
  const createMutation = useCreateInvitation();
  const resendMutation = useResendInvitation();
  const revokeMutation = useRevokeInvitation();
  const deleteMutation = useDeleteInvitation();

  const invitations = invitationsData?.data || [];
  const pagination = invitationsData?.pagination;

  const handleInviteBursar = async () => {
    if (!inviteEmail.trim()) {
      busy.error("Please enter an email address");
      return;
    }

    try {
      await busy.promise(
        createMutation.mutateAsync({
          email: inviteEmail.trim(),
          role: "bursar",
          firstName: inviteFirstName.trim() || undefined,
          lastName: inviteLastName.trim() || undefined,
        }),
        {
          loading: "Sending bursar invitation...",
          success: "Bursar invitation sent",
          error: "Failed to send bursar invitation",
        }
      );
      setInviteEmail("");
      setInviteFirstName("");
      setInviteLastName("");
      setRoleFilter("all");
      setPage(1);
    } catch {
      // Error handled by busy.promise
    }
  };

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
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Invitations</h1>
          <p className="text-muted">
            Manage and track invitations sent to school members
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleExport}
            className="gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Invite Bursar */}
      <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-amber-500/10 via-amber-500/5 to-transparent"
          aria-hidden="true"
        />
        <CardHeader className="relative z-10">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/20 border border-amber-500/30">
              <Send className="h-4 w-4 text-amber-300" />
            </div>
            Invite Bursar
          </CardTitle>
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <input
              type="text"
              placeholder="First name (optional)"
              value={inviteFirstName}
              onChange={(e) => setInviteFirstName(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder:text-white/40 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
            <input
              type="text"
              placeholder="Last name (optional)"
              value={inviteLastName}
              onChange={(e) => setInviteLastName(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder:text-white/40 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
            <input
              type="email"
              placeholder="bursar@school.edu"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder:text-white/40 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
            <Button
              type="button"
              onClick={handleInviteBursar}
              disabled={createMutation.isPending || !inviteEmail.trim()}
              className="gap-2 border-white/10 bg-amber-500/20 text-amber-100 hover:bg-amber-500/30"
            >
              <Send className="h-4 w-4" />
              Send Invite
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
            <div
              className="pointer-events-none absolute inset-0 bg-linear-to-br from-blue-500/15 via-blue-500/5 to-transparent"
              aria-hidden="true"
            />
            <CardContent className="relative z-10 p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-blue-500/20 border border-blue-500/30">
                  <Mail className="h-4 w-4 text-blue-300" />
                </div>
                <div className="text-xs text-white/60 uppercase tracking-wider">
                  Total
                </div>
              </div>
              <div className="text-2xl font-bold text-white">{stats.total}</div>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
            <div
              className="pointer-events-none absolute inset-0 bg-linear-to-br from-amber-500/15 via-amber-500/5 to-transparent"
              aria-hidden="true"
            />
            <CardContent className="relative z-10 p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-amber-500/20 border border-amber-500/30">
                  <Clock className="h-4 w-4 text-amber-300" />
                </div>
                <div className="text-xs text-white/60 uppercase tracking-wider">
                  Pending
                </div>
              </div>
              <div className="text-2xl font-bold text-amber-300">
                {stats.pending}
              </div>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
            <div
              className="pointer-events-none absolute inset-0 bg-linear-to-br from-emerald-500/15 via-emerald-500/5 to-transparent"
              aria-hidden="true"
            />
            <CardContent className="relative z-10 p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30">
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                </div>
                <div className="text-xs text-white/60 uppercase tracking-wider">
                  Accepted
                </div>
              </div>
              <div className="text-2xl font-bold text-emerald-300">
                {stats.accepted}
              </div>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
            <div
              className="pointer-events-none absolute inset-0 bg-linear-to-br from-gray-500/15 via-gray-500/5 to-transparent"
              aria-hidden="true"
            />
            <CardContent className="relative z-10 p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-gray-500/20 border border-gray-500/30">
                  <XCircle className="h-4 w-4 text-gray-300" />
                </div>
                <div className="text-xs text-white/60 uppercase tracking-wider">
                  Expired
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-300">
                {stats.expired}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-violet-500/15 via-violet-500/5 to-transparent"
          aria-hidden="true"
        />
        <CardHeader className="relative z-10">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/20 border border-violet-500/30">
              <Search className="h-4 w-4 text-violet-300" />
            </div>
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <input
                type="text"
                placeholder="Search by email..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as InvitationStatus | "all");
                setPage(1);
              }}
              className="px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="expired">Expired</option>
              <option value="revoked">Revoked</option>
              <option value="failed">Failed</option>
            </select>

            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value as InvitationRole | "all");
                setPage(1);
              }}
              className="px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            >
              <option value="all">All Roles</option>
              <option value="teacher">Teacher</option>
              <option value="staff">Staff</option>
              <option value="school_admin">School Admin</option>
              <option value="parent">Parent</option>
              <option value="bursar">Bursar</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Invitations Table */}
      <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-indigo-500/15 via-indigo-500/5 to-transparent"
          aria-hidden="true"
        />
        <CardHeader className="relative z-10">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-500/20 border border-indigo-500/30">
              <Mail className="h-4 w-4 text-indigo-300" />
            </div>
            Invitations
          </CardTitle>
        </CardHeader>
        <CardContent className="relative z-10">
          {isLoading ? (
            <div className="text-center py-12 text-white/60">
              Loading invitations...
            </div>
          ) : invitations.length === 0 ? (
            <div className="text-center py-12 text-white/60">
              <Mail className="h-12 w-12 mx-auto mb-4 text-white/20" />
              <p>No invitations found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-white/60">
                      Email
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-white/60">
                      Role
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-white/60">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-white/60">
                      Sent
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-white/60">
                      Expires
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-white/60">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {invitations.map((invitation) => (
                      <motion.tr
                        key={invitation._id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="border-b border-white/5 hover:bg-white/5 transition-colors"
                      >
                        <td className="py-4 px-4">
                          <div className="text-white font-medium">
                            {invitation.email}
                          </div>
                          {invitation.metadata?.firstName &&
                            invitation.metadata?.lastName && (
                              <div className="text-xs text-white/60">
                                {invitation.metadata.firstName}{" "}
                                {invitation.metadata.lastName}
                              </div>
                            )}
                        </td>
                        <td className="py-4 px-4">
                          <RoleBadge role={invitation.role} />
                        </td>
                        <td className="py-4 px-4">
                          <StatusBadge status={invitation.status} />
                        </td>
                        <td className="py-4 px-4 text-sm text-white/80">
                          {format(new Date(invitation.sentAt), "MMM d, yyyy")}
                        </td>
                        <td className="py-4 px-4 text-sm text-white/80">
                          {format(new Date(invitation.expiresAt), "MMM d, yyyy")}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            {invitation.status === "pending" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleResend(invitation._id)}
                                  disabled={
                                    resendMutation.isPending ||
                                    revokeMutation.isPending ||
                                    deleteMutation.isPending
                                  }
                                  className="border-white/10 bg-white/5 text-white hover:bg-white/10 h-8 px-3"
                                >
                                  <Send className="h-3 w-3 mr-1" />
                                  Resend
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRevoke(invitation._id)}
                                  disabled={
                                    resendMutation.isPending ||
                                    revokeMutation.isPending ||
                                    deleteMutation.isPending
                                  }
                                  className="border-white/10 bg-white/5 text-white hover:bg-white/10 h-8 px-3"
                                >
                                  <Ban className="h-3 w-3 mr-1" />
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
                                disabled={
                                  resendMutation.isPending ||
                                  revokeMutation.isPending ||
                                  deleteMutation.isPending
                                }
                                className="border-white/10 bg-white/5 text-white hover:bg-white/10 h-8 px-3"
                              >
                                <RefreshCw className="h-3 w-3 mr-1" />
                                Resend
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDelete(invitation._id)}
                              disabled={
                                resendMutation.isPending ||
                                revokeMutation.isPending ||
                                deleteMutation.isPending
                              }
                              className="border-white/10 bg-white/5 text-white hover:bg-white/10 h-8 px-3 text-rose-300 hover:text-rose-200"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10">
              <div className="text-sm text-white/60">
                Showing {((page - 1) * pagination.limit) + 1} to{" "}
                {Math.min(page * pagination.limit, pagination.total)} of{" "}
                {pagination.total} invitations
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                >
                  Previous
                </Button>
                <span className="text-sm text-white/80 px-3">
                  Page {page} of {pagination.totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setPage((p) => Math.min(pagination.totalPages, p + 1))
                  }
                  disabled={page === pagination.totalPages}
                  className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                >
                  Next
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
