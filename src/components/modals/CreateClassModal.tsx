"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { X, Loader2, School } from "lucide-react";

const CreateClassSchema = z.object({
  gradeId: z.string().min(1, "Grade is required"),
  name: z.string().min(1, "Class name is required").max(50),
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
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CreateClassInput>({
    resolver: zodResolver(CreateClassSchema),
    defaultValues: {
      gradeId,
      name: "",
      capacity: undefined,
    },
    mode: "onChange",
  });

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

  return (
    <form onSubmit={handleSubmit(internalSubmit)} className="space-y-6">
      {/* Grade context (read-only) */}
      <div className="flex items-center gap-2 rounded-xl border border-teal-500/20 bg-teal-500/10 px-4 py-3">
        <School className="h-5 w-5 text-teal-300" />
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-(--ws-fg-70)">
            Adding class to
          </p>
          <p className="text-sm font-semibold text-teal-200">
            {gradeName ?? "Grade"}
          </p>
        </div>
      </div>

      <p className="rounded-xl border border-(--ws-line) bg-(--ws-fill) px-3 py-2 text-xs leading-relaxed text-(--ws-fg-70)">
        Subjects and learning areas already used in this grade are applied to this class
        automatically (same set as your other classes). The first class in a grade starts
        with none until you assign them in the grade or class subject flows.
      </p>

      {/* Class name */}
      <div className="space-y-2">
        <Label
          htmlFor="name"
          className="text-xs font-medium uppercase tracking-[0.2em] text-(--ws-fg-70)"
        >
          Class name *
        </Label>
        <Input
          id="name"
          {...register("name")}
          placeholder="e.g. A, B, 1, Alpha"
          className="border border-(--ws-line) bg-(--ws-fill) text-(--ws-fg) placeholder:text-(--ws-fg-50) focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
        />
        {errors.name && (
          <p className="text-xs text-rose-300">{errors.name.message}</p>
        )}
      </div>

      {/* Capacity (optional) */}
      <div className="space-y-2">
        <Label
          htmlFor="capacity"
          className="text-xs font-medium uppercase tracking-[0.2em] text-(--ws-fg-70)"
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
              className="border border-(--ws-line) bg-(--ws-fill) text-(--ws-fg) placeholder:text-(--ws-fg-50) focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
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
          className="border-(--ws-line) bg-(--ws-fill) text-(--ws-fg-70) hover:bg-(--ws-fill-strong)"
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
