// src/components/modals/AssignHomeroomModal.tsx
"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  UserCheck,
  Check,
  ChevronsUpDown,
  Loader2,
  Home,
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
import { useTeacherSearch, useClassGroupSearch } from "@/hooks/admin/useDirectorySearch";
import { useAssignHomeroomTeacher } from "@/hooks/admin/useClasses";
import { useBusyToast } from "@/hooks/useBusyToast";
import { premiumSelectContent, premiumMenuItem } from "@/components/ui/premium";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { ClassGroupDTO } from "@/hooks/admin/useClasses";
import { useMutation, useQueryClient } from "@tanstack/react-query";

// Schema for assigning teacher to class (from Classes page)
const teacherSchema = z.object({
  teacherId: z.string().nullable(),
});

// Schema for assigning class to teacher (from Teacher page)
const classSchema = z.object({
  classGroupId: z.string().min(1, "Please select a class"),
});

type TeacherFormValues = z.infer<typeof teacherSchema>;
type ClassFormValues = z.infer<typeof classSchema>;

// Props when used from Classes page (assign teacher to class)
type ClassModeProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classGroup: ClassGroupDTO;
  teacherId?: never;
  teacherName?: never;
};

// Props when used from Teacher page (assign class to teacher)
type TeacherModeProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacherId: string;
  teacherName: string;
  classGroup?: never;
};

type AssignHomeroomModalProps = ClassModeProps | TeacherModeProps;

/**
 * Modal for assigning homeroom relationships.
 * Two modes:
 * 1. Class mode: Assign a teacher to a class (from Classes page)
 * 2. Teacher mode: Assign a class to a teacher (from Teacher page)
 */
export function AssignHomeroomModal(props: AssignHomeroomModalProps) {
  const { open, onOpenChange } = props;

  // Determine mode based on props
  const isClassMode = "classGroup" in props && props.classGroup !== undefined;

  if (!open) return null;

  if (isClassMode) {
    return (
      <ClassModeModal
        open={open}
        onOpenChange={onOpenChange}
        classGroup={(props as ClassModeProps).classGroup}
      />
    );
  }

  return (
    <TeacherModeModal
      open={open}
      onOpenChange={onOpenChange}
      teacherId={(props as TeacherModeProps).teacherId}
      teacherName={(props as TeacherModeProps).teacherName}
    />
  );
}

/**
 * Class Mode: Assign a teacher to a class
 */
function ClassModeModal({
  open,
  onOpenChange,
  classGroup,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classGroup: ClassGroupDTO;
}) {
  const busy = useBusyToast();
  const assignHomeroom = useAssignHomeroomTeacher();
  const [query, setQuery] = React.useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const { data: teachersData, isLoading: isLoadingTeachers } = useTeacherSearch(
    debouncedQuery
  );
  const teachers = teachersData?.data || [];

  const {
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TeacherFormValues>({
    resolver: zodResolver(teacherSchema),
    defaultValues: {
      teacherId: classGroup.homeroomTeacher?.id || null,
    },
  });

  const selectedTeacherId = watch("teacherId");
  const selectedTeacher = React.useMemo(
    () => teachers.find((t) => t.id === selectedTeacherId),
    [teachers, selectedTeacherId]
  );

  React.useEffect(() => {
    if (open) {
      reset({
        teacherId: classGroup.homeroomTeacher?.id || null,
      });
      setQuery("");
    }
  }, [open, classGroup.homeroomTeacher?.id, reset]);

  const onSubmit = async (data: TeacherFormValues) => {
    try {
      await busy.promise(
        assignHomeroom.mutateAsync({
          classId: classGroup.id,
          teacherId: data.teacherId,
        }),
        {
          loading: data.teacherId
            ? "Assigning homeroom teacher..."
            : "Removing homeroom teacher...",
          success: data.teacherId
            ? "Homeroom teacher assigned successfully"
            : "Homeroom teacher removed successfully",
          error: (e: Error) => e.message || "Failed to assign homeroom teacher",
        }
      );
      onOpenChange(false);
    } catch {
      // Error handled by busy.promise
    }
  };

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
          className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-neutral-950 shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10">
                <UserCheck className="h-5 w-5 text-emerald-300" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Assign Homeroom Teacher
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
              {/* Current homeroom teacher */}
              {classGroup.homeroomTeacher && (
                <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-white/50">
                    Current Homeroom Teacher
                  </p>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-white/20">
                      {classGroup.homeroomTeacher.photoUrl ? (
                        <AvatarImage
                          src={classGroup.homeroomTeacher.photoUrl}
                          alt={classGroup.homeroomTeacher.fullName}
                        />
                      ) : (
                        <AvatarFallback className="bg-linear-to-br from-emerald-600 to-green-700 text-xs font-semibold text-white">
                          {classGroup.homeroomTeacher.firstName?.charAt(0) || ""}
                          {classGroup.homeroomTeacher.lastName?.charAt(0) || ""}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium text-white">
                        {classGroup.homeroomTeacher.fullName}
                      </p>
                      <p className="text-xs text-white/50">
                        {classGroup.homeroomTeacher.email}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Teacher selection */}
              <div className="space-y-2">
                <Label htmlFor="teacherId" className="text-white">
                  Select Teacher
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12 w-full justify-between border border-white/10 bg-white/5 text-white hover:bg-white/10"
                    >
                      {selectedTeacher ? (
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6 border border-white/20">
                            {selectedTeacher.photoUrl ? (
                              <AvatarImage
                                src={selectedTeacher.photoUrl}
                                alt={selectedTeacher.fullName}
                              />
                            ) : (
                              <AvatarFallback className="bg-linear-to-br from-emerald-600 to-green-700 text-[10px] font-semibold text-white">
                                {selectedTeacher.firstName?.charAt(0) || ""}
                                {selectedTeacher.lastName?.charAt(0) || ""}
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <span className="truncate">{selectedTeacher.fullName}</span>
                        </div>
                      ) : (
                        <span className="text-white/50">Select a teacher...</span>
                      )}
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
                        placeholder="Search teachers..."
                        value={query}
                        onValueChange={setQuery}
                        className="border-b border-neutral-800/60 bg-transparent"
                      />
                      <CommandList className="max-h-[300px] overflow-y-auto">
                        {isLoadingTeachers ? (
                          <div className="px-3 py-3 text-sm text-neutral-400">
                            Searching...
                          </div>
                        ) : (
                          <>
                            <CommandEmpty className="py-6 text-center text-sm text-neutral-400">
                              No teachers found.
                            </CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value="none"
                                onSelect={() => {
                                  setValue("teacherId", null);
                                }}
                                className={cn(
                                  premiumMenuItem,
                                  "flex items-center justify-between"
                                )}
                              >
                                <span className="text-white/60">Remove homeroom teacher</span>
                                {selectedTeacherId === null ? (
                                  <Check className="h-4 w-4 text-neutral-300" />
                                ) : null}
                              </CommandItem>
                              {teachers.map((teacher) => (
                                <CommandItem
                                  key={teacher.id}
                                  value={teacher.id}
                                  onSelect={() => {
                                    setValue("teacherId", teacher.id);
                                  }}
                                  className={cn(
                                    premiumMenuItem,
                                    "flex items-center justify-between gap-2"
                                  )}
                                >
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-6 w-6 border border-white/20">
                                      {teacher.photoUrl ? (
                                        <AvatarImage
                                          src={teacher.photoUrl}
                                          alt={teacher.fullName}
                                        />
                                      ) : (
                                        <AvatarFallback className="bg-linear-to-br from-emerald-600 to-green-700 text-[10px] font-semibold text-white">
                                          {teacher.firstName?.charAt(0) || ""}
                                          {teacher.lastName?.charAt(0) || ""}
                                        </AvatarFallback>
                                      )}
                                    </Avatar>
                                    <span className="truncate">{teacher.fullName}</span>
                                  </div>
                                  {selectedTeacherId === teacher.id ? (
                                    <Check className="h-4 w-4 text-neutral-300" />
                                  ) : null}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {errors.teacherId && (
                  <p className="text-xs text-rose-400">{errors.teacherId.message}</p>
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
                  "Save Changes"
                )}
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

/**
 * Teacher Mode: Assign a class to a teacher as homeroom
 */
function TeacherModeModal({
  open,
  onOpenChange,
  teacherId,
  teacherName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacherId: string;
  teacherName: string;
}) {
  const busy = useBusyToast();
  const queryClient = useQueryClient();
  const [query, setQuery] = React.useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const { data: classesData, isLoading: isLoadingClasses } = useClassGroupSearch(
    debouncedQuery
  );
  const classes = classesData?.data || [];

  const assignHomeroomMutation = useMutation({
    mutationFn: async (classGroupId: string) => {
      const res = await fetch(`/api/admin/classes/${classGroupId}/assign-homeroom`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Failed to assign homeroom" }));
        throw new Error(error.error || "Failed to assign homeroom");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      queryClient.invalidateQueries({ queryKey: ["teacher", teacherId] });
      queryClient.invalidateQueries({ queryKey: ["teacherHomeroom", teacherId] });
    },
  });

  const {
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ClassFormValues>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      classGroupId: "",
    },
  });

  const selectedClassId = watch("classGroupId");
  const selectedClass = React.useMemo(
    () => classes.find((c) => c.id === selectedClassId),
    [classes, selectedClassId]
  );

  React.useEffect(() => {
    if (open) {
      reset({ classGroupId: "" });
      setQuery("");
    }
  }, [open, reset]);

  const onSubmit = async (data: ClassFormValues) => {
    try {
      await busy.promise(
        assignHomeroomMutation.mutateAsync(data.classGroupId),
        {
          loading: "Assigning homeroom class...",
          success: "Homeroom class assigned successfully",
          error: (e: Error) => e.message || "Failed to assign homeroom class",
        }
      );
      onOpenChange(false);
    } catch {
      // Error handled by busy.promise
    }
  };

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
          className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-neutral-950 shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-violet-500/30 bg-violet-500/10">
                <Home className="h-5 w-5 text-violet-300" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Assign Homeroom Class
                </h2>
                <p className="text-sm text-white/60">{teacherName}</p>
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
              {/* Class selection */}
              <div className="space-y-2">
                <Label htmlFor="classGroupId" className="text-white">
                  Select Class
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12 w-full justify-between border border-white/10 bg-white/5 text-white hover:bg-white/10"
                    >
                      {selectedClass ? (
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded bg-violet-500/20 text-xs font-bold text-violet-300">
                            {selectedClass.name?.charAt(0) || "C"}
                          </div>
                          <span className="truncate">
                            {selectedClass.label || selectedClass.gradeName
                              ? `${selectedClass.gradeName || ""} ${selectedClass.name}`.trim()
                              : selectedClass.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-white/50">Select a class...</span>
                      )}
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
                        placeholder="Search classes..."
                        value={query}
                        onValueChange={setQuery}
                        className="border-b border-neutral-800/60 bg-transparent"
                      />
                      <CommandList className="max-h-[300px] overflow-y-auto">
                        {isLoadingClasses ? (
                          <div className="px-3 py-3 text-sm text-neutral-400">
                            Searching...
                          </div>
                        ) : (
                          <>
                            <CommandEmpty className="py-6 text-center text-sm text-neutral-400">
                              No classes found.
                            </CommandEmpty>
                            <CommandGroup>
                              {classes.map((cls) => (
                                <CommandItem
                                  key={cls.id}
                                  value={cls.id}
                                  onSelect={() => {
                                    setValue("classGroupId", cls.id);
                                  }}
                                  className={cn(
                                    premiumMenuItem,
                                    "flex items-center justify-between gap-2"
                                  )}
                                >
                                  <div className="flex items-center gap-2">
                                    <div className="flex h-6 w-6 items-center justify-center rounded bg-violet-500/20 text-xs font-bold text-violet-300">
                                      {cls.name?.charAt(0) || "C"}
                                    </div>
                                    <span className="truncate">
                                      {cls.label || cls.gradeName
                                        ? `${cls.gradeName || ""} ${cls.name}`.trim()
                                        : cls.name}
                                    </span>
                                  </div>
                                  {selectedClassId === cls.id ? (
                                    <Check className="h-4 w-4 text-neutral-300" />
                                  ) : null}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {errors.classGroupId && (
                  <p className="text-xs text-rose-400">{errors.classGroupId.message}</p>
                )}
              </div>

              <p className="text-xs text-white/50">
                Assigning a homeroom class will make {teacherName} the homeroom teacher for that class.
                If the class already has a homeroom teacher, they will be replaced.
              </p>
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
                disabled={isSubmitting || !selectedClassId}
                className="bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  "Assign Class"
                )}
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
