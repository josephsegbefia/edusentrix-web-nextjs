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

const getOrdinalSuffix = (day: number) => {
  const j = day % 10;
  const k = day % 100;
  if (j === 1 && k !== 11) return "st";
  if (j === 2 && k !== 12) return "nd";
  if (j === 3 && k !== 13) return "rd";
  return "th";
};

const formatDateHuman = (input?: string | null) => {
  if (!input) return "—";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "—";
  const day = date.getDate();
  const suffix = getOrdinalSuffix(day);
  const month = date.toLocaleDateString(undefined, { month: "long" });
  const year = date.getFullYear();
  return `${day}${suffix} ${month}, ${year}`;
};

const titleizeKey = (key: string) =>
  key
    .split(".")
    .map((segment) =>
      segment
        .replace(/([a-z\d])([A-Z])/g, "$1 $2")
        .replace(/[_-]/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase())
        .replace(/\bId\b/gi, "ID")
    )
    .join(" › ");

const flattenObject = (
  value: unknown,
  prefix = ""
): Array<{ key: string; value: unknown }> => {
  if (!value || typeof value !== "object" || value instanceof Date)
    return prefix ? [{ key: prefix, value }] : [];

  if (Array.isArray(value)) {
    if (!value.length) return prefix ? [{ key: prefix, value: "—" }] : [];

    return value.flatMap((item, index) =>
      flattenObject(item, `${prefix}[${index}]`)
    );
  }

  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, val]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      if (
        val &&
        typeof val === "object" &&
        !(val instanceof Date) &&
        !Array.isArray(val)
      ) {
        const nested = flattenObject(val, path);
        if (!nested.length) {
          return [{ key: path, value: "—" }];
        }
        return nested;
      }
      return [{ key: path, value: val }];
    }
  );
};

const formatRawValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number")
    return Number.isFinite(value) ? `${value}` : "—";
  if (typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      return formatDateHuman(value);
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.length
      ? value.map((item) => formatRawValue(item)).join(", ")
      : "—";
  }
  if (value instanceof Date) return formatDateHuman(value.toISOString());
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
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

  const payloadEntries =
    data?.raw && typeof data.raw === "object" ? flattenObject(data.raw) : [];

  const canReview = data?.status === "submitted" || data?.status === "reviewed";

  const reviewerLabel =
    data?.status === "reviewed"
      ? "Reviewed by"
      : data?.status === "approved"
      ? "Processed by"
      : null;

  const review = useMutation({
    mutationFn: async ({
      status,
      note,
    }: {
      status: "submitted" | "reviewed";
      note?: string;
    }) => {
      const req = fetch(`/api/platform/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note }),
      });
      await promise(req, {
        loading: "Updating status…",
        success: "Status updated",
        error: "Status update failed",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["applications:list"] });
      qc.invalidateQueries({ queryKey: ["applications:detail", id] });
      qc.invalidateQueries({ queryKey: ["applications:metrics"] });
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className={cn(
          "bg-card/95 backdrop-blur border-white/10 px-4 py-6",
          isMobile ? "h-[90vh] rounded-t-2xl" : "w-full sm:max-w-md"
        )}
      >
        <SheetHeader>
          <div className="rounded-2xl border border-white/10 bg-linear-to-br from-white/10 via-zinc-900/40 to-zinc-950/60 p-5 text-left shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <SheetTitle className="text-lg font-semibold text-white md:text-xl">
                  {isLoading ? (
                    <Skeleton className="h-6 w-48" />
                  ) : (
                    data?.schoolName ?? "Application Details"
                  )}
                </SheetTitle>
                <div className="text-sm text-white/60">
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
                <Badge
                  className={cn(
                    "shrink-0 border border-white/20 text-xs uppercase tracking-wide",
                    statusColor
                  )}
                  variant="outline"
                >
                  {data.status}
                </Badge>
              )}
            </div>
          </div>
        </SheetHeader>

        {/* Body */}
        <div className="mt-6 space-y-6 overflow-y-auto pr-1">
          {isLoading && (
            <div className="space-y-4">
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
              {/* Primary metadata */}
              <div className="rounded-3xl border border-white/10 bg-white/4 p-5 shadow-sm backdrop-blur">
                <div className="grid gap-5">
                  <div className="grid gap-1">
                    <div className="text-xs uppercase tracking-[0.2em] text-white/50">
                      Contact
                    </div>
                    <div className="text-base font-medium text-white">
                      {data.admin?.name || "—"}
                    </div>
                    <div className="text-sm text-white/60">
                      {data.admin?.email || "—"}
                      {data.admin?.phone ? (
                        <>
                          {" "}
                          · <span>{data.admin.phone}</span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/30 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs uppercase tracking-[0.2em] text-white/50">
                          Current Status
                        </div>
                        <div className="text-lg font-semibold text-white">
                          {data.status
                            ? data.status.charAt(0).toUpperCase() +
                              data.status.slice(1)
                            : "—"}
                        </div>
                      </div>
                      {reviewerLabel ? (
                        <div className="text-right text-xs text-white/60">
                          {reviewerLabel}
                          <div className="text-sm text-white/80">
                            Platform Team
                          </div>
                        </div>
                      ) : null}
                    </div>
                    {canReview && (
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-white/20 bg-white/5 text-white hover:bg-white/10"
                          disabled={
                            review.isPending ||
                            approve.isPending ||
                            reject.isPending
                          }
                          onClick={() => {
                            const note = window.prompt(
                              data.status === "submitted"
                                ? "Optional note for review"
                                : "Optional note for returning to submitted"
                            );
                            review.mutate({
                              status:
                                data.status === "submitted"
                                  ? "reviewed"
                                  : "submitted",
                              note: note ?? undefined,
                            });
                          }}
                        >
                          {data.status === "submitted"
                            ? "Mark as Reviewed"
                            : "Return to Submitted"}
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-white/50">
                        Submitted
                      </div>
                      <div className="text-sm text-white/80">
                        {formatDateHuman(data.createdAt)}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-white/50">
                        Last Updated
                      </div>
                      <div className="text-sm text-white/80">
                        {formatDateHuman(data.updatedAt)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Raw payload */}
              {payloadEntries.length > 0 && (
                <div className="rounded-3xl border border-white/10 bg-white/6 p-5 shadow-inner">
                  <div className="mb-3 text-sm font-medium uppercase tracking-[0.3em] text-white/50">
                    Application Snapshot
                  </div>
                  <div className="space-y-3 text-sm text-white/80">
                    {payloadEntries.map((entry) => (
                      <div
                        key={entry.key}
                        className="flex items-start justify-between gap-4 rounded-2xl border border-white/5 bg-black/30 px-4 py-3"
                      >
                        <span className="text-xs font-medium uppercase tracking-[0.2em] text-white/50">
                          {titleizeKey(entry.key)}
                        </span>
                        <span className="max-w-[55%] text-right text-sm text-white/80">
                          {formatRawValue(entry.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Audit */}
              {data.audit?.length ? (
                <div className="rounded-3xl border border-white/10 bg-white/4 p-5">
                  <div className="text-sm font-medium uppercase tracking-[0.3em] text-white/50">
                    Timeline
                  </div>
                  <ul className="mt-4 space-y-4 text-sm">
                    {data.audit.map((a, i) => (
                      <li
                        key={i}
                        className="rounded-2xl border border-white/5 bg-black/25 p-4 text-white/80"
                      >
                        <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.2em] text-white/50">
                          <span>{a.action}</span>
                          <span>{formatDateHuman(a.at)}</span>
                        </div>
                        <div className="mt-2 text-sm text-white/80">
                          {a.by ? "by Platform Team" : "System"}
                        </div>
                        {a.note ? (
                          <div className="mt-1 text-sm text-white/60">
                            {a.note}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {/* Actions */}
              <div className="flex items-center justify-between pt-1">
                <div className="text-xs uppercase tracking-[0.3em] text-white/50">
                  Applicant
                  <div className="mt-1 text-sm text-white/80">
                    {data.admin?.name || "—"}
                  </div>
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
                      approve.isPending ||
                      review.isPending
                    }
                  >
                    Reject
                  </Button>
                  <Button
                    onClick={() => approve.mutate()}
                    disabled={
                      data.status !== "submitted" ||
                      approve.isPending ||
                      reject.isPending ||
                      review.isPending
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
