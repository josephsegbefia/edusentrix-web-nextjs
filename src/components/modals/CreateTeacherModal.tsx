"use client";

import * as React from "react";
import { useForm, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CreateTeacherSchema,
  type CreateTeacherInput,
} from "@/schemas/teacher";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useToast } from "@/hooks/useToast";
import { useAuth } from "@/providers/auth-provider";
import { ImageUploader } from "@/components/upload/ImageUploader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Check, X, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

type Props = {
  onClose: () => void;
  onSubmit: (payload: CreateTeacherInput) => Promise<void>;
  isLoading?: boolean;
};

type SubjectLite = { _id: string; name: string };
type ClassGroupLite = { _id: string; name: string; gradeLabel?: string };

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
    resolver: zodResolver(CreateTeacherSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      photoUrl: undefined,
      subjectIds: [],
      homeroomClassGroupId: undefined,
      status: "active",
    },
    mode: "onBlur",
    shouldUnregister: false,
  });

  const firstName = useWatch({ control, name: "firstName" });
  const lastName = useWatch({ control, name: "lastName" });
  const photoUrl = useWatch({ control, name: "photoUrl" });
  const subjectIds = useWatch({ control, name: "subjectIds" }) ?? [];

  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === 3;

  // ------- Debounced searches -------
  const [qClass, setQClass] = React.useState("");
  const dqClass = useDebouncedValue(qClass, 350);
  const [classResults, setClassResults] = React.useState<ClassGroupLite[]>([]);
  const [classLoading, setClassLoading] = React.useState(false);

  const [qSubj, setQSubj] = React.useState("");
  const dqSubj = useDebouncedValue(qSubj, 350);
  const [subjectResults, setSubjectResults] = React.useState<SubjectLite[]>([]);
  const [subjectsLoading, setSubjectsLoading] = React.useState(false);

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
        if (alive && json?.success) setSubjectResults(json.data || []);
      } catch {
      } finally {
        if (alive) setSubjectsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [dqSubj]);

  const toggleSubject = (id: string) => {
    const current = new Set(subjectIds);
    if (current.has(id)) current.delete(id);
    else current.add(id);
    setValue("subjectIds", Array.from(current), { shouldValidate: true });
  };

  async function handleNext() {
    if (currentStep === 1) {
      const ok = await trigger(["firstName", "lastName", "email", "phone"]);
      if (!ok) return;
    }
    if (currentStep === 2) {
      const ok = await trigger(["photoUrl", "status"]);
      if (!ok) return;
    }
    setCurrentStep((s) => Math.min(3, s + 1));
  }

  function handlePrevious() {
    setCurrentStep((s) => Math.max(1, s - 1));
  }

  function handleRemovePhoto() {
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
    const payload: CreateTeacherInput = {
      ...values,
      subjectIds: (values.subjectIds || []).filter(Boolean),
      homeroomClassGroupId: values.homeroomClassGroupId || undefined,
      status: values.status ?? "active",
    };
    try {
      await onSubmit(payload);
      toastSuccess("Teacher created", {
        description:
          "We've sent an invite email so they can set a password and onboard.",
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
      {/* Step Indicator - Simple dots like CreateTeacherModal */}
      <div className="flex items-center justify-between pb-6">
        <div className="text-sm text-white/70">
          Step <span className="font-semibold">{currentStep}</span> of 3
        </div>
        <div className="flex gap-1">
          {[1, 2, 3].map((i) => (
            <span
              key={i}
              className={`h-1.5 w-8 rounded-full transition-all ${
                i <= currentStep ? "bg-brand" : "bg-white/20"
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

          {/* Step 3: Assignments */}
          {currentStep === 3 && (
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

                <div className="max-h-72 overflow-y-auto rounded-lg border border-white/10 bg-white/5 p-4">
                  {subjectsLoading ? (
                    <div className="text-xs text-white/50 py-4 text-center">
                      Loading subjects…
                    </div>
                  ) : subjectResults.length === 0 ? (
                    <div className="text-xs text-white/50 py-4 text-center">
                      {qSubj.trim()
                        ? "No subjects found matching your search"
                        : "No subjects available. Please create subjects first."}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {subjectResults.map((s) => {
                        const isSelected = subjectIds.includes(s._id);
                        return (
                          <motion.button
                            key={s._id}
                            type="button"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => toggleSubject(s._id)}
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
                            <div className="font-semibold">{s.name}</div>
                          </motion.button>
                        );
                      })}
                    </div>
                  )}
                </div>
                {errors.subjectIds && (
                  <div className="text-xs text-rose-300">
                    {errors.subjectIds.message}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                  Homeroom Assignment (Optional)
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
                              : "No class groups available. Create one to set a homeroom."}
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
                                Skip assigning for now
                              </div>
                            </motion.button>

                            {classResults.map((cg) => {
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
                                  <div className="font-semibold">{cg.name}</div>
                                  {cg.gradeLabel && (
                                    <div className="text-xs text-white/60">
                                      {cg.gradeLabel}
                                    </div>
                                  )}
                                </motion.button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-white/50">
                        Assign this teacher as homeroom teacher for a class
                        group
                      </p>
                    </div>
                  )}
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
                  Create Teacher
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
