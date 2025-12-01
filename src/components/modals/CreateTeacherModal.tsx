"use client";

import * as React from "react";
import { useForm, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateTeacherSchema, CreateTeacherInput } from "@/schemas/teacher";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useSubjectOptions } from "@/hooks/admin/useSubjectOptions";
import { useClassGroupOptions } from "@/hooks/admin/useClassGroupOptions";
import { useAuth } from "@/providers/auth-provider";
import { ImageUploader } from "@/components/upload/ImageUploader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

type Props = {
  onClose: () => void;
  onSubmit: (payload: CreateTeacherInput) => Promise<void> | void;
  isLoading?: boolean;
};

const STEPS = [
  {
    id: 1,
    title: "Basic Information",
    fields: ["firstName", "lastName", "email", "phone"],
  },
  { id: 2, title: "Photo & Status", fields: ["photoUrl", "status"] },
  {
    id: 3,
    title: "Assignments",
    fields: ["subjectIds", "homeroomClassGroupId"],
  },
] as const;

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
  const { me } = useAuth();
  const [currentStep, setCurrentStep] = React.useState(1);
  const { data: subjects = [], isLoading: loadingSubjects } =
    useSubjectOptions();
  const [allClassGroups, setAllClassGroups] = React.useState<
    Array<{ _id: string; name: string }>
  >([]);
  const [loadingClassGroups, setLoadingClassGroups] = React.useState(false);

  // Form setup
  const {
    register,
    handleSubmit,
    control,
    setValue,
    trigger,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateTeacherInput>({
    resolver: zodResolver(CreateTeacherSchema),
    defaultValues: {
      status: "active",
      subjectIds: [],
    },
    mode: "onChange",
  });

  const photoUrl = useWatch({ control, name: "photoUrl" });
  const firstName = useWatch({ control, name: "firstName" });
  const lastName = useWatch({ control, name: "lastName" });
  const subjectIds = useWatch({ control, name: "subjectIds" }) ?? [];
  const homeroomClassGroupId = useWatch({
    control,
    name: "homeroomClassGroupId",
  });

  // Fetch all class groups for homeroom selection
  React.useEffect(() => {
    if (currentStep === 3 && me?.schoolId) {
      setLoadingClassGroups(true);
      fetch("/api/admin/class-groups?active=1")
        .then((res) => res.json())
        .then((json) => {
          const groups = Array.isArray(json) ? json : json?.data || [];
          setAllClassGroups(groups);
        })
        .catch(() => {
          setAllClassGroups([]);
        })
        .finally(() => {
          setLoadingClassGroups(false);
        });
    }
  }, [currentStep, me?.schoolId]);

  const currentStepData = STEPS[currentStep - 1];
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === STEPS.length;

  async function internalSubmit(values: CreateTeacherInput) {
    try {
      // Clean up the payload - remove empty strings and undefined values
      const cleanedPayload: CreateTeacherInput = {
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim(),
        phone: values.phone?.trim() || undefined,
        photoUrl: values.photoUrl?.trim() || undefined,
        status: values.status || "active",
        subjectIds:
          values.subjectIds && values.subjectIds.length > 0
            ? values.subjectIds
            : [],
        homeroomClassGroupId:
          values.homeroomClassGroupId?.trim() || undefined,
      };

      await onSubmit(cleanedPayload);
      onClose();
    } catch (e: unknown) {
      console.error("Teacher creation error:", e);
    }
  }

  async function handleNext() {
    const fields = currentStepData.fields;
    const isValid = await trigger([...fields] as (keyof CreateTeacherInput)[]);
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
        {STEPS.map((step, index) => (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center gap-2">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${
                  currentStep > step.id
                    ? "border-brand bg-brand text-black"
                    : currentStep === step.id
                    ? "border-brand bg-brand/20 text-brand"
                    : "border-white/20 bg-white/5 text-white/40"
                }`}
              >
                {currentStep > step.id ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <span className="text-sm font-semibold">{step.id}</span>
                )}
              </div>
              <span
                className={`text-xs ${
                  currentStep >= step.id ? "text-white/80" : "text-white/40"
                }`}
              >
                {step.title}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={`h-0.5 flex-1 transition-all mx-2 ${
                  currentStep > step.id ? "bg-brand" : "bg-white/10"
                }`}
              />
            )}
          </React.Fragment>
        ))}
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
                            className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand/20 to-brand/10"
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
                <div className="max-h-64 overflow-y-auto rounded-lg border border-white/10 bg-white/5 p-4">
                  {loadingSubjects ? (
                    <div className="text-xs text-white/50 py-4 text-center">
                      Loading subjects…
                    </div>
                  ) : subjects.length === 0 ? (
                    <div className="text-xs text-white/50 py-4 text-center">
                      No subjects available. Please create subjects first.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {subjects.map((s) => (
                        <label
                          key={s._id}
                          className="flex items-center gap-2 rounded-md p-2 border border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={subjectIds.includes(s._id)}
                            onChange={(e) => {
                              const set = new Set(subjectIds);
                              if (e.target.checked) set.add(s._id);
                              else set.delete(s._id);
                              setValue("subjectIds", Array.from(set), {
                                shouldValidate: true,
                              });
                            }}
                            className="h-4 w-4 rounded border-white/20 bg-white/5 accent-brand cursor-pointer"
                          />
                          <span className="text-sm text-white/80">{s.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                  Homeroom Assignment (Optional)
                </h2>
                <Controller
                  name="homeroomClassGroupId"
                  control={control}
                  render={({ field }) => (
                    <div className="space-y-2">
                      <select
                        {...field}
                        value={field.value || ""}
                        onChange={(e) =>
                          field.onChange(e.target.value || undefined)
                        }
                        disabled={loadingClassGroups}
                        className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="">No homeroom assignment</option>
                        {allClassGroups.map((cg) => (
                          <option key={cg._id} value={cg._id}>
                            {cg.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-white/50">
                        Assign this teacher as homeroom teacher for a class group
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
