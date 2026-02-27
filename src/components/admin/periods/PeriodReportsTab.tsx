"use client";

import * as React from "react";
import { format } from "date-fns";
import {
  Download,
  FileText,
  Lightbulb,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePeriodReport } from "@/hooks/admin/usePeriodReport";
import {
  useRecurringReports,
  type RecurringReportType,
} from "@/hooks/admin/useRecurringReports";

export type PeriodReportsTabProps = {
  periodId: string;
  onDownloadPdf: () => Promise<void>;
  onDownloadRecurringPdf: (reportId: string) => Promise<void>;
  onGenerateReport: (force?: boolean) => Promise<void>;
  onGenerateRecurringReport: (payload: {
    startDate: string;
    endDate: string;
    reportType: RecurringReportType;
  }) => Promise<void>;
  downloadingPdf: boolean;
  downloadingReportId: string | null;
  isGeneratingReport: boolean;
  isGeneratingRecurring: boolean;
  periodEndDate?: string;
  periodStartDate?: string;
};

export function PeriodReportsTab({
  periodId,
  onDownloadPdf,
  onDownloadRecurringPdf,
  onGenerateReport,
  onGenerateRecurringReport,
  downloadingPdf,
  downloadingReportId,
  isGeneratingReport,
  isGeneratingRecurring,
  periodEndDate,
  periodStartDate,
}: PeriodReportsTabProps) {
  const reportQuery = usePeriodReport(periodId);
  const recurringReportsQuery = useRecurringReports(periodId);

  const [recurringStartDate, setRecurringStartDate] = React.useState("");
  const [recurringEndDate, setRecurringEndDate] = React.useState("");
  const [recurringType, setRecurringType] = React.useState<RecurringReportType>("weekly");

  React.useEffect(() => {
    if (!periodEndDate) return;
    const end = new Date(periodEndDate);
    if (recurringType === "weekly") {
      const s = new Date(end);
      s.setDate(s.getDate() - 6);
      setRecurringStartDate(s.toISOString().slice(0, 10));
      setRecurringEndDate(end.toISOString().slice(0, 10));
    } else if (recurringType === "biweekly") {
      const s = new Date(end);
      s.setDate(s.getDate() - 13);
      setRecurringStartDate(s.toISOString().slice(0, 10));
      setRecurringEndDate(end.toISOString().slice(0, 10));
    } else {
      const s = new Date(end.getFullYear(), end.getMonth(), 1);
      setRecurringStartDate(s.toISOString().slice(0, 10));
      setRecurringEndDate(end.toISOString().slice(0, 10));
    }
  }, [periodEndDate, recurringType]);

  return (
    <div className="space-y-6">
      {/* AI Term Report */}
      <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 to-black shadow-xl shadow-black/30 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
            <Sparkles className="h-4 w-4 text-amber-400" />
            AI Term Report
          </CardTitle>
          <p className="text-xs text-white/50">
            AI-generated analysis of finances, academics, staffing, and operations
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {reportQuery.isLoading ? (
            <div className="flex items-center gap-2 py-8 text-white/60">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading report...
            </div>
          ) : reportQuery.data ? (
            <div className="space-y-4">
              <p className="text-xs text-white/50">
                Generated {format(new Date(reportQuery.data.generatedAt), "dd MMM yyyy")}
              </p>
              <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm font-medium text-white">
                  {reportQuery.data.content.summary}
                </p>
                {reportQuery.data.content.sections?.map((section, i) => (
                  <div key={i}>
                    <p className="text-xs font-semibold text-cyan-300">
                      {section.title}
                    </p>
                    <p className="mt-1 text-sm text-white/80 whitespace-pre-wrap">
                      {section.content}
                    </p>
                    {section.highlights?.length ? (
                      <ul className="mt-2 list-inside list-disc text-xs text-white/70">
                        {section.highlights.map((h, j) => (
                          <li key={j}>{h}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))}
                {reportQuery.data.content.suggestions?.length ? (
                  <div className="mt-4 border-t border-white/10 pt-4">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                      <Lightbulb className="h-3.5 w-3.5" />
                      Suggestions for improvement
                    </p>
                    <ul className="mt-2 space-y-1 text-xs text-white/70">
                      {reportQuery.data.content.suggestions.map((s, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-white/40">•</span>
                          {s.text}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 border-white/20 text-white/80 hover:bg-white/10"
                  onClick={onDownloadPdf}
                  disabled={downloadingPdf}
                >
                  {downloadingPdf ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-3.5 w-3.5" />
                  )}
                  Download PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 border-white/20 text-white/80 hover:bg-white/10"
                  onClick={() => onGenerateReport(true)}
                  disabled={isGeneratingReport}
                >
                  {isGeneratingReport ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-3.5 w-3.5" />
                  )}
                  Regenerate
                </Button>
              </div>
            </div>
          ) : (
            <Button
              className="w-full gap-2 bg-brand text-black hover:bg-brand/90"
              onClick={() => onGenerateReport()}
              disabled={isGeneratingReport}
            >
              {isGeneratingReport ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Generate AI Report
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Recurring Reports */}
      <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 to-black shadow-xl shadow-black/30 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
            <FileText className="h-4 w-4 text-cyan-400" />
            Weekly, Biweekly, Monthly Reports
          </CardTitle>
          <p className="text-xs text-white/50">
            Generate progress reports for custom date ranges
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-white/70">Start date</Label>
                <Input
                  type="date"
                  value={recurringStartDate}
                  onChange={(e) => setRecurringStartDate(e.target.value)}
                  className="border-white/20 bg-white/5 text-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-white/70">End date</Label>
                <Input
                  type="date"
                  value={recurringEndDate}
                  onChange={(e) => setRecurringEndDate(e.target.value)}
                  className="border-white/20 bg-white/5 text-white"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-white/70">Report type</Label>
              <Select
                value={recurringType}
                onValueChange={(v) => setRecurringType(v as RecurringReportType)}
              >
                <SelectTrigger className="w-full border-white/20 bg-white/5 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="biweekly">Biweekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full gap-2 bg-brand text-black hover:bg-brand/90"
              onClick={() =>
                onGenerateRecurringReport({
                  startDate: recurringStartDate,
                  endDate: recurringEndDate,
                  reportType: recurringType,
                })
              }
              disabled={
                isGeneratingRecurring ||
                !recurringStartDate ||
                !recurringEndDate
              }
            >
              {isGeneratingRecurring ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              Generate {recurringType.charAt(0).toUpperCase() + recurringType.slice(1)}{" "}
              Report
            </Button>
          </div>

          {recurringReportsQuery.data &&
          recurringReportsQuery.data.filter((r) => r.reportType !== "term").length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-white/60">Recent reports</p>
              <ul className="space-y-2">
                {recurringReportsQuery.data
                  .filter((r) => r.reportType !== "term")
                  .map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white">
                          {r.reportType.charAt(0).toUpperCase() + r.reportType.slice(1)}
                          {r.dateRange
                            ? " · " +
                              format(new Date(r.dateRange.startDate), "dd MMM") +
                              " – " +
                              format(new Date(r.dateRange.endDate), "dd MMM yyyy")
                            : ""}
                        </p>
                        {r.summary ? (
                          <p className="mt-0.5 line-clamp-2 text-xs text-white/60">
                            {r.summary}
                          </p>
                        ) : null}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 text-white/80 hover:bg-white/10 hover:text-white"
                        onClick={() => onDownloadRecurringPdf(r.id)}
                        disabled={downloadingReportId === r.id}
                      >
                        {downloadingReportId === r.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </li>
                  ))}
              </ul>
            </div>
          ) : recurringReportsQuery.isLoading ? (
            <div className="flex items-center gap-2 py-4 text-white/60">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading reports...
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
