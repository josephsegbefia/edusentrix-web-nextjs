"use client";

// src/components/admissions/public/PublicLookupView.tsx
// Lightweight self-service portal: a guardian enters their email, we send
// them a magic-link email containing tracker URLs for every application
// attached to their address. We never reveal whether an email matched.

import * as React from "react";
import { CheckCircle2, Loader2, Mail, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function PublicLookupView() {
  const [email, setEmail] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const trimmed = email.trim();
    if (!trimmed) {
      toast.error("Please enter your email address.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/public/admissions/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const json = await res.json().catch(() => null);

      if (res.status === 429) {
        toast.error(
          json?.error ??
            "Too many lookup attempts. Please wait a few minutes and try again.",
        );
        return;
      }

      if (!res.ok || !json?.success) {
        toast.error(json?.error ?? "Could not process your request.");
        return;
      }

      setSent(true);
      setMessage(
        json.data?.message ??
          "If we found applications attached to that email, we’ve sent the tracker links to your inbox.",
      );
    } catch (err) {
      console.error("Lookup failed:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-12 sm:py-16">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="rounded-full bg-emerald-500/10 p-3 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h1 className="text-xl font-semibold text-foreground">
              Check your inbox
            </h1>
            <p className="text-sm text-muted-foreground">
              {message}
            </p>
            <p className="text-xs text-muted-foreground">
              The links are private — please do not share them.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSent(false);
                setMessage(null);
                setEmail("");
              }}
            >
              Use a different email
            </Button>
          </CardContent>
        </Card>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Powered by EduSentrix
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12 sm:py-16">
      <Card>
        <CardContent className="space-y-5 p-6 sm:p-8">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
              <Mail className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-semibold text-foreground">
              Find my admission applications
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter the email you used when applying. We’ll send you the
              tracker link for each of your applications.
            </p>
          </div>

          <form className="space-y-3" onSubmit={handleSubmit} noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="lookup-email">Email address</Label>
              <Input
                id="lookup-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="parent@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={submitting}
              aria-busy={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending links…
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Email me my applications
                </>
              )}
            </Button>
          </form>

          <div className="flex items-start gap-2 rounded-xl border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <span>
              For your privacy, we never reveal whether an email is on file.
              You will only see the tracker links if your email matches an
              application.
            </span>
          </div>
        </CardContent>
      </Card>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        Powered by EduSentrix
      </p>
    </div>
  );
}
