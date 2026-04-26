"use client";

import * as React from "react";
import { useForm, Controller, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  PatchStudentProfileSchema,
  type PatchStudentProfileInput,
} from "@/schemas/student";
import { useStudentDetail } from "@/hooks/admin/useStudentDetail";
import { useGradeOptions } from "@/hooks/admin/useGradeOptions";
import { useClassGroupOptions } from "@/hooks/admin/useClassGroupOptions";
import { useAuth } from "@/providers/auth-provider";
import { ImageUploader } from "@/components/upload/ImageUploader";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { premiumSelectContent, premiumMenuItem } from "@/components/ui/premium";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  studentId: string;
  onClose: () => void;
  onSaved?: () => void;
};

export default function EditStudentProfileForm({
  studentId,
  onClose,
  onSaved,
}: Props) {
  const { me } = useAuth();
  const { data: student, isLoading: loadingStudent } =
    useStudentDetail(studentId);
  const { data: grades = [], isLoading: loadingGrades } = useGradeOptions();

  const {
    register,
    handleSubmit,
    control,
    reset,
    resetField,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PatchStudentProfileInput>({
    resolver: zodResolver(PatchStudentProfileSchema),
    defaultValues: {},
  });

  const gradeId = watch("gradeId") ?? "";
  const { data: classGroups = [], isLoading: loadingClasses } =
    useClassGroupOptions(gradeId || "");

  /** Tracks last selected grade so changing grade clears class (without wiping on initial load). */
  const lastGradeIdRef = React.useRef<string>("");

  React.useEffect(() => {
    if (!student) return;
    const g = student.grade?.id ?? "";
    lastGradeIdRef.current = g;
    reset({
      firstName: student.firstName,
      middleName: student.middleName ?? "",
      lastName: student.lastName,
      admissionNo: student.admissionNo ?? "",
      sex: student.sex ?? "male",
      dateOfBirth: student.dateOfBirth
        ? student.dateOfBirth.slice(0, 10)
        : null,
      photoUrl: student.photoUrl ?? "",
      status: student.status,
      enrolledAt: student.enrolledAt
        ? student.enrolledAt.slice(0, 10)
        : null,
      gradeId: g,
      classGroupId: student.classGroup?.id ?? "",
      gesIndexNumber: student.gesIndexNumber ?? "",
      gesSchoolCode: student.gesSchoolCode ?? "",
    });
  }, [student, reset]);

  async function onSubmit(values: PatchStudentProfileInput) {
    const payload: Record<string, unknown> = {
      firstName: values.firstName,
      middleName:
        values.middleName === "" || values.middleName === undefined
          ? null
          : values.middleName,
      lastName: values.lastName,
      admissionNo:
        values.admissionNo === "" || values.admissionNo === undefined
          ? null
          : values.admissionNo,
      sex: values.sex ?? null,
      dateOfBirth: values.dateOfBirth || null,
      photoUrl:
        !values.photoUrl || values.photoUrl === ""
          ? null
          : values.photoUrl,
      status: values.status,
      enrolledAt: values.enrolledAt || null,
      gradeId: values.gradeId,
      classGroupId: values.classGroupId,
      gesIndexNumber:
        values.gesIndexNumber === "" || values.gesIndexNumber === undefined
          ? null
          : values.gesIndexNumber,
      gesSchoolCode:
        values.gesSchoolCode === "" || values.gesSchoolCode === undefined
          ? null
          : values.gesSchoolCode,
    };

    const cleaned = Object.fromEntries(
      Object.entries(payload).filter(([, v]) => v !== undefined)
    );

    try {
      const res = await fetch(`/api/admin/students/${studentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleaned),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Update failed");
      }
      toast.success("Student profile updated");
      onSaved?.();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save changes");
    }
  }

  function showFirstValidationError(
    fieldErrors: FieldErrors<PatchStudentProfileInput>
  ) {
    const queue: unknown[] = [fieldErrors];
    while (queue.length > 0) {
      const cur = queue.shift();
      if (!cur || typeof cur !== "object") continue;
      const leaf = cur as { message?: string };
      if (typeof leaf.message === "string" && leaf.message.length > 0) {
        toast.error(leaf.message);
        return;
      }
      for (const v of Object.values(cur as Record<string, unknown>)) {
        queue.push(v);
      }
    }
    toast.error("Please fix the highlighted fields");
  }

  if (!me?.schoolId) {
    return (
      <p className="text-sm text-white/60">School context not available.</p>
    );
  }

  if (loadingStudent || !student) {
    return (
      <div className="flex items-center justify-center py-12 text-white/60">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit, (fieldErrors) =>
        showFirstValidationError(fieldErrors)
      )}
      className="space-y-5"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-white/70">First name</Label>
          <Input
            {...register("firstName")}
            className="border-white/10 bg-black/30 text-white"
          />
          {errors.firstName ? (
            <p className="text-xs text-red-400">{errors.firstName.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label className="text-white/70">Last name</Label>
          <Input
            {...register("lastName")}
            className="border-white/10 bg-black/30 text-white"
          />
          {errors.lastName ? (
            <p className="text-xs text-red-400">{errors.lastName.message}</p>
          ) : null}
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label className="text-white/70">Middle name (optional)</Label>
          <Input
            {...register("middleName")}
            className="border-white/10 bg-black/30 text-white"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-white/70">Admission / student ID</Label>
          <Input
            {...register("admissionNo")}
            className="border-white/10 bg-black/30 text-white"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-white/70">Sex</Label>
          <Controller
            name="sex"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value ?? "male"}
                onValueChange={(v) =>
                  field.onChange(v as "male" | "female")
                }
              >
                <SelectTrigger className="border-white/10 bg-black/30 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={premiumSelectContent}>
                  <SelectItem value="male" className={premiumMenuItem}>
                    Male
                  </SelectItem>
                  <SelectItem value="female" className={premiumMenuItem}>
                    Female
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-white/70">Date of birth</Label>
          <Controller
            name="dateOfBirth"
            control={control}
            render={({ field }) => (
              <CustomDatePicker
                value={field.value ? new Date(field.value) : undefined}
                onChange={(d) =>
                  field.onChange(
                    d ? d.toISOString().slice(0, 10) : null
                  )
                }
                className="w-full"
              />
            )}
          />
          {errors.dateOfBirth ? (
            <p className="text-xs text-red-400">{errors.dateOfBirth.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label className="text-white/70">Enrolled on</Label>
          <Controller
            name="enrolledAt"
            control={control}
            render={({ field }) => (
              <CustomDatePicker
                value={field.value ? new Date(field.value) : undefined}
                onChange={(d) =>
                  field.onChange(
                    d ? d.toISOString().slice(0, 10) : null
                  )
                }
                className="w-full"
              />
            )}
          />
          {errors.enrolledAt ? (
            <p className="text-xs text-red-400">{errors.enrolledAt.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label className="text-white/70">Status</Label>
          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value ?? "active"}
                onValueChange={(v) =>
                  field.onChange(
                    v as PatchStudentProfileInput["status"]
                  )
                }
              >
                <SelectTrigger className="border-white/10 bg-black/30 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={premiumSelectContent}>
                  {(
                    [
                      ["active", "Active"],
                      ["inactive", "Inactive"],
                      ["withdrawn", "Withdrawn"],
                      ["graduated", "Graduated"],
                    ] as const
                  ).map(([val, label]) => (
                    <SelectItem
                      key={val}
                      value={val}
                      className={premiumMenuItem}
                    >
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-white/70">Photo</Label>
        <Controller
          name="photoUrl"
          control={control}
          render={({ field }) => (
            <ImageUploader
              schoolId={me.schoolId!}
              subjectRole="students"
              onUploaded={(payload) => field.onChange(payload.url)}
              className="w-full"
              label=""
            />
          )}
        />
        {errors.photoUrl ? (
          <p className="text-xs text-red-400">{errors.photoUrl.message}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-white/70">Grade</Label>
          <Controller
            name="gradeId"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value || ""}
                onValueChange={(v) => {
                  if (v !== lastGradeIdRef.current) {
                    resetField("classGroupId", { defaultValue: "" });
                  }
                  lastGradeIdRef.current = v;
                  field.onChange(v);
                }}
                disabled={loadingGrades}
              >
                <SelectTrigger className="border-white/10 bg-black/30 text-white">
                  <SelectValue placeholder="Select grade" />
                </SelectTrigger>
                <SelectContent className={premiumSelectContent}>
                  {grades.map((g) => (
                    <SelectItem
                      key={g._id}
                      value={g._id}
                      className={premiumMenuItem}
                    >
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.gradeId ? (
            <p className="text-xs text-red-400">{errors.gradeId.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label className="text-white/70">Class group</Label>
          <Controller
            name="classGroupId"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value || ""}
                onValueChange={field.onChange}
                disabled={!gradeId || loadingClasses}
              >
                <SelectTrigger className="border-white/10 bg-black/30 text-white">
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent className={premiumSelectContent}>
                  {classGroups.map((c) => (
                    <SelectItem
                      key={c._id}
                      value={c._id}
                      className={premiumMenuItem}
                    >
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.classGroupId ? (
            <p className="text-xs text-red-400">
              {errors.classGroupId.message}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 border-t border-white/10 pt-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-white/70">GES index number (optional)</Label>
          <Input
            {...register("gesIndexNumber")}
            className="border-white/10 bg-black/30 text-white"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-white/70">GES school code (optional)</Label>
          <Input
            {...register("gesSchoolCode")}
            className="border-white/10 bg-black/30 text-white"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-white/10 pt-4">
        <Button
          type="button"
          variant="outline"
          className="border-white/15 bg-transparent text-white"
          onClick={onClose}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="bg-teal-600 text-white hover:bg-teal-500"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Save changes"
          )}
        </Button>
      </div>
    </form>
  );
}
