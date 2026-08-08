"use client";

import * as React from "react";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Step = "intro" | "otp" | "form";

function formatCountdown(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function PlatformBootstrapClient({ pathSecret }: { pathSecret: string }) {
  const [step, setStep] = React.useState<Step>("intro");
  const [otpSending, setOtpSending] = React.useState(false);
  const [otpMasked, setOtpMasked] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");
  const [verifying, setVerifying] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [sessionSecondsRemaining, setSessionSecondsRemaining] = React.useState<number | null>(null);
  const [sessionExpired, setSessionExpired] = React.useState(false);

  const [email, setEmail] = React.useState("");
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");

  const sendOtp = React.useCallback(async () => {
    setOtpSending(true);
    try {
      const res = await fetch("/api/platform/bootstrap/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: pathSecret }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Could not send code.");
      }
      setCode("");
      setSessionExpired(false);
      setSessionSecondsRemaining(null);
      setOtpMasked(json.data?.notifyEmailMasked ?? "your gate inbox");
      setStep("otp");
      toast.success("Verification code sent.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send code.");
      setOtpMasked(null);
    } finally {
      setOtpSending(false);
    }
  }, [pathSecret]);

  React.useEffect(() => {
    if (step !== "form" || sessionSecondsRemaining === null) return;
    if (sessionSecondsRemaining <= 0) {
      setSessionSecondsRemaining(0);
      setSessionExpired(true);
      setStep("otp");
      return;
    }

    const timer = window.setTimeout(() => {
      setSessionSecondsRemaining((current) =>
        current === null ? current : Math.max(0, current - 1)
      );
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [sessionSecondsRemaining, step]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      toast.error("Enter the 6-digit code from email.");
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch("/api/platform/bootstrap/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: pathSecret, code }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Verification failed.");
      }
      setSessionExpired(false);
      setSessionSecondsRemaining(json.data?.sessionExpiresInSeconds ?? 120);
      toast.success("Verified. You now have 2 minutes to finish.");
      setStep("form");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verification failed.");
    } finally {
      setVerifying(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/platform/bootstrap/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: pathSecret,
          email: email.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Could not send invitation.");
      }
      toast.success(
        "Invitation sent. The new admin must open the link in the email (not the normal sign-in page) to accept and set a password."
      );
      setEmail("");
      setFirstName("");
      setLastName("");
      setCode("");
      setOtpMasked(null);
      setSessionSecondsRemaining(null);
      setSessionExpired(false);
      setStep("intro");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not send invitation.";
      if (/session expired/i.test(message)) {
        setSessionExpired(true);
        setSessionSecondsRemaining(0);
        setStep("otp");
      }
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-12">
      <div className="rounded-3xl border border-white/10 bg-linear-to-br from-slate-950 via-slate-900 to-black p-8 text-white shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl border border-cyan-400/25 bg-cyan-500/10 text-cyan-200">
            <ShieldCheck className="size-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Platform admin bootstrap</h1>
            <p className="text-sm text-white/55">
              High-assurance flow: email gate, then invitation only.
            </p>
          </div>
        </div>

        {step === "intro" ? (
          <div className="space-y-5">
            <p className="text-sm text-white/65">
              This flow is protected by an email gate. Send a one-time code to the configured gate
              inbox before you can unlock the platform admin invitation form.
            </p>
            <Button
              type="button"
              disabled={otpSending}
              className="w-full bg-cyan-600 text-white hover:bg-cyan-500"
              onClick={() => void sendOtp()}
            >
              {otpSending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Sending code…
                </>
              ) : (
                "Send verification code"
              )}
            </Button>
          </div>
        ) : step === "otp" ? (
          <div className="space-y-5">
            <p className="text-sm text-white/65">
              A one-time code was sent to the configured gate address
              {otpMasked ? (
                <>
                  {" "}
                  (<span className="text-white/85">{otpMasked}</span>)
                </>
              ) : null}
              . Enter it to unlock the form. The link alone is not enough.
            </p>
            {sessionExpired ? (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                Your verified session expired after 2 minutes. Request a fresh code to continue.
              </div>
            ) : null}
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-white/70">6-digit code</Label>
                <Input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(ev) => setCode(ev.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="border-white/10 bg-white/5 text-lg tracking-[0.35em] text-white"
                  placeholder="000000"
                />
              </div>
              <Button
                type="submit"
                disabled={verifying || code.length !== 6 || otpSending}
                className="w-full bg-cyan-600 text-white hover:bg-cyan-500"
              >
                {verifying ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Verifying…
                  </>
                ) : (
                  "Unlock form"
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={otpSending}
                className="w-full border-white/15 bg-white/5 text-white hover:bg-white/10"
                onClick={() => void sendOtp()}
              >
                {otpSending ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Sending code…
                  </>
                ) : (
                  "Resend code"
                )}
              </Button>
            </form>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-300" />
                <div className="space-y-1">
                  <p className="font-medium text-emerald-50">Verification successful</p>
                  <p>
                    This unlocked session expires in{" "}
                    <span className="font-mono text-emerald-50">
                      {formatCountdown(sessionSecondsRemaining ?? 0)}
                    </span>
                    . After that, the code becomes invalid and you must resend a new one.
                  </p>
                </div>
              </div>
            </div>
            <p className="text-sm text-white/60">
              Creates a Clerk invitation with <span className="text-white/85">platform_admin</span>{" "}
              metadata. The person must use this email to accept and set a password.
            </p>
            <div className="space-y-2">
              <Label className="text-white/70">Work email</Label>
              <Input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border-white/10 bg-white/5 text-white"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-white/70">First name</Label>
                <Input
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="border-white/10 bg-white/5 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Last name</Label>
                <Input
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="border-white/10 bg-white/5 text-white"
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-emerald-600 text-white hover:bg-emerald-500"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Sending invitation…
                </>
              ) : (
                "Send platform admin invitation"
              )}
            </Button>
          </form>
        )}
      </div>
      <p className="mt-6 text-center text-xs text-white/35">
        If you reached this page by mistake, close the tab. Rotate the bootstrap secret if you
        suspect leakage.
      </p>
    </div>
  );
}
