"use client";

import * as React from "react";
import {
  useForm,
  useWatch,
  Controller,
  type Resolver,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CreateTeacherSchema,
  type CreateTeacherInput,
} from "@/schemas/teacher";
import type { CreateTeacherResponse } from "@/hooks/admin/useTeachers";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useToast } from "@/hooks/useToast";
import { useAuth } from "@/providers/auth-provider";
import { ImageUploader } from "@/components/upload/ImageUploader";
import { GhanaPhoneInput } from "@/components/ui/ghana-phone-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
  Search,
  Info,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Props = {
  onClose: () => void;
  onSubmit: (
    payload: CreateTeacherInput
  ) => Promise<CreateTeacherResponse | void>;
  isLoading?: boolean;
};

type ClassGroupLite = {
  id?: string;
  _id?: string;
  name: string;
  label?: string;
  gradeName?: string | null;
  gradeLabel?: string;
};

type GradeOption = { id: string; name: string };

function cgId(cg: ClassGroupLite): string {
  return String(cg.id || cg._id || "");
}

function FieldInfo({ text, label }: { text: string; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="shrink-0 rounded p-0.5 text-white/35 outline-none hover:bg-white/10 hover:text-white/75 focus-visible:ring-1 focus-visible:ring-brand"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <Info className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="right"
        align="center"
        className="z-400 max-w-xs border border-white/15 bg-zinc-950 px-3 py-2 text-xs leading-relaxed text-white/90 shadow-lg"
      >
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

const TOTAL_STEPS = 4;

type ReviewHomeroomConflict = {
  classGroupId: string;
  classLabel: string;
  teacherName: string;
};

function getInitials(firstName?: string, lastName?: string): string {
  const first = firstName?.charAt(0)?.toUpperCase() || "";
  const last = lastName?.charAt(0)?.toUpperCase() || "";
  return first + last || "?";
}

export default function CreateTeacherModal({
  onClose,
  onSubmit,
  isLoading,
}: Props) {
  const busy = useBusyToast();
  const { success: toastSuccess, error: toastError } = useToast();
  const { me } = useAuth();
  const [currentStep, setCurrentStep] = React.useState(1);

  const {
    register,
    handleSubmit,
    control,
    trigger,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateTeacherInput>({
    resolver: zodResolver(CreateTeacherSchema) as Resolver<CreateTeacherInput>,
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      photoUrl: undefined,
      subjectIds: [],
      teachingAssignments: [],
      homeroomClassGroupId: undefined,
      status: "active",
      teachingAssignmentResolution: "add_alongside",
    },
    mode: "onBlur",
    shouldUnregister: false,
  });

  const firstName = useWatch({ control, name: "firstName" });
  const lastName = useWatch({ control, name: "lastName" });
  const photoUrl = useWatch({ control, name: "photoUrl" });
  const [photoPreviewUrl, setPhotoPreviewUrl] = React.useState<string | null>(
    null
  );
  const avatarPhotoUrl = (photoUrl?.trim() || photoPreviewUrl?.trim() || "") || "";

  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === TOTAL_STEPS;

  const [qClass, setQClass] = React.useState("");
  const dqClass = useDebouncedValue(qClass, 350);
  const [classResults, setClassResults] = React.useState<ClassGroupLite[]>([]);
  const [classLoading, setClassLoading] = React.useState(false);

  const [grades, setGrades] = React.useState<GradeOption[]>([]);

  const watchedHomeroom = useWatch({ control, name: "homeroomClassGroupId" });
  const watchedEmail = useWatch({ control, name: "email" });
  const watchedPhone = useWatch({ control, name: "phone" });
  const watchedStatus = useWatch({ control, name: "status" });

  const [reviewHomeroomLabel, setReviewHomeroomLabel] = React.useState<
    string | null
  >(null);
  const [reviewLoading, setReviewLoading] = React.useState(false);
  const [reviewHomeroomConflict, setReviewHomeroomConflict] =
    React.useState<ReviewHomeroomConflict | null>(null);
  const [reviewConflictLoading, setReviewConflictLoading] =
    React.useState(false);
  const [reviewConflictError, setReviewConflictError] = React.useState<
    string | null
  >(null);

  React.useEffect(() => {
    if (currentStep !== TOTAL_STEPS) return;
    let cancelled = false;
    (async () => {
      setReviewLoading(true);

      let homeroomLabel: string | null = null;
      const hid = watchedHomeroom;
      if (hid) {
        try {
          for (const g of grades) {
            const cgRes = await fetch(
              `/api/admin/class-groups/search?gradeId=${encodeURIComponent(
                g.id
              )}&limit=50`,
              { cache: "no-store" }
            );
            const cgJson = await cgRes.json();
            if (cgJson?.success) {
              const hit = (cgJson.data || []).find(
                (cg: { id: string }) => String(cg.id) === String(hid)
              );
              if (hit?.label) {
                homeroomLabel = String(hit.label);
                break;
              }
              if (hit?.name) {
                homeroomLabel = String(hit.name);
                break;
              }
            }
          }
        } catch {
          homeroomLabel = "Homeroom class selected";
        }
        if (!homeroomLabel) homeroomLabel = "Homeroom class selected";
      }

      if (!cancelled) {
        setReviewHomeroomLabel(homeroomLabel);
      }
      if (!cancelled) setReviewLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentStep, grades, watchedHomeroom]);

  React.useEffect(() => {
    if (currentStep !== TOTAL_STEPS) return;

    const homeroomId = String(watchedHomeroom || "").trim();
    if (!homeroomId) {
      setReviewHomeroomConflict(null);
      setReviewConflictError(null);
      setReviewConflictLoading(false);
      return;
    }

    let cancelled = false;

    const buildTeacherName = (teacher: {
      fullName?: string | null;
      firstName?: string | null;
      lastName?: string | null;
    }) =>
      teacher.fullName?.trim() ||
      `${teacher.firstName || ""} ${teacher.lastName || ""}`.trim() ||
      "Teacher";

    (async () => {
      setReviewConflictLoading(true);
      setReviewConflictError(null);

      try {
        const classRes = await fetch(`/api/admin/classes/${homeroomId}`, {
          cache: "no-store",
        });
        const classJson = await classRes
          .json()
          .catch(() => ({ success: false }));

        if (!classRes.ok || !classJson?.success) {
          throw new Error(
            classJson?.error || "Failed to load class details for review."
          );
        }

        const classData = classJson.data as {
          fullLabel?: string;
          name?: string;
          homeroomTeacher?: {
            fullName?: string | null;
            firstName?: string | null;
            lastName?: string | null;
          } | null;
        };

        const nextHomeroomConflict = classData.homeroomTeacher
          ? {
              classGroupId: homeroomId,
              classLabel:
                classData.fullLabel?.trim() ||
                classData.name?.trim() ||
                homeroomId,
              teacherName: buildTeacherName(classData.homeroomTeacher),
            }
          : null;

        if (!cancelled) {
          setReviewHomeroomConflict(nextHomeroomConflict);
          setReviewConflictError(null);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setReviewHomeroomConflict(null);
          setReviewConflictError(
            e instanceof Error
              ? e.message
              : "Could not check current homeroom assignment."
          );
        }
      } finally {
        if (!cancelled) setReviewConflictLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentStep, watchedHomeroom]);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (!me?.schoolId) return;
      try {
        const res = await fetch("/api/admin/grades?active=1", {
          cache: "no-store",
        });
        const json = await res.json();
        if (alive && Array.isArray(json?.data)) {
          setGrades(
            json.data.map((g: { id: string; name: string }) => ({
              id: g.id,
              name: g.name,
            }))
          );
        }
      } catch {
      }
    })();
    return () => {
      alive = false;
    };
  }, [me?.schoolId]);

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
        if (alive && json?.success) setClassResults(json.data || []);
      } catch {
      } finally {
        if (alive) setClassLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [dqClass]);

  async function handleNext() {
    if (currentStep === 1) {
      const ok = await trigger(["firstName", "lastName", "email", "phone"]);
      if (!ok) return;
    }
    if (currentStep === 2) {
      const ok = await trigger(["photoUrl", "status"]);
      if (!ok) return;
    }
    setCurrentStep((s) => Math.min(TOTAL_STEPS, s + 1));
  }

  function handlePrevious() {
    setCurrentStep((s) => Math.max(1, s - 1));
  }

  function handleRemovePhoto() {
    setPhotoPreviewUrl(null);
    setValue("photoUrl", undefined, { shouldValidate: true });
  }

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLastStep) {
      handleSubmit(internalSubmit)(e);
    } else {
      void handleNext();
    }
  };

  async function internalSubmit(values: CreateTeacherInput) {
    if (currentStep !== TOTAL_STEPS) {
      return;
    }

    const payload: CreateTeacherInput = {
      ...values,
      subjectIds: (values.subjectIds || []).filter(Boolean),
      teachingAssignments: [],
      homeroomClassGroupId: values.homeroomClassGroupId || undefined,
      status: values.status ?? "active",
      teachingAssignmentResolution:
        values.teachingAssignmentResolution ?? "add_alongside",
    };
    try {
      const result = await onSubmit(payload);
      const devLogin = result?.data?.devLogin;
      toastSuccess("Teacher created", {
        description: devLogin
          ? `Test login ready: ${devLogin.email} / ${devLogin.password}`
          : "We've sent an invite email so they can set a password and onboard.",
        duration: devLogin ? 20000 : undefined,
        actionLabel: devLogin ? "Copy" : undefined,
        onAction: devLogin
          ? () => {
              void navigator.clipboard.writeText(
                `${devLogin.email}\n${devLogin.password}\n${devLogin.signInUrl}`
              );
            }
          : undefined,
      });
      onClose();
    } catch (e: unknown) {
      const errorMessage =
        e instanceof Error ? e.message : "Please check inputs and try again.";
      toastError("Could not add teacher", {
        description: errorMessage,
      });
    }
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
        <div className="flex items-center justify-between pb-6">
          <div className="text-sm text-white/70">
            Step <span className="font-semibold">{currentStep}</span> of{" "}
            {TOTAL_STEPS}
          </div>
          <div className="flex gap-1 flex-wrap justify-end max-w-[min(100%,280px)]">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((i) => (
              <span
                key={i}
                className={`h-1.5 w-8 rounded-full transition-all ${
                  i <= currentStep ? "bg-brand" : "bg-white/20"
                }`}
              />
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {currentStep === 1 && (
              <section className="space-y-6">
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
                    <GhanaPhoneInput
                      id="phone"
                      {...register("phone")}
                      className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                    />
                  </div>
                </div>
              </section>
            )}

            {currentStep === 2 && (
              <section className="space-y-6">
                <div className="space-y-4">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                    Teacher Photo
                  </h2>
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
                                alt="Teacher photo"
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
                    <div className="w-full">
                      <ImageUploader
                        schoolId={me.schoolId}
                        subjectRole="teachers"
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
                      <div className="grid grid-cols-2 gap-3">
                        {(["active", "inactive"] as const).map((s) => (
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
                        ))}
                      </div>
                    )}
                  />
                </div>
              </section>
            )}

            {currentStep === 3 && (
              <section className="space-y-6">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                      Homeroom (optional)
                    </h2>
                    <FieldInfo
                      label="About homeroom"
                      text="Homeroom is the class this teacher leads as a form teacher, if applicable. Subject teaching assignments can be set later from the teacher or class pages."
                    />
                  </div>
                  <p className="text-sm text-white/65">
                    Pick a class group now, or skip and assign subjects and
                    classes after the teacher is created.
                  </p>

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
                      <div className="space-y-2">
                        <div className="max-h-72 overflow-y-auto rounded-lg border border-white/10 bg-white/5 p-4">
                          {classLoading ? (
                            <div className="text-xs text-white/50 py-4 text-center">
                              Loading class groups…
                            </div>
                          ) : classResults.length === 0 ? (
                            <div className="text-xs text-white/50 py-4 text-center">
                              {qClass.trim()
                                ? "No class groups found matching your search"
                                : "Search to pick a homeroom class group."}
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                              <motion.button
                                type="button"
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => field.onChange(undefined)}
                                className={`relative rounded-lg border-2 px-4 py-3 text-left transition-all ${
                                  !field.value
                                    ? "border-brand bg-brand/10 text-brand"
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
                                <div className="font-semibold">No homeroom</div>
                                <div className="text-xs text-white/60">
                                  Skip for now
                                </div>
                              </motion.button>

                              {classResults.map((cg) => {
                                const id = cgId(cg);
                                const selected = field.value === id;
                                const sub =
                                  cg.label ||
                                  cg.gradeLabel ||
                                  cg.gradeName ||
                                  "";
                                return (
                                  <motion.button
                                    key={id}
                                    type="button"
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => field.onChange(id)}
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
                                    <div className="font-semibold">
                                      {cg.name}
                                    </div>
                                    {sub ? (
                                      <div className="text-xs text-white/60">
                                        {sub}
                                      </div>
                                    ) : null}
                                  </motion.button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  />
                </div>
              </section>
            )}

            {currentStep === 4 && (
              <section className="space-y-6">
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                  Review &amp; invite
                </h2>
                <p className="text-sm text-white/70">
                  Nothing is saved until you create the teacher. We&apos;ll send a
                  secure email invite so they can set a password and sign in.
                </p>

                {reviewConflictLoading ? (
                  <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/65">
                    Checking existing homeroom assignment…
                  </div>
                ) : null}

                {reviewConflictError ? (
                  <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
                    {reviewConflictError}
                  </div>
                ) : null}

                {reviewHomeroomConflict ? (
                  <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-100/90">
                      Homeroom already assigned
                    </p>
                    <p className="text-sm leading-relaxed text-amber-50/95">
                      <span className="font-medium">
                        {reviewHomeroomConflict.classLabel}
                      </span>{" "}
                      already has{" "}
                      <span className="font-medium">
                        {reviewHomeroomConflict.teacherName}
                      </span>{" "}
                      as homeroom teacher. Creating this teacher with that
                      homeroom will replace the current homeroom teacher.
                    </p>
                  </div>
                ) : null}

                <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4 text-sm">
                  <div>
                    <div className="text-xs uppercase tracking-[0.15em] text-white/45 mb-1">
                      Name
                    </div>
                    <div className="text-white font-medium">
                      {firstName} {lastName}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs uppercase tracking-[0.15em] text-white/45 mb-1">
                        Email
                      </div>
                      <div className="text-white/90">{watchedEmail || "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.15em] text-white/45 mb-1">
                        Phone
                      </div>
                      <div className="text-white/90">
                        {watchedPhone?.trim() ? watchedPhone : "—"}
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.15em] text-white/45 mb-1">
                      Status
                    </div>
                    <div className="capitalize text-white/90">
                      {watchedStatus || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.15em] text-white/45 mb-1">
                      Homeroom
                    </div>
                    <div className="text-white/90">
                      {watchedHomeroom
                        ? reviewLoading
                          ? "…"
                          : reviewHomeroomLabel || "Selected"
                        : "None — assign subjects and classes later from the teacher profile"}
                    </div>
                    {reviewHomeroomConflict ? (
                      <div className="mt-1 text-xs text-amber-200/90">
                        This will replace{" "}
                        {reviewHomeroomConflict.teacherName} as the current
                        homeroom teacher.
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>
            )}
          </motion.div>
        </AnimatePresence>

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
                onClick={() => void handleNext()}
                disabled={isSubmitting || isLoading}
                className="gap-2 bg-brand text-black hover:opacity-90"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={
                  isSubmitting ||
                  isLoading ||
                  reviewLoading ||
                  reviewConflictLoading
                }
                className="gap-2 bg-brand text-black hover:opacity-90"
              >
                {isSubmitting || isLoading ? (
                  "Creating…"
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Create Teacher
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </form>
    </TooltipProvider>
  );
}
