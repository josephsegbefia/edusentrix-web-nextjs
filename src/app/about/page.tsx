import type { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  BookOpen,
  Check,
  CreditCard,
  GraduationCap,
  Mail,
  MessageSquare,
  Shield,
  Smartphone,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import { EduSentrixWordmark } from "@/components/brand/EduSentrixWordmark";
import { PublicMarketingFooter } from "@/components/marketing/PublicMarketingFooter";
import { PublicMarketingNav } from "@/components/marketing/PublicMarketingNav";
import { EDUSENTRIX_WORDMARK_GRADIENT_STYLE } from "@/lib/branding";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "About — EduSentrix",
  description:
    "EduSentrix is the school operating system for Ghana, with EduSentrix Learn for student learning. Built by Appsentrix.",
};

const CONTACT_EMAIL = "hello@tryedusentrix.app";

const PRINCIPLES = [
  {
    icon: Shield,
    title: "Schools own their data",
    body: "Your records stay yours. EduSentrix helps you run operations securely, with access and exports when you need them.",
    accent: "border-violet-500/25 text-violet-300",
    glow: "from-violet-500/15 to-transparent",
  },
  {
    icon: Wallet,
    title: "Built for how schools collect fees",
    body: "Term plans, installments, reminders, and reconciliation — aligned with how Ghanaian schools actually bill families.",
    accent: "border-emerald-500/25 text-emerald-300",
    glow: "from-emerald-500/15 to-transparent",
  },
  {
    icon: Users,
    title: "One platform, not ten tabs",
    body: "Fees, records, timetables, notices, and communications in one place instead of scattered spreadsheets and chats.",
    accent: "border-cyan-500/25 text-cyan-300",
    glow: "from-cyan-500/15 to-transparent",
  },
  {
    icon: MessageSquare,
    title: "Parents stay in the loop",
    body: "Clear fee status and school updates through web and mobile — so families are informed without chasing admins.",
    accent: "border-amber-500/25 text-amber-300",
    glow: "from-amber-500/15 to-transparent",
  },
] as const;

const AUDIENCES = [
  {
    icon: GraduationCap,
    title: "School leadership",
    body: "Visibility across enrollment, academics, finance, and daily operations.",
  },
  {
    icon: CreditCard,
    title: "Bursars & finance",
    body: "Receivables, payments, balances, and reconciliation in a serious finance workflow.",
  },
  {
    icon: BookOpen,
    title: "Teachers",
    body: "Class tools, lesson workflows, schedules, and communication tied to real timetables.",
  },
  {
    icon: Smartphone,
    title: "Parents",
    body: "Fees, notices, and student context through a dedicated parent sign-in.",
  },
] as const;

const SCHOOL_OS_PILLARS = [
  "Fee plans, installments, and payment tracking",
  "Student records, classes, and guardian links",
  "Timetables, notices, and school communications",
  "Mobile money and card collections reconciled to one ledger",
] as const;

const LEARN_FEATURES = [
  "Connected to lessons taught in school",
  "Class assignments and structured practice",
  "Self-paced revision and exam preparation",
  "A dedicated student experience separate from admin workflows",
] as const;

function SectionCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-white/10 bg-linear-to-br from-neutral-900/90 via-neutral-950 to-black p-6 shadow-2xl shadow-black/30 sm:rounded-3xl sm:p-8",
        className,
      )}
    >
      {children}
    </section>
  );
}

export default function AboutPage() {
  return (
    <main className="min-h-dvh bg-neutral-950 text-white antialiased">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-linear-to-br from-slate-950 via-neutral-950 to-black"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 45% at 50% 0%, rgba(139,92,246,0.18) 0%, transparent 55%), radial-gradient(ellipse 50% 35% at 90% 70%, rgba(6,182,212,0.08) 0%, transparent 50%)",
        }}
      />

      <div className="relative">
        <PublicMarketingNav active="about" />

        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          {/* Hero */}
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/70">
              About <EduSentrixWordmark className="text-xs uppercase tracking-[0.18em]" />
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
              The school operating system for Ghana — built to scale across Africa
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-white/65">
              <EduSentrixWordmark /> helps schools collect fees, run daily operations, and keep
              parents informed — on web and mobile, with payments and records in one place.
            </p>
            <p className="mt-4 text-base leading-relaxed text-white/50">
              We are starting in Ghana because that is where school operations, mobile money, and
              parent communication needs are clearest — and we are building for African schools
              more broadly as we grow.
            </p>
          </div>

          {/* Mission */}
          <SectionCard className="mt-12">
            <h2 className="text-2xl font-semibold tracking-tight text-white">Why we built this</h2>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-white/65">
              Too many schools still juggle spreadsheets, separate messaging tools, and manual fee
              follow-ups. Reconciliation between mobile money, bank deposits, and the school ledger
              takes time that should go to students. Parents miss updates. Admins repeat the same
              work every term.
            </p>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-white/65">
              EduSentrix exists to give schools one dependable system for money, records, and
              communication — so leadership can see what is happening, finance can trust the
              numbers, and families know what is due and what is next.
            </p>
          </SectionCard>

          {/* Principles */}
          <div className="mt-12">
            <h2 className="text-2xl font-semibold tracking-tight text-white">What we believe</h2>
            <p className="mt-2 max-w-2xl text-white/55">
              Product decisions should match how schools in Ghana actually run — not generic
              software imported from elsewhere.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {PRINCIPLES.map((item) => (
                <div
                  key={item.title}
                  className={cn(
                    "relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5",
                    "bg-linear-to-br to-transparent",
                    item.glow,
                  )}
                >
                  <div
                    className={cn(
                      "mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl border bg-black/25",
                      item.accent,
                    )}
                  >
                    <item.icon className="h-5 w-5" aria-hidden />
                  </div>
                  <h3 className="text-base font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/55">{item.body}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Audiences */}
          <div className="mt-12">
            <h2 className="text-2xl font-semibold tracking-tight text-white">Who it is for</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {AUDIENCES.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5"
                >
                  <item.icon className="mb-3 h-5 w-5 text-cyan-300/90" aria-hidden />
                  <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/55">{item.body}</p>
                </div>
              ))}
            </div>
          </div>

          {/* School OS */}
          <SectionCard className="mt-12">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-200">
                School OS
              </span>
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight">
              <EduSentrixWordmark /> for your school
            </h2>
            <p className="mt-3 max-w-3xl text-base leading-relaxed text-white/65">
              The core platform is where admins and staff run the school: fees, academics,
              operations, and parent-facing communication — with role-specific experiences for
              teachers, bursars, and families.
            </p>
            <ul className="mt-6 space-y-3">
              {SCHOOL_OS_PILLARS.map((line) => (
                <li key={line} className="flex items-start gap-3 text-sm text-white/70">
                  <span className="mt-0.5 rounded-full bg-emerald-400/10 p-1">
                    <Check className="h-3.5 w-3.5 text-emerald-300" aria-hidden />
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </SectionCard>

          {/* EduSentrix Learn */}
          <SectionCard className="mt-8 border-cyan-500/20">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-200">
                    Student learning
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="relative h-11 w-11 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                      <Image
                        src="/logo/learn/logo-mark-leo-learning.png"
                        alt=""
                        fill
                        sizes="44px"
                        className="object-cover"
                        aria-hidden
                      />
                    </div>
                    <span
                      className="text-lg font-semibold tracking-tight"
                      style={EDUSENTRIX_WORDMARK_GRADIENT_STYLE}
                    >
                      EduSentrix Learn
                    </span>
                  </div>
                </div>
                <p className="mt-4 text-base leading-relaxed text-white/65">
                  EduSentrix Learn is a separate learning platform for students. It connects to what
                  is taught in school so learners can follow classroom lessons, complete
                  assignments, practice on their own, and prepare for exams — without mixing
                  student study flows into admin and finance screens.
                </p>
                <ul className="mt-6 space-y-3">
                  {LEARN_FEATURES.map((line) => (
                    <li key={line} className="flex items-start gap-3 text-sm text-white/70">
                      <span className="mt-0.5 rounded-full bg-cyan-400/10 p-1">
                        <Sparkles className="h-3.5 w-3.5 text-cyan-300" aria-hidden />
                      </span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-5 text-sm text-white/45">
                  Schools enable Learn for eligible students when it fits their programme; it
                  complements the school OS rather than replacing it.
                </p>
              </div>
            </div>
          </SectionCard>

          {/* CTA */}
          <SectionCard className="mt-12 text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-white">
              Ready to see it in action?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-base text-white/60">
              Explore the live demo or talk to us about enrolling your school in Ghana.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row sm:gap-4">
              <a
                href="https://demo.tryedusentrix.app"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-6 py-3.5 text-sm font-semibold text-cyan-200 transition-colors hover:border-cyan-400/50 hover:bg-cyan-500/20"
              >
                Explore live demo
              </a>
              <Link
                href="/enroll"
                className="inline-flex items-center justify-center rounded-xl bg-linear-to-r from-violet-500 to-purple-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:scale-[1.02]"
              >
                Enrol your school
              </Link>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white/85 transition-colors hover:bg-white/10"
              >
                <Mail className="h-4 w-4" aria-hidden />
                {CONTACT_EMAIL}
              </a>
            </div>
          </SectionCard>

          {/* Subtle Appsentrix */}
          <p className="mt-10 text-center text-sm text-white/35">
            <EduSentrixWordmark className="text-sm" /> is designed and built by{" "}
            <span className="text-white/50">Appsentrix</span>.
          </p>
        </div>

        <PublicMarketingFooter />
      </div>
    </main>
  );
}
