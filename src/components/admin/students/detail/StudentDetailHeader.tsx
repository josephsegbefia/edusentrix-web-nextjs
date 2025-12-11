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
    <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
      <div
        className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/5 via-primary/2 to-transparent"
        aria-hidden="true"
      />
      <CardContent className="relative z-10 flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between">
        {/* Left: Avatar + basic info */}
        <div className="flex flex-1 items-center gap-4 min-w-0">
          <div className="relative shrink-0">
            <Avatar className="size-20 border-2 border-white/30 shadow-xl shadow-black/50 ring-2 ring-primary/20">
              {photoUrl ? <AvatarImage src={photoUrl} alt={fullName} /> : null}
              <AvatarFallback className="bg-linear-to-br from-primary/30 to-primary/20 text-xl font-bold text-primary-50">
                {initialsFromName(fullName)}
              </AvatarFallback>
            </Avatar>
            {status === "active" && (
              <div className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-card bg-emerald-500 ring-2 ring-card" />
            )}
          </div>

          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                {fullName}
              </h1>
              {performanceTier === "top" && (
                <Badge
                  variant="outline"
                  className="border-amber-400/70 bg-amber-500/20 text-[11px] font-semibold text-amber-100 shadow-sm shadow-amber-500/20"
                >
                  <GraduationCap className="mr-1.5 h-3.5 w-3.5" />
                  Top Performer
                </Badge>
              )}
              {feesStatus === "owing" && (
                <Badge
                  variant="outline"
                  className="border-red-400/70 bg-red-500/20 text-[11px] font-semibold text-red-100 shadow-sm shadow-red-500/20"
                >
                  <Wallet className="mr-1.5 h-3.5 w-3.5" />
                  Owing Fees
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              {grade && (
                <Badge className="bg-blue-500/20 border border-blue-400/30 text-blue-100 text-[11px] font-semibold px-2.5 py-0.5">
                  {grade.label}
                </Badge>
              )}
              {classGroup && (
                <Badge
                  variant="outline"
                  className="border-emerald-400/30 bg-emerald-500/10 text-emerald-100 text-[11px] font-semibold px-2.5 py-0.5"
                >
                  {classGroup.label}
                </Badge>
              )}
              {admissionNumber && (
                <span className="rounded-lg border border-white/20 bg-black/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  Adm. No:{" "}
                  <span className="font-semibold text-foreground">
                    {admissionNumber}
                  </span>
                </span>
              )}
              {typeof ageYears === "number" && ageYears >= 0 && (
                <span className="rounded-lg border border-white/15 bg-black/30 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  Age: <span className="font-semibold text-foreground">{ageYears}</span>
                </span>
              )}
              <span
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-[11px] font-medium",
                  status === "active" &&
                    "border-emerald-400/50 bg-emerald-500/20 text-emerald-100",
                  status === "inactive" &&
                    "border-slate-400/50 bg-slate-500/20 text-slate-100",
                  status === "withdrawn" &&
                    "border-red-400/50 bg-red-500/20 text-red-100"
                )}
              >
                Status: <span className="font-semibold capitalize">{status}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Right: quick stats + actions */}
        <div className="flex flex-col items-stretch gap-4 md:w-[340px]">
          <div className="grid grid-cols-2 gap-3">
            <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-blue-500/10 to-transparent shadow-md">
              <div
                className="pointer-events-none absolute inset-0 bg-linear-to-br from-blue-500/10 via-blue-500/5 to-transparent"
                aria-hidden="true"
              />
              <CardContent className="relative z-10 p-3">
                <div className="mb-2 flex items-center gap-1.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/20 border border-blue-400/30">
                    <UserCircle2 className="h-3.5 w-3.5 text-blue-200" />
                  </div>
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/90">
                    Academic
                  </span>
                </div>
                <div className="text-lg font-bold text-foreground">
                  {academicSummary?.overallAverage != null
                    ? `${academicSummary.overallAverage.toFixed(1)}%`
                    : "--"}
                </div>
                <p className="mt-0.5 text-[9px] text-muted-foreground/80 line-clamp-1">
                  {academicSummary?.latestTermLabel ?? "No term data yet"}
                </p>
              </CardContent>
            </Card>

            <Card
              className={cn(
                "relative overflow-hidden border border-white/10 bg-linear-to-br shadow-md",
                feesStatus === "clear"
                  ? "from-emerald-500/10 to-transparent"
                  : feesStatus === "owing"
                  ? "from-red-500/10 to-transparent"
                  : "from-amber-500/10 to-transparent"
              )}
            >
              <div
                className={cn(
                  "pointer-events-none absolute inset-0 bg-linear-to-br",
                  feesStatus === "clear"
                    ? "from-emerald-500/10 via-emerald-500/5 to-transparent"
                    : feesStatus === "owing"
                    ? "from-red-500/10 via-red-500/5 to-transparent"
                    : "from-amber-500/10 via-amber-500/5 to-transparent"
                )}
                aria-hidden="true"
              />
              <CardContent className="relative z-10 p-3">
                <div className="mb-2 flex items-center gap-1.5">
                  <div
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-lg border",
                      feesStatus === "clear"
                        ? "bg-emerald-500/20 border-emerald-400/30"
                        : feesStatus === "owing"
                        ? "bg-red-500/20 border-red-400/30"
                        : "bg-amber-500/20 border-amber-400/30"
                    )}
                  >
                    <Wallet
                      className={cn(
                        "h-3.5 w-3.5",
                        feesStatus === "clear"
                          ? "text-emerald-200"
                          : feesStatus === "owing"
                          ? "text-red-200"
                          : "text-amber-200"
                      )}
                    />
                  </div>
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/90">
                    Fees
                  </span>
                </div>
                <div className="text-lg font-bold text-foreground">
                  {feesSummary
                    ? `${feesSummary.currency} ${feesSummary.totalOutstanding.toLocaleString()}`
                    : "--"}
                </div>
                <p className="mt-0.5 text-[9px] text-muted-foreground/80 line-clamp-1">
                  {feesSummary?.status
                    ? feesSummary.status === "clear"
                      ? "All fees cleared"
                      : feesSummary.status === "partial"
                      ? "Partially paid"
                      : "Owing fees"
                    : "No fee data yet"}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="cursor-pointer border border-white/20 bg-black/30 text-white/70 transition-all duration-200 hover:scale-105 hover:border-blue-400/50 hover:bg-blue-500/20 hover:text-blue-200 hover:shadow-md hover:shadow-blue-500/20 active:scale-95"
            >
              <PhoneCall className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="cursor-pointer border border-white/20 bg-black/30 text-white/70 transition-all duration-200 hover:scale-105 hover:border-cyan-400/50 hover:bg-cyan-500/20 hover:text-cyan-200 hover:shadow-md hover:shadow-cyan-500/20 active:scale-95"
            >
              <Mail className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer border border-white/25 bg-white/10 text-xs font-medium text-white/90 transition-all duration-200 hover:scale-105 hover:border-primary/50 hover:bg-primary/20 hover:text-primary-50 hover:shadow-md hover:shadow-primary/20 active:scale-95"
            >
              Record Payment
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
