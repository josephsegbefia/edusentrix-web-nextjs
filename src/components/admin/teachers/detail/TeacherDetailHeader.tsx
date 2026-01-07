"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Users, PhoneCall, Mail, Home } from "lucide-react";

type TeacherDetailHeaderProps = {
  teacher: {
    id: string;
    fullName: string;
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
    photoUrl?: string | null;
    status: string;
    homeroom?: { id: string; name: string } | null;
    subjects?: Array<{ id: string; name: string }>;
  };
};

function initialsFromName(firstName?: string, lastName?: string): string {
  const first = firstName?.charAt(0)?.toUpperCase() || "";
  const last = lastName?.charAt(0)?.toUpperCase() || "";
  return first + last || "?";
}

export function TeacherDetailHeader({ teacher }: TeacherDetailHeaderProps) {
  const { fullName, firstName, lastName, email, phone, photoUrl, status, homeroom, subjects } = teacher;

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
                {initialsFromName(firstName, lastName)}
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
              <Badge
                variant="outline"
                className={cn(
                  "border text-[11px] font-semibold shadow-sm",
                  status === "active"
                    ? "border-emerald-400/70 bg-emerald-500/20 text-emerald-100 shadow-emerald-500/20"
                    : status === "inactive"
                    ? "border-slate-400/70 bg-slate-500/20 text-slate-100 shadow-slate-500/20"
                    : status === "on_leave"
                    ? "border-amber-400/70 bg-amber-500/20 text-amber-100 shadow-amber-500/20"
                    : status === "terminated"
                    ? "border-red-400/70 bg-red-500/20 text-red-100 shadow-red-500/20"
                    : "border-white/10 bg-white/5 text-muted-foreground"
                )}
              >
                {status.replace("_", " ")}
              </Badge>
              {homeroom && (
                <Badge className="bg-blue-500/20 border border-blue-400/30 text-blue-100 text-[11px] font-semibold px-2.5 py-0.5">
                  <Home className="mr-1.5 h-3.5 w-3.5" />
                  {homeroom.name}
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              {subjects && subjects.length > 0 && (
                <Badge className="bg-purple-500/20 border border-purple-400/30 text-purple-100 text-[11px] font-semibold px-2.5 py-0.5">
                  <Users className="mr-1.5 h-3.5 w-3.5" />
                  {subjects.length} subject{subjects.length === 1 ? "" : "s"}
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              {email && (
                <div className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{email}</span>
                </div>
              )}
              {phone && (
                <div className="flex items-center gap-1.5">
                  <PhoneCall className="h-3.5 w-3.5 shrink-0" />
                  <span>{phone}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
