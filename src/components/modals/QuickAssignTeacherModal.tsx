// src/components/modals/QuickAssignTeacherModal.tsx
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  UserPlus,
  Check,
  Loader2,
  Search,
  X,
  UserCheck,
  BookOpen,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useBusyToast } from "@/hooks/useBusyToast";
import { motion, AnimatePresence } from "framer-motion";

type QuickAssignTeacherModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  className: string;
  subject: {
    id: string;
    subjectOfferingId?: string | null;
    name: string;
    code: string | null;
  };
  currentTeacherId?: string | null;
};

type TeacherOption = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  photoUrl: string | null;
};

export function QuickAssignTeacherModal({
  open,
  onOpenChange,
  classId,
  className,
  subject,
  currentTeacherId,
}: QuickAssignTeacherModalProps) {
  const [search, setSearch] = React.useState("");
  const [selectedTeacherId, setSelectedTeacherId] = React.useState<string | null>(
    currentTeacherId || null
  );

  const queryClient = useQueryClient();
  const busy = useBusyToast();
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const debouncedSearch = useDebouncedValue(search, 300);

  // Reset when modal opens
  React.useEffect(() => {
    if (open) {
      setSearch("");
      setSelectedTeacherId(currentTeacherId || null);
      // Focus search input after a short delay
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [open, currentTeacherId]);

  // Fetch teachers
  const { data: teachersData, isLoading } = useQuery<{
    success: boolean;
    data: TeacherOption[];
  }>({
    queryKey: ["teachers-for-quick-assignment", debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("q", debouncedSearch);
      params.set("limit", "20");

      const res = await fetch(`/api/admin/teachers/search?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch teachers");
      return res.json();
    },
    enabled: open,
    staleTime: 30_000,
  });

  const teachers = teachersData?.data || [];

  // Assignment mutation
  const assignMutation = useMutation({
    mutationFn: async (teacherId: string) => {
      const res = await fetch("/api/admin/subjects/assign-teacher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId,
          subjectId: subject.id,
          subjectOfferingId: subject.subjectOfferingId || undefined,
          classGroupId: classId,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Assignment failed");
      }
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["class-subject-teachers", classId],
      });
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
    },
  });

  const handleAssign = async () => {
    if (!selectedTeacherId) return;

    try {
      await busy.promise(assignMutation.mutateAsync(selectedTeacherId), {
        loading: "Assigning teacher...",
        success: "Teacher assigned successfully!",
        error: (e: Error) => e.message || "Failed to assign teacher",
      });
      onOpenChange(false);
    } catch {
      // Error handled by busy toast
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase() || "?";
  };

  const selectedTeacher = teachers.find((t) => t.id === selectedTeacherId);

  // ESC close
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onOpenChange(false);
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-70 bg-black/60 backdrop-blur-sm"
          onClick={() => onOpenChange(false)}
        >
          {/* Desktop dialog */}
          <div
            className="hidden sm:grid h-full place-items-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
              className="w-full max-w-lg max-h-[90vh] rounded-2xl border border-white/10 bg-card/95 shadow-2xl flex flex-col"
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/20">
                    <UserPlus className="h-5 w-5 text-brand" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold">Assign Teacher</div>
                    <div className="text-xs text-muted">{className}</div>
                  </div>
                </div>
                <button
                  onClick={() => onOpenChange(false)}
                  className="text-white/60 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto flex-1 min-h-0 space-y-6">
                {/* Subject Info */}
                <div className="rounded-xl border-2 border-brand/30 bg-brand/10 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/20">
                      <BookOpen className="h-5 w-5 text-brand" />
                    </div>
                    <div>
                      <p className="font-medium text-brand">{subject.name}</p>
                      {subject.code && (
                        <p className="text-xs text-brand/70">{subject.code}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Search */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                    Select Teacher
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search teachers by name..."
                      className="h-10 w-full rounded-lg border border-white/10 bg-white/5 pl-10 pr-10 text-sm text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
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
                </div>

                {/* Teacher list */}
                <div className="space-y-2">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-brand" />
                    </div>
                  ) : teachers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 border border-white/10 bg-white/5 rounded-lg">
                      <UserCheck className="h-8 w-8 text-white/30" />
                      <p className="mt-2 text-sm text-white/50">
                        {search ? "No teachers found" : "Start typing to search teachers"}
                      </p>
                    </div>
                  ) : (
                    <div className="max-h-[300px] space-y-2 overflow-y-auto rounded-lg border border-white/10 bg-white/5 p-3">
                      {teachers.map((teacher) => {
                        const isSelected = selectedTeacherId === teacher.id;

                        return (
                          <motion.button
                            key={teacher.id}
                            type="button"
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            onClick={() => setSelectedTeacherId(teacher.id)}
                            className={cn(
                              "relative flex w-full items-center gap-3 rounded-lg border-2 p-3 text-left transition-all",
                              isSelected
                                ? "border-brand bg-brand/20 shadow-lg shadow-brand/20"
                                : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                            )}
                          >
                            {isSelected && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-brand text-black flex items-center justify-center"
                              >
                                <Check className="h-4 w-4" />
                              </motion.div>
                            )}
                            <Avatar className="h-12 w-12 border-2 border-white/20">
                              {teacher.photoUrl?.trim() ? (
                                <AvatarImage src={teacher.photoUrl} alt={teacher.fullName} />
                              ) : null}
                              <AvatarFallback className="bg-linear-to-br from-brand/60 to-brand/40 text-sm font-semibold text-white">
                                {getInitials(teacher.firstName, teacher.lastName)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className={cn(
                                "font-medium truncate",
                                isSelected ? "text-brand" : "text-white"
                              )}>
                                {teacher.fullName}
                              </p>
                              {teacher.email && (
                                <p className="text-xs text-muted truncate">
                                  {teacher.email}
                                </p>
                              )}
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Selected teacher summary */}
                {selectedTeacher && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 border border-emerald-500/30">
                        {selectedTeacher.photoUrl?.trim() ? (
                          <AvatarImage
                            src={selectedTeacher.photoUrl}
                            alt={selectedTeacher.fullName}
                          />
                        ) : null}
                        <AvatarFallback className="bg-emerald-500/20 text-xs font-semibold text-emerald-300">
                          {getInitials(selectedTeacher.firstName, selectedTeacher.lastName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-emerald-200">
                          {selectedTeacher.fullName}
                        </p>
                        <p className="text-xs text-emerald-300/70">
                          Will teach {subject.name}
                        </p>
                      </div>
                      <Check className="h-5 w-5 text-emerald-400" />
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={assignMutation.isPending}
                  className="gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10"
                >
                  Cancel
                </Button>

                <Button
                  type="button"
                  onClick={handleAssign}
                  disabled={!selectedTeacherId || assignMutation.isPending}
                  className="gap-2 bg-brand text-black hover:opacity-90"
                >
                  {assignMutation.isPending ? (
                    "Assigning…"
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Assign Teacher
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </div>

          {/* Mobile bottom sheet */}
          <div
            className="sm:hidden fixed inset-x-0 bottom-0"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 250, damping: 28 }}
              className="rounded-t-2xl border border-white/10 bg-card/95 shadow-2xl max-h-[90vh] flex flex-col"
            >
              {/* Mobile drag handle */}
              <div className="py-2 shrink-0">
                <div className="mx-auto h-1.5 w-12 rounded-full bg-white/20" />
              </div>

              {/* Mobile Header */}
              <div className="px-5 pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/20">
                    <UserPlus className="h-4 w-4 text-brand" />
                  </div>
                  <div>
                    <div className="text-base font-semibold">Assign Teacher</div>
                    <div className="text-xs text-muted">{subject.name}</div>
                  </div>
                </div>
              </div>

              {/* Mobile Content */}
              <div className="px-5 py-4 overflow-y-auto flex-1 min-h-0 space-y-4">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search teachers..."
                    className="h-9 w-full rounded-lg border border-white/10 bg-white/5 pl-10 pr-4 text-sm text-white placeholder:text-muted focus:border-brand"
                  />
                </div>

                {/* Teacher list */}
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-brand" />
                  </div>
                ) : teachers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 border border-white/10 bg-white/5 rounded-lg">
                    <UserCheck className="h-6 w-6 text-white/30" />
                    <p className="mt-1 text-xs text-white/50">
                      {search ? "No teachers found" : "Type to search"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {teachers.map((teacher) => {
                      const isSelected = selectedTeacherId === teacher.id;

                      return (
                        <button
                          key={teacher.id}
                          type="button"
                          onClick={() => setSelectedTeacherId(teacher.id)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all",
                            isSelected
                              ? "border-brand bg-brand/20"
                              : "border-white/10 bg-white/5"
                          )}
                        >
                          <Avatar className="h-10 w-10 border border-white/20">
                            {teacher.photoUrl?.trim() ? (
                              <AvatarImage src={teacher.photoUrl} alt={teacher.fullName} />
                            ) : null}
                            <AvatarFallback className="bg-brand/40 text-xs font-semibold text-white">
                              {getInitials(teacher.firstName, teacher.lastName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              "text-sm font-medium truncate",
                              isSelected ? "text-brand" : "text-white"
                            )}>
                              {teacher.fullName}
                            </p>
                            {teacher.email && (
                              <p className="text-xs text-muted truncate">{teacher.email}</p>
                            )}
                          </div>
                          {isSelected && <Check className="h-4 w-4 text-brand" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Mobile Footer */}
              <div className="flex items-center justify-between px-5 py-4 border-t border-white/10 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  disabled={assignMutation.isPending}
                  className="gap-1 border-white/10 bg-white/5 text-white text-xs"
                >
                  Cancel
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={handleAssign}
                  disabled={!selectedTeacherId || assignMutation.isPending}
                  className="gap-1 bg-brand text-black text-xs"
                >
                  {assignMutation.isPending ? (
                    "Assigning…"
                  ) : (
                    <>
                      <Check className="h-3 w-3" />
                      Assign
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
