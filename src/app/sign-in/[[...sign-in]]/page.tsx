"use client";

import * as Clerk from "@clerk/elements/common";
import * as SignIn from "@clerk/elements/sign-in";
import { useClerk, useSignIn, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { AuthSessionConflictCard } from "@/components/auth/AuthSessionConflictCard";
import {
  authErrorClass,
  authFieldLabelClass,
  authInputClass as inputClass,
  authOtpInputClass as otpInputClass,
  authPageGlowStyle,
  authPrimaryBtnClass as primaryBtnClass,
  authSecondaryBtnClass as secondaryBtnClass,
  authStrategyBtnClass as strategyBtnClass,
  authSubtleBtnClass as subtleBtnClass,
} from "@/components/auth/auth-surfaces";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  Building2,
  Eye,
  EyeOff,
  Fingerprint,
  Globe,
  GraduationCap,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  MessageSquare,
  Phone,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_CLERK_GOOGLE_ENABLED === "true";

function StepHeading({
  badge,
  title,
  description,
}: {
  badge: string;
  title: string;
  description: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="inline-flex items-center gap-2 rounded-full border border-(--m-border) bg-(--m-subtle) px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] m-muted">
        <span className="h-2 w-2 rounded-full bg-brand" />
        {badge}
      </div>
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-(--m-fg) sm:text-[2rem]">
          {title}
        </h1>
        <p className="max-w-md text-sm leading-6 m-muted">{description}</p>
      </div>
    </div>
  );
}

function Divider({ text }: { text: string }) {
  return (
    <div className="relative">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-(--m-border)" />
      </div>
      <div className="relative flex justify-center">
        <span className="bg-(--m-glass-strong) px-3 text-[11px] font-semibold uppercase tracking-[0.2em] m-faint">
          {text}
        </span>
      </div>
    </div>
  );
}

function SubmitButton({
  isGlobalLoading,
  label,
}: {
  isGlobalLoading: boolean;
  label: string;
}) {
  return (
    <SignIn.Action submit asChild>
      <button type="submit" disabled={isGlobalLoading} className={primaryBtnClass}>
        <Clerk.Loading>
          {(isLoading) =>
            isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : label
          }
        </Clerk.Loading>
      </button>
    </SignIn.Action>
  );
}

function BackAction({
  to,
  label = "Go back",
}: {
  to: "start" | "previous";
  label?: string;
}) {
  return (
    <SignIn.Action navigate={to} asChild>
      <button type="button" className={subtleBtnClass}>
        <ArrowLeft className="h-4 w-4" />
        {label}
      </button>
    </SignIn.Action>
  );
}

function ErrorBlock() {
  return (
    <Clerk.GlobalError className={authErrorClass} />
  );
}

function DevTeacherLoginPanel() {
  const [enabled, setEnabled] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/dev-teacher-login", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (!cancelled) {
          setEnabled(Boolean(payload?.data?.enabled));
        }
      })
      .catch(() => {
        if (!cancelled) setEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!enabled) return null;

  const startDevTeacherLogin = async () => {
    setError(null);
    setSubmitting(true);
    let shouldKeepBusy = false;
    try {
      const res = await fetch("/api/auth/dev-teacher-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.data?.url) {
        throw new Error(payload?.error || "Could not start test teacher login.");
      }
      shouldKeepBusy = true;
      window.location.href = payload.data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start test teacher login.");
    } finally {
      if (!shouldKeepBusy) {
        setSubmitting(false);
      }
    }
  };

  return (
    <div
      className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4"
    >
      <div className="space-y-1">
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-100">Test teacher login</p>
        <p className="text-xs leading-5 text-amber-800 dark:text-amber-100">
          Use this for E2E teacher accounts. It signs in through a dev-only Clerk token and skips
          invitation acceptance and verification codes.
        </p>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.75fr)_auto]">
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void startDevTeacherLogin();
            }
          }}
          placeholder="teacher@example.com"
          className="h-10 rounded-xl border border-(--m-border) bg-(--m-subtle) px-3 text-sm text-(--m-fg) outline-none placeholder:text-(--m-faint) focus:border-amber-300/60"
        />
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void startDevTeacherLogin();
            }
          }}
          placeholder="Test password"
          className="h-10 rounded-xl border border-(--m-border) bg-(--m-subtle) px-3 text-sm text-(--m-fg) outline-none placeholder:text-(--m-faint) focus:border-amber-300/60"
        />
        <button
          type="button"
          disabled={submitting}
          onClick={() => void startDevTeacherLogin()}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-amber-300 px-4 text-sm font-semibold text-black transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
        </button>
      </div>
      {error ? <p className="mt-2 text-xs text-rose-700 dark:text-rose-200">{error}</p> : null}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Clerk.Label className={authFieldLabelClass}>
      {children}
    </Clerk.Label>
  );
}

function FieldError() {
  return <Clerk.FieldError className="mt-2 text-xs text-red-600 dark:text-red-300" />;
}

function PasswordVisibilityButton({
  shown,
  onClick,
}: {
  shown: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute right-4 top-1/2 -translate-y-1/2 m-faint transition hover:text-(--m-fg)"
      aria-label={shown ? "Hide password" : "Show password"}
    >
      {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );
}

type EmailCodeSecondFactor = {
  strategy: "email_code";
  emailAddressId: string;
  safeIdentifier: string;
};

function SecondFactorEmailCodeBridge() {
  const { isLoaded, signIn } = useSignIn();
  const attemptedForKeyRef = useRef<string | null>(null);

  const secondFactor =
    isLoaded && signIn?.status === "needs_second_factor"
      ? ((signIn.supportedSecondFactors as Array<
          { strategy: string; emailAddressId?: string; safeIdentifier?: string }
        >).find(
          (candidate) =>
            candidate.strategy === "email_code" &&
            typeof candidate.emailAddressId === "string" &&
            typeof candidate.safeIdentifier === "string"
        ) as EmailCodeSecondFactor | undefined) ?? null
      : null;

  const secondFactorExpiryIso = signIn?.secondFactorVerification?.expireAt ?? null;

  useEffect(() => {
    if (!isLoaded || !signIn || !secondFactor) return;

    const secondFactorExpiry = secondFactorExpiryIso
      ? new Date(secondFactorExpiryIso)
      : null;
    const shouldPrepare =
      !secondFactorExpiry ||
      Number.isNaN(secondFactorExpiry.getTime()) ||
      secondFactorExpiry <= new Date();

    if (!shouldPrepare) return;

    const attemptKey = `${secondFactor.emailAddressId}:${secondFactorExpiry?.toISOString() ?? "none"}`;
    if (attemptedForKeyRef.current === attemptKey) return;
    attemptedForKeyRef.current = attemptKey;

    void signIn
      .prepareSecondFactor({
        strategy: "email_code",
        emailAddressId: secondFactor.emailAddressId,
      } as any)
      .catch((error) => {
        attemptedForKeyRef.current = null;
        console.error("[SignIn] Failed to prepare second-factor email code:", error);
      });
  }, [isLoaded, secondFactor, secondFactorExpiryIso, signIn]);

  return null;
}

function EmailCodeResendButton({ disabled }: { disabled: boolean }) {
  const { isLoaded, signIn } = useSignIn();
  const [isResending, setIsResending] = useState(false);

  const secondFactor =
    isLoaded && signIn?.status === "needs_second_factor"
      ? ((signIn.supportedSecondFactors as Array<
          { strategy: string; emailAddressId?: string; safeIdentifier?: string }
        >).find(
          (candidate) =>
            candidate.strategy === "email_code" &&
            typeof candidate.emailAddressId === "string" &&
            typeof candidate.safeIdentifier === "string"
        ) as EmailCodeSecondFactor | undefined) ?? null
      : null;

  if (!secondFactor) {
    return (
      <SignIn.Action resend asChild>
        <button type="button" disabled={disabled} className={secondaryBtnClass}>
          Resend code
        </button>
      </SignIn.Action>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled || isResending}
      className={secondaryBtnClass}
      onClick={async () => {
        if (!signIn) return;
        setIsResending(true);

        try {
          await signIn.prepareSecondFactor({
            strategy: "email_code",
            emailAddressId: secondFactor.emailAddressId,
          } as any);
        } catch (error) {
          console.error("[SignIn] Failed to resend second-factor email code:", error);
        } finally {
          setIsResending(false);
        }
      }}
    >
      {isResending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Resend code"}
    </button>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Animated floating orb used across the brand panel
   ────────────────────────────────────────────────────────────────── */
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
        animation: `float 8s ease-in-out infinite`,
        animationDelay: delay,
      }}
    />
  );
}

/* ──────────────────────────────────────────────────────────────────
   Premium Feature Pill — compact marketing highlight
   ────────────────────────────────────────────────────────────────── */
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

/* ──────────────────────────────────────────────────────────────────
   Brand / Marketing Panel (left side)
   ────────────────────────────────────────────────────────────────── */
function BrandPanel() {
  return (
    <div className="relative flex flex-col justify-between gap-10 lg:gap-12">
      {/* Logo + badge */}
      <div className="space-y-8">
        <BrandMark />

        <div className="space-y-5">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Now onboarding schools in Ghana
          </div>

          <h2 className="max-w-lg text-[2.5rem] font-bold leading-[1.1] tracking-tight sm:text-5xl">
            <span className="text-(--m-fg)">
              The modern OS for{" "}
            </span>
            <span className="bg-linear-to-r from-violet-600 to-brand bg-clip-text text-transparent dark:from-violet-400">
              Africa&apos;s schools
            </span>
          </h2>

          <p className="max-w-md text-base leading-7 m-muted">
            Collect fees, manage academics, communicate with parents, and run your
            entire institution from one beautiful platform.
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="group rounded-2xl border border-(--m-border) bg-(--m-subtle) p-4 backdrop-blur-sm transition-all duration-300 hover:border-(--m-border) hover:bg-(--m-subtle)">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-brand" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em] m-faint">
              Students
            </p>
          </div>
          <p className="mt-2 text-2xl font-bold text-(--m-fg)">10k+</p>
          <p className="mt-0.5 text-xs m-faint">managed on platform</p>
        </div>
        <div className="group rounded-2xl border border-(--m-border) bg-(--m-subtle) p-4 backdrop-blur-sm transition-all duration-300 hover:border-(--m-border) hover:bg-(--m-subtle)">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-brand" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em] m-faint">
              Setup
            </p>
          </div>
          <p className="mt-2 text-2xl font-bold text-(--m-fg)">&lt;1 day</p>
          <p className="mt-0.5 text-xs m-faint">average onboarding</p>
        </div>
        <div className="group rounded-2xl border border-(--m-border) bg-(--m-subtle) p-4 backdrop-blur-sm transition-all duration-300 hover:border-(--m-border) hover:bg-(--m-subtle)">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-brand" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em] m-faint">
              Payments
            </p>
          </div>
          <p className="mt-2 text-2xl font-bold text-(--m-fg)">MoMo</p>
          <p className="mt-0.5 text-xs m-faint">+ bank transfers</p>
        </div>
      </div>

      {/* Feature highlights */}
      <div className="space-y-3">
        <div className="flex items-start gap-3.5 rounded-2xl border border-(--m-border) bg-(--m-subtle) p-4 backdrop-blur-sm transition-all duration-300 hover:border-(--m-border) hover:bg-(--m-subtle)">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <TrendingUp className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-(--m-fg)">
              Real-time fee tracking & reconciliation
            </p>
            <p className="mt-1 text-sm leading-6 m-muted">
              Automated payment collection with Mobile Money, bank transfers,
              and instant reconciliation across all accounts.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-2xl border border-(--m-border) bg-(--m-subtle) p-4 backdrop-blur-sm transition-all duration-300 hover:border-(--m-border) hover:bg-(--m-subtle)">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <GraduationCap className="h-4 w-4 text-violet-600 dark:text-violet-300" />
            </span>
            <div>
              <p className="text-sm font-semibold text-(--m-fg)">
                Academic management
              </p>
              <p className="mt-0.5 text-xs m-faint">
                Timetables, grades, attendance & lesson plans
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border border-(--m-border) bg-(--m-subtle) p-4 backdrop-blur-sm transition-all duration-300 hover:border-(--m-border) hover:bg-(--m-subtle)">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <MessageSquare className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-(--m-fg)">
                Parent communication
              </p>
              <p className="mt-0.5 text-xs m-faint">
                SMS, in-app notices & approval workflows
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Feature pills */}
      <div className="flex flex-wrap gap-2">
        <FeaturePill icon={Shield} label="Enterprise security" />
        <FeaturePill icon={Sparkles} label="AI-powered insights" />
        <FeaturePill icon={BookOpen} label="Report cards" />
        <FeaturePill icon={Award} label="Staff management" />
      </div>

      {/* Social proof */}
      <div className="space-y-4">
        <div className="rounded-2xl border border-(--m-border) bg-(--m-subtle) p-5 backdrop-blur-sm">
          <div className="flex gap-1">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
            ))}
          </div>
          <p className="mt-3 text-sm leading-6 m-muted italic">
            &ldquo;EduSentrix transformed how we run our school. Fee collection
            went from 3 weeks to 3 days, and parents love the transparency.&rdquo;
          </p>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-linear-to-br from-violet-500 to-purple-600 text-xs font-bold text-white">
              AK
            </div>
            <div>
              <p className="text-sm font-semibold text-(--m-fg)">
                Akosua Kyeremanteng
              </p>
              <p className="text-xs m-faint">
                Head of Admin, Prestige Academy
              </p>
            </div>
          </div>
        </div>

        {/* Bottom CTAs */}
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Link
            href="/enroll"
            className="group inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-violet-500 to-purple-600 px-5 py-3 font-semibold text-white shadow-lg shadow-violet-500/20 transition-all duration-200 hover:shadow-violet-500/35 hover:scale-[1.02]"
          >
            Enrol your school
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-2xl px-4 py-3 font-medium m-faint transition-all duration-200 hover:text-(--m-fg)"
          >
            Back to website
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Main Page
   ────────────────────────────────────────────────────────────────── */
export default function SignInPage() {
  const searchParams = useSearchParams();
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSwitchingAccount, setIsSwitchingAccount] = useState(false);
  const authError = searchParams.get("error");

  useEffect(() => {
    if (authError === "school_disabled" && isLoaded && isSignedIn) {
      const base =
        typeof window !== "undefined" ? window.location.origin : "";
      void signOut({
        redirectUrl: `${base}/sign-in?error=school_disabled`,
      });
    }
  }, [authError, isLoaded, isSignedIn, signOut]);

  const handleSignOutAndContinue = async () => {
    setIsSwitchingAccount(true);
    let shouldKeepBusy = false;
    try {
      const currentUrl =
        typeof window !== "undefined" ? window.location.href : "/sign-in";
      await signOut({ redirectUrl: currentUrl });
      shouldKeepBusy = true;
    } finally {
      if (!shouldKeepBusy) {
        setIsSwitchingAccount(false);
      }
    }
  };

  if (isLoaded && isSignedIn && authError === "school_disabled") {
    return (
      <div className="m-page flex min-h-svh flex-col items-center justify-center gap-3 px-4">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
        <p className="text-sm m-muted">Ending your session…</p>
      </div>
    );
  }

  if (isLoaded && isSignedIn) {
    const activeName =
      [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
      user?.primaryEmailAddress?.emailAddress ||
      "Current user";

    return (
      <AuthSessionConflictCard
        title="You are already signed in"
        description="To sign in with a different EduSentrix account in this browser, you need to end the current session first."
        primaryLabel="Continue to current workspace"
        secondaryLabel="Sign out and use another account"
        onSecondary={handleSignOutAndContinue}
        secondaryBusy={isSwitchingAccount}
        activeName={activeName}
        activeEmail={user?.primaryEmailAddress?.emailAddress ?? null}
      />
    );
  }

  return (
    <div className="m-page relative min-h-svh overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={authPageGlowStyle}
      />

      {/* Animated floating orbs */}
      <FloatingOrb className="left-[10%] top-[15%] h-72 w-72 bg-violet-500/15" delay="0s" />
      <FloatingOrb className="-right-20 top-[40%] h-96 w-96 bg-brand/10" delay="2s" />
      <FloatingOrb className="bottom-[10%] left-[30%] h-64 w-64 bg-primary/10" delay="4s" />

      {/* Top gradient line */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-0 right-0 top-0 h-px bg-linear-to-r from-transparent via-brand/30 to-transparent"
      />

      <div className="relative mx-auto grid min-h-svh max-w-7xl items-center gap-12 px-4 py-12 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16 lg:px-8">
        {/* Left: Brand / Marketing */}
        <div className="hidden lg:block">
          <BrandPanel />
        </div>

        {/* Right: Sign-in card */}
        <div className="relative mx-auto w-full max-w-md lg:mx-0 lg:max-w-none">
          {/* Card glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-1 rounded-[2.1rem] bg-linear-to-br from-brand/20 via-transparent to-primary/20 opacity-60 blur-xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-px rounded-[2rem] bg-linear-to-br from-brand/10 via-transparent to-primary/10"
          />

          <div className="relative overflow-hidden rounded-[2rem] border border-(--m-border) m-card-strong shadow-2xl shadow-black/50 backdrop-blur-2xl">
            {authError === "multi_school_email" ? (
              <div
                role="alert"
                className="border-b border-amber-500/20 bg-amber-500/10 px-6 py-4 text-sm leading-relaxed text-amber-900 dark:text-amber-50 sm:px-8"
              >
                This email is used in more than one school. Open the{" "}
                <strong className="font-semibold text-amber-800 dark:text-amber-100">
                  invitation link
                </strong>{" "}
                for the school you need so we can connect the right workspace,
                or ask an administrator to resend your invite.
              </div>
            ) : null}
            {authError === "school_disabled" ? (
              <div
                role="alert"
                className="border-b border-rose-500/20 bg-rose-500/10 px-6 py-4 text-sm leading-relaxed text-rose-800 dark:text-rose-100 sm:px-8"
              >
                This school has been suspended and sign-in is blocked for all
                accounts linked to it. If you believe this is a mistake,
                contact your school or EduSentrix support.
              </div>
            ) : null}
            {/* Card header */}
            <div className="border-b border-(--m-border) bg-(--m-subtle) px-6 py-5 sm:px-8">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-(--m-border) bg-(--m-subtle) px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] m-faint">
                    <Sparkles className="h-3.5 w-3.5 text-brand" />
                    Secure Sign In
                  </div>
                  <p className="text-sm m-faint">
                    Use your school or organization credentials to continue.
                  </p>
                </div>
                <ThemeToggle className="shrink-0" />
              </div>
            </div>

            {/* Card body */}
            <div className="px-6 py-7 sm:px-8 sm:py-8">
              <SignIn.Root
                routing="path"
                path="/sign-in"
                fallback={
                  <div className="flex min-h-[480px] items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin m-faint" />
                  </div>
                }
              >
                <Clerk.Loading>
                  {(isGlobalLoading) => (
                    <>
                      <SignIn.Step name="start">
                        <div className="space-y-6">
                          <StepHeading
                            badge="Account Access"
                            title="Welcome back"
                            description="Enter your work email and continue with your preferred sign-in method."
                          />

                          <DevTeacherLoginPanel />

                          {GOOGLE_ENABLED ? (
                            <>
                              <Clerk.Connection name="google" asChild>
                                <button
                                  type="button"
                                  disabled={isGlobalLoading}
                                  className={secondaryBtnClass}
                                >
                                  <Clerk.Loading scope="provider:google">
                                    {(isLoading) =>
                                      isLoading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Clerk.Icon className="h-4 w-4" />
                                      )
                                    }
                                  </Clerk.Loading>
                                  Continue with Google
                                </button>
                              </Clerk.Connection>

                              <Divider text="or continue with email" />
                            </>
                          ) : null}

                          <Clerk.Field name="identifier">
                            <FieldLabel>Email Address</FieldLabel>
                            <Clerk.Input
                              type="email"
                              className={inputClass}
                              placeholder="admin@school.edu"
                            />
                            <FieldError />
                          </Clerk.Field>

                          <SubmitButton
                            isGlobalLoading={isGlobalLoading}
                            label="Continue"
                          />

                          <ErrorBlock />

                          <div className="rounded-2xl border border-(--m-border) bg-(--m-subtle) p-4">
                            <p className="text-sm font-medium text-(--m-fg)">
                              Need access to EduSentrix?
                            </p>
                            <p className="mt-1 text-sm leading-6 m-muted">
                              Ask your school administrator to invite you, or{" "}
                              <Link
                                href="/enroll"
                                className="font-semibold text-brand transition hover:text-sky-700 dark:hover:text-sky-300"
                              >
                                enrol your school
                              </Link>{" "}
                              if you&apos;re setting up a new institution.
                            </p>
                          </div>

                          {/* Mobile-only marketing summary */}
                          <div className="mt-2 space-y-3 lg:hidden">
                            <BrandMark size="sm" showTagline />
                            <div className="flex flex-wrap gap-2">
                              <FeaturePill icon={TrendingUp} label="Fee tracking" />
                              <FeaturePill icon={GraduationCap} label="Academics" />
                              <FeaturePill icon={MessageSquare} label="Communication" />
                            </div>
                          </div>
                        </div>
                      </SignIn.Step>

                      <SignIn.Step name="verifications">
                        <SignIn.Strategy name="password">
                          <div className="space-y-6">
                            <StepHeading
                              badge="Password"
                              title="Enter your password"
                              description={
                                <>
                                  Continue as{" "}
                                  <span className="font-semibold text-(--m-fg)">
                                    <SignIn.SafeIdentifier />
                                  </span>
                                  .
                                </>
                              }
                            />

                            <Clerk.Field name="password">
                              <FieldLabel>Password</FieldLabel>
                              <div className="relative">
                                <Clerk.Input
                                  type={showPassword ? "text" : "password"}
                                  className={`${inputClass} pr-12`}
                                  placeholder="Enter your password"
                                />
                                <PasswordVisibilityButton
                                  shown={showPassword}
                                  onClick={() => setShowPassword((value) => !value)}
                                />
                              </div>
                              <FieldError />
                            </Clerk.Field>

                            <SubmitButton
                              isGlobalLoading={isGlobalLoading}
                              label="Sign in"
                            />

                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <SignIn.Action navigate="forgot-password" asChild>
                                <button
                                  type="button"
                                  className="text-sm font-medium text-brand transition hover:text-sky-700 dark:hover:text-sky-300"
                                >
                                  Forgot password?
                                </button>
                              </SignIn.Action>
                              <SignIn.Action navigate="start" asChild>
                                <button type="button" className={subtleBtnClass}>
                                  <ArrowLeft className="h-4 w-4" />
                                  Try another method
                                </button>
                              </SignIn.Action>
                            </div>

                            <ErrorBlock />
                          </div>
                        </SignIn.Strategy>

                        <SignIn.Strategy name="email_code">
                          <div className="space-y-6">
                            <SecondFactorEmailCodeBridge />

                            <StepHeading
                              badge="Verification Code"
                              title="Check your email"
                              description={
                                <>
                                  We sent a verification code to{" "}
                                  <span className="font-semibold text-(--m-fg)">
                                    <SignIn.SafeIdentifier />
                                  </span>
                                  .
                                </>
                              }
                            />

                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl border border-(--m-border) bg-(--m-subtle) text-brand">
                              <Mail className="h-6 w-6" />
                            </div>

                            <Clerk.Field name="code">
                              <FieldLabel>Verification Code</FieldLabel>
                              <div className="mt-3">
                                <Clerk.Input
                                  type="otp"
                                  autoSubmit
                                  className={otpInputClass}
                                />
                              </div>
                              <FieldError />
                            </Clerk.Field>

                            <SubmitButton
                              isGlobalLoading={isGlobalLoading}
                              label="Verify and continue"
                            />
                            <EmailCodeResendButton disabled={isGlobalLoading} />
                            <BackAction to="start" label="Use another method" />

                            <ErrorBlock />
                          </div>
                        </SignIn.Strategy>

                        <SignIn.Strategy name="email_link">
                          <div className="space-y-6">
                            <StepHeading
                              badge="Email Link"
                              title="Check your inbox"
                              description={
                                <>
                                  A secure sign-in link was sent to{" "}
                                  <span className="font-semibold text-(--m-fg)">
                                    <SignIn.SafeIdentifier />
                                  </span>
                                  .
                                </>
                              }
                            />

                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl border border-(--m-border) bg-(--m-subtle) text-brand">
                              <MessageSquare className="h-6 w-6" />
                            </div>

                            <SignIn.Action resend asChild>
                              <button
                                type="button"
                                disabled={isGlobalLoading}
                                className={secondaryBtnClass}
                              >
                                Resend email
                              </button>
                            </SignIn.Action>

                            <BackAction to="start" label="Use another method" />

                            <ErrorBlock />
                          </div>
                        </SignIn.Strategy>

                        <SignIn.Strategy name="phone_code">
                          <div className="space-y-6">
                            <StepHeading
                              badge="SMS Code"
                              title="Check your phone"
                              description={
                                <>
                                  We sent a verification code to{" "}
                                  <span className="font-semibold text-(--m-fg)">
                                    <SignIn.SafeIdentifier />
                                  </span>
                                  .
                                </>
                              }
                            />

                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl border border-(--m-border) bg-(--m-subtle) text-brand">
                              <Phone className="h-6 w-6" />
                            </div>

                            <Clerk.Field name="code">
                              <FieldLabel>Verification Code</FieldLabel>
                              <div className="mt-3">
                                <Clerk.Input
                                  type="otp"
                                  autoSubmit
                                  className={otpInputClass}
                                />
                              </div>
                              <FieldError />
                            </Clerk.Field>

                            <SubmitButton
                              isGlobalLoading={isGlobalLoading}
                              label="Verify and continue"
                            />

                            <SignIn.Action resend asChild>
                              <button
                                type="button"
                                disabled={isGlobalLoading}
                                className={secondaryBtnClass}
                              >
                                Resend code
                              </button>
                            </SignIn.Action>

                            <BackAction to="start" label="Use another method" />

                            <ErrorBlock />
                          </div>
                        </SignIn.Strategy>

                        <SignIn.Strategy name="totp">
                          <div className="space-y-6">
                            <StepHeading
                              badge="Two-Step Verification"
                              title="Open your authenticator app"
                              description="Enter the current code from your authenticator app to complete sign-in."
                            />

                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl border border-(--m-border) bg-(--m-subtle) text-brand">
                              <ShieldCheck className="h-6 w-6" />
                            </div>

                            <Clerk.Field name="code">
                              <FieldLabel>Authenticator Code</FieldLabel>
                              <div className="mt-3">
                                <Clerk.Input
                                  type="otp"
                                  autoSubmit
                                  className={otpInputClass}
                                />
                              </div>
                              <FieldError />
                            </Clerk.Field>

                            <SubmitButton
                              isGlobalLoading={isGlobalLoading}
                              label="Continue"
                            />

                            <ErrorBlock />
                          </div>
                        </SignIn.Strategy>

                        <SignIn.Strategy name="passkey">
                          <div className="space-y-6">
                            <StepHeading
                              badge="Passkey"
                              title="Use your passkey"
                              description="Authenticate with your device passkey or hardware security key."
                            />

                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl border border-(--m-border) bg-(--m-subtle) text-brand">
                              <Fingerprint className="h-6 w-6" />
                            </div>

                            <SignIn.Passkey asChild>
                              <button
                                type="button"
                                disabled={isGlobalLoading}
                                className={primaryBtnClass}
                              >
                                Continue with passkey
                              </button>
                            </SignIn.Passkey>

                            <BackAction to="start" label="Use another method" />

                            <ErrorBlock />
                          </div>
                        </SignIn.Strategy>

                        <SignIn.Strategy name="reset_password_email_code">
                          <div className="space-y-6">
                            <StepHeading
                              badge="Reset Code"
                              title="Check your email"
                              description={
                                <>
                                  We sent a reset code to{" "}
                                  <span className="font-semibold text-(--m-fg)">
                                    <SignIn.SafeIdentifier />
                                  </span>
                                  .
                                </>
                              }
                            />

                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl border border-(--m-border) bg-(--m-subtle) text-brand">
                              <KeyRound className="h-6 w-6" />
                            </div>

                            <Clerk.Field name="code">
                              <FieldLabel>Reset Code</FieldLabel>
                              <div className="mt-3">
                                <Clerk.Input
                                  type="otp"
                                  autoSubmit
                                  className={otpInputClass}
                                />
                              </div>
                              <FieldError />
                            </Clerk.Field>

                            <SubmitButton
                              isGlobalLoading={isGlobalLoading}
                              label="Verify code"
                            />

                            <ErrorBlock />
                          </div>
                        </SignIn.Strategy>
                      </SignIn.Step>

                      <SignIn.Step name="forgot-password">
                        <div className="space-y-6">
                          <StepHeading
                            badge="Password Recovery"
                            title="Forgot your password?"
                            description="We'll send a one-time code to your email so you can reset it securely."
                          />

                          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl border border-(--m-border) bg-(--m-subtle) text-brand">
                            <Lock className="h-6 w-6" />
                          </div>

                          <SignIn.SupportedStrategy name="reset_password_email_code" asChild>
                            <button type="button" className={primaryBtnClass}>
                              Send reset code
                            </button>
                          </SignIn.SupportedStrategy>

                          <BackAction to="previous" />
                        </div>
                      </SignIn.Step>

                      <SignIn.Step name="reset-password">
                        <div className="space-y-6">
                          <StepHeading
                            badge="New Password"
                            title="Set a new password"
                            description="Choose a strong password for your account, then continue back into your workspace."
                          />

                          <Clerk.Field name="password">
                            <FieldLabel>New Password</FieldLabel>
                            <div className="relative">
                              <Clerk.Input
                                type={showNewPassword ? "text" : "password"}
                                validatePassword
                                className={`${inputClass} pr-12`}
                                placeholder="Create a new password"
                              />
                              <PasswordVisibilityButton
                                shown={showNewPassword}
                                onClick={() =>
                                  setShowNewPassword((value) => !value)
                                }
                              />
                            </div>
                            <FieldError />
                            <Clerk.FieldState>
                              {({ state, message }) =>
                                state === "error" && message ? (
                                  <p className="mt-2 text-xs text-red-600 dark:text-red-300">{message}</p>
                                ) : state === "success" ? (
                                  <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">
                                    Password strength looks good.
                                  </p>
                                ) : null
                              }
                            </Clerk.FieldState>
                          </Clerk.Field>

                          <Clerk.Field name="confirmPassword">
                            <FieldLabel>Confirm Password</FieldLabel>
                            <div className="relative">
                              <Clerk.Input
                                type={showConfirmPassword ? "text" : "password"}
                                className={`${inputClass} pr-12`}
                                placeholder="Re-enter your password"
                              />
                              <PasswordVisibilityButton
                                shown={showConfirmPassword}
                                onClick={() =>
                                  setShowConfirmPassword((value) => !value)
                                }
                              />
                            </div>
                            <FieldError />
                          </Clerk.Field>

                          <SubmitButton
                            isGlobalLoading={isGlobalLoading}
                            label="Reset password"
                          />

                          <ErrorBlock />
                        </div>
                      </SignIn.Step>

                      <SignIn.Step name="choose-strategy">
                        <div className="space-y-6">
                          <StepHeading
                            badge="Sign-In Methods"
                            title="Choose how to continue"
                            description="Use the option that fits your organization's security setup."
                          />

                          <div className="space-y-3">
                            <SignIn.SupportedStrategy name="email_code" asChild>
                              <button type="button" className={strategyBtnClass}>
                                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-(--m-border) bg-(--m-subtle) text-brand">
                                  <Mail className="h-5 w-5" />
                                </span>
                                <span className="space-y-1">
                                  <span className="block font-semibold text-(--m-fg)">
                                    Email a code
                                  </span>
                                  <span className="block text-xs uppercase tracking-[0.18em] m-faint">
                                    Verify from your inbox
                                  </span>
                                </span>
                              </button>
                            </SignIn.SupportedStrategy>

                            <SignIn.SupportedStrategy name="email_link" asChild>
                              <button type="button" className={strategyBtnClass}>
                                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-(--m-border) bg-(--m-subtle) text-brand">
                                  <MessageSquare className="h-5 w-5" />
                                </span>
                                <span className="space-y-1">
                                  <span className="block font-semibold text-(--m-fg)">
                                    Email me a link
                                  </span>
                                  <span className="block text-xs uppercase tracking-[0.18em] m-faint">
                                    One-click sign in
                                  </span>
                                </span>
                              </button>
                            </SignIn.SupportedStrategy>

                            <SignIn.SupportedStrategy name="phone_code" asChild>
                              <button type="button" className={strategyBtnClass}>
                                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-(--m-border) bg-(--m-subtle) text-brand">
                                  <Phone className="h-5 w-5" />
                                </span>
                                <span className="space-y-1">
                                  <span className="block font-semibold text-(--m-fg)">
                                    Text me a code
                                  </span>
                                  <span className="block text-xs uppercase tracking-[0.18em] m-faint">
                                    Mobile verification
                                  </span>
                                </span>
                              </button>
                            </SignIn.SupportedStrategy>

                            <SignIn.SupportedStrategy name="password" asChild>
                              <button type="button" className={strategyBtnClass}>
                                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-(--m-border) bg-(--m-subtle) text-brand">
                                  <Lock className="h-5 w-5" />
                                </span>
                                <span className="space-y-1">
                                  <span className="block font-semibold text-(--m-fg)">
                                    Use password
                                  </span>
                                  <span className="block text-xs uppercase tracking-[0.18em] m-faint">
                                    Standard account sign in
                                  </span>
                                </span>
                              </button>
                            </SignIn.SupportedStrategy>

                            <SignIn.SupportedStrategy name="passkey" asChild>
                              <button type="button" className={strategyBtnClass}>
                                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-(--m-border) bg-(--m-subtle) text-brand">
                                  <Fingerprint className="h-5 w-5" />
                                </span>
                                <span className="space-y-1">
                                  <span className="block font-semibold text-(--m-fg)">
                                    Use passkey
                                  </span>
                                  <span className="block text-xs uppercase tracking-[0.18em] m-faint">
                                    Device-backed security
                                  </span>
                                </span>
                              </button>
                            </SignIn.SupportedStrategy>
                          </div>

                          <BackAction to="previous" />
                        </div>
                      </SignIn.Step>
                    </>
                  )}
                </Clerk.Loading>
              </SignIn.Root>
            </div>

            {/* Card footer */}
            <div className="border-t border-(--m-border) bg-(--m-subtle) px-6 py-4 sm:px-8">
              <div className="flex items-center justify-between text-xs m-faint">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Protected by enterprise-grade security</span>
                </div>
                <span className="hidden sm:inline">256-bit SSL</span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
