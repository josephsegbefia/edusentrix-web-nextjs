"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Crown,
  Loader2,
  Check,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  useAssignSchoolRole,
  type SchoolRoleDefinitionDTO,
} from "@/hooks/admin/useSchoolRoles";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

interface AssignSchoolRoleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedRole?: SchoolRoleDefinitionDTO | null;
  roles: SchoolRoleDefinitionDTO[];
}

interface StudentResult {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  photoUrl: string | null;
  admissionNo: string | null;
  className: string | null;
}

export function AssignSchoolRoleModal({
  open,
  onOpenChange,
  preselectedRole,
  roles,
}: AssignSchoolRoleModalProps) {
  const [step, setStep] = useState(1);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [studentQuery, setStudentQuery] = useState("");
  const [notes, setNotes] = useState("");

  const assignMutation = useAssignSchoolRole();

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep(preselectedRole ? 2 : 1);
      setSelectedRoleId(preselectedRole?.id || null);
      setSelectedStudentId(null);
      setStudentQuery("");
      setNotes("");
    }
  }, [open, preselectedRole]);

  // Search students
  const { data: studentsData, isLoading: isLoadingStudents } = useQuery({
    queryKey: ["students-search-role", studentQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (studentQuery) params.set("search", studentQuery);
      params.set("limit", "20");
      const res = await fetch(`/api/admin/students?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to search students");
      return res.json();
    },
    enabled: open && step === 2,
    staleTime: 30_000,
  });

  const students: StudentResult[] = useMemo(() => {
    return (studentsData?.data || []).map((s: any) => ({
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      fullName: `${s.firstName} ${s.lastName}`.trim(),
      photoUrl: s.photoUrl || null,
      admissionNo: s.admissionNo || null,
      className: s.className || null,
    }));
  }, [studentsData]);

  const selectedRole = roles.find((r) => r.id === selectedRoleId);
  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
  };

  const handleNext = () => {
    if (step === 1 && selectedRoleId) {
      setStep(2);
    } else if (step === 2 && selectedStudentId) {
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step === 2 && !preselectedRole) {
      setStep(1);
    } else if (step === 3) {
      setStep(2);
    }
  };

  const handleConfirm = async () => {
    if (!selectedRoleId || !selectedStudentId) return;

    try {
      await assignMutation.mutateAsync({
        studentId: selectedStudentId,
        roleDefinitionId: selectedRoleId,
        notes: notes || undefined,
      });
      toast.success(`${selectedRole?.name} role assigned successfully`);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to assign role");
    }
  };

  const canProceed = step === 1 ? !!selectedRoleId : step === 2 ? !!selectedStudentId : true;

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
              <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-brand" />
                  <span className="text-base font-semibold">Assign School Role</span>
                </div>
                <button
                  onClick={() => onOpenChange(false)}
                  className="text-white/60 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Step Indicator */}
              <div className="px-5 pt-4 flex items-center justify-between">
                <div className="text-sm text-white/70">
                  Step <span className="font-semibold">{step}</span> of 3
                </div>
                <div className="flex gap-1">
                  {[1, 2, 3].map((s) => (
                    <span
                      key={s}
                      className={cn(
                        "h-1.5 w-8 rounded-full transition-all",
                        s <= step ? "bg-brand" : "bg-white/20"
                      )}
                    />
                  ))}
                </div>
              </div>

              {/* Content */}
              <div className="p-5 overflow-y-auto flex-1 min-h-0">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    {/* Step 1: Select Role */}
                    {step === 1 && (
                      <section className="space-y-4">
                        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                          Select Role
                        </h2>
                        <div className="grid gap-2 max-h-[50vh] overflow-y-auto pr-1">
                          {roles.map((role) => (
                            <motion.label
                              key={role.id}
                              htmlFor={`role-${role.id}`}
                              className={cn(
                                "relative flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all",
                                selectedRoleId === role.id
                                  ? "border-brand bg-brand/10"
                                  : "border-white/10 bg-white/5 hover:border-white/20"
                              )}
                              whileHover={{ scale: 1.01 }}
                              whileTap={{ scale: 0.99 }}
                            >
                              <input
                                type="radio"
                                id={`role-${role.id}`}
                                name="roleId"
                                value={role.id}
                                checked={selectedRoleId === role.id}
                                onChange={() => setSelectedRoleId(role.id)}
                                className="sr-only"
                              />
                              <div
                                className="h-8 w-8 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: `${role.badgeColor}30` }}
                              >
                                <Crown
                                  className="h-4 w-4"
                                  style={{ color: role.badgeColor || "#fff" }}
                                />
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-white">{role.name}</p>
                                <p className="text-xs text-white/50 capitalize">{role.category}</p>
                              </div>
                              {selectedRoleId === role.id && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-black"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </motion.div>
                              )}
                            </motion.label>
                          ))}
                        </div>
                      </section>
                    )}

                    {/* Step 2: Select Student */}
                    {step === 2 && (
                      <section className="space-y-4">
                        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                          Select Student for {selectedRole?.name}
                        </h2>

                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                          <input
                            type="text"
                            placeholder="Search students..."
                            value={studentQuery}
                            onChange={(e) => setStudentQuery(e.target.value)}
                            className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/40 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                          />
                        </div>

                        {isLoadingStudents ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-brand" />
                          </div>
                        ) : students.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-8">
                            <AlertCircle className="h-6 w-6 text-white/30" />
                            <p className="mt-2 text-sm text-white/50">No students found</p>
                          </div>
                        ) : (
                          <div className="grid gap-2 max-h-[40vh] overflow-y-auto pr-1">
                            {students.map((student) => (
                              <motion.label
                                key={student.id}
                                htmlFor={`student-${student.id}`}
                                className={cn(
                                  "relative flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all",
                                  selectedStudentId === student.id
                                    ? "border-brand bg-brand/10"
                                    : "border-white/10 bg-white/5 hover:border-white/20"
                                )}
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.99 }}
                              >
                                <input
                                  type="radio"
                                  id={`student-${student.id}`}
                                  name="studentId"
                                  value={student.id}
                                  checked={selectedStudentId === student.id}
                                  onChange={() => setSelectedStudentId(student.id)}
                                  className="sr-only"
                                />
                                <Avatar className="h-10 w-10 border-2 border-white/20">
                                  <AvatarImage src={student.photoUrl || ""} alt={student.fullName} />
                                  <AvatarFallback className="bg-gradient-to-br from-brand to-brand/60 text-sm font-semibold text-black">
                                    {getInitials(student.firstName, student.lastName)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <p className="truncate text-sm font-medium text-white">
                                    {student.fullName}
                                  </p>
                                  <p className="truncate text-xs text-white/50">
                                    {student.className || "No class"} • {student.admissionNo || "No ID"}
                                  </p>
                                </div>
                                {selectedStudentId === student.id && (
                                  <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-black"
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                  </motion.div>
                                )}
                              </motion.label>
                            ))}
                          </div>
                        )}
                      </section>
                    )}

                    {/* Step 3: Review & Confirm */}
                    {step === 3 && (
                      <section className="space-y-4">
                        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                          Review Assignment
                        </h2>

                        <div className="rounded-xl border border-brand/20 bg-brand/10 p-4">
                          <div className="flex items-center gap-4">
                            <Avatar className="h-14 w-14 border-2 border-white/20">
                              <AvatarImage
                                src={selectedStudent?.photoUrl || ""}
                                alt={selectedStudent?.fullName || ""}
                              />
                              <AvatarFallback className="bg-gradient-to-br from-brand to-brand/60 text-lg font-semibold text-black">
                                {getInitials(
                                  selectedStudent?.firstName || "",
                                  selectedStudent?.lastName || ""
                                )}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-lg font-semibold text-white">
                                {selectedStudent?.fullName}
                              </p>
                              <p className="text-sm text-white/60">
                                {selectedStudent?.className}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 flex items-center gap-2">
                            <span className="text-sm text-white/60">Will be assigned as:</span>
                            <span
                              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium"
                              style={{
                                backgroundColor: `${selectedRole?.badgeColor}20`,
                                color: selectedRole?.badgeColor || "#fff",
                              }}
                            >
                              <Crown className="h-3.5 w-3.5" />
                              {selectedRole?.name}
                            </span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-muted mb-2">
                            Notes (Optional)
                          </label>
                          <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Add any notes about this assignment..."
                            rows={3}
                            className="w-full rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white placeholder:text-white/40 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand resize-none"
                          />
                        </div>
                      </section>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-white/10 p-5 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={step === 1 || (step === 2 && preselectedRole) ? () => onOpenChange(false) : handleBack}
                  className="gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10"
                >
                  <ChevronLeft className="h-4 w-4" />
                  {step === 1 || (step === 2 && preselectedRole) ? "Cancel" : "Back"}
                </Button>

                {step < 3 ? (
                  <Button
                    type="button"
                    onClick={handleNext}
                    disabled={!canProceed}
                    className="gap-2 bg-brand text-black hover:opacity-90 disabled:opacity-50"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handleConfirm}
                    disabled={assignMutation.isPending}
                    className="gap-2 bg-brand text-black hover:opacity-90 disabled:opacity-50"
                  >
                    {assignMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Assigning...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        Confirm Assignment
                      </>
                    )}
                  </Button>
                )}
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
                <div className="flex items-center gap-2 mb-4">
                  <Crown className="h-5 w-5 text-brand" />
                  <span className="text-base font-semibold">Assign School Role</span>
                </div>

                {/* Step Indicator */}
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm text-white/70">
                    Step <span className="font-semibold">{step}</span> of 3
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3].map((s) => (
                      <span
                        key={s}
                        className={cn(
                          "h-1.5 w-8 rounded-full transition-all",
                          s <= step ? "bg-brand" : "bg-white/20"
                        )}
                      />
                    ))}
                  </div>
                </div>

                {/* Content - same as desktop */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    {step === 1 && (
                      <section className="space-y-4">
                        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                          Select Role
                        </h2>
                        <div className="grid gap-2 max-h-[40vh] overflow-y-auto">
                          {roles.map((role) => (
                            <label
                              key={role.id}
                              className={cn(
                                "relative flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all",
                                selectedRoleId === role.id
                                  ? "border-brand bg-brand/10"
                                  : "border-white/10 bg-white/5"
                              )}
                            >
                              <input
                                type="radio"
                                name="roleId"
                                value={role.id}
                                checked={selectedRoleId === role.id}
                                onChange={() => setSelectedRoleId(role.id)}
                                className="sr-only"
                              />
                              <div
                                className="h-8 w-8 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: `${role.badgeColor}30` }}
                              >
                                <Crown
                                  className="h-4 w-4"
                                  style={{ color: role.badgeColor || "#fff" }}
                                />
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-white">{role.name}</p>
                                <p className="text-xs text-white/50 capitalize">{role.category}</p>
                              </div>
                              {selectedRoleId === role.id && (
                                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-black">
                                  <Check className="h-3.5 w-3.5" />
                                </div>
                              )}
                            </label>
                          ))}
                        </div>
                      </section>
                    )}

                    {step === 2 && (
                      <section className="space-y-4">
                        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                          Select Student
                        </h2>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                          <input
                            type="text"
                            placeholder="Search students..."
                            value={studentQuery}
                            onChange={(e) => setStudentQuery(e.target.value)}
                            className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/40 focus:border-brand focus:outline-none"
                          />
                        </div>
                        {isLoadingStudents ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-brand" />
                          </div>
                        ) : (
                          <div className="grid gap-2 max-h-[35vh] overflow-y-auto">
                            {students.map((student) => (
                              <label
                                key={student.id}
                                className={cn(
                                  "relative flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all",
                                  selectedStudentId === student.id
                                    ? "border-brand bg-brand/10"
                                    : "border-white/10 bg-white/5"
                                )}
                              >
                                <input
                                  type="radio"
                                  name="studentId"
                                  value={student.id}
                                  checked={selectedStudentId === student.id}
                                  onChange={() => setSelectedStudentId(student.id)}
                                  className="sr-only"
                                />
                                <Avatar className="h-10 w-10 border-2 border-white/20">
                                  <AvatarImage src={student.photoUrl || ""} alt={student.fullName} />
                                  <AvatarFallback className="bg-gradient-to-br from-brand to-brand/60 text-sm font-semibold text-black">
                                    {getInitials(student.firstName, student.lastName)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <p className="truncate text-sm font-medium text-white">
                                    {student.fullName}
                                  </p>
                                  <p className="truncate text-xs text-white/50">
                                    {student.className || "No class"}
                                  </p>
                                </div>
                                {selectedStudentId === student.id && (
                                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-black">
                                    <Check className="h-3.5 w-3.5" />
                                  </div>
                                )}
                              </label>
                            ))}
                          </div>
                        )}
                      </section>
                    )}

                    {step === 3 && (
                      <section className="space-y-4">
                        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                          Review
                        </h2>
                        <div className="rounded-xl border border-brand/20 bg-brand/10 p-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-12 w-12 border-2 border-white/20">
                              <AvatarImage
                                src={selectedStudent?.photoUrl || ""}
                                alt={selectedStudent?.fullName || ""}
                              />
                              <AvatarFallback className="bg-gradient-to-br from-brand to-brand/60 font-semibold text-black">
                                {getInitials(
                                  selectedStudent?.firstName || "",
                                  selectedStudent?.lastName || ""
                                )}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-semibold text-white">
                                {selectedStudent?.fullName}
                              </p>
                              <p className="text-xs text-white/60">
                                {selectedStudent?.className}
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            <span className="text-xs text-white/60">Role:</span>
                            <span
                              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                              style={{
                                backgroundColor: `${selectedRole?.badgeColor}20`,
                                color: selectedRole?.badgeColor || "#fff",
                              }}
                            >
                              <Crown className="h-3 w-3" />
                              {selectedRole?.name}
                            </span>
                          </div>
                        </div>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Notes (optional)..."
                          rows={2}
                          className="w-full rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white placeholder:text-white/40 focus:border-brand focus:outline-none resize-none"
                        />
                      </section>
                    )}
                  </motion.div>
                </AnimatePresence>

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 mt-4 border-t border-white/10">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={step === 1 || (step === 2 && preselectedRole) ? () => onOpenChange(false) : handleBack}
                    className="gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    {step === 1 || (step === 2 && preselectedRole) ? "Cancel" : "Back"}
                  </Button>

                  {step < 3 ? (
                    <Button
                      type="button"
                      onClick={handleNext}
                      disabled={!canProceed}
                      className="gap-2 bg-brand text-black hover:opacity-90 disabled:opacity-50"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={handleConfirm}
                      disabled={assignMutation.isPending}
                      className="gap-2 bg-brand text-black hover:opacity-90 disabled:opacity-50"
                    >
                      {assignMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Assigning...
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4" />
                          Confirm
                        </>
                      )}
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
