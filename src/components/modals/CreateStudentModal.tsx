/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import * as React from "react";
import { useForm, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateStudentSchema, CreateStudentInput } from "@/schemas/student";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useGradeOptions } from "@/hooks/admin/useGradeOptions";
import { useClassGroupOptions } from "@/hooks/admin/useClassGroupOptions";
import { useSubjectOptions } from "@/hooks/admin/useSubjectOptions";
import { useAuth } from "@/providers/auth-provider";
import { ImageUploader } from "@/components/upload/ImageUploader";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Wand2,
  Loader2,
  Info,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

type Props = {
  onClose: () => void;
  onSubmit: (payload: CreateStudentInput) => Promise<void> | void;
  isLoading?: boolean;
};

const STEPS = [
  {
    id: 1,
    title: "Basic Information",
    fields: [
      "firstName",
      "middleName",
      "lastName",
      "admissionNo",
      "sex",
      "dateOfBirth",
      "enrolledAt",
    ],
  },
  { id: 2, title: "Photo & Status", fields: ["photoUrl", "status"] },
  { id: 3, title: "Grade & Class", fields: ["gradeId", "classGroupId"] },
  {
    id: 4,
    title: "Subject Overrides",
    fields: ["subjectAddIds", "subjectRemoveIds"],
  },
] as const;

function getInitials(firstName?: string, lastName?: string): string {
  const first = firstName?.charAt(0)?.toUpperCase() || "";
  const last = lastName?.charAt(0)?.toUpperCase() || "";
  return first + last || "?";
}

export default function CreateStudentModal({
  onClose,
  onSubmit,
  isLoading,
}: Props) {
  const busy = useBusyToast();
  const { me } = useAuth();
  const [currentStep, setCurrentStep] = React.useState(1);
  const { data: grades = [], isLoading: loadingGrades } = useGradeOptions();

  // ID generation state
  const [generatingId, setGeneratingId] = React.useState(false);
  const [idGenerated, setIdGenerated] = React.useState(false);
  const [idBreakdown, setIdBreakdown] = React.useState<{
    schoolPrefix: string;
    enrollYear: string;
    birthMonth: string;
    initials: string;
    sequence: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    control,
    resetField,
    setValue,
    trigger,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateStudentInput>({
    resolver: zodResolver(CreateStudentSchema),
    defaultValues: {
      status: "active",
      enrolledAt: new Date().toISOString().slice(0, 10),
      subjectAddIds: [],
      subjectRemoveIds: [],
    },
    mode: "onChange",
  });

  const gradeId = useWatch({ control, name: "gradeId" });
  const classGroupId = useWatch({ control, name: "classGroupId" });
  const photoUrl = useWatch({ control, name: "photoUrl" });
  const firstName = useWatch({ control, name: "firstName" });
  const lastName = useWatch({ control, name: "lastName" });
  const dateOfBirth = useWatch({ control, name: "dateOfBirth" });
  const admissionNo = useWatch({ control, name: "admissionNo" });
  const subjectAddIds = useWatch({ control, name: "subjectAddIds" }) ?? [];
  const subjectRemoveIds =
    useWatch({ control, name: "subjectRemoveIds" }) ?? [];
  const { data: classGroups = [], isLoading: loadingClasses } =
    useClassGroupOptions(gradeId || "");
  const { data: subjects = [], isLoading: loadingSubjects } =
    useSubjectOptions();

  // Reset classGroup when grade changes
  React.useEffect(() => {
    if (gradeId) {
      resetField("classGroupId");
    }
  }, [gradeId, resetField]);

  // Auto-generate student ID when name + DOB are available and no ID has been generated yet
  const autoGenRef = React.useRef(false);
  React.useEffect(() => {
    if (
      firstName?.trim() &&
      lastName?.trim() &&
      dateOfBirth &&
      !idGenerated &&
      !autoGenRef.current &&
      !admissionNo?.trim()
    ) {
      autoGenRef.current = true;
      generateStudentId();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstName, lastName, dateOfBirth]);

  async function generateStudentId() {
    const fn = watch("firstName")?.trim();
    const ln = watch("lastName")?.trim();
    const dob = watch("dateOfBirth");

    if (!fn || !ln) {
      busy.error("Please fill in first name and last name first");
      return;
    }

    setGeneratingId(true);
    try {
      const res = await fetch("/api/admin/students/generate-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: fn,
          lastName: ln,
          dateOfBirth: dob ? dob.toISOString() : undefined,
        }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data = await res.json();
      if (data.success) {
        setValue("admissionNo", data.admissionNo, { shouldValidate: true });
        setIdGenerated(true);
        setIdBreakdown(data.breakdown ?? null);
      }
    } catch (e) {
      console.error("Failed to generate student ID:", e);
      autoGenRef.current = false;
    } finally {
      setGeneratingId(false);
    }
  }

  const currentStepData = STEPS[currentStep - 1];
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === STEPS.length;

  async function internalSubmit(values: CreateStudentInput) {
    try {
      await onSubmit({
        ...values,
        subjectRemoveIds: (values.subjectRemoveIds ?? []).filter(
          (id) => !(values.subjectAddIds ?? []).includes(id)
        ),
      });
      onClose();
    } catch (e: unknown) {
      console.error("Student creation error:", e);
    }
  }

  async function handleNext() {
    const fields = currentStepData.fields;
    const isValid = await trigger([...fields] as (keyof CreateStudentInput)[]);
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

  if (!me?.schoolId) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center">
        <div className="text-sm text-white/60">School ID not available</div>
      </div>
    );
  }

  const initials = getInitials(firstName, lastName);

  return (
    <form onSubmit={handleSubmit(internalSubmit)} className="space-y-8">
      {/* Step Indicator */}
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
          {/* Step 1: Basic Information */}
          {currentStep === 1 && (
            <section className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                Personal Details
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
                    placeholder="Ama"
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
                    htmlFor="middleName"
                    className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                  >
                    Middle name
                  </Label>
                  <Input
                    id="middleName"
                    {...register("middleName")}
                    placeholder="Akosua"
                    className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                  />
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
                    placeholder="Mensah"
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
                  <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                    Sex
                  </Label>
                  <Controller
                    name="sex"
                    control={control}
                    render={({ field }) => (
                      <div className="grid grid-cols-2 gap-3">
                        {(["male", "female"] as const).map((s) => (
                          <label
                            key={s}
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
                            <span className="capitalize">{s}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                    Date of Birth
                  </Label>
                  <Controller
                    name="dateOfBirth"
                    control={control}
                    render={({ field }) => (
                      <CustomDatePicker
                        value={field.value ?? null}
                        onChange={(d) => field.onChange(d ?? undefined)}
                        placeholder="Select date of birth"
                        maxDate={new Date()}
                        error={errors.dateOfBirth?.message}
                      />
                    )}
                  />
                </div>
              </div>

              {/* Student ID (Admission Number) — auto-generated */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="admissionNo"
                    className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                  >
                    Student ID (Admission Number)
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      autoGenRef.current = false;
                      setIdGenerated(false);
                      generateStudentId();
                    }}
                    disabled={generatingId || !firstName?.trim() || !lastName?.trim()}
                    className="h-7 gap-1.5 rounded-lg px-2.5 text-[11px] text-brand hover:bg-brand/10 hover:text-brand disabled:opacity-40"
                  >
                    {generatingId ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Wand2 className="h-3 w-3" />
                    )}
                    {generatingId ? "Generating…" : idGenerated ? "Regenerate" : "Generate ID"}
                  </Button>
                </div>
                <div className="relative">
                  <Input
                    id="admissionNo"
                    {...register("admissionNo")}
                    placeholder={generatingId ? "Generating…" : "Auto-generated or enter manually"}
                    className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand font-mono tracking-wide"
                  />
                  {generatingId && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-4 w-4 animate-spin text-brand/60" />
                    </div>
                  )}
                </div>
                {idBreakdown && idGenerated && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-2 rounded-lg border border-teal-500/20 bg-teal-500/5 px-3 py-2"
                  >
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-400" />
                    <div className="space-y-0.5 text-[11px] text-teal-200/80">
                      <span className="font-medium text-teal-200">ID Breakdown:</span>{" "}
                      <span className="font-mono">
                        {idBreakdown.schoolPrefix}
                      </span>{" "}
                      (school) —{" "}
                      <span className="font-mono">
                        {idBreakdown.enrollYear}
                      </span>{" "}
                      (year) —{" "}
                      <span className="font-mono">
                        {idBreakdown.birthMonth}
                      </span>{" "}
                      (birth month) —{" "}
                      <span className="font-mono">
                        {idBreakdown.initials}
                      </span>{" "}
                      (initials) —{" "}
                      <span className="font-mono">
                        {idBreakdown.sequence}
                      </span>{" "}
                      (seq)
                    </div>
                  </motion.div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                    Enrollment Date
                  </Label>
                  <Controller
                    name="enrolledAt"
                    control={control}
                    render={({ field }) => {
                      const dateValue = field.value
                        ? new Date(field.value)
                        : null;
                      return (
                        <CustomDatePicker
                          value={
                            dateValue && !isNaN(dateValue.getTime())
                              ? dateValue
                              : null
                          }
                          onChange={(d) =>
                            field.onChange(
                              d ? d.toISOString().slice(0, 10) : undefined
                            )
                          }
                          placeholder="Select enrollment date"
                        />
                      );
                    }}
                  />
                </div>
              </div>

              {/* GES Fields — optional */}
              <div className="space-y-3 rounded-xl border border-white/8 bg-white/2 p-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
                    GES Information
                  </h3>
                  <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-white/40">
                    Optional
                  </span>
                </div>
                <p className="text-[11px] text-white/40">
                  Ghana Education Service school code and BECE index number. These can also be added later from the student&apos;s profile.
                </p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label
                      htmlFor="gesSchoolCode"
                      className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                    >
                      GES School Code
                    </Label>
                    <Input
                      id="gesSchoolCode"
                      {...register("gesSchoolCode")}
                      placeholder="e.g. 0301234"
                      className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="gesIndexNumber"
                      className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                    >
                      BECE Index Number
                    </Label>
                    <Input
                      id="gesIndexNumber"
                      {...register("gesIndexNumber")}
                      placeholder="e.g. 0301234001"
                      className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand font-mono"
                    />
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Step 2: Photo & Status */}
          {currentStep === 2 && (
            <section className="space-y-6">
              <div className="space-y-4">
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                  Student Photo
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
                              alt="Student photo"
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
                      subjectRole="students"
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
                    <div className="grid grid-cols-3 gap-3">
                      {(["active", "inactive", "withdrawn"] as const).map(
                        (s) => (
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
                            <span className="capitalize">{s}</span>
                          </motion.label>
                        )
                      )}
                    </div>
                  )}
                />
              </div>
            </section>
          )}

          {/* Step 3: Grade & Class */}
          {currentStep === 3 && (
            <section className="space-y-6">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                Academic Assignment
              </h2>

              {/* Grade Selection - Card Grid */}
              <div className="space-y-3">
                <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                  Select Grade *
                </Label>
                {loadingGrades ? (
                  <div className="text-sm text-white/50 py-8 text-center">
                    Loading grades...
                  </div>
                ) : grades.length === 0 ? (
                  <div className="text-sm text-white/50 py-8 text-center">
                    No grades available. Please create grades first.
                  </div>
                ) : (
                  <Controller
                    name="gradeId"
                    control={control}
                    render={({ field }) => (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {grades.map((grade) => (
                          <motion.button
                            key={grade._id}
                            type="button"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => field.onChange(grade._id)}
                            className={`relative rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all text-left ${
                              field.value === grade._id
                                ? "border-brand bg-brand/20 text-brand shadow-lg shadow-brand/20"
                                : "border-white/10 bg-white/5 text-white/80 hover:border-white/20 hover:bg-white/10"
                            }`}
                          >
                            {field.value === grade._id && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-brand text-black flex items-center justify-center"
                              >
                                <Check className="h-4 w-4" />
                              </motion.div>
                            )}
                            <span>{grade.name}</span>
                          </motion.button>
                        ))}
                      </div>
                    )}
                  />
                )}
                {errors.gradeId && (
                  <div className="text-xs text-rose-300">
                    {errors.gradeId.message}
                  </div>
                )}
              </div>

              {/* Class Group Selection - Card Grid */}
              <AnimatePresence mode="wait">
                {gradeId && (
                  <motion.div
                    key={gradeId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-3"
                  >
                    <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                      Select Class Group *
                    </Label>
                    {loadingClasses ? (
                      <div className="text-sm text-white/50 py-8 text-center">
                        Loading classes...
                      </div>
                    ) : classGroups.length === 0 ? (
                      <div className="text-sm text-white/50 py-8 text-center border border-white/10 bg-white/5 rounded-lg p-4">
                        No class groups available for this grade. Please create
                        class groups first.
                      </div>
                    ) : (
                      <Controller
                        name="classGroupId"
                        control={control}
                        render={({ field }) => (
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {classGroups.map((cg) => (
                              <motion.button
                                key={cg._id}
                                type="button"
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => field.onChange(cg._id)}
                                className={`relative rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all text-left ${
                                  field.value === cg._id
                                    ? "border-brand bg-brand/20 text-brand shadow-lg shadow-brand/20"
                                    : "border-white/10 bg-white/5 text-white/80 hover:border-white/20 hover:bg-white/10"
                                }`}
                              >
                                {field.value === cg._id && (
                                  <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-brand text-black flex items-center justify-center"
                                  >
                                    <Check className="h-4 w-4" />
                                  </motion.div>
                                )}
                                <div className="flex flex-col">
                                  <span className="font-semibold">
                                    {cg.name}
                                  </span>
                                </div>
                              </motion.button>
                            ))}
                          </div>
                        )}
                      />
                    )}
                    {errors.classGroupId && (
                      <div className="text-xs text-rose-300">
                        {errors.classGroupId.message}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          )}

          {/* Step 4: Subject Overrides */}
          {currentStep === 4 && (
            <section className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                Subject Overrides
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                    Add Subjects
                  </Label>
                  <div className="max-h-64 overflow-auto rounded-lg border border-white/10 bg-white/5 p-4">
                    {loadingSubjects ? (
                      <div className="text-xs text-white/50 py-4 text-center">
                        Loading subjects…
                      </div>
                    ) : subjects.length === 0 ? (
                      <div className="text-xs text-white/50 py-4 text-center">
                        No subjects available
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {subjects.map((s) => (
                          <label
                            key={s._id}
                            className="flex items-center gap-3 rounded-md p-2.5 hover:bg-white/5 cursor-pointer transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={subjectAddIds.includes(s._id)}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                const current = new Set<string>(subjectAddIds);
                                const rems = new Set<string>(subjectRemoveIds);
                                if (checked) {
                                  current.add(s._id);
                                  rems.delete(s._id);
                                } else {
                                  current.delete(s._id);
                                }
                                setValue("subjectAddIds", Array.from(current), {
                                  shouldValidate: true,
                                });
                                setValue("subjectRemoveIds", Array.from(rems), {
                                  shouldValidate: true,
                                });
                              }}
                              className="h-4 w-4 rounded border-white/20 bg-white/5 accent-brand cursor-pointer"
                            />
                            <span className="text-sm text-white/80">
                              {s.name}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                    Exclude Subjects
                  </Label>
                  <div className="max-h-64 overflow-auto rounded-lg border border-white/10 bg-white/5 p-4">
                    {loadingSubjects ? (
                      <div className="text-xs text-white/50 py-4 text-center">
                        Loading subjects…
                      </div>
                    ) : subjects.length === 0 ? (
                      <div className="text-xs text-white/50 py-4 text-center">
                        No subjects available
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {subjects.map((s) => (
                          <label
                            key={s._id}
                            className="flex items-center gap-3 rounded-md p-2.5 hover:bg-white/5 cursor-pointer transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={subjectRemoveIds.includes(s._id)}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                const current = new Set<string>(
                                  subjectRemoveIds
                                );
                                const adds = new Set<string>(subjectAddIds);
                                if (checked) {
                                  current.add(s._id);
                                  adds.delete(s._id);
                                } else {
                                  current.delete(s._id);
                                }
                                setValue(
                                  "subjectRemoveIds",
                                  Array.from(current),
                                  { shouldValidate: true }
                                );
                                setValue("subjectAddIds", Array.from(adds), {
                                  shouldValidate: true,
                                });
                              }}
                              className="h-4 w-4 rounded border-white/20 bg-white/5 accent-brand cursor-pointer"
                            />
                            <span className="text-sm text-white/80">
                              {s.name}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  {errors.subjectRemoveIds && (
                    <div className="text-xs text-rose-300">
                      {errors.subjectRemoveIds.message}
                    </div>
                  )}
                </div>
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
          onClick={isFirstStep ? onClose : handlePrevious}
          disabled={isSubmitting || isLoading}
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
              disabled={isSubmitting || isLoading}
              className="gap-2 bg-brand text-black hover:opacity-90"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="gap-2 bg-brand text-black hover:opacity-90"
            >
              {isSubmitting || isLoading ? (
                "Creating…"
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Create Student
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
