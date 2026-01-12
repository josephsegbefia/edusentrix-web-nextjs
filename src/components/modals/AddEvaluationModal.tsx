// src/components/modals/AddEvaluationModal.tsx
"use client";

import * as React from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import {
  useCreateEvaluation,
  type CreateEvaluationInput,
} from "@/hooks/admin/useTeacherPerformance";
import { useAcademicPeriods } from "@/hooks/admin/useAcademicPeriods";
import { premiumSelectContent, premiumMenuItem } from "@/components/ui/premium";
import { CreateEvaluationSchema } from "@/schemas/teacher";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacherId: string;
  teacherName: string;
};

export function AddEvaluationModal({
  open,
  onOpenChange,
  teacherId,
  teacherName,
}: Props) {
  const createEvaluationMutation = useCreateEvaluation();
  const { data: periodsData } = useAcademicPeriods();
  const periods = periodsData?.periods || [];

  const [strengths, setStrengths] = React.useState<string[]>([]);
  const [strengthInput, setStrengthInput] = React.useState("");
  const [areasForImprovement, setAreasForImprovement] = React.useState<string[]>([]);
  const [areaInput, setAreaInput] = React.useState("");
  const [goals, setGoals] = React.useState<string[]>([]);
  const [goalInput, setGoalInput] = React.useState("");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateEvaluationInput>({
    resolver: zodResolver(CreateEvaluationSchema),
    defaultValues: {
      academicPeriodId: "",
      overallRating: 3,
      strengths: [],
      areasForImprovement: [],
      goals: [],
      comments: "",
    },
  });

  // Reset form when modal opens
  React.useEffect(() => {
    if (open) {
      reset({
        academicPeriodId: "",
        overallRating: 3,
        strengths: [],
        areasForImprovement: [],
        goals: [],
        comments: "",
      });
      setStrengths([]);
      setAreasForImprovement([]);
      setGoals([]);
      setStrengthInput("");
      setAreaInput("");
      setGoalInput("");
    }
  }, [open, reset]);

  const handleAddStrength = () => {
    const trimmed = strengthInput.trim();
    if (trimmed && !strengths.includes(trimmed)) {
      const newStrengths = [...strengths, trimmed];
      setStrengths(newStrengths);
      setValue("strengths", newStrengths);
      setStrengthInput("");
    }
  };

  const handleRemoveStrength = (strengthToRemove: string) => {
    const newStrengths = strengths.filter((s) => s !== strengthToRemove);
    setStrengths(newStrengths);
    setValue("strengths", newStrengths);
  };

  const handleAddArea = () => {
    const trimmed = areaInput.trim();
    if (trimmed && !areasForImprovement.includes(trimmed)) {
      const newAreas = [...areasForImprovement, trimmed];
      setAreasForImprovement(newAreas);
      setValue("areasForImprovement", newAreas);
      setAreaInput("");
    }
  };

  const handleRemoveArea = (areaToRemove: string) => {
    const newAreas = areasForImprovement.filter((a) => a !== areaToRemove);
    setAreasForImprovement(newAreas);
    setValue("areasForImprovement", newAreas);
  };

  const handleAddGoal = () => {
    const trimmed = goalInput.trim();
    if (trimmed && !goals.includes(trimmed)) {
      const newGoals = [...goals, trimmed];
      setGoals(newGoals);
      setValue("goals", newGoals);
      setGoalInput("");
    }
  };

  const handleRemoveGoal = (goalToRemove: string) => {
    const newGoals = goals.filter((g) => g !== goalToRemove);
    setGoals(newGoals);
    setValue("goals", newGoals);
  };

  const onSubmit = async (data: CreateEvaluationInput) => {
    try {
      const payload: CreateEvaluationInput = {
        ...data,
        strengths,
        areasForImprovement,
        goals,
      };

      await createEvaluationMutation.mutateAsync({
        teacherId,
        payload,
      });
      toast.success("Evaluation recorded successfully");
      onOpenChange(false);
    } catch (e: unknown) {
      const error = e as { message?: string };
      toast.error(error.message || "Failed to record evaluation");
    }
  };

  const isPending = createEvaluationMutation.isPending || isSubmitting;

  React.useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) onOpenChange(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, isPending, onOpenChange]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        aria-modal="true"
        role="dialog"
      >
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !isPending) onOpenChange(false);
          }}
        />

        <div className="relative z-10 flex min-h-full items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-[860px] overflow-hidden rounded-2xl border border-white/10 bg-neutral-950 text-white shadow-2xl shadow-black/40"
          >
            <div className="px-6 pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h1 className="text-lg font-semibold">
                    Record Performance Evaluation
                  </h1>
                  <p className="text-sm text-white/60">
                    Record a performance evaluation for{" "}
                    <span className="font-medium text-white/85">
                      {teacherName}
                    </span>
                    .
                  </p>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={isPending}
                  className="h-9 w-9 rounded-full text-white/70 hover:bg-white/10 hover:text-white"
                  onClick={() => onOpenChange(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-5 h-px bg-white/10" />
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-6 py-6">
              <div className="space-y-6">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label
                        htmlFor="academicPeriodId"
                        className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                      >
                        Academic Period *
                      </Label>
                      <Select
                        value={watch("academicPeriodId")}
                        onValueChange={(value) =>
                          setValue("academicPeriodId", value)
                        }
                      >
                        <SelectTrigger className="border border-white/10 bg-white/5 text-white hover:bg-white/10 focus:ring-1 focus:ring-brand">
                          <SelectValue placeholder="Select academic period" />
                        </SelectTrigger>
                        <SelectContent className={premiumSelectContent}>
                          {periods.map((period) => (
                            <SelectItem
                              key={period._id}
                              value={period._id}
                              className={premiumMenuItem}
                            >
                              {period.yearLabel} - {period.term}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.academicPeriodId && (
                        <p className="text-xs text-red-300/80">
                          {errors.academicPeriodId.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="overallRating"
                        className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                      >
                        Overall Rating *
                      </Label>
                      <Select
                        value={String(watch("overallRating"))}
                        onValueChange={(value) =>
                          setValue("overallRating", Number(value))
                        }
                      >
                        <SelectTrigger className="border border-white/10 bg-white/5 text-white hover:bg-white/10 focus:ring-1 focus:ring-brand">
                          <SelectValue placeholder="Select rating" />
                        </SelectTrigger>
                        <SelectContent className={premiumSelectContent}>
                          {[1, 2, 3, 4, 5].map((rating) => (
                            <SelectItem
                              key={rating}
                              value={String(rating)}
                              className={premiumMenuItem}
                            >
                              {rating} {rating === 1 ? "star" : "stars"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.overallRating && (
                        <p className="text-xs text-red-300/80">
                          {errors.overallRating.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="strengthInput"
                      className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                    >
                      Strengths (optional)
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="strengthInput"
                        value={strengthInput}
                        onChange={(e) => setStrengthInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddStrength();
                          }
                        }}
                        placeholder="Type a strength and press Enter"
                        className="border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleAddStrength}
                        disabled={!strengthInput.trim()}
                        className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {strengths.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {strengths.map((strength) => (
                          <Badge
                            key={strength}
                            variant="outline"
                            className="border-white/10 bg-white/5 gap-1 pr-1"
                          >
                            {strength}
                            <button
                              type="button"
                              onClick={() => handleRemoveStrength(strength)}
                              className="ml-1 rounded-full hover:bg-white/10 p-0.5"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="areaInput"
                      className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                    >
                      Areas for Improvement (optional)
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="areaInput"
                        value={areaInput}
                        onChange={(e) => setAreaInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddArea();
                          }
                        }}
                        placeholder="Type an area and press Enter"
                        className="border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleAddArea}
                        disabled={!areaInput.trim()}
                        className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {areasForImprovement.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {areasForImprovement.map((area) => (
                          <Badge
                            key={area}
                            variant="outline"
                            className="border-white/10 bg-white/5 gap-1 pr-1"
                          >
                            {area}
                            <button
                              type="button"
                              onClick={() => handleRemoveArea(area)}
                              className="ml-1 rounded-full hover:bg-white/10 p-0.5"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="goalInput"
                      className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                    >
                      Goals (optional)
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="goalInput"
                        value={goalInput}
                        onChange={(e) => setGoalInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddGoal();
                          }
                        }}
                        placeholder="Type a goal and press Enter"
                        className="border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleAddGoal}
                        disabled={!goalInput.trim()}
                        className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {goals.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {goals.map((goal) => (
                          <Badge
                            key={goal}
                            variant="outline"
                            className="border-white/10 bg-white/5 gap-1 pr-1"
                          >
                            {goal}
                            <button
                              type="button"
                              onClick={() => handleRemoveGoal(goal)}
                              className="ml-1 rounded-full hover:bg-white/10 p-0.5"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="comments"
                      className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                    >
                      Comments (optional)
                    </Label>
                    <Textarea
                      id="comments"
                      {...register("comments")}
                      placeholder="Enter evaluation comments..."
                      className="min-h-[100px] border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                      maxLength={2000}
                    />
                    {errors.comments && (
                      <p className="text-xs text-red-300/80">
                        {errors.comments.message}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onOpenChange(false)}
                      disabled={isPending}
                      className="gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isPending}
                      className="gap-2 bg-brand text-black hover:opacity-90"
                    >
                      {isPending ? "Recording…" : "Record Evaluation"}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
