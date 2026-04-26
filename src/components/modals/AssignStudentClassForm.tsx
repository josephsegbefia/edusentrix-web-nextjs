"use client";

import * as React from "react";
import { useForm, Controller, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AssignStudentClassSchema,
  type AssignStudentClassInput,
} from "@/schemas/student";
import { useStudentDetail } from "@/hooks/admin/useStudentDetail";
import { useGradeOptions } from "@/hooks/admin/useGradeOptions";
import { useClassGroupOptions } from "@/hooks/admin/useClassGroupOptions";
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
  studentIds: string[];
  onClose: () => void;
  onSaved?: () => void;
};

export default function AssignStudentClassForm({
  studentIds,
  onClose,
  onSaved,
}: Props) {
  const primaryId = studentIds[0] ?? "";
  const bulk = studentIds.length > 1;
  const { data: student, isLoading: loadingStudent } = useStudentDetail(
    bulk ? undefined : primaryId
  );
  const { data: grades = [], isLoading: loadingGrades } = useGradeOptions();

  const {
    control,
    handleSubmit,
    reset,
    resetField,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AssignStudentClassInput>({
    resolver: zodResolver(AssignStudentClassSchema),
    defaultValues: { gradeId: "", classGroupId: "" },
  });

  const gradeId = watch("gradeId") ?? "";
  const { data: classGroups = [], isLoading: loadingClasses } =
    useClassGroupOptions(gradeId || "");

  const lastGradeIdRef = React.useRef<string>("");

  React.useEffect(() => {
    if (bulk) {
      lastGradeIdRef.current = "";
      reset({ gradeId: "", classGroupId: "" });
      return;
    }
    if (!student) return;
    const g = student.grade?.id ?? "";
    lastGradeIdRef.current = g;
    reset({
      gradeId: g,
      classGroupId: student.classGroup?.id ?? "",
    });
  }, [bulk, student, reset]);

  function showFirstValidationError(
    fieldErrors: FieldErrors<AssignStudentClassInput>
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

  async function onSubmit(values: AssignStudentClassInput) {
    const body = JSON.stringify({
      gradeId: values.gradeId,
      classGroupId: values.classGroupId,
    });

    try {
      const results = await Promise.all(
        studentIds.map((id) =>
          fetch(`/api/admin/students/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body,
          })
        )
      );

      const failed = results.filter((r) => !r.ok);
      if (failed.length > 0) {
        const msg = await failed[0].text();
        throw new Error(msg || "Update failed for one or more students");
      }

      if (bulk) {
        toast.success(`Class updated for ${studentIds.length} students`);
      } else {
        toast.success("Class updated");
      }
      onSaved?.();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save changes");
    }
  }

  if (!bulk && loadingStudent) {
    return (
      <div className="flex items-center justify-center py-12 text-white/60">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!bulk && !student) {
    return (
      <p className="text-sm text-white/60">Could not load student.</p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit, (fieldErrors) =>
        showFirstValidationError(fieldErrors)
      )}
      className="space-y-5"
    >
      {bulk ? (
        <p className="text-sm text-white/70">
          Choose a grade and class for{" "}
          <span className="font-medium text-white">{studentIds.length}</span>{" "}
          selected student{studentIds.length === 1 ? "" : "s"}.
        </p>
      ) : (
        <p className="text-sm text-white/70">
          <span className="font-medium text-white">{student!.fullName}</span>
          {student!.grade?.label || student!.classGroup?.label ? (
            <>
              {" "}
              — currently{" "}
              {[student!.grade?.label, student!.classGroup?.label]
                .filter(Boolean)
                .join(", ") || "unassigned"}
            </>
          ) : null}
        </p>
      )}

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
          ) : bulk ? (
            "Apply to all"
          ) : (
            "Save"
          )}
        </Button>
      </div>
    </form>
  );
}
