"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { useBusyToast } from "@/hooks/useBusyToast";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useIsMobile";

type ApplicationDetail = {
  _id: string;
  schoolName?: string;
  schoolType?: "Basic" | "Secondary";
  city?: string;
  region?: string;
  status?: "submitted" | "reviewed" | "approved" | "rejected";
  admin?: {
    name?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
  linkedSchoolId?: string | null;
  processedBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
  raw?: unknown;
  audit?: Array<{ action: string; by?: string; at: string; note?: string }>;
};

export default function ApplicationDrawer({
  open,
  id,
  onOpenChange,
}: {
  open: boolean;
  id: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const isMobile = useIsMobile();
  const qc = useQueryClient();
  const { promise } = useBusyToast();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["applications:detail", id],
    enabled: open && !!id,
    queryFn: async () => {
      const res = await fetch(`/api/platform/applications/${id}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("detail");
      return (await res.json()) as ApplicationDetail;
    },
  });

  const approve = useMutation({
    mutationFn: async () => {
      const req = fetch(`/api/platform/applications/${id}/approve`, {
        method: "POST",
      });
      await promise(req, {
        loading: "Approving…",
        success: "Application approved",
        error: "Approve failed",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["applications:list"] });
      qc.invalidateQueries({ queryKey: ["applications:detail", id] });
      qc.invalidateQueries({ queryKey: ["applications:metrics"] });
      onOpenChange(false);
    },
  });

  const reject = useMutation({
    mutationFn: async (reason: string) => {
      const req = fetch(`/api/platform/applications/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      await promise(req, {
        loading: "Rejecting…",
        success: "Application rejected",
        error: "Reject failed",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["applications:list"] });
      qc.invalidateQueries({ queryKey: ["applications:detail", id] });
      qc.invalidateQueries({ queryKey: ["applications:metrics"] });
      onOpenChange(false);
    },
  });

  const statusColor = {
    submitted: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    reviewed: "bg-sky-500/20 text-sky-300 border-sky-500/30",
    approved: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    rejected: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  }[data?.status ?? "submitted"];

  const side = isMobile ? "bottom" : ("right" as const);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className={cn(
          "bg-card/95 backdrop-blur border-white/10",
          isMobile ? "h-[90vh] rounded-t-2xl" : "w-full sm:max-w-md"
        )}
      >
        <SheetHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <SheetTitle className="text-white">
                {isLoading ? (
                  <Skeleton className="h-6 w-48" />
                ) : (
                  data?.schoolName ?? "Application Details"
                )}
              </SheetTitle>
              <div className="text-sm text-muted mt-1">
                {isLoading ? (
                  <Skeleton className="h-4 w-24" />
                ) : (
                  <>
                    {data?.schoolType ?? "—"}
                    {(data?.city || data?.region) && (
                      <>
                        {" "}
                        · {data?.city ? `${data.city}, ` : ""}
                        {data?.region}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
            {!isLoading && data?.status && (
              <Badge className={cn("shrink-0", statusColor)} variant="outline">
                {data.status}
              </Badge>
            )}
          </div>
        </SheetHeader>

        {/* Body */}
        <div className="mt-5 space-y-5 overflow-y-auto pr-1">
          {isLoading && (
            <div className="space-y-3">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-32 w-full" />
            </div>
          )}

          {isError && (
            <div className="text-rose-300">
              Failed to load details. Please try again later.
            </div>
          )}

          {!isLoading && data && (
            <>
              {/* Admin block */}
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <div className="text-sm uppercase tracking-wide text-muted mb-2">
                  Admin
                </div>
                <div className="text-white/90 text-sm">
                  {data.admin?.name || "—"}
                </div>
                <div className="text-muted text-sm">
                  {data.admin?.email || "—"}
                  {data.admin?.phone ? <> · {data.admin.phone}</> : null}
                </div>
              </div>

              {/* Meta */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                  <div className="text-xs text-muted">Created</div>
                  <div className="text-sm">
                    {data.createdAt
                      ? new Date(data.createdAt).toLocaleString()
                      : "—"}
                  </div>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                  <div className="text-xs text-muted">Updated</div>
                  <div className="text-sm">
                    {data.updatedAt
                      ? new Date(data.updatedAt).toLocaleString()
                      : "—"}
                  </div>
                </div>
              </div>

              {/* Raw payload (collapsible / pre) */}
              {data.raw && (
                <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                  <div className="text-sm mb-2">Payload</div>
                  <pre className="text-xs text-white/80 overflow-auto max-h-64">
                    {JSON.stringify(data.raw, null, 2)}
                  </pre>
                </div>
              )}

              {/* Audit */}
              {data.audit?.length ? (
                <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                  <div className="text-sm mb-2">Audit</div>
                  <ul className="text-sm space-y-2">
                    {data.audit.map((a, i) => (
                      <li key={i} className="text-muted">
                        <span className="text-white/90">{a.action}</span>{" "}
                        {a.by ? `by ${a.by}` : ""} ·{" "}
                        {new Date(a.at).toLocaleString()}
                        {a.note ? ` — ${a.note}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {/* Actions */}
              <div className="flex items-center justify-between pt-1">
                <div className="text-xs text-muted">
                  ID: <span className="text-white/70">{data._id}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const reason = window.prompt("Reason for rejection?");
                      if (reason) reject.mutate(reason);
                    }}
                    disabled={
                      data.status !== "submitted" ||
                      reject.isPending ||
                      approve.isPending
                    }
                  >
                    Reject
                  </Button>
                  <Button
                    onClick={() => approve.mutate()}
                    disabled={
                      data.status !== "submitted" ||
                      approve.isPending ||
                      reject.isPending
                    }
                  >
                    Approve
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
