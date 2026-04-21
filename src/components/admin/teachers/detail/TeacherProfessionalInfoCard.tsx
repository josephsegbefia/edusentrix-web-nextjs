"use client";

import * as React from "react";
import { Briefcase, Calendar, Pencil, Sparkles, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import {
  useSuggestEmployeeId,
  useUpdateTeacher,
} from "@/hooks/admin/useTeachers";
import { useBusyToast } from "@/hooks/useBusyToast";

type TeacherProfessionalInfoCardProps = {
  teacherId: string;
  employeeId?: string | null;
  department?: string | null;
  hireDate?: string | Date | null;
  terminationDate?: string | Date | null;
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

/** Calendar date in local TZ (avoids UTC shift from ISO date strings). */
function parseLocalDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const s = String(value).trim();
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (ymd) {
    const y = Number(ymd[1]);
    const m = Number(ymd[2]) - 1;
    const d = Number(ymd[3]);
    return new Date(y, m, d);
  }
  const parsed = new Date(s);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function dateToLocalYmd(d: Date | null): string | null {
  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function canEditProfessionalInfo(role: string | undefined) {
  return role === "school_admin" || role === "platform_admin";
}

export function TeacherProfessionalInfoCard({
  teacherId,
  employeeId,
  department,
  hireDate,
  terminationDate,
}: TeacherProfessionalInfoCardProps) {
  const busy = useBusyToast();
  const { me } = useAuth();
  const canEdit = canEditProfessionalInfo(me?.role);

  const updateTeacher = useUpdateTeacher();
  const suggestId = useSuggestEmployeeId();

  const [editing, setEditing] = React.useState(false);
  const [draftEmployeeId, setDraftEmployeeId] = React.useState(
    () => employeeId ?? ""
  );
  const [draftDepartment, setDraftDepartment] = React.useState(
    () => department ?? ""
  );
  const [draftHireDate, setDraftHireDate] = React.useState<Date | null>(() =>
    parseLocalDate(hireDate)
  );
  const [draftTerminationDate, setDraftTerminationDate] =
    React.useState<Date | null>(() => parseLocalDate(terminationDate));
  const [idLength, setIdLength] = React.useState<5 | 6>(6);

  React.useEffect(() => {
    if (!editing || !draftHireDate || !draftTerminationDate) return;
    const hire = new Date(
      draftHireDate.getFullYear(),
      draftHireDate.getMonth(),
      draftHireDate.getDate()
    ).getTime();
    const term = new Date(
      draftTerminationDate.getFullYear(),
      draftTerminationDate.getMonth(),
      draftTerminationDate.getDate()
    ).getTime();
    if (term < hire) setDraftTerminationDate(null);
  }, [editing, draftHireDate, draftTerminationDate]);

  React.useEffect(() => {
    if (!editing) {
      setDraftEmployeeId(employeeId ?? "");
      setDraftDepartment(department ?? "");
      setDraftHireDate(parseLocalDate(hireDate));
      setDraftTerminationDate(parseLocalDate(terminationDate));
    }
  }, [
    editing,
    employeeId,
    department,
    hireDate,
    terminationDate,
  ]);

  const startEdit = () => {
    setDraftEmployeeId(employeeId ?? "");
    setDraftDepartment(department ?? "");
    setDraftHireDate(parseLocalDate(hireDate));
    setDraftTerminationDate(parseLocalDate(terminationDate));
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
  };

  const handleGenerateId = async () => {
    try {
      const res = await busy.promise(
        suggestId.mutateAsync(idLength),
        {
          loading: "Generating employee ID…",
          success: "Employee ID generated",
          error: (e: Error) => e.message || "Could not generate ID",
        }
      );
      setDraftEmployeeId(res.employeeId);
    } catch {
      // busy.promise surfaces error
    }
  };

  const handleSave = async () => {
    try {
      await busy.promise(
        updateTeacher.mutateAsync({
          teacherId,
          payload: {
            employeeId: draftEmployeeId.trim() || null,
            department: draftDepartment.trim() || null,
            hireDate: dateToLocalYmd(draftHireDate),
            terminationDate: dateToLocalYmd(draftTerminationDate),
          },
        }),
        {
          loading: "Saving employment details…",
          success: "Employment details updated",
          error: (e: Error) => e.message || "Failed to save",
        }
      );
      setEditing(false);
    } catch {
      // toast handled
    }
  };

  const inputClass =
    "border border-white/10 bg-white/5 text-white placeholder:text-white/35 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Professional Info</h3>
          <p className="mt-0.5 text-xs text-white/45">Employment details</p>
        </div>
        {canEdit && !editing && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 gap-1.5 rounded-lg text-xs text-white/70 hover:bg-white/10 hover:text-white"
            onClick={startEdit}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        )}
        {canEdit && editing && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 rounded-lg text-xs text-white/70 hover:bg-white/10"
              onClick={cancelEdit}
              disabled={updateTeacher.isPending}
            >
              <X className="mr-1 h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8 rounded-lg bg-indigo-600 px-3 text-xs text-white hover:bg-indigo-500"
              onClick={handleSave}
              disabled={updateTeacher.isPending || suggestId.isPending}
            >
              Save
            </Button>
          </div>
        )}
      </div>

      {canEdit && editing ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label
              htmlFor="pro-employee-id"
              className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-white/40"
            >
              <Briefcase className="h-3 w-3" />
              Employee ID
            </Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                id="pro-employee-id"
                value={draftEmployeeId}
                onChange={(e) => setDraftEmployeeId(e.target.value)}
                placeholder="Numeric or custom ID"
                className={cn(inputClass, "font-mono tracking-wide sm:max-w-xs")}
                autoComplete="off"
              />
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
                  {([5, 6] as const).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setIdLength(n)}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                        idLength === n
                          ? "bg-indigo-500/25 text-indigo-200"
                          : "text-white/50 hover:text-white/80"
                      )}
                    >
                      {n} digits
                    </button>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 rounded-lg border-white/15 bg-white/[0.04] text-xs text-white/85 hover:bg-white/10"
                  onClick={handleGenerateId}
                  disabled={suggestId.isPending || updateTeacher.isPending}
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-300/90" />
                  Generate
                </Button>
              </div>
            </div>
            <p className="text-[11px] text-white/35">
              Generates a unique numeric ID for this school ({idLength} digits).
            </p>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="pro-department"
              className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-white/40"
            >
              <Users className="h-3 w-3" />
              Department
            </Label>
            <Input
              id="pro-department"
              value={draftDepartment}
              onChange={(e) => setDraftDepartment(e.target.value)}
              placeholder="e.g. Mathematics"
              className={inputClass}
            />
          </div>

          <CustomDatePicker
            value={draftHireDate}
            onChange={setDraftHireDate}
            label="Hire date"
            placeholder="Select hire date"
            triggerAriaLabel="Hire date"
            disabled={updateTeacher.isPending || suggestId.isPending}
          />

          <CustomDatePicker
            value={draftTerminationDate}
            onChange={setDraftTerminationDate}
            label="Termination"
            placeholder="Select termination date (optional)"
            triggerAriaLabel="Termination date"
            minDate={draftHireDate ?? undefined}
            disabled={updateTeacher.isPending || suggestId.isPending}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-white/40">
              <Briefcase className="h-3 w-3" />
              Employee ID
            </p>
            <p className="mt-2 text-sm font-medium text-white">
              {employeeId ?? "—"}
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-white/40">
              <Users className="h-3 w-3" />
              Department
            </p>
            <p className="mt-2 text-sm font-medium text-white">
              {department ?? "—"}
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-white/40">
              <Calendar className="h-3 w-3" />
              Hire Date
            </p>
            <p className="mt-2 text-sm font-medium text-white">
              {formatDate(hireDate)}
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-white/40">
              <Calendar className="h-3 w-3" />
              Termination
            </p>
            <p className="mt-2 text-sm font-medium text-white">
              {formatDate(terminationDate)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
