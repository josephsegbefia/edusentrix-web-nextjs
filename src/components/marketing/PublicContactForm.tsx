"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GhanaPhoneInput } from "@/components/ui/ghana-phone-input";
import { Input } from "@/components/ui/input";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { Textarea } from "@/components/ui/textarea";

type ContactFormState = {
  fullName: string;
  email: string;
  phone: string;
  schoolName: string;
  inquiryType: "enrollment" | "existing-school" | "learn" | "partnership" | "general";
  message: string;
  website: string;
};

const INITIAL_FORM: ContactFormState = {
  fullName: "",
  email: "",
  phone: "",
  schoolName: "",
  inquiryType: "general",
  message: "",
  website: "",
};

export function PublicContactForm() {
  const [form, setForm] = useState<ContactFormState>(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/public/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await response.json();

      if (!response.ok || !json.success) {
        setError(json.error || "Could not send your message. Please try again.");
        return;
      }

      setSuccess("Message sent. The EduSentrix team will get back to you shortly.");
      setForm(INITIAL_FORM);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {success}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name *">
          <Input
            required
            value={form.fullName}
            onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
            placeholder="Ama Owusu"
            className="h-11 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-white/30"
          />
        </Field>
        <Field label="Email *">
          <Input
            required
            type="email"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            placeholder="you@school.edu"
            className="h-11 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-white/30"
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone *">
          <GhanaPhoneInput
            required
            value={form.phone}
            onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
            className="h-11 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-white/30"
          />
        </Field>
        <Field label="School (optional)">
          <Input
            value={form.schoolName}
            onChange={(event) => setForm((prev) => ({ ...prev, schoolName: event.target.value }))}
            placeholder="School name"
            className="h-11 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-white/30"
          />
        </Field>
      </div>

      <Field label="What is this about? *">
        <PremiumSelect
          value={form.inquiryType}
          onValueChange={(value) =>
            setForm((prev) => ({
              ...prev,
              inquiryType: value as ContactFormState["inquiryType"],
            }))
          }
        >
          <PremiumSelectTrigger className="h-11 rounded-xl border-white/10 bg-white/5 text-sm text-white">
            <PremiumSelectValue placeholder="Select inquiry type" />
          </PremiumSelectTrigger>
          <PremiumSelectContent>
            <PremiumSelectItem value="general">General inquiry</PremiumSelectItem>
            <PremiumSelectItem value="enrollment">Enrol my school</PremiumSelectItem>
            <PremiumSelectItem value="existing-school">Existing school support</PremiumSelectItem>
            <PremiumSelectItem value="learn">EduSentrix Learn</PremiumSelectItem>
            <PremiumSelectItem value="partnership">Partnerships</PremiumSelectItem>
          </PremiumSelectContent>
        </PremiumSelect>
      </Field>

      <Field label="Message *">
        <Textarea
          required
          rows={5}
          value={form.message}
          onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))}
          placeholder="Tell us what you need, your timeline, and any context that helps."
          className="rounded-xl border-white/10 bg-white/5 text-white placeholder:text-white/30"
        />
      </Field>

      {/* Honeypot */}
      <input
        tabIndex={-1}
        autoComplete="off"
        value={form.website}
        onChange={(event) => setForm((prev) => ({ ...prev, website: event.target.value }))}
        name="website"
        className="hidden"
        aria-hidden
      />

      <div className="pt-2">
        <Button
          type="submit"
          disabled={loading}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-violet-500 to-purple-600 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:from-violet-400 hover:to-purple-500"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              Send message
              <Send className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
        {label}
      </span>
      {children}
    </label>
  );
}
