// src/app/demo/(app)/admin/students/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  GraduationCap,
  Search,
  Users,
  UserCheck,
  UserX,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Eye,
  LayoutGrid,
  List,
} from "lucide-react";

interface Student {
  _id: string;
  firstName: string;
  lastName: string;
  email?: string;
  studentId?: string;
  status: string;
  gender?: string;
  avatarUrl?: string;
  classGroupName?: string;
  gradeLabel?: string;
  createdAt: string;
}

interface Stats {
  total: number;
  active: number;
  inactive: number;
  suspended: number;
  graduated: number;
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}) {
  return (
    <div className={`rounded-xl border border-white/10 bg-white/5 p-4 ${accent}`}>
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-white/10">
          <Icon className="h-4 w-4 text-white/80" />
        </div>
        <div>
          <div className="text-2xl font-bold text-white">{value}</div>
          <div className="text-xs text-white/60">{label}</div>
        </div>
      </div>
    </div>
  );
}

function StudentCard({ student }: { student: Student }) {
  const initials = `${student.firstName?.[0] || ""}${student.lastName?.[0] || ""}`.toUpperCase();

  const statusColors: Record<string, string> = {
    active: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    inactive: "bg-gray-500/20 text-gray-300 border-gray-500/30",
    suspended: "bg-red-500/20 text-red-300 border-red-500/30",
    graduated: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  };

  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition-all">
      <div className="flex items-start gap-4">
        <Avatar className="h-12 w-12">
          <AvatarImage src={student.avatarUrl} />
          <AvatarFallback className="bg-blue-500/20 text-blue-300">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-white truncate">
              {student.firstName} {student.lastName}
            </h3>
            <Badge
              variant="outline"
              className={`text-xs ${statusColors[student.status] || statusColors.active}`}
            >
              {student.status}
            </Badge>
          </div>
          <div className="text-sm text-white/60 mb-2">
            {student.studentId && <span className="mr-3">ID: {student.studentId}</span>}
            {student.classGroupName && (
              <span className="text-white/50">{student.classGroupName}</span>
            )}
          </div>
          {student.email && (
            <div className="text-xs text-white/50 truncate">{student.email}</div>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Eye className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function DemoStudentsPage() {
  const [students, setStudents] = React.useState<Student[]>([]);
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [viewMode, setViewMode] = React.useState<"cards" | "table">("cards");

  const fetchStudents = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "12");
      if (search) params.set("q", search);

      const res = await fetch(`/api/demo/students?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setStudents(data.data || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotal(data.pagination?.total || 0);
      }
    } catch (error) {
      console.error("Failed to fetch students:", error);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  const fetchStats = React.useCallback(async () => {
    try {
      const res = await fetch("/api/demo/students/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  }, []);

  React.useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  React.useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Debounced search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchStudents();
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link
              href="/demo/admin"
              className="text-white/60 hover:text-white transition-colors"
            >
              ← Dashboard
            </Link>
          </div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <GraduationCap className="h-8 w-8 text-blue-400" />
            Students
            <Badge variant="outline" className="border-amber-500/50 text-amber-400">
              DEMO
            </Badge>
          </h1>
          <p className="text-muted-foreground mt-1">
            View and manage student records
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled>
            Import Students
          </Button>
          <Button disabled>
            Add Student
          </Button>
        </div>
      </div>

      {/* Demo Notice */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-3">
          <p className="text-sm text-amber-200/80">
            <Eye className="h-4 w-4 inline mr-2" />
            Viewing demo data. Add/edit operations are disabled in demo mode.
          </p>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total Students"
            value={stats.total}
            icon={Users}
            accent=""
          />
          <StatCard
            label="Active"
            value={stats.active}
            icon={UserCheck}
            accent=""
          />
          <StatCard
            label="Inactive"
            value={stats.inactive}
            icon={UserX}
            accent=""
          />
          <StatCard
            label="Graduated"
            value={stats.graduated}
            icon={GraduationCap}
            accent=""
          />
        </div>
      )}

      {/* Toolbar */}
      <Card className="border-white/10 bg-white/5">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <Input
                placeholder="Search students..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-white/5 border-white/10"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-white/60">
                Showing {students.length} of {total} students
              </span>
              <div className="flex border border-white/10 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode("cards")}
                  className={`p-2 ${viewMode === "cards" ? "bg-white/10" : "hover:bg-white/5"}`}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode("table")}
                  className={`p-2 ${viewMode === "table" ? "bg-white/10" : "hover:bg-white/5"}`}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-white/40" />
        </div>
      ) : students.length === 0 ? (
        <Card className="border-white/10 bg-white/5">
          <CardContent className="py-12 text-center">
            <GraduationCap className="h-12 w-12 mx-auto mb-4 text-white/20" />
            <h3 className="text-lg font-semibold mb-2">No students found</h3>
            <p className="text-white/60">
              {search ? "Try a different search term" : "No demo students available"}
            </p>
          </CardContent>
        </Card>
      ) : viewMode === "cards" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {students.map((student) => (
            <StudentCard key={student._id} student={student} />
          ))}
        </div>
      ) : (
        <Card className="border-white/10 bg-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left p-4 text-xs font-semibold text-white/60 uppercase">Student</th>
                  <th className="text-left p-4 text-xs font-semibold text-white/60 uppercase">ID</th>
                  <th className="text-left p-4 text-xs font-semibold text-white/60 uppercase">Class</th>
                  <th className="text-left p-4 text-xs font-semibold text-white/60 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => {
                  const initials = `${student.firstName?.[0] || ""}${student.lastName?.[0] || ""}`.toUpperCase();
                  return (
                    <tr key={student._id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={student.avatarUrl} />
                            <AvatarFallback className="bg-blue-500/20 text-blue-300 text-xs">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-white">
                              {student.firstName} {student.lastName}
                            </div>
                            {student.email && (
                              <div className="text-xs text-white/50">{student.email}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-white/70">{student.studentId || "—"}</td>
                      <td className="p-4 text-sm text-white/70">{student.classGroupName || "—"}</td>
                      <td className="p-4">
                        <Badge variant="outline" className="capitalize">
                          {student.status}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <span className="text-sm text-white/60 px-4">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
