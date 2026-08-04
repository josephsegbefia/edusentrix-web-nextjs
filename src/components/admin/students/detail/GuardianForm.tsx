"use client";

import * as React from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { GhanaPhoneInput } from "@/components/ui/ghana-phone-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ImageUploader } from "@/components/upload/ImageUploader";
import { useAuth } from "@/providers/auth-provider";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Mail,
  Phone,
  Briefcase,
  Star,
  StarOff,
} from "lucide-react";
import type {
  GuardianRelationship,
  GuardianData,
} from "@/hooks/admin/useGuardians";

const GuardianFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional().nullable(),
  relationship: z.enum([
    "mother",
    "father",
    "guardian",
    "step_mother",
    "step_father",
    "grandmother",
    "grandfather",
    "aunt",
    "uncle",
    "other",
  ]),
  occupation: z.string().optional().nullable(),
  photoUrl: z.string().url().optional().nullable(),
  isPrimary: z.boolean(),
});

type GuardianFormInput = z.infer<typeof GuardianFormSchema>;

const STEPS = [
  {
    id: 1,
    title: "Basic Information",
    fields: ["firstName", "lastName", "email", "phone"],
  },
  {
    id: 2,
    title: "Photo & Relationship",
    fields: ["photoUrl", "relationship", "isPrimary", "occupation"],
  },
  {
    id: 3,
    title: "Review & Submit",
    fields: [],
  },
] as const;

const RELATIONSHIP_OPTIONS: Array<{
  value: GuardianRelationship;
  label: string;
}> = [
  { value: "mother", label: "Mother" },
  { value: "father", label: "Father" },
  { value: "guardian", label: "Guardian" },
  { value: "step_mother", label: "Step Mother" },
  { value: "step_father", label: "Step Father" },
  { value: "grandmother", label: "Grandmother" },
  { value: "grandfather", label: "Grandfather" },
  { value: "aunt", label: "Aunt" },
  { value: "uncle", label: "Uncle" },
  { value: "other", label: "Other" },
];

type Props = {
  guardian?: GuardianData | null;
  onSubmit: (data: GuardianFormInput) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
};

function getInitials(firstName?: string, lastName?: string): string {
  const first = firstName?.charAt(0)?.toUpperCase() || "";
  const last = lastName?.charAt(0)?.toUpperCase() || "";
  return first + last || "?";
}

export function GuardianForm({
  guardian,
  onSubmit,
  onCancel,
  isLoading,
}: Props) {
  const { me } = useAuth();
  const isEdit = !!guardian;
  const [currentStep, setCurrentStep] = React.useState(1);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    clearErrors,
    setError,
    setValue,
    trigger,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<GuardianFormInput>({
    resolver: zodResolver(GuardianFormSchema),
    defaultValues: guardian
      ? {
          firstName: guardian.fullName.split(" ")[0] || "",
          lastName: guardian.fullName.split(" ").slice(1).join(" ") || "",
          email: guardian.email,
          phone: guardian.phone || "",
          relationship: guardian.relationship,
          occupation: guardian.occupation || "",
          photoUrl: guardian.photoUrl || "",
          isPrimary: guardian.isPrimary,
        }
      : {
          firstName: "",
          lastName: "",
          email: "",
          phone: "",
          relationship: "mother",
          occupation: "",
          photoUrl: "",
          isPrimary: false,
        },
    mode: "onChange",
  });

  const photoUrl = useWatch({ control, name: "photoUrl" });
  const firstName = useWatch({ control, name: "firstName" });
  const lastName = useWatch({ control, name: "lastName" });

  const initials = getInitials(firstName, lastName);

  const currentStepData = STEPS[currentStep - 1];
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === STEPS.length;

  const emailRegister = register("email", {
    onChange: () => {
      if (errors.email?.type === "manual") {
        clearErrors("email");
      }
      if (submitError) {
        setSubmitError(null);
      }
    },
  });

  async function internalSubmit(values: GuardianFormInput) {
    if (currentStep !== STEPS.length) {
      return;
    }
    setSubmitError(null);
    clearErrors("email");
    try {
      await onSubmit({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.toLowerCase().trim(),
        phone: values.phone?.trim() || null,
        relationship: values.relationship,
        occupation: values.occupation?.trim() || null,
        photoUrl: values.photoUrl || null,
        isPrimary: values.isPrimary,
      });
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Failed to save guardian details";
      const normalized = message.toLowerCase();
      const isEmailConflict =
        normalized.includes("email") ||
        normalized.includes("already used") ||
        normalized.includes("already exists");

      if (isEmailConflict) {
        setCurrentStep(1);
        setError("email", { type: "manual", message });
        return;
      }

      setSubmitError(message);
    }
  }

  async function handleNext() {
    const fields = currentStepData.fields;
    const isValid = await trigger([...fields] as (keyof GuardianFormInput)[]);
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
    setValue("photoUrl", undefined, { shouldValidate: true });
  }

  if (!me?.schoolId) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center">
        <div className="text-sm text-white/60">School ID not available</div>
      </div>
    );
  }

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
      {/* Step Indicator - Matching CreateStudentModal */}
      <div className="flex items-center justify-between pb-6">
        <div className="text-sm text-white/70">
          Step <span className="font-semibold">{currentStep}</span> of {STEPS.length}
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

      {submitError ? (
        <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{submitError}</span>
        </div>
      ) : null}

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

              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="text-xs font-medium uppercase tracking-[0.2em] text-muted flex items-center gap-2"
                >
                  <Mail className="h-3.5 w-3.5" />
                  Email Address *
                </Label>
                <Input
                  id="email"
                  type="email"
                  {...emailRegister}
                  placeholder="john.doe@example.com"
                  className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                />
                {errors.email && (
                  <div className="text-xs text-rose-300">{errors.email.message}</div>
                )}
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="phone"
                  className="text-xs font-medium uppercase tracking-[0.2em] text-muted flex items-center gap-2"
                >
                  <Phone className="h-3.5 w-3.5" />
                  Phone Number
                </Label>
                <GhanaPhoneInput
                  id="phone"
                  {...register("phone")}
                  className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                />
                {errors.phone && (
                  <div className="text-xs text-rose-300">{errors.phone.message}</div>
                )}
              </div>
            </section>
          )}

          {/* Step 2: Photo & Relationship */}
          {currentStep === 2 && (
            <section className="space-y-6">
              <div className="space-y-4">
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                  Guardian Photo
                </h2>

                <div className="flex flex-col items-center gap-4">
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className="relative"
                  >
                    <div className="relative h-36 w-36 rounded-full border-4 border-white/10 bg-white/5 overflow-hidden shadow-lg">
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
                              alt="Guardian photo"
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
                        className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-rose-500 hover:bg-rose-600 border-2 border-white/10 flex items-center justify-center text-white shadow-lg transition-colors cursor-pointer"
                      >
                        <X className="h-4 w-4" />
                      </motion.button>
                    )}
                  </motion.div>

                  <div className="w-full">
                    <ImageUploader
                      schoolId={me.schoolId}
                      subjectRole="parents"
                      onUploaded={(payload) => {
                        setValue("photoUrl", payload.url, {
                          shouldValidate: true,
                        });
                      }}
                      onError={(msg) => {
                        console.error("Photo upload error:", msg);
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

              <div className="space-y-3">
                <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                  Relationship *
                </Label>
                <Controller
                  name="relationship"
                  control={control}
                  render={({ field }) => (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {RELATIONSHIP_OPTIONS.map((option) => (
                        <motion.button
                          key={option.value}
                          type="button"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => field.onChange(option.value)}
                          className={`relative rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all text-left cursor-pointer ${
                            field.value === option.value
                              ? "border-brand bg-brand/20 text-brand shadow-lg shadow-brand/20"
                              : "border-white/10 bg-white/5 text-white/80 hover:border-white/20 hover:bg-white/10"
                          }`}
                        >
                          {field.value === option.value && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-brand text-black flex items-center justify-center"
                            >
                              <Check className="h-4 w-4" />
                            </motion.div>
                          )}
                          <span>{option.label}</span>
                        </motion.button>
                      ))}
                    </div>
                  )}
                />
                {errors.relationship && (
                  <div className="text-xs text-rose-300">
                    {errors.relationship.message}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                  Primary Contact
                </Label>
                <Controller
                  name="isPrimary"
                  control={control}
                  render={({ field }) => (
                    <div className="grid grid-cols-2 gap-3">
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => field.onChange(true)}
                        className={`relative rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all text-left cursor-pointer ${
                          field.value === true
                            ? "border-brand bg-brand/20 text-brand shadow-lg shadow-brand/20"
                            : "border-white/10 bg-white/5 text-white/80 hover:border-white/20 hover:bg-white/10"
                        }`}
                      >
                        {field.value === true && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-brand text-black flex items-center justify-center"
                          >
                            <Check className="h-4 w-4" />
                          </motion.div>
                        )}
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4" />
                          <span>Yes, Primary Contact</span>
                        </div>
                        <div className="mt-1 text-xs text-white/60">
                          This guardian will be the primary contact
                        </div>
                      </motion.button>
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => field.onChange(false)}
                        className={`relative rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all text-left cursor-pointer ${
                          field.value === false
                            ? "border-brand bg-brand/20 text-brand shadow-lg shadow-brand/20"
                            : "border-white/10 bg-white/5 text-white/80 hover:border-white/20 hover:bg-white/10"
                        }`}
                      >
                        {field.value === false && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-brand text-black flex items-center justify-center"
                          >
                            <Check className="h-4 w-4" />
                          </motion.div>
                        )}
                        <div className="flex items-center gap-2">
                          <StarOff className="h-4 w-4" />
                          <span>No, Secondary Contact</span>
                        </div>
                        <div className="mt-1 text-xs text-white/60">
                          This guardian is not the primary contact
                        </div>
                      </motion.button>
                    </div>
                  )}
                />
              </div>

              <div className="space-y-3">
                <Label
                  htmlFor="occupation"
                  className="text-xs font-medium uppercase tracking-[0.2em] text-muted flex items-center gap-2"
                >
                  <Briefcase className="h-3.5 w-3.5" />
                  Occupation
                </Label>
                <Input
                  id="occupation"
                  {...register("occupation")}
                  placeholder="e.g., Teacher, Engineer, Doctor"
                  className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                />
                {errors.occupation && (
                  <div className="text-xs text-rose-300">
                    {errors.occupation.message}
                  </div>
                )}
                <p className="text-xs text-muted-foreground/70">
                  Optional: Enter the guardian&apos;s profession or job title
                </p>
              </div>
            </section>
          )}

          {/* Step 3: Review & Submit */}
          {currentStep === 3 && (
            <section className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                Review Information
              </h2>
              <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground/70">Name:</span>
                    <p className="font-medium text-white/90">
                      {firstName} {lastName}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground/70">Email:</span>
                    <p className="font-medium text-white/90">{watch("email")}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground/70">Relationship:</span>
                    <p className="font-medium text-white/90">
                      {RELATIONSHIP_OPTIONS.find((r) => r.value === watch("relationship"))?.label}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground/70">Primary Contact:</span>
                    <p className="font-medium text-white/90">
                      {watch("isPrimary") ? "Yes" : "No"}
                    </p>
                  </div>
                  {watch("occupation") && (
                    <div>
                      <span className="text-muted-foreground/70">Occupation:</span>
                      <p className="font-medium text-white/90">{watch("occupation")}</p>
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
          onClick={isFirstStep ? onCancel : handlePrevious}
          disabled={isSubmitting || isLoading}
          className="gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
              className="gap-2 bg-brand text-black hover:opacity-90 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="gap-2 bg-brand text-black hover:opacity-90 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting || isLoading ? (
                isEdit ? "Updating…" : "Creating…"
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  {isEdit ? "Update Guardian" : "Create Guardian"}
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
