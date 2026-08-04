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
import { useAuth } from "@/providers/auth-provider";
import { ImageUploader } from "@/components/upload/ImageUploader";
import { GhanaPhoneInput } from "@/components/ui/ghana-phone-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import type { TeacherDetailDTO, TeacherStatus } from "@/types/admin/teacher";

const TOTAL_STEPS = 5;

type Props = {
  onClose: () => void;
  teacher: TeacherDetailDTO;
  onSubmit: (payload: UpdateTeacherInput) => Promise<void>;
  isLoading?: boolean;
};

function dateInputFromIso(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = iso.includes("T") ? iso.split("T")[0] : iso.slice(0, 10);
  return d || "";
}

function getInitials(firstName?: string, lastName?: string): string {
  const first = firstName?.charAt(0)?.toUpperCase() || "";
  const last = lastName?.charAt(0)?.toUpperCase() || "";
  return first + last || "?";
}

export default function EditTeacherModal({
  onClose,
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
    reset,
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
      hireDate: dateInputFromIso(teacher.hireDate),
      terminationDate: dateInputFromIso(teacher.terminationDate),
      leaveStartDate: dateInputFromIso(teacher.leaveStartDate),
      leaveEndDate: dateInputFromIso(teacher.leaveEndDate),
      leaveReason: teacher.leaveReason ?? "",
      notes: teacher.notes ?? "",
    },
    mode: "onChange",
  });

  React.useEffect(() => {
    setCurrentStep(1);
    reset({
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      email: teacher.email ?? "",
      phone: teacher.phone ?? "",
      photoUrl: teacher.photoUrl ?? undefined,
      status: teacher.status,
      employeeId: teacher.employeeId ?? "",
      hireDate: dateInputFromIso(teacher.hireDate),
      terminationDate: dateInputFromIso(teacher.terminationDate),
      leaveStartDate: dateInputFromIso(teacher.leaveStartDate),
      leaveEndDate: dateInputFromIso(teacher.leaveEndDate),
      leaveReason: teacher.leaveReason ?? "",
      notes: teacher.notes ?? "",
    });
  }, [teacher.id, teacher.updatedAt, reset]);

  const firstName = useWatch({ control, name: "firstName" });
  const lastName = useWatch({ control, name: "lastName" });
  const photoUrl = useWatch({ control, name: "photoUrl" });
  const watchedEmail = useWatch({ control, name: "email" });
  const watchedPhone = useWatch({ control, name: "phone" });
  const watchedEmployeeId = useWatch({ control, name: "employeeId" });
  const watchedHireDate = useWatch({ control, name: "hireDate" });
  const watchedTerminationDate = useWatch({ control, name: "terminationDate" });
  const watchedLeaveStart = useWatch({ control, name: "leaveStartDate" });
  const watchedLeaveEnd = useWatch({ control, name: "leaveEndDate" });
  const watchedLeaveReason = useWatch({ control, name: "leaveReason" });
  const watchedNotes = useWatch({ control, name: "notes" });
  const currentStatus = useWatch({ control, name: "status" });

  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === TOTAL_STEPS;
  const isPending = isSubmitting || isLoading;

  async function handleNext() {
    if (currentStep === 1) {
      const ok = await trigger(["firstName", "lastName", "email"]);
      if (ok) setCurrentStep(2);
      return;
    }
    if (currentStep === 2) {
      const fields: (keyof UpdateTeacherInput)[] = ["status"];
      if (currentStatus === "on_leave") {
        fields.push("leaveStartDate", "leaveEndDate");
      }
      const ok = await trigger(fields as any);
      if (ok) setCurrentStep(3);
      return;
    }
    if (currentStep === 3) {
      const ok = await trigger(["employeeId", "hireDate", "terminationDate"]);
      if (ok) setCurrentStep(4);
      return;
    }
    if (currentStep === 4) {
      setCurrentStep(5);
    }
  }

  function handlePrevious() {
    setCurrentStep((s) => Math.max(1, s - 1));
  }

  function handleRemovePhoto() {
    setValue("photoUrl", undefined, { shouldValidate: true });
  }

  function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isLastStep) {
      void handleNext();
      return;
    }
    handleSubmit(internalSubmit)(e);
  }

  async function internalSubmit(values: UpdateTeacherInput) {
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

    if (
      teacher.status === "on_leave" &&
      values.status !== "on_leave"
    ) {
      payload.leaveStartDate = null;
      payload.leaveEndDate = null;
      payload.leaveReason = null;
    }

    if (values.employeeId !== (teacher.employeeId ?? ""))
      payload.employeeId = values.employeeId || null;

    const originalHireDate = dateInputFromIso(teacher.hireDate);
    const originalTermDate = dateInputFromIso(teacher.terminationDate);
    if (values.hireDate !== originalHireDate)
      payload.hireDate = values.hireDate || null;
    if (values.terminationDate !== originalTermDate)
      payload.terminationDate = values.terminationDate || null;

    const origLeaveStart = dateInputFromIso(teacher.leaveStartDate);
    const origLeaveEnd = dateInputFromIso(teacher.leaveEndDate);
    if (values.leaveStartDate !== origLeaveStart)
      payload.leaveStartDate = values.leaveStartDate || null;
    if (values.leaveEndDate !== origLeaveEnd)
      payload.leaveEndDate = values.leaveEndDate || null;
    if (values.leaveReason !== (teacher.leaveReason ?? ""))
      payload.leaveReason = values.leaveReason?.trim() || null;

    if (values.notes !== (teacher.notes ?? ""))
      payload.notes = values.notes || null;

    if (Object.keys(payload).length === 0) {
      onClose();
      return;
    }

    try {
      await onSubmit(payload);
      onClose();
    } catch (e: unknown) {
      console.error("Teacher update error:", e);
    }
  }

  if (!me?.schoolId) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center">
        <div className="text-sm text-white/60">School ID not available.</div>
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
      <div className="flex items-center justify-between pb-6">
        <div className="text-sm text-white/70">
          Step <span className="font-semibold">{currentStep}</span> of{" "}
          {TOTAL_STEPS}
        </div>
        <div className="flex max-w-[min(100%,280px)] flex-wrap justify-end gap-1">
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
          className="space-y-6"
        >
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
                              alt="Teacher photo"
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
                        className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white/10 bg-rose-500 text-white shadow-lg transition-colors hover:bg-rose-600"
                      >
                        <X className="h-4 w-4" />
                      </motion.button>
                    )}
                  </motion.div>
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
                  <div className="text-center text-xs text-rose-300">
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
                          className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-all ${
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
                {errors.status && (
                  <div className="text-xs text-rose-300">
                    {errors.status.message}
                  </div>
                )}
              </div>

              {currentStatus === "on_leave" && (
                <div className="space-y-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-amber-200/80">
                    Leave period
                  </p>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label
                        htmlFor="leaveStartDate"
                        className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                      >
                        Start date *
                      </Label>
                      <Input
                        id="leaveStartDate"
                        type="date"
                        {...register("leaveStartDate")}
                        className="border border-white/10 bg-white/5 text-white focus:border-brand focus:ring-1 focus:ring-brand"
                      />
                      {errors.leaveStartDate && (
                        <div className="text-xs text-rose-300">
                          {errors.leaveStartDate.message}
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="leaveEndDate"
                        className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                      >
                        End date *
                      </Label>
                      <Input
                        id="leaveEndDate"
                        type="date"
                        {...register("leaveEndDate")}
                        className="border border-white/10 bg-white/5 text-white focus:border-brand focus:ring-1 focus:ring-brand"
                      />
                      {errors.leaveEndDate && (
                        <div className="text-xs text-rose-300">
                          {errors.leaveEndDate.message}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="leaveReason"
                      className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                    >
                      Reason (optional)
                    </Label>
                    <Input
                      id="leaveReason"
                      {...register("leaveReason")}
                      placeholder="Brief reason for leave"
                      className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                    />
                  </div>
                </div>
              )}
            </section>
          )}

          {currentStep === 3 && (
            <section className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                  Employment
                </h2>
                <p className="mt-1 text-sm text-white/55">
                  Subject classes and homeroom are managed from the teacher
                  profile, not here.
                </p>
              </div>
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
                    htmlFor="hireDate"
                    className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                  >
                    Hire date
                  </Label>
                  <Input
                    id="hireDate"
                    type="date"
                    {...register("hireDate")}
                    className="border border-white/10 bg-white/5 text-white focus:border-brand focus:ring-1 focus:ring-brand"
                  />
                </div>
              </div>

              {currentStatus === "terminated" && (
                <div className="space-y-2">
                  <Label
                    htmlFor="terminationDate"
                    className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                  >
                    Termination date
                  </Label>
                  <Input
                    id="terminationDate"
                    type="date"
                    {...register("terminationDate")}
                    className="border border-white/10 bg-white/5 text-white focus:border-brand focus:ring-1 focus:ring-brand"
                  />
                </div>
              )}
            </section>
          )}

          {currentStep === 4 && (
            <section className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                  Internal Notes
                </h2>
                <p className="mt-1 text-sm text-white/60">
                  Visible to admins only.
                </p>
              </div>
              <textarea
                {...register("notes")}
                placeholder="Add internal notes about this teacher..."
                className="h-40 w-full resize-none rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
              />
            </section>
          )}

          {currentStep === 5 && (
            <section className="space-y-6">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                Review &amp; save
              </h2>
              <p className="text-sm text-white/70">
                Teaching assignments and homeroom are unchanged here—update them
                from the teacher&apos;s profile tabs.
              </p>

              <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
                <div>
                  <div className="mb-1 text-xs uppercase tracking-[0.15em] text-white/45">
                    Name
                  </div>
                  <div className="font-medium text-white">
                    {firstName} {lastName}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <div className="mb-1 text-xs uppercase tracking-[0.15em] text-white/45">
                      Email
                    </div>
                    <div className="text-white/90">{watchedEmail || "—"}</div>
                  </div>
                  <div>
                    <div className="mb-1 text-xs uppercase tracking-[0.15em] text-white/45">
                      Phone
                    </div>
                    <div className="text-white/90">
                      {watchedPhone?.trim() ? watchedPhone : "—"}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <div className="mb-1 text-xs uppercase tracking-[0.15em] text-white/45">
                      Status
                    </div>
                    <div className="capitalize text-white/90">
                      {currentStatus?.replace("_", " ") || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-xs uppercase tracking-[0.15em] text-white/45">
                      Employee ID
                    </div>
                    <div className="text-white/90">
                      {watchedEmployeeId?.trim() ? watchedEmployeeId : "—"}
                    </div>
                  </div>
                </div>

                {currentStatus === "on_leave" ? (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <div className="mb-1 text-xs uppercase tracking-[0.15em] text-white/45">
                        Leave start
                      </div>
                      <div className="text-white/90">
                        {watchedLeaveStart || "—"}
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 text-xs uppercase tracking-[0.15em] text-white/45">
                        Leave end
                      </div>
                      <div className="text-white/90">
                        {watchedLeaveEnd || "—"}
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <div className="mb-1 text-xs uppercase tracking-[0.15em] text-white/45">
                      Hire date
                    </div>
                    <div className="text-white/90">{watchedHireDate || "—"}</div>
                  </div>
                  {currentStatus === "terminated" ? (
                    <div>
                      <div className="mb-1 text-xs uppercase tracking-[0.15em] text-white/45">
                        Termination date
                      </div>
                      <div className="text-white/90">
                        {watchedTerminationDate || "—"}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div>
                  <div className="mb-1 text-xs uppercase tracking-[0.15em] text-white/45">
                    Internal notes
                  </div>
                  <div className="whitespace-pre-wrap text-white/90">
                    {watchedNotes?.trim() ? watchedNotes : "—"}
                  </div>
                </div>
              </div>
            </section>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center justify-between border-t border-white/10 pt-6">
        <Button
          type="button"
          variant="outline"
          onClick={isFirstStep ? onClose : handlePrevious}
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
              onClick={() => void handleNext()}
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
                  Save changes
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
