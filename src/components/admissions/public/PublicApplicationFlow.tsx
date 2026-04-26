"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
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
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-10">
      <a
        href="#admission-application-form"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-foreground focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-background focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-foreground/40"
      >
        Skip to application form
      </a>
      <header className="mb-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        {cycle.schoolLogoUrl ? (
          <Image
            src={cycle.schoolLogoUrl}
            alt={cycle.schoolName}
            width={56}
            height={56}
            unoptimized
            className="h-14 w-14 rounded-2xl border border-border/60 bg-white object-contain p-1.5 shadow-sm"
          />
        ) : (
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border/60 bg-white text-lg font-bold text-muted-foreground shadow-sm"
            aria-hidden
          >
            {cycle.schoolName.slice(0, 1)}
          </div>
        )}
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {cycle.schoolName} · Admissions
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {cycle.name}
          </h1>
          {cycle.branding?.welcomeMessage ? (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {cycle.branding.welcomeMessage}
            </p>
          ) : (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Complete the steps below to submit your application. You will receive a
              tracker link to follow your application status.
            </p>
          )}
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

      <Card className="mt-6" id="admission-application-form">
        <CardContent className="space-y-6 p-5 sm:p-7">
          {currentSection ? (
            <div>
              <div className="mb-5">
                <h2
                  ref={stepHeadingRef}
                  tabIndex={-1}
                  className="text-lg font-semibold text-foreground outline-none"
                >
                  {currentSection.title}
                </h2>
                {currentSection.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">
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
                  className="text-lg font-semibold text-foreground outline-none"
                >
                  Documents
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
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
                      <p className="mt-1 text-xs font-medium text-rose-500">
                        {errors[req.id]}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
              {form.consentText ? (
                <div className="mt-6 rounded-xl border border-border/60 bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground">
                  {form.consentText}
                </div>
              ) : null}
            </div>
          )}

          <div className="flex flex-col-reverse items-stretch gap-2 border-t border-border/60 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={goBack}
              disabled={stepIdx === 0 || submitting}
              className="sm:w-auto"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>

            {stepIdx < totalSteps - 1 ? (
              <Button
                type="button"
                onClick={goNext}
                disabled={submitting}
                className="sm:w-auto"
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
                className="sm:w-auto"
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

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Powered by EduSentrix · Your information is shared only with{" "}
        <span className="font-medium">{cycle.schoolName}</span>.
      </p>

      <PublicHelpWidget
        schoolName={cycle.schoolName}
        cycleName={cycle.name}
      />
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
    <div className="space-y-2">
      <div
        className="flex items-center justify-between text-xs text-muted-foreground"
        aria-live="polite"
      >
        <span className="font-medium text-foreground">
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
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: accentColor }}
        />
      </div>
      <ol className="hidden list-none gap-2 sm:flex" aria-label="Application steps">
        {steps.map((s, i) => (
          <li
            key={s}
            aria-current={i === active ? "step" : undefined}
            className={cn(
              "flex-1 truncate rounded-md px-2 py-1 text-[11px] font-medium",
              i === active
                ? "bg-foreground text-background"
                : i < active
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                  : "bg-muted text-muted-foreground"
            )}
          >
            <span className="sr-only">
              {i < active ? "Completed: " : i === active ? "Current step: " : ""}
            </span>
            {s}
          </li>
        ))}
      </ol>
    </div>
  );
}

function ClosedNotice({ cycle }: { cycle: PublicCycleDTO }) {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-16">
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            Applications are not currently open
          </h2>
          <p className="text-sm text-muted-foreground">
            {cycle.closedReason ??
              "Please check back when the next admission cycle opens."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
