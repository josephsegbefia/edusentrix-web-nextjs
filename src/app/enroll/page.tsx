/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
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
});

export default function EnrollPage() {
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState(false);
  const [schoolType, setSchoolType] = useState<"Basic" | "Secondary" | "">("");
  const [region, setRegion] = useState<GhanaRegion | "">("");
  const { promise, error } = useBusyToast();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget as HTMLFormElement);
    const raw = Object.fromEntries(fd.entries());

    let parsed: z.infer<typeof FormSchema>;
    try {
      parsed = FormSchema.parse({
        ...raw,
        schoolType: schoolType || raw.schoolType,
        region: region || raw.region,
      });
    } catch (err: any) {
      error(
        err?.issues?.[0]?.message ?? "Please review your inputs and try again."
      );
      return;
    }

    setLoading(true);
    const req = fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    });

    try {
      await promise(req, {
        loading: "Submitting application…",
        success: "Application received. We’ll email you after review.",
        error: "Failed to submit. Please try again.",
      });
      setOk(true);
      (e.currentTarget as any).reset();
      setSchoolType("");
      setRegion("");
    } finally {
      setLoading(false);
    }
  }

  if (ok) {
    return (
      <div className="relative min-h-dvh bg-bg text-white antialiased">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(60% 40% at 70% 10%, var(--color-brand) 0%, transparent 60%), radial-gradient(55% 35% at 15% 20%, var(--color-primary) 0%, transparent 70%)",
            filter: "blur(80px)",
          }}
        />
        <div className="relative mx-auto max-w-lg px-6 py-24 text-center">
          <div className="rounded-3xl border border-white/10 bg-card/80 p-10 shadow-2xl backdrop-blur">
            <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full border border-brand/40 bg-brand/10 text-brand">
              <span className="text-2xl">🎉</span>
            </div>
            <h1 className="mb-3 text-3xl font-semibold tracking-tight">
              Application received
            </h1>
            <p className="text-sm text-muted">
              We&apos;ll review your details and reach out via email with next
              steps.
            </p>
          </div>
          <Button
            className="mt-8 inline-flex items-center justify-center rounded-lg bg-brand px-6 py-3 font-medium text-black shadow-lg shadow-brand/20 transition hover:opacity-90"
            onClick={() => setOk(false)}
          >
            Submit another application
          </Button>
        </div>
      </div>
    );
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
      <div className="mx-auto max-w-2xl">
        <div className="relative mx-4 my-16 overflow-hidden rounded-3xl border border-white/10 bg-card/90 shadow-2xl backdrop-blur">
          <div className="border-b border-white/10 bg-white/5 px-10 py-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-1 text-xs text-muted">
              <span className="size-2 rounded-full bg-emerald-400" />
              Secure onboarding for Ghanaian schools
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight">
              Enrol your school with EduSentrix
            </h1>
            <p className="mt-3 max-w-xl text-sm text-muted">
              Tell us about your institution and we&apos;ll help you modernise
              fee collection, communication, and operations.
            </p>
          </div>

          <div className="px-10 py-10">
            <form onSubmit={onSubmit} className="space-y-8">
              <section className="space-y-4">
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                  Administrator
                </h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label
                      htmlFor="adminFirstName"
                      className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                    >
                      First name *
                    </Label>
                    <Input
                      id="adminFirstName"
                      name="adminFirstName"
                      autoComplete="given-name"
                      required
                      className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="adminLastName"
                      className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                    >
                      Last name *
                    </Label>
                    <Input
                      id="adminLastName"
                      name="adminLastName"
                      autoComplete="family-name"
                      required
                      className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label
                      htmlFor="adminEmail"
                      className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                    >
                      Email *
                    </Label>
                    <Input
                      id="adminEmail"
                      name="adminEmail"
                      type="email"
                      autoComplete="email"
                      required
                      className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="adminPhone"
                      className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                    >
                      Phone
                    </Label>
                    <Input
                      id="adminPhone"
                      name="adminPhone"
                      placeholder="+233..."
                      autoComplete="tel"
                      className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                    />
                  </div>
                </div>

              </section>

              <section className="space-y-4">
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                  School
                </h2>
                <div className="space-y-2">
                  <Label
                    htmlFor="schoolName"
                    className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                  >
                    School name *
                  </Label>
                  <Input
                    id="schoolName"
                    name="schoolName"
                    required
                    className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                      School type *
                    </Label>
                    <input type="hidden" name="schoolType" value={schoolType} />
                    <Select
                      value={schoolType}
                      onValueChange={(v) =>
                        setSchoolType(v as "Basic" | "Secondary")
                      }
                    >
                      <SelectTrigger className="border border-white/10 bg-white/5 text-left text-white focus:border-brand focus:ring-1 focus:ring-brand">
                        <SelectValue placeholder="Select school type" />
                      </SelectTrigger>
                      <SelectContent className="border border-white/10 bg-card text-white">
                        <SelectItem value="Basic">Basic School</SelectItem>
                        <SelectItem value="Secondary">Secondary School</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                      Region *
                    </Label>
                    <input type="hidden" name="region" value={region} />
                    <Select
                      value={region}
                      onValueChange={(v) => setRegion(v as GhanaRegion)}
                    >
                      <SelectTrigger className="border border-white/10 bg-white/5 text-left text-white focus:border-brand focus:ring-1 focus:ring-brand">
                        <SelectValue placeholder="Select region" />
                      </SelectTrigger>
                      <SelectContent className="max-h-64 border border-white/10 bg-card text-white">
                        {GHANA_REGIONS.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label
                      htmlFor="city"
                      className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                    >
                      City
                    </Label>
                    <Input
                      id="city"
                      name="city"
                      autoComplete="address-level2"
                      className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                    />
                  </div>
                </div>

              </section>

              <section className="space-y-2">
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                  Additional details
                </h2>
                <Textarea
                  id="message"
                  name="message"
                  rows={4}
                  placeholder="Tell us about your school or any specific requirements..."
                  className="border border-white/10 bg-white/5 text-sm text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                />
              </section>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={loading}
                  aria-busy={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-6 py-4 text-sm font-semibold text-black shadow-lg shadow-brand/20 transition hover:opacity-90 disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <svg
                        className="size-5 animate-spin text-black/70"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Submitting…
                    </>
                  ) : (
                    "Submit application"
                  )}
                </Button>
                <p className="mt-3 text-center text-[11px] uppercase tracking-[0.24em] text-muted">
                  Fields marked with * are required
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
