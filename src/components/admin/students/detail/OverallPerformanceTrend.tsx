// src/components/admin/students/detail/OverallPerformanceTrend.tsx
"use client";

import * as React from "react";
import {
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";

type Props = {
  history: Array<{
    termId: string;
    label: string;
    averageScore: number | null;
    classAverage: number | null;
  }>;
};

export function OverallPerformanceTrend({ history }: Props) {
  const [selectedYear, setSelectedYear] = React.useState<string | null>(null);

  // Extract unique academic years from labels
  const academicYears = React.useMemo(() => {
    const years = new Set<string>();
    history.forEach((h) => {
      const yearMatch = h.label.match(/(\d{4})/);
      if (yearMatch) {
        years.add(yearMatch[1]);
      }
    });
    return Array.from(years).sort().reverse();
  }, [history]);

  // Filter data by selected year
  const filteredData = React.useMemo(() => {
    if (!selectedYear) return history;
    return history.filter((h) => h.label.includes(selectedYear));
  }, [history, selectedYear]);

  const chartData = React.useMemo(() => {
    return filteredData
      .filter((h) => h.averageScore !== null)
      .map((h) => {
        // Extract term and year from label (e.g., "2024 • Term 1")
        const yearMatch = h.label.match(/(\d{4})/);
        const termMatch = h.label.match(/Term \d+/);
        const year = yearMatch ? yearMatch[1] : "";
        const term = termMatch ? termMatch[0] : h.label;

        // Create display label with year and term
        const displayLabel = year && term ? `${year} ${term}` : h.label;

        return {
          term: displayLabel,
          fullLabel: h.label,
          year: year,
          student: h.averageScore ?? 0,
          class: h.classAverage ?? null,
        };
      });
  }, [filteredData]);

  if (chartData.length === 0) {
    return (
      <Card className="border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 border border-primary/30">
              <TrendingUp className="h-4 w-4 text-primary-200" />
            </div>
            <CardTitle className="text-sm font-semibold text-white/80">
              Overall Performance Trend
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-dashed border-white/15 bg-black/30 px-4 py-8 text-center">
            <p className="text-[11px] text-muted-foreground/90">
              No trend data available
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 border border-primary/30">
              <TrendingUp className="h-4 w-4 text-primary-200" />
            </div>
            <CardTitle className="text-sm font-semibold text-white/80">
              Overall Performance Trend
            </CardTitle>
          </div>
          {academicYears.length > 1 && (
            <PremiumSelect
              value={selectedYear ?? "all"}
              onValueChange={(value) =>
                setSelectedYear(value === "all" ? null : value)
              }
            >
              <PremiumSelectTrigger className="h-8 w-36 rounded-full text-xs">
                <PremiumSelectValue placeholder="All Years" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                <PremiumSelectItem value="all">All Years</PremiumSelectItem>
                {academicYears.map((year) => (
                  <PremiumSelectItem key={year} value={year}>
                    {year}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis
              dataKey="term"
              tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 10 }}
              angle={-25}
              textAnchor="end"
              height={70}
              interval={0}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 11 }}
              label={{
                value: "Score (%)",
                angle: -90,
                position: "insideLeft",
                style: { fill: "rgba(255,255,255,0.7)", fontSize: 11 },
              }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const data = payload[0].payload as {
                  fullLabel: string;
                  student: number;
                  class: number | null;
                };
                return (
                  <div className="rounded-lg border border-white/20 bg-slate-950/95 px-3 py-2 shadow-lg">
                    <p className="text-xs font-medium text-white mb-2">
                      {data.fullLabel}
                    </p>
                    {payload.map((entry, idx) => {
                      const isStudent = entry.dataKey === "student";
                      return (
                        <p
                          key={idx}
                          className="text-xs font-medium mb-1"
                          style={{ color: entry.color }}
                        >
                          {isStudent
                            ? `Student Performance: ${entry.value?.toFixed(1)}%`
                            : `Class Average: ${entry.value?.toFixed(1)}%`}
                        </p>
                      );
                    })}
                  </div>
                );
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: "11px", color: "rgba(255,255,255,0.7)" }}
              iconType="line"
            />
            <Line
              type="monotone"
              dataKey="student"
              stroke="#3b82f6"
              strokeWidth={3}
              dot={{ fill: "#3b82f6", r: 6, strokeWidth: 2, stroke: "#ffffff" }}
              name="Student Performance"
              activeDot={{ r: 8, stroke: "#ffffff", strokeWidth: 2, fill: "#3b82f6" }}
            />
            {chartData.some((d) => d.class !== null) && (
              <Line
                type="monotone"
                dataKey="class"
                stroke="#94a3b8"
                strokeWidth={2.5}
                strokeDasharray="6 4"
                dot={{ fill: "#94a3b8", r: 5, strokeWidth: 2, stroke: "#ffffff" }}
                name="Class Average"
                activeDot={{ r: 7, stroke: "#ffffff", strokeWidth: 2, fill: "#94a3b8" }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
