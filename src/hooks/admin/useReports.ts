import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type ReportFormat,
  type ReportKey,
} from "@/constants/reports";

export type ReportsRange = {
  startDate: string;
  endDate: string;
  days: number;
  source: string;
  period: {
    id: string;
    term: string;
    yearLabel: string;
    label: string;
    startDate: string;
    endDate: string;
  } | null;
};

export type ReportsSummary = {
  range: ReportsRange;
  categories: {
    fees: {
      revenueInRangeMinor: number;
      paymentsCount: number;
      billedInRangeMinor: number;
      invoicesInRange: number;
      outstandingMinor: number;
      overdueCount: number;
      collectionRate: number;
    };
    students: {
      total: number;
      newInRange: number;
      status: {
        active: number;
        inactive: number;
        withdrawn: number;
      };
    };
    teachers: {
      total: number;
      status: {
        active: number;
        inactive: number;
        on_leave: number;
        terminated: number;
      };
      homeroomCount: number;
    };
    attendance: {
      totalRecords: number;
      status: {
        present: number;
        absent: number;
        late: number;
        excused: number;
      };
      coverageRate: number;
      presentRate: number;
    };
    invitations: {
      total: number;
      status: {
        pending: number;
        accepted: number;
        expired: number;
        revoked: number;
        failed: number;
      };
      sentInRange: number;
    };
    academics: {
      records: number;
      averageScore: number;
      passRate: number;
      scope: string;
    };
    activity: {
      totalInRange: number;
      reportsGenerated: number;
    };
  };
};

export type ChartSlice = {
  label: string;
  value: number;
};

export type TrendPoint = {
  label: string;
  value: number;
};

export type AttendanceTrendPoint = {
  label: string;
  presentRate: number;
  present: number;
  absent: number;
  total: number;
};

export type ReportsCharts = {
  range: ReportsRange;
  interval: "day" | "week" | "month";
  charts: {
    fees: {
      revenueTrend: {
        interval: "day" | "week" | "month";
        points: TrendPoint[];
      };
      paymentMethods: ChartSlice[];
      invoiceStatus: ChartSlice[];
    };
    students: {
      enrollmentTrend: {
        interval: "day" | "week" | "month";
        points: TrendPoint[];
      };
      gradeDistribution: Array<ChartSlice & { gradeId?: string | null }>;
      statusDistribution: ChartSlice[];
    };
    teachers: {
      statusDistribution: ChartSlice[];
      departmentDistribution: ChartSlice[];
      assignmentsBySubject: Array<ChartSlice & { subjectId?: string | null }>;
    };
    attendance: {
      attendanceTrend: {
        interval: "day" | "week" | "month";
        points: AttendanceTrendPoint[];
      };
      statusDistribution: ChartSlice[];
    };
    invitations: {
      sentTrend: {
        interval: "day" | "week" | "month";
        points: TrendPoint[];
      };
      statusDistribution: ChartSlice[];
      roleDistribution: ChartSlice[];
    };
    academics: {
      averageBySubject: Array<
        ChartSlice & { passRate: number; subjectId?: string | null; count: number }
      >;
      passRateDistribution: ChartSlice[];
      scope: string;
    };
    activity: {
      volumeTrend: {
        interval: "day" | "week" | "month";
        points: TrendPoint[];
      };
      topTypes: ChartSlice[];
    };
  };
};

export type ReportExportItem = {
  id: string;
  reportKey: ReportKey;
  reportLabel: string;
  format: ReportFormat;
  status: string;
  rangeMode: string;
  range: {
    startDate: string;
    endDate: string;
    periodId: string | null;
    periodLabel: string | null;
    source: string;
  };
  rowCount?: number | null;
  fileName?: string | null;
  createdAt: string;
  completedAt?: string | null;
  downloadedAt?: string | null;
  requestedBy?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  } | null;
};

export type CreateReportExportInput = {
  reportKey: ReportKey;
  format?: ReportFormat;
  periodId?: string;
  startDate?: string;
  endDate?: string;
  filters?: Record<string, unknown>;
  label?: string;
  limit?: number;
};

export type CreateReportExportResponse = {
  success: true;
  data: {
    id: string;
    reportKey: ReportKey;
    reportLabel: string;
    format: ReportFormat;
    status: string;
    rangeMode: string;
    range: {
      startDate: string;
      endDate: string;
      periodId: string | null;
      periodLabel: string | null;
      source: string;
    };
    fileName: string | null;
    downloadUrl: string;
  };
};

type ReportsQueryParams = {
  periodId?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  interval?: "day" | "week" | "month";
  enabled?: boolean;
};

function buildSearchParams(params: ReportsQueryParams) {
  const searchParams = new URLSearchParams();
  if (params.periodId) {
    searchParams.set("periodId", params.periodId);
    return searchParams;
  }

  if (params.startDate) {
    searchParams.set("startDate", params.startDate.toISOString());
  }
  if (params.endDate) {
    searchParams.set("endDate", params.endDate.toISOString());
  }
  if (params.interval) {
    searchParams.set("interval", params.interval);
  }
  return searchParams;
}

export function useReportsSummary(params: ReportsQueryParams) {
  const searchParams = buildSearchParams(params);
  const startKey = params.startDate?.toISOString() ?? null;
  const endKey = params.endDate?.toISOString() ?? null;

  return useQuery<ReportsSummary>({
    queryKey: ["reports", "summary", params.periodId ?? null, startKey, endKey],
    queryFn: async () => {
      const res = await fetch(`/api/admin/reports/summary?${searchParams}`);
      if (!res.ok) throw new Error("Failed to fetch reports summary");
      return res.json();
    },
    enabled: params.enabled ?? true,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    staleTime: 30_000,
  });
}

export function useReportsCharts(params: ReportsQueryParams) {
  const searchParams = buildSearchParams(params);
  const startKey = params.startDate?.toISOString() ?? null;
  const endKey = params.endDate?.toISOString() ?? null;

  return useQuery<ReportsCharts>({
    queryKey: [
      "reports",
      "charts",
      params.periodId ?? null,
      startKey,
      endKey,
      params.interval ?? null,
    ],
    queryFn: async () => {
      const res = await fetch(`/api/admin/reports/charts?${searchParams}`);
      if (!res.ok) throw new Error("Failed to fetch reports charts");
      return res.json();
    },
    enabled: params.enabled ?? true,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    staleTime: 30_000,
  });
}

export function useReportExports(params?: {
  limit?: number;
  status?: string;
  reportKey?: ReportKey;
}) {
  return useQuery<{ success: true; data: ReportExportItem[] }>({
    queryKey: ["reports", "exports", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.limit) searchParams.set("limit", String(params.limit));
      if (params?.status) searchParams.set("status", params.status);
      if (params?.reportKey) searchParams.set("reportKey", params.reportKey);

      const res = await fetch(`/api/admin/reports/exports?${searchParams}`);
      if (!res.ok) throw new Error("Failed to fetch report exports");
      return res.json();
    },
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    staleTime: 30_000,
  });
}

export function useCreateReportExport() {
  const queryClient = useQueryClient();

  return useMutation<CreateReportExportResponse, Error, CreateReportExportInput>(
    {
      mutationFn: async (payload) => {
        const res = await fetch("/api/admin/reports/exports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => null);
          throw new Error(json?.error || "Failed to create report export");
        }
        return res.json();
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["reports", "exports"] });
      },
    }
  );
}
