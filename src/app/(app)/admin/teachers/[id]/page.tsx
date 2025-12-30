// src/app/(app)/admin/teachers/[id]/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, Phone, Home } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useTeacher } from "@/hooks/admin/useTeachers";

function statusClass(status: string) {
  switch (status) {
    case "active":
      return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
    case "inactive":
      return "border-slate-400/30 bg-slate-500/10 text-slate-200";
    case "on_leave":
      return "border-amber-400/30 bg-amber-500/10 text-amber-200";
    case "terminated":
      return "border-red-400/30 bg-red-500/10 text-red-200";
    default:
      return "border-white/10 bg-white/5 text-muted-foreground";
  }
}

export default function TeacherDetailPage() {
  const params = useParams<{ id: string }>();
  const teacherId = params?.id;

  const { data, isLoading, isError } = useTeacher(String(teacherId));
  const teacher = data?.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="ghost" className="gap-2">
          <Link href="/admin/teachers">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => alert("Edit teacher coming next")}
          >
            Edit
          </Button>
          <Button onClick={() => alert("Invite / reset access coming next")}>
            Manage Access
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardContent className="p-10">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-white/40" />
          </CardContent>
        </Card>
      ) : isError || !teacher ? (
        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardContent className="p-10">
            <p className="text-sm text-red-300/80">Failed to load teacher.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Header */}
          <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
            <CardContent className="p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                  <Avatar className="h-14 w-14 border border-white/10">
                    <AvatarImage
                      src={teacher.photoUrl ?? undefined}
                      alt={teacher.fullName}
                    />
                    <AvatarFallback>
                      {teacher.firstName.slice(0, 1)}
                      {teacher.lastName.slice(0, 1)}
                    </AvatarFallback>
                  </Avatar>

                  <div>
                    <h1 className="text-2xl font-bold">{teacher.fullName}</h1>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn("border", statusClass(teacher.status))}
                      >
                        {teacher.status.replace("_", " ")}
                      </Badge>
                      {teacher.homeroom ? (
                        <Badge
                          variant="outline"
                          className="border-white/10 bg-white/5"
                        >
                          <Home className="mr-1 h-3.5 w-3.5" />
                          {teacher.homeroom.name}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    <span>{teacher.email ?? "—"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    <span>{teacher.phone ?? "—"}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Overview */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2 border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
              <CardHeader>
                <CardTitle>Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
                    Subjects
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {teacher.subjects.length ? (
                      teacher.subjects.map((s) => (
                        <Badge
                          key={s.id}
                          variant="outline"
                          className="border-white/10 bg-white/5"
                        >
                          {s.name}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground/80">
                        No subjects assigned yet.
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
                      Created
                    </p>
                    <p className="mt-1 text-sm">
                      {new Date(teacher.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
                      Updated
                    </p>
                    <p className="mt-1 text-sm">
                      {new Date(teacher.updatedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
              <CardHeader>
                <CardTitle>Next</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>Assignments (period-based)</p>
                <p>Attendance tracking</p>
                <p>Documents & certifications</p>
                <p>Notes & activity log</p>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
