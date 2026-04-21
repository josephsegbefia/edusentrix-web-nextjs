"use client";

import * as Clerk from "@clerk/elements/common";
import * as SignUp from "@clerk/elements/sign-up";
import { useClerk, useUser } from "@clerk/nextjs";
import { Suspense, useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  Loader2,
  Lock,
  Mail,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { AuthSessionConflictCard } from "@/components/auth/AuthSessionConflictCard";
import { EDUSENTRIX_LOGO_ALT, EDUSENTRIX_LOGO_PATH } from "@/lib/branding";

const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_CLERK_GOOGLE_ENABLED === "true";

const inputClass =
  "mt-2 h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none transition-all duration-200 placeholder:text-white/30 focus:border-brand focus:bg-white/[0.07] focus:ring-2 focus:ring-brand/20 focus:shadow-[0_0_20px_rgba(14,165,233,0.1)] disabled:cursor-not-allowed disabled:opacity-50";

const otpInputClass =
  "h-14 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-center font-mono text-lg tracking-[0.45em] text-white outline-none transition-all duration-200 placeholder:text-white/20 focus:border-brand focus:bg-white/[0.07] focus:ring-2 focus:ring-brand/20 focus:shadow-[0_0_20px_rgba(14,165,233,0.1)] disabled:cursor-not-allowed disabled:opacity-50";

const primaryBtnClass =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand px-4 text-sm font-semibold text-black shadow-lg shadow-brand/25 transition-all duration-200 hover:bg-sky-300 hover:shadow-brand/40 hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50";

const secondaryBtnClass =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-white/82 transition-all duration-200 hover:border-white/20 hover:bg-white/10 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50";

const subtleBtnClass =
  "inline-flex items-center gap-2 text-sm font-medium text-white/55 transition-all duration-200 hover:text-white";

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
      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/55">
        <span className="h-2 w-2 rounded-full bg-brand" />
        {badge}
      </div>
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-[2rem]">
          {title}
        </h1>
        <p className="max-w-md text-sm leading-6 text-white/60">{description}</p>
      </div>
    </div>
  );
}

function Divider({ text }: { text: string }) {
  return (
    <div className="relative">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-white/10" />
      </div>
      <div className="relative flex justify-center">
        <span className="bg-[#0f1524] px-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">
          {text}
        </span>
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Clerk.Label className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
      {children}
    </Clerk.Label>
  );
}

function FieldError() {
  return <Clerk.FieldError className="mt-2 text-xs text-red-300" />;
}

function ErrorBlock() {
  return (
    <Clerk.GlobalError className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100" />
  );
}

function SubmitButton({
  label,
  isGlobalLoading,
}: {
  label: string;
  isGlobalLoading: boolean;
}) {
  return (
    <SignUp.Action submit asChild>
      <button type="submit" disabled={isGlobalLoading} className={primaryBtnClass}>
        <Clerk.Loading>
          {(isLoading) =>
            isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : label
          }
        </Clerk.Loading>
      </button>
    </SignUp.Action>
  );
}

function BackAction({
  to,
  label,
}: {
  to: "start" | "previous";
  label: string;
}) {
  return (
    <SignUp.Action navigate={to} asChild>
      <button type="button" className={subtleBtnClass}>
        <ArrowLeft className="h-4 w-4" />
        {label}
      </button>
    </SignUp.Action>
  );
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
      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 transition hover:text-white/70"
      aria-label={shown ? "Hide password" : "Show password"}
    >
      {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
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

function FeaturePill({
  icon: Icon,
  label,
}: {
  icon: React.ElementType;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/60 backdrop-blur-sm">
      <Icon className="h-3.5 w-3.5 text-brand" />
      {label}
    </div>
  );
}

function BrandPanel({ hasInvitationTicket }: { hasInvitationTicket: boolean }) {
  return (
    <div className="relative flex h-full flex-col justify-between gap-10 lg:gap-12">
      <div className="space-y-8">
        <div className="flex items-center gap-3.5">
          <div className="relative h-12 w-[3.65rem] shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-lg shadow-black/30 ring-1 ring-white/5">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/10 via-transparent to-cyan-400/12"
            />
            <Image
              src={EDUSENTRIX_LOGO_PATH}
              alt={EDUSENTRIX_LOGO_ALT}
              fill
              sizes="58px"
              className="object-contain px-1.5 py-1"
            />
          </div>
          <span className="text-lg font-semibold tracking-tight text-white">
            EduSentrix
          </span>
        </div>

        <div className="space-y-5">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-medium text-emerald-300 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            {hasInvitationTicket ? "Secure invite" : "Account setup"}
          </div>

          <h2 className="max-w-lg text-[2.4rem] font-bold leading-[1.08] tracking-tight sm:text-5xl">
            <span className="bg-linear-to-br from-white via-white to-white/60 bg-clip-text text-transparent">
              {hasInvitationTicket ? "Activate your school workspace" : "Create your EduSentrix account"}
            </span>
          </h2>

          <p className="max-w-md text-base leading-7 text-white/50">
            {hasInvitationTicket
              ? "Set a password, confirm your details, and continue straight into the school workspace prepared for you."
              : "A modern sign-up flow designed to match the rest of the EduSentrix product experience."}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <FeaturePill icon={TrendingUp} label="Fees & billing" />
          <FeaturePill icon={GraduationCap} label="Academics" />
          <FeaturePill icon={MessageSquare} label="Communication" />
          <FeaturePill icon={Users} label="Staff & parents" />
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-white">
              What happens next
            </p>
            <ul className="space-y-2 text-sm leading-6 text-white/55">
              <li className="flex gap-2">
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-brand" />
                Sign in securely with your invited or registered email.
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-brand" />
                Finish school launch only if your workspace still needs setup.
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-brand" />
                Land in the right EduSentrix role automatically after verification.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function SignUpPageContent() {
  const searchParams = useSearchParams();
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const hasInvitationTicket = useMemo(
    () => Boolean(searchParams.get("__clerk_ticket")),
    [searchParams]
  );

  const handleSignOutAndContinue = useCallback(async () => {
    setIsSigningOut(true);
    try {
      const currentUrl =
        typeof window !== "undefined" ? window.location.href : "/sign-up";
      await signOut({ redirectUrl: currentUrl });
    } finally {
      setIsSigningOut(false);
    }
  }, [signOut]);

  if (isLoaded && isSignedIn) {
    const activeName =
      [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
      user?.primaryEmailAddress?.emailAddress ||
      "Current user";

    return (
      <AuthSessionConflictCard
        title={hasInvitationTicket ? "Invitation needs a fresh session" : "You are already signed in"}
        description={
          hasInvitationTicket
            ? "This invitation must be completed outside the currently active account in this browser."
            : "Creating another EduSentrix account in this browser requires signing out of the current account first."
        }
        primaryLabel="Continue to current workspace"
        secondaryLabel={
          hasInvitationTicket ? "Sign out and accept invitation" : "Sign out and create another account"
        }
        onSecondary={handleSignOutAndContinue}
        secondaryBusy={isSigningOut}
        activeName={activeName}
        activeEmail={user?.primaryEmailAddress?.emailAddress ?? null}
        note={
          hasInvitationTicket
            ? "The invite link already contains a secure Clerk ticket. After sign-out, this page will reload and continue the invited account setup."
            : "If you need both accounts open at the same time, use a private window or a separate browser profile."
        }
      />
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0b1020] text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 65% 42% at 18% 16%, rgba(14,165,233,0.18) 0%, transparent 60%), radial-gradient(ellipse 48% 34% at 82% 12%, rgba(109,40,217,0.16) 0%, transparent 58%), radial-gradient(ellipse 42% 32% at 72% 78%, rgba(16,185,129,0.12) 0%, transparent 60%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.16) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      <FloatingOrb className="left-[8%] top-[10%] h-72 w-72 bg-violet-500/20" />
      <FloatingOrb className="right-[4%] top-[48%] h-80 w-80 bg-brand/12" delay="2s" />
      <FloatingOrb className="bottom-[10%] left-[28%] h-56 w-56 bg-emerald-500/10" delay="4s" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#0f1524]/90 shadow-2xl shadow-black/50 backdrop-blur-2xl lg:grid-cols-[1.04fr_0.96fr]">
          <div className="hidden border-r border-white/8 bg-white/[0.03] p-8 lg:block xl:p-10">
            <BrandPanel hasInvitationTicket={hasInvitationTicket} />
          </div>

          <div className="relative">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/[0.05] via-transparent to-brand/5"
            />

            <div className="relative px-6 py-7 sm:px-8 sm:py-8">
              <SignUp.Root
                routing="path"
                path="/sign-up"
                fallback={
                  <div className="flex min-h-[560px] items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-white/45" />
                  </div>
                }
              >
                <Clerk.Loading>
                  {(isGlobalLoading) => (
                    <>
                      <SignUp.Step name="start">
                        <div className="space-y-6">
                          <StepHeading
                            badge={hasInvitationTicket ? "Accept Invite" : "Create Account"}
                            title={hasInvitationTicket ? "Set your password" : "Create your login"}
                            description={
                              hasInvitationTicket
                                ? "This secure invite already knows your workspace. Set a password and continue."
                                : "Use your work email to create an EduSentrix account for your school workspace."
                            }
                          />

                          {!hasInvitationTicket && GOOGLE_ENABLED ? (
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

                          <Clerk.Field name="emailAddress">
                            <FieldLabel>Email Address</FieldLabel>
                            <Clerk.Input
                              type="email"
                              className={inputClass}
                              placeholder="admin@school.edu"
                              autoComplete="email"
                            />
                            <FieldError />
                          </Clerk.Field>

                          <Clerk.Field name="password">
                            <FieldLabel>Password</FieldLabel>
                            <div className="relative">
                              <Clerk.Input
                                type={showPassword ? "text" : "password"}
                                className={`${inputClass} pr-12`}
                                placeholder="Create a strong password"
                                autoComplete="new-password"
                              />
                              <PasswordVisibilityButton
                                shown={showPassword}
                                onClick={() => setShowPassword((value) => !value)}
                              />
                            </div>
                            <FieldError />
                          </Clerk.Field>

                          <SignUp.Captcha />

                          <SubmitButton
                            label={hasInvitationTicket ? "Continue with invite" : "Continue"}
                            isGlobalLoading={isGlobalLoading}
                          />

                          <ErrorBlock />

                          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                            <p className="text-sm font-medium text-white">
                              {hasInvitationTicket
                                ? "This account was prepared for you"
                                : "Already have an account?"}
                            </p>
                            <p className="mt-1 text-sm leading-6 text-white/50">
                              {hasInvitationTicket ? (
                                <>
                                  After your password is set, Clerk will continue with the
                                  verification step required for this invite.
                                </>
                              ) : (
                                <>
                                  Sign in to your existing workspace instead on{" "}
                                  <Link
                                    href="/sign-in"
                                    className="font-semibold text-brand transition hover:text-sky-300"
                                  >
                                    the login page
                                  </Link>
                                  .
                                </>
                              )}
                            </p>
                          </div>

                          <div className="mt-2 space-y-3 lg:hidden">
                            <div className="flex items-center gap-3.5">
                              <div className="relative h-11 w-[3.3rem] shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-lg shadow-black/25 ring-1 ring-white/5">
                                <div
                                  aria-hidden
                                  className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/10 via-transparent to-cyan-400/12"
                                />
                                <Image
                                  src={EDUSENTRIX_LOGO_PATH}
                                  alt={EDUSENTRIX_LOGO_ALT}
                                  fill
                                  sizes="53px"
                                  className="object-contain px-1.5 py-1"
                                />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-white">EduSentrix</p>
                                <p className="text-xs text-white/40">
                                  The modern school OS for Africa
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <FeaturePill icon={TrendingUp} label="Fee tracking" />
                              <FeaturePill icon={Building2} label="School setup" />
                              <FeaturePill icon={ShieldCheck} label="Secure invites" />
                            </div>
                          </div>
                        </div>
                      </SignUp.Step>

                      <SignUp.Step name="continue">
                        <div className="space-y-6">
                          <StepHeading
                            badge="Profile"
                            title="Complete your details"
                            description="Add the core profile details EduSentrix uses across your workspace."
                          />

                          <div className="grid gap-4 sm:grid-cols-2">
                            <Clerk.Field name="firstName">
                              <FieldLabel>First name</FieldLabel>
                              <Clerk.Input
                                type="text"
                                className={inputClass}
                                placeholder="First name"
                                autoComplete="given-name"
                              />
                              <FieldError />
                            </Clerk.Field>

                            <Clerk.Field name="lastName">
                              <FieldLabel>Last name</FieldLabel>
                              <Clerk.Input
                                type="text"
                                className={inputClass}
                                placeholder="Last name"
                                autoComplete="family-name"
                              />
                              <FieldError />
                            </Clerk.Field>
                          </div>

                          <SubmitButton
                            label={hasInvitationTicket ? "Create invited account" : "Create account"}
                            isGlobalLoading={isGlobalLoading}
                          />

                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <BackAction to="start" label="Back to password" />
                            <Link href="/sign-in" className={subtleBtnClass}>
                              Sign in instead
                            </Link>
                          </div>

                          <ErrorBlock />
                        </div>
                      </SignUp.Step>

                      <SignUp.Step name="verifications">
                        <SignUp.Strategy name="email_code">
                          <div className="space-y-6">
                            <StepHeading
                              badge="Verification Code"
                              title="Check your email"
                              description="Enter the code Clerk sent to your email address to finish account setup."
                            />

                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl border border-white/10 bg-white/5 text-brand">
                              <Mail className="h-6 w-6" />
                            </div>

                            <Clerk.Field name="code">
                              <FieldLabel>Verification code</FieldLabel>
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
                              label="Verify and continue"
                              isGlobalLoading={isGlobalLoading}
                            />

                            <SignUp.Action resend asChild>
                              <button
                                type="button"
                                disabled={isGlobalLoading}
                                className={secondaryBtnClass}
                              >
                                Resend code
                              </button>
                            </SignUp.Action>

                            <BackAction to="start" label="Edit account details" />

                            <ErrorBlock />
                          </div>
                        </SignUp.Strategy>

                        <SignUp.Strategy name="email_link">
                          <div className="space-y-6">
                            <StepHeading
                              badge="Email Link"
                              title="Open the link in your inbox"
                              description="Clerk sent a secure verification link to your email address."
                            />

                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl border border-white/10 bg-white/5 text-brand">
                              <MessageSquare className="h-6 w-6" />
                            </div>

                            <SignUp.Action resend asChild>
                              <button
                                type="button"
                                disabled={isGlobalLoading}
                                className={secondaryBtnClass}
                              >
                                Send link again
                              </button>
                            </SignUp.Action>

                            <BackAction to="start" label="Use another email" />

                            <ErrorBlock />
                          </div>
                        </SignUp.Strategy>

                        <SignUp.Strategy name="phone_code">
                          <div className="space-y-6">
                            <StepHeading
                              badge="Phone Verification"
                              title="Enter your phone code"
                              description="Finish sign-up with the verification code sent to your phone."
                            />

                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl border border-white/10 bg-white/5 text-brand">
                              <Lock className="h-6 w-6" />
                            </div>

                            <Clerk.Field name="code">
                              <FieldLabel>Verification code</FieldLabel>
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
                              label="Verify and continue"
                              isGlobalLoading={isGlobalLoading}
                            />

                            <SignUp.Action resend asChild>
                              <button
                                type="button"
                                disabled={isGlobalLoading}
                                className={secondaryBtnClass}
                              >
                                Resend code
                              </button>
                            </SignUp.Action>

                            <BackAction to="start" label="Back to account details" />

                            <ErrorBlock />
                          </div>
                        </SignUp.Strategy>
                      </SignUp.Step>

                      <SignUp.Step name="restricted">
                        <div className="space-y-6">
                          <StepHeading
                            badge="Restricted"
                            title="Sign-up is unavailable"
                            description="This Clerk instance is currently not accepting new registrations through this route."
                          />

                          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 text-sm leading-6 text-white/60">
                            If you were invited to EduSentrix and still cannot continue,
                            contact your school administrator to resend the invitation.
                          </div>

                          <Link href="/sign-in" className={secondaryBtnClass}>
                            <ArrowRight className="h-4 w-4" />
                            Go to sign in
                          </Link>
                        </div>
                      </SignUp.Step>
                    </>
                  )}
                </Clerk.Loading>
              </SignUp.Root>

              <div className="mt-8 border-t border-white/8 pt-5 text-sm text-white/40">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-brand" />
                    Secure Clerk authentication with EduSentrix UI.
                  </span>
                  <div className="flex items-center gap-4">
                    <Link href="/" className="transition hover:text-white/70">
                      Back to website
                    </Link>
                    <Link href="/sign-in" className="transition hover:text-white/70">
                      Sign in
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-bg text-white/60">
          Loading…
        </div>
      }
    >
      <SignUpPageContent />
    </Suspense>
  );
}
