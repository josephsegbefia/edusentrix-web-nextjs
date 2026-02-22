"use client";

import * as React from "react";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Info,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type ImportResult = {
  success: boolean;
  created: number;
  failed: number;
  errors: { row: number; message: string }[];
  error?: string;
};

type StudentsImportModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const CSV_TEMPLATE = `First Name,Middle Name,Last Name,Grade,Class,Admission No,Sex,Date of Birth,Status,Enrolled At
John,,Doe,Grade 1,Class A,ADM001,male,2015-03-15,active,2024-09-01
Jane,Mary,Smith,Grade 2,Class B,ADM002,female,2014-07-22,active,2024-09-01
Kwame,,Asante,Grade 1,Class A,,male,,active,`;

const REQUIRED_COLUMNS = [
  { name: "First Name", desc: "Student's first name", required: true },
  { name: "Middle Name", desc: "Student's middle name", required: false },
  { name: "Last Name", desc: "Student's last/surname", required: true },
  {
    name: "Grade",
    desc: "Must match an existing grade name in your school",
    required: true,
  },
  {
    name: "Class",
    desc: "Must match an existing class under the specified grade",
    required: true,
  },
  { name: "Admission No", desc: "Unique admission/ID number", required: false },
  {
    name: "Sex",
    desc: 'Use "male", "female", "m", or "f"',
    required: false,
  },
  {
    name: "Date of Birth",
    desc: "Format: YYYY-MM-DD (e.g. 2015-03-15)",
    required: false,
  },
  {
    name: "Status",
    desc: '"active", "inactive", or "withdrawn". Defaults to "active"',
    required: false,
  },
  {
    name: "Enrolled At",
    desc: "Enrollment date (YYYY-MM-DD). Defaults to today",
    required: false,
  },
];

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "students-import-template.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function uploadCsv(file: File): Promise<ImportResult> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/admin/students/import", {
    method: "POST",
    body: formData,
  });

  const json = await res.json();

  if (!res.ok && !json.errors) {
    throw new Error(json.error || "Import failed");
  }

  return json;
}

type Step = "upload" | "importing" | "result";

export function StudentsImportModal({
  open,
  onOpenChange,
}: StudentsImportModalProps) {
  const [step, setStep] = React.useState<Step>("upload");
  const [file, setFile] = React.useState<File | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const [result, setResult] = React.useState<ImportResult | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: uploadCsv,
    onMutate: () => setStep("importing"),
    onSuccess: (data) => {
      setResult(data);
      setStep("result");
      if (data.created > 0) {
        queryClient.invalidateQueries({ queryKey: ["students"] });
        queryClient.invalidateQueries({ queryKey: ["student-stats"] });
        toast.success(`Successfully imported ${data.created} student(s)`);
      }
    },
    onError: (err: Error) => {
      setResult({
        success: false,
        created: 0,
        failed: 0,
        errors: [],
        error: err.message,
      });
      setStep("result");
    },
  });

  const resetState = React.useCallback(() => {
    setStep("upload");
    setFile(null);
    setResult(null);
    setDragOver(false);
  }, []);

  React.useEffect(() => {
    if (!open) resetState();
  }, [open, resetState]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith(".csv") || f.type === "text/csv")) {
      setFile(f);
    } else {
      toast.error("Please upload a CSV file");
    }
  };

  const handleImport = () => {
    if (!file) return;
    importMutation.mutate(file);
  };

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title="Import Students"
      description="Bulk import students from a CSV file"
      className="sm:max-w-2xl"
    >
      {step === "upload" && (
        <div className="space-y-6">
          {/* Template download section */}
          <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-teal-500/30 bg-teal-500/10">
                <Info className="h-4 w-4 text-teal-300" />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-sm font-medium text-teal-200">
                  Download the CSV template
                </p>
                <p className="text-xs leading-relaxed text-white/50">
                  Use our template to ensure your data is formatted correctly.
                  Grade and Class names must match your existing school
                  configuration exactly.
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={downloadTemplate}
                  className="gap-2 border-teal-500/30 bg-teal-500/10 text-teal-300 hover:bg-teal-500/20"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download Template
                </Button>
              </div>
            </div>
          </div>

          {/* Column reference */}
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-white/40">
              Column Reference
            </p>
            <div className="max-h-40 overflow-y-auto rounded-xl border border-white/10 bg-black/20">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-left">
                    <th className="px-3 py-2 font-medium text-white/60">
                      Column
                    </th>
                    <th className="px-3 py-2 font-medium text-white/60">
                      Required
                    </th>
                    <th className="hidden px-3 py-2 font-medium text-white/60 sm:table-cell">
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {REQUIRED_COLUMNS.map((col) => (
                    <tr
                      key={col.name}
                      className="border-b border-white/5 last:border-0"
                    >
                      <td className="px-3 py-1.5 font-mono text-[11px] text-white/80">
                        {col.name}
                      </td>
                      <td className="px-3 py-1.5">
                        {col.required ? (
                          <span className="rounded-full bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-medium text-rose-300">
                            Yes
                          </span>
                        ) : (
                          <span className="text-[10px] text-white/40">No</span>
                        )}
                      </td>
                      <td className="hidden px-3 py-1.5 text-[11px] text-white/50 sm:table-cell">
                        {col.desc}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-all duration-200",
              dragOver
                ? "border-teal-500/60 bg-teal-500/10"
                : file
                  ? "border-emerald-500/40 bg-emerald-500/5"
                  : "border-white/15 bg-white/5 hover:border-white/25 hover:bg-white/8"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="hidden"
            />

            {file ? (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10">
                  <FileSpreadsheet className="h-6 w-6 text-emerald-300" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-white">{file.name}</p>
                  <p className="text-xs text-white/50">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1 text-xs text-white/60 hover:bg-white/15 hover:text-white"
                >
                  <X className="h-3 w-3" />
                  Remove
                </button>
              </>
            ) : (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                  <Upload className="h-6 w-6 text-white/40" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-white/80">
                    Drop your CSV file here
                  </p>
                  <p className="text-xs text-white/40">
                    or click to browse files
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!file}
              onClick={handleImport}
              className="gap-2 bg-linear-to-r from-teal-500 to-cyan-600 text-white shadow-lg shadow-teal-500/25 hover:from-teal-600 hover:to-cyan-700 disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5" />
              Import Students
            </Button>
          </div>
        </div>
      )}

      {step === "importing" && (
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <div className="relative">
            <div className="h-14 w-14 animate-spin rounded-full border-2 border-teal-500/20 border-t-teal-500" />
            <div className="absolute inset-0 flex items-center justify-center">
              <FileSpreadsheet className="h-6 w-6 text-teal-400/60" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-white">
              Importing students...
            </p>
            <p className="text-xs text-white/50">
              Validating and creating student records
            </p>
          </div>
        </div>
      )}

      {step === "result" && result && (
        <div className="space-y-6">
          {/* Summary */}
          <div
            className={cn(
              "flex items-start gap-3 rounded-xl border p-4",
              result.created > 0
                ? "border-emerald-500/20 bg-emerald-500/5"
                : "border-rose-500/20 bg-rose-500/5"
            )}
          >
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
                result.created > 0
                  ? "border-emerald-500/30 bg-emerald-500/10"
                  : "border-rose-500/30 bg-rose-500/10"
              )}
            >
              {result.created > 0 ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-300" />
              ) : (
                <AlertCircle className="h-5 w-5 text-rose-300" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-sm font-medium",
                  result.created > 0 ? "text-emerald-200" : "text-rose-200"
                )}
              >
                {result.created > 0
                  ? `Successfully imported ${result.created} student(s)`
                  : "Import failed"}
              </p>
              {result.error && (
                <p className="mt-1 text-xs text-rose-300/80">{result.error}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-3 text-xs">
                <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-emerald-300">
                  {result.created} created
                </span>
                {result.failed > 0 && (
                  <span className="rounded-full bg-rose-500/20 px-2.5 py-0.5 text-rose-300">
                    {result.failed} failed
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Error details */}
          {result.errors.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-white/40">
                Errors ({result.errors.length})
              </p>
              <div className="max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-black/20">
                {result.errors.map((err, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 border-b border-white/5 px-3 py-2 last:border-0"
                  >
                    <span className="shrink-0 rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-mono text-rose-300">
                      Row {err.row}
                    </span>
                    <span className="text-xs text-white/60">{err.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            {result.failed > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={resetState}
                className="gap-2 border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
              >
                <Upload className="h-3.5 w-3.5" />
                Try Again
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="bg-linear-to-r from-teal-500 to-cyan-600 text-white hover:from-teal-600 hover:to-cyan-700"
            >
              Done
            </Button>
          </div>
        </div>
      )}
    </ResponsiveModal>
  );
}
