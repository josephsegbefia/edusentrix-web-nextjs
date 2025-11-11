/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import {
  type QueryKey,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RejectionModal } from "./RejectionModal";

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
  activeStatus,
  queryKey,
}: {
  application: Application;
  onOpen: () => void;
  activeStatus: "all" | ApplicationStatus;
  queryKey: QueryKey;
}) {
  const qc = useQueryClient();
  const { promise, error } = useBusyToast();
  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);

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
      await qc.cancelQueries({ queryKey });
      const prev = qc.getQueryData(queryKey);
      updateListCache(qc, queryKey, application._id, "approved", activeStatus);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(queryKey, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey });
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
      await qc.cancelQueries({ queryKey });
      const prev = qc.getQueryData(queryKey);
      updateListCache(qc, queryKey, application._id, "rejected", activeStatus);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(queryKey, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey });
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
    <Card className="group relative flex h-full flex-col justify-between overflow-hidden border border-white/10 bg-gradient-to-br from-white/3 via-transparent to-transparent p-6 shadow-lg shadow-black/15 transition hover:border-white/20">
      <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100">
        <div className="absolute inset-0 bg-gradient-to-br from-white/8 via-white/0 to-white/0" />
      </div>

      <div className="relative z-10 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-white/50">
              {application.schoolType}
            </div>
            <div className="mt-1 text-xl font-semibold text-white">
              {application.schoolName}
            </div>
          </div>
          <Badge className={`${statusColor} px-3 py-1 capitalize`} variant="outline">
            {application.status}
          </Badge>
        </div>

        <div className="flex flex-col gap-2 rounded-xl bg-white/4 p-4 text-sm text-white/80 shadow-inner shadow-black/20 backdrop-blur">
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-white/50">
              Admin Contact
            </span>
            <span className="font-medium text-white/90">
              {application.admin.name ? `${application.admin.name} · ` : ""}
              {application.admin.email}
            </span>
            {application.admin.phone && (
              <span className="text-white/60">{application.admin.phone}</span>
            )}
          </div>

          {(application.city || application.region) && (
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-white/50">
                Location
              </span>
              <span className="text-white/70">
                {application.city ? `${application.city}, ` : ""}
                {application.region ?? ""}
              </span>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-white/50">
              Submitted
            </span>
            <span className="text-white/70">
              {formatDistanceToNow(new Date(application.createdAt), {
                addSuffix: true,
              })}
            </span>
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-6 flex items-center justify-between gap-3">
        <Button variant="secondary" onClick={onOpen} className="flex-1">
          View Details
        </Button>
        <div className="flex flex-1 justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => setRejectionModalOpen(true)}
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
      <RejectionModal
        open={rejectionModalOpen}
        onOpenChange={setRejectionModalOpen}
        onConfirm={(reason) => reject.mutate(reason)}
        isPending={reject.isPending}
      />
    </Card>
  );
}

function updateListCache(
  qc: ReturnType<typeof useQueryClient>,
  queryKey: QueryKey,
  id: string,
  status: "approved" | "rejected",
  activeStatus: "all" | ApplicationStatus
) {
  qc.setQueryData<any>(queryKey, (data: any) => {
    if (!data?.pages) return data;
    return {
      ...data,
      pages: data.pages.map((p: any) => {
        if (!Array.isArray(p?.items)) return p;
        const mapped = p.items.map((it: Application) =>
          it._id === id ? { ...it, status } : it
        );
        const filtered =
          activeStatus === "all"
            ? mapped
            : mapped.filter((it: Application) =>
                matchesFilter(it.status, activeStatus)
              );
        return { ...p, items: filtered };
      }),
    };
  });
}

function matchesFilter(
  status: ApplicationStatus,
  activeStatus: "all" | ApplicationStatus
) {
  if (activeStatus === "all") return true;
  if (activeStatus === "pending") return status === "pending";
  return status === activeStatus;
}
