// src/app/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import {
  ScrollReveal,
  StaggerContainer,
  StaggerItem,
  FloatingCard,
  HeroText,
} from "@/components/landing/scroll-animations";
import { Building2, Clock3, CreditCard, Receipt, Smartphone, Users } from "lucide-react";
import { BrandMark } from "@/components/brand/BrandMark";
import { EduSentrixWordmark } from "@/components/brand/EduSentrixWordmark";
import { isDemoMode } from "@/lib/demo/runtime";
import { DemoLandingPage } from "@/components/demo/DemoLandingPage";
import { MarketingHeroPreview } from "@/components/marketing/MarketingHeroPreview";
import { SiteNav } from "@/components/marketing/SiteNav";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "EduSentrix — Collect fees, run operations, delight parents",
  description:
    "All-in-one school OS for Ghana & Africa: fee collection, records, timetables, notices, analytics, and an optional EduAI assistant.",
};

export default function HomePage() {
  if (isDemoMode()) {
    return <DemoLandingPage />;
  }
  return (
    <main className="m-page min-h-dvh antialiased">
      <SiteNav />
      <HeroSection />
      <PainSolution />
      <FeatureGrid />
      <HowItWorks />
      <MetricsTestimonials />
      <Integrations />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ HERO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 15% 10%, var(--m-glow-violet) 0%, transparent 55%), radial-gradient(ellipse 55% 45% at 90% 20%, var(--m-glow-cyan) 0%, transparent 50%), radial-gradient(ellipse 40% 30% at 70% 90%, var(--m-glow-violet) 0%, transparent 55%)",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24 lg:px-8 lg:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="text-center lg:text-left">
            <HeroText delay={0}>
              <span className="inline-flex items-center gap-2.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-sm font-medium text-emerald-700 backdrop-blur-sm dark:text-emerald-300">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
                Now onboarding schools in Ghana
              </span>
            </HeroText>

            <HeroText delay={0.1}>
              <h1 className="mt-6 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
                Collect fees, run operations, and{" "}
                <span className="text-violet-600 dark:text-violet-300">delight parents</span>
                —on one platform.
              </h1>
            </HeroText>

            <HeroText delay={0.2}>
              <p className="m-muted mx-auto mt-6 max-w-xl text-lg leading-relaxed lg:mx-0">
                <span className="font-semibold text-violet-600 dark:text-violet-300">EduSentrix</span> is the modern school OS for Africa: web + mobile,
                Mobile Money and Paystack ready, fast onboarding, and optional AI
                to automate the boring stuff.
              </p>
            </HeroText>

            <HeroText delay={0.3}>
              <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row lg:justify-start">
                <Link
                  href="/enroll"
                  className="group flex items-center justify-center gap-2 rounded-xl bg-linear-to-r from-violet-500 to-purple-600 px-6 py-3.5 text-sm font-semibold text-white shadow-xl shadow-violet-500/25 transition-all hover:scale-[1.02] hover:shadow-violet-500/40"
                >
                  Enrol your school
                  <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
                <a
                  href="https://demo.tryedusentrix.app"
                  className="group flex items-center justify-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-6 py-3.5 text-sm font-semibold text-cyan-700 backdrop-blur-sm transition-all hover:scale-[1.02] hover:bg-cyan-500/15 dark:text-cyan-300"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Explore live demo
                </a>
              </div>
              <p className="m-faint mt-3 text-center text-xs lg:text-left">
                No sign-up needed. Try the full platform instantly.
              </p>
            </HeroText>

            <HeroText delay={0.4}>
              <div className="mt-10 grid grid-cols-3 gap-3 sm:gap-4">
                <Stat icon={Users} label="Students managed" value="10k+" />
                <Stat icon={Clock3} label="Avg. setup time" value="< 1 day" />
                <Stat icon={Building2} label="Payout methods" value="MoMo + Bank" />
              </div>
            </HeroText>
          </div>

          <FloatingCard delay={0.3} className="relative pb-6 sm:pb-8">
            <MarketingHeroPreview />
          </FloatingCard>
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Users;
}) {
  return (
    <div className="m-card rounded-xl p-3 text-left backdrop-blur-sm sm:p-4">
      <Icon className="mb-3 h-5 w-5 text-violet-600 dark:text-violet-300" aria-hidden />
      <div className="text-lg font-bold sm:text-2xl">{value}</div>
      <div className="m-faint mt-1 text-[11px] sm:text-xs">{label}</div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━ PAIN → SOLUTION ━━━━━━━━━━━━━━━━━━━━━━━━ */
function PainSolution() {
  return (
    <section className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <StaggerContainer className="grid gap-6 md:grid-cols-2" staggerDelay={0.15}>
        {/* Pain Card */}
        <StaggerItem>
          <div className="relative overflow-hidden rounded-2xl border border-red-500/20 bg-linear-to-br from-red-500/5 to-transparent p-6 sm:p-8">
            <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-red-500/10 blur-2xl" />
            <div className="relative">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10">
                <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold">What schools struggle with</h2>
              <ul className="mt-5 space-y-3">
                {[
                  "Manual fee tracking and poor visibility",
                  "Fragmented tools for notices, records, and timetables",
                  "Slow reconciliation between MoMo, bank, and ledgers",
                  "Parents miss updates; admin time wasted",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm m-muted">
                    <svg className="mt-0.5 h-5 w-5 shrink-0 text-red-600/80 dark:text-red-400/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </StaggerItem>

        {/* Solution Card */}
        <StaggerItem>
          <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-linear-to-br from-emerald-500/5 to-transparent p-6 sm:p-8">
            <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl" />
            <div className="relative">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10">
                <svg className="h-6 w-6 text-emerald-600 dark:text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold">How <EduSentrixWordmark /> solves it</h2>
              <ul className="mt-5 space-y-3">
                {[
                  "Smart fee + installment plans with automated reminders",
                  "Unified records, notices, and timetable management",
                  "Reconciliation tools; Paystack + MoMo integrations",
                  "Parent web + mobile app with real-time updates",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm m-muted">
                    <svg className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </StaggerItem>
      </StaggerContainer>
    </section>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━ FEATURES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function FeatureGrid() {
  const features = [
    {
      title: "Fees & Installments",
      body: "Set due dates, auto-generate schedules, send reminders, and track payments.",
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: "violet",
    },
    {
      title: "Student Records",
      body: "Clean profiles, enrollment data, classes, and guardians—always in sync.",
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      color: "blue",
    },
    {
      title: "Timetables",
      body: "Conflict-free scheduling with versioning and teacher/class views.",
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      color: "emerald",
    },
    {
      title: "Notices & Announcements",
      body: "School-wide or class-specific updates with push/email and read receipts.",
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
        </svg>
      ),
      color: "amber",
    },
    {
      title: "Analytics",
      body: "Collections, arrears, engagement—make decisions with confidence.",
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      color: "cyan",
    },
    {
      title: "EduAI (Premium)",
      body: "Generate notices, summarize dashboards, and automate repetitive tasks.",
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
      color: "purple",
    },
  ];

  const colorClasses: Record<string, { bg: string; border: string; text: string }> = {
    violet: { bg: "bg-violet-500/10", border: "border-violet-500/20", text: "text-violet-600 dark:text-violet-300" },
    blue: { bg: "bg-blue-500/10", border: "border-blue-500/20", text: "text-blue-600 dark:text-blue-300" },
    emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-600 dark:text-emerald-300" },
    amber: { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-600 dark:text-amber-300" },
    cyan: { bg: "bg-cyan-500/10", border: "border-cyan-500/20", text: "text-cyan-600 dark:text-cyan-300" },
    purple: { bg: "bg-purple-500/10", border: "border-purple-500/20", text: "text-purple-600 dark:text-purple-300" },
  };

  return (
    <section id="features" className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-transparent via-violet-500/5 to-transparent" />

      <ScrollReveal className="relative mx-auto max-w-3xl text-center">
        <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-sm font-medium text-violet-700 dark:text-violet-300">
          Features
        </span>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          All the essentials—beautifully integrated
        </h2>
        <p className="mt-4 text-lg m-muted">
          Everything your school needs to run smoothly, in one fast platform.
        </p>
      </ScrollReveal>

      <StaggerContainer className="relative mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" staggerDelay={0.08}>
        {features.map((f) => {
          const colors = colorClasses[f.color];
          return (
            <StaggerItem key={f.title}>
              <article className="group relative m-card rounded-2xl p-6 transition-all duration-300 hover:-translate-y-0.5">
                <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl border ${colors.bg} ${colors.border} mb-4`}>
                  <span className={colors.text}>{f.icon}</span>
                </div>
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed m-muted">{f.body}</p>
                <a href="#" className={`mt-4 inline-flex items-center gap-1 text-sm font-medium ${colors.text} transition-all hover:gap-2`}>
                  Learn more
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              </article>
            </StaggerItem>
          );
        })}
      </StaggerContainer>
    </section>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━ HOW IT WORKS ━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function HowItWorks() {
  const steps = [
    { n: "1", title: "Invite & Onboard", body: "We provision your school, create admin accounts, and import your data." },
    { n: "2", title: "Set Up Fees & Comms", body: "Define fee plans, connect Paystack/MoMo, and set up notices & timetables." },
    { n: "3", title: "Launch to Parents", body: "Share links; parents log in with OTP. Collect payments and track progress." },
  ];

  return (
    <section id="how" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <ScrollReveal className="mx-auto max-w-3xl text-center">
        <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-300">
          How it works
        </span>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Launch in days, not months
        </h2>
        <p className="mt-4 text-lg m-muted">
          We guide you end-to-end. Start with a live demo, and go live quickly.
        </p>
      </ScrollReveal>

      <StaggerContainer className="mt-12 grid gap-6 md:grid-cols-3" staggerDelay={0.15}>
        {steps.map((s, i) => (
          <StaggerItem key={s.n} variant="scaleIn">
            <div className="m-card relative rounded-2xl p-6 transition-all duration-300 sm:p-8">
              {i < steps.length - 1 && (
                <div className="absolute -right-3 top-1/2 hidden h-px w-6 bg-linear-to-r from-violet-500/50 to-transparent md:block" />
              )}
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-linear-to-br from-violet-500 to-purple-600 text-lg font-bold text-white shadow-lg shadow-violet-500/25">
                {s.n}
              </div>
              <h3 className="mt-5 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed m-muted">{s.body}</p>
            </div>
          </StaggerItem>
        ))}
      </StaggerContainer>
    </section>
  );
}

/* ━━━━━━━━━━━━━━━━━ METRICS + TESTIMONIALS ━━━━━━━━━━━━━━━━━━━━━ */
function MetricsTestimonials() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <StaggerContainer className="grid gap-6 md:grid-cols-3" staggerDelay={0.12}>
        <StaggerItem>
          <div className="m-card rounded-2xl p-6 sm:p-8">
            <h3 className="mb-6 text-lg font-semibold">Key Metrics</h3>
            <div className="space-y-4">
              <MetricLine label="Avg. on-time payments" value="+35%" color="emerald" />
              <MetricLine label="Setup time" value="< 1 day" color="violet" />
              <MetricLine label="System uptime" value="99.9%" color="blue" />
            </div>
          </div>
        </StaggerItem>
        <StaggerItem>
          <Testimonial
            quote="Collections are now predictable, and parents never miss notices."
            author="Headteacher, Achimota area"
            avatar="HT"
          />
        </StaggerItem>
        <StaggerItem>
          <Testimonial
            quote="Reconciliation used to take days—now it's minutes."
            author="Bursar, Cape Coast"
            avatar="BC"
          />
        </StaggerItem>
      </StaggerContainer>
    </section>
  );
}

function MetricLine({ label, value, color }: { label: string; value: string; color: string }) {
  const colorClasses: Record<string, string> = { emerald: "text-emerald-600 dark:text-emerald-300", violet: "text-violet-600 dark:text-violet-300", blue: "text-blue-600 dark:text-blue-300" };
  return (
    <div className="flex items-center justify-between border-b border-(--m-border) py-3 last:border-none">
      <div className="text-sm m-muted">{label}</div>
      <div className={`text-lg font-bold ${colorClasses[color]}`}>{value}</div>
    </div>
  );
}

function Testimonial({ quote, author, avatar }: { quote: string; author: string; avatar: string }) {
  return (
    <blockquote className="relative overflow-hidden m-card rounded-2xl p-6 sm:p-8">
      <svg className="absolute right-4 top-4 h-12 w-12 text-violet-500/10" fill="currentColor" viewBox="0 0 24 24">
        <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
      </svg>
      <div className="relative">
        <p className="text-base leading-relaxed m-muted">&ldquo;{quote}&rdquo;</p>
        <footer className="mt-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-br from-violet-500 to-purple-600 text-sm font-bold text-white">
            {avatar}
          </div>
          <div className="text-sm m-faint">— {author}</div>
        </footer>
      </div>
    </blockquote>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━ PAYMENTS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const PAYMENT_HIGHLIGHTS = [
  {
    icon: Receipt,
    title: "Fee plans",
    body: "Term fees, installments, and automated reminders.",
    accent: "from-violet-500/20 to-purple-500/5",
    iconClass: "text-violet-600 dark:text-violet-300",
    borderClass: "border-violet-500/25",
  },
  {
    icon: Smartphone,
    title: "Mobile money",
    body: "MTN MoMo, Telecel Cash, and AT Money in one flow.",
    accent: "from-emerald-500/20 to-teal-500/5",
    iconClass: "text-emerald-600 dark:text-emerald-300",
    borderClass: "border-emerald-500/25",
  },
  {
    icon: CreditCard,
    title: "Card payments",
    body: "Visa and Mastercard through secure Paystack checkout.",
    accent: "from-cyan-500/20 to-blue-500/5",
    iconClass: "text-cyan-600 dark:text-cyan-300",
    borderClass: "border-cyan-500/25",
  },
] as const;

function Integrations() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <ScrollReveal>
        <div className="m-card relative overflow-hidden rounded-2xl p-8 sm:p-10">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 top-0 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -left-16 bottom-0 h-48 w-48 rounded-full bg-violet-500/10 blur-3xl"
          />

          <div className="relative mx-auto max-w-3xl text-center">
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-300">
              <Receipt className="h-3.5 w-3.5" aria-hidden />
              Payments
            </span>
            <h3 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
              Collect fees on every channel parents already use
            </h3>
            <p className="mt-4 text-base leading-relaxed m-muted sm:text-lg">
              Mobile money from Ghana&apos;s major networks — plus card checkout — all reconciled to
              one school ledger.
            </p>
          </div>

          <StaggerContainer
            className="relative mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-3"
            staggerDelay={0.08}
          >
            {PAYMENT_HIGHLIGHTS.map((item) => (
              <StaggerItem key={item.title} variant="scaleIn">
                <div
                  className={`flex h-full flex-col rounded-2xl border bg-linear-to-br p-5 text-left ${item.borderClass} ${item.accent}`}
                >
                  <div
                    className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl border bg-(--m-subtle) ${item.borderClass}`}
                  >
                    <item.icon className={`h-5 w-5 ${item.iconClass}`} aria-hidden />
                  </div>
                  <div className="text-sm font-semibold">{item.title}</div>
                  <p className="mt-2 text-sm leading-relaxed m-muted">{item.body}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </ScrollReveal>
    </section>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━ FAQ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function FAQ() {
  const faqs = [
    { q: "How do payouts work?", a: "We integrate with Paystack and Mobile Money. Funds settle into your chosen bank or MoMo wallet per your payout settings." },
    { q: "How long is setup?", a: "Most schools go live in under one day. We help import your data and configure fee plans." },
    { q: "Do parents need to install an app?", a: "Parents can use web or mobile. OTP sign-in—no passwords needed." },
    { q: "Who owns the data?", a: "You do. We act as your processor and provide secure access and exports anytime." },
    { q: "Is there a free trial?", a: "Yes! Explore the live demo at demo.tryedusentrix.app — no sign-up required. For extended trial access or custom pricing, contact us." },
  ];

  return (
    <section id="faq" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <ScrollReveal className="mx-auto mb-12 max-w-3xl text-center">
        <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-sm font-medium text-cyan-700 dark:text-cyan-300">
          FAQ
        </span>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Frequently asked questions
        </h2>
        <p className="mt-4 text-lg m-muted">Short answers to common questions.</p>
      </ScrollReveal>

      <StaggerContainer className="mx-auto grid max-w-4xl gap-4 md:grid-cols-2" staggerDelay={0.06}>
        {faqs.map((f) => (
          <StaggerItem key={f.q}>
            <div className="m-card rounded-2xl p-6">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-cyan-500/20 bg-cyan-500/10">
                  <span className="text-xs font-bold text-cyan-600 dark:text-cyan-300">?</span>
                </div>
                <div>
                  <div className="font-semibold">{f.q}</div>
                  <p className="mt-2 text-sm leading-relaxed m-muted">{f.a}</p>
                </div>
              </div>
            </div>
          </StaggerItem>
        ))}
      </StaggerContainer>
    </section>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━ FINAL CTA ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function FinalCTA() {
  return (
    <section className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(139,92,246,0.15) 0%, transparent 60%)",
        }}
      />
      <ScrollReveal variant="scaleIn">
        <div className="m-card relative overflow-hidden rounded-3xl p-8 text-center sm:p-12 md:p-16">
          <div className="absolute left-1/2 top-0 h-32 w-96 -translate-x-1/2 rounded-full bg-violet-500/20 blur-3xl" />
          <div className="relative">
            <h3 className="text-3xl font-bold sm:text-4xl">
              Ready to modernize your school?
            </h3>
            <p className="mx-auto mt-4 max-w-xl text-lg m-muted">
              Get started today. See fees, notices, timetables, and
              parent experience in action.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
              <Link
                href="/enroll"
                className="group flex items-center justify-center gap-2 rounded-xl bg-linear-to-r from-violet-500 to-purple-600 px-8 py-4 font-semibold text-white shadow-xl shadow-violet-500/25 transition-all hover:scale-[1.02] hover:shadow-violet-500/40"
              >
                Enrol your school
                <svg className="h-5 w-5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <a
                href="https://demo.tryedusentrix.app"
                className="group flex items-center justify-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-8 py-4 font-semibold text-cyan-700 backdrop-blur-sm transition-all hover:scale-[1.02] hover:bg-cyan-500/15 dark:text-cyan-300"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Explore live demo
              </a>
            </div>
            <p className="mt-3 text-sm m-faint">
              No sign-up needed — try the full platform in seconds.
            </p>
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━ FOOTER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function Footer() {
  return (
    <footer className="border-t border-(--m-border)">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 text-sm sm:grid-cols-2 sm:px-6 md:grid-cols-4 lg:px-8">
        <div>
          <BrandMark size="sm" />
          <p className="m-faint mt-4 leading-relaxed">
            Built by Appsentrix for schools in Ghana & Africa.
          </p>
          <div className="mt-4 flex gap-3">
            <a href="#" className="flex h-9 w-9 items-center justify-center rounded-lg bg-(--m-subtle) transition-colors hover:bg-(--m-glass)">
              <svg className="h-4 w-4 m-muted" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" />
              </svg>
            </a>
            <a href="#" className="flex h-9 w-9 items-center justify-center rounded-lg bg-(--m-subtle) transition-colors hover:bg-(--m-glass)">
              <svg className="h-4 w-4 m-muted" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
              </svg>
            </a>
          </div>
        </div>

        <div>
          <div className="mb-4 font-semibold">Product</div>
          <ul className="space-y-3 m-faint">
            <li><a href="#features" className="transition-colors hover:text-(--m-fg)">Features</a></li>
            <li><a href="#faq" className="transition-colors hover:text-(--m-fg)">FAQ</a></li>
          </ul>
        </div>

        <div>
          <div className="mb-4 font-semibold">Company</div>
          <ul className="space-y-3 m-faint">
            <li><Link href="/about" className="transition-colors hover:text-(--m-fg)">About</Link></li>
            <li><Link href="/careers" className="transition-colors hover:text-(--m-fg)">Careers</Link></li>
            <li><Link href="/contact" className="transition-colors hover:text-(--m-fg)">Contact</Link></li>
          </ul>
        </div>

        <div>
          <div className="mb-4 font-semibold">Legal</div>
          <ul className="space-y-3 m-faint">
            <li><Link href="/terms" className="transition-colors hover:text-(--m-fg)">Terms</Link></li>
            <li><Link href="/privacy" className="transition-colors hover:text-(--m-fg)">Privacy</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-(--m-border)">
        <div className="mx-auto max-w-7xl px-4 py-6 text-center text-sm m-faint sm:px-6 lg:px-8">
          © {new Date().getFullYear()} Appsentrix. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
