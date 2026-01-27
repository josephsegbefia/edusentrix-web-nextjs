// src/components/admin/students/GradeDistributionCard.tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";

type GradeDistributionItem = {
  gradeId: string;
  gradeName: string;
  count: number;
};

type GradeDistributionCardProps = {
  distribution: GradeDistributionItem[];
  loading?: boolean;
};

// Color palette for grades - premium colors with good contrast
const GRADE_COLORS = [
  "hsl(217, 91%, 60%)", // Blue for JHS 1
  "hsl(262, 83%, 58%)", // Purple for JHS 2
  "hsl(258, 90%, 66%)", // Violet for JHS 3
  "hsl(239, 84%, 67%)", // Indigo for others
  "hsl(280, 100%, 70%)", // Magenta fallback
  "hsl(291, 64%, 42%)", // Pink fallback
];

// Custom label function for pie chart
const renderCustomLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: any) => {
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  // Only show percentage if it's significant (>5%)
  if (percent < 0.05) return null;

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      className="text-[10px] font-semibold"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

// Custom tooltip
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="rounded-lg border border-white/20 bg-slate-900/95 px-3 py-2 shadow-xl backdrop-blur-sm">
        <p className="text-xs font-semibold text-white">{data.name}</p>
        <p className="text-xs text-white/70">
          {data.value} student{data.value === 1 ? "" : "s"} (
          {((data.payload.percent || 0) * 100).toFixed(1)}%)
        </p>
      </div>
    );
  }
  return null;
};

export function GradeDistributionCard({
  distribution,
  loading = false,
}: GradeDistributionCardProps) {
  if (loading) {
    return (
      <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-violet-500/15 via-violet-500/5 to-transparent"
          aria-hidden="true"
        />
        <CardHeader className="relative z-10 pb-3">
          <CardTitle className="text-xs font-semibold text-white/80 uppercase tracking-wider flex items-center gap-2">
            <GraduationCap className="h-3.5 w-3.5" />
            Grade Distribution
          </CardTitle>
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="flex items-center justify-center h-[200px]">
            <div className="h-32 w-32 animate-pulse rounded-full bg-white/10" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!distribution.length) {
    return (
      <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-violet-500/15 via-violet-500/5 to-transparent"
          aria-hidden="true"
        />
        <CardHeader className="relative z-10 pb-3">
          <CardTitle className="text-xs font-semibold text-white/80 uppercase tracking-wider flex items-center gap-2">
            <GraduationCap className="h-3.5 w-3.5" />
            Grade Distribution
          </CardTitle>
        </CardHeader>
        <CardContent className="relative z-10">
          <p className="text-xs text-white/50 text-center py-8">
            No students found yet. Once students are assigned to grades,
            you&apos;ll see their distribution here.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Sort distribution by grade name for consistent ordering
  const sortedDistribution = [...distribution].sort((a, b) =>
    a.gradeName.localeCompare(b.gradeName)
  );

  // Prepare data for pie chart
  const chartData = sortedDistribution.map((item, index) => ({
    name: item.gradeName,
    value: item.count,
    color: GRADE_COLORS[index % GRADE_COLORS.length],
  }));

  const total = distribution.reduce((sum, d) => sum + (d.count || 0), 0);

  return (
    <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
      <div
        className="pointer-events-none absolute inset-0 bg-linear-to-br from-violet-500/15 via-violet-500/5 to-transparent"
        aria-hidden="true"
      />
      <CardHeader className="relative z-10 pb-3">
        <CardTitle className="text-xs font-semibold text-white/80 uppercase tracking-wider flex items-center gap-2">
          <GraduationCap className="h-3.5 w-3.5" />
          Grade Distribution
        </CardTitle>
      </CardHeader>
      <CardContent className="relative z-10">
        <div className="flex flex-col items-center gap-4">
          {/* Pie Chart */}
          <div className="w-full" style={{ height: "200px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderCustomLabel}
                  outerRadius={70}
                  innerRadius={35}
                  fill="#8884d8"
                  dataKey="value"
                  animationBegin={0}
                  animationDuration={800}
                  animationEasing="ease-out"
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color}
                      stroke="rgba(255, 255, 255, 0.1)"
                      strokeWidth={1}
                      style={{
                        filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))",
                      }}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="w-full space-y-2">
            {sortedDistribution.map((item, index) => {
              const color = GRADE_COLORS[index % GRADE_COLORS.length];
              const percentage =
                total > 0 ? ((item.count / total) * 100).toFixed(1) : "0";

              return (
                <div
                  key={item.gradeId}
                  className="flex items-center justify-between gap-3 px-1"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-xs font-medium text-white/90 truncate">
                      {item.gradeName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-white/60">{percentage}%</span>
                    <span className="text-xs font-semibold text-white/70 min-w-[2rem] text-right">
                      {item.count}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
