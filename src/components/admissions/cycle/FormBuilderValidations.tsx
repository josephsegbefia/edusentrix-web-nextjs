"use client";

import * as React from "react";
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Info,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  validateAdmissionForm,
  summariseFormIssues,
  type AdmissionFormIssue,
} from "@/lib/admissions/form-validations";
import type { AdmissionFormSchema } from "@/lib/admissions/types";

type FormBuilderValidationsProps = {
  schema: AdmissionFormSchema;
};

function iconForSeverity(severity: AdmissionFormIssue["severity"]) {
  if (severity === "error") return AlertOctagon;
  if (severity === "warning") return AlertTriangle;
  return Info;
}

function classForSeverity(severity: AdmissionFormIssue["severity"]) {
  if (severity === "error") {
    return "border-rose-500/30 bg-rose-500/10 text-rose-100";
  }
  if (severity === "warning") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-100";
  }
  return "border-cyan-500/30 bg-cyan-500/10 text-cyan-100";
}

export function FormBuilderValidations({ schema }: FormBuilderValidationsProps) {
  const issues = React.useMemo(() => validateAdmissionForm(schema), [schema]);
  const summary = summariseFormIssues(issues);
  const total = summary.errorCount + summary.warningCount + summary.infoCount;
  const [expanded, setExpanded] = React.useState(summary.errorCount > 0);

  React.useEffect(() => {
    if (summary.errorCount > 0) setExpanded(true);
  }, [summary.errorCount]);

  if (total === 0) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-100">
        <ShieldCheck className="h-5 w-5" />
        <div>
          <p className="font-semibold">No form issues</p>
          <p className="text-xs text-emerald-100/80">
            Platform requirements are satisfied and the form looks consistent.
          </p>
        </div>
      </div>
    );
  }

  const tone =
    summary.errorCount > 0
      ? "border-rose-500/30 bg-rose-500/10 text-rose-100"
      : "border-amber-500/30 bg-amber-500/10 text-amber-100";

  return (
    <div className={cn("rounded-2xl border p-4", tone)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/20">
            {summary.errorCount > 0 ? (
              <AlertOctagon className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold">
              {summary.errorCount > 0
                ? "Fix these before publishing"
                : "Form looks usable but could be tighter"}
            </p>
            <p className="mt-0.5 text-xs opacity-80">
              {[
                summary.errorCount > 0
                  ? `${summary.errorCount} error${summary.errorCount === 1 ? "" : "s"}`
                  : null,
                summary.warningCount > 0
                  ? `${summary.warningCount} warning${summary.warningCount === 1 ? "" : "s"}`
                  : null,
                summary.infoCount > 0 ? `${summary.infoCount} note${summary.infoCount === 1 ? "" : "s"}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded((v) => !v)}
          className="h-8 px-2 text-xs"
        >
          {expanded ? (
            <>
              <ChevronUp className="mr-1 h-3 w-3" />
              Hide
            </>
          ) : (
            <>
              <ChevronDown className="mr-1 h-3 w-3" />
              Show
            </>
          )}
        </Button>
      </div>

      {expanded ? (
        <ul className="mt-3 space-y-1.5 rounded-xl border border-white/10 bg-black/15 p-3">
          {issues.map((issue) => {
            const Icon = iconForSeverity(issue.severity);
            return (
              <li
                key={issue.code}
                className={cn(
                  "flex items-start gap-2 rounded-lg border px-3 py-2 text-xs",
                  classForSeverity(issue.severity)
                )}
              >
                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="leading-snug">{issue.message}</span>
              </li>
            );
          })}
          {summary.errorCount === 0 ? (
            <li className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>No blocking issues. Warnings are safe to publish.</span>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
