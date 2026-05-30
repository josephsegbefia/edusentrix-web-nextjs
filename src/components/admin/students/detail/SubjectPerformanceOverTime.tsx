// src/components/admin/students/detail/SubjectPerformanceOverTime.tsx
"use client";

import * as React from "react";
import {
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen } from "lucide-react";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import type {
  StrengthOverviewRow,
  SubjectTrendChartPoint,
} from "@/lib/academics/profile/academic-trends-view-utils";
import { trendDotColor } from "@/lib/academics/profile/academic-trends-view-utils";
import type { AcademicTermHistorySource } from "@/types/academics/student-academic-profile";

type Props = {
  subjects: StrengthOverviewRow[];
  subjectHistory?: Record<string, SubjectTrendChartPoint[]>;
  terms: Array<{
    termId: string;
    label: string;
  }>;
  showSourceLegend?: boolean;
};

export function SubjectPerformanceOverTime({
  subjects,
  subjectHistory,
  terms,
  showSourceLegend = false,
}: Props) {
  const [selectedSubjectId, setSelectedSubjectId] = React.useState<
    string | null
  >(null);
  const [selectedYear, setSelectedYear] = React.useState<string | null>(null);

  // Set default subject to first subject with history
  React.useEffect(() => {
    if (!selectedSubjectId && subjects.length > 0 && subjectHistory) {
      const firstSubjectWithHistory = subjects.find(
        (s) => subjectHistory[s.subjectId]?.length > 0
      );
      if (firstSubjectWithHistory) {
        setSelectedSubjectId(firstSubjectWithHistory.subjectId);
      } else if (subjects.length > 0) {
        setSelectedSubjectId(subjects[0].subjectId);
      }
    }
  }, [selectedSubjectId, subjects, subjectHistory]);

  // Extract unique academic years from term labels
  const academicYears = React.useMemo(() => {
    const years = new Set<string>();
    terms.forEach((t) => {
      const yearMatch = t.label.match(/(\d{4})/);
      if (yearMatch) {
        years.add(yearMatch[1]);
      }
    });
    return Array.from(years).sort().reverse();
  }, [terms]);

  // Get history for selected subject
  const selectedHistory = React.useMemo(() => {
    if (!selectedSubjectId || !subjectHistory) return [];
    return subjectHistory[selectedSubjectId] || [];
  }, [selectedSubjectId, subjectHistory]);

  // Filter history by selected year
  const filteredHistory = React.useMemo(() => {
    if (!selectedYear) return selectedHistory;
    return selectedHistory.filter((h) => h.termLabel.includes(selectedYear));
  }, [selectedHistory, selectedYear]);

  const chartData = React.useMemo(() => {
    return filteredHistory
      .filter((h) => h.totalScore !== null)
      .map((h) => {
        // Extract year and term from label (e.g., "2024 • Term 1")
        const yearMatch = h.termLabel.match(/(\d{4})/);
        const termMatch = h.termLabel.match(/Term \d+/);
        const year = yearMatch ? yearMatch[1] : "";
        const term = termMatch ? termMatch[0] : h.termLabel;

        // Create display label with year and term to avoid duplicates
        const displayLabel = year && term ? `${year} ${term}` : h.termLabel;

        return {
          term: displayLabel,
          fullLabel: h.termLabel,
          score: h.totalScore ?? 0,
          source: h.source,
          sourceLabel: h.sourceLabel,
        };
      })
      .sort((a, b) => {
        // Sort by year first, then by term number
        const aYearMatch = a.term.match(/(\d{4})/);
        const bYearMatch = b.term.match(/(\d{4})/);
        const aYear = aYearMatch ? parseInt(aYearMatch[1]) : 0;
        const bYear = bYearMatch ? parseInt(bYearMatch[1]) : 0;

        if (aYear !== bYear) {
          return aYear - bYear;
        }

        // If same year, sort by term number
        const aTerm = a.term.match(/Term (\d+)/)?.[1];
        const bTerm = b.term.match(/Term (\d+)/)?.[1];
        if (aTerm && bTerm) {
          return parseInt(aTerm) - parseInt(bTerm);
        }
        return a.term.localeCompare(b.term);
      });
  }, [filteredHistory]);

  const selectedSubject = subjects.find((s) => s.subjectId === selectedSubjectId);

  if (!subjectHistory || Object.keys(subjectHistory).length === 0) {
    return (
      <Card className="border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 border border-primary/30">
              <BookOpen className="h-4 w-4 text-primary-200" />
            </div>
            <CardTitle className="text-sm font-semibold text-white/80">
              Subject Performance Over Time
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-dashed border-white/15 bg-black/30 px-4 py-8 text-center">
            <p className="text-[11px] text-muted-foreground/90">
              No historical data available
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 border border-primary/30">
              <BookOpen className="h-4 w-4 text-primary-200" />
            </div>
            <CardTitle className="text-sm font-semibold text-white/80">
              Subject Performance Over Time
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <PremiumSelect
              value={selectedSubjectId ?? ""}
              onValueChange={(value) => setSelectedSubjectId(value)}
            >
              <PremiumSelectTrigger className="h-8 min-w-45 rounded-full text-xs">
                <PremiumSelectValue placeholder="Select subject" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {subjects
                  .filter((s) => subjectHistory[s.subjectId]?.length > 0)
                  .map((s) => (
                    <PremiumSelectItem key={s.subjectId} value={s.subjectId}>
                      {s.subjectName}
                    </PremiumSelectItem>
                  ))}
              </PremiumSelectContent>
            </PremiumSelect>
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
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/15 bg-black/30 px-4 py-8 text-center">
            <p className="text-[11px] text-muted-foreground/90">
              {selectedSubject
                ? `No data available for ${selectedSubject.subjectName}`
                : "Select a subject to view performance over time"}
            </p>
          </div>
        ) : (
          <>
            {selectedSubject && (
              <div className="mb-4 flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <div>
                  <p className="text-xs font-medium text-white">
                    {selectedSubject.subjectName}
                  </p>
                  {selectedSubject.shortCode ? (
                    <p className="text-[10px] text-muted-foreground">
                      {selectedSubject.shortCode}
                    </p>
                  ) : null}
                  {selectedSubject.sourceLabel ? (
                    <p className="text-[10px] text-white/45">{selectedSubject.sourceLabel}</p>
                  ) : null}
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Current score</p>
                  <p className="text-sm font-bold text-white">
                    {selectedSubject.score.toFixed(1)}%
                  </p>
                  {selectedSubject.gradeLabel ? (
                    <p className="text-[10px] text-white/45">Grade {selectedSubject.gradeLabel}</p>
                  ) : null}
                </div>
              </div>
            )}
            {showSourceLegend ? (
              <div className="mb-3 flex flex-wrap gap-2 text-[10px] text-white/55">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  Official
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  Projected
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-slate-400" />
                  Legacy
                </span>
              </div>
            ) : null}
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.1)"
                />
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
                    if (!active || !payload?.[0]) return null;
                    const data = payload[0].payload as {
                      fullLabel: string;
                      score: number;
                      sourceLabel?: string;
                    };
                    return (
                      <div className="rounded-lg border border-white/20 bg-slate-950/95 px-3 py-2 shadow-lg">
                        <p className="text-xs font-medium text-white mb-1">
                          {data.fullLabel}
                        </p>
                        {data.sourceLabel ? (
                          <p className="mb-1 text-[10px] uppercase tracking-wide text-white/45">
                            {data.sourceLabel}
                          </p>
                        ) : null}
                        <p className="text-xs text-primary-200">
                          Score: {data.score.toFixed(1)}%
                        </p>
                      </div>
                    );
                  }}
                />
                <ReferenceLine
                  y={50}
                  stroke="rgba(255,255,255,0.3)"
                  strokeDasharray="2 2"
                  label={{ value: "Pass (50%)", position: "insideTopRight" }}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  dot={(props) => {
                    const { cx, cy, payload } = props;
                    if (cx == null || cy == null) return null;
                    const source =
                      (payload as { source?: AcademicTermHistorySource } | undefined)
                        ?.source ?? "legacy_fallback";
                    return (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={6}
                        fill={trendDotColor(source)}
                        stroke="#ffffff"
                        strokeWidth={2}
                      />
                    );
                  }}
                  activeDot={{ r: 8, stroke: "#ffffff", strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </>
        )}
      </CardContent>
    </Card>
  );
}
