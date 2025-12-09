"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  GraduationCap,
  UserCircle2,
  PhoneCall,
  Mail,
  Wallet,
} from "lucide-react";
import type { StudentDetailDTO } from "@/hooks/admin/useStudentDetail";

type StudentDetailHeaderProps = {
  student: StudentDetailDTO;
};

function initialsFromName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  if (!parts.length) return "";
  if (parts.length === 1) return parts[0]!.charAt(0)?.toUpperCase() ?? "";
  return (
    (parts[0]?.charAt(0)?.toUpperCase() ?? "") +
    (parts[parts.length - 1]?.charAt(0)?.toUpperCase() ?? "")
  );
}

export function StudentDetailHeader({ student }: StudentDetailHeaderProps) {
  const {
    fullName,
    classGroup,
    grade,
    admissionNumber,
    status,
    photoUrl,
    ageYears,
    academicSummary,
    feesSummary,
  } = student;

  const performanceTier = academicSummary?.performanceTier ?? null;
  const feesStatus = feesSummary?.status ?? null;

  return (
    <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 via-slate-900/60 to-transparent shadow-lg shadow-black/30 backdrop-blur">
      <div
        className="pointer-events-none absolute inset-0 bg-linear-to-r from-primary/20 via-primary/5 to-transparent"
        aria-hidden="true"
      />
      <CardContent className="relative z-10 flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between">
        {/* Left: Avatar + basic info */}
        <div className="flex flex-1 items-center gap-4">
          <Avatar className="size-16 border border-white/20 shadow-lg shadow-black/40">
            {photoUrl ? <AvatarImage src={photoUrl} alt={fullName} /> : null}
            <AvatarFallback className="bg-primary/20 text-lg font-semibold text-primary-50">
              {initialsFromName(fullName)}
            </AvatarFallback>
          </Avatar>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
                {fullName}
              </h1>
              {performanceTier === "top" && (
                <Badge
                  variant="outline"
                  className="border-amber-400/70 bg-amber-500/10 text-[11px] font-medium text-amber-100"
                >
                  <GraduationCap className="mr-1 h-3 w-3" />
                  Top Performer
                </Badge>
              )}
              {feesStatus === "owing" && (
                <Badge
                  variant="outline"
                  className="border-red-400/70 bg-red-500/10 text-[11px] font-medium text-red-100"
                >
                  <Wallet className="mr-1 h-3 w-3" />
                  Owing Fees
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground/90">
              {grade && (
                <Badge className="bg-white/10 text-[11px] font-medium">
                  {grade.label}
                </Badge>
              )}
              {classGroup && (
                <Badge
                  variant="outline"
                  className="border-white/20 bg-black/30 text-[11px]"
                >
                  {classGroup.label}
                </Badge>
              )}
              {admissionNumber && (
                <span className="rounded-full border border-white/15 bg-black/30 px-2 py-0.5 text-[11px]">
                  Adm. No:{" "}
                  <span className="font-medium text-foreground">
                    {admissionNumber}
                  </span>
                </span>
              )}
              {typeof ageYears === "number" && ageYears >= 0 && (
                <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[11px]">
                  Age: <span className="font-medium">{ageYears}</span>
                </span>
              )}
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[11px]",
                  status === "active" &&
                    "border-emerald-400/70 bg-emerald-500/10 text-emerald-100",
                  status === "inactive" &&
                    "border-slate-400/70 bg-slate-500/10 text-slate-100",
                  status === "withdrawn" &&
                    "border-red-400/70 bg-red-500/10 text-red-100"
                )}
              >
                Status: <span className="font-medium capitalize">{status}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Right: quick stats + actions */}
        <div className="flex flex-col items-stretch gap-3 md:w-[320px]">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl border border-white/15 bg-black/30 px-3 py-2">
              <div className="mb-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                <UserCircle2 className="h-3.5 w-3.5" />
                Academic
              </div>
              <div className="text-sm font-semibold">
                {academicSummary?.overallAverage != null
                  ? `${academicSummary.overallAverage.toFixed(1)}%`
                  : "--"}
              </div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                {academicSummary?.latestTermLabel ?? "No term data yet"}
              </div>
            </div>

            <div className="rounded-xl border border-white/15 bg-black/30 px-3 py-2">
              <div className="mb-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                <Wallet className="h-3.5 w-3.5" />
                Fees
              </div>
              <div className="text-sm font-semibold">
                {feesSummary
                  ? `${
                      feesSummary.currency
                    } ${feesSummary.totalOutstanding.toLocaleString()}`
                  : "--"}
              </div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                {feesSummary?.status
                  ? feesSummary.status === "clear"
                    ? "All fees cleared"
                    : feesSummary.status === "partial"
                    ? "Partially paid"
                    : "Owing fees"
                  : "No fee data yet"}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="border-white/20 bg-black/30 hover:bg-white/10"
            >
              <PhoneCall className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="border-white/20 bg-black/30 hover:bg-white/10"
            >
              <Mail className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-white/25 bg-white/10 text-xs font-medium hover:bg-white/20"
            >
              Record Payment
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
