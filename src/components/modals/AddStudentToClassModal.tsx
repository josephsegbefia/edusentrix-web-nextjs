// src/components/modals/AddStudentToClassModal.tsx
"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  Search,
  UserPlus,
  Check,
  Loader2,
  X,
  AlertCircle,
  Users,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useBusyToast } from "@/hooks/useBusyToast";

type AddStudentToClassModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  className: string;
};

type StudentOption = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  admissionNumber: string | null;
  photoUrl: string | null;
  currentClass: string | null;
};

export function AddStudentToClassModal({
  open,
  onOpenChange,
  classId,
  className,
}: AddStudentToClassModalProps) {
  const [search, setSearch] = React.useState("");
  const [selectedStudentIds, setSelectedStudentIds] = React.useState<string[]>([]);

  const queryClient = useQueryClient();
  const busy = useBusyToast();

  const debouncedSearch = useDebouncedValue(search, 300);

  // Reset when modal opens
  React.useEffect(() => {
    if (open) {
      setSearch("");
      setSelectedStudentIds([]);
    }
  }, [open]);

  // Fetch students (excluding those already in this class)
  const { data, isLoading } = useQuery<{
    success: boolean;
    data: StudentOption[];
  }>({
    queryKey: ["students-for-class-assignment", debouncedSearch, classId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      params.set("excludeClassId", classId);
      params.set("limit", "20");

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
          currentClass: s.classGroupName
            ? `${s.gradeName || ""} ${s.classGroupName}`.trim()
            : null,
        })),
      };
    },
    enabled: open,
    staleTime: 30_000,
  });

  const students = data?.data || [];

  // Assign students mutation
  const assignMutation = useMutation({
    mutationFn: async (studentIds: string[]) => {
      const results = await Promise.all(
        studentIds.map(async (studentId) => {
          const res = await fetch(`/api/admin/classes/${classId}/students`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ studentId }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || "Failed to add student");
          }
          return res.json();
        })
      );
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["class-students"] });
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["class"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
  });

  const toggleStudent = (studentId: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleAdd = async () => {
    if (selectedStudentIds.length === 0) return;

    try {
      await busy.promise(assignMutation.mutateAsync(selectedStudentIds), {
        loading: `Adding ${selectedStudentIds.length} student${selectedStudentIds.length !== 1 ? "s" : ""} to ${className}...`,
        success: "Students added successfully!",
        error: (e: Error) => e.message || "Failed to add students",
      });
      onOpenChange(false);
    } catch {
      // Error handled by busy toast
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase() || "?";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-black p-0 text-white shadow-2xl">
        {/* Header */}
        <DialogHeader className="border-b border-white/10 p-6 pb-4">
          <DialogTitle className="flex items-center gap-3 text-xl font-bold">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20">
              <UserPlus className="h-5 w-5 text-emerald-300" />
            </div>
            Add Students to {className}
          </DialogTitle>
          <p className="mt-2 text-sm text-white/60">
            Search and select students to add to this class
          </p>
        </DialogHeader>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
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

          {/* Student list */}
          <div className="max-h-[300px] overflow-y-auto rounded-xl border border-white/10 bg-black/20">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
              </div>
            ) : students.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Users className="h-8 w-8 text-white/30" />
                <p className="mt-2 text-sm text-white/50">
                  {search
                    ? "No students found matching your search"
                    : "Start typing to search for students"}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {students.map((student) => {
                  const isSelected = selectedStudentIds.includes(student.id);

                  return (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => toggleStudent(student.id)}
                      className={cn(
                        "flex w-full items-center gap-3 p-3 text-left transition-all",
                        isSelected
                          ? "bg-emerald-500/10"
                          : "hover:bg-white/5"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-all",
                          isSelected
                            ? "border-emerald-500 bg-emerald-500"
                            : "border-white/30 bg-transparent"
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3 text-white" />}
                      </div>

                      <Avatar className="h-9 w-9 border border-white/20">
                        <AvatarImage
                          src={student.photoUrl || ""}
                          alt={student.fullName}
                        />
                        <AvatarFallback className="bg-gradient-to-br from-emerald-600 to-green-700 text-xs font-semibold text-white">
                          {getInitials(student.firstName, student.lastName)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">
                          {student.fullName}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-white/50">
                          {student.admissionNumber && (
                            <span>{student.admissionNumber}</span>
                          )}
                          {student.currentClass && (
                            <>
                              <span className="text-white/30">•</span>
                              <span>Currently: {student.currentClass}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selection summary */}
          {selectedStudentIds.length > 0 && (
            <div className="rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-200">
              <strong>{selectedStudentIds.length}</strong> student
              {selectedStudentIds.length !== 1 ? "s" : ""} selected
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/10 p-6 pt-4">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-white/60 hover:text-white"
          >
            Cancel
          </Button>

          <Button
            onClick={handleAdd}
            disabled={selectedStudentIds.length === 0 || assignMutation.isPending}
            className="gap-2 bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/20 hover:from-emerald-600 hover:to-green-700 disabled:opacity-50"
          >
            {assignMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                Add to Class
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
