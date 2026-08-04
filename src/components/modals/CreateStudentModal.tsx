/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import * as React from "react";
import { useForm, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateStudentSchema, CreateStudentInput } from "@/schemas/student";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useToast } from "@/hooks/useToast";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";
import { useGradeOptions } from "@/hooks/admin/useGradeOptions";
import { useClassGroupOptions } from "@/hooks/admin/useClassGroupOptions";
import { useSubjectOptions } from "@/hooks/admin/useSubjectOptions";
import { useAuth } from "@/providers/auth-provider";
import { ImageUploader } from "@/components/upload/ImageUploader";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LeoIcon } from "@/components/icons/LeoIcon";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Wand2,
  Loader2,
  Info,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Props = {
  onClose: () => void;
  onSubmit: (payload: CreateStudentInput) => Promise<void> | void;
  isLoading?: boolean;
};

type StudentIdPatternDraft = {
  template: string;
  source: "leo" | "standard";
  explanation?: string | null;
  requiredFields: Array<
    "firstName" | "lastName" | "dateOfBirth" | "enrolledAt" | "gradeId" | "classGroupId"
  >;
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

function LeoCallout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-violet-500/20 bg-violet-500/[0.07] p-3 sm:p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-violet-400/25 bg-violet-500/15 sm:h-10 sm:w-10">
        <LeoIcon className="h-4 w-4 text-violet-200 sm:h-5 sm:w-5" />
      </div>
      <div className="min-w-0 flex-1 text-xs leading-relaxed text-white/85 sm:text-sm">
        {children}
      </div>
    </div>
  );
}

export default function CreateStudentModal({
  onClose,
  onSubmit,
  isLoading,
}: Props) {
  const busy = useBusyToast();
  const { success: toastSuccess, error: toastError } = useToast();
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const { me } = useAuth();
  const [currentStep, setCurrentStep] = React.useState(1);
  const { data: grades = [], isLoading: loadingGrades } = useGradeOptions();

  const [patternHint, setPatternHint] = React.useState("");
  const [showLeoPatternDesigner, setShowLeoPatternDesigner] = React.useState(false);
  const [generatingId, setGeneratingId] = React.useState(false);
  const [idGenerated, setIdGenerated] = React.useState(false);
  const [manualAdmissionOverride, setManualAdmissionOverride] = React.useState(false);
  const [savedPattern, setSavedPattern] = React.useState<StudentIdPatternDraft | null>(null);
  const [loadingPatternSettings, setLoadingPatternSettings] = React.useState(true);
  const [patternMissingFields, setPatternMissingFields] = React.useState<string[]>([]);
  const [idBreakdown, setIdBreakdown] = React.useState<{
    [key: string]: string;
  } | null>(null);
  const [idLeoExplanation, setIdLeoExplanation] = React.useState<string | null>(
    null
  );

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
  const [photoPreviewUrl, setPhotoPreviewUrl] = React.useState<string | null>(
    null
  );
  const avatarPhotoUrl =
    (photoUrl?.trim() || photoPreviewUrl?.trim() || "") || "";
  const firstName = useWatch({ control, name: "firstName" });
  const lastName = useWatch({ control, name: "lastName" });
  const dateOfBirth = useWatch({ control, name: "dateOfBirth" });
  const admissionNo = useWatch({ control, name: "admissionNo" });
  const enrolledAt = useWatch({ control, name: "enrolledAt" });
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

  const autoGenSignatureRef = React.useRef("");
  const programmaticAdmissionWriteRef = React.useRef(false);

  const missingFieldLabels: Record<string, string> = React.useMemo(
    () => ({
      firstName: "first name",
      lastName: "last name",
      dateOfBirth: "date of birth",
      enrolledAt: "enrolment date",
      gradeId: "grade",
      classGroupId: "class group",
    }),
    []
  );

  const persistGeneratedAdmissionNo = React.useCallback(
    (value: string) => {
      programmaticAdmissionWriteRef.current = true;
      setValue("admissionNo", value, { shouldValidate: true, shouldDirty: true });
      queueMicrotask(() => {
        programmaticAdmissionWriteRef.current = false;
      });
    },
    [setValue]
  );

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/students/generate-id", {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) return;
        if (!cancelled) {
          setSavedPattern(json.data?.savedPattern ?? null);
          setShowLeoPatternDesigner(false);
        }
      } finally {
        if (!cancelled) setLoadingPatternSettings(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (
      firstName?.trim() &&
      lastName?.trim() &&
      !manualAdmissionOverride
    ) {
      const signature = JSON.stringify({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dateOfBirth: dateOfBirth?.toISOString?.() ?? null,
        enrolledAt: enrolledAt ?? null,
        gradeId: gradeId ?? null,
        classGroupId: classGroupId ?? null,
        savedTemplate: savedPattern?.template ?? "standard",
      });
      if (autoGenSignatureRef.current !== signature) {
        autoGenSignatureRef.current = signature;
        void generateStudentId();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstName, lastName, dateOfBirth, enrolledAt, gradeId, classGroupId, savedPattern, manualAdmissionOverride]);

  async function savePatternDraft(patternDraft: StudentIdPatternDraft) {
    const res = await fetch("/api/admin/students/generate-id", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patternDraft }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      throw new Error(json?.error || "Failed to save student ID pattern");
    }
    setSavedPattern(patternDraft);
  }

  async function generateStudentId(opts?: { useLeo?: boolean; forceStandard?: boolean }) {
    const fn = watch("firstName")?.trim();
    const ln = watch("lastName")?.trim();
    const dob = watch("dateOfBirth");

    if (!fn || !ln) {
      busy.error("Please fill in first name and last name first");
      return;
    }

    if (opts?.useLeo) {
      const hint = patternHint.trim();
      if (hint.length < 3) {
        busy.error("Describe your ID pattern for Leo (at least 3 characters).");
        return;
      }
    }

    setGeneratingId(true);
    try {
      const body: Record<string, unknown> = {
        firstName: fn,
        lastName: ln,
        dateOfBirth: dob ? dob.toISOString() : undefined,
        enrolledAt: watch("enrolledAt") || undefined,
        gradeId: watch("gradeId") || undefined,
        classGroupId: watch("classGroupId") || undefined,
      };
      if (opts?.useLeo) {
        body.patternHint = patternHint.trim();
      }
      if (opts?.forceStandard) {
        body.patternDraft = {
          template: "{schoolPrefix}-{enrollYear2}{birthMonth2}-{initials}-{sequence4}",
          source: "standard",
          requiredFields: ["firstName", "lastName", "dateOfBirth"],
          explanation:
            "School prefix + enrolment year + birth month + initials + sequence number.",
        };
      }

      const res = await fetch("/api/admin/students/generate-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data = await res.json();
      if (data.success) {
        const returnedPattern = data.patternDraft ?? null;
        setPatternMissingFields(Array.isArray(data.missingFields) ? data.missingFields : []);
        setIdLeoExplanation(
          typeof data.leoExplanation === "string"
            ? data.leoExplanation
            : returnedPattern?.explanation || null
        );
        setIdBreakdown(data.breakdown ?? null);

        if (typeof data.admissionNo === "string" && data.admissionNo.trim()) {
          persistGeneratedAdmissionNo(data.admissionNo);
          setIdGenerated(true);
          setManualAdmissionOverride(false);
        }

        if (
          opts?.useLeo &&
          data.requiresSaveConfirmation &&
          returnedPattern &&
          !savedPattern
        ) {
          const result = await confirm({
            title: "Save this student ID pattern for future students?",
            description:
              "This Leo-designed pattern will become the default for this school. Future student records will use it automatically, but admins can still type a custom ID when needed.",
            confirmLabel: "Save as school default",
            cancelLabel: "Keep one-time only",
            intent: "default",
          });
          if (result === "confirm") {
            await savePatternDraft(returnedPattern);
            toastSuccess("Student ID pattern saved", {
              description: "Future student IDs will use this school default automatically.",
            });
          }
        }
      }
    } catch (e) {
      console.error("Failed to generate student ID:", e);
      if (opts?.useLeo) {
        toastError("Student ID", {
          description: e instanceof Error ? e.message : "Failed to generate student ID",
        });
      }
    } finally {
      setGeneratingId(false);
    }
  }

  const currentStepData = STEPS[currentStep - 1];
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === STEPS.length;

  async function internalSubmit(values: CreateStudentInput) {
    if (currentStep !== STEPS.length) {
      return;
    }
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

  function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isLastStep) {
      void handleNext();
      return;
    }
    handleSubmit(internalSubmit)(e);
  }

  function handlePrevious() {
    setCurrentStep((s) => Math.max(s - 1, 1));
  }

  function handleRemovePhoto() {
    setPhotoPreviewUrl(null);
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
    <TooltipProvider delayDuration={200}>
    <form
      onSubmit={handleFormSubmit}
      onKeyDown={(e) => {
        if (!isLastStep && e.key === "Enter") {
          e.preventDefault();
          void handleNext();
        }
      }}
      className="space-y-8"
    >
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

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-end">
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
                            className={`flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-all cursor-pointer ${
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
                  <Controller
                    name="dateOfBirth"
                    control={control}
                    render={({ field }) => (
                      <CustomDatePicker
                        value={field.value ?? null}
                        onChange={(d) => field.onChange(d ?? undefined)}
                        placeholder="Date of birth"
                        triggerAriaLabel="Date of birth"
                        maxDate={new Date()}
                        error={errors.dateOfBirth?.message}
                        className="[&>div[role=button]]:min-h-12 [&>div[role=button]]:py-3"
                      />
                    )}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Label
                    htmlFor="admissionNo"
                    className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                  >
                    Student ID (admission number)
                  </Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label="How student IDs work"
                        className="rounded p-0.5 text-white/35 hover:bg-white/10 hover:text-white/70"
                      >
                        <Info className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="right"
                      className="max-w-xs border border-white/15 bg-zinc-950 px-3 py-2 text-xs leading-relaxed"
                    >
                      Many schools use a short school or district code plus intake
                      year and a roll number; others use initials plus birth date
                      (e.g. YYYYMMDD) and a sequence. Ministry or exam bodies often
                      issue their own learner numbers. Uniqueness is enforced in the
                      database—you can always type your own ID if you already have a
                      scheme.
                    </TooltipContent>
                  </Tooltip>
                </div>

                <LeoCallout>
                  {savedPattern ? (
                    <>
                      <p className="mb-2 font-medium text-violet-100">
                        School default student ID pattern is active
                      </p>
                      <p className="mb-2 text-[11px] text-white/70 sm:text-xs">
                        Leo will reuse this school-scoped pattern automatically for new students whenever the required form fields are available.
                      </p>
                      <div className="rounded-lg border border-violet-400/20 bg-black/20 px-3 py-2 font-mono text-[11px] text-violet-100/90">
                        {savedPattern.template}
                      </div>
                      {savedPattern.explanation ? (
                        <p className="mt-2 text-[11px] text-white/65 sm:text-xs">
                          {savedPattern.explanation}
                        </p>
                      ) : null}
                      {patternMissingFields.length > 0 ? (
                        <p className="mt-2 text-[11px] text-amber-200/90 sm:text-xs">
                          Complete{" "}
                          {patternMissingFields
                            .map((field) => missingFieldLabels[field] || field)
                            .join(", ")}{" "}
                          to generate this school’s default ID.
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <p className="mb-2 font-medium text-violet-100">
                        Describe a pattern for{" "}
                        <span className="font-semibold text-violet-200">Leo</span>
                      </p>
                      <p className="mb-2 text-[11px] text-white/70 sm:text-xs">
                        Leo can define a reusable school default from the student fields available in this form, then reuse it on future student records.
                      </p>
                    </>
                  )}

                  {(showLeoPatternDesigner || !savedPattern) && (
                    <Textarea
                      value={patternHint}
                      onChange={(e) => setPatternHint(e.target.value)}
                      placeholder='e.g. "School prefix + class code + enrolment year + sequence"'
                      className="min-h-[72px] border-white/10 bg-white/5 text-white placeholder:text-white/35"
                    />
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {savedPattern && !showLeoPatternDesigner ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={generatingId || loadingPatternSettings}
                        onClick={() => {
                          autoGenSignatureRef.current = "";
                          void generateStudentId();
                        }}
                        className="gap-1.5 border-violet-400/30 bg-violet-500/10 text-violet-100 hover:bg-violet-500/20"
                      >
                        {generatingId ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                        Use school default
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={
                        generatingId || !firstName?.trim() || !lastName?.trim()
                      }
                      onClick={() => {
                        autoGenSignatureRef.current = "";
                        void generateStudentId({ useLeo: true });
                      }}
                      className="gap-1.5 border-violet-400/30 bg-violet-500/10 text-violet-100 hover:bg-violet-500/20"
                    >
                      {generatingId ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      {savedPattern ? "Redesign with Leo" : "Suggest with Leo"}
                    </Button>
                    {savedPattern ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setShowLeoPatternDesigner((current) => !current)
                        }
                        className="h-8 gap-1.5 text-[11px] text-white/75 hover:bg-white/10"
                      >
                        {showLeoPatternDesigner ? "Hide Leo designer" : "Design a new default"}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        autoGenSignatureRef.current = "";
                        setIdGenerated(false);
                        setIdLeoExplanation(null);
                        void generateStudentId({ forceStandard: true });
                      }}
                      disabled={generatingId || !firstName?.trim() || !lastName?.trim()}
                      className="h-8 gap-1.5 text-[11px] text-brand hover:bg-brand/10"
                    >
                      {generatingId ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Wand2 className="h-3 w-3" />
                      )}
                      Use standard format
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setManualAdmissionOverride(true);
                        setIdGenerated(false);
                        setPatternMissingFields([]);
                      }}
                      className="h-8 gap-1.5 text-[11px] text-white/75 hover:bg-white/10"
                    >
                      Use custom ID instead
                    </Button>
                  </div>
                  <p className="mt-2 text-[11px] text-white/60 sm:text-xs">
                    Even when a school default exists, you can still overwrite the generated ID with a custom one.
                  </p>
                </LeoCallout>

                <div className="relative">
                  <Input
                    id="admissionNo"
                    {...register("admissionNo", {
                      onChange: () => {
                        if (!programmaticAdmissionWriteRef.current) {
                          setManualAdmissionOverride(true);
                          setIdGenerated(false);
                        }
                      },
                    })}
                    placeholder={
                      generatingId
                        ? "Generating…"
                        : "Generated ID or type your own"
                    }
                    className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand font-mono tracking-wide"
                  />
                  {generatingId && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-4 w-4 animate-spin text-brand/60" />
                    </div>
                  )}
                </div>

                {idLeoExplanation && idGenerated && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-2 rounded-lg border border-violet-500/25 bg-violet-500/10 px-3 py-2"
                  >
                    <LeoIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-300" />
                    <p className="text-[11px] leading-relaxed text-violet-100/90">
                      <span className="font-medium text-violet-200">Leo: </span>
                      {idLeoExplanation}
                    </p>
                  </motion.div>
                )}

                {idBreakdown &&
                  idGenerated &&
                  !idLeoExplanation &&
                  idBreakdown.enrollYear2 && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-start gap-2 rounded-lg border border-teal-500/20 bg-teal-500/5 px-3 py-2"
                    >
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-400" />
                      <div className="space-y-0.5 text-[11px] text-teal-200/80">
                        <span className="font-medium text-teal-200">
                          Standard format breakdown:
                        </span>{" "}
                        <span className="font-mono">
                          {idBreakdown.schoolPrefix}
                        </span>{" "}
                        (school) —{" "}
                        <span className="font-mono">
                          {idBreakdown.enrollYear2}
                        </span>{" "}
                        (year) —{" "}
                        <span className="font-mono">
                          {idBreakdown.birthMonth2}
                        </span>{" "}
                        (birth month) —{" "}
                        <span className="font-mono">
                          {idBreakdown.initials}
                        </span>{" "}
                        (initials) —{" "}
                        <span className="font-mono">
                          {idBreakdown.sequence4}
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
                        {avatarPhotoUrl ? (
                          <motion.div
                            key="photo"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.2 }}
                            className="relative w-full h-full"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={avatarPhotoUrl}
                              alt="Student photo"
                              className="h-full w-full object-cover rounded-full"
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
                    {avatarPhotoUrl ? (
                      <motion.button
                        type="button"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        onClick={handleRemovePhoto}
                        className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-rose-500 hover:bg-rose-600 border-2 border-white/10 flex items-center justify-center text-white shadow-lg transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </motion.button>
                    ) : null}
                  </motion.div>

                  {/* Upload Dropzone */}
                  <div className="w-full">
                    <ImageUploader
                      schoolId={me.schoolId}
                      subjectRole="students"
                      initialPreviewUrl={avatarPhotoUrl || null}
                      onUploaded={(payload) => {
                        setPhotoPreviewUrl(payload.url);
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
    {confirmationDialog}
    </TooltipProvider>
  );
}
