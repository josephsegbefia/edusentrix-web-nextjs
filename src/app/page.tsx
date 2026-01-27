// src/app/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

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

/* ----------------------------- NAV ----------------------------- */
function SiteNav() {
  return (
    <header className="sticky top-0 z-50 bg-neutral-950/80 backdrop-blur-xl border-b border-white/5">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-2.5 group">
          <div className="size-9 rounded-xl bg-linear-to-br from-violet-500 to-purple-600 grid place-items-center shadow-lg shadow-violet-500/20">
            <span className="text-white font-bold text-lg">E</span>
          </div>
          <span className="font-semibold text-lg tracking-tight text-white group-hover:text-violet-300 transition-colors">
            EduSentrix
          </span>
        </Link>
        <nav className="hidden lg:flex items-center gap-8 text-sm font-medium">
          <a href="#features" className="text-white/60 hover:text-white transition-colors">
            Features
          </a>
          <a href="#how" className="text-white/60 hover:text-white transition-colors">
            How it works
          </a>
          <a href="#pricing" className="text-white/60 hover:text-white transition-colors">
            Pricing
          </a>
          <a href="#faq" className="text-white/60 hover:text-white transition-colors">
            FAQ
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/sign-in"
            className="hidden sm:inline-flex px-4 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 transition-all"
          >
            Sign in
          </Link>
          <Link
            href="/enroll"
            className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-linear-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:scale-[1.02] transition-all"
          >
            Enrol your school
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ----------------------------- HERO ---------------------------- */
function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      {/* Premium gradient background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(139, 92, 246, 0.3) 0%, transparent 50%), radial-gradient(ellipse 60% 40% at 80% 60%, rgba(168, 85, 247, 0.15) 0%, transparent 50%), radial-gradient(ellipse 50% 30% at 20% 80%, rgba(139, 92, 246, 0.1) 0%, transparent 50%)",
        }}
      />
      {/* Animated gradient orbs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -right-40 w-96 h-96 rounded-full bg-violet-500/20 blur-3xl animate-pulse"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-purple-500/15 blur-3xl animate-pulse"
        style={{ animationDelay: "1s" }}
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 md:py-28 lg:py-32">
        <div className="grid lg:grid-cols-2 items-center gap-12 lg:gap-16">
          {/* Left Content */}
          <div className="text-center lg:text-left">
            <span className="inline-flex items-center gap-2.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-sm font-medium text-emerald-300 backdrop-blur-sm">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
              </span>
              Now onboarding schools in Ghana
            </span>

            <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight bg-linear-to-br from-white via-white to-white/60 bg-clip-text text-transparent leading-[1.1]">
              Collect fees, run operations, and{" "}
              <span className="bg-linear-to-r from-violet-400 to-purple-400 bg-clip-text">
                delight parents
              </span>
              —on one platform.
            </h1>
            <p className="mt-6 text-lg text-white/60 max-w-xl mx-auto lg:mx-0 leading-relaxed">
              EduSentrix is the modern school OS for Africa: web + mobile,
              Mobile Money and Paystack ready, fast onboarding, and optional AI
              to automate the boring stuff.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link
                href="/enroll"
                className="group px-6 py-3.5 rounded-xl font-semibold bg-linear-to-r from-violet-500 to-purple-600 text-white text-sm shadow-xl shadow-violet-500/25 hover:shadow-violet-500/40 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
              >
                Enrol your school
                <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <a
                href="#how"
                className="px-6 py-3.5 rounded-xl font-semibold text-sm border border-white/10 bg-white/5 text-white hover:bg-white/10 hover:border-white/20 transition-all flex items-center justify-center gap-2 backdrop-blur-sm"
              >
                <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                See how it works
              </a>
            </div>

            <div className="mt-10 grid grid-cols-3 gap-4">
              <Stat label="Students managed" value="10k+" />
              <Stat label="Avg. setup time" value="< 1 day" />
              <Stat label="Payout methods" value="MoMo + Bank" />
            </div>
          </div>

          {/* Right - Dashboard Screenshot */}
          <div className="relative">
            {/* Glow behind the screenshot */}
            <div className="absolute inset-0 bg-linear-to-r from-violet-500/20 to-purple-500/20 rounded-3xl blur-2xl scale-95" />
            
            {/* Main screenshot container */}
            <div className="relative rounded-2xl lg:rounded-3xl border border-white/10 bg-neutral-900/80 backdrop-blur-xl overflow-hidden shadow-2xl shadow-black/50">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-neutral-900/50">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <div className="flex-1 mx-4">
                  <div className="h-6 bg-neutral-800 rounded-md flex items-center px-3">
                    <span className="text-xs text-white/40">app.edusentrix.com/admin</span>
                  </div>
                </div>
              </div>
              
              {/* Screenshot */}
              <div className="relative aspect-16/10">
                <Image
                  src="/dashboard.png"
                  alt="EduSentrix Dashboard"
                  fill
                  className="object-cover object-top"
                  priority
                />
              </div>
            </div>

            {/* Floating analytics card */}
            <div className="absolute -bottom-4 -left-4 sm:-bottom-6 sm:-left-6 rounded-xl bg-neutral-900/95 backdrop-blur-xl px-4 py-3 border border-white/10 shadow-xl shadow-black/30 hidden sm:block">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-linear-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs text-white/50">Collections this term</div>
                  <div className="text-lg font-bold text-white">GH₵ 128,450</div>
                </div>
              </div>
            </div>

            {/* Floating notification card */}
            <div className="absolute -top-4 -right-4 sm:-top-6 sm:-right-6 rounded-xl bg-neutral-900/95 backdrop-blur-xl px-4 py-3 border border-white/10 shadow-xl shadow-black/30 hidden md:block">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-linear-to-br from-violet-500/20 to-violet-500/5 border border-violet-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs font-medium text-white">12 new payments</div>
                  <div className="text-[10px] text-white/40">Just now</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-4 backdrop-blur-sm hover:bg-white/8 transition-colors">
      <div className="text-xl sm:text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-white/50 mt-1">{label}</div>
    </div>
  );
}

/* ----------------------- PAIN → SOLUTION ----------------------- */
function PainSolution() {
  return (
    <section className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
      <div className="grid md:grid-cols-2 gap-6">
        {/* Pain Card */}
        <div className="relative rounded-2xl border border-red-500/20 bg-linear-to-br from-red-500/5 to-transparent p-6 sm:p-8 overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-2xl" />
          <div className="relative">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 mb-4">
              <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white">What schools struggle with</h2>
            <ul className="mt-5 space-y-3">
              {[
                "Manual fee tracking and poor visibility",
                "Fragmented tools for notices, records, and timetables",
                "Slow reconciliation between MoMo, bank, and ledgers",
                "Parents miss updates; admin time wasted"
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-white/60">
                  <svg className="w-5 h-5 text-red-400/70 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Solution Card */}
        <div className="relative rounded-2xl border border-emerald-500/20 bg-linear-to-br from-emerald-500/5 to-transparent p-6 sm:p-8 overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl" />
          <div className="relative">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 mb-4">
              <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white">How EduSentrix solves it</h2>
            <ul className="mt-5 space-y-3">
              {[
                "Smart fee + installment plans with automated reminders",
                "Unified records, notices, and timetable management",
                "Reconciliation tools; Paystack + MoMo integrations",
                "Parent web + mobile app with real-time updates"
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-white/60">
                  <svg className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------- FEATURES -------------------------- */
function FeatureGrid() {
  const features = [
    {
      title: "Fees & Installments",
      body: "Set due dates, auto-generate schedules, send reminders, and track payments.",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: "violet",
    },
    {
      title: "Student Records",
      body: "Clean profiles, enrollment data, classes, and guardians—always in sync.",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      color: "blue",
    },
    {
      title: "Timetables",
      body: "Conflict-free scheduling with versioning and teacher/class views.",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      color: "emerald",
    },
    {
      title: "Notices & Announcements",
      body: "School-wide or class-specific updates with push/email and read receipts.",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
        </svg>
      ),
      color: "amber",
    },
    {
      title: "Analytics",
      body: "Collections, arrears, engagement—make decisions with confidence.",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      color: "cyan",
    },
    {
      title: "EduAI (Premium)",
      body: "Generate notices, summarize dashboards, and automate repetitive tasks.",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
    <section id="features" className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-linear-to-b from-transparent via-violet-500/5 to-transparent pointer-events-none" />
      
      <div className="relative text-center max-w-3xl mx-auto">
        <span className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-sm font-medium text-violet-300 mb-4">
          Features
        </span>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
          All the essentials—beautifully integrated
        </h2>
        <p className="mt-4 text-lg text-white/60">
          Everything your school needs to run smoothly, in one fast platform.
        </p>
      </div>

      <div className="relative mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {features.map((f) => {
          const colors = colorClasses[f.color];
          return (
            <article
              key={f.title}
              className="group relative rounded-2xl border border-white/10 bg-neutral-900/50 p-6 hover:border-white/20 hover:bg-neutral-900/80 transition-all duration-300"
            >
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${colors.bg} ${colors.border} border mb-4`}>
                <span className={colors.text}>{f.icon}</span>
              </div>
              <h3 className="text-lg font-semibold text-white">{f.title}</h3>
              <p className="mt-2 text-sm text-white/60 leading-relaxed">{f.body}</p>
              <a
                href="#"
                className={`mt-4 inline-flex items-center gap-1 text-sm ${colors.text} font-medium hover:gap-2 transition-all`}
              >
                Learn more
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/* ----------------------- HOW IT WORKS ------------------------- */
function HowItWorks() {
  const steps = [
    {
      n: "1",
      title: "Invite & Onboard",
      body: "We provision your school, create admin accounts, and import your data.",
    },
    {
      n: "2",
      title: "Set Up Fees & Comms",
      body: "Define fee plans, connect Paystack/MoMo, and set up notices & timetables.",
    },
    {
      n: "3",
      title: "Launch to Parents",
      body: "Share links; parents log in with OTP. Collect payments and track progress.",
    },
  ];
  return (
    <section id="how" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
      <div className="text-center max-w-3xl mx-auto">
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-sm font-medium text-emerald-300 mb-4">
          How it works
        </span>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
          Launch in days, not months
        </h2>
        <p className="mt-4 text-lg text-white/60">
          We guide you end-to-end. Start with a live demo, and go live quickly.
        </p>
      </div>

      <div className="mt-12 grid md:grid-cols-3 gap-6">
        {steps.map((s, i) => (
          <div
            key={s.n}
            className="relative rounded-2xl border border-white/10 bg-neutral-900/50 p-6 sm:p-8"
          >
            {/* Connector line */}
            {i < steps.length - 1 && (
              <div className="hidden md:block absolute top-1/2 -right-3 w-6 h-px bg-linear-to-r from-violet-500/50 to-transparent" />
            )}
            <div className="w-12 h-12 rounded-xl bg-linear-to-br from-violet-500 to-purple-600 text-white grid place-items-center font-bold text-lg shadow-lg shadow-violet-500/25">
              {s.n}
            </div>
            <h3 className="mt-5 text-lg font-semibold text-white">{s.title}</h3>
            <p className="mt-2 text-sm text-white/60 leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ----------------- METRICS + TESTIMONIALS --------------------- */
function MetricsTestimonials() {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
      <div className="grid md:grid-cols-3 gap-6">
        <div className="rounded-2xl border border-white/10 bg-linear-to-br from-neutral-900 to-neutral-950 p-6 sm:p-8">
          <h3 className="text-lg font-semibold text-white mb-6">Key Metrics</h3>
          <div className="space-y-4">
            <MetricLine label="Avg. on-time payments" value="+35%" color="emerald" />
            <MetricLine label="Setup time" value="< 1 day" color="violet" />
            <MetricLine label="System uptime" value="99.9%" color="blue" />
          </div>
        </div>
        <Testimonial
          quote="Collections are now predictable, and parents never miss notices."
          author="Headteacher, Achimota area"
          avatar="HT"
        />
        <Testimonial
          quote="Reconciliation used to take days—now it's minutes."
          author="Bursar, Cape Coast"
          avatar="BC"
        />
      </div>
    </section>
  );
}

function MetricLine({ label, value, color }: { label: string; value: string; color: string }) {
  const colorClasses: Record<string, string> = {
    emerald: "text-emerald-400",
    violet: "text-violet-400",
    blue: "text-blue-400",
  };
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-none">
      <div className="text-sm text-white/60">{label}</div>
      <div className={`text-lg font-bold ${colorClasses[color]}`}>{value}</div>
    </div>
  );
}

function Testimonial({ quote, author, avatar }: { quote: string; author: string; avatar: string }) {
  return (
    <blockquote className="relative rounded-2xl border border-white/10 bg-linear-to-br from-neutral-900 to-neutral-950 p-6 sm:p-8 overflow-hidden">
      <svg className="absolute top-4 right-4 w-12 h-12 text-violet-500/10" fill="currentColor" viewBox="0 0 24 24">
        <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
      </svg>
      <div className="relative">
        <p className="text-base text-white/80 leading-relaxed">&ldquo;{quote}&rdquo;</p>
        <footer className="mt-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-linear-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
            {avatar}
          </div>
          <div className="text-sm text-white/50">— {author}</div>
        </footer>
      </div>
    </blockquote>
  );
}

/* ------------------------- INTEGRATIONS ----------------------- */
function Integrations() {
  const items = [
    { name: "Paystack", icon: "💳" },
    { name: "MTN MoMo", icon: "📱" },
    { name: "Vodafone Cash", icon: "📲" },
    { name: "AirtelTigo", icon: "📞" },
    { name: "Brevo", icon: "✉️" },
    { name: "Termii", icon: "💬" },
    { name: "Google Calendar", icon: "📅" },
  ];
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
      <div className="rounded-2xl border border-white/10 bg-linear-to-br from-neutral-900 to-neutral-950 p-8 sm:p-10">
        <div className="text-center max-w-2xl mx-auto">
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-sm font-medium text-blue-300 mb-4">
            Integrations
          </span>
          <h3 className="text-2xl font-bold text-white">Works with your tools</h3>
          <p className="mt-3 text-white/60">
            Payments, messaging, and scheduling that fit your school&apos;s workflow.
          </p>
        </div>
        <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
          {items.map((x) => (
            <div
              key={x.name}
              className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-4 text-center transition-all hover:border-white/20 group"
            >
              <div className="text-2xl mb-2">{x.icon}</div>
              <div className="text-xs text-white/70 group-hover:text-white transition-colors font-medium">
                {x.name}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------- PRICING TEASER ----------------------- */
function PricingTeaser() {
  return (
    <section id="pricing" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
      <div className="text-center max-w-3xl mx-auto mb-12">
        <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-sm font-medium text-amber-300 mb-4">
          Pricing
        </span>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
          Simple, transparent pricing
        </h2>
        <p className="mt-4 text-lg text-white/60">
          Choose the plan that works for your school. No hidden fees.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {/* Basic Plan */}
        <div className="rounded-2xl border border-white/10 bg-neutral-900/50 p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white">Basic</h3>
          </div>
          <ul className="space-y-3 mb-6">
            {["Fees & Installments", "Student Records & Notices", "Timetables", "MoMo + Paystack"].map((item) => (
              <li key={item} className="flex items-center gap-3 text-sm text-white/70">
                <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
          <Link
            href="/enroll"
            className="block w-full py-3 rounded-xl font-semibold text-sm text-center bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            Enrol your school
          </Link>
        </div>

        {/* Premium Plan */}
        <div className="relative rounded-2xl border border-violet-500/30 bg-linear-to-br from-violet-500/10 to-purple-500/5 p-6 sm:p-8 overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/20 rounded-full blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-linear-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white">Premium</h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-violet-500/20 text-violet-300 border border-violet-500/30">
                Popular
              </span>
            </div>
            <ul className="space-y-3 mb-6">
              {["Everything in Basic", "Advanced Analytics", "EduAI Assistant", "Priority Support"].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-white/70">
                  <svg className="w-5 h-5 text-violet-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href="/enroll"
              className="block w-full py-3 rounded-xl font-semibold text-sm text-center bg-linear-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all"
            >
              Contact us
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- FAQ ---------------------------- */
function FAQ() {
  const faqs = [
    {
      q: "How do payouts work?",
      a: "We integrate with Paystack and Mobile Money. Funds settle into your chosen bank or MoMo wallet per your payout settings.",
    },
    {
      q: "How long is setup?",
      a: "Most schools go live in under one day. We help import your data and configure fee plans.",
    },
    {
      q: "Do parents need to install an app?",
      a: "Parents can use web or mobile. OTP sign-in—no passwords needed.",
    },
    {
      q: "Who owns the data?",
      a: "You do. We act as your processor and provide secure access and exports anytime.",
    },
    {
      q: "Is there a free trial?",
      a: "Contact us for more information about trial access and pricing options.",
    },
  ];
  return (
    <section id="faq" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
      <div className="text-center max-w-3xl mx-auto mb-12">
        <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-sm font-medium text-cyan-300 mb-4">
          FAQ
        </span>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
          Frequently asked questions
        </h2>
        <p className="mt-4 text-lg text-white/60">
          Short answers to common questions.
        </p>
      </div>
      <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto">
        {faqs.map((f) => (
          <div
            key={f.q}
            className="rounded-2xl border border-white/10 bg-neutral-900/50 p-6 hover:border-white/20 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-cyan-400 text-xs font-bold">?</span>
              </div>
              <div>
                <div className="font-semibold text-white">{f.q}</div>
                <p className="mt-2 text-sm text-white/60 leading-relaxed">{f.a}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* -------------------------- FINAL CTA ------------------------- */
function FinalCTA() {
  return (
    <section className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(139, 92, 246, 0.15) 0%, transparent 60%)",
        }}
      />
      <div className="relative rounded-3xl bg-linear-to-br from-neutral-900 to-neutral-950 border border-white/10 p-8 sm:p-12 md:p-16 text-center overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-32 bg-violet-500/20 rounded-full blur-3xl" />
        
        <div className="relative">
          <h3 className="text-3xl sm:text-4xl font-bold text-white">
            Ready to modernize your school?
          </h3>
          <p className="mt-4 text-lg text-white/60 max-w-xl mx-auto">
            Get started today. See fees, notices, timetables, and
            parent experience in action.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/enroll"
              className="group px-8 py-4 rounded-xl font-semibold bg-linear-to-r from-violet-500 to-purple-600 text-white shadow-xl shadow-violet-500/25 hover:shadow-violet-500/40 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
            >
              Enrol your school
              <svg className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <Link
              href="/sign-in"
              className="px-8 py-4 rounded-xl font-semibold border border-white/10 bg-white/5 text-white hover:bg-white/10 hover:border-white/20 transition-all"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------- FOOTER -------------------------- */
function Footer() {
  return (
    <footer className="border-t border-white/10 bg-neutral-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 grid sm:grid-cols-2 md:grid-cols-4 gap-8 text-sm">
        <div>
          <div className="inline-flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-linear-to-br from-violet-500 to-purple-600 grid place-items-center shadow-lg shadow-violet-500/20">
              <span className="text-white font-bold text-lg">E</span>
            </div>
            <span className="font-semibold text-lg tracking-tight text-white">
              EduSentrix
            </span>
          </div>
          <p className="mt-4 text-white/50 leading-relaxed">
            Built by Appsentrix for schools in Ghana & Africa.
          </p>
          <div className="mt-4 flex gap-3">
            <a href="#" className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
              <svg className="w-4 h-4 text-white/60" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/>
              </svg>
            </a>
            <a href="#" className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
              <svg className="w-4 h-4 text-white/60" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
              </svg>
            </a>
          </div>
        </div>

        <div>
          <div className="font-semibold text-white mb-4">Product</div>
          <ul className="space-y-3 text-white/50">
            <li>
              <a href="#features" className="hover:text-white transition-colors">
                Features
              </a>
            </li>
            <li>
              <a href="#pricing" className="hover:text-white transition-colors">
                Pricing
              </a>
            </li>
            <li>
              <a href="#faq" className="hover:text-white transition-colors">
                FAQ
              </a>
            </li>
          </ul>
        </div>

        <div>
          <div className="font-semibold text-white mb-4">Company</div>
          <ul className="space-y-3 text-white/50">
            <li>
              <Link href="/about" className="hover:text-white transition-colors">
                About
              </Link>
            </li>
            <li>
              <Link href="/careers" className="hover:text-white transition-colors">
                Careers
              </Link>
            </li>
            <li>
              <Link href="/contact" className="hover:text-white transition-colors">
                Contact
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <div className="font-semibold text-white mb-4">Legal</div>
          <ul className="space-y-3 text-white/50">
            <li>
              <Link href="/terms" className="hover:text-white transition-colors">
                Terms
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="hover:text-white transition-colors">
                Privacy
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/5">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 text-center text-sm text-white/40">
          © {new Date().getFullYear()} Appsentrix. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
