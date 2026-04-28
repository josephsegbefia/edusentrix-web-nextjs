"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useActivity, type Activity } from "@/hooks/admin/useActivity";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  Users,
  School,
  BookOpen,
  Mail,
  Calendar,
  DollarSign,
  FileText,
  Settings,
  Clock,
  GraduationCap,
  Search,
  Trash2,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import { format } from "date-fns/format";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/useToast";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";
import {
  formatActivityActorPrimary,
  formatActivityDelegateStaffSummary,
} from "@/lib/audit/activityActorPresentation";

function getActivityIcon(type: string) {
  if (type.includes("student")) return GraduationCap;
  if (type.includes("teacher")) return Users;
  if (type.includes("class_group")) return School;
  if (type.includes("subject")) return BookOpen;
  if (type.includes("invitation")) return Mail;
  if (type.includes("academic_period")) return Calendar;
  if (type.includes("fee") || type.includes("payment")) return DollarSign;
  if (type.includes("report")) return FileText;
  if (type.includes("settings")) return Settings;
  return Clock;
}

function getActivityColor(type: string) {
  if (type.includes("student")) return "text-blue-300";
  if (type.includes("teacher")) return "text-purple-300";
  if (type.includes("class_group")) return "text-emerald-300";
  if (type.includes("invitation")) return "text-amber-300";
  if (type.includes("academic_period")) return "text-fuchsia-300";
  return "text-white/60";
}

function isActivityDeletable(activity: Activity): boolean {
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  const activityDate = new Date(activity.createdAt);
  return activityDate < oneMonthAgo;
}

type ActivityViewAllModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ActivityViewAllModal({
  open,
  onOpenChange,
}: ActivityViewAllModalProps) {
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const debouncedSearch = useDebouncedValue(search, 300);
  const queryClient = useQueryClient();
  const toast = useToast();
  const busy = useBusyToast();
  const { confirm, confirmationDialog } = useConfirmationDialog();

  const { data, isLoading, isError } = useActivity({
    limit: 50,
    page,
  });

  const deleteActivity = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/activity/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to delete activity");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      toast.success("Activity deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const activities = data?.data || [];
  const pagination = data?.pagination || {
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  };

  // Filter activities by search query
  const filteredActivities = React.useMemo(() => {
    if (!debouncedSearch.trim()) return activities;
    const query = debouncedSearch.toLowerCase();
    return activities.filter((activity) => {
      const meta = activity.metadata ?? {};
      const actorDisplay =
        typeof meta.actorDisplayName === "string" ? meta.actorDisplayName.toLowerCase() : "";
      const staffDisplay =
        typeof meta.delegateStaffDisplayName === "string"
          ? meta.delegateStaffDisplayName.toLowerCase()
          : "";
      const staffEmail =
        typeof meta.delegateStaffEmail === "string" ? meta.delegateStaffEmail.toLowerCase() : "";
      return (
        activity.description.toLowerCase().includes(query) ||
        activity.type.toLowerCase().includes(query) ||
        activity.performedBy?.email.toLowerCase().includes(query) ||
        activity.performedBy?.firstName?.toLowerCase().includes(query) ||
        activity.performedBy?.lastName?.toLowerCase().includes(query) ||
        actorDisplay.includes(query) ||
        staffDisplay.includes(query) ||
        staffEmail.includes(query)
      );
    });
  }, [activities, debouncedSearch]);

  const handleDelete = async (activity: Activity) => {
    if (!isActivityDeletable(activity)) {
      toast.error("Can only delete activities older than a month");
      return;
    }

    const decision = await confirm({
      title: "Delete Activity?",
      description: "This action cannot be undone.",
      confirmLabel: "Delete Activity",
      cancelLabel: "Keep Activity",
      intent: "destructive",
    });
    if (decision !== "confirm") {
      return;
    }

    await busy.promise(deleteActivity.mutateAsync(activity._id), {
      loading: "Deleting activity...",
      success: "Activity deleted",
      error: "Failed to delete activity",
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-white/10 bg-slate-950/95 text-slate-50 shadow-2xl shadow-black/50">
        <DialogHeader className="border-b border-white/10 pb-4">
          <DialogTitle className="text-lg font-semibold flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-500/20 border border-indigo-500/30">
              <Clock className="h-4 w-4 text-indigo-300" />
            </div>
            All Activities
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search activities by description, type, or user..."
            className="pl-9 border-white/15 bg-black/60 text-foreground placeholder:text-muted-foreground/70"
          />
        </div>

        {/* Activities List */}
        <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary/60" />
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <p className="text-sm text-red-300/80">
                Failed to load activities
              </p>
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <Clock className="h-12 w-12 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">
                {debouncedSearch
                  ? "No activities match your search"
                  : "No activities found"}
              </p>
            </div>
          ) : (
            filteredActivities.map((activity) => {
              const Icon = getActivityIcon(activity.type);
              const colorClass = getActivityColor(activity.type);
              const performerName = formatActivityActorPrimary(
                activity.performedBy,
                activity.metadata
              );
              const delegateStaff = formatActivityDelegateStaffSummary(activity.metadata);
              const canDelete = isActivityDeletable(activity);
              const activityDate = new Date(activity.createdAt);

              return (
                <div
                  key={activity._id}
                  className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition-colors"
                >
                  <div
                    className={`p-2 rounded-lg bg-white/5 border border-white/10 ${colorClass} shrink-0`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white/90 font-medium">
                      {activity.description}
                    </div>
                    <div className="mt-1 space-y-0.5 text-xs text-white/50">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span>{performerName}</span>
                        <span>•</span>
                        <span>
                          {formatDistanceToNow(activityDate, {
                            addSuffix: true,
                          })}
                        </span>
                        <span>•</span>
                        <span>
                          {format(activityDate, "MMM d, yyyy 'at' h:mm a")}
                        </span>
                      </div>
                      {delegateStaff ? (
                        <div className="text-[11px] text-white/40">Staff: {delegateStaff}</div>
                      ) : null}
                    </div>
                  </div>
                  {canDelete && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(activity)}
                      className="h-8 w-8 shrink-0 text-red-300/70 hover:text-red-300 hover:bg-red-500/20"
                      disabled={deleteActivity.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {!isLoading &&
          !isError &&
          filteredActivities.length > 0 &&
          pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-white/10 pt-4">
              <div className="text-xs text-muted-foreground">
                Showing {filteredActivities.length} of {pagination.total}{" "}
                activities
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="border-white/15 bg-black/60 text-xs"
                >
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page {page} of {pagination.totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPage((p) => Math.min(pagination.totalPages, p + 1))
                  }
                  disabled={page >= pagination.totalPages}
                  className="border-white/15 bg-black/60 text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {confirmationDialog}
    </>
  );
}
