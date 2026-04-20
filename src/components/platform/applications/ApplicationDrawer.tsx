"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import {
  Clock,
  GraduationCap,
  KanbanSquare,
  UserCircle,
  UsersRound,
} from "lucide-react";

import { useBusyToast } from "@/hooks/useBusyToast";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useIsMobile";
import { RejectionModal } from "./RejectionModal";
import {
  APPLICATION_PIPELINE_STAGES,
  PIPELINE_STAGE_LABELS,
} from "@/constants/application-pipeline";
import { toast } from "sonner";

type ApplicationDetail = {
  _id: string;
  schoolName?: string;
  schoolType?: "Basic" | "Secondary";
  city?: string;
  region?: string;
  status?: "submitted" | "reviewed" | "approved" | "rejected";
  pipelineStage?: string;
  pipelineStageLabel?: string;
  stagePersisted?: boolean;
  nextActionAt?: string | null;
  owner?: {
    _id: string;
    name?: string;
    email?: string;
  } | null;
  ownerUserId?: string | null;
  enrolledStudentId?: string | null;
  enrolledStudent?: {
    _id: string;
    firstName: string;
    lastName: string;
    admissionNo?: string | null;
  } | null;
  admin?: {
    name?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
  linkedSchool?: {
    _id: string;
    name: string;
    type: "Basic" | "Secondary";
    status: "pending" | "active" | "deactivated";
    city?: string;
    region?: string;
  } | null;
  linkedSchoolId?: string | null;
  processedBy?: {
    _id: string;
    name: string;
    email: string;
  } | null;
  processedById?: string | null;
  createdAt?: string;
  updatedAt?: string;
  raw?: unknown;
  audit?: Array<{
    action: string;
    by?: {
      _id: string;
      name: string;
      email: string;
    };
    at: string;
    note?: string;
    meta?: Record<string, unknown> | null;
  }>;
};

function toDatetimeLocalValue(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseDatetimeLocalToDate(s: string): Date | null {
  if (!s.trim()) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getTimeHHmmFromDatetimeLocal(s: string): string {
  const d = parseDatetimeLocalToDate(s);
  if (!d) return "09:00";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Local datetime string for `<input type="datetime-local">`-compatible state. */
function dateToDatetimeLocalString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function mergeCalendarDateIntoLocal(
  prevLocal: string,
  calendarDate: Date | null
): string {
  if (!calendarDate) return "";
  const timeHHmm = prevLocal
    ? getTimeHHmmFromDatetimeLocal(prevLocal)
    : "09:00";
  const [h, m] = timeHHmm.split(":").map((x) => parseInt(x, 10));
  const next = new Date(calendarDate);
  next.setHours(Number.isFinite(h) ? h : 9, Number.isFinite(m) ? m : 0, 0, 0);
  return dateToDatetimeLocalString(next);
}

function mergeTimeIntoLocal(prevLocal: string, timeHHmm: string): string {
  const parsed = prevLocal ? parseDatetimeLocalToDate(prevLocal) : null;
  const d = new Date(parsed ?? new Date());
  const [h, m] = timeHHmm.split(":").map((x) => parseInt(x, 10));
  d.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
  return dateToDatetimeLocalString(d);
}

function formatAuditMeta(action: string, meta: Record<string, unknown> | null | undefined) {
  if (!meta) return null;
  if (action === "student_enrolled") {
    const m = meta as { firstName?: string; lastName?: string; studentId?: string };
    const name = [m.firstName, m.lastName].filter(Boolean).join(" ");
    return name ? `Student: ${name} (${m.studentId ?? ""})` : JSON.stringify(meta);
  }
  if (action === "pipeline_updated" && Array.isArray((meta as { changes?: unknown }).changes)) {
    const changes = (meta as { changes: Array<{ field: string; from: unknown; to: unknown }> }).changes;
    return changes
      .map((c) => `${c.field}: ${JSON.stringify(c.from)} → ${JSON.stringify(c.to)}`)
      .join("; ");
  }
  return JSON.stringify(meta);
}

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

const titleizeKey = (key: string) => {
  // Remove "linkedSchoolId" prefix and clean up
  let cleaned = key.replace(/^linkedSchoolId\./i, "");

  // Remove "processedBy" prefix for nested fields
  cleaned = cleaned.replace(/^processedBy\./i, "");

  // Split by dots and format each segment
  const segments = cleaned.split(".");
  const formatted = segments.map((segment) =>
    segment
      .replace(/([a-z\d])([A-Z])/g, "$1 $2")
      .replace(/[_-]/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .replace(/\bId\b/gi, "ID")
  );

  // Return only the last segment (field name) without the "›" separator
  return formatted[formatted.length - 1];
};

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

function updateMetricsCache(
  qc: ReturnType<typeof useQueryClient>,
  metric: "pending" | "approved" | "rejected",
  delta: number
) {
  qc.setQueriesData<{ pending: number; approved: number; rejected: number }>(
    { queryKey: ["applications:metrics"] },
    (old) => {
      if (!old) return old;
      return {
        ...old,
        [metric]: Math.max(0, (old[metric] ?? 0) + delta),
      };
    }
  );
}

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
  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [editStage, setEditStage] = useState<string>("lead");
  const [editNextLocal, setEditNextLocal] = useState("");
  const [editOwnerId, setEditOwnerId] = useState<string>("");
  const [enFirstName, setEnFirstName] = useState("");
  const [enLastName, setEnLastName] = useState("");
  const [enGradeId, setEnGradeId] = useState("");
  const [enClassId, setEnClassId] = useState("");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["applications:detail", id],
    enabled: open && !!id,
    queryFn: async () => {
      const res = await fetch(`/api/platform/applications/${id}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const text = await res.text();
      if (!res.ok) {
        let msg = `Request failed (${res.status})`;
        try {
          const j = JSON.parse(text) as { error?: string };
          if (typeof j?.error === "string" && j.error) msg = j.error;
        } catch {
          /* non-JSON error body */
        }
        throw new Error(msg);
      }
      try {
        return JSON.parse(text) as ApplicationDetail;
      } catch {
        throw new Error("Invalid response from server");
      }
    },
  });

  useEffect(() => {
    if (!data) return;
    setEditStage(data.pipelineStage ?? "lead");
    setEditNextLocal(toDatetimeLocalValue(data.nextActionAt));
    setEditOwnerId(data.ownerUserId ?? "");
  }, [data?._id, data?.pipelineStage, data?.nextActionAt, data?.ownerUserId]);

  const { data: platformAdmins } = useQuery({
    queryKey: ["platform-admins"],
    enabled: open,
    queryFn: async () => {
      const res = await fetch("/api/platform/users/platform-admins", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("platform-admins");
      const json = (await res.json()) as {
        success: boolean;
        data: Array<{ _id: string; name: string; email: string }>;
      };
      return json.data ?? [];
    },
  });

  const { data: enrollmentCtx } = useQuery({
    queryKey: ["enrollment-context", id],
    enabled: open && enrollOpen && !!id,
    queryFn: async () => {
      const res = await fetch(
        `/api/platform/applications/${id}/enrollment-context`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("enrollment-context");
      return (await res.json()) as {
        success: boolean;
        data: {
          schoolId: string;
          grades: Array<{
            id: string;
            name: string;
            classGroups: Array<{ id: string; name: string }>;
          }>;
        };
      };
    },
  });

  const selectedGrade = enrollmentCtx?.data?.grades.find((g) => g.id === enGradeId);

  const savePipeline = useMutation({
    mutationFn: async () => {
      const nextIso = editNextLocal
        ? new Date(editNextLocal).toISOString()
        : null;
      const res = await fetch(`/api/platform/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pipeline: {
            stage: editStage as (typeof APPLICATION_PIPELINE_STAGES)[number],
            nextActionAt: editNextLocal ? nextIso : null,
            ownerUserId: editOwnerId ? editOwnerId : null,
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error || "Save failed");
    },
    onSuccess: () => {
      toast.success("Pipeline saved");
      qc.invalidateQueries({ queryKey: ["applications:list"], exact: false });
      qc.invalidateQueries({ queryKey: ["applications:detail", id] });
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Save failed");
    },
  });

  const enrollStudent = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/platform/applications/${id}/enroll-student`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: enFirstName.trim(),
            lastName: enLastName.trim(),
            gradeId: enGradeId,
            classGroupId: enClassId,
          }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as { error?: string }).error || "Enrollment failed");
      }
    },
    onSuccess: () => {
      toast.success("Student enrolled");
      setEnrollOpen(false);
      qc.invalidateQueries({ queryKey: ["applications:list"], exact: false });
      qc.invalidateQueries({ queryKey: ["applications:detail", id] });
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Enrollment failed");
    },
  });

  useEffect(() => {
    if (!enrollOpen || !enrollmentCtx?.data?.grades?.length) return;
    setEnGradeId((prev) => prev || enrollmentCtx.data.grades[0].id);
  }, [enrollOpen, enrollmentCtx?.data]);

  useEffect(() => {
    if (!enrollmentCtx?.data?.grades || !enGradeId) return;
    const g = enrollmentCtx.data.grades.find((x) => x.id === enGradeId);
    if (!g?.classGroups?.length) {
      setEnClassId("");
      return;
    }
    setEnClassId((prev) => {
      const ok = g.classGroups.some((c) => c.id === prev);
      return ok ? prev : g.classGroups[0].id;
    });
  }, [enGradeId, enrollmentCtx?.data]);

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
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["applications:metrics"] });
      const prevMetrics = qc.getQueriesData({ queryKey: ["applications:metrics"] });
      // Update metrics optimistically (from pending/reviewed to approved)
      if (data?.status === "submitted" || data?.status === "reviewed") {
        updateMetricsCache(qc, "pending", -1);
        updateMetricsCache(qc, "approved", 1);
      }
      return { prevMetrics };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prevMetrics) {
        ctx.prevMetrics.forEach(([key, data]) => {
          qc.setQueryData(key, data);
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["applications:list"], exact: false });
      qc.invalidateQueries({ queryKey: ["applications:detail", id] });
      qc.invalidateQueries({ queryKey: ["applications:metrics"], exact: false });
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
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["applications:metrics"] });
      const prevMetrics = qc.getQueriesData({ queryKey: ["applications:metrics"] });
      // Update metrics optimistically (from pending/reviewed to rejected)
      if (data?.status === "submitted" || data?.status === "reviewed") {
        updateMetricsCache(qc, "pending", -1);
        updateMetricsCache(qc, "rejected", 1);
      }
      return { prevMetrics };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prevMetrics) {
        ctx.prevMetrics.forEach(([key, data]) => {
          qc.setQueryData(key, data);
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["applications:list"], exact: false });
      qc.invalidateQueries({ queryKey: ["applications:detail", id] });
      qc.invalidateQueries({ queryKey: ["applications:metrics"], exact: false });
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

  // Filter and transform raw entries
  const rawEntries =
    data?.raw && typeof data.raw === "object" ? flattenObject(data.raw) : [];

  const payloadEntries = rawEntries
    .filter((entry) => {
      const key = entry.key.toLowerCase();
      // Filter out ID-only fields and processedBy/linkedSchoolId references
      if (
        key === "linkedschoolid" ||
        key === "linkedschoolid._id" ||
        key === "processedby._id" ||
        key === "processedby" ||
        key === "owneruserid" ||
        key === "owneruserid._id" ||
        (key.endsWith("._id") && key !== "_id")
      ) {
        return false;
      }
      // Filter out nested processedBy fields (we'll add them separately)
      if (key.startsWith("processedby.")) {
        return false;
      }
      if (key.startsWith("owneruserid.")) {
        return false;
      }
      // Filter out duplicate CITY and REGION (already shown in main section)
      if (key === "city" || key === "region") {
        return false;
      }
      // Filter out linkedSchoolId.city and linkedSchoolId.region (duplicates)
      if (key === "linkedschoolid.city" || key === "linkedschoolid.region") {
        return false;
      }
      if (key === "stage" || key === "nextactionat") {
        return false;
      }
      if (key === "enrolledstudentid") {
        return false;
      }
      return true;
    })
    .map((entry) => {
      const key = entry.key.toLowerCase();
      // Differentiate STATUS entries
      if (key === "status") {
        // This is the application status - rename for clarity
        return { key: "Application Status", value: entry.value };
      }
      if (key === "linkedschoolid.status") {
        // This is the school status - rename it
        return { key: "School Status", value: entry.value };
      }
      return entry;
    });

  // Add processedBy information from populated data
  if (data?.processedBy) {
    const processedByName = data.processedBy.name || data.processedBy.email;
    // Check if "Processed By" already exists (shouldn't, but just in case)
    const hasProcessedBy = payloadEntries.some(
      (e) => e.key.toLowerCase() === "processed by"
    );
    if (!hasProcessedBy) {
      payloadEntries.push({ key: "Processed By", value: processedByName });
    }
  }

  const canReview = true; // Allow status changes for all statuses

  const reviewerLabel =
    data?.status === "reviewed"
      ? "Reviewed by"
      : data?.status === "approved" || data?.status === "rejected"
      ? "Processed by"
      : null;

  const review = useMutation({
    mutationFn: async ({
      status,
      note,
    }: {
      status: "submitted" | "reviewed" | "approved" | "rejected";
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
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className={cn(
          "bg-card/95 backdrop-blur border-white/10 px-4 py-6",
          isMobile ? "h-[90vh] rounded-t-2xl" : "w-full sm:max-w-lg"
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
              {error instanceof Error && error.message ? (
                <span className="mt-1 block text-sm text-white/50">
                  {error.message}
                </span>
              ) : null}
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

                  <div className="grid gap-2 rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-white/50">
                      Pipeline
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className="border-cyan-500/30 bg-cyan-500/10 text-cyan-100"
                        >
                          {data.pipelineStageLabel ?? data.pipelineStage ?? "—"}
                        </Badge>
                        {data.nextActionAt ? (
                          <span className="text-sm text-white/70">
                            Next action{" "}
                            <span className="text-white/90">
                              {formatDateHuman(data.nextActionAt)}
                            </span>
                          </span>
                        ) : (
                          <span className="text-sm text-white/45">
                            No next action date
                          </span>
                        )}
                      </div>
                      {data.owner ? (
                        <div className="text-right text-xs text-white/60 sm:text-left">
                          <div className="uppercase tracking-wide text-white/40">
                            Owner
                          </div>
                          <div className="text-sm text-white/85">
                            {data.owner.name || data.owner.email || "—"}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-white/45">No owner</span>
                      )}
                    </div>
                    {data.stagePersisted === false ? (
                      <p className="text-xs text-white/45">
                        Stage is inferred from application status until an explicit
                        pipeline stage is stored.
                      </p>
                    ) : null}
                  </div>

                  <div className="grid gap-3 rounded-2xl border border-dashed border-cyan-500/20 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-white/50">
                      Update pipeline
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase tracking-wide text-white/45">
                          Stage
                        </Label>
                        <PremiumSelect
                          value={editStage}
                          onValueChange={setEditStage}
                        >
                          <PremiumSelectTrigger
                            icon={<KanbanSquare className="h-4 w-4" />}
                            className="border-white/10 bg-black/30"
                          >
                            <PremiumSelectValue placeholder="Stage" />
                          </PremiumSelectTrigger>
                          <PremiumSelectContent className="z-[300]">
                            {APPLICATION_PIPELINE_STAGES.map((s) => (
                              <PremiumSelectItem key={s} value={s}>
                                {PIPELINE_STAGE_LABELS[s]}
                              </PremiumSelectItem>
                            ))}
                          </PremiumSelectContent>
                        </PremiumSelect>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase tracking-wide text-white/45">
                          Owner (platform)
                        </Label>
                        <PremiumSelect
                          value={editOwnerId || "__none__"}
                          onValueChange={(v) =>
                            setEditOwnerId(v === "__none__" ? "" : v)
                          }
                        >
                          <PremiumSelectTrigger
                            icon={<UserCircle className="h-4 w-4" />}
                            className="border-white/10 bg-black/30"
                          >
                            <PremiumSelectValue placeholder="Unassigned" />
                          </PremiumSelectTrigger>
                          <PremiumSelectContent className="z-[300]">
                            <PremiumSelectItem value="__none__">
                              Unassigned
                            </PremiumSelectItem>
                            {(platformAdmins ?? []).map((u) => (
                              <PremiumSelectItem key={u._id} value={u._id}>
                                {u.name}
                              </PremiumSelectItem>
                            ))}
                          </PremiumSelectContent>
                        </PremiumSelect>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase tracking-wide text-white/45">
                        Next action (local time)
                      </Label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <CustomDatePicker
                          value={
                            editNextLocal
                              ? parseDatetimeLocalToDate(editNextLocal)
                              : null
                          }
                          onChange={(d) =>
                            setEditNextLocal(
                              mergeCalendarDateIntoLocal(editNextLocal, d)
                            )
                          }
                          placeholder="Select date"
                          className="w-full"
                        />
                        <div className="flex flex-col justify-end gap-1.5">
                          <Label className="text-[10px] uppercase tracking-wide text-white/45 sm:sr-only">
                            Time
                          </Label>
                          <div className="relative">
                            <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                            <Input
                              type="time"
                              value={
                                editNextLocal
                                  ? getTimeHHmmFromDatetimeLocal(editNextLocal)
                                  : ""
                              }
                              onChange={(e) =>
                                setEditNextLocal(
                                  mergeTimeIntoLocal(
                                    editNextLocal,
                                    e.target.value
                                  )
                                )
                              }
                              className={cn(
                                "h-10 w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-3",
                                "text-sm text-white placeholder:text-white/40",
                                "hover:bg-white/8 hover:border-white/20",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30 focus-visible:border-violet-500/50"
                              )}
                            />
                          </div>
                        </div>
                      </div>
                      <p className="text-[10px] text-white/40">
                        Clear the date in the calendar to remove the next-action
                        date before saving.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full border border-cyan-500/25 bg-cyan-500/10 text-cyan-50 hover:bg-cyan-500/20"
                      disabled={savePipeline.isPending}
                      onClick={() => savePipeline.mutate()}
                    >
                      {savePipeline.isPending ? "Saving…" : "Save pipeline"}
                    </Button>
                  </div>

                  {data.status === "approved" && data.linkedSchoolId ? (
                    data.enrolledStudent ? (
                      <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4">
                        <div className="text-xs uppercase tracking-[0.2em] text-emerald-200/80">
                          Enrolled student (CRM)
                        </div>
                        <div className="mt-1 text-sm font-medium text-white">
                          {data.enrolledStudent.firstName}{" "}
                          {data.enrolledStudent.lastName}
                        </div>
                        <div className="text-xs text-white/50">
                          Student ID: {data.enrolledStudent._id}
                          {data.enrolledStudent.admissionNo
                            ? ` · Adm: ${data.enrolledStudent.admissionNo}`
                            : ""}
                        </div>
                        <p className="mt-2 text-xs text-white/45">
                          Add guardians and fee plans from the school admin workspace.
                        </p>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full border border-emerald-500/30 bg-emerald-500/5 text-emerald-100 hover:bg-emerald-500/15"
                        onClick={() => {
                          setEnFirstName("");
                          setEnLastName("");
                          setEnGradeId("");
                          setEnClassId("");
                          setEnrollOpen(true);
                        }}
                      >
                        Enroll first student…
                      </Button>
                    )
                  ) : null}

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
                      {reviewerLabel && data.processedBy ? (
                        <div className="text-right text-xs text-white/60">
                          {reviewerLabel}
                          <div className="text-sm text-white/80">
                            {data.processedBy.name || "Platform Team"}
                          </div>
                        </div>
                      ) : null}
                    </div>
                    {canReview && (
                      <div className="flex flex-wrap items-center gap-2">
                        {data.status === "submitted" && (
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
                                "Optional note for review"
                              );
                              review.mutate({
                                status: "reviewed",
                                note: note ?? undefined,
                              });
                            }}
                          >
                            Mark as Reviewed
                          </Button>
                        )}
                        {data.status === "reviewed" && (
                          <>
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
                                  "Optional note for returning to submitted"
                                );
                                review.mutate({
                                  status: "submitted",
                                  note: note ?? undefined,
                                });
                              }}
                            >
                              Return to Submitted
                            </Button>
                          </>
                        )}
                        {data.status === "approved" && (
                          <>
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
                                  "Optional note for status change"
                                );
                                review.mutate({
                                  status: "submitted",
                                  note: note ?? undefined,
                                });
                              }}
                            >
                              Return to Submitted
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                              disabled={
                                review.isPending ||
                                approve.isPending ||
                                reject.isPending
                              }
                              onClick={() => {
                                const note = window.prompt(
                                  "Optional note for rejection"
                                );
                                review.mutate({
                                  status: "rejected",
                                  note: note ?? undefined,
                                });
                              }}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                        {data.status === "rejected" && (
                          <>
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
                                  "Optional note for status change"
                                );
                                review.mutate({
                                  status: "submitted",
                                  note: note ?? undefined,
                                });
                              }}
                            >
                              Return to Submitted
                            </Button>
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
                                  "Optional note for review"
                                );
                                review.mutate({
                                  status: "reviewed",
                                  note: note ?? undefined,
                                });
                              }}
                            >
                              Mark as Reviewed
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                              disabled={
                                review.isPending ||
                                approve.isPending ||
                                reject.isPending
                              }
                              onClick={() => {
                                const note = window.prompt(
                                  "Optional note for approval"
                                );
                                review.mutate({
                                  status: "approved",
                                  note: note ?? undefined,
                                });
                              }}
                            >
                              Approve
                            </Button>
                          </>
                        )}
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

                  {/* Linked School */}
                  {data.linkedSchool && (
                    <div className="grid gap-1 rounded-2xl border border-white/10 bg-black/30 p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-white/50">
                        Linked School
                      </div>
                      <div className="text-base font-medium text-white">
                        {data.linkedSchool.name}
                      </div>
                      <div className="text-sm text-white/60">
                        {data.linkedSchool.type}
                        {data.linkedSchool.city || data.linkedSchool.region
                          ? ` · ${data.linkedSchool.city || ""}${
                              data.linkedSchool.city && data.linkedSchool.region
                                ? ", "
                                : ""
                            }${data.linkedSchool.region || ""}`
                          : ""}
                      </div>
                      <div className="mt-1">
                        <Badge
                          className={cn(
                            "text-xs",
                            data.linkedSchool.status === "active"
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                              : data.linkedSchool.status === "pending"
                              ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
                              : "bg-rose-500/20 text-rose-300 border-rose-500/30"
                          )}
                          variant="outline"
                        >
                          {data.linkedSchool.status}
                        </Badge>
                      </div>
                    </div>
                  )}
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
                          {a.by ? `by ${a.by.name}` : "System"}
                        </div>
                        {a.note ? (
                          <div className="mt-1 text-sm text-white/60">
                            {a.note}
                          </div>
                        ) : null}
                        {a.meta ? (
                          <div className="mt-2 break-all text-xs text-white/50">
                            {formatAuditMeta(a.action, a.meta)}
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
                    onClick={() => setRejectionModalOpen(true)}
                    disabled={
                      data.status === "rejected" ||
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
                      data.status === "approved" ||
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
      <RejectionModal
        open={rejectionModalOpen}
        onOpenChange={setRejectionModalOpen}
        onConfirm={(reason) => reject.mutate(reason)}
        isPending={reject.isPending}
      />
    </Sheet>

    <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
      <DialogContent className="border-white/10 bg-card text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enroll first student</DialogTitle>
          <DialogDescription className="text-white/60">
            Creates a learner on the approved school. Guardians and fees are
            configured by the school admin after onboarding.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>First name</Label>
              <Input
                value={enFirstName}
                onChange={(e) => setEnFirstName(e.target.value)}
                className="border-white/10 bg-black/30"
                placeholder="Given name"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Last name</Label>
              <Input
                value={enLastName}
                onChange={(e) => setEnLastName(e.target.value)}
                className="border-white/10 bg-black/30"
                placeholder="Family name"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Grade</Label>
            <PremiumSelect
              value={enGradeId || undefined}
              onValueChange={setEnGradeId}
            >
              <PremiumSelectTrigger
                icon={<GraduationCap className="h-4 w-4" />}
                className="border-white/10 bg-black/30"
              >
                <PremiumSelectValue placeholder="Select grade" />
              </PremiumSelectTrigger>
              <PremiumSelectContent className="z-[400]">
                {(enrollmentCtx?.data?.grades ?? []).map((g) => (
                  <PremiumSelectItem key={g.id} value={g.id}>
                    {g.name}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
          </div>
          <div className="space-y-1.5">
            <Label>Class</Label>
            <PremiumSelect
              value={enClassId || undefined}
              onValueChange={setEnClassId}
            >
              <PremiumSelectTrigger
                icon={<UsersRound className="h-4 w-4" />}
                className="border-white/10 bg-black/30"
              >
                <PremiumSelectValue placeholder="Select class" />
              </PremiumSelectTrigger>
              <PremiumSelectContent className="z-[400]">
                {(selectedGrade?.classGroups ?? []).map((c) => (
                  <PremiumSelectItem key={c.id} value={c.id}>
                    {c.name}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
          </div>
          {!enrollmentCtx?.data?.grades?.length && enrollOpen ? (
            <p className="text-xs text-amber-200/90">
              No grades or classes found for this school yet. Complete school setup
              (grades and classes) before enrolling.
            </p>
          ) : null}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => setEnrollOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={
              enrollStudent.isPending ||
              !enFirstName.trim() ||
              !enLastName.trim() ||
              !enGradeId ||
              !enClassId
            }
            onClick={() => enrollStudent.mutate()}
          >
            {enrollStudent.isPending ? "Enrolling…" : "Create student"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
