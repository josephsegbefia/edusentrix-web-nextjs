// src/components/modals/AssignTeacherToSubjectModal.tsx
"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  UserPlus,
  Check,
  ChevronsUpDown,
  Loader2,
  AlertTriangle,
  Info,
  BookOpen,
  School,
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
import {
  useTeacherSearch,
  useSubjectSearch,
  useClassGroupSearch,
} from "@/hooks/admin/useDirectorySearch";
import { useAssignTeacherToSubject } from "@/hooks/admin/useSubjects";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useAcademicPeriods } from "@/hooks/admin/useAcademicPeriods";
import { premiumSelectContent, premiumMenuItem } from "@/components/ui/premium";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import type { SubjectDTO } from "@/hooks/admin/useSubjects";

const schema = z.object({
  teacherId: z.string().min(1, "Select a teacher"),
  subjectId: z.string().min(1, "Select a subject"),
  classGroupId: z.string().min(1, "Select a class group"),
  academicPeriodId: z.string().optional(),
  allowMultiple: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

type AssignTeacherToSubjectModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject?: SubjectDTO;
  initialClassGroupId?: string;
};

export function AssignTeacherToSubjectModal({
  open,
  onOpenChange,
  subject,
  initialClassGroupId,
}: AssignTeacherToSubjectModalProps) {
  const busy = useBusyToast();
  const assignTeacher = useAssignTeacherToSubject();
  const [teacherQuery, setTeacherQuery] = React.useState("");
  const [subjectQuery, setSubjectQuery] = React.useState("");
  const [classQuery, setClassQuery] = React.useState("");
  const debouncedTeacherQuery = useDebouncedValue(teacherQuery, 300);
  const debouncedSubjectQuery = useDebouncedValue(subjectQuery, 300);
  const debouncedClassQuery = useDebouncedValue(classQuery, 300);

  const { data: teachersData, isLoading: isLoadingTeachers } = useTeacherSearch(
    debouncedTeacherQuery
  );
  const { data: subjectsData, isLoading: isLoadingSubjects } = useSubjectSearch(
    debouncedSubjectQuery
  );
  const { data: classesData, isLoading: isLoadingClasses } = useClassGroupSearch(
    debouncedClassQuery
  );
  const { data: periodsData } = useAcademicPeriods();

  const teachers = teachersData?.data || [];
  const subjects = subjectsData?.data || [];
  const classes = classesData?.data || [];
  const periods = periodsData?.periods || [];
  const currentPeriod = periods.find((p) => p.isCurrent) || periods[0];

  const {
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      teacherId: "",
      subjectId: subject?.id || "",
      classGroupId: initialClassGroupId || "",
      academicPeriodId: currentPeriod?._id || "",
      allowMultiple: false,
    },
  });

  const selectedTeacherId = watch("teacherId");
  const selectedSubjectId = watch("subjectId");
  const selectedClassId = watch("classGroupId");
  const allowMultiple = watch("allowMultiple");

  const selectedTeacher = React.useMemo(
    () => teachers.find((t) => t.id === selectedTeacherId),
    [teachers, selectedTeacherId]
  );
  const selectedSubject = React.useMemo(
    () => subjects.find((s) => s.id === selectedSubjectId),
    [subjects, selectedSubjectId]
  );
  const selectedClass = React.useMemo(
    () => classes.find((c) => c.id === selectedClassId),
    [classes, selectedClassId]
  );

  React.useEffect(() => {
    if (open) {
      reset({
        teacherId: "",
        subjectId: subject?.id || "",
        classGroupId: initialClassGroupId || "",
        academicPeriodId: currentPeriod?._id || "",
        allowMultiple: false,
      });
      setTeacherQuery("");
      setSubjectQuery("");
      setClassQuery("");
    }
  }, [open, subject?.id, initialClassGroupId, currentPeriod?._id, reset]);

  const [conflictError, setConflictError] = React.useState<string | null>(null);

  const onSubmit = async (data: FormValues) => {
    setConflictError(null);
    try {
      await busy.promise(
        assignTeacher.mutateAsync({
          teacherId: data.teacherId,
          subjectId: data.subjectId,
          classGroupId: data.classGroupId,
          academicPeriodId: data.academicPeriodId,
          allowMultiple: data.allowMultiple,
        }),
        {
          loading: "Assigning teacher...",
          success: "Teacher assigned successfully",
          error: (e: Error) => {
            // Check if it's a conflict error
            if (e.message.includes("already assigned") || e.message.includes("Conflict")) {
              setConflictError(e.message);
              return e.message;
            }
            return e.message || "Failed to assign teacher";
          },
        }
      );
      onOpenChange(false);
    } catch (e) {
      // Error handled by busy.promise
      if (e instanceof Error && (e.message.includes("already assigned") || e.message.includes("Conflict"))) {
        setConflictError(e.message);
      }
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
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10">
                <UserPlus className="h-5 w-5 text-rose-300" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Assign Teacher to Subject
                </h2>
                <p className="text-sm text-white/60">
                  {subject ? `Assigning teachers to ${subject.name}` : "Select teacher, subject, and class"}
                </p>
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
              {/* Conflict warning */}
              {conflictError && (
                <Alert className="border-amber-400/20 bg-amber-500/10">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  <AlertDescription className="text-amber-100">
                    {conflictError}
                    <div className="mt-2">
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={allowMultiple}
                          onCheckedChange={(checked) =>
                            setValue("allowMultiple", checked === true)
                          }
                        />
                        <span>Allow multiple teachers (co-teaching)</span>
                      </label>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Info */}
              <Alert className="border-sky-400/20 bg-sky-500/10">
                <Info className="h-4 w-4 text-sky-400" />
                <AlertDescription className="text-sky-100">
                  By default, only one teacher can teach a subject in a class. Enable "Allow multiple teachers" to allow co-teaching.
                </AlertDescription>
              </Alert>

              {/* Teacher selection */}
              <div className="space-y-2">
                <Label htmlFor="teacherId" className="text-white">
                  Teacher <span className="text-rose-400">*</span>
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
                              <AvatarFallback className="bg-linear-to-br from-rose-600 to-pink-700 text-[10px] font-semibold text-white">
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
                        value={teacherQuery}
                        onValueChange={setTeacherQuery}
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
                                        <AvatarFallback className="bg-linear-to-br from-rose-600 to-pink-700 text-[10px] font-semibold text-white">
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

              {/* Subject selection */}
              <div className="space-y-2">
                <Label htmlFor="subjectId" className="text-white">
                  Subject <span className="text-rose-400">*</span>
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12 w-full justify-between border border-white/10 bg-white/5 text-white hover:bg-white/10"
                    >
                      {selectedSubject ? (
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-rose-300" />
                          <span className="truncate">{selectedSubject.name}</span>
                        </div>
                      ) : (
                        <span className="text-white/50">Select a subject...</span>
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
                        placeholder="Search subjects..."
                        value={subjectQuery}
                        onValueChange={setSubjectQuery}
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
                              {subjects.map((subject) => (
                                <CommandItem
                                  key={subject.id}
                                  value={subject.id}
                                  onSelect={() => {
                                    setValue("subjectId", subject.id);
                                  }}
                                  className={cn(
                                    premiumMenuItem,
                                    "flex items-center justify-between"
                                  )}
                                >
                                  <span className="truncate">{subject.name}</span>
                                  {selectedSubjectId === subject.id ? (
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
                {errors.subjectId && (
                  <p className="text-xs text-rose-400">{errors.subjectId.message}</p>
                )}
              </div>

              {/* Class selection */}
              <div className="space-y-2">
                <Label htmlFor="classGroupId" className="text-white">
                  Class Group <span className="text-rose-400">*</span>
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
                          <School className="h-4 w-4 text-rose-300" />
                          <span className="truncate">{selectedClass.label || selectedClass.name}</span>
                        </div>
                      ) : (
                        <span className="text-white/50">Select a class group...</span>
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
                        value={classQuery}
                        onValueChange={setClassQuery}
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
                              {classes.map((classGroup) => (
                                <CommandItem
                                  key={classGroup.id}
                                  value={classGroup.id}
                                  onSelect={() => {
                                    setValue("classGroupId", classGroup.id);
                                  }}
                                  className={cn(
                                    premiumMenuItem,
                                    "flex items-center justify-between"
                                  )}
                                >
                                  <span className="truncate">
                                    {classGroup.label || classGroup.name}
                                  </span>
                                  {selectedClassId === classGroup.id ? (
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

              {/* Allow multiple checkbox */}
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-3">
                <Checkbox
                  id="allowMultiple"
                  checked={allowMultiple}
                  onCheckedChange={(checked) =>
                    setValue("allowMultiple", checked === true)
                  }
                />
                <Label
                  htmlFor="allowMultiple"
                  className="cursor-pointer text-sm text-white/90"
                >
                  Allow multiple teachers (co-teaching)
                </Label>
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
                className="bg-rose-500 text-white hover:bg-rose-600"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  "Assign Teacher"
                )}
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
