// src/app/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  ScrollReveal,
  StaggerContainer,
  StaggerItem,
  FloatingCard,
  HeroText,
  ParallaxFloat,
} from "@/components/landing/scroll-animations";

export const metadata: Metadata = {
  title: "EduSentrix — Collect fees, run operations, delight parents",
  description:
    "All-in-one school OS for Ghana & Africa: fee collection, records, timetables, notices, analytics, and an optional EduAI assistant.",
};

export default function HomePage() {
  return (
    <main className="min-h-dvh bg-neutral-950 text-white antialiased">
      <SiteNav />
      <HeroSection />
      <LogoStrip />
      <PainSolution />
      <FeatureGrid />
      <HowItWorks />
      <MetricsTestimonials />
      <Integrations />
      <PricingTeaser />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ NAV ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function SiteNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-neutral-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="group inline-flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-xl bg-linear-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/20">
            <span className="text-lg font-bold text-white">E</span>
          </div>
          <span className="text-lg font-semibold tracking-tight text-white transition-colors group-hover:text-violet-300">
            EduSentrix
          </span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium lg:flex">
          <a href="#features" className="text-white/60 transition-colors hover:text-white">Features</a>
          <a href="#how" className="text-white/60 transition-colors hover:text-white">How it works</a>
          <a href="#pricing" className="text-white/60 transition-colors hover:text-white">Pricing</a>
          <a href="#faq" className="text-white/60 transition-colors hover:text-white">FAQ</a>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/sign-in" className="hidden rounded-xl px-4 py-2.5 text-sm font-medium text-white/70 transition-all hover:bg-white/5 hover:text-white sm:inline-flex">
            Sign in
          </Link>
          <Link href="/enroll" className="rounded-xl bg-linear-to-r from-violet-500 to-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:scale-[1.02] hover:shadow-violet-500/40">
            Enrol your school
          </Link>
        </div>
      </div>
    </header>
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
            "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(139,92,246,0.3) 0%, transparent 50%), radial-gradient(ellipse 60% 40% at 80% 60%, rgba(168,85,247,0.15) 0%, transparent 50%), radial-gradient(ellipse 50% 30% at 20% 80%, rgba(139,92,246,0.1) 0%, transparent 50%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />
      <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 h-96 w-96 animate-pulse rounded-full bg-violet-500/20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-40 h-80 w-80 animate-pulse rounded-full bg-purple-500/15 blur-3xl" style={{ animationDelay: "1s" }} />

      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28 lg:px-8 lg:py-32">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="text-center lg:text-left">
            <HeroText delay={0}>
              <span className="inline-flex items-center gap-2.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-sm font-medium text-emerald-300 backdrop-blur-sm">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
                </span>
                Now onboarding schools in Ghana
              </span>
            </HeroText>

            <HeroText delay={0.1}>
              <h1 className="mt-6 bg-linear-to-br from-white via-white to-white/60 bg-clip-text text-4xl font-bold leading-[1.1] tracking-tight text-transparent sm:text-5xl lg:text-6xl">
                Collect fees, run operations, and{" "}
                <span className="bg-linear-to-r from-violet-400 to-purple-400 bg-clip-text">
                  delight parents
                </span>
                —on one platform.
              </h1>
            </HeroText>

            <HeroText delay={0.2}>
              <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-white/60 lg:mx-0">
                EduSentrix is the modern school OS for Africa: web + mobile,
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
                  href="#how"
                  className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:border-white/20 hover:bg-white/10"
                >
                  <svg className="h-5 w-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  See how it works
                </a>
              </div>
            </HeroText>

            <HeroText delay={0.4}>
              <div className="mt-10 grid grid-cols-3 gap-4">
                <Stat label="Students managed" value="10k+" />
                <Stat label="Avg. setup time" value="< 1 day" />
                <Stat label="Payout methods" value="MoMo + Bank" />
              </div>
            </HeroText>
          </div>

          {/* Dashboard Screenshot */}
          <FloatingCard delay={0.3} className="relative">
            <div className="absolute inset-0 scale-95 rounded-3xl bg-linear-to-r from-violet-500/20 to-purple-500/20 blur-2xl" />
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/80 shadow-2xl shadow-black/50 backdrop-blur-xl lg:rounded-3xl">
              <div className="flex items-center gap-2 border-b border-white/5 bg-neutral-900/50 px-4 py-3">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-500/80" />
                  <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
                  <div className="h-3 w-3 rounded-full bg-green-500/80" />
                </div>
                <div className="mx-4 flex-1">
                  <div className="flex h-6 items-center rounded-md bg-neutral-800 px-3">
                    <span className="text-xs text-white/40">app.edusentrix.com/admin</span>
                  </div>
                </div>
              </div>
              <div className="relative aspect-16/10">
                <Image src="/dashboard.png" alt="EduSentrix Dashboard" fill className="object-cover object-top" priority />
              </div>
            </div>

            <ParallaxFloat y={6} className="absolute -bottom-4 -left-4 hidden sm:-bottom-6 sm:-left-6 sm:block">
              <div className="rounded-xl border border-white/10 bg-neutral-900/95 px-4 py-3 shadow-xl shadow-black/30 backdrop-blur-xl">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-500/20 bg-linear-to-br from-emerald-500/20 to-emerald-500/5">
                    <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs text-white/50">Collections this term</div>
                    <div className="text-lg font-bold text-white">GH₵ 128,450</div>
                  </div>
                </div>
              </div>
            </ParallaxFloat>

            <ParallaxFloat y={8} className="absolute -right-4 -top-4 hidden sm:-right-6 sm:-top-6 md:block">
              <div className="rounded-xl border border-white/10 bg-neutral-900/95 px-4 py-3 shadow-xl shadow-black/30 backdrop-blur-xl">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-violet-500/20 bg-linear-to-br from-violet-500/20 to-violet-500/5">
                    <svg className="h-4 w-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-white">12 new payments</div>
                    <div className="text-[10px] text-white/40">Just now</div>
                  </div>
                </div>
              </div>
            </ParallaxFloat>
          </FloatingCard>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm transition-colors hover:bg-white/8">
      <div className="text-xl font-bold text-white sm:text-2xl">{value}</div>
      <div className="mt-1 text-xs text-white/50">{label}</div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━ LOGO STRIP ━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function LogoStrip() {
  return (
    <ScrollReveal variant="fadeIn" duration={0.8}>
      <div className="border-y border-white/5 bg-white/1 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.25em] text-white/30">
            Trusted by schools across Ghana
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {["Prestige Academy", "Bright Future School", "Cape Coast Int'l", "Achimota Prep", "Kumasi Elite"].map((name) => (
              <span key={name} className="text-sm font-medium text-white/20 transition-colors hover:text-white/40">
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </ScrollReveal>
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
                <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white">What schools struggle with</h2>
              <ul className="mt-5 space-y-3">
                {[
                  "Manual fee tracking and poor visibility",
                  "Fragmented tools for notices, records, and timetables",
                  "Slow reconciliation between MoMo, bank, and ledgers",
                  "Parents miss updates; admin time wasted",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-white/60">
                    <svg className="mt-0.5 h-5 w-5 shrink-0 text-red-400/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                <svg className="h-6 w-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white">How EduSentrix solves it</h2>
              <ul className="mt-5 space-y-3">
                {[
                  "Smart fee + installment plans with automated reminders",
                  "Unified records, notices, and timetable management",
                  "Reconciliation tools; Paystack + MoMo integrations",
                  "Parent web + mobile app with real-time updates",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-white/60">
                    <svg className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
    violet: { bg: "bg-violet-500/10", border: "border-violet-500/20", text: "text-violet-400" },
    blue: { bg: "bg-blue-500/10", border: "border-blue-500/20", text: "text-blue-400" },
    emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-400" },
    amber: { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-400" },
    cyan: { bg: "bg-cyan-500/10", border: "border-cyan-500/20", text: "text-cyan-400" },
    purple: { bg: "bg-purple-500/10", border: "border-purple-500/20", text: "text-purple-400" },
  };

  return (
    <section id="features" className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-transparent via-violet-500/5 to-transparent" />

      <ScrollReveal className="relative mx-auto max-w-3xl text-center">
        <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-sm font-medium text-violet-300">
          Features
        </span>
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          All the essentials—beautifully integrated
        </h2>
        <p className="mt-4 text-lg text-white/60">
          Everything your school needs to run smoothly, in one fast platform.
        </p>
      </ScrollReveal>

      <StaggerContainer className="relative mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" staggerDelay={0.08}>
        {features.map((f) => {
          const colors = colorClasses[f.color];
          return (
            <StaggerItem key={f.title}>
              <article className="group relative rounded-2xl border border-white/10 bg-neutral-900/50 p-6 transition-all duration-300 hover:border-white/20 hover:bg-neutral-900/80 hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5">
                <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl border ${colors.bg} ${colors.border} mb-4`}>
                  <span className={colors.text}>{f.icon}</span>
                </div>
                <h3 className="text-lg font-semibold text-white">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">{f.body}</p>
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
        <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-sm font-medium text-emerald-300">
          How it works
        </span>
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Launch in days, not months
        </h2>
        <p className="mt-4 text-lg text-white/60">
          We guide you end-to-end. Start with a live demo, and go live quickly.
        </p>
      </ScrollReveal>

      <StaggerContainer className="mt-12 grid gap-6 md:grid-cols-3" staggerDelay={0.15}>
        {steps.map((s, i) => (
          <StaggerItem key={s.n} variant="scaleIn">
            <div className="relative rounded-2xl border border-white/10 bg-neutral-900/50 p-6 transition-all duration-300 hover:border-white/20 hover:bg-neutral-900/80 sm:p-8">
              {i < steps.length - 1 && (
                <div className="absolute -right-3 top-1/2 hidden h-px w-6 bg-linear-to-r from-violet-500/50 to-transparent md:block" />
              )}
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-linear-to-br from-violet-500 to-purple-600 text-lg font-bold text-white shadow-lg shadow-violet-500/25">
                {s.n}
              </div>
              <h3 className="mt-5 text-lg font-semibold text-white">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/60">{s.body}</p>
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
          <div className="rounded-2xl border border-white/10 bg-linear-to-br from-neutral-900 to-neutral-950 p-6 sm:p-8">
            <h3 className="mb-6 text-lg font-semibold text-white">Key Metrics</h3>
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
  const colorClasses: Record<string, string> = { emerald: "text-emerald-400", violet: "text-violet-400", blue: "text-blue-400" };
  return (
    <div className="flex items-center justify-between border-b border-white/5 py-3 last:border-none">
      <div className="text-sm text-white/60">{label}</div>
      <div className={`text-lg font-bold ${colorClasses[color]}`}>{value}</div>
    </div>
  );
}

function Testimonial({ quote, author, avatar }: { quote: string; author: string; avatar: string }) {
  return (
    <blockquote className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-neutral-900 to-neutral-950 p-6 sm:p-8">
      <svg className="absolute right-4 top-4 h-12 w-12 text-violet-500/10" fill="currentColor" viewBox="0 0 24 24">
        <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
      </svg>
      <div className="relative">
        <p className="text-base leading-relaxed text-white/80">&ldquo;{quote}&rdquo;</p>
        <footer className="mt-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-br from-violet-500 to-purple-600 text-sm font-bold text-white">
            {avatar}
          </div>
          <div className="text-sm text-white/50">— {author}</div>
        </footer>
      </div>
    </blockquote>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━ INTEGRATIONS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function MoMoLogo() {
  return (
    <svg className="h-8 w-8" viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="10" fill="#FFCB05" />
      <text x="24" y="20" textAnchor="middle" fill="#000" fontSize="8" fontWeight="800" fontFamily="Arial, sans-serif">MTN</text>
      <text x="24" y="33" textAnchor="middle" fill="#000" fontSize="9" fontWeight="700" fontFamily="Arial, sans-serif">MoMo</text>
    </svg>
  );
}

function TelecelLogo() {
  return (
    <svg className="h-8 w-8" viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="10" fill="#E30613" />
      <text x="24" y="28" textAnchor="middle" fill="#FFF" fontSize="9" fontWeight="800" fontFamily="Arial, sans-serif">TC</text>
    </svg>
  );
}

function ATMoneyLogo() {
  return (
    <svg className="h-8 w-8" viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="10" fill="#003DA5" />
      <rect y="30" width="48" height="18" rx="0" fill="#E4002B" />
      <text x="24" y="26" textAnchor="middle" fill="#FFF" fontSize="16" fontWeight="900" fontFamily="Arial, sans-serif">AT</text>
    </svg>
  );
}

function WhatsAppLogo() {
  return (
    <svg className="h-8 w-8" viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="10" fill="#25D366" />
      <path d="M34.6 28.4c-.5-.2-2.8-1.4-3.3-1.5-.4-.2-.7-.2-1 .2-.3.5-1.2 1.5-1.5 1.8-.3.3-.5.3-1 .1-.5-.2-2-.7-3.8-2.4-1.4-1.3-2.4-2.8-2.6-3.3-.3-.5 0-.7.2-1 .2-.2.5-.5.7-.8.2-.3.3-.5.5-.8.2-.3.1-.6 0-.8-.1-.2-1-2.6-1.5-3.5-.4-.9-.8-.8-1-.8h-.9c-.3 0-.8.1-1.3.6-.4.5-1.7 1.6-1.7 4s1.7 4.6 2 4.9c.2.3 3.3 5.1 8.1 7.2 1.1.5 2 .8 2.7 1 1.1.4 2.2.3 3 .2.9-.1 2.8-1.2 3.2-2.3.4-1.1.4-2 .3-2.3-.1-.2-.4-.3-.9-.5m-8.6 11.8c-3.4 0-6.7-1.2-9.3-3.4l-.7-.4-6 1.6 1.6-5.8-.5-.7c-2.4-3.9-3.7-8.4-3.7-13 0-13.4 10.9-24.2 24.3-24.2 6.5 0 12.6 2.5 17.1 7.1s7.1 10.7 7.1 17.2c0 13.4-10.9 24.3-24.3 24.3" transform="scale(0.5) translate(13, 11)" fill="#FFF" />
    </svg>
  );
}

function Integrations() {
  const items: { name: string; desc: string; logo: React.ReactNode; category: string; comingSoon?: boolean }[] = [
    { name: "MTN MoMo", desc: "Mobile money collections", logo: <MoMoLogo />, category: "Payments" },
    { name: "Telecel Cash", desc: "Mobile money payments", logo: <TelecelLogo />, category: "Payments" },
    { name: "AT Money", desc: "Mobile money coverage", logo: <ATMoneyLogo />, category: "Payments" },
    { name: "WhatsApp", desc: "Parent messaging", logo: <WhatsAppLogo />, category: "Messaging", comingSoon: true },
  ];

  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <ScrollReveal>
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-neutral-900 to-neutral-950 p-8 sm:p-10">
          <div className="mx-auto max-w-2xl text-center">
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-sm font-medium text-blue-300">
              Integrations
            </span>
            <h3 className="text-2xl font-bold text-white sm:text-3xl">Works with your tools</h3>
            <p className="mt-3 text-white/60">
              Mobile money payments and parent messaging that fit your school&apos;s workflow.
            </p>
          </div>

          <div className="mx-auto mt-8 flex max-w-sm justify-center gap-6">
            <div className="flex items-center gap-2 text-xs font-medium text-white/40">
              <span className="h-2 w-2 rounded-full bg-violet-500" />
              Payments
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-white/40">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Messaging
            </div>
          </div>

          <StaggerContainer
            className="mx-auto mt-8 grid max-w-3xl grid-cols-2 gap-5 sm:grid-cols-4"
            staggerDelay={0.08}
          >
            {items.map((x) => (
              <StaggerItem key={x.name} variant="scaleIn">
                <div className="group relative rounded-2xl border border-white/10 bg-white/5 p-6 text-center transition-all duration-300 hover:border-white/20 hover:bg-white/10 hover:shadow-lg hover:shadow-black/20 hover:-translate-y-1">
                  {x.comingSoon && (
                    <span className="absolute right-2.5 top-2.5 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                      Soon
                    </span>
                  )}
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/5">
                    {x.logo}
                  </div>
                  <div className="text-sm font-semibold text-white">
                    {x.name}
                  </div>
                  <div className="mt-1 text-[11px] text-white/40">{x.desc}</div>
                  <div className="mt-2.5">
                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${x.category === "Payments" ? "bg-violet-500" : "bg-emerald-500"}`} />
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </ScrollReveal>
    </section>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━ PRICING TEASER ━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function PricingTeaser() {
  return (
    <section id="pricing" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <ScrollReveal className="mx-auto mb-12 max-w-3xl text-center">
        <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-sm font-medium text-amber-300">
          Pricing
        </span>
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Simple, transparent pricing
        </h2>
        <p className="mt-4 text-lg text-white/60">Choose the plan that works for your school. No hidden fees.</p>
      </ScrollReveal>

      <StaggerContainer className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2" staggerDelay={0.15}>
        {/* Basic Plan */}
        <StaggerItem variant="slideRight">
          <div className="rounded-2xl border border-white/10 bg-neutral-900/50 p-6 transition-all duration-300 hover:border-white/20 sm:p-8">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white">Basic</h3>
            </div>
            <ul className="mb-6 space-y-3">
              {["Fees & Installments", "Student Records & Notices", "Timetables", "MoMo + Paystack"].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-white/70">
                  <svg className="h-5 w-5 shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
            <Link href="/enroll" className="block w-full rounded-xl bg-white/10 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-white/20">
              Enrol your school
            </Link>
          </div>
        </StaggerItem>

        {/* Premium Plan */}
        <StaggerItem variant="slideLeft">
          <div className="relative overflow-hidden rounded-2xl border border-violet-500/30 bg-linear-to-br from-violet-500/10 to-purple-500/5 p-6 transition-all duration-300 hover:border-violet-500/40 sm:p-8">
            <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-violet-500/20 blur-2xl" />
            <div className="relative">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25">
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white">Premium</h3>
                <span className="rounded-full border border-violet-500/30 bg-violet-500/20 px-2.5 py-0.5 text-xs font-medium text-violet-300">
                  Popular
                </span>
              </div>
              <ul className="mb-6 space-y-3">
                {["Everything in Basic", "Advanced Analytics", "EduAI Assistant", "Priority Support"].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-white/70">
                    <svg className="h-5 w-5 shrink-0 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/enroll" className="block w-full rounded-xl bg-linear-to-r from-violet-500 to-purple-600 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:shadow-violet-500/40">
                Contact us
              </Link>
            </div>
          </div>
        </StaggerItem>
      </StaggerContainer>
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
    { q: "Is there a free trial?", a: "Contact us for more information about trial access and pricing options." },
  ];

  return (
    <section id="faq" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <ScrollReveal className="mx-auto mb-12 max-w-3xl text-center">
        <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-sm font-medium text-cyan-300">
          FAQ
        </span>
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Frequently asked questions
        </h2>
        <p className="mt-4 text-lg text-white/60">Short answers to common questions.</p>
      </ScrollReveal>

      <StaggerContainer className="mx-auto grid max-w-4xl gap-4 md:grid-cols-2" staggerDelay={0.06}>
        {faqs.map((f) => (
          <StaggerItem key={f.q}>
            <div className="rounded-2xl border border-white/10 bg-neutral-900/50 p-6 transition-all duration-300 hover:border-white/20 hover:bg-neutral-900/80">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-cyan-500/20 bg-cyan-500/10">
                  <span className="text-xs font-bold text-cyan-400">?</span>
                </div>
                <div>
                  <div className="font-semibold text-white">{f.q}</div>
                  <p className="mt-2 text-sm leading-relaxed text-white/60">{f.a}</p>
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
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-linear-to-br from-neutral-900 to-neutral-950 p-8 text-center sm:p-12 md:p-16">
          <div className="absolute left-1/2 top-0 h-32 w-96 -translate-x-1/2 rounded-full bg-violet-500/20 blur-3xl" />
          <div className="relative">
            <h3 className="text-3xl font-bold text-white sm:text-4xl">
              Ready to modernize your school?
            </h3>
            <p className="mx-auto mt-4 max-w-xl text-lg text-white/60">
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
              <Link href="/sign-in" className="rounded-xl border border-white/10 bg-white/5 px-8 py-4 font-semibold text-white transition-all hover:border-white/20 hover:bg-white/10">
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━ FOOTER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function Footer() {
  return (
    <footer className="border-t border-white/10 bg-neutral-950">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 text-sm sm:grid-cols-2 sm:px-6 md:grid-cols-4 lg:px-8">
        <div>
          <div className="inline-flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-linear-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/20">
              <span className="text-lg font-bold text-white">E</span>
            </div>
            <span className="text-lg font-semibold tracking-tight text-white">EduSentrix</span>
          </div>
          <p className="mt-4 leading-relaxed text-white/50">
            Built by Appsentrix for schools in Ghana & Africa.
          </p>
          <div className="mt-4 flex gap-3">
            <a href="#" className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 transition-colors hover:bg-white/10">
              <svg className="h-4 w-4 text-white/60" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" />
              </svg>
            </a>
            <a href="#" className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 transition-colors hover:bg-white/10">
              <svg className="h-4 w-4 text-white/60" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
              </svg>
            </a>
          </div>
        </div>

        <div>
          <div className="mb-4 font-semibold text-white">Product</div>
          <ul className="space-y-3 text-white/50">
            <li><a href="#features" className="transition-colors hover:text-white">Features</a></li>
            <li><a href="#pricing" className="transition-colors hover:text-white">Pricing</a></li>
            <li><a href="#faq" className="transition-colors hover:text-white">FAQ</a></li>
          </ul>
        </div>

        <div>
          <div className="mb-4 font-semibold text-white">Company</div>
          <ul className="space-y-3 text-white/50">
            <li><Link href="/about" className="transition-colors hover:text-white">About</Link></li>
            <li><Link href="/careers" className="transition-colors hover:text-white">Careers</Link></li>
            <li><Link href="/contact" className="transition-colors hover:text-white">Contact</Link></li>
          </ul>
        </div>

        <div>
          <div className="mb-4 font-semibold text-white">Legal</div>
          <ul className="space-y-3 text-white/50">
            <li><Link href="/terms" className="transition-colors hover:text-white">Terms</Link></li>
            <li><Link href="/privacy" className="transition-colors hover:text-white">Privacy</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/5">
        <div className="mx-auto max-w-7xl px-4 py-6 text-center text-sm text-white/40 sm:px-6 lg:px-8">
          © {new Date().getFullYear()} Appsentrix. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
