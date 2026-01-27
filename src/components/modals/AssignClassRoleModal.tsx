// src/components/modals/AssignClassRoleModal.tsx
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Crown,
  Check,
  Loader2,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Users,
  Heart,
  Star,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useBusyToast } from "@/hooks/useBusyToast";
import { motion, AnimatePresence } from "framer-motion";
import {
  useClassRoleDefinitions,
  useAssignClassRole,
  getRoleCategoryInfo,
  type ClassRoleCategory,
  type ClassRoleDefinitionDTO,
} from "@/hooks/admin/useClassRoles";

type AssignClassRoleModalProps = {
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
  photoUrl: string | null;
  admissionNo: string | null;
};

const CATEGORY_ICONS: Record<ClassRoleCategory, React.ElementType> = {
  leadership: Crown,
  academic: BookOpen,
  service: Users,
  social: Heart,
  custom: Star,
};

export function AssignClassRoleModal({
  open,
  onOpenChange,
  classId,
  className,
}: AssignClassRoleModalProps) {
  const [step, setStep] = React.useState(1);
  const [selectedRoleId, setSelectedRoleId] = React.useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");

  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const busy = useBusyToast();

  const debouncedSearch = useDebouncedValue(search, 300);

  // Fetch role definitions
  const { data: rolesData, isLoading: loadingRoles } = useClassRoleDefinitions(true);
  const roles = rolesData?.data || [];
  const groupedRoles = rolesData?.grouped;

  // Fetch students in this class
  const { data: studentsData, isLoading: loadingStudents } = useQuery<{
    success: boolean;
    data: StudentOption[];
  }>({
    queryKey: ["class-students-for-role", classId, debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("classGroupId", classId);
      if (debouncedSearch) params.set("q", debouncedSearch);
      params.set("limit", "50");

      const res = await fetch(`/api/admin/students?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch students");
      const data = await res.json();
      // Map to expected format
      return {
        success: true,
        data: (data.data || []).map((s: any) => ({
          id: s.id,
          firstName: s.firstName,
          lastName: s.lastName,
          fullName: `${s.firstName} ${s.lastName}`.trim(),
          photoUrl: s.photoUrl || null,
          admissionNo: s.admissionNo || null,
        })),
      };
    },
    enabled: open && step === 2,
    staleTime: 30_000,
  });

  const students = studentsData?.data || [];

  // Assign role mutation
  const assignRole = useAssignClassRole(classId);

  // Reset when modal opens
  React.useEffect(() => {
    if (open) {
      setStep(1);
      setSelectedRoleId(null);
      setSelectedStudentId(null);
      setSearch("");
    }
  }, [open]);

  // Focus search input on step 2
  React.useEffect(() => {
    if (step === 2) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [step]);

  const selectedRole = roles.find((r) => r.id === selectedRoleId);
  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  const handleNext = () => {
    if (step === 1 && selectedRoleId) {
      setStep(2);
    }
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
      setSelectedStudentId(null);
      setSearch("");
    }
  };

  const handleConfirm = async () => {
    if (!selectedRoleId || !selectedStudentId) return;

    try {
      await busy.promise(
        assignRole.mutateAsync({
          studentId: selectedStudentId,
          roleDefinitionId: selectedRoleId,
        }),
        {
          loading: "Assigning role...",
          success: "Role assigned successfully!",
          error: (e: Error) => e.message || "Failed to assign role",
        }
      );
      onOpenChange(false);
    } catch {
      // Error handled by toast
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase() || "?";
  };

  // ESC close
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onOpenChange(false);
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const canProceedToStep2 = !!selectedRoleId;

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
              className="w-full max-w-2xl max-h-[90vh] rounded-2xl border border-white/10 bg-card/95 shadow-2xl flex flex-col"
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20">
                    <Crown className="h-5 w-5 text-amber-400" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold">Assign Student Role</div>
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
              <div className="p-6 overflow-y-auto flex-1 min-h-0">
                {/* Step Indicator */}
                <div className="flex items-center justify-between pb-6">
                  <div className="text-sm text-white/70">
                    Step <span className="font-semibold">{step}</span> of 2
                  </div>
                  <div className="flex gap-1">
                    {[1, 2].map((s) => (
                      <span
                        key={s}
                        className={`h-1.5 w-8 rounded-full transition-all ${
                          s <= step ? "bg-amber-500" : "bg-white/20"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Content */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-6"
                  >
                    {/* Step 1: Select Role */}
                    {step === 1 && (
                      <section className="space-y-4">
                        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                          Select Role
                        </h2>

                        {loadingRoles ? (
                          <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
                          </div>
                        ) : (
                          <div className="space-y-6">
                            {(["leadership", "academic", "service", "social", "custom"] as ClassRoleCategory[]).map(
                              (category) => {
                                const categoryRoles = groupedRoles?.[category] || [];
                                if (categoryRoles.length === 0) return null;

                                const categoryInfo = getRoleCategoryInfo(category);
                                const CategoryIcon = CATEGORY_ICONS[category];

                                return (
                                  <div key={category}>
                                    <div className="flex items-center gap-2 mb-3">
                                      <CategoryIcon className={cn("h-4 w-4", categoryInfo.color)} />
                                      <span className={cn("text-sm font-medium", categoryInfo.color)}>
                                        {categoryInfo.label}
                                      </span>
                                    </div>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                      {categoryRoles.map((role) => {
                                        const isSelected = selectedRoleId === role.id;
                                        return (
                                          <motion.button
                                            key={role.id}
                                            type="button"
                                            whileHover={{ scale: 1.01 }}
                                            whileTap={{ scale: 0.99 }}
                                            onClick={() => setSelectedRoleId(role.id)}
                                            className={cn(
                                              "relative flex items-start gap-3 rounded-xl border-2 p-3 text-left transition-all",
                                              isSelected
                                                ? `${categoryInfo.borderColor} ${categoryInfo.bgColor}`
                                                : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                                            )}
                                          >
                                            {isSelected && (
                                              <motion.div
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-amber-500 text-black flex items-center justify-center"
                                              >
                                                <Check className="h-3 w-3" />
                                              </motion.div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                              <p className={cn(
                                                "font-medium",
                                                isSelected ? categoryInfo.color : "text-white"
                                              )}>
                                                {role.name}
                                              </p>
                                              {role.description && (
                                                <p className="mt-1 text-xs text-white/50 line-clamp-2">
                                                  {role.description}
                                                </p>
                                              )}
                                              {role.maxPerClass && (
                                                <Badge
                                                  variant="outline"
                                                  className="mt-2 text-[10px] border-white/20 bg-white/5"
                                                >
                                                  Max {role.maxPerClass} per class
                                                </Badge>
                                              )}
                                            </div>
                                          </motion.button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              }
                            )}
                          </div>
                        )}
                      </section>
                    )}

                    {/* Step 2: Select Student */}
                    {step === 2 && (
                      <section className="space-y-4">
                        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                          Select Student for {selectedRole?.name}
                        </h2>

                        {/* Search */}
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                          <input
                            ref={searchInputRef}
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search students by name..."
                            className="h-10 w-full rounded-lg border border-white/10 bg-white/5 pl-10 pr-10 text-sm text-white placeholder:text-muted focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
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
                        {loadingStudents ? (
                          <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
                          </div>
                        ) : students.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-12 border border-white/10 bg-white/5 rounded-lg">
                            <Users className="h-8 w-8 text-white/30" />
                            <p className="mt-2 text-sm text-white/50">
                              {search ? "No students found" : "No students in this class"}
                            </p>
                          </div>
                        ) : (
                          <div className="max-h-[300px] space-y-2 overflow-y-auto rounded-lg border border-white/10 bg-white/5 p-3">
                            {students.map((student) => {
                              const isSelected = selectedStudentId === student.id;

                              return (
                                <motion.button
                                  key={student.id}
                                  type="button"
                                  whileHover={{ scale: 1.01 }}
                                  whileTap={{ scale: 0.99 }}
                                  onClick={() => setSelectedStudentId(student.id)}
                                  className={cn(
                                    "relative flex w-full items-center gap-3 rounded-lg border-2 p-3 text-left transition-all",
                                    isSelected
                                      ? "border-amber-500 bg-amber-500/20 shadow-lg shadow-amber-500/20"
                                      : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                                  )}
                                >
                                  {isSelected && (
                                    <motion.div
                                      initial={{ scale: 0 }}
                                      animate={{ scale: 1 }}
                                      className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-amber-500 text-black flex items-center justify-center"
                                    >
                                      <Check className="h-3 w-3" />
                                    </motion.div>
                                  )}
                                  <Avatar className="h-10 w-10 border-2 border-white/20">
                                    <AvatarImage
                                      src={student.photoUrl || ""}
                                      alt={student.fullName}
                                    />
                                    <AvatarFallback className="bg-amber-500/30 text-xs font-semibold text-white">
                                      {getInitials(student.firstName, student.lastName)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <p className={cn(
                                      "font-medium truncate",
                                      isSelected ? "text-amber-300" : "text-white"
                                    )}>
                                      {student.fullName}
                                    </p>
                                    {student.admissionNo && (
                                      <p className="text-xs text-muted truncate">
                                        {student.admissionNo}
                                      </p>
                                    )}
                                  </div>
                                </motion.button>
                              );
                            })}
                          </div>
                        )}

                        {/* Selected summary */}
                        {selectedStudent && selectedRole && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3"
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8 border border-emerald-500/30">
                                <AvatarImage
                                  src={selectedStudent.photoUrl || ""}
                                  alt={selectedStudent.fullName}
                                />
                                <AvatarFallback className="bg-emerald-500/20 text-xs font-semibold text-emerald-300">
                                  {getInitials(selectedStudent.firstName, selectedStudent.lastName)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-emerald-200">
                                  {selectedStudent.fullName}
                                </p>
                                <p className="text-xs text-emerald-300/70">
                                  Will be assigned as {selectedRole.name}
                                </p>
                              </div>
                              <Check className="h-5 w-5 text-emerald-400" />
                            </div>
                          </motion.div>
                        )}
                      </section>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={step === 1 ? () => onOpenChange(false) : handleBack}
                  className="gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10"
                >
                  <ChevronLeft className="h-4 w-4" />
                  {step === 1 ? "Cancel" : "Back"}
                </Button>

                <div className="flex gap-2">
                  {step < 2 ? (
                    <Button
                      type="button"
                      onClick={handleNext}
                      disabled={!canProceedToStep2}
                      className="gap-2 bg-amber-500 text-black hover:bg-amber-600 disabled:opacity-50"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={handleConfirm}
                      disabled={!selectedStudentId || assignRole.isPending}
                      className="gap-2 bg-amber-500 text-black hover:bg-amber-600 disabled:opacity-50"
                    >
                      {assignRole.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Assigning...
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4" />
                          Assign Role
                        </>
                      )}
                    </Button>
                  )}
                </div>
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
              <div className="py-2 shrink-0">
                <div className="mx-auto h-1.5 w-12 rounded-full bg-white/20" />
              </div>
              <div className="px-5 pb-4 overflow-y-auto flex-1 min-h-0">
                <div className="flex items-center gap-3 mb-4">
                  <Crown className="h-5 w-5 text-amber-400" />
                  <div className="text-base font-semibold">Assign Role</div>
                </div>

                {/* Step Indicator */}
                <div className="flex items-center justify-between pb-4">
                  <div className="text-sm text-white/70">
                    Step <span className="font-semibold">{step}</span> of 2
                  </div>
                  <div className="flex gap-1">
                    {[1, 2].map((s) => (
                      <span
                        key={s}
                        className={`h-1.5 w-6 rounded-full transition-all ${
                          s <= step ? "bg-amber-500" : "bg-white/20"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Mobile content - simplified */}
                {step === 1 && (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {roles.map((role) => {
                      const isSelected = selectedRoleId === role.id;
                      const categoryInfo = getRoleCategoryInfo(role.category);
                      return (
                        <button
                          key={role.id}
                          type="button"
                          onClick={() => setSelectedRoleId(role.id)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all",
                            isSelected
                              ? `${categoryInfo.borderColor} ${categoryInfo.bgColor}`
                              : "border-white/10 bg-white/5"
                          )}
                        >
                          <div className="flex-1">
                            <p className={cn("text-sm font-medium", isSelected ? categoryInfo.color : "text-white")}>
                              {role.name}
                            </p>
                            <Badge variant="outline" className="mt-1 text-[10px] border-white/20">
                              {categoryInfo.label}
                            </Badge>
                          </div>
                          {isSelected && <Check className="h-4 w-4 text-amber-400" />}
                        </button>
                      );
                    })}
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search students..."
                      className="h-9 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-muted"
                    />
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {students.map((student) => {
                        const isSelected = selectedStudentId === student.id;
                        return (
                          <button
                            key={student.id}
                            type="button"
                            onClick={() => setSelectedStudentId(student.id)}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-lg border p-3 text-left",
                              isSelected ? "border-amber-500 bg-amber-500/20" : "border-white/10 bg-white/5"
                            )}
                          >
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={student.photoUrl || ""} alt={student.fullName} />
                              <AvatarFallback className="bg-amber-500/30 text-xs">
                                {getInitials(student.firstName, student.lastName)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className={cn("text-sm font-medium truncate", isSelected ? "text-amber-300" : "text-white")}>
                                {student.fullName}
                              </p>
                            </div>
                            {isSelected && <Check className="h-4 w-4 text-amber-400" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Mobile Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-white/10 mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={step === 1 ? () => onOpenChange(false) : handleBack}
                    className="gap-1 border-white/10 bg-white/5 text-white text-xs"
                  >
                    <ChevronLeft className="h-3 w-3" />
                    {step === 1 ? "Cancel" : "Back"}
                  </Button>

                  {step < 2 ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleNext}
                      disabled={!canProceedToStep2}
                      className="gap-1 bg-amber-500 text-black text-xs"
                    >
                      Next
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleConfirm}
                      disabled={!selectedStudentId || assignRole.isPending}
                      className="gap-1 bg-amber-500 text-black text-xs"
                    >
                      {assignRole.isPending ? "Assigning..." : "Assign"}
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
