"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Loader2,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PublicFormField } from "./PublicFormField";
import {
  PublicDocumentUploader,
  type UploadedDocument,
} from "./PublicDocumentUploader";
import { PublicHelpWidget } from "./PublicHelpWidget";
import type {
  PublicCycleDTO,
  PublicFormDTO,
} from "@/lib/admissions/public-shape";
import type { AdmissionFormSection } from "@/lib/admissions/types";

type Answers = Record<string, string | number | boolean | string[] | null>;

type PublicApplicationFlowProps = {
  cycle: PublicCycleDTO;
  form: PublicFormDTO;
  channel?: "public_link" | "embed" | "qr" | "direct_invite" | "whatsapp";
  inviteCode?: string | null;
};

function defaultAnswerForField(
  type: string,
  isPlatformConsent: boolean
): string | number | boolean | string[] | null {
  if (type === "boolean") return isPlatformConsent ? false : false;
  if (type === "multi_select") return [] as string[];
  if (type === "number") return null;
  return "";
}

export function PublicApplicationFlow({
  cycle,
  form,
  channel = "public_link",
  inviteCode = null,
}: PublicApplicationFlowProps) {
  const router = useRouter();
  const accent =
    cycle.branding?.accentColor && /^#[0-9a-f]{6}$/i.test(cycle.branding.accentColor)
      ? cycle.branding.accentColor
      : "#0a4ad9";

  const sections = React.useMemo<AdmissionFormSection[]>(() => {
    const visible = (form.sections ?? [])
      .map((s) => ({
        ...s,
        fields: s.fields
          .filter((f) => f.visible !== false && f.type !== "file_upload")
          .sort((a, b) => a.order - b.order),
      }))
      .filter((s) => s.fields.length > 0)
      .sort((a, b) => a.order - b.order);
    return visible;
  }, [form]);

  const totalSteps = sections.length + 1; // + documents step
  const [stepIdx, setStepIdx] = React.useState(0);
  const [answers, setAnswers] = React.useState<Answers>(() => {
    const initial: Answers = {};
    for (const section of form.sections) {
      for (const field of section.fields) {
        initial[field.id] = defaultAnswerForField(
          field.type,
          field.systemFieldKey === "consent.dataProcessing"
        );
      }
    }
    return initial;
  });
  const [documents, setDocuments] = React.useState<Record<string, UploadedDocument | null>>({});
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);

  const isDocumentsStep = stepIdx === sections.length;
  const currentSection = !isDocumentsStep ? sections[stepIdx] : null;

  // Focus the step heading on each step change so screen readers and keyboard
  // users land on a meaningful landmark when they advance through the form.
  const stepHeadingRef = React.useRef<HTMLHeadingElement | null>(null);
  React.useEffect(() => {
    stepHeadingRef.current?.focus();
  }, [stepIdx]);

  function setValue(fieldId: string, next: Answers[string]) {
    setAnswers((prev) => ({ ...prev, [fieldId]: next }));
    setErrors((prev) => {
      if (!(fieldId in prev)) return prev;
      const { [fieldId]: _omit, ...rest } = prev;
      void _omit;
      return rest;
    });
  }

  function validateStep(): boolean {
    if (isDocumentsStep) {
      const missing: Record<string, string> = {};
      for (const req of form.documentRequirements) {
        if (req.required && !documents[req.id]) {
          missing[req.id] = `${req.label} is required`;
        }
      }
      setErrors(missing);
      if (Object.keys(missing).length > 0) {
        toast.error("Please upload all required documents.");
        return false;
      }
      return true;
    }
    if (!currentSection) return true;

    const stepErrors: Record<string, string> = {};
    for (const field of currentSection.fields) {
      const v = answers[field.id];
      const empty =
        v == null ||
        (typeof v === "string" && v.trim() === "") ||
        (Array.isArray(v) && v.length === 0) ||
        (field.type === "boolean" && v === false && field.required);
      if (field.required && empty) {
        stepErrors[field.id] = `${field.label} is required`;
      }
    }
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length > 0) {
      toast.error("Please fill in the required fields.");
      return false;
    }
    return true;
  }

  function goNext() {
    if (!validateStep()) return;
    setStepIdx((idx) => Math.min(idx + 1, totalSteps - 1));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function goBack() {
    setStepIdx((idx) => Math.max(idx - 1, 0));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit() {
    if (!validateStep()) return;

    setSubmitting(true);
    try {
      const docs: UploadedDocument[] = Object.values(documents).filter(
        (d): d is UploadedDocument => Boolean(d)
      );

      const res = await fetch(
        `/api/public/admissions/${cycle.schoolId}/${cycle.slug}/applications`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            answers,
            documents: docs.map((d) => ({
              requirementId: d.requirementId,
              label: d.label,
              fileUrl: d.fileUrl,
              fileName: d.fileName,
              sizeBytes: d.sizeBytes,
              mimeType: d.mimeType,
            })),
            channel,
            inviteCode: inviteCode ?? undefined,
            referrer: typeof window !== "undefined" ? document.referrer : undefined,
          }),
        }
      );

      const json = await res.json();
      if (!res.ok || !json.success) {
        if (json?.fieldErrors && Array.isArray(json.fieldErrors)) {
          const next: Record<string, string> = {};
          for (const item of json.fieldErrors as Array<{
            fieldId: string;
            message: string;
          }>) {
            next[item.fieldId] = item.message;
          }
          setErrors(next);
          // Jump to the first section that has an error
          const errIds = new Set(Object.keys(next));
          const idx = sections.findIndex((s) =>
            s.fields.some((f) => errIds.has(f.id))
          );
          if (idx >= 0) setStepIdx(idx);
        }
        throw new Error(json?.error || "Failed to submit application");
      }

      const trackerToken = json.data.trackerToken as string;
      router.push(`/apply/track/${trackerToken}?just_submitted=1`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Submission failed";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (!cycle.acceptingApplications) {
    return (
      <ClosedNotice cycle={cycle} />
    );
  }

  return (
    <div className="min-h-screen bg-[#080b12] px-4 py-6 text-white sm:py-10">
      <a
        href="#admission-application-form"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-foreground focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-background focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-foreground/40"
      >
        Skip to application form
      </a>
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <header className="overflow-hidden rounded-3xl border border-white/10 bg-linear-to-br from-white/10 via-white/5 to-transparent p-5 shadow-2xl shadow-black/30 backdrop-blur sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              {cycle.schoolLogoUrl ? (
                <Image
                  src={cycle.schoolLogoUrl}
                  alt={cycle.schoolName}
                  width={64}
                  height={64}
                  unoptimized
                  className="h-16 w-16 shrink-0 rounded-2xl border border-white/10 bg-white object-contain p-1.5 shadow-lg"
                />
              ) : (
                <div
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-xl font-bold text-white shadow-lg"
                  aria-hidden
                >
                  {cycle.schoolName.slice(0, 1)}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200/80">
                  {cycle.schoolName} · Admissions
                </p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  {cycle.name}
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">
                  {cycle.branding?.welcomeMessage ??
                    "Complete the steps below to submit your application. You will receive a tracker link to follow your application status."}
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/70">
              <span className="block text-xs uppercase tracking-[0.18em] text-white/40">
                Current step
              </span>
              <span className="mt-1 block font-medium text-white">
                {isDocumentsStep ? "Documents" : currentSection?.title}
              </span>
            </div>
          </div>
        </header>

        <ProgressIndicator
          steps={[
            ...sections.map((s) => s.title),
            form.documentRequirements.length > 0 ? "Documents" : "Review",
          ]}
          active={stepIdx}
          accentColor={accent}
        />

        <Card
          className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur"
          id="admission-application-form"
        >
          <CardContent className="space-y-6 p-5 sm:p-7">
            <AnimatePresence mode="wait">
              <motion.div
                key={stepIdx}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                {currentSection ? (
                  <div>
                    <div className="mb-5">
                      <h2
                        ref={stepHeadingRef}
                        tabIndex={-1}
                        className="text-lg font-semibold text-white outline-none"
                      >
                        {currentSection.title}
                      </h2>
                      {currentSection.description ? (
                        <p className="mt-1 text-sm text-white/55">
                          {currentSection.description}
                        </p>
                      ) : null}
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2">
                      {currentSection.fields.map((field) => {
                        const isWide =
                          field.type === "long_text" ||
                          field.type === "address" ||
                          field.type === "boolean" ||
                          field.type === "multi_select";
                        return (
                          <div
                            key={field.id}
                            className={cn(isWide && "sm:col-span-2")}
                          >
                            <PublicFormField
                              field={field}
                              value={answers[field.id] ?? ""}
                              onChange={(v) => setValue(field.id, v)}
                              error={errors[field.id]}
                              grades={form.intakeGrades}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="mb-5">
                      <h2
                        ref={stepHeadingRef}
                        tabIndex={-1}
                        className="text-lg font-semibold text-white outline-none"
                      >
                        Documents
                      </h2>
                      <p className="mt-1 text-sm text-white/55">
                        {form.documentRequirements.length === 0
                          ? "No documents are required for this application. You may continue."
                          : "Upload the supporting documents below. Required documents are marked."}
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {form.documentRequirements.map((req) => (
                        <div key={req.id}>
                          <PublicDocumentUploader
                            requirement={req}
                            schoolId={cycle.schoolId}
                            cycleSlug={cycle.slug}
                            value={documents[req.id] ?? null}
                            onChange={(doc) =>
                              setDocuments((prev) => ({ ...prev, [req.id]: doc }))
                            }
                          />
                          {errors[req.id] ? (
                            <p className="mt-1 text-xs font-medium text-rose-300">
                              {errors[req.id]}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    {form.consentText ? (
                      <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4 text-xs leading-relaxed text-white/55">
                        {form.consentText}
                      </div>
                    ) : null}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            <div className="flex flex-col-reverse items-stretch gap-2 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={goBack}
                disabled={stepIdx === 0 || submitting}
                className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white sm:w-auto"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>

              {stepIdx < totalSteps - 1 ? (
                <Button
                  type="button"
                  onClick={goNext}
                  disabled={submitting}
                  className="text-white shadow-lg shadow-black/20 sm:w-auto"
                  style={{ backgroundColor: accent }}
                >
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="text-white shadow-lg shadow-black/20 sm:w-auto"
                  style={{ backgroundColor: accent }}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting…
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Submit application
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-center gap-2 text-center text-xs text-white/45">
          <Image
            src="/logo/edusentrix-logo-transparent.png"
            alt="EduSentrix"
            width={20}
            height={20}
            className="h-5 w-5 object-contain"
          />
          <span>
            Powered by EduSentrix · Your information is shared only with{" "}
            <span className="font-medium text-white/65">{cycle.schoolName}</span>.
          </span>
        </div>

        <PublicHelpWidget
          schoolName={cycle.schoolName}
          cycleName={cycle.name}
        />
      </div>
    </div>
  );
}

function ProgressIndicator({
  steps,
  active,
  accentColor,
}: {
  steps: string[];
  active: number;
  accentColor: string;
}) {
  const pct = Math.round(((active + 1) / steps.length) * 100);
  const currentLabel = steps[active] ?? "Application";
  return (
    <div className="space-y-3">
      <div
        className="flex items-center justify-between text-xs text-white/50"
        aria-live="polite"
      >
        <span className="font-medium text-white">
          Step {active + 1} of {steps.length}: {currentLabel}
        </span>
        <span>{pct}% complete</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Application progress: ${pct} percent complete`}
        className="h-1.5 w-full overflow-hidden rounded-full bg-white/10"
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: accentColor }}
        />
      </div>
      <ol className="hidden list-none items-center justify-center gap-2 sm:flex" aria-label="Application steps">
        {steps.map((s, i) => {
          const isCurrent = i === active;
          const isPast = i < active;
          return (
            <React.Fragment key={s}>
              {i > 0 ? (
                <li
                  aria-hidden
                  className={cn(
                    "h-px w-8 transition-colors",
                    isPast ? "bg-emerald-500" : "bg-white/10"
                  )}
                />
              ) : null}
              <li>
                <button
                  type="button"
                  aria-current={isCurrent ? "step" : undefined}
                  className={cn(
                    "flex cursor-default items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                    isCurrent
                      ? "bg-indigo-500/30 text-indigo-200 ring-1 ring-indigo-400/50"
                      : isPast
                        ? "bg-emerald-500/20 text-emerald-200"
                        : "bg-white/5 text-white/40"
                  )}
                >
                  {isPast ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[10px]">
                      {i + 1}
                    </span>
                  )}
                  <span className="max-w-28 truncate">{s}</span>
                </button>
              </li>
            </React.Fragment>
          );
        })}
      </ol>
    </div>
  );
}

function ClosedNotice({ cycle }: { cycle: PublicCycleDTO }) {
  return (
    <div className="min-h-screen bg-[#080b12] px-4 py-16 text-white">
      <Card className="mx-auto w-full max-w-xl border-white/10 bg-linear-to-br from-white/10 to-transparent shadow-2xl shadow-black/30 backdrop-blur">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-300">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold text-white">
            Applications are not currently open
          </h2>
          <p className="text-sm text-white/60">
            {cycle.closedReason ??
              "Please check back when the next admission cycle opens."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
