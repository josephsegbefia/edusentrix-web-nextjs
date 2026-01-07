"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Users, Home, Calendar, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

type TeacherOverviewTabProps = {
  teacher: {
    id: string;
    fullName: string;
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
    status: string;
    homeroom?: { id: string; name: string } | null;
    subjects?: Array<{ id: string; name: string }>;
    employeeId?: string | null;
    department?: string | null;
    hireDate?: string | Date | null;
    terminationDate?: string | Date | null;
    createdAt: string | Date;
    updatedAt?: string | Date | null;
  };
};

function formatDate(value?: string | Date | null) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export function TeacherOverviewTab({ teacher }: TeacherOverviewTabProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Overview main */}
      <Card className="lg:col-span-2 border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Overview</CardTitle>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => alert("Assign subjects coming next")}
          >
            <Plus className="h-4 w-4" />
            Assign Subjects
          </Button>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Subjects */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
              Subjects
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {teacher.subjects && teacher.subjects.length > 0 ? (
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

          {/* Professional quick info */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
                Employee ID
              </p>
              <p className="mt-1 text-sm">{teacher.employeeId ?? "—"}</p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
                Department
              </p>
              <p className="mt-1 text-sm">{teacher.department ?? "—"}</p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
                Hire Date
              </p>
              <p className="mt-1 text-sm">{formatDate(teacher.hireDate)}</p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
                Termination Date
              </p>
              <p className="mt-1 text-sm">
                {formatDate(teacher.terminationDate)}
              </p>
            </div>
          </div>

          {/* Meta */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
                Created
              </p>
              <p className="mt-1 text-sm">{formatDate(teacher.createdAt)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
                Updated
              </p>
              <p className="mt-1 text-sm">
                {formatDate(teacher.updatedAt)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Right rail */}
      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => alert("Manage assignments coming next")}
          >
            Manage assignments
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => alert("Record attendance coming next")}
          >
            Record attendance
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => alert("Upload documents coming next")}
          >
            Upload documents
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => alert("Add note coming next")}
          >
            Add internal note
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
