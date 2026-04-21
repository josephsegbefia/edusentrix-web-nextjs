import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type TimetableVersionStatus = "draft" | "published" | "archived";

export type TimetableVersionDTO = {
  id: string;
  schoolId: string;
  academicPeriodId: string;
  name: string;
  status: TimetableVersionStatus;
  baseVersionId: string | null;
  publishedAt: string | null;
  lockVersion: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type TimetableSlotSource = "manual" | "imported" | "assignment_sync";

export type TimetableSlotDTO = {
  id: string;
  schoolId: string;
  academicPeriodId: string;
  versionId: string;
  classGroupId: string;
  gradeId: string;
  subjectId: string;
  teacherId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  classroomLabel: string;
  source: TimetableSlotSource;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type TimetableConflictSeverity = "error" | "warning";
export type TimetableConflictStatus = "open" | "resolved" | "ignored";

export type TimetableConflictCode =
  | "TEACHER_OVERLAP"
  | "CLASS_OVERLAP"
  | "INVALID_TIME_RANGE"
  | "MISSING_TEACHER"
  | "MISSING_SUBJECT"
  | "MISSING_CLASSGROUP"
  | "MISSING_CLASSROOM_LABEL"
  | "OUTSIDE_PERIOD_RANGE"
  | "TEACHER_PENDING_ASSIGNMENT";

export type TimetableConflictSlotSummary = {
  slotId: string;
  classGroupId: string;
  className: string;
  gradeId: string;
  gradeName: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string | null;
  teacherId: string | null;
  teacherName: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  classroomLabel: string;
};

export type TimetableConflictResolvedDayDiagnostics = {
  firstPeriodStartTime: string | null;
  lastPeriodEndTime: string | null;
  scheduledPeriods: number;
  periodsShortfall: number;
  teachingMinutes: number;
  breakMinutes: number;
  assemblyMinutes: number;
  daySpanMinutes: number;
  allocatedMinutes: number;
  unallocatedMinutes: number;
  overflowMinutes: number;
};

export type TimetableConflictResolvedDaySummary = {
  startTime: string;
  endTime: string;
  periodDuration: number;
  periodsPerDay: number;
  expectedPeriodSlots: Array<{
    periodNumber: number;
    startTime: string;
    endTime: string;
    label?: string;
  }>;
  diagnostics: TimetableConflictResolvedDayDiagnostics;
};

export type TimetableConflictMetadata = Record<string, unknown> & {
  field?: string;
  validationCode?: string;
  dayName?: string;
  slot?: TimetableConflictSlotSummary;
  slots?: TimetableConflictSlotSummary[];
  resolvedDay?: TimetableConflictResolvedDaySummary;
};

export type TimetableConflictDTO = {
  id: string;
  schoolId: string;
  academicPeriodId: string;
  versionId: string;
  code: TimetableConflictCode;
  severity: TimetableConflictSeverity;
  status: TimetableConflictStatus;
  message: string;
  slotIds: string[];
  metadata: TimetableConflictMetadata;
  createdAt: string;
  updatedAt: string;
};

export type TimetableConflictBlockers = {
  openErrorCount: number;
  publishBlocked: boolean;
};

export type TimetableValidationIssue = {
  code: string;
  message: string;
  field?: string;
  severity: "error";
};

export type TimetableParityEntry = {
  assignmentId: string;
  academicPeriodId: string;
  classGroupId: string;
  subjectId: string;
  teacherId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

export type TimetableParityActualEntry = TimetableParityEntry & {
  slotId: string;
};

export type TimetableParityPeriodSummary = {
  academicPeriodId: string;
  versionId: string | null;
  versionStatus: "draft" | "published" | null;
  expectedCount: number;
  actualCount: number;
  missingCount: number;
  extraCount: number;
  mismatchCount: number;
  mismatchRate: number;
  missingExamples: TimetableParityEntry[];
  extraExamples: TimetableParityActualEntry[];
};

export type TimetableParityTotals = {
  periodCount: number;
  expected: number;
  actual: number;
  missing: number;
  extra: number;
  mismatches: number;
  mismatchRate: number;
};

export type TimetableParityReport = {
  schoolId: string;
  academicPeriodId: string | null;
  versionId: string | null;
  generatedAt: string;
  totals: TimetableParityTotals;
  periods: TimetableParityPeriodSummary[];
};

type VersionsResponse = {
  success: boolean;
  data: TimetableVersionDTO[];
  meta?: {
    academicPeriod?: {
      id: string;
      yearLabel: string;
      term: string;
    };
  };
};

type SlotPageResponse = {
  success: boolean;
  data: TimetableSlotDTO[];
  meta?: {
    version?: {
      id: string;
      status: TimetableVersionStatus;
      academicPeriodId: string;
    };
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type ConflictPageResponse = {
  success: boolean;
  data: TimetableConflictDTO[];
  meta?: {
    blockers?: TimetableConflictBlockers;
    version?: {
      id: string;
      status: TimetableVersionStatus;
      academicPeriodId: string;
    };
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type ParityResponse = {
  success: boolean;
  data: TimetableParityReport;
};

type ApiErrorResponse = {
  error?: string;
  issues?: TimetableValidationIssue[];
};

export function buildTimetableKey(...parts: Array<string | number | undefined>) {
  return ["timetable-admin", ...parts] as const;
}

async function readJsonSafe<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function getErrorMessage(
  payload: ApiErrorResponse | null,
  fallback: string
): string {
  return payload?.error || fallback;
}

export type MasterTimetableSlotRow = {
  slotId: string;
  classId: string;
  gradeId: string;
  className: string;
  gradeName: string;
  gradeLevel: number;
  subjectId: string;
  subjectName: string;
  subjectCode: string | null;
  teacherId: string;
  teacherName: string;
  teacherPhotoUrl: null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  location: string | null;
  roomId: null;
};

export type MasterTimetableMeta = {
  hasPublishedVersion: boolean;
  academicPeriodId: string | null;
  versionId: string | null;
  publishedAt: string | null;
  workingDays: number[];
};

type MasterTimetableResponse = {
  success: boolean;
  data: MasterTimetableSlotRow[];
  meta?: MasterTimetableMeta;
};

/**
 * Published master timetable for the school (read-only). Uses GET /api/admin/timetable/master.
 */
export function useMasterTimetable(academicPeriodId?: string) {
  return useQuery<MasterTimetableResponse>({
    queryKey: buildTimetableKey("master", academicPeriodId || "none"),
    queryFn: async () => {
      if (!academicPeriodId) throw new Error("academicPeriodId is required");
      const params = new URLSearchParams({ academicPeriodId });
      const res = await fetch(`/api/admin/timetable/master?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await readJsonSafe<ApiErrorResponse & MasterTimetableResponse>(res);
      if (!res.ok) {
        throw new Error(getErrorMessage(json, "Failed to load master timetable"));
      }
      return json as MasterTimetableResponse;
    },
    enabled: Boolean(academicPeriodId),
    staleTime: 30_000,
  });
}

export function useTimetableVersions(academicPeriodId?: string) {
  return useQuery<VersionsResponse>({
    queryKey: buildTimetableKey("versions", academicPeriodId || "none"),
    queryFn: async () => {
      if (!academicPeriodId) throw new Error("academicPeriodId is required");
      const params = new URLSearchParams({ academicPeriodId });
      const res = await fetch(`/api/admin/timetable/versions?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await readJsonSafe<ApiErrorResponse & VersionsResponse>(res);
      if (!res.ok) {
        throw new Error(getErrorMessage(json, "Failed to fetch timetable versions"));
      }
      return json as VersionsResponse;
    },
    enabled: Boolean(academicPeriodId),
    staleTime: 30_000,
  });
}

export function useTimetableVersionSlots(versionId?: string) {
  return useQuery<{
    success: boolean;
    data: TimetableSlotDTO[];
    meta?: SlotPageResponse["meta"];
  }>({
    queryKey: buildTimetableKey("slots", versionId || "none"),
    queryFn: async () => {
      if (!versionId) throw new Error("versionId is required");

      const limit = 500;
      let page = 1;
      let totalPages = 1;
      let meta: SlotPageResponse["meta"];
      const allSlots: TimetableSlotDTO[] = [];

      while (page <= totalPages) {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit),
        });

        const res = await fetch(
          `/api/admin/timetable/versions/${encodeURIComponent(versionId)}/slots?${params.toString()}`,
          {
            cache: "no-store",
          }
        );

        const json = await readJsonSafe<ApiErrorResponse & SlotPageResponse>(res);
        if (!res.ok) {
          throw new Error(getErrorMessage(json, "Failed to fetch timetable slots"));
        }

        const pagePayload = json as SlotPageResponse;
        allSlots.push(...(pagePayload.data || []));
        totalPages = Math.max(1, pagePayload.pagination?.totalPages || 1);
        meta = pagePayload.meta;
        page += 1;
      }

      return {
        success: true,
        data: allSlots,
        meta,
      };
    },
    enabled: Boolean(versionId),
    staleTime: 30_000,
  });
}

export function useTimetableConflicts(versionId?: string) {
  return useQuery<ConflictPageResponse>({
    queryKey: buildTimetableKey("conflicts", versionId || "none"),
    queryFn: async () => {
      if (!versionId) throw new Error("versionId is required");
      const params = new URLSearchParams({ page: "1", limit: "200", status: "open" });
      const res = await fetch(
        `/api/admin/timetable/versions/${encodeURIComponent(versionId)}/conflicts?${params.toString()}`,
        {
          cache: "no-store",
        }
      );
      const json = await readJsonSafe<ApiErrorResponse & ConflictPageResponse>(res);
      if (!res.ok) {
        throw new Error(getErrorMessage(json, "Failed to fetch timetable conflicts"));
      }
      return json as ConflictPageResponse;
    },
    enabled: Boolean(versionId),
    staleTime: 30_000,
  });
}

export function useTimetableParityReport(args: {
  academicPeriodId?: string;
  versionId?: string;
  maxExamples?: number;
}) {
  const { academicPeriodId, versionId, maxExamples } = args;
  return useQuery<ParityResponse>({
    queryKey: buildTimetableKey(
      "parity",
      academicPeriodId || "all",
      versionId || "auto",
      String(maxExamples || "")
    ),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (academicPeriodId) params.set("academicPeriodId", academicPeriodId);
      if (versionId) params.set("versionId", versionId);
      if (typeof maxExamples === "number" && Number.isFinite(maxExamples)) {
        params.set("maxExamples", String(maxExamples));
      }

      const res = await fetch(`/api/admin/timetable/parity?${params.toString()}`, {
        cache: "no-store",
      });

      const json = await readJsonSafe<ApiErrorResponse & ParityResponse>(res);
      if (!res.ok) {
        throw new Error(getErrorMessage(json, "Failed to load timetable parity report"));
      }

      return json as ParityResponse;
    },
    staleTime: 30_000,
  });
}

export function useCreateTimetableVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      academicPeriodId: string;
      name?: string;
      baseVersionId?: string | null;
    }) => {
      const res = await fetch("/api/admin/timetable/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      const json = await readJsonSafe<ApiErrorResponse & { data: TimetableVersionDTO }>(res);
      if (!res.ok) {
        throw new Error(getErrorMessage(json, "Failed to create timetable draft"));
      }

      return json as { success: boolean; data: TimetableVersionDTO };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: buildTimetableKey("versions") });
      queryClient.invalidateQueries({
        queryKey: buildTimetableKey("versions", variables.academicPeriodId),
      });
    },
  });
}

export function useCloneFromPublished() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (versionId: string) => {
      const res = await fetch(
        `/api/admin/timetable/versions/${encodeURIComponent(versionId)}/clone-from-published`,
        {
          method: "POST",
        }
      );

      const json = await readJsonSafe<
        ApiErrorResponse & {
          data?: {
            targetVersionId: string;
            sourceVersionId: string;
            clonedSlotCount: number;
          };
        }
      >(res);

      if (!res.ok) {
        throw new Error(getErrorMessage(json, "Failed to clone from published timetable"));
      }

      return json;
    },
    onSuccess: (_, versionId) => {
      queryClient.invalidateQueries({ queryKey: buildTimetableKey("slots", versionId) });
      queryClient.invalidateQueries({ queryKey: buildTimetableKey("conflicts", versionId) });
    },
  });
}

export function usePublishTimetableVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (versionId: string) => {
      const res = await fetch(`/api/admin/timetable/versions/${encodeURIComponent(versionId)}/publish`, {
        method: "POST",
      });
      const json = await readJsonSafe<ApiErrorResponse & { data?: unknown }>(res);
      if (!res.ok) {
        throw new Error(getErrorMessage(json, "Failed to publish timetable"));
      }
      return json;
    },
    onSuccess: (_, versionId) => {
      queryClient.invalidateQueries({ queryKey: buildTimetableKey("versions") });
      queryClient.invalidateQueries({ queryKey: buildTimetableKey("slots", versionId) });
      queryClient.invalidateQueries({ queryKey: buildTimetableKey("conflicts", versionId) });
      queryClient.invalidateQueries({ queryKey: buildTimetableKey("master") });
    },
  });
}

export function useRecomputeTimetableConflicts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (versionId: string) => {
      const res = await fetch(
        `/api/admin/timetable/versions/${encodeURIComponent(versionId)}/conflicts/recompute`,
        {
          method: "POST",
        }
      );

      const json = await readJsonSafe<ApiErrorResponse & { data?: unknown }>(res);
      if (!res.ok) {
        throw new Error(getErrorMessage(json, "Failed to recompute conflicts"));
      }
      return json;
    },
    onSuccess: (_, versionId) => {
      queryClient.invalidateQueries({ queryKey: buildTimetableKey("conflicts", versionId) });
    },
  });
}

export type UpsertTimetableSlotInput = {
  classGroupId: string;
  gradeId: string;
  subjectId: string;
  teacherId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  classroomLabel?: string | null;
  source?: TimetableSlotSource;
};

export function useCreateTimetableSlot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      versionId,
      payload,
    }: {
      versionId: string;
      payload: UpsertTimetableSlotInput;
    }) => {
      const res = await fetch(`/api/admin/timetable/versions/${encodeURIComponent(versionId)}/slots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await readJsonSafe<ApiErrorResponse & { data?: TimetableSlotDTO }>(res);
      if (!res.ok) {
        const error = new Error(getErrorMessage(json, "Failed to create timetable slot"));
        (error as Error & { issues?: TimetableValidationIssue[] }).issues = json?.issues;
        throw error;
      }

      return json;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: buildTimetableKey("slots", variables.versionId),
      });
      queryClient.invalidateQueries({
        queryKey: buildTimetableKey("conflicts", variables.versionId),
      });
    },
  });
}

export function useUpdateTimetableSlot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      versionId,
      slotId,
      payload,
    }: {
      versionId: string;
      slotId: string;
      payload: Partial<UpsertTimetableSlotInput>;
    }) => {
      const res = await fetch(
        `/api/admin/timetable/versions/${encodeURIComponent(versionId)}/slots/${encodeURIComponent(slotId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const json = await readJsonSafe<ApiErrorResponse & { data?: TimetableSlotDTO }>(res);
      if (!res.ok) {
        const error = new Error(getErrorMessage(json, "Failed to update timetable slot"));
        (error as Error & { issues?: TimetableValidationIssue[] }).issues = json?.issues;
        throw error;
      }

      return json;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: buildTimetableKey("slots", variables.versionId),
      });
      queryClient.invalidateQueries({
        queryKey: buildTimetableKey("conflicts", variables.versionId),
      });
    },
  });
}

export function useDeleteTimetableSlot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ versionId, slotId }: { versionId: string; slotId: string }) => {
      const res = await fetch(
        `/api/admin/timetable/versions/${encodeURIComponent(versionId)}/slots/${encodeURIComponent(slotId)}`,
        {
          method: "DELETE",
        }
      );

      const json = await readJsonSafe<ApiErrorResponse & { data?: { id: string } }>(res);
      if (!res.ok) {
        throw new Error(getErrorMessage(json, "Failed to delete timetable slot"));
      }
      return json;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: buildTimetableKey("slots", variables.versionId),
      });
      queryClient.invalidateQueries({
        queryKey: buildTimetableKey("conflicts", variables.versionId),
      });
    },
  });
}
