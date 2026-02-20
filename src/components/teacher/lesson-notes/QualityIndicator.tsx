"use client";

import * as React from "react";
import { CheckCircle, AlertCircle, Circle, ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  type QualityScore,
  type QualityCheckItem,
  type WizardStep,
  QUALITY_LEVEL_CONFIG,
  CATEGORY_CONFIG,
  getStepForCheck,
} from "@/lib/lesson-notes/quality-score";

// ============================================================================
// Quality Badge
// ============================================================================

interface QualityBadgeProps {
  score: QualityScore;
  showScore?: boolean;
  size?: "sm" | "md" | "lg";
}

export function QualityBadge({ score, showScore = true, size = "md" }: QualityBadgeProps) {
  const config = QUALITY_LEVEL_CONFIG[score.level];

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-3 py-1",
    lg: "text-base px-4 py-1.5",
  };

  return (
    <Badge className={cn(config.bgColor, config.color, sizeClasses[size], "font-medium")}>
      <span className="mr-1">{config.emoji}</span>
      {showScore && <span className="mr-1">{score.score}%</span>}
      <span>{config.label}</span>
    </Badge>
  );
}

// ============================================================================
// Quality Progress Ring
// ============================================================================

interface QualityRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function QualityRing({
  score,
  size = 48,
  strokeWidth = 4,
  className,
}: QualityRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (score / 100) * circumference;

  const getColor = () => {
    if (score >= 90) return "stroke-emerald-400";
    if (score >= 75) return "stroke-green-400";
    if (score >= 60) return "stroke-amber-400";
    if (score >= 40) return "stroke-orange-400";
    return "stroke-rose-400";
  };

  return (
    <div className={cn("relative inline-flex", className)}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-white/10"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn("transition-all duration-500", getColor())}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold text-white">{score}</span>
      </div>
    </div>
  );
}

// ============================================================================
// Quality Checklist
// ============================================================================

interface QualityChecklistProps {
  checks: QualityCheckItem[];
  showAll?: boolean;
  groupByCategory?: boolean;
  onNavigate?: (step: WizardStep, section?: string) => void;
}

export function QualityChecklist({
  checks,
  showAll = false,
  groupByCategory = true,
  onNavigate,
}: QualityChecklistProps) {
  const [expanded, setExpanded] = React.useState(false);

  // Filter checks to show
  const visibleChecks = showAll || expanded ? checks : checks.filter((c) => !c.passed);

  // Group by category if needed
  const grouped = groupByCategory
    ? {
        required: visibleChecks.filter((c) => c.category === "required"),
        recommended: visibleChecks.filter((c) => c.category === "recommended"),
        optional: visibleChecks.filter((c) => c.category === "optional"),
      }
    : null;

  const handleCheckClick = (check: QualityCheckItem) => {
    if (check.passed || !onNavigate) return;
    const mapping = getStepForCheck(check.id);
    if (mapping) {
      onNavigate(mapping.step, mapping.section);
    }
  };

  const renderCheck = (check: QualityCheckItem) => {
    const isClickable = !check.passed && onNavigate && getStepForCheck(check.id);
    
    return (
      <div
        key={check.id}
        onClick={() => handleCheckClick(check)}
        className={cn(
          "flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors",
          check.passed ? "text-white/60" : "text-white/80",
          isClickable && "cursor-pointer hover:bg-white/5"
        )}
        role={isClickable ? "button" : undefined}
        tabIndex={isClickable ? 0 : undefined}
        onKeyDown={(e) => {
          if (isClickable && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            handleCheckClick(check);
          }
        }}
      >
        {check.passed ? (
          <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
        ) : (
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400" />
        )}
        <div className="flex-1">
          <span className={cn(
            check.passed ? "line-through opacity-60" : "",
            isClickable && "underline decoration-dotted underline-offset-2"
          )}>
            {check.label}
          </span>
          {!check.passed && check.message && (
            <p className="mt-0.5 text-xs text-white/40">{check.message}</p>
          )}
        </div>
        {isClickable && (
          <ChevronRight className="h-3 w-3 text-white/30 flex-shrink-0 mt-0.5" />
        )}
      </div>
    );
  };

  const renderGroup = (
    title: string,
    items: QualityCheckItem[],
    config: (typeof CATEGORY_CONFIG)[keyof typeof CATEGORY_CONFIG]
  ) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2 px-2 py-1">
          <Badge className={cn(config.bgColor, config.color, "text-xs")}>
            {config.label}
          </Badge>
          <span className="text-xs text-white/40">
            {items.filter((c) => c.passed).length}/{items.length}
          </span>
        </div>
        {items.map(renderCheck)}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {grouped ? (
        <>
          {renderGroup("Required", grouped.required, CATEGORY_CONFIG.required)}
          {renderGroup("Recommended", grouped.recommended, CATEGORY_CONFIG.recommended)}
          {renderGroup("Optional", grouped.optional, CATEGORY_CONFIG.optional)}
        </>
      ) : (
        visibleChecks.map(renderCheck)
      )}

      {!showAll && checks.length > visibleChecks.length && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="text-white/50 hover:bg-white/10 hover:text-white/70"
        >
          {expanded ? (
            <>
              <ChevronDown className="mr-1 h-3 w-3" />
              Show less
            </>
          ) : (
            <>
              <ChevronRight className="mr-1 h-3 w-3" />
              Show all ({checks.length} checks)
            </>
          )}
        </Button>
      )}
    </div>
  );
}

// ============================================================================
// Quality Summary Card
// ============================================================================

interface QualitySummaryProps {
  score: QualityScore;
  onViewDetails?: () => void;
  onNavigate?: (step: WizardStep, section?: string) => void;
}

export function QualitySummary({ score, onViewDetails, onNavigate }: QualitySummaryProps) {
  const config = QUALITY_LEVEL_CONFIG[score.level];
  const failedRequired = score.checks.filter(
    (c) => c.category === "required" && !c.passed
  );

  const handleCheckClick = (check: QualityCheckItem) => {
    if (!onNavigate) return;
    const mapping = getStepForCheck(check.id);
    if (mapping) {
      onNavigate(mapping.step, mapping.section);
    }
  };

  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        score.level === "excellent" || score.level === "good"
          ? "border-emerald-500/30 bg-emerald-500/10"
          : score.level === "fair"
          ? "border-amber-500/30 bg-amber-500/10"
          : "border-rose-500/30 bg-rose-500/10"
      )}
    >
      <div className="flex items-center gap-4">
        <QualityRing score={score.score} size={56} strokeWidth={5} />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-white">{config.label}</span>
            <span className="text-sm text-white/50">Quality</span>
          </div>
          <p className="text-sm text-white/60">
            {score.summary.passed} of {score.summary.total} checks passed
          </p>
        </div>
        <QualityBadge score={score} showScore={false} />
      </div>

      {failedRequired.length > 0 && (
        <div className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/5 p-3">
          <p className="mb-2 flex items-center gap-2 text-sm font-medium text-rose-300">
            <AlertCircle className="h-4 w-4" />
            Missing required items ({failedRequired.length})
          </p>
          <ul className="space-y-1">
            {failedRequired.slice(0, 3).map((check) => {
              const isClickable = onNavigate && getStepForCheck(check.id);
              return (
                <li
                  key={check.id}
                  onClick={() => handleCheckClick(check)}
                  className={cn(
                    "flex items-center gap-2 text-sm text-rose-200/70",
                    isClickable && "cursor-pointer hover:text-rose-200 transition-colors"
                  )}
                  role={isClickable ? "button" : undefined}
                >
                  <Circle className="h-1.5 w-1.5 fill-current flex-shrink-0" />
                  <span className={isClickable ? "underline decoration-dotted underline-offset-2" : ""}>
                    {check.label}
                  </span>
                  {isClickable && <ChevronRight className="h-3 w-3 ml-auto flex-shrink-0" />}
                </li>
              );
            })}
            {failedRequired.length > 3 && (
              <li className="text-sm text-rose-200/50">
                +{failedRequired.length - 3} more
              </li>
            )}
          </ul>
        </div>
      )}

      {score.level === "excellent" && (
        <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
          <p className="flex items-center gap-2 text-sm text-emerald-200">
            <CheckCircle className="h-4 w-4" />
            Great job! Your lesson note is comprehensive and ready to publish.
          </p>
        </div>
      )}

      {onViewDetails && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onViewDetails}
          className="mt-3 w-full text-white/50 hover:bg-white/10 hover:text-white/70"
        >
          View all quality checks
        </Button>
      )}
    </div>
  );
}

// ============================================================================
// Mini Quality Indicator (for wizard header)
// ============================================================================

interface MiniQualityIndicatorProps {
  score: QualityScore;
  className?: string;
}

export function MiniQualityIndicator({ score, className }: MiniQualityIndicatorProps) {
  const config = QUALITY_LEVEL_CONFIG[score.level];

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full px-3 py-1.5",
        config.bgColor,
        className
      )}
    >
      <QualityRing score={score.score} size={24} strokeWidth={2} />
      <span className={cn("text-xs font-medium", config.color)}>
        {score.score}% Complete
      </span>
    </div>
  );
}
