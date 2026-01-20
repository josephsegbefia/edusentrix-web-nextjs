/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import { useForm, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  UpdateTeacherSchema,
  type UpdateTeacherInput,
} from "@/schemas/teacher";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useAuth } from "@/providers/auth-provider";
import { ImageUploader } from "@/components/upload/ImageUploader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Check, X, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import type { TeacherDetailDTO, TeacherStatus } from "@/types/admin/teacher";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacher: TeacherDetailDTO;
  onSubmit: (payload: UpdateTeacherInput) => Promise<void>;
  isLoading?: boolean;
};

type SubjectLite = { _id: string; name: string };
type ClassGroupLite = { _id: string; name: string; gradeLabel?: string };

const STEPS = [
  {
    id: 1,
    title: "Personal Details",
    fields: ["firstName", "lastName", "email", "phone"],
  },
  { id: 2, title: "Photo & Status", fields: ["photoUrl", "status"] },
  {
    id: 3,
    title: "Professional Info",
    fields: [
      "employeeId",
      "department",
      "hireDate",
      "terminationDate",
      "maxClasses",
      "maxStudents",
    ],
  },
  {
    id: 4,
    title: "Assignments",
    fields: ["subjectIds", "homeroomClassGroupId", "notes"],
  },
] as const;

function getInitials(firstName?: string, lastName?: string): string {
  const first = firstName?.charAt(0)?.toUpperCase() || "";
  const last = lastName?.charAt(0)?.toUpperCase() || "";
  return first + last || "?";
}

export default function EditTeacherModal({
  open,
  onOpenChange,
  teacher,
  onSubmit,
  isLoading,
}: Props) {
  const busy = useBusyToast();
  const { me } = useAuth();
  const [currentStep, setCurrentStep] = React.useState(1);

  const {
    register,
    handleSubmit,
    control,
    trigger,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<UpdateTeacherInput>({
    resolver: zodResolver(UpdateTeacherSchema),
    defaultValues: {
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      email: teacher.email ?? "",
      phone: teacher.phone ?? "",
      photoUrl: teacher.photoUrl ?? undefined,
      status: teacher.status,
      employeeId: teacher.employeeId ?? "",
      department: teacher.department ?? "",
      hireDate: teacher.hireDate ? teacher.hireDate.split("T")[0] : "",
      terminationDate: teacher.terminationDate
        ? teacher.terminationDate.split("T")[0]
        : "",
      maxClasses: teacher.maxClasses ?? undefined,
      maxStudents: teacher.maxStudents ?? undefined,
      subjectIds: teacher.subjects.map((s) => s.id),
      homeroomClassGroupId: teacher.homeroom?.id ?? "",
      notes: teacher.notes ?? "",
    },
    mode: "onChange",
  });

  const firstName = useWatch({ control, name: "firstName" });
  const lastName = useWatch({ control, name: "lastName" });
  const photoUrl = useWatch({ control, name: "photoUrl" });
  const subjectIds = useWatch({ control, name: "subjectIds" }) ?? [];
  const currentStatus = useWatch({ control, name: "status" });

  const currentStepData = STEPS[currentStep - 1];
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === STEPS.length;
  const isPending = isSubmitting || isLoading;

  // ------- Debounced searches -------
  const [qClass, setQClass] = React.useState("");
  const dqClass = useDebouncedValue(qClass, 350);
  const [classResults, setClassResults] = React.useState<ClassGroupLite[]>([]);
  const [classLoading, setClassLoading] = React.useState(false);

  const [qSubj, setQSubj] = React.useState("");
  const dqSubj = useDebouncedValue(qSubj, 350);
  const [subjectResults, setSubjectResults] = React.useState<SubjectLite[]>([]);
  const [subjectsLoading, setSubjectsLoading] = React.useState(false);

  // Load initial subjects for display
  const [initialSubjects, setInitialSubjects] = React.useState<SubjectLite[]>(
    teacher.subjects.map((s) => ({ _id: s.id, name: s.name }))
  );

  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (dqClass.trim().length < 1) {
        setClassResults([]);
        return;
      }
      setClassLoading(true);
      try {
        const res = await fetch(
          `/api/admin/class-groups/search?q=${encodeURIComponent(
            dqClass
          )}&limit=12`,
          { cache: "no-store" }
        );
        const json = await res.json();
        if (alive && json?.success) {
          // Map API response to match ClassGroupLite type
          setClassResults(
            (json.data || []).map((g: any) => ({
              _id: g.id,
              name: g.name,
              gradeLabel: g.label || g.gradeName || undefined,
            }))
          );
        }
      } catch {
      } finally {
        if (alive) setClassLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [dqClass]);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (dqSubj.trim().length < 1) {
        setSubjectResults([]);
        return;
      }
      setSubjectsLoading(true);
      try {
        const res = await fetch(
          `/api/admin/subjects/search?q=${encodeURIComponent(dqSubj)}&limit=12`,
          { cache: "no-store" }
        );
        const json = await res.json();
        if (alive && json?.success) {
          // Map API response to match SubjectLite type
          setSubjectResults(
            (json.data || []).map((s: any) => ({
              _id: s.id,
              name: s.name,
            }))
          );
        }
      } catch {
      } finally {
        if (alive) setSubjectsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [dqSubj]);

  const toggleSubject = (id: string, name?: string) => {
    const current = new Set(subjectIds);
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
      if (name && !initialSubjects.find((s) => s._id === id)) {
        setInitialSubjects((prev) => [...prev, { _id: id, name }]);
      }
    }
    setValue("subjectIds", Array.from(current), { shouldValidate: true });
  };

  async function handleNext() {
    const fields = currentStepData.fields;
    const isValid = await trigger([...fields] as (keyof UpdateTeacherInput)[]);
    if (isValid) {
      setCurrentStep((s) => Math.min(s + 1, STEPS.length));
    }
  }

  function handlePrevious() {
    setCurrentStep((s) => Math.max(s - 1, 1));
  }

  function handleRemovePhoto() {
    setValue("photoUrl", undefined, { shouldValidate: true });
  }

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

  async function internalSubmit(values: UpdateTeacherInput) {
    // Only send changed values
    const payload: UpdateTeacherInput = {};

    if (values.firstName !== teacher.firstName)
      payload.firstName = values.firstName;
    if (values.lastName !== teacher.lastName)
      payload.lastName = values.lastName;
    if (values.email !== (teacher.email ?? "")) payload.email = values.email;
    if (values.phone !== (teacher.phone ?? ""))
      payload.phone = values.phone || null;
    if (values.photoUrl !== (teacher.photoUrl ?? undefined))
      payload.photoUrl = values.photoUrl || null;
    if (values.status !== teacher.status) payload.status = values.status;
    if (values.employeeId !== (teacher.employeeId ?? ""))
      payload.employeeId = values.employeeId || null;
    if (values.department !== (teacher.department ?? ""))
      payload.department = values.department || null;

    const originalHireDate = teacher.hireDate
      ? teacher.hireDate.split("T")[0]
      : "";
    const originalTermDate = teacher.terminationDate
      ? teacher.terminationDate.split("T")[0]
      : "";
    if (values.hireDate !== originalHireDate)
      payload.hireDate = values.hireDate || null;
    if (values.terminationDate !== originalTermDate)
      payload.terminationDate = values.terminationDate || null;

    if (values.maxClasses !== (teacher.maxClasses ?? undefined))
      payload.maxClasses = values.maxClasses;
    if (values.maxStudents !== (teacher.maxStudents ?? undefined))
      payload.maxStudents = values.maxStudents;
    if (values.notes !== (teacher.notes ?? ""))
      payload.notes = values.notes || null;

    const originalSubjectIds = teacher.subjects
      .map((s) => s.id)
      .sort()
      .join(",");
    const newSubjectIds = (values.subjectIds || []).sort().join(",");
    if (newSubjectIds !== originalSubjectIds) {
      payload.subjectIds = values.subjectIds || [];
    }

    const originalHomeroom = teacher.homeroom?.id ?? "";
    if ((values.homeroomClassGroupId ?? "") !== originalHomeroom) {
      payload.homeroomClassGroupId = values.homeroomClassGroupId || null;
    }

    if (Object.keys(payload).length === 0) {
      onOpenChange(false);
      return;
    }

    try {
      await onSubmit(payload);
      onOpenChange(false);
    } catch (e: unknown) {
      console.error("Teacher update error:", e);
    }
  }

  if (!open) return null;

  if (!me?.schoolId) {
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
              if (e.target === e.currentTarget) onOpenChange(false);
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
                    <h1 className="text-lg font-semibold">Edit Teacher</h1>
                    <p className="text-sm text-white/60">
                      School ID not available.
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full text-white/70 hover:bg-white/10 hover:text-white"
                    onClick={() => onOpenChange(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="mt-5 h-px bg-white/10" />
              </div>

              <div className="px-6 py-6">
                <p className="text-sm text-white/70">
                  Please refresh and try again once your school profile is
                  available.
                </p>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  const initials = getInitials(firstName, lastName);
  const displaySubjects = qSubj.trim() ? subjectResults : initialSubjects;

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
                  <h1 className="text-lg font-semibold">Edit Teacher</h1>
                  <p className="text-sm text-white/60">
                    Update profile for{" "}
                    <span className="font-medium text-white/85">
                      {teacher.fullName}
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
              <form
                onSubmit={handleSubmit(internalSubmit)}
                className="space-y-8"
              >
                {/* Step Indicator - Simple dots like CreateStudentModal */}
                <div className="flex items-center justify-between pb-6">
                  <div className="text-sm text-white/70">
                    Step <span className="font-semibold">{currentStep}</span> of{" "}
                    {STEPS.length}
                  </div>
                  <div className="flex gap-1">
                    {STEPS.map((_, i) => (
                      <span
                        key={i}
                        className={`h-1.5 w-8 rounded-full transition-all ${
                          i + 1 <= currentStep ? "bg-brand" : "bg-white/20"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Form Content */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentStep}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-6"
                  >
                    {/* Step 1: Personal Details */}
                    {currentStep === 1 && (
                      <section className="space-y-4">
                        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                          Personal Details
                        </h2>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label
                              htmlFor="firstName"
                              className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                            >
                              First name *
                            </Label>
                            <Input
                              id="firstName"
                              {...register("firstName")}
                              placeholder="John"
                              className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                            />
                            {errors.firstName && (
                              <div className="text-xs text-rose-300">
                                {errors.firstName.message}
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label
                              htmlFor="lastName"
                              className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                            >
                              Last name *
                            </Label>
                            <Input
                              id="lastName"
                              {...register("lastName")}
                              placeholder="Doe"
                              className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                            />
                            {errors.lastName && (
                              <div className="text-xs text-rose-300">
                                {errors.lastName.message}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label
                              htmlFor="email"
                              className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                            >
                              Email *
                            </Label>
                            <Input
                              id="email"
                              type="email"
                              {...register("email")}
                              placeholder="john.doe@example.com"
                              className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                            />
                            {errors.email && (
                              <div className="text-xs text-rose-300">
                                {errors.email.message}
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label
                              htmlFor="phone"
                              className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                            >
                              Phone
                            </Label>
                            <Input
                              id="phone"
                              {...register("phone")}
                              placeholder="+233 XX XXX XXXX"
                              className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                            />
                          </div>
                        </div>
                      </section>
                    )}

                    {/* Step 2: Photo & Status */}
                    {currentStep === 2 && (
                      <section className="space-y-6">
                        <div className="space-y-4">
                          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                            Teacher Photo
                          </h2>

                          {/* Large Avatar Preview */}
                          <div className="flex flex-col items-center gap-4">
                            <motion.div
                              initial={{ scale: 0.9, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ duration: 0.3 }}
                              className="relative"
                            >
                              <div className="relative w-36 h-36 rounded-full border-4 border-white/10 bg-white/5 overflow-hidden shadow-lg">
                                <AnimatePresence mode="wait">
                                  {photoUrl ? (
                                    <motion.div
                                      key="photo"
                                      initial={{ opacity: 0, scale: 0.9 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      exit={{ opacity: 0, scale: 0.9 }}
                                      transition={{ duration: 0.2 }}
                                      className="relative w-full h-full"
                                    >
                                      <Image
                                        src={photoUrl}
                                        alt="Teacher photo"
                                        fill
                                        className="object-cover rounded-full"
                                        sizes="144px"
                                        priority
                                      />
                                    </motion.div>
                                  ) : (
                                    <motion.div
                                      key="initials"
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      exit={{ opacity: 0 }}
                                      className="w-full h-full flex items-center justify-center bg-linear-to-br from-brand/20 to-brand/10"
                                    >
                                      <span className="text-4xl font-bold text-brand">
                                        {initials}
                                      </span>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                              {photoUrl && (
                                <motion.button
                                  type="button"
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  onClick={handleRemovePhoto}
                                  className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-rose-500 hover:bg-rose-600 border-2 border-white/10 flex items-center justify-center text-white shadow-lg transition-colors"
                                >
                                  <X className="h-4 w-4" />
                                </motion.button>
                              )}
                            </motion.div>

                            {/* Upload Dropzone */}
                            <div className="w-full">
                              <ImageUploader
                                schoolId={me.schoolId}
                                subjectRole="teachers"
                                onUploaded={(payload) => {
                                  setValue("photoUrl", payload.url, {
                                    shouldValidate: true,
                                  });
                                }}
                                onError={(msg) => {
                                  busy.error(msg);
                                }}
                                className="w-full"
                                label=""
                              />
                            </div>
                          </div>
                          {errors.photoUrl && (
                            <div className="text-xs text-rose-300 text-center">
                              {errors.photoUrl.message}
                            </div>
                          )}
                        </div>

                        <div className="space-y-4">
                          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                            Status
                          </h2>
                          <Controller
                            name="status"
                            control={control}
                            render={({ field }) => (
                              <div className="grid grid-cols-2 gap-3">
                                {(
                                  [
                                    "active",
                                    "inactive",
                                    "on_leave",
                                    "terminated",
                                  ] as TeacherStatus[]
                                ).map((s) => (
                                  <motion.label
                                    key={s}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-all cursor-pointer ${
                                      field.value === s
                                        ? "border-brand bg-brand/20 text-brand"
                                        : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80"
                                    }`}
                                  >
                                    <input
                                      type="radio"
                                      value={s}
                                      checked={field.value === s}
                                      onChange={() => field.onChange(s)}
                                      className="sr-only"
                                    />
                                    <span className="capitalize">
                                      {s.replace("_", " ")}
                                    </span>
                                  </motion.label>
                                ))}
                              </div>
                            )}
                          />
                        </div>
                      </section>
                    )}

                    {/* Step 3: Professional Info */}
                    {currentStep === 3 && (
                      <section className="space-y-4">
                        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                          Professional Information
                        </h2>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label
                              htmlFor="employeeId"
                              className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                            >
                              Employee ID
                            </Label>
                            <Input
                              id="employeeId"
                              {...register("employeeId")}
                              placeholder="EMP-001"
                              className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label
                              htmlFor="department"
                              className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                            >
                              Department
                            </Label>
                            <Input
                              id="department"
                              {...register("department")}
                              placeholder="Mathematics"
                              className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label
                              htmlFor="hireDate"
                              className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                            >
                              Hire Date
                            </Label>
                            <Input
                              id="hireDate"
                              type="date"
                              {...register("hireDate")}
                              className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                            />
                          </div>
                          {currentStatus === "terminated" && (
                            <div className="space-y-2">
                              <Label
                                htmlFor="terminationDate"
                                className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                              >
                                Termination Date
                              </Label>
                              <Input
                                id="terminationDate"
                                type="date"
                                {...register("terminationDate")}
                                className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                              />
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label
                              htmlFor="maxClasses"
                              className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                            >
                              Max Classes
                            </Label>
                            <Input
                              id="maxClasses"
                              type="number"
                              min={0}
                              {...register("maxClasses", {
                                valueAsNumber: true,
                              })}
                              placeholder="e.g., 6"
                              className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label
                              htmlFor="maxStudents"
                              className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                            >
                              Max Students
                            </Label>
                            <Input
                              id="maxStudents"
                              type="number"
                              min={0}
                              {...register("maxStudents", {
                                valueAsNumber: true,
                              })}
                              placeholder="e.g., 150"
                              className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                            />
                          </div>
                        </div>
                      </section>
                    )}

                    {/* Step 4: Assignments */}
                    {currentStep === 4 && (
                      <section className="space-y-6">
                        <div className="space-y-4">
                          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                            Subject Assignments
                          </h2>

                          {/* Subject Search */}
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                            <Input
                              type="text"
                              placeholder="Search subjects..."
                              value={qSubj}
                              onChange={(e) => setQSubj(e.target.value)}
                              className="pl-10 border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                            />
                          </div>

                          <div className="max-h-64 overflow-y-auto rounded-lg border border-white/10 bg-white/5 p-4">
                            {subjectsLoading ? (
                              <div className="text-xs text-white/50 py-4 text-center">
                                Loading subjects…
                              </div>
                            ) : displaySubjects.length === 0 ? (
                              <div className="text-xs text-white/50 py-4 text-center">
                                {qSubj.trim()
                                  ? "No subjects found matching your search"
                                  : "No subjects assigned. Search to add subjects."}
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {displaySubjects.map((s) => {
                                  const isSelected = subjectIds.includes(s._id);
                                  return (
                                    <motion.button
                                      key={s._id}
                                      type="button"
                                      whileHover={{ scale: 1.02 }}
                                      whileTap={{ scale: 0.98 }}
                                      onClick={() =>
                                        toggleSubject(s._id, s.name)
                                      }
                                      className={`relative rounded-lg border-2 px-4 py-3 text-left transition-all ${
                                        isSelected
                                          ? "border-brand bg-brand/20 text-brand shadow-lg shadow-brand/20"
                                          : "border-white/10 bg-white/5 text-white/80 hover:border-white/20 hover:bg-white/10"
                                      }`}
                                    >
                                      {isSelected && (
                                        <motion.div
                                          initial={{ scale: 0 }}
                                          animate={{ scale: 1 }}
                                          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-brand text-black flex items-center justify-center"
                                        >
                                          <Check className="h-4 w-4" />
                                        </motion.div>
                                      )}
                                      <span className="font-semibold text-sm">
                                        {s.name}
                                      </span>
                                    </motion.button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          {subjectIds.length > 0 && (
                            <p className="text-xs text-white/50">
                              {subjectIds.length} subject
                              {subjectIds.length !== 1 ? "s" : ""} assigned
                            </p>
                          )}
                        </div>

                        <div className="space-y-4">
                          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                            Homeroom Assignment
                          </h2>

                          {/* Class Group Search */}
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                            <Input
                              type="text"
                              placeholder="Search class groups..."
                              value={qClass}
                              onChange={(e) => setQClass(e.target.value)}
                              className="pl-10 border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                            />
                          </div>

                          <Controller
                            name="homeroomClassGroupId"
                            control={control}
                            render={({ field }) => (
                              <div className="max-h-64 overflow-y-auto rounded-lg border border-white/10 bg-white/5 p-4">
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                  {/* No homeroom option */}
                                  <motion.button
                                    type="button"
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => field.onChange("")}
                                    className={`relative rounded-lg border-2 px-4 py-3 text-left transition-all ${
                                      !field.value
                                        ? "border-brand bg-brand/20 text-brand shadow-lg shadow-brand/20"
                                        : "border-white/10 bg-white/5 text-white/80 hover:border-white/20 hover:bg-white/10"
                                    }`}
                                  >
                                    {!field.value && (
                                      <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-brand text-black flex items-center justify-center"
                                      >
                                        <Check className="h-4 w-4" />
                                      </motion.div>
                                    )}
                                    <span className="font-semibold text-sm">
                                      No homeroom
                                    </span>
                                  </motion.button>

                                  {/* Current homeroom if exists */}
                                  {teacher.homeroom &&
                                    !classResults.find(
                                      (c) => c._id === teacher.homeroom?.id
                                    ) && (
                                      <motion.button
                                        type="button"
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() =>
                                          field.onChange(teacher.homeroom?.id)
                                        }
                                        className={`relative rounded-lg border-2 px-4 py-3 text-left transition-all ${
                                          field.value === teacher.homeroom.id
                                            ? "border-brand bg-brand/20 text-brand shadow-lg shadow-brand/20"
                                            : "border-white/10 bg-white/5 text-white/80 hover:border-white/20 hover:bg-white/10"
                                        }`}
                                      >
                                        {field.value ===
                                          teacher.homeroom.id && (
                                          <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-brand text-black flex items-center justify-center"
                                          >
                                            <Check className="h-4 w-4" />
                                          </motion.div>
                                        )}
                                        <span className="font-semibold text-sm">
                                          {teacher.homeroom.name}
                                        </span>
                                      </motion.button>
                                    )}

                                  {/* Search results */}
                                  {classLoading ? (
                                    <div className="col-span-full text-xs text-white/50 py-4 text-center">
                                      Loading class groups…
                                    </div>
                                  ) : (
                                    classResults.map((cg) => {
                                      const selected = field.value === cg._id;
                                      return (
                                        <motion.button
                                          key={cg._id}
                                          type="button"
                                          whileHover={{ scale: 1.02 }}
                                          whileTap={{ scale: 0.98 }}
                                          onClick={() => field.onChange(cg._id)}
                                          className={`relative rounded-lg border-2 px-4 py-3 text-left transition-all ${
                                            selected
                                              ? "border-brand bg-brand/20 text-brand shadow-lg shadow-brand/20"
                                              : "border-white/10 bg-white/5 text-white/80 hover:border-white/20 hover:bg-white/10"
                                          }`}
                                        >
                                          {selected && (
                                            <motion.div
                                              initial={{ scale: 0 }}
                                              animate={{ scale: 1 }}
                                              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-brand text-black flex items-center justify-center"
                                            >
                                              <Check className="h-4 w-4" />
                                            </motion.div>
                                          )}
                                          <div className="flex flex-col">
                                            <span className="font-semibold text-sm">
                                              {cg.name}
                                            </span>
                                            {cg.gradeLabel && (
                                              <span className="text-xs opacity-60">
                                                {cg.gradeLabel}
                                              </span>
                                            )}
                                          </div>
                                        </motion.button>
                                      );
                                    })
                                  )}
                                </div>
                              </div>
                            )}
                          />
                          <p className="text-xs text-white/50">
                            Assign this teacher as homeroom teacher for a class
                            group
                          </p>
                        </div>

                        {/* Notes */}
                        <div className="space-y-4">
                          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                            Internal Notes
                          </h2>
                          <textarea
                            {...register("notes")}
                            placeholder="Add internal notes about this teacher..."
                            className="w-full h-24 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand resize-none"
                          />
                        </div>
                      </section>
                    )}
                  </motion.div>
                </AnimatePresence>

                {/* Navigation Buttons */}
                <div className="flex items-center justify-between pt-6 border-t border-white/10">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={
                      isFirstStep ? () => onOpenChange(false) : handlePrevious
                    }
                    disabled={isPending}
                    className="gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    {isFirstStep ? "Cancel" : "Previous"}
                  </Button>

                  <div className="flex gap-2">
                    {!isLastStep ? (
                      <Button
                        type="button"
                        onClick={handleNext}
                        disabled={isPending}
                        className="gap-2 bg-brand text-black hover:opacity-90"
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        type="submit"
                        disabled={isPending}
                        className="gap-2 bg-brand text-black hover:opacity-90"
                      >
                        {isPending ? (
                          "Saving…"
                        ) : (
                          <>
                            <Check className="h-4 w-4" />
                            Save Changes
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
