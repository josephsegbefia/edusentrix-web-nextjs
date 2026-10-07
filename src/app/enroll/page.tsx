"use client";

import { useState } from "react";
import { z } from "zod";
import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import {
  authCheckboxClass,
  authCompactInputClass,
  authPageGlowStyle,
  authSelectContentClass,
  authSelectItemClass,
  authSelectTriggerClass,
  authTextareaClass,
} from "@/components/auth/auth-surfaces";
import { Button } from "@/components/ui/button";
import { GhanaPhoneInput } from "@/components/ui/ghana-phone-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useBusyToast } from "@/hooks/useBusyToast";
import {
  GHANA_REGIONS,
  GhanaRegionSchema,
  type GhanaRegion,
} from "@/constants/ghanaRegions";
import { EduSentrixWordmark } from "@/components/brand/EduSentrixWordmark";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal/versions";
import { LegalAcceptanceModal } from "@/components/legal/LegalAcceptanceModal";
import {
  TERMS_OF_USE_INTRO,
  TERMS_OF_USE_LAST_UPDATED,
  TERMS_OF_USE_SECTIONS,
  TERMS_OF_USE_SUPPORT_EMAIL,
  TERMS_OF_USE_SUPPORT_PHONE,
} from "@/lib/legal/terms-of-use";
import {
  PRIVACY_POLICY_CONTACT_EMAIL,
  PRIVACY_POLICY_CONTACT_PHONE,
  PRIVACY_POLICY_INTRO,
  PRIVACY_POLICY_LAST_UPDATED,
  PRIVACY_POLICY_SECTIONS,
} from "@/lib/legal/privacy-policy";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  CreditCard,
  Globe,
  GraduationCap,
  Loader2,
  MessageSquare,
  Shield,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";

const FormSchema = z.object({
  adminFirstName: z.string().min(2, "First name is too short"),
  adminLastName: z.string().min(2, "Last name is too short"),
  adminEmail: z.string().email("Enter a valid email"),
  adminPhone: z.string().optional(),
  schoolName: z.string().min(2, "School name is too short"),
  schoolType: z.enum(["Basic", "Secondary"], {
    message: "Select a school type",
  }),
  city: z.string().optional(),
  region: GhanaRegionSchema,
  message: z.string().optional(),
  termsVersion: z.literal(TERMS_VERSION),
  privacyVersion: z.literal(PRIVACY_VERSION),
  termsAccepted: z.literal("on", {
    errorMap: () => ({ message: "You must accept the Terms of Use to continue." }),
  }),
  privacyAccepted: z.literal("on", {
    errorMap: () => ({ message: "You must accept the Privacy Policy to continue." }),
  }),
});

async function parseApiError(res: Response) {
  try {
    const data = await res.json();
    return data?.error || data?.message || res.statusText || "Request failed";
  } catch {
    return res.statusText || "Request failed";
  }
}

/* ──────────────────────────────────────────────────────────────────
   Shared atoms
   ────────────────────────────────────────────────────────────────── */

const inputClasses = authCompactInputClass;

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="h-px flex-1 bg-(--m-subtle)" />
      <span className="text-[11px] font-semibold uppercase tracking-[0.22em] m-faint">
        {children}
      </span>
      <span className="h-px flex-1 bg-(--m-subtle)" />
    </div>
  );
}

function FeaturePill({
  icon: Icon,
  label,
}: {
  icon: React.ElementType;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-(--m-border) bg-(--m-subtle) px-3 py-1.5 text-xs font-medium m-muted backdrop-blur-sm">
      <Icon className="h-3.5 w-3.5 text-brand" />
      {label}
    </div>
  );
}

function FloatingOrb({
  className,
  delay = "0s",
}: {
  className: string;
  delay?: string;
}) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute rounded-full blur-3xl ${className}`}
      style={{
        animation: "float 8s ease-in-out infinite",
        animationDelay: delay,
      }}
    />
  );
}

/* ──────────────────────────────────────────────────────────────────
   Step indicator
   ────────────────────────────────────────────────────────────────── */

function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1 rounded-full transition-all duration-300 ${
            i < step
              ? "w-6 bg-brand"
              : i === step
                ? "w-6 bg-brand/50"
                : "w-3 bg-(--m-subtle)"
          }`}
        />
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   How-it-works step
   ────────────────────────────────────────────────────────────────── */

function HowStep({
  num,
  title,
  desc,
}: {
  num: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-3.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-xs font-bold text-brand">
        {num}
      </span>
      <div>
        <p className="text-sm font-semibold text-(--m-fg)">{title}</p>
        <p className="mt-0.5 text-xs leading-5 m-faint">{desc}</p>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Marketing panel (left side)
   ────────────────────────────────────────────────────────────────── */

function MarketingPanel() {
  return (
    <div className="relative flex flex-col justify-between gap-10 lg:gap-10">
      {/* Logo */}
      <BrandMark />

      {/* Headline */}
      <div className="space-y-5">
        <div className="inline-flex items-center gap-2.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 backdrop-blur-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          Free onboarding — no credit card required
        </div>

        <h1 className="max-w-md text-[2.5rem] font-bold leading-[1.1] tracking-tight sm:text-5xl">
          <span className="text-(--m-fg)">
            Get your school on{" "}
          </span>
          <EduSentrixWordmark className="text-[2.5rem] sm:text-5xl" />
        </h1>

        <p className="max-w-md text-base leading-7 m-muted">
          Join schools across Ghana already using the modern platform for fee
          collection, academic management, and parent communication.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-(--m-border) bg-(--m-subtle) p-3.5 backdrop-blur-sm">
          <Users className="h-4 w-4 text-brand" />
          <p className="mt-2 text-xl font-bold text-(--m-fg)">10k+</p>
          <p className="text-[11px] m-faint">students managed</p>
        </div>
        <div className="rounded-2xl border border-(--m-border) bg-(--m-subtle) p-3.5 backdrop-blur-sm">
          <Clock className="h-4 w-4 text-brand" />
          <p className="mt-2 text-xl font-bold text-(--m-fg)">&lt;1 day</p>
          <p className="text-[11px] m-faint">setup time</p>
        </div>
        <div className="rounded-2xl border border-(--m-border) bg-(--m-subtle) p-3.5 backdrop-blur-sm">
          <CreditCard className="h-4 w-4 text-brand" />
          <p className="mt-2 text-xl font-bold text-(--m-fg)">MoMo</p>
          <p className="text-[11px] m-faint">+ bank transfers</p>
        </div>
      </div>

      {/* How it works */}
      <div className="space-y-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] m-faint">
          How it works
        </p>
        <div className="space-y-4 rounded-2xl border border-(--m-border) bg-(--m-subtle) p-5 backdrop-blur-sm">
          <HowStep
            num="1"
            title="Submit this form"
            desc="Tell us about your school and administrator."
          />
          <div className="ml-4 h-4 border-l border-dashed border-(--m-border)" />
          <HowStep
            num="2"
            title="We review & onboard"
            desc="Our team sets up your workspace within 24 hours."
          />
          <div className="ml-4 h-4 border-l border-dashed border-(--m-border)" />
          <HowStep
            num="3"
            title="Go live"
            desc="Start collecting fees and managing your school."
          />
        </div>
      </div>

      {/* Feature pills */}
      <div className="flex flex-wrap gap-2">
        <FeaturePill icon={Shield} label="Enterprise security" />
        <FeaturePill icon={Sparkles} label="AI assistant" />
        <FeaturePill icon={BookOpen} label="Report cards" />
        <FeaturePill icon={Globe} label="Mobile Money" />
      </div>

      {/* Testimonial */}
      <div className="rounded-2xl border border-(--m-border) bg-(--m-subtle) p-5 backdrop-blur-sm">
        <div className="flex gap-1">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
          ))}
        </div>
        <p className="mt-3 text-sm leading-6 m-muted italic">
          &ldquo;We enrolled on Monday, collected our first fees on Wednesday. The
          speed of onboarding is unmatched.&rdquo;
        </p>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-br from-violet-500 to-purple-600 text-[10px] font-bold text-white">
            KA
          </div>
          <div>
            <p className="text-sm font-semibold text-(--m-fg)">
              Kwame Asante
            </p>
            <p className="text-[11px] m-faint">
              Headmaster, Bright Future Academy
            </p>
          </div>
        </div>
      </div>

      {/* Back link */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link
          href="/sign-in"
          className="inline-flex items-center gap-2 rounded-2xl border border-(--m-border) bg-(--m-subtle) px-4 py-2.5 font-medium m-muted transition-all duration-200 hover:border-(--m-border) hover:bg-(--m-glass) hover:text-(--m-fg)"
        >
          Already enrolled? Sign in
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-1 py-2.5 font-medium m-faint transition-all duration-200 hover:text-(--m-fg)"
        >
          Back to website
        </Link>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Success state
   ────────────────────────────────────────────────────────────────── */

function SuccessView({ onReset }: { onReset: () => void }) {
  return (
    <div className="m-page relative min-h-dvh antialiased">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={authPageGlowStyle}
      />
      <FloatingOrb className="left-[20%] top-[20%] h-64 w-64 bg-emerald-500/10" delay="0s" />
      <FloatingOrb className="right-[10%] bottom-[20%] h-56 w-56 bg-brand/10" delay="2s" />

      <div
        aria-hidden
        className="pointer-events-none absolute left-0 right-0 top-0 h-px bg-linear-to-r from-transparent via-emerald-500/30 to-transparent"
      />

      <div className="relative flex min-h-dvh items-center justify-center px-4">
        <div className="w-full max-w-lg text-center">
          {/* Glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/10 blur-3xl"
          />

          <div className="relative overflow-hidden rounded-4xl border border-(--m-border) m-card-strong p-10 shadow-2xl shadow-black/50 backdrop-blur-2xl sm:p-14">
            {/* Decorative gradient */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-linear-to-br from-emerald-500/5 via-transparent to-brand/5"
            />

            <div className="relative space-y-6">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-emerald-500/20 bg-emerald-500/10">
                <CheckCircle2 className="h-10 w-10 text-emerald-400" />
              </div>

              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700 dark:text-emerald-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  Application Submitted
                </div>

                <h1 className="text-3xl font-bold tracking-tight text-(--m-fg) sm:text-4xl">
                  You&apos;re in the queue
                </h1>

                <p className="mx-auto max-w-sm text-sm leading-6 m-muted">
                  Our team will review your application and send onboarding
                  instructions to your email within 24 hours.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="rounded-xl border border-(--m-border) bg-(--m-subtle) p-3 text-center">
                  <p className="text-lg font-bold text-(--m-fg)">1</p>
                  <p className="text-[10px] m-faint">Review</p>
                </div>
                <div className="rounded-xl border border-(--m-border) bg-(--m-subtle) p-3 text-center">
                  <p className="text-lg font-bold m-faint">2</p>
                  <p className="text-[10px] m-faint">Setup</p>
                </div>
                <div className="rounded-xl border border-(--m-border) bg-(--m-subtle) p-3 text-center">
                  <p className="text-lg font-bold m-faint">3</p>
                  <p className="text-[10px] m-faint">Go Live</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button
              onClick={onReset}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand px-6 py-3 text-sm font-semibold text-black shadow-lg shadow-brand/20 transition-all duration-200 hover:bg-sky-300 hover:shadow-brand/35"
            >
              Submit another application
            </Button>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium m-faint transition-all duration-200 hover:text-(--m-fg)"
            >
              Back to website
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Main page
   ────────────────────────────────────────────────────────────────── */

export default function EnrollPage() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success">("idle");
  const [schoolType, setSchoolType] = useState<"Basic" | "Secondary" | "">("");
  const [region, setRegion] = useState<GhanaRegion | "">("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [legalModal, setLegalModal] = useState<"terms" | "privacy" | null>(null);
  const { promise, error } = useBusyToast();

  const canSubmitApplication = termsAccepted && privacyAccepted;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget as HTMLFormElement;
    const fd = new FormData(formEl);
    const raw = Object.fromEntries(fd.entries());

    const result = FormSchema.safeParse({
      ...raw,
      schoolType: schoolType || (raw.schoolType as string | undefined),
      region: region || (raw.region as string | undefined),
      termsAccepted: termsAccepted ? "on" : undefined,
      privacyAccepted: privacyAccepted ? "on" : undefined,
    });

    if (!result.success) {
      error(
        result.error.issues?.[0]?.message ??
          "Please review your inputs and try again."
      );
      return;
    }

    setStatus("idle");
    setLoading(true);

    const doSubmit = async () => {
      const payload = {
        ...result.data,
        termsAccepted: true,
        privacyAccepted: true,
      };
      const res = await fetch("/api/platform/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
      });

      if (!res.ok) {
        const msg = await parseApiError(res);
        throw new Error(msg || "Failed to submit. Please try again.");
      }

      const body = await res.json().catch(() => ({}));
      if (body?.success === false) {
        throw new Error(body?.error || "Failed to submit. Please try again.");
      }

      return body;
    };

    try {
      await promise(doSubmit(), {
        loading: "Submitting application…",
        success: (result) =>
          result?.emailStatus === "sent"
            ? "Application received. A confirmation email has been sent."
            : result?.emailStatus === "queued"
              ? "Application received. Your confirmation email is queued for delivery."
              : "Application received. We could not send the confirmation email yet.",
        error: "Failed to submit. Please try again.",
      });

      setStatus("success");
      formEl.reset();
      setSchoolType("");
      setRegion("");
      setTermsAccepted(false);
      setPrivacyAccepted(false);
    } catch {
      formEl.reset();
      setSchoolType("");
      setRegion("");
      setTermsAccepted(false);
      setPrivacyAccepted(false);
      setStatus("idle");
    } finally {
      setLoading(false);
    }
  }

  if (status === "success") {
    return (
      <SuccessView
        onReset={() => setStatus("idle")}
      />
    );
  }

  return (
    <div className="m-page relative min-h-dvh antialiased">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={authPageGlowStyle}
      />

      {/* Floating orbs */}
      <FloatingOrb className="left-[8%] top-[12%] h-72 w-72 bg-violet-500/15" delay="0s" />
      <FloatingOrb className="-right-20 top-[45%] h-80 w-80 bg-brand/10" delay="2s" />
      <FloatingOrb className="bottom-[8%] left-[25%] h-56 w-56 bg-primary/10" delay="4s" />

      {/* Top accent line */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-0 right-0 top-0 h-px bg-linear-to-r from-transparent via-brand/30 to-transparent"
      />

      <div className="relative mx-auto grid min-h-dvh max-w-7xl items-start gap-12 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-16 lg:px-8 lg:py-16">
        {/* Left: Marketing */}
        <div className="hidden lg:block">
          <MarketingPanel />
        </div>

        {/* Right: Form card */}
        <div className="relative mx-auto w-full max-w-xl lg:mx-0 lg:max-w-none">
          {/* Card glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-1 rounded-[2.1rem] bg-linear-to-br from-brand/20 via-transparent to-primary/20 opacity-60 blur-xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-px rounded-4xl bg-linear-to-br from-brand/10 via-transparent to-primary/10"
          />

          <div className="relative overflow-hidden rounded-4xl border border-(--m-border) m-card-strong shadow-2xl shadow-black/50 backdrop-blur-2xl">
            {/* Card header */}
            <div className="border-b border-(--m-border) bg-(--m-subtle) px-6 py-5 sm:px-8">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-2.5">
                  <div className="inline-flex items-center gap-2 rounded-full border border-(--m-border) bg-(--m-subtle) px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] m-faint">
                    <GraduationCap className="h-3.5 w-3.5 text-brand" />
                    School Enrolment
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-(--m-fg) sm:text-3xl">
                      Enrol your school
                    </h1>
                    <p className="mt-1 text-sm m-faint">
                      Tell us about your institution and we&apos;ll have you set up
                      within 24 hours.
                    </p>
                  </div>
                </div>
                <ThemeToggle className="shrink-0" />
              </div>

              {/* Step indicator */}
              <div className="mt-4">
                <StepIndicator step={1} total={3} />
                <p className="mt-2 text-[11px] uppercase tracking-[0.2em] m-faint">
                  Step 1 of 3 — Submit application
                </p>
              </div>
            </div>

            {/* Mobile-only marketing summary */}
            <div className="border-b border-(--m-border) bg-(--m-subtle) px-6 py-4 sm:px-8 lg:hidden">
              <BrandMark size="sm" showTagline />
              <div className="mt-3 flex flex-wrap gap-2">
                <FeaturePill icon={TrendingUp} label="Fee collection" />
                <FeaturePill icon={GraduationCap} label="Academics" />
                <FeaturePill icon={MessageSquare} label="Communication" />
              </div>
            </div>

            {/* Form body */}
            <div className="px-6 py-7 sm:px-8 sm:py-8">
              <form onSubmit={onSubmit} className="space-y-7">
                {/* Administrator section */}
                <div className="space-y-4">
                  <SectionLabel>Administrator Details</SectionLabel>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label
                        htmlFor="adminFirstName"
                        className="text-[11px] font-semibold uppercase tracking-[0.22em] m-faint"
                      >
                        First name *
                      </Label>
                      <Input
                        id="adminFirstName"
                        name="adminFirstName"
                        autoComplete="given-name"
                        required
                        placeholder="John"
                        className={inputClasses}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="adminLastName"
                        className="text-[11px] font-semibold uppercase tracking-[0.22em] m-faint"
                      >
                        Last name *
                      </Label>
                      <Input
                        id="adminLastName"
                        name="adminLastName"
                        autoComplete="family-name"
                        required
                        placeholder="Mensah"
                        className={inputClasses}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label
                        htmlFor="adminEmail"
                        className="text-[11px] font-semibold uppercase tracking-[0.22em] m-faint"
                      >
                        Email *
                      </Label>
                      <Input
                        id="adminEmail"
                        name="adminEmail"
                        type="email"
                        autoComplete="email"
                        required
                        placeholder="admin@school.edu"
                        className={inputClasses}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="adminPhone"
                        className="text-[11px] font-semibold uppercase tracking-[0.22em] m-faint"
                      >
                        Phone
                      </Label>
                      <GhanaPhoneInput
                        id="adminPhone"
                        name="adminPhone"
                        autoComplete="tel"
                        className={inputClasses}
                        prefixClassName="m-muted"
                      />
                    </div>
                  </div>
                </div>

                {/* School section */}
                <div className="space-y-4">
                  <SectionLabel>School Information</SectionLabel>

                  <div className="space-y-2">
                    <Label
                      htmlFor="schoolName"
                      className="text-[11px] font-semibold uppercase tracking-[0.22em] m-faint"
                    >
                      School name *
                    </Label>
                    <Input
                      id="schoolName"
                      name="schoolName"
                      required
                      placeholder="Prestige Academy"
                      className={inputClasses}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-[11px] font-semibold uppercase tracking-[0.22em] m-faint">
                        School type *
                      </Label>
                      <input type="hidden" name="schoolType" value={schoolType} />
                      <Select
                        value={schoolType}
                        onValueChange={(v) =>
                          setSchoolType(v as "Basic" | "Secondary")
                        }
                      >
                        <SelectTrigger className={authSelectTriggerClass}>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent className={authSelectContentClass}>
                          <SelectItem value="Basic" className={authSelectItemClass}>
                            Basic School
                          </SelectItem>
                          <SelectItem value="Secondary" className={authSelectItemClass}>
                            Secondary School
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[11px] font-semibold uppercase tracking-[0.22em] m-faint">
                        Region *
                      </Label>
                      <input type="hidden" name="region" value={region} />
                      <Select
                        value={region}
                        onValueChange={(v) => setRegion(v as GhanaRegion)}
                      >
                        <SelectTrigger className={authSelectTriggerClass}>
                          <SelectValue placeholder="Select region" />
                        </SelectTrigger>
                        <SelectContent className={`max-h-64 ${authSelectContentClass}`}>
                          {GHANA_REGIONS.map((r) => (
                            <SelectItem
                              key={r}
                              value={r}
                              className={authSelectItemClass}
                            >
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label
                        htmlFor="city"
                        className="text-[11px] font-semibold uppercase tracking-[0.22em] m-faint"
                      >
                        City / Town
                      </Label>
                      <Input
                        id="city"
                        name="city"
                        autoComplete="address-level2"
                        placeholder="Accra"
                        className={inputClasses}
                      />
                    </div>
                  </div>
                </div>

                {/* Additional details */}
                <div className="space-y-4">
                  <SectionLabel>Additional Details</SectionLabel>

                  <div className="space-y-2">
                    <Label
                      htmlFor="message"
                      className="text-[11px] font-semibold uppercase tracking-[0.22em] m-faint"
                    >
                      Message (optional)
                    </Label>
                    <Textarea
                      id="message"
                      name="message"
                      rows={3}
                      placeholder="Tell us about your school size, specific requirements, or questions..."
                      className={authTextareaClass}
                    />
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border border-(--m-border) bg-(--m-subtle) p-4">
                  <input type="hidden" name="termsVersion" value={TERMS_VERSION} />
                  <input type="hidden" name="privacyVersion" value={PRIVACY_VERSION} />
                  <label className="flex items-start gap-3 text-sm m-muted">
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      readOnly
                      tabIndex={-1}
                      aria-checked={termsAccepted}
                      className={authCheckboxClass}
                    />
                    <span>
                      I have read and accept the{" "}
                      <button
                        type="button"
                        onClick={() => setLegalModal("terms")}
                        className="text-cyan-700 dark:text-cyan-300 underline-offset-2 hover:text-cyan-800 dark:hover:text-cyan-200 hover:underline"
                      >
                        Terms of Use
                      </button>
                      .
                    </span>
                  </label>
                  <label className="flex items-start gap-3 text-sm m-muted">
                    <input
                      type="checkbox"
                      checked={privacyAccepted}
                      readOnly
                      tabIndex={-1}
                      aria-checked={privacyAccepted}
                      className={authCheckboxClass}
                    />
                    <span>
                      I have read and accept the{" "}
                      <button
                        type="button"
                        onClick={() => setLegalModal("privacy")}
                        className="text-cyan-700 dark:text-cyan-300 underline-offset-2 hover:text-cyan-800 dark:hover:text-cyan-200 hover:underline"
                      >
                        Privacy Policy
                      </button>
                      .
                    </span>
                  </label>
                  {!canSubmitApplication ? (
                    <p className="text-xs leading-5 m-faint">
                      Open and accept both documents above to enable submission.
                    </p>
                  ) : null}
                </div>

                {/* Submit */}
                <div className="space-y-3 pt-1">
                  <Button
                    type="submit"
                    disabled={loading || !canSubmitApplication}
                    aria-busy={loading}
                    className="group flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand px-6 text-sm font-semibold text-black shadow-lg shadow-brand/25 transition-all duration-200 hover:bg-sky-300 hover:shadow-brand/40 hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Submitting…
                      </>
                    ) : (
                      <>
                        Submit application
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </>
                    )}
                  </Button>
                  <p className="text-center text-[11px] uppercase tracking-[0.2em] m-faint">
                    Fields marked * are required
                  </p>
                </div>
              </form>
            </div>

            {/* Card footer */}
            <div className="border-t border-(--m-border) bg-(--m-subtle) px-6 py-4 sm:px-8">
              <div className="flex items-center justify-between text-xs m-faint">
                <div className="flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5" />
                  <span>Your data is encrypted and secure</span>
                </div>
                <span className="hidden sm:inline">256-bit SSL</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <LegalAcceptanceModal
        open={legalModal === "terms"}
        onClose={() => setLegalModal(null)}
        title="Terms of Use"
        intro={TERMS_OF_USE_INTRO}
        lastUpdated={TERMS_OF_USE_LAST_UPDATED}
        sections={TERMS_OF_USE_SECTIONS}
        contactNote={
          <>
            Need clarification or legal contact? Email{" "}
            <a
              className="font-semibold underline decoration-cyan-700/40 dark:decoration-cyan-300/50"
              href={`mailto:${TERMS_OF_USE_SUPPORT_EMAIL}`}
            >
              {TERMS_OF_USE_SUPPORT_EMAIL}
            </a>{" "}
            or call{" "}
            <a
              className="font-semibold underline decoration-cyan-700/40 dark:decoration-cyan-300/50"
              href={`tel:${TERMS_OF_USE_SUPPORT_PHONE}`}
            >
              {TERMS_OF_USE_SUPPORT_PHONE}
            </a>
            .
          </>
        }
        onAccept={() => setTermsAccepted(true)}
        acceptLabel="Accept Terms of Use"
      />

      <LegalAcceptanceModal
        open={legalModal === "privacy"}
        onClose={() => setLegalModal(null)}
        title="Privacy Policy"
        intro={PRIVACY_POLICY_INTRO}
        lastUpdated={PRIVACY_POLICY_LAST_UPDATED}
        sections={PRIVACY_POLICY_SECTIONS}
        contactNote={
          <>
            Need privacy support? Email{" "}
            <a
              className="font-semibold underline decoration-cyan-700/40 dark:decoration-cyan-300/50"
              href={`mailto:${PRIVACY_POLICY_CONTACT_EMAIL}`}
            >
              {PRIVACY_POLICY_CONTACT_EMAIL}
            </a>{" "}
            or call{" "}
            <a
              className="font-semibold underline decoration-cyan-700/40 dark:decoration-cyan-300/50"
              href={`tel:${PRIVACY_POLICY_CONTACT_PHONE}`}
            >
              {PRIVACY_POLICY_CONTACT_PHONE}
            </a>
            .
          </>
        }
        onAccept={() => setPrivacyAccepted(true)}
        acceptLabel="Accept Privacy Policy"
      />
    </div>
  );
}
