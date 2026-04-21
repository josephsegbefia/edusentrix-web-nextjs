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
  Info,
  UserPlus,
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
import { useAssignHomeroom } from "@/hooks/admin/useTeachers";
import { useBusyToast } from "@/hooks/useBusyToast";
import { premiumSelectContent, premiumMenuItem } from "@/components/ui/premium";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { ClassGroupDTO } from "@/hooks/admin/useClasses";
import { useMutation } from "@tanstack/react-query";

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
  const assignHomeroom = useAssignHomeroom();
  const [query, setQuery] = React.useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const { data: classesData, isLoading: isLoadingClasses } = useClassGroupSearch(
    debouncedQuery
  );
  const classes = classesData?.data || [];

  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [homeroomConflict, setHomeroomConflict] = React.useState<{
    message: string;
    currentTeacherName: string;
    classGroupId: string;
  } | null>(null);

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
      setHomeroomConflict(null);
      setPickerOpen(false);
    }
  }, [open, reset]);

  React.useEffect(() => {
    if (
      homeroomConflict &&
      selectedClassId &&
      selectedClassId !== homeroomConflict.classGroupId
    ) {
      setHomeroomConflict(null);
    }
  }, [selectedClassId, homeroomConflict]);

  const onSubmit = async (data: ClassFormValues) => {
    setHomeroomConflict(null);
    busy.show("Saving homeroom…");
    try {
      await assignHomeroom.mutateAsync({
        teacherId,
        classGroupId: data.classGroupId,
        replaceExisting: false,
      });
      busy.hide();
      busy.success("Homeroom assigned", {
        description: `${teacherName} is now the form teacher for that class.`,
      });
      onOpenChange(false);
    } catch (e: unknown) {
      busy.hide();
      const err = e as {
        message?: string;
        meta?: {
          conflict?: {
            type?: string;
            message?: string;
            currentTeacherName?: string;
          };
        };
      };
      if (err?.meta?.conflict?.type === "homeroom_exists") {
        setHomeroomConflict({
          message:
            String(err.meta.conflict.message || "") ||
            "This class already has a homeroom teacher.",
          currentTeacherName: String(
            err.meta.conflict.currentTeacherName || "Another teacher"
          ),
          classGroupId: data.classGroupId,
        });
        return;
      }
      busy.error(err?.message || "Could not assign homeroom");
    }
  };

  async function onReplaceExisting() {
    if (!homeroomConflict?.classGroupId) return;
    busy.show("Updating homeroom…");
    try {
      await assignHomeroom.mutateAsync({
        teacherId,
        classGroupId: homeroomConflict.classGroupId,
        replaceExisting: true,
      });
      busy.hide();
      busy.success("Homeroom updated", {
        description: `${teacherName} is now the form teacher for this class.`,
      });
      setHomeroomConflict(null);
      onOpenChange(false);
    } catch (e: unknown) {
      busy.hide();
      const err = e as { message?: string };
      busy.error(err?.message || "Could not assign homeroom");
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
          onClick={() => onOpenChange(false)}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-neutral-950 shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-white/10 p-6">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-violet-500/30 bg-violet-500/10">
                <Home className="h-5 w-5 text-violet-300" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-white truncate">
                  Homeroom class
                </h2>
                <p className="text-sm text-white/60 truncate">{teacherName}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 shrink-0 rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="p-6">
            <div className="space-y-6">
              <div className="flex gap-3 rounded-xl border border-violet-500/20 bg-violet-500/[0.07] p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-400/25 bg-violet-500/15">
                  <Home className="h-5 w-5 text-violet-200" />
                </div>
                <div className="min-w-0 text-sm text-white/85">
                  <p className="font-medium text-violet-100">Pick a class in seconds</p>
                  <p className="mt-1 text-xs text-white/65 leading-relaxed">
                    Search by stream name or grade. Homeroom is the teacher who leads this class day to day
                    (attendance, notices). You can change this anytime.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="classGroupId" className="text-white">
                  Class
                </Label>
                <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12 w-full min-w-0 justify-between border border-white/10 bg-white/5 text-white hover:bg-white/10"
                    >
                      {selectedClass ? (
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-violet-500/20 text-xs font-bold text-violet-300">
                            {selectedClass.name?.charAt(0) || "C"}
                          </div>
                          <span className="truncate text-left">
                            {selectedClass.label || selectedClass.gradeName
                              ? `${selectedClass.gradeName || ""} ${selectedClass.name}`.trim()
                              : selectedClass.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-white/50">Search and select a class…</span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-70" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className={cn(
                      premiumSelectContent,
                      "w-[--radix-popover-trigger-width] p-1 max-h-[400px]"
                    )}
                    align="start"
                  >
                    <Command shouldFilter={false} className="bg-transparent">
                      <CommandInput
                        placeholder="Type grade or class name…"
                        value={query}
                        onValueChange={setQuery}
                        className="border-b border-neutral-800/60 bg-transparent"
                      />
                      <CommandList className="max-h-[300px] overflow-y-auto">
                        {isLoadingClasses ? (
                          <div className="px-3 py-3 text-sm text-neutral-400">
                            Loading classes…
                          </div>
                        ) : (
                          <>
                            <CommandEmpty className="py-6 text-center text-sm text-neutral-400">
                              {query.trim()
                                ? "No classes match. Try a shorter search."
                                : "Start typing to filter, or browse the list below."}
                            </CommandEmpty>
                            <CommandGroup>
                              {classes.map((cls) => (
                                <CommandItem
                                  key={cls.id}
                                  value={cls.id}
                                  onSelect={() => {
                                    setValue("classGroupId", cls.id, {
                                      shouldValidate: true,
                                    });
                                    setPickerOpen(false);
                                  }}
                                  className={cn(
                                    premiumMenuItem,
                                    "flex items-center justify-between gap-2"
                                  )}
                                >
                                  <div className="flex min-w-0 items-center gap-2">
                                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-violet-500/20 text-xs font-bold text-violet-300">
                                      {cls.name?.charAt(0) || "C"}
                                    </div>
                                    <span className="truncate">
                                      {cls.label || cls.gradeName
                                        ? `${cls.gradeName || ""} ${cls.name}`.trim()
                                        : cls.name}
                                    </span>
                                  </div>
                                  {selectedClassId === cls.id ? (
                                    <Check className="h-4 w-4 shrink-0 text-neutral-300" />
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

              {homeroomConflict && (
                <div className="rounded-xl border border-violet-400/30 bg-violet-500/15 px-3 py-3 text-sm">
                  <div className="flex gap-2">
                    <Info className="h-4 w-4 shrink-0 text-violet-200 mt-0.5" />
                    <div className="min-w-0 space-y-3">
                      <p className="font-medium text-white">This class already has a homeroom teacher</p>
                      <p className="text-xs text-white/70 leading-relaxed">{homeroomConflict.message}</p>
                      <p className="text-xs text-white/55">
                        Choose whether {teacherName} should take over as the only homeroom teacher for this class.
                      </p>
                      <div className="flex w-full min-w-0 flex-col gap-2 pt-1">
                        <Button
                          type="button"
                          className="h-auto min-h-8 w-full max-w-full whitespace-normal px-3 py-2.5 text-center leading-snug bg-violet-500 text-white hover:bg-violet-600"
                          disabled={assignHomeroom.isPending}
                          onClick={() => void onReplaceExisting()}
                        >
                          Replace {homeroomConflict.currentTeacherName} with {teacherName}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-auto min-h-8 w-full max-w-full whitespace-normal border-white/15 bg-white/5 px-3 py-2.5 text-center leading-snug text-white hover:bg-white/10"
                          onClick={() => setHomeroomConflict(null)}
                        >
                          Choose a different class
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="border-white/10 bg-white/5 text-white hover:bg-white/10 w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !selectedClassId || assignHomeroom.isPending}
                className="bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-50 w-full sm:w-auto"
              >
                {isSubmitting || assignHomeroom.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Assign homeroom
                  </>
                )}
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
