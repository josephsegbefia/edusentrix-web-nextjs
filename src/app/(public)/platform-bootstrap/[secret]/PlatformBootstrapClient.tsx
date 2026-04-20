"use client";

import * as React from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Step = "otp" | "form";

export function PlatformBootstrapClient({ pathSecret }: { pathSecret: string }) {
  const [step, setStep] = React.useState<Step>("otp");
  const [otpSending, setOtpSending] = React.useState(true);
  const [otpMasked, setOtpMasked] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");
  const [verifying, setVerifying] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

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
      setOtpMasked(json.data?.notifyEmailMasked ?? "your gate inbox");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send code.");
      setOtpMasked(null);
    } finally {
      setOtpSending(false);
    }
  }, [pathSecret]);

  React.useEffect(() => {
    void sendOtp();
  }, [sendOtp]);

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
      toast.success("Verified. Complete the admin details below.");
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
      setStep("otp");
      void sendOtp();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send invitation.");
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

        {step === "otp" ? (
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
            {otpSending ? (
              <div className="flex items-center gap-2 text-sm text-white/50">
                <Loader2 className="size-4 animate-spin" />
                Sending code…
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                onClick={() => void sendOtp()}
              >
                Resend code
              </Button>
            )}
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
            </form>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="space-y-4">
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
