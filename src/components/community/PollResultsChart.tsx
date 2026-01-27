// src/components/community/PollResultsChart.tsx
"use client";

import * as React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
  Tooltip,
} from "recharts";
import { PollQuestionResultDTO } from "@/hooks/admin/useCommunityPolls";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface PollResultsChartProps {
  question: PollQuestionResultDTO;
  className?: string;
  showPercentages?: boolean;
  colorScheme?: "violet" | "emerald" | "blue" | "amber";
}

// ============================================================================
// Constants
// ============================================================================

const COLOR_SCHEMES = {
  violet: ["#8b5cf6", "#a78bfa", "#c4b5fd", "#ddd6fe", "#ede9fe"],
  emerald: ["#10b981", "#34d399", "#6ee7b7", "#a7f3d0", "#d1fae5"],
  blue: ["#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe", "#dbeafe"],
  amber: ["#f59e0b", "#fbbf24", "#fcd34d", "#fde68a", "#fef3c7"],
};

// ============================================================================
// Bar Chart Component
// ============================================================================

function OptionsBarChart({
  options,
  colorScheme,
  showPercentages,
}: {
  options: Array<{ optionId: string; label: string; count: number; percentage: number }>;
  colorScheme: keyof typeof COLOR_SCHEMES;
  showPercentages: boolean;
}) {
  const colors = COLOR_SCHEMES[colorScheme];
  const data = options.map((opt, i) => ({
    name: opt.label,
    value: showPercentages ? opt.percentage : opt.count,
    count: opt.count,
    percentage: opt.percentage,
  }));

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 10 }}>
          <XAxis
            type="number"
            domain={showPercentages ? [0, 100] : [0, "auto"]}
            tickFormatter={(v) => (showPercentages ? `${v}%` : String(v))}
            tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={100}
            tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 12 }}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
          />
          <Tooltip
            contentStyle={{
              background: "rgba(15, 15, 20, 0.95)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
            }}
            labelStyle={{ color: "#fff", fontWeight: 500 }}
            formatter={(_, __, props) => [
              `${props.payload.count} votes (${props.payload.percentage.toFixed(1)}%)`,
              "",
            ]}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============================================================================
// Yes/No Chart Component
// ============================================================================

function YesNoChart({
  yes,
  no,
  yesPercentage,
  noPercentage,
  colorScheme,
}: {
  yes: number;
  no: number;
  yesPercentage: number;
  noPercentage: number;
  colorScheme: keyof typeof COLOR_SCHEMES;
}) {
  const colors = COLOR_SCHEMES[colorScheme];

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/70">Yes</span>
          <span className="font-medium text-white">
            {yes} votes ({yesPercentage.toFixed(1)}%)
          </span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${yesPercentage}%`, backgroundColor: colors[0] }}
          />
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/70">No</span>
          <span className="font-medium text-white">
            {no} votes ({noPercentage.toFixed(1)}%)
          </span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${noPercentage}%`, backgroundColor: colors[2] }}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Likert Chart Component
// ============================================================================

function LikertChart({
  distribution,
  average,
  colorScheme,
}: {
  distribution: Record<number, number>;
  average: number | null;
  colorScheme: keyof typeof COLOR_SCHEMES;
}) {
  const colors = COLOR_SCHEMES[colorScheme];
  const labels = ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"];
  const total = Object.values(distribution).reduce((sum, v) => sum + v, 0);

  return (
    <div className="space-y-4">
      {average !== null && (
        <div className="mb-4 text-center">
          <div className="text-3xl font-bold text-white">{average.toFixed(2)}</div>
          <div className="text-sm text-white/50">Average Score</div>
        </div>
      )}
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((score, i) => {
          const count = distribution[score] || 0;
          const percentage = total > 0 ? (count / total) * 100 : 0;
          return (
            <div key={score} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/60">{labels[i]}</span>
                <span className="text-white/80">{count}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${percentage}%`, backgroundColor: colors[i] }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function PollResultsChart({
  question,
  className,
  showPercentages = true,
  colorScheme = "violet",
}: PollResultsChartProps) {
  const { type } = question;

  return (
    <div className={cn("rounded-xl border border-white/10 bg-white/5 p-5", className)}>
      <h4 className="mb-4 font-medium text-white">{question.prompt}</h4>
      <div className="mb-2 text-sm text-white/50">
        {question.totalResponses} response{question.totalResponses !== 1 ? "s" : ""}
      </div>

      {/* Single/Multi/Ranked Choice */}
      {(type === "single_choice" || type === "multi_choice" || type === "ranked_choice") &&
        question.options && (
          <OptionsBarChart
            options={question.options}
            colorScheme={colorScheme}
            showPercentages={showPercentages}
          />
        )}

      {/* Yes/No */}
      {type === "yes_no" &&
        question.yes !== undefined &&
        question.no !== undefined &&
        question.yesPercentage !== undefined &&
        question.noPercentage !== undefined && (
          <YesNoChart
            yes={question.yes}
            no={question.no}
            yesPercentage={question.yesPercentage}
            noPercentage={question.noPercentage}
            colorScheme={colorScheme}
          />
        )}

      {/* Likert Scale */}
      {type === "likert" && question.distribution && (
        <LikertChart
          distribution={question.distribution}
          average={question.average ?? null}
          colorScheme={colorScheme}
        />
      )}

      {/* Comment/Open Text */}
      {type === "comment" && question.responses && (
        <div className="max-h-48 space-y-2 overflow-y-auto">
          {question.responses.length === 0 ? (
            <p className="text-sm text-white/40 italic">No responses</p>
          ) : (
            question.responses.slice(0, 10).map((response, i) => (
              <div
                key={i}
                className="rounded-lg border border-white/5 bg-white/5 p-3 text-sm text-white/70"
              >
                &ldquo;{response}&rdquo;
              </div>
            ))
          )}
          {question.responses.length > 10 && (
            <p className="text-xs text-white/40">
              + {question.responses.length - 10} more responses
            </p>
          )}
        </div>
      )}
    </div>
  );
}
