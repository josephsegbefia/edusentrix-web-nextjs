"use client";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PremiumDropdownMenu,
  PremiumDropdownMenuContent,
  PremiumDropdownMenuItem,
  PremiumDropdownMenuTrigger,
} from "@/components/ui/premium-dropdown-menu";
import { useBusyToast } from "@/hooks/useBusyToast";

export type ExportButtonProps = {
  classGroupId: string;
  subjectId: string;
  classLabel?: string;
  subjectLabel?: string;
  disabled?: boolean;
};

function buildFileName(
  format: "csv" | "pdf",
  classLabel?: string,
  subjectLabel?: string
) {
  const date = new Date().toISOString().split("T")[0];
  const parts = ["gradebook", classLabel, subjectLabel, date]
    .filter(Boolean)
    .map((part) => String(part).trim().replace(/\s+/g, "-"))
    .filter(Boolean);
  return `${parts.join("-")}.${format}`;
}

export function ExportButton({
  classGroupId,
  subjectId,
  classLabel,
  subjectLabel,
  disabled,
}: ExportButtonProps) {
  const busyToast = useBusyToast();

  const handleExport = async (format: "csv" | "pdf") => {
    busyToast.show("Preparing gradebook export...");

    try {
      const res = await fetch(
        `/api/teacher/gradebook/${classGroupId}/${subjectId}/export?format=${format}`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to export gradebook");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = buildFileName(format, classLabel, subjectLabel);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      busyToast.hide();
      busyToast.success("Gradebook export ready");
    } catch (err) {
      busyToast.hide();
      busyToast.error(err instanceof Error ? err.message : "Failed to export gradebook");
    }
  };

  return (
    <PremiumDropdownMenu>
      <PremiumDropdownMenuTrigger asChild>
        <Button
          disabled={disabled}
          variant="outline"
          className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
        >
          <Download className="h-4 w-4" />
          Export
        </Button>
      </PremiumDropdownMenuTrigger>
      <PremiumDropdownMenuContent align="end">
        <PremiumDropdownMenuItem onClick={() => handleExport("csv")}>
          Export CSV
        </PremiumDropdownMenuItem>
        <PremiumDropdownMenuItem onClick={() => handleExport("pdf")}>
          Export PDF
        </PremiumDropdownMenuItem>
      </PremiumDropdownMenuContent>
    </PremiumDropdownMenu>
  );
}
