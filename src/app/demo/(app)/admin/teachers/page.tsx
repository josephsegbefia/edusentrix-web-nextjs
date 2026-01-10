// src/app/demo/(app)/admin/teachers/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Users,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Eye,
  LayoutGrid,
  List,
  BookOpen,
  School,
} from "lucide-react";

interface Teacher {
  _id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  employeeId?: string;
  status: string;
  avatarUrl?: string;
  department?: string;
  subjects: string[];
  homeroomClassName?: string;
  hireDate?: string;
}

function TeacherCard({ teacher }: { teacher: Teacher }) {
  const initials = `${teacher.firstName?.[0] || ""}${teacher.lastName?.[0] || ""}`.toUpperCase();

  const statusColors: Record<string, string> = {
    active: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    "on-leave": "bg-amber-500/20 text-amber-300 border-amber-500/30",
    inactive: "bg-gray-500/20 text-gray-300 border-gray-500/30",
    terminated: "bg-red-500/20 text-red-300 border-red-500/30",
  };

  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition-all">
      <div className="flex items-start gap-4">
        <Avatar className="h-12 w-12">
          <AvatarImage src={teacher.avatarUrl} />
          <AvatarFallback className="bg-purple-500/20 text-purple-300">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-white truncate">
              {teacher.firstName} {teacher.lastName}
            </h3>
            <Badge
              variant="outline"
              className={`text-xs ${statusColors[teacher.status] || statusColors.active}`}
            >
              {teacher.status}
            </Badge>
          </div>
          <div className="text-sm text-white/60 mb-2">
            {teacher.employeeId && <span className="mr-3">ID: {teacher.employeeId}</span>}
            {teacher.department && (
              <span className="text-white/50">{teacher.department}</span>
            )}
          </div>
          {teacher.subjects.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {teacher.subjects.slice(0, 3).map((subject, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {subject}
                </Badge>
              ))}
              {teacher.subjects.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{teacher.subjects.length - 3} more
                </Badge>
              )}
            </div>
          )}
          {teacher.homeroomClassName && (
            <div className="flex items-center gap-1 text-xs text-white/50">
              <School className="h-3 w-3" />
              Homeroom: {teacher.homeroomClassName}
            </div>
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

export default function DemoTeachersPage() {
  const [teachers, setTeachers] = React.useState<Teacher[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [viewMode, setViewMode] = React.useState<"cards" | "table">("cards");

  const fetchTeachers = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "12");
      if (search) params.set("q", search);

      const res = await fetch(`/api/demo/teachers?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTeachers(data.data || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotal(data.pagination?.total || 0);
      }
    } catch (error) {
      console.error("Failed to fetch teachers:", error);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  React.useEffect(() => {
    fetchTeachers();
  }, [fetchTeachers]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchTeachers();
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
            <Users className="h-8 w-8 text-purple-400" />
            Teachers
            <Badge variant="outline" className="border-amber-500/50 text-amber-400">
              DEMO
            </Badge>
          </h1>
          <p className="text-muted-foreground mt-1">
            View and manage teacher records
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled>
            Import Teachers
          </Button>
          <Button disabled>
            Add Teacher
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

      {/* Toolbar */}
      <Card className="border-white/10 bg-white/5">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <Input
                placeholder="Search teachers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-white/5 border-white/10"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-white/60">
                Showing {teachers.length} of {total} teachers
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
      ) : teachers.length === 0 ? (
        <Card className="border-white/10 bg-white/5">
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto mb-4 text-white/20" />
            <h3 className="text-lg font-semibold mb-2">No teachers found</h3>
            <p className="text-white/60">
              {search ? "Try a different search term" : "No demo teachers available"}
            </p>
          </CardContent>
        </Card>
      ) : viewMode === "cards" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {teachers.map((teacher) => (
            <TeacherCard key={teacher._id} teacher={teacher} />
          ))}
        </div>
      ) : (
        <Card className="border-white/10 bg-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left p-4 text-xs font-semibold text-white/60 uppercase">Teacher</th>
                  <th className="text-left p-4 text-xs font-semibold text-white/60 uppercase">ID</th>
                  <th className="text-left p-4 text-xs font-semibold text-white/60 uppercase">Subjects</th>
                  <th className="text-left p-4 text-xs font-semibold text-white/60 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((teacher) => {
                  const initials = `${teacher.firstName?.[0] || ""}${teacher.lastName?.[0] || ""}`.toUpperCase();
                  return (
                    <tr key={teacher._id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={teacher.avatarUrl} />
                            <AvatarFallback className="bg-purple-500/20 text-purple-300 text-xs">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-white">
                              {teacher.firstName} {teacher.lastName}
                            </div>
                            {teacher.email && (
                              <div className="text-xs text-white/50">{teacher.email}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-white/70">{teacher.employeeId || "—"}</td>
                      <td className="p-4 text-sm text-white/70">
                        {teacher.subjects.length > 0 ? teacher.subjects.join(", ") : "—"}
                      </td>
                      <td className="p-4">
                        <Badge variant="outline" className="capitalize">
                          {teacher.status}
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
