/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import { useBusyToast } from "@/hooks/useBusyToast";

export type ApplicationStatus = "pending" | "approved" | "rejected";

export type Application = {
  _id: string;
  schoolName: string;
  schoolType: "Basic" | "Secondary";
  city?: string;
  region?: string;
  admin: { name?: string; email: string; phone?: string };
  status: ApplicationStatus;
  createdAt: string; // ISO
};

export default function ApplicationCard({
  application,
  onOpen,
}: {
  application: Application;
  onOpen: () => void;
}) {
  const qc = useQueryClient();
  const { promise, error } = useBusyToast();

  const approve = useMutation({
    mutationFn: async () => {
      const req = fetch(
        `/api/platform/applications/${application._id}/approve`,
        { method: "POST" }
      );
      await promise(req, {
        loading: "Approving…",
        success: "Application approved",
        error: "Approve failed",
      });
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["applications:list"] });
      const prev = qc.getQueriesData({ queryKey: ["applications:list"] });
      // optimistic: set status=approved
      updateEveryPage(qc, application._id, "approved");
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      // rollback
      if (ctx?.prev) restoreQueries(qc, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["applications:list"] });
      qc.invalidateQueries({ queryKey: ["applications:metrics"] });
    },
  });

  const reject = useMutation({
    mutationFn: async (reason: string) => {
      const req = fetch(
        `/api/platform/applications/${application._id}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        }
      );
      await promise(req, {
        loading: "Rejecting…",
        success: "Application rejected",
        error: "Reject failed",
      });
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["applications:list"] });
      const prev = qc.getQueriesData({ queryKey: ["applications:list"] });
      updateEveryPage(qc, application._id, "rejected");
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) restoreQueries(qc, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["applications:list"] });
      qc.invalidateQueries({ queryKey: ["applications:metrics"] });
    },
  });

  const statusColor = {
    pending: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    approved: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    rejected: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  }[application.status];

  return (
    <Card className="bg-card/80 border border-white/10 p-4 h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-3">
          <div className="text-lg font-semibold">{application.schoolName}</div>
          <Badge className={statusColor} variant="outline">
            {application.status}
          </Badge>
        </div>

        <div className="text-sm text-muted mt-1">{application.schoolType}</div>

        <div className="text-sm mt-3 space-y-1">
          <div className="text-white/90">
            Admin:{" "}
            {application.admin.name ? `${application.admin.name} · ` : ""}
            {application.admin.email}
          </div>
          {application.admin.phone && (
            <div className="text-muted">{application.admin.phone}</div>
          )}
          {(application.city || application.region) && (
            <div className="text-muted">
              {application.city ? `${application.city}, ` : ""}
              {application.region ?? ""}
            </div>
          )}
          <div className="text-muted">
            Submitted{" "}
            {formatDistanceToNow(new Date(application.createdAt), {
              addSuffix: true,
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4">
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onOpen}>
            View
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              const reason = window.prompt("Reason for rejection?");
              if (!reason) return;
              reject.mutate(reason);
            }}
            disabled={application.status !== "pending" || reject.isPending}
          >
            Reject
          </Button>
          <Button
            onClick={() => approve.mutate()}
            disabled={application.status !== "pending" || approve.isPending}
          >
            Approve
          </Button>
        </div>
      </div>
    </Card>
  );
}

// Helpers for optimistic updates over infinite data
function updateEveryPage(
  qc: ReturnType<typeof useQueryClient>,
  id: string,
  status: "approved" | "rejected"
) {
  qc.setQueriesData<any>({ queryKey: ["applications:list"] }, (data: any) => {
    if (!data?.pages) return data;
    return {
      ...data,
      pages: data.pages.map((p: any) => ({
        ...p,
        items: p.items.map((it: Application) =>
          it._id === id ? { ...it, status } : it
        ),
      })),
    };
  });
}
function restoreQueries(
  qc: ReturnType<typeof useQueryClient>,
  prev: [unknown, unknown][]
) {
  prev.forEach(([key, value]) => qc.setQueryData(key as any, value));
}
