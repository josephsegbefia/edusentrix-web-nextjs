"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Clock,
  Calendar,
  MapPin,
  Plus,
  Loader2,
  AlertCircle,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useTeacherDuties,
  useRemoveTeacherDuty,
  formatDays,
  DAY_NAMES,
} from "@/hooks/admin/useTeacherDuties";
import { toast } from "sonner";
import { AssignTeacherDutyModal } from "@/components/modals/AssignTeacherDutyModal";

interface TeacherDutiesTabProps {
  teacher: {
    id: string;
    fullName: string;
  };
}

export function TeacherDutiesTab({ teacher }: TeacherDutiesTabProps) {
  const [assignModalOpen, setAssignModalOpen] = useState(false);

  const { data, isLoading, isError } = useTeacherDuties(true, teacher.id);
  const removeMutation = useRemoveTeacherDuty();

  const assignments = data?.assignments || [];
  const duties = data?.data || [];

  const handleRemove = async (assignmentId: string) => {
    if (!confirm("Are you sure you want to remove this duty assignment?")) return;
    try {
      await removeMutation.mutateAsync(assignmentId);
      toast.success("Duty removed successfully");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove duty");
    }
  };

  // Group assignments by day
  const assignmentsByDay: Record<number, typeof assignments> = {};
  assignments.forEach((a) => {
    a.days.forEach((day) => {
      if (!assignmentsByDay[day]) {
        assignmentsByDay[day] = [];
      }
      assignmentsByDay[day].push(a);
    });
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="border-red-500/20 bg-red-500/5">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="h-10 w-10 text-red-400" />
          <p className="mt-3 text-sm text-red-200">Failed to load duties</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Assigned Duties</h2>
          <p className="text-sm text-white/50">
            Non-teaching duties assigned to {teacher.fullName}
          </p>
        </div>
        <Button
          onClick={() => setAssignModalOpen(true)}
          className="gap-2 bg-brand text-black shadow-lg shadow-brand/20 hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Assign Duty
        </Button>
      </div>

      {/* Current Period Badge */}
      {data?.currentPeriod && (
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-brand/20 px-3 py-1 text-xs font-medium text-brand">
            {data.currentPeriod.yearLabel} - {data.currentPeriod.term}
          </span>
        </div>
      )}

      {/* Duty Cards */}
      {assignments.length === 0 ? (
        <Card className="border-white/10 bg-white/5">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Clock className="h-10 w-10 text-white/30" />
            <p className="mt-3 text-sm text-white/50">
              No duties assigned yet
            </p>
            <Button
              onClick={() => setAssignModalOpen(true)}
              variant="outline"
              className="mt-4 gap-2 border-white/10 text-white hover:bg-white/10"
            >
              <Plus className="h-4 w-4" />
              Assign First Duty
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assignments.map((assignment) => (
            <motion.div
              key={assignment.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="group relative rounded-xl border border-white/10 bg-white/5 p-4 transition-all hover:border-white/20"
              style={{
                borderLeftColor: assignment.duty?.color || undefined,
                borderLeftWidth: assignment.duty?.color ? "3px" : undefined,
              }}
            >
              {/* Remove button */}
              <button
                onClick={() => handleRemove(assignment.id)}
                disabled={removeMutation.isPending}
                className="absolute right-2 top-2 rounded-lg p-1.5 text-white/30 opacity-0 transition-all hover:bg-white/10 hover:text-rose-400 group-hover:opacity-100"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="space-y-3">
                {/* Duty name */}
                <div>
                  <h3 className="font-medium text-white">
                    {assignment.duty?.name}
                  </h3>
                  <p className="text-xs capitalize text-white/50">
                    {assignment.duty?.category}
                  </p>
                </div>

                {/* Schedule info */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-white/60">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDays(assignment.days)}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-white/60">
                    <Clock className="h-3.5 w-3.5" />
                    {assignment.startTime} - {assignment.endTime}
                  </div>
                  {assignment.duty?.location && (
                    <div className="flex items-center gap-2 text-xs text-white/60">
                      <MapPin className="h-3.5 w-3.5" />
                      {assignment.duty.location}
                    </div>
                  )}
                </div>

                {/* Notes */}
                {assignment.notes && (
                  <p className="text-xs text-white/40 italic">
                    {assignment.notes}
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Weekly Schedule View */}
      {assignments.length > 0 && (
        <Card className="border-white/10 bg-white/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium text-white">
              Weekly Schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((day) => (
                <div key={day} className="space-y-2">
                  <div className="text-center text-xs font-medium text-white/60">
                    {DAY_NAMES[day]}
                  </div>
                  <div className="min-h-[100px] space-y-1.5 rounded-lg border border-white/10 bg-white/5 p-2">
                    {(assignmentsByDay[day] || []).map((a) => (
                      <div
                        key={`${a.id}-${day}`}
                        className="rounded-md p-2 text-xs"
                        style={{
                          backgroundColor: `${a.duty?.color}20`,
                          borderLeft: `2px solid ${a.duty?.color || "#fff"}`,
                        }}
                      >
                        <p className="font-medium text-white">
                          {a.duty?.name}
                        </p>
                        <p className="text-white/60">
                          {a.startTime} - {a.endTime}
                        </p>
                      </div>
                    ))}
                    {!assignmentsByDay[day]?.length && (
                      <p className="text-center text-xs text-white/30 py-4">
                        No duties
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assign Modal */}
      <AssignTeacherDutyModal
        open={assignModalOpen}
        onOpenChange={setAssignModalOpen}
        preselectedDuty={null}
        duties={duties}
      />
    </div>
  );
}
