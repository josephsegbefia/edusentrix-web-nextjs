"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Clock,
  Loader2,
  Check,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  X,
  MapPin,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  useAssignTeacherDuty,
  DAY_NAMES,
  type DutyDefinitionDTO,
} from "@/hooks/admin/useTeacherDuties";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";

interface AssignTeacherDutyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedDuty?: DutyDefinitionDTO | null;
  duties: DutyDefinitionDTO[];
}

interface TeacherResult {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  photoUrl: string | null;
  email: string | null;
  department: string | null;
}

export function AssignTeacherDutyModal({
  open,
  onOpenChange,
  preselectedDuty,
  duties,
}: AssignTeacherDutyModalProps) {
  const [step, setStep] = useState(1);
  const [selectedDutyId, setSelectedDutyId] = useState<string | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [teacherQuery, setTeacherQuery] = useState("");
  const [notes, setNotes] = useState("");

  const assignMutation = useAssignTeacherDuty();

  const selectedDuty = duties.find((d) => d.id === selectedDutyId);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep(preselectedDuty ? 2 : 1);
      setSelectedDutyId(preselectedDuty?.id || null);
      setSelectedTeacherId(null);
      setSelectedDays(preselectedDuty?.defaultDays || []);
      setStartTime(preselectedDuty?.defaultStartTime || "");
      setEndTime(preselectedDuty?.defaultEndTime || "");
      setStartDate(new Date());
      setEndDate(null);
      setTeacherQuery("");
      setNotes("");
    }
  }, [open, preselectedDuty]);

  // Update schedule when duty changes
  useEffect(() => {
    if (selectedDuty) {
      setSelectedDays(selectedDuty.defaultDays || []);
      setStartTime(selectedDuty.defaultStartTime || "");
      setEndTime(selectedDuty.defaultEndTime || "");
    }
  }, [selectedDuty]);

  // Search teachers
  const { data: teachersData, isLoading: isLoadingTeachers } = useQuery({
    queryKey: ["teachers-search-duty", teacherQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (teacherQuery) params.set("q", teacherQuery);
      params.set("limit", "20");
      const res = await fetch(`/api/admin/teachers/search?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to search teachers");
      return res.json();
    },
    enabled: open && step === 2,
    staleTime: 30_000,
  });

  const teachers: TeacherResult[] = useMemo(() => {
    return (teachersData?.data || []).map((t: any) => ({
      id: t.id,
      firstName: t.firstName,
      lastName: t.lastName,
      fullName: t.fullName || `${t.firstName} ${t.lastName}`.trim(),
      photoUrl: t.photoUrl || null,
      email: t.email || null,
      department: t.department || null,
    }));
  }, [teachersData]);

  const selectedTeacher = teachers.find((t) => t.id === selectedTeacherId);

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
  };

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const handleNext = () => {
    if (step === 1 && selectedDutyId) {
      setStep(2);
    } else if (step === 2 && selectedTeacherId) {
      setStep(3);
    } else if (step === 3 && selectedDays.length > 0 && startTime && endTime) {
      setStep(4);
    }
  };

  const handleBack = () => {
    if (step === 2 && !preselectedDuty) {
      setStep(1);
    } else if (step === 3) {
      setStep(2);
    } else if (step === 4) {
      setStep(3);
    }
  };

  const handleConfirm = async () => {
    if (!selectedDutyId || !selectedTeacherId || selectedDays.length === 0) return;

    try {
      await assignMutation.mutateAsync({
        teacherId: selectedTeacherId,
        dutyDefinitionId: selectedDutyId,
        days: selectedDays,
        startTime,
        endTime,
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
        notes: notes || undefined,
      });
      toast.success(`${selectedDuty?.name} duty assigned successfully`);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to assign duty");
    }
  };

  const canProceed =
    step === 1
      ? !!selectedDutyId
      : step === 2
      ? !!selectedTeacherId
      : step === 3
      ? selectedDays.length > 0 && !!startTime && !!endTime
      : true;

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
                  <Clock className="h-5 w-5 text-brand" />
                  <span className="text-base font-semibold">Assign Teacher Duty</span>
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
                  Step <span className="font-semibold">{step}</span> of 4
                </div>
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((s) => (
                    <span
                      key={s}
                      className={cn(
                        "h-1.5 w-6 rounded-full transition-all",
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
                    {/* Step 1: Select Duty */}
                    {step === 1 && (
                      <section className="space-y-4">
                        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                          Select Duty
                        </h2>
                        <div className="grid gap-2 max-h-[50vh] overflow-y-auto pr-1">
                          {duties.map((duty) => (
                            <motion.label
                              key={duty.id}
                              htmlFor={`duty-${duty.id}`}
                              className={cn(
                                "relative flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all",
                                selectedDutyId === duty.id
                                  ? "border-brand bg-brand/10"
                                  : "border-white/10 bg-white/5 hover:border-white/20"
                              )}
                              whileHover={{ scale: 1.01 }}
                              whileTap={{ scale: 0.99 }}
                            >
                              <input
                                type="radio"
                                id={`duty-${duty.id}`}
                                name="dutyId"
                                value={duty.id}
                                checked={selectedDutyId === duty.id}
                                onChange={() => setSelectedDutyId(duty.id)}
                                className="sr-only"
                              />
                              <div
                                className="h-8 w-8 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: `${duty.color}30` }}
                              >
                                <Clock
                                  className="h-4 w-4"
                                  style={{ color: duty.color || "#fff" }}
                                />
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-white">{duty.name}</p>
                                <div className="flex items-center gap-2 text-xs text-white/50">
                                  <span className="capitalize">{duty.category}</span>
                                  {duty.location && (
                                    <>
                                      <span>•</span>
                                      <span>{duty.location}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              {selectedDutyId === duty.id && (
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

                    {/* Step 2: Select Teacher */}
                    {step === 2 && (
                      <section className="space-y-4">
                        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                          Select Teacher for {selectedDuty?.name}
                        </h2>

                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                          <input
                            type="text"
                            placeholder="Search teachers..."
                            value={teacherQuery}
                            onChange={(e) => setTeacherQuery(e.target.value)}
                            className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/40 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                          />
                        </div>

                        {isLoadingTeachers ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-brand" />
                          </div>
                        ) : teachers.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-8">
                            <AlertCircle className="h-6 w-6 text-white/30" />
                            <p className="mt-2 text-sm text-white/50">No teachers found</p>
                          </div>
                        ) : (
                          <div className="grid gap-2 max-h-[40vh] overflow-y-auto pr-1">
                            {teachers.map((teacher) => (
                              <motion.label
                                key={teacher.id}
                                htmlFor={`teacher-${teacher.id}`}
                                className={cn(
                                  "relative flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all",
                                  selectedTeacherId === teacher.id
                                    ? "border-brand bg-brand/10"
                                    : "border-white/10 bg-white/5 hover:border-white/20"
                                )}
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.99 }}
                              >
                                <input
                                  type="radio"
                                  id={`teacher-${teacher.id}`}
                                  name="teacherId"
                                  value={teacher.id}
                                  checked={selectedTeacherId === teacher.id}
                                  onChange={() => setSelectedTeacherId(teacher.id)}
                                  className="sr-only"
                                />
                                <Avatar className="h-10 w-10 border-2 border-white/20">
                                  <AvatarImage src={teacher.photoUrl || ""} alt={teacher.fullName} />
                                  <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-semibold text-white">
                                    {getInitials(teacher.firstName, teacher.lastName)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <p className="truncate text-sm font-medium text-white">
                                    {teacher.fullName}
                                  </p>
                                  <p className="truncate text-xs text-white/50">
                                    {teacher.department || teacher.email || "Teacher"}
                                  </p>
                                </div>
                                {selectedTeacherId === teacher.id && (
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

                    {/* Step 3: Schedule */}
                    {step === 3 && (
                      <section className="space-y-4">
                        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                          Set Schedule
                        </h2>

                        <div>
                          <label className="block text-xs font-medium text-white/70 mb-2">
                            Days of the Week
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {DAY_NAMES.map((day, index) => (
                              <button
                                key={day}
                                type="button"
                                onClick={() => toggleDay(index)}
                                className={cn(
                                  "rounded-lg px-3 py-2 text-sm font-medium transition-all",
                                  selectedDays.includes(index)
                                    ? "bg-brand text-black"
                                    : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                                )}
                              >
                                {day}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-white/70 mb-2">
                              Start Time
                            </label>
                            <input
                              type="time"
                              value={startTime}
                              onChange={(e) => setStartTime(e.target.value)}
                              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-white/70 mb-2">
                              End Time
                            </label>
                            <input
                              type="time"
                              value={endTime}
                              onChange={(e) => setEndTime(e.target.value)}
                              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                            />
                          </div>
                        </div>

                        {selectedDuty?.location && (
                          <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm text-white/60">
                            <MapPin className="h-4 w-4" />
                            Location: {selectedDuty.location}
                          </div>
                        )}

                        {/* Date Range */}
                        <div className="grid grid-cols-2 gap-4">
                          <CustomDatePicker
                            value={startDate}
                            onChange={setStartDate}
                            label="Start Date"
                            placeholder="Select start date"
                            minDate={new Date()}
                          />
                          <CustomDatePicker
                            value={endDate}
                            onChange={setEndDate}
                            label="End Date (Optional)"
                            placeholder="Select end date"
                            minDate={startDate || new Date()}
                          />
                        </div>
                      </section>
                    )}

                    {/* Step 4: Review & Confirm */}
                    {step === 4 && (
                      <section className="space-y-4">
                        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                          Review Assignment
                        </h2>

                        <div className="rounded-xl border border-brand/20 bg-brand/10 p-4 space-y-4">
                          <div className="flex items-center gap-4">
                            <Avatar className="h-14 w-14 border-2 border-white/20">
                              <AvatarImage
                                src={selectedTeacher?.photoUrl || ""}
                                alt={selectedTeacher?.fullName || ""}
                              />
                              <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-lg font-semibold text-white">
                                {getInitials(
                                  selectedTeacher?.firstName || "",
                                  selectedTeacher?.lastName || ""
                                )}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-lg font-semibold text-white">
                                {selectedTeacher?.fullName}
                              </p>
                              <p className="text-sm text-white/60">
                                {selectedTeacher?.department || "Teacher"}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-white/50" />
                              <span className="text-sm text-white">
                                {selectedDuty?.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-white/50" />
                              <span className="text-sm text-white">
                                {selectedDays.map((d) => DAY_NAMES[d]).join(", ")}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-white/50" />
                              <span className="text-sm text-white">
                                {startTime} - {endTime}
                              </span>
                            </div>
                            {selectedDuty?.location && (
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-white/50" />
                                <span className="text-sm text-white">
                                  {selectedDuty.location}
                                </span>
                              </div>
                            )}
                            {startDate && (
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-white/50" />
                                <span className="text-sm text-white">
                                  {startDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                  {endDate && ` - ${endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
                                </span>
                              </div>
                            )}
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
                  onClick={step === 1 || (step === 2 && preselectedDuty) ? () => onOpenChange(false) : handleBack}
                  className="gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10"
                >
                  <ChevronLeft className="h-4 w-4" />
                  {step === 1 || (step === 2 && preselectedDuty) ? "Cancel" : "Back"}
                </Button>

                {step < 4 ? (
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
                  <Clock className="h-5 w-5 text-brand" />
                  <span className="text-base font-semibold">Assign Teacher Duty</span>
                </div>

                {/* Step Indicator */}
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm text-white/70">
                    Step <span className="font-semibold">{step}</span> of 4
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((s) => (
                      <span
                        key={s}
                        className={cn(
                          "h-1.5 w-6 rounded-full transition-all",
                          s <= step ? "bg-brand" : "bg-white/20"
                        )}
                      />
                    ))}
                  </div>
                </div>

                {/* Content - simplified for mobile */}
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
                      <section className="space-y-3">
                        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                          Select Duty
                        </h2>
                        <div className="grid gap-2 max-h-[40vh] overflow-y-auto">
                          {duties.map((duty) => (
                            <label
                              key={duty.id}
                              className={cn(
                                "relative flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all",
                                selectedDutyId === duty.id
                                  ? "border-brand bg-brand/10"
                                  : "border-white/10 bg-white/5"
                              )}
                            >
                              <input
                                type="radio"
                                name="dutyId"
                                value={duty.id}
                                checked={selectedDutyId === duty.id}
                                onChange={() => setSelectedDutyId(duty.id)}
                                className="sr-only"
                              />
                              <div
                                className="h-8 w-8 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: `${duty.color}30` }}
                              >
                                <Clock
                                  className="h-4 w-4"
                                  style={{ color: duty.color || "#fff" }}
                                />
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-white">{duty.name}</p>
                                <p className="text-xs text-white/50 capitalize">{duty.category}</p>
                              </div>
                              {selectedDutyId === duty.id && (
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
                      <section className="space-y-3">
                        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                          Select Teacher
                        </h2>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                          <input
                            type="text"
                            placeholder="Search teachers..."
                            value={teacherQuery}
                            onChange={(e) => setTeacherQuery(e.target.value)}
                            className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/40 focus:border-brand focus:outline-none"
                          />
                        </div>
                        {isLoadingTeachers ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-brand" />
                          </div>
                        ) : (
                          <div className="grid gap-2 max-h-[35vh] overflow-y-auto">
                            {teachers.map((teacher) => (
                              <label
                                key={teacher.id}
                                className={cn(
                                  "relative flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all",
                                  selectedTeacherId === teacher.id
                                    ? "border-brand bg-brand/10"
                                    : "border-white/10 bg-white/5"
                                )}
                              >
                                <input
                                  type="radio"
                                  name="teacherId"
                                  value={teacher.id}
                                  checked={selectedTeacherId === teacher.id}
                                  onChange={() => setSelectedTeacherId(teacher.id)}
                                  className="sr-only"
                                />
                                <Avatar className="h-10 w-10 border-2 border-white/20">
                                  <AvatarImage src={teacher.photoUrl || ""} alt={teacher.fullName} />
                                  <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-semibold text-white">
                                    {getInitials(teacher.firstName, teacher.lastName)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <p className="truncate text-sm font-medium text-white">
                                    {teacher.fullName}
                                  </p>
                                  <p className="truncate text-xs text-white/50">
                                    {teacher.department || "Teacher"}
                                  </p>
                                </div>
                                {selectedTeacherId === teacher.id && (
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
                          Schedule
                        </h2>
                        <div>
                          <label className="block text-xs font-medium text-white/70 mb-2">Days</label>
                          <div className="flex flex-wrap gap-2">
                            {DAY_NAMES.map((day, index) => (
                              <button
                                key={day}
                                type="button"
                                onClick={() => toggleDay(index)}
                                className={cn(
                                  "rounded-lg px-3 py-2 text-sm font-medium transition-all",
                                  selectedDays.includes(index)
                                    ? "bg-brand text-black"
                                    : "bg-white/5 text-white/60"
                                )}
                              >
                                {day}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-white/70 mb-2">Start</label>
                            <input
                              type="time"
                              value={startTime}
                              onChange={(e) => setStartTime(e.target.value)}
                              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:border-brand focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-white/70 mb-2">End</label>
                            <input
                              type="time"
                              value={endTime}
                              onChange={(e) => setEndTime(e.target.value)}
                              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:border-brand focus:outline-none"
                            />
                          </div>
                        </div>
                      </section>
                    )}

                    {step === 4 && (
                      <section className="space-y-4">
                        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                          Review
                        </h2>
                        <div className="rounded-xl border border-brand/20 bg-brand/10 p-4 space-y-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-12 w-12 border-2 border-white/20">
                              <AvatarImage
                                src={selectedTeacher?.photoUrl || ""}
                                alt={selectedTeacher?.fullName || ""}
                              />
                              <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 font-semibold text-white">
                                {getInitials(
                                  selectedTeacher?.firstName || "",
                                  selectedTeacher?.lastName || ""
                                )}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-semibold text-white">{selectedTeacher?.fullName}</p>
                              <p className="text-xs text-white/60">{selectedDuty?.name}</p>
                            </div>
                          </div>
                          <div className="text-sm text-white/80">
                            {selectedDays.map((d) => DAY_NAMES[d]).join(", ")} • {startTime} - {endTime}
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
                    onClick={step === 1 || (step === 2 && preselectedDuty) ? () => onOpenChange(false) : handleBack}
                    className="gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    {step === 1 || (step === 2 && preselectedDuty) ? "Cancel" : "Back"}
                  </Button>

                  {step < 4 ? (
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
