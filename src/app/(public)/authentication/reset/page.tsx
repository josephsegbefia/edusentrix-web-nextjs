"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBusyToast } from "@/hooks/useBusyToast";

type Phase = "request" | "verify" | "success";

const PASSWORD_HINT =
  "Minimum 8 characters, with uppercase, lowercase and a number.";

export default function ResetPasswordPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const { promise, error: toastError } = useBusyToast();

  // Query params
  const initialEmail = sp.get("email") ?? "";
  const rawPurpose = (sp.get("purpose") ?? "set_password").toLowerCase();
  const purpose: "set_password" | "reset_password" =
    rawPurpose === "reset_password" ? "reset_password" : "set_password";

  // UI state
  const [phase, setPhase] = useState<Phase>("request");
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState("");
  const [pwd, setPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialEmail) setEmail(initialEmail);
  }, [initialEmail]);

  const canSubmitRequest = useMemo(
    () => !!email && !submitting,
    [email, submitting]
  );

  const canSubmitVerify = useMemo(
    () =>
      !!email &&
      !!otp &&
      !!pwd &&
      !!confirmPwd &&
      pwd === confirmPwd &&
      !submitting,
    [email, otp, pwd, confirmPwd, submitting]
  );

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      toastError("Enter your email to continue.");
      return;
    }
    setSubmitting(true);

    try {
      await promise(
        fetch("/api/auth/request-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, purpose }),
        }).then(async (r) => {
          if (!r.ok) {
            const j = await r.json().catch(() => ({}));
            throw new Error(j?.error || "Failed to send code");
          }
          return r.json();
        }),
        {
          loading: "Sending verification code…",
          success: "Code sent. Check your email.",
          error: "Couldn’t send code. Try again.",
        }
      );
      setPhase("verify");
    } catch {
      // keep phase on request; user can retry
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();

    if (!otp || !pwd || !confirmPwd) {
      toastError("Complete all fields.");
      return;
    }
    if (pwd !== confirmPwd) {
      toastError("Passwords do not match.");
      return;
    }
    // quick client-side sanity (server still enforces)
    if (
      pwd.length < 8 ||
      !/[a-z]/.test(pwd) ||
      !/[A-Z]/.test(pwd) ||
      !/[0-9]/.test(pwd)
    ) {
      toastError(PASSWORD_HINT);
      return;
    }

    setSubmitting(true);
    try {
      await promise(
        fetch("/api/auth/provision-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, otp, password: pwd, purpose }),
        }).then(async (r) => {
          if (!r.ok) {
            const j = await r.json().catch(() => ({}));
            throw new Error(j?.error || "Couldn’t set password");
          }
          return r.json();
        }),
        {
          loading: "Setting your password…",
          success: "Password set successfully.",
          error: "Couldn’t set password.",
        }
      );

      setPhase("success");
      // Send them to login with email prefilled
      router.replace(
        `/authentication/login?email=${encodeURIComponent(email)}`
      );
    } catch {
      // stay on verify to allow retry
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-dvh bg-bg text-white antialiased">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(50% 50% at 15% 15%, var(--color-brand) 0%, transparent 60%), radial-gradient(60% 40% at 85% 10%, var(--color-primary) 0%, transparent 65%)",
          filter: "blur(90px)",
        }}
      />
      <div className="relative mx-auto max-w-lg px-6 py-24">
        <div className="rounded-3xl border border-white/10 bg-card/90 p-10 shadow-2xl backdrop-blur">
          {/* Header */}
          <h1 className="mb-1 text-2xl font-semibold">
            {phase === "request" &&
              (purpose === "reset_password"
                ? "Reset your password"
                : "Set your password")}
            {phase === "verify" && "Verify & set password"}
            {phase === "success" && "All set!"}
          </h1>
          <p className="text-sm text-muted mb-6">
            {phase === "request" &&
              (purpose === "reset_password"
                ? "Enter your email and we’ll send a verification code."
                : "Enter your email and we’ll send a verification code to set your password.")}
            {phase === "verify" &&
              "Enter the code we emailed you and choose a secure password."}
            {phase === "success" &&
              "Your password has been set. Taking you to the sign-in page…"}
          </p>

          {/* Phase: Request Code */}
          {phase === "request" && (
            <form onSubmit={handleRequest} className="space-y-5">
              <div>
                <Label
                  htmlFor="email"
                  className="text-xs uppercase tracking-[0.2rem] text-muted"
                >
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@school.edu"
                  className="mt-1 border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-brand"
                />
              </div>

              <Button
                type="submit"
                disabled={!canSubmitRequest}
                className="w-full rounded-xl bg-brand px-6 py-4 text-sm font-semibold text-black shadow-lg shadow-brand/20 hover:opacity-90 disabled:opacity-60"
              >
                {submitting ? "Sending…" : "Send verification code"}
              </Button>
            </form>
          )}

          {/* Phase: Verify + Set Password */}
          {phase === "verify" && (
            <form onSubmit={handleVerify} className="space-y-5">
              <div>
                <Label className="text-xs uppercase tracking-[0.2rem] text-muted">
                  Email
                </Label>
                <Input
                  type="email"
                  value={email}
                  disabled
                  className="mt-1 border border-white/10 bg-white/5 text-white placeholder:text-muted"
                />
              </div>

              <div>
                <Label
                  htmlFor="otp"
                  className="text-xs uppercase tracking-[0.2rem] text-muted"
                >
                  Verification Code
                </Label>
                <Input
                  id="otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="6-digit code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.trim())}
                  className="mt-1 border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-brand"
                  required
                />
                <div className="flex justify-end mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={submitting}
                    className="h-8 border-white/20 bg-white/5 text-white hover:bg-white/10"
                    onClick={handleRequest}
                  >
                    Resend code
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-xs uppercase tracking-[0.2rem] text-muted">
                  New Password
                </Label>
                <Input
                  type="password"
                  value={pwd}
                  onChange={(e) => setPwd(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1 border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-brand"
                  required
                />
                <p className="mt-2 text-[11px] uppercase tracking-[0.18rem] text-muted">
                  {PASSWORD_HINT}
                </p>
              </div>

              <div>
                <Label className="text-xs uppercase tracking-[0.2rem] text-muted">
                  Confirm Password
                </Label>
                <Input
                  type="password"
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1 border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-brand"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={!canSubmitVerify}
                className="w-full rounded-xl bg-brand px-6 py-4 text-sm font-semibold text-black shadow-lg shadow-brand/20 hover:opacity-90 disabled:opacity-60"
              >
                {submitting ? "Saving…" : "Set password"}
              </Button>
            </form>
          )}

          {/* Phase: Success (brief) */}
          {phase === "success" && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <div className="text-emerald-300 text-sm">
                  Your password has been set successfully.
                </div>
              </div>
              <Button
                type="button"
                className="w-full rounded-xl bg-brand px-6 py-4 text-sm font-semibold text-black shadow-lg shadow-brand/20 hover:opacity-90"
                onClick={() =>
                  router.replace(
                    `/authentication/login?email=${encodeURIComponent(email)}`
                  )
                }
              >
                Continue to sign in
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
