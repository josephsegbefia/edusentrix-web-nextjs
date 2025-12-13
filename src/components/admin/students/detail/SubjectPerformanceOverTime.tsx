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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { StudentSubjectPerformanceRow } from "@/types/admin/student-academics";

type Props = {
  subjects: StudentSubjectPerformanceRow[];
  subjectHistory?: Record<
    string,
    Array<{
      termId: string;
      termLabel: string;
      totalScore: number | null;
    }>
  >;
  terms: Array<{
    termId: string;
    label: string;
  }>;
};

export function SubjectPerformanceOverTime({
  subjects,
  subjectHistory,
  terms,
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
            <Select
              value={selectedSubjectId ?? ""}
              onValueChange={(value) => setSelectedSubjectId(value)}
            >
              <SelectTrigger className="h-8 min-w-[180px] rounded-full border-white/10 bg-white/5 text-xs text-slate-100 hover:bg-white/10">
                <SelectValue placeholder="Select subject" />
              </SelectTrigger>
              <SelectContent className="text-xs">
                {subjects
                  .filter((s) => subjectHistory[s.subjectId]?.length > 0)
                  .map((s) => (
                    <SelectItem key={s.subjectId} value={s.subjectId}>
                      {s.subjectName}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {academicYears.length > 1 && (
              <Select
                value={selectedYear ?? "all"}
                onValueChange={(value) =>
                  setSelectedYear(value === "all" ? null : value)
                }
              >
                <SelectTrigger className="h-8 w-[140px] rounded-full border-white/10 bg-white/5 text-xs text-slate-100 hover:bg-white/10">
                  <SelectValue placeholder="All Years" />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  <SelectItem value="all">All Years</SelectItem>
                  {academicYears.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  {selectedSubject.shortCode && (
                    <p className="text-[10px] text-muted-foreground">
                      {selectedSubject.shortCode}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Current Score</p>
                  <p className="text-sm font-bold text-white">
                    {selectedSubject.totalScore?.toFixed(1) ?? "--"}%
                  </p>
                </div>
              </div>
            )}
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
                    };
                    return (
                      <div className="rounded-lg border border-white/20 bg-slate-950/95 px-3 py-2 shadow-lg">
                        <p className="text-xs font-medium text-white mb-1">
                          {data.fullLabel}
                        </p>
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
                  dot={{ fill: "#3b82f6", r: 6, strokeWidth: 2, stroke: "#ffffff" }}
                  activeDot={{ r: 8, stroke: "#ffffff", strokeWidth: 2, fill: "#3b82f6" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </>
        )}
      </CardContent>
    </Card>
  );
}
