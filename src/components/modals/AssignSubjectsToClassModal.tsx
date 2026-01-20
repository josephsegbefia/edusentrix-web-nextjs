// src/components/modals/AssignSubjectsToClassModal.tsx
"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  BookOpen,
  Check,
  ChevronsUpDown,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useSubjectSearch } from "@/hooks/admin/useDirectorySearch";
import { useAssignSubjectsToClass } from "@/hooks/admin/useClasses";
import { useBusyToast } from "@/hooks/useBusyToast";
import { premiumSelectContent, premiumMenuItem } from "@/components/ui/premium";
import { Badge } from "@/components/ui/badge";
import type { ClassGroupDTO } from "@/hooks/admin/useClasses";

const schema = z.object({
  subjectIds: z.array(z.string()).min(0),
});

type FormValues = z.infer<typeof schema>;

type AssignSubjectsToClassModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classGroup: ClassGroupDTO;
};

export function AssignSubjectsToClassModal({
  open,
  onOpenChange,
  classGroup,
}: AssignSubjectsToClassModalProps) {
  const busy = useBusyToast();
  const assignSubjects = useAssignSubjectsToClass();
  const [query, setQuery] = React.useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const { data: subjectsData, isLoading: isLoadingSubjects } = useSubjectSearch(
    debouncedQuery
  );
  const subjects = subjectsData?.data || [];

  const {
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      subjectIds: classGroup.subjects.map((s) => s.id),
    },
  });

  const selectedSubjectIds = watch("subjectIds") || [];

  React.useEffect(() => {
    if (open) {
      reset({
        subjectIds: classGroup.subjects.map((s) => s.id),
      });
      setQuery("");
    }
  }, [open, classGroup.subjects, reset]);

  const toggleSubject = (subjectId: string) => {
    const current = selectedSubjectIds;
    if (current.includes(subjectId)) {
      setValue(
        "subjectIds",
        current.filter((id) => id !== subjectId),
        { shouldValidate: true }
      );
    } else {
      setValue("subjectIds", [...current, subjectId], { shouldValidate: true });
    }
  };

  const onSubmit = async (data: FormValues) => {
    try {
      await busy.promise(
        assignSubjects.mutateAsync({
          classId: classGroup.id,
          subjectIds: data.subjectIds,
        }),
        {
          loading: "Assigning subjects...",
          success: `Assigned ${data.subjectIds.length} subject(s) to class`,
          error: (e: Error) => e.message || "Failed to assign subjects",
        }
      );
      onOpenChange(false);
    } catch {
      // Error handled by busy.promise
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
          onClick={() => onOpenChange(false)}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative z-10 w-full max-w-2xl rounded-2xl border border-white/10 bg-neutral-950 shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10">
                <BookOpen className="h-5 w-5 text-emerald-300" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Assign Subjects to Class
                </h2>
                <p className="text-sm text-white/60">{classGroup.fullLabel}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit(onSubmit)} className="p-6">
            <div className="space-y-6">
              {/* Current subjects */}
              {classGroup.subjects.length > 0 && (
                <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                  <p className="mb-3 text-xs font-medium uppercase tracking-wider text-white/50">
                    Currently Assigned ({classGroup.subjects.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {classGroup.subjects.map((subject) => (
                      <Badge
                        key={subject.id}
                        variant="outline"
                        className="rounded-full border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300"
                      >
                        {subject.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Subject selection */}
              <div className="space-y-2">
                <Label className="text-white">Select Subjects</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12 w-full justify-between border border-white/10 bg-white/5 text-white hover:bg-white/10"
                    >
                      <span className="text-white/50">
                        {selectedSubjectIds.length > 0
                          ? `${selectedSubjectIds.length} subject(s) selected`
                          : "Search and select subjects..."}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 opacity-70" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className={cn(
                      premiumSelectContent,
                      "w-[--radix-popover-trigger-width] p-1 max-h-[400px]"
                    )}
                  >
                    <Command shouldFilter={false} className="bg-transparent">
                      <CommandInput
                        placeholder="Search subjects..."
                        value={query}
                        onValueChange={setQuery}
                        className="border-b border-neutral-800/60 bg-transparent"
                      />
                      <CommandList className="max-h-[300px] overflow-y-auto">
                        {isLoadingSubjects ? (
                          <div className="px-3 py-3 text-sm text-neutral-400">
                            Searching...
                          </div>
                        ) : (
                          <>
                            <CommandEmpty className="py-6 text-center text-sm text-neutral-400">
                              No subjects found.
                            </CommandEmpty>
                            <CommandGroup>
                              {subjects.map((subject) => {
                                const isSelected = selectedSubjectIds.includes(subject.id);
                                return (
                                  <CommandItem
                                    key={subject.id}
                                    value={subject.id}
                                    onSelect={() => toggleSubject(subject.id)}
                                    className={cn(
                                      premiumMenuItem,
                                      "flex items-center justify-between"
                                    )}
                                  >
                                    <span className="truncate">{subject.name}</span>
                                    {isSelected ? (
                                      <Check className="h-4 w-4 text-neutral-300" />
                                    ) : null}
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {errors.subjectIds && (
                  <p className="text-xs text-rose-400">{errors.subjectIds.message}</p>
                )}

                {/* Selected subjects preview */}
                {selectedSubjectIds.length > 0 && (
                  <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3">
                    <p className="mb-2 text-xs font-medium text-white/70">
                      Selected Subjects ({selectedSubjectIds.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedSubjectIds.map((subjectId) => {
                        const subject = subjects.find((s) => s.id === subjectId);
                        if (!subject) return null;
                        return (
                          <Badge
                            key={subjectId}
                            variant="outline"
                            className="rounded-full border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300"
                          >
                            {subject.name}
                            <button
                              type="button"
                              onClick={() => toggleSubject(subjectId)}
                              className="ml-1.5 hover:text-emerald-200"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="mt-6 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="border-white/10 bg-white/5 text-white hover:bg-white/10"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-emerald-500 text-white hover:bg-emerald-600"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  `Save Changes (${selectedSubjectIds.length})`
                )}
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
