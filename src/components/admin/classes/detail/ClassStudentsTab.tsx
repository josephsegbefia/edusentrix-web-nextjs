// src/components/admin/classes/detail/ClassStudentsTab.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Users,
  UserPlus,
  Search,
  ExternalLink,
  MoreHorizontal,
  Mail,
  Loader2,
  AlertCircle,
  X,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import {
  PremiumDropdownMenu,
  PremiumDropdownMenuTrigger,
  PremiumDropdownMenuContent,
  PremiumDropdownMenuItem,
  PremiumDropdownMenuSeparator,
} from "@/components/ui/premium-dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

type ClassStudentsTabProps = {
  classId: string;
  className: string;
  onAddStudent?: () => void;
};

type StudentItem = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  admissionNumber: string | null;
  photoUrl: string | null;
  status: "active" | "inactive" | "withdrawn";
  email: string | null;
};

type SortBy = "name" | "admissionNumber" | "status";
type SortOrder = "asc" | "desc";

export function ClassStudentsTab({
  classId,
  className,
  onAddStudent,
}: ClassStudentsTabProps) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [sortBy, setSortBy] = React.useState<SortBy>("name");
  const [sortOrder, setSortOrder] = React.useState<SortOrder>("asc");

  const debouncedSearch = useDebouncedValue(search, 400);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Fetch students for this class
  const { data, isLoading, isError } = useQuery<{
    success: boolean;
    data: StudentItem[];
  }>({
    queryKey: ["class-students", classId, debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("classGroupId", classId);
      if (debouncedSearch) params.set("search", debouncedSearch);

      const res = await fetch(`/api/admin/students?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch students");
      const json = await res.json();
      return {
        success: true,
        data: (json.data || []).map((s: any) => ({
          id: s.id,
          firstName: s.firstName,
          lastName: s.lastName,
          fullName: s.fullName,
          admissionNumber: s.admissionNumber,
          photoUrl: s.photoUrl,
          status: s.status,
          email: s.email || null,
        })),
      };
    },
    staleTime: 30_000,
  });

  const students = data?.data || [];

  // Sort students
  const sortedStudents = React.useMemo(() => {
    const sorted = [...students];
    const multiplier = sortOrder === "asc" ? 1 : -1;

    sorted.sort((a, b) => {
      switch (sortBy) {
        case "admissionNumber":
          return (
            (a.admissionNumber || "").localeCompare(b.admissionNumber || "") *
            multiplier
          );
        case "status":
          return a.status.localeCompare(b.status) * multiplier;
        case "name":
        default:
          return a.fullName.localeCompare(b.fullName) * multiplier;
      }
    });

    return sorted;
  }, [students, sortBy, sortOrder]);

  const handleSortChange = (column: SortBy) => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  };

  const handleViewStudent = (studentId: string) => {
    router.push(`/admin/students/${studentId}`);
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase() || "?";
  };

  const statusConfig = {
    active: {
      label: "Active",
      className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    },
    inactive: {
      label: "Inactive",
      className: "border-slate-500/30 bg-slate-500/10 text-slate-300",
    },
    withdrawn: {
      label: "Withdrawn",
      className: "border-red-500/30 bg-red-500/10 text-red-300",
    },
  };

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">
            Students in {className}
          </h2>
          <p className="text-sm text-white/50">
            {students.length} student{students.length !== 1 ? "s" : ""} enrolled
          </p>
        </div>
        <Button
          onClick={onAddStudent}
          className="gap-2 bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/20 hover:from-emerald-600 hover:to-green-700"
        >
          <UserPlus className="h-4 w-4" />
          Add Student
        </Button>
      </div>

      {/* Search & Filters */}
      <Card className="border border-white/10 bg-slate-950/60 backdrop-blur">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search students by name or admission number..."
              className="h-10 w-full rounded-xl border border-white/15 bg-black/40 pl-10 pr-10 text-sm text-white placeholder:text-white/40 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white/60 transition-colors hover:bg-white/15 hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Students Table */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
          <p className="mt-3 text-sm text-white/50">Loading students...</p>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-16">
          <AlertCircle className="h-8 w-8 text-rose-400" />
          <p className="mt-3 text-sm font-medium text-white/70">
            Failed to load students
          </p>
        </div>
      ) : sortedStudents.length === 0 ? (
        <Card className="border border-white/10 bg-slate-950/60 backdrop-blur">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
              <Users className="h-8 w-8 text-white/30" />
            </div>
            <p className="mt-4 text-sm font-medium text-white/70">
              {search ? "No students found" : "No students in this class"}
            </p>
            <p className="mt-1 text-xs text-white/50">
              {search
                ? "Try adjusting your search"
                : "Add students to get started"}
            </p>
            {!search && (
              <Button
                onClick={onAddStudent}
                className="mt-4 gap-2 bg-gradient-to-r from-emerald-500 to-green-600 text-white"
              >
                <UserPlus className="h-4 w-4" />
                Add First Student
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/10">
          <table className="min-w-full border-collapse text-xs md:text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-xs">
                <th className="min-w-[200px] px-4 py-3 text-left align-middle">
                  <button
                    type="button"
                    onClick={() => handleSortChange("name")}
                    className="group inline-flex items-center gap-1 text-white/60 hover:text-white"
                  >
                    Student
                    {sortBy === "name" ? (
                      sortOrder === "asc" ? (
                        <ChevronUp className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 text-emerald-400" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3.5 w-3.5 text-white/40" />
                    )}
                  </button>
                </th>
                <th className="min-w-[140px] px-4 py-3 text-left align-middle">
                  <button
                    type="button"
                    onClick={() => handleSortChange("admissionNumber")}
                    className="group inline-flex items-center gap-1 text-white/60 hover:text-white"
                  >
                    Admission No.
                    {sortBy === "admissionNumber" ? (
                      sortOrder === "asc" ? (
                        <ChevronUp className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 text-emerald-400" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3.5 w-3.5 text-white/40" />
                    )}
                  </button>
                </th>
                <th className="min-w-[100px] px-4 py-3 text-left align-middle">
                  <button
                    type="button"
                    onClick={() => handleSortChange("status")}
                    className="group inline-flex items-center gap-1 text-white/60 hover:text-white"
                  >
                    Status
                    {sortBy === "status" ? (
                      sortOrder === "asc" ? (
                        <ChevronUp className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 text-emerald-400" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3.5 w-3.5 text-white/40" />
                    )}
                  </button>
                </th>
                <th className="w-12 px-4 py-3 text-right align-middle">
                  <span className="text-xs font-medium text-white/60">
                    Actions
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedStudents.map((student) => (
                <tr
                  key={student.id}
                  onClick={() => handleViewStudent(student.id)}
                  className="cursor-pointer border-b border-white/5 transition-colors hover:bg-white/5"
                >
                  <td className="px-4 py-3 align-middle">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 border border-white/20">
                        <AvatarImage
                          src={student.photoUrl || ""}
                          alt={student.fullName}
                        />
                        <AvatarFallback className="bg-gradient-to-br from-emerald-600 to-green-700 text-xs font-semibold text-white">
                          {getInitials(student.firstName, student.lastName)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-white">{student.fullName}</p>
                        {student.email && (
                          <p className="text-xs text-white/50">{student.email}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle text-white/70">
                    {student.admissionNumber || "—"}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-full text-[10px]",
                        statusConfig[student.status]?.className
                      )}
                    >
                      {statusConfig[student.status]?.label || student.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right align-middle">
                    <PremiumDropdownMenu>
                      <PremiumDropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </PremiumDropdownMenuTrigger>
                      <PremiumDropdownMenuContent
                        align="end"
                        className="border border-white/10 bg-slate-900/95 text-xs text-slate-50 backdrop-blur-xl"
                      >
                        <PremiumDropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewStudent(student.id);
                          }}
                          className="cursor-pointer gap-2"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          View Profile
                        </PremiumDropdownMenuItem>
                        {student.email && (
                          <>
                            <PremiumDropdownMenuSeparator className="bg-white/10" />
                            <PremiumDropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                window.location.href = `mailto:${student.email}`;
                              }}
                              className="cursor-pointer gap-2"
                            >
                              <Mail className="h-3.5 w-3.5" />
                              Send Email
                            </PremiumDropdownMenuItem>
                          </>
                        )}
                      </PremiumDropdownMenuContent>
                    </PremiumDropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
