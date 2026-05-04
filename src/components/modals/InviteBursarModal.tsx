"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useAuth } from "@/providers/auth-provider";
import { ImageUploader } from "@/components/upload/ImageUploader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Check, X, Mail, Phone } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

const InviteBursarSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  email: z.string().trim().email("Invalid email address"),
  phone: z.string().trim().max(30, "Phone is too long").optional(),
  photoUrl: z.string().url("Invalid photo URL").optional().nullable(),
});

export type InviteBursarInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  photoUrl?: string | null;
};

type InviteBursarFormInput = z.infer<typeof InviteBursarSchema>;

type Props = {
  onClose: () => void;
  onSubmit: (payload: InviteBursarInput) => Promise<void> | void;
  isLoading?: boolean;
};

const STEPS = [
  {
    id: 1,
    title: "Basic Information",
    fields: ["firstName", "lastName", "email", "phone"],
  },
  { id: 2, title: "Photo", fields: ["photoUrl"] },
  { id: 3, title: "Review & Invite", fields: [] },
] as const;

function getInitials(firstName?: string, lastName?: string): string {
  const first = firstName?.charAt(0)?.toUpperCase() || "";
  const last = lastName?.charAt(0)?.toUpperCase() || "";
  return first + last || "?";
}

export function InviteBursarModal({ onClose, onSubmit, isLoading }: Props) {
  const busy = useBusyToast();
  const { me } = useAuth();
  const [currentStep, setCurrentStep] = React.useState(1);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    trigger,
    setValue,
    formState: { errors, isSubmitting },
    setError,
    clearErrors,
  } = useForm<InviteBursarFormInput>({
    resolver: zodResolver(InviteBursarSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      photoUrl: "",
    },
    mode: "onChange",
  });

  const firstName = useWatch({ control, name: "firstName" });
  const lastName = useWatch({ control, name: "lastName" });
  const email = useWatch({ control, name: "email" });
  const phone = useWatch({ control, name: "phone" });
  const photoUrl = useWatch({ control, name: "photoUrl" });

  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === STEPS.length;
  const currentStepData = STEPS[currentStep - 1];
  const initials = getInitials(firstName, lastName);

  async function internalSubmit(values: InviteBursarFormInput) {
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
        photoUrl: values.photoUrl || null,
      });
      onClose();
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Failed to send bursar invitation";
      if (message.toLowerCase().includes("email")) {
        setCurrentStep(1);
        setError("email", { type: "manual", message });
        return;
      }
      setSubmitError(message);
    }
  }

  async function handleNext() {
    const fields = currentStepData.fields;
    const isValid = await trigger([...fields] as (keyof InviteBursarFormInput)[]);
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

      {submitError ? (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {submitError}
        </div>
      ) : null}

      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          {currentStep === 1 && (
            <section className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                Bursar Details
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
                  <Label
                    htmlFor="email"
                    className="text-xs font-medium uppercase tracking-[0.2em] text-muted flex items-center gap-2"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    Email *
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    {...register("email")}
                    placeholder="bursar@school.edu.gh"
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
                    className="text-xs font-medium uppercase tracking-[0.2em] text-muted flex items-center gap-2"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    Phone (optional)
                  </Label>
                  <Input
                    id="phone"
                    {...register("phone")}
                    placeholder="+233 XX XXX XXXX"
                    className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                  />
                  {errors.phone && (
                    <div className="text-xs text-rose-300">
                      {errors.phone.message}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {currentStep === 2 && (
            <section className="space-y-6">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                Profile Photo (Optional)
              </h2>
              <div className="flex flex-col items-center gap-4">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="relative"
                >
                  <div className="relative h-36 w-36 overflow-hidden rounded-full border-4 border-white/10 bg-white/5 shadow-lg">
                    <AnimatePresence mode="wait">
                      {photoUrl ? (
                        <motion.div
                          key="photo"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ duration: 0.2 }}
                          className="relative h-full w-full"
                        >
                          <Image
                            src={photoUrl}
                            alt="Bursar photo"
                            fill
                            className="rounded-full object-cover"
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
                          className="flex h-full w-full items-center justify-center bg-linear-to-br from-brand/20 to-brand/10"
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
                      className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white/10 bg-rose-500 text-white shadow-lg transition-colors hover:bg-rose-600"
                    >
                      <X className="h-4 w-4" />
                    </motion.button>
                  )}
                </motion.div>

                <div className="w-full">
                  <ImageUploader
                    schoolId={me.schoolId}
                    subjectRole="bursars"
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
                <div className="text-center text-xs text-rose-300">
                  {errors.photoUrl.message}
                </div>
              )}
            </section>
          )}

          {currentStep === 3 && (
            <section className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                Review Invitation
              </h2>
              <div className="space-y-3 rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                  <div>
                    <span className="text-muted-foreground/70">Name:</span>
                    <p className="font-medium text-white/90">
                      {firstName} {lastName}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground/70">Email:</span>
                    <p className="font-medium text-white/90">{email}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground/70">Phone:</span>
                    <p className="font-medium text-white/90">{phone || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground/70">Role:</span>
                    <p className="font-medium text-white/90">Bursar</p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-white/60">
                The bursar will receive an email invitation to join your school finance
                workspace.
              </p>
            </section>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center justify-between border-t border-white/10 pt-6">
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
              disabled={isSubmitting || isLoading}
              className="gap-2 bg-brand text-black hover:opacity-90"
            >
              {isSubmitting || isLoading ? (
                "Sending…"
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Send Invitation
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
