// src/components/admin/students/detail/SubjectSparkline.tsx
"use client";

import * as React from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip } from "recharts";
import { cn } from "@/lib/utils";

type Props = {
  history: Array<{
    termId: string;
    termLabel: string;
    totalScore: number | null;
  }>;
  className?: string;
};

export function SubjectSparkline({ history, className }: Props) {
  const data = React.useMemo(() => {
    return history
      .filter((h) => h.totalScore !== null)
      .map((h) => ({
        score: h.totalScore ?? 0,
      }));
  }, [history]);

  if (data.length < 2) {
    return (
      <div className={cn("flex items-center justify-center h-8", className)}>
        <span className="text-[10px] text-muted-foreground">--</span>
      </div>
    );
  }

  const avgScore = data.reduce((sum, d) => sum + d.score, 0) / data.length;
  const trend = data[data.length - 1].score - data[0].score;
  const color =
    trend > 0
      ? "hsl(var(--primary))"
      : trend < 0
      ? "hsl(var(--destructive))"
      : "rgba(255,255,255,0.5)";

  return (
    <div className={cn("h-8 w-16", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="score"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              return (
                <div className="rounded border border-white/20 bg-slate-950 px-2 py-1 text-[10px]">
                  {payload[0].value?.toFixed(1)}%
                </div>
              );
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
