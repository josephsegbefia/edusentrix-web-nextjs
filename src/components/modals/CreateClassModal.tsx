"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { X, Loader2, School } from "lucide-react";
import { useSubjectOptions } from "@/hooks/admin/useSubjectOptions";
import {
  PremiumDropdownMenu,
  PremiumDropdownMenuTrigger,
  PremiumDropdownMenuContent,
  PremiumDropdownMenuCheckboxItem,
  PremiumDropdownMenuLabel,
} from "@/components/ui/premium-dropdown-menu";

const CreateClassSchema = z.object({
  gradeId: z.string().min(1, "Grade is required"),
  name: z.string().min(1, "Class name is required").max(50),
  subjectIds: z.array(z.string()),
  capacity: z.number().int().positive().optional(),
});

export type CreateClassInput = z.infer<typeof CreateClassSchema>;

type Props = {
  gradeId: string;
  gradeName?: string;
  onClose: () => void;
  onSubmit: (payload: CreateClassInput) => Promise<void> | void;
  isLoading?: boolean;
};

export default function CreateClassModal({
  gradeId,
  gradeName,
  onClose,
  onSubmit,
  isLoading,
}: Props) {
  const { data: subjects = [], isLoading: loadingSubjects } = useSubjectOptions();

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateClassInput>({
    resolver: zodResolver(CreateClassSchema),
    defaultValues: {
      gradeId,
      name: "",
      subjectIds: [],
      capacity: undefined,
    },
    mode: "onChange",
  });

  const subjectIds = watch("subjectIds") ?? [];

  async function internalSubmit(values: CreateClassInput) {
    try {
      await onSubmit({
        ...values,
        capacity: values.capacity ?? undefined,
      });
      onClose();
    } catch (e: unknown) {
      console.error("Class creation error:", e);
    }
  }

  function toggleSubject(id: string) {
    setValue(
      "subjectIds",
      subjectIds.includes(id)
        ? subjectIds.filter((s) => s !== id)
        : [...subjectIds, id],
      { shouldValidate: true }
    );
  }

  const selectedSubjects = subjects.filter((s) => subjectIds.includes(s._id));

  return (
    <form onSubmit={handleSubmit(internalSubmit)} className="space-y-6">
      {/* Grade context (read-only) */}
      <div className="flex items-center gap-2 rounded-xl border border-teal-500/20 bg-teal-500/10 px-4 py-3">
        <School className="h-5 w-5 text-teal-300" />
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-white/50">
            Adding class to
          </p>
          <p className="text-sm font-semibold text-teal-200">
            {gradeName ?? "Grade"}
          </p>
        </div>
      </div>

      {/* Class name */}
      <div className="space-y-2">
        <Label
          htmlFor="name"
          className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
        >
          Class name *
        </Label>
        <Input
          id="name"
          {...register("name")}
          placeholder="e.g. A, B, 1, Alpha"
          className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
        />
        {errors.name && (
          <p className="text-xs text-rose-300">{errors.name.message}</p>
        )}
      </div>

      {/* Subjects (optional) */}
      <div className="space-y-2">
        <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Subjects (optional)
        </Label>
        <PremiumDropdownMenu>
          <PremiumDropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-between border-white/10 bg-white/5 text-white hover:bg-white/10"
            >
              <span className="truncate">
                {selectedSubjects.length > 0
                  ? `${selectedSubjects.length} subject${selectedSubjects.length !== 1 ? "s" : ""} selected`
                  : "Select subjects"}
              </span>
            </Button>
          </PremiumDropdownMenuTrigger>
          <PremiumDropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
            <PremiumDropdownMenuLabel className="text-xs text-white/60">
              Assign subjects to this class
            </PremiumDropdownMenuLabel>
            {loadingSubjects ? (
              <div className="px-3 py-4 text-xs text-white/50">
                Loading subjects...
              </div>
            ) : subjects.length === 0 ? (
              <div className="px-3 py-4 text-xs text-white/50">
                No subjects available
              </div>
            ) : (
              subjects.map((subject) => (
                <PremiumDropdownMenuCheckboxItem
                  key={subject._id}
                  checked={subjectIds.includes(subject._id)}
                  onCheckedChange={() => toggleSubject(subject._id)}
                  className="text-xs"
                >
                  {subject.name}
                </PremiumDropdownMenuCheckboxItem>
              ))
            )}
          </PremiumDropdownMenuContent>
        </PremiumDropdownMenu>
      </div>

      {/* Capacity (optional) */}
      <div className="space-y-2">
        <Label
          htmlFor="capacity"
          className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
        >
          Capacity (optional)
        </Label>
        <Controller
          name="capacity"
          control={control}
          render={({ field }) => (
            <Input
              id="capacity"
              type="number"
              min={1}
              placeholder="e.g. 30"
              value={field.value === null || field.value === undefined ? "" : field.value}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "") {
                  field.onChange(undefined);
                  return;
                }
                const parsed = Number(v);
                field.onChange(Number.isFinite(parsed) ? parsed : undefined);
              }}
              className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
            />
          )}
        />
        {errors.capacity && (
          <p className="text-xs text-rose-300">{errors.capacity.message}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClose}
          className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
        >
          <X className="h-4 w-4" />
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={isLoading}
          className="gap-2 bg-linear-to-r from-teal-500 to-cyan-600 text-white hover:from-teal-600 hover:to-cyan-700"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            "Create Class"
          )}
        </Button>
      </div>
    </form>
  );
}
