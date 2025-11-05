// // src/app/page.tsx
// "use client";
// import { Button } from "@/components/ui/button";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { motion } from "framer-motion";

// export default function Home() {
//   return (
//     <main className="p-6">
//       <motion.div
//         initial={{ opacity: 0, y: 8 }}
//         animate={{ opacity: 1, y: 0 }}
//         transition={{ duration: 0.25 }}
//       >
//         <Card className="bg-card border-0 shadow-xl">
//           <CardHeader>
//             <CardTitle className="text-xl">EduSentrix</CardTitle>
//           </CardHeader>
//           <CardContent className="space-y-4">
//             <p className="text-muted">
//               Fresh Next.js setup with Tailwind v4, shadcn, React Query, and a
//               lightweight Auth Provider.
//             </p>
//             <Button className="bg-primary hover:opacity-90">
//               Primary Action
//             </Button>
//           </CardContent>
//         </Card>
//       </motion.div>
//     </main>
//   );
// }

// app/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "EduSentrix — Collect fees, run operations, delight parents",
  description:
    "All-in-one school OS for Ghana & Africa: fee collection, records, timetables, notices, analytics, and an optional EduAI assistant.",
};

export default function HomePage() {
  return (
    <main className="min-h-dvh bg-bg text-white antialiased">
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
    <header className="sticky top-0 z-50 bg-bg/70 backdrop-blur supports-backdrop-filter:bg-bg/60 border-b border-white/5">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-2">
          <div className="size-8 rounded-md bg-brand/15 grid place-items-center">
            <span className="text-brand font-bold">E</span>
          </div>
          <span className="font-semibold tracking-tight">EduSentrix</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm text-muted">
          <a href="#features" className="hover:text-white">
            Features
          </a>
          <a href="#how" className="hover:text-white">
            How it works
          </a>
          <a href="#pricing" className="hover:text-white">
            Pricing
          </a>
          <a href="#faq" className="hover:text-white">
            FAQ
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="px-3 py-2 rounded-md text-sm bg-card border border-white/10 hover:border-white/20"
          >
            Sign in
          </Link>
          <Link
            href="/demo"
            className="px-4 py-2 rounded-md text-sm font-medium bg-brand text-black hover:opacity-90"
          >
            Get a live demo
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
      {/* Glow background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(60% 40% at 70% 10%, var(--color-brand) 0%, transparent 60%), radial-gradient(50% 50% at 20% 20%, var(--color-primary) 0%, transparent 60%)",
          filter: "blur(60px)",
        }}
      />
      <div className="mx-auto max-w-7xl px-4 py-16 md:py-24">
        <div className="grid md:grid-cols-2 items-center gap-10">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-card px-3 py-1 text-xs text-muted">
              <span className="size-2 rounded-full bg-emerald-400" />
              Now onboarding schools in Ghana
            </span>

            <h1 className="mt-4 text-4xl md:text-5xl/tight font-semibold tracking-tight">
              Collect fees, run operations, and delight parents—on one platform.
            </h1>
            <p className="mt-4 text-base text-muted max-w-prose">
              EduSentrix is the modern school OS for Africa: web + mobile,
              Mobile Money and Paystack ready, fast onboarding, and optional AI
              to automate the boring stuff.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Link
                href="/demo"
                className="px-5 py-3 rounded-md font-medium bg-brand text-black text-sm hover:opacity-90"
              >
                Get a live demo
              </Link>
              <a
                href="#how"
                className="px-5 py-3 rounded-md font-medium bg-card text-sm border border-white/10 hover:border-white/20"
              >
                See how it works
              </a>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-4 text-xs text-muted">
              <Stat label="Students managed" value="10k+" />
              <Stat label="Avg. setup time" value="< 1 day" />
              <Stat label="Payout methods" value="MoMo + Bank" />
            </div>
          </div>

          {/* Screenshot / Illustration */}
          <div className="relative">
            <div className="aspect-16/10 w-full rounded-xl border border-white/10 bg-card overflow-hidden shadow-2xl">
              {/* Replace with real product screenshots when ready */}
              <div className="h-full grid place-items-center text-muted">
                <div className="text-center px-6">
                  <div className="text-sm">Product preview</div>
                  <div className="mt-2 text-xs">
                    Drop dashboard image here later (fees, timetables, notices)
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-6 -left-6 hidden md:block rounded-lg bg-card px-4 py-3 border border-white/10 text-xs text-muted">
              <span className="font-medium text-white">Live analytics</span>
              <div>Collections this term: GH₵ 128,450</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-card/60 border border-white/10 p-3">
      <div className="text-white font-semibold">{value}</div>
      <div className="text-[11px] text-muted/80">{label}</div>
    </div>
  );
}

/* ----------------------- PAIN → SOLUTION ----------------------- */
function PainSolution() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-14">
      <div className="grid md:grid-cols-2 gap-8">
        <div className="rounded-xl border border-white/10 bg-card p-6">
          <h2 className="text-lg font-semibold">What schools struggle with</h2>
          <ul className="mt-4 list-disc pl-5 text-sm text-muted space-y-2">
            <li>Manual fee tracking and poor visibility</li>
            <li>Fragmented tools for notices, records, and timetables</li>
            <li>Slow reconciliation between MoMo, bank, and ledgers</li>
            <li>Parents miss updates; admin time wasted</li>
          </ul>
        </div>
        <div className="rounded-xl border border-white/10 bg-card p-6">
          <h2 className="text-lg font-semibold">How EduSentrix solves it</h2>
          <ul className="mt-4 list-disc pl-5 text-sm text-muted space-y-2">
            <li>Smart fee + installment plans with automated reminders</li>
            <li>Unified records, notices, and timetable management</li>
            <li>Reconciliation tools; Paystack + MoMo integrations</li>
            <li>Parent web + mobile app with real-time updates</li>
          </ul>
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
    },
    {
      title: "Student Records",
      body: "Clean profiles, enrollment data, classes, and guardians—always in sync.",
    },
    {
      title: "Timetables",
      body: "Conflict-free scheduling with versioning and teacher/class views.",
    },
    {
      title: "Notices & Announcements",
      body: "School-wide or class-specific updates with push/email and read receipts.",
    },
    {
      title: "Analytics",
      body: "Collections, arrears, engagement—make decisions with confidence.",
    },
    {
      title: "EduAI (Premium)",
      body: "Generate notices, summarize dashboards, and automate repetitive tasks.",
    },
  ];
  return (
    <section id="features" className="mx-auto max-w-7xl px-4 py-14">
      <div className="max-w-2xl">
        <h2 className="text-2xl font-semibold tracking-tight">
          All the essentials—beautifully integrated
        </h2>
        <p className="mt-2 text-sm text-muted">
          Everything your school needs to run smoothly, in one fast platform.
        </p>
      </div>

      <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map((f) => (
          <article
            key={f.title}
            className="rounded-xl border border-white/10 bg-card p-5 hover:border-white/20 transition"
          >
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-md bg-brand/15 grid place-items-center">
                <div className="size-2 rounded-full bg-brand" />
              </div>
              <h3 className="font-medium">{f.title}</h3>
            </div>
            <p className="mt-3 text-sm text-muted">{f.body}</p>
            <a
              href="#"
              className="mt-4 inline-block text-sm text-brand hover:underline"
            >
              Learn more →
            </a>
          </article>
        ))}
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
    <section id="how" className="mx-auto max-w-7xl px-4 py-14">
      <div className="max-w-2xl">
        <h2 className="text-2xl font-semibold tracking-tight">
          Launch in days, not months
        </h2>
        <p className="mt-2 text-sm text-muted">
          We guide you end-to-end. Start with a live demo, and go live quickly.
        </p>
      </div>

      <div className="mt-8 grid md:grid-cols-3 gap-4">
        {steps.map((s) => (
          <div
            key={s.n}
            className="rounded-xl border border-white/10 bg-card p-5"
          >
            <div className="size-8 rounded-md bg-primary/20 text-primary grid place-items-center font-bold">
              {s.n}
            </div>
            <h3 className="mt-3 font-medium">{s.title}</h3>
            <p className="mt-2 text-sm text-muted">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ----------------- METRICS + TESTIMONIALS --------------------- */
function MetricsTestimonials() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-14">
      <div className="grid md:grid-cols-3 gap-6">
        <div className="rounded-xl border border-white/10 bg-card p-6">
          <MetricLine label="Avg. on-time payments ↑" value="35%" />
          <MetricLine label="Setup time" value="< 1 day" />
          <MetricLine label="System uptime" value="99.9%" />
        </div>
        <Testimonial
          quote="Collections are now predictable, and parents never miss notices."
          author="Headteacher, Achimota area"
        />
        <Testimonial
          quote="Reconciliation used to take days—now it’s minutes."
          author="Bursar, Cape Coast"
        />
      </div>
    </section>
  );
}

function MetricLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-none">
      <div className="text-sm text-muted">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

function Testimonial({ quote, author }: { quote: string; author: string }) {
  return (
    <blockquote className="rounded-xl border border-white/10 bg-card p-6">
      <p className="text-sm">“{quote}”</p>
      <footer className="mt-3 text-xs text-muted">— {author}</footer>
    </blockquote>
  );
}

/* ------------------------- INTEGRATIONS ----------------------- */
function Integrations() {
  const items = [
    "Paystack",
    "MTN MoMo",
    "Vodafone Cash",
    "AirtelTigo",
    "Brevo",
    "Termii",
    "Google Calendar",
  ];
  return (
    <section className="mx-auto max-w-7xl px-4 py-14">
      <div className="rounded-xl border border-white/10 bg-card p-6">
        <h3 className="font-medium">Works with your tools</h3>
        <p className="mt-2 text-sm text-muted">
          Payments, messaging, and scheduling that fit your school’s workflow.
        </p>
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-3">
          {items.map((x) => (
            <div
              key={x}
              className="rounded-lg border border-white/10 bg-bg/60 px-3 py-2 text-center text-xs text-muted"
            >
              {x}
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
    <section id="pricing" className="mx-auto max-w-7xl px-4 py-14">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-white/10 bg-card p-6">
          <h3 className="text-lg font-semibold">Basic</h3>
          <ul className="mt-3 text-sm text-muted space-y-2">
            <li>Fees & Installments</li>
            <li>Student Records & Notices</li>
            <li>Timetables</li>
            <li>MoMo + Paystack</li>
          </ul>
          <Link
            href="/demo"
            className="mt-5 inline-block rounded-md bg-brand text-black px-4 py-2 text-sm font-medium hover:opacity-90"
          >
            Request pricing
          </Link>
        </div>
        <div className="rounded-xl border border-white/10 bg-card p-6 ring-1 ring-primary/30">
          <h3 className="text-lg font-semibold">Premium</h3>
          <ul className="mt-3 text-sm text-muted space-y-2">
            <li>Everything in Basic</li>
            <li>Advanced Analytics</li>
            <li>EduAI Assistant</li>
            <li>Priority Support</li>
          </ul>
          <Link
            href="/demo"
            className="mt-5 inline-block rounded-md bg-primary/20 text-primary px-4 py-2 text-sm font-medium hover:bg-primary/25"
          >
            Talk to sales
          </Link>
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
      a: "We provide a live demo environment and can enable trial access upon request.",
    },
  ];
  return (
    <section id="faq" className="mx-auto max-w-7xl px-4 py-14">
      <div className="max-w-2xl">
        <h2 className="text-2xl font-semibold tracking-tight">FAQ</h2>
        <p className="mt-2 text-sm text-muted">
          Short answers to common questions.
        </p>
      </div>
      <div className="mt-6 grid md:grid-cols-2 gap-4">
        {faqs.map((f) => (
          <div
            key={f.q}
            className="rounded-xl border border-white/10 bg-card p-5"
          >
            <div className="font-medium">{f.q}</div>
            <p className="mt-2 text-sm text-muted">{f.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* -------------------------- FINAL CTA ------------------------- */
function FinalCTA() {
  return (
    <section className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, var(--color-primary) 0%, transparent 60%)",
          filter: "blur(60px)",
        }}
      />
      <div className="mx-auto max-w-7xl px-4 py-16">
        <div className="rounded-2xl bg-card border border-white/10 p-8 md:p-10 text-center">
          <h3 className="text-2xl font-semibold">
            Ready to modernize your school?
          </h3>
          <p className="mt-2 text-sm text-muted">
            Book a 15-minute live demo. See fees, notices, timetables, and
            parent experience in action.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/demo"
              className="px-5 py-3 rounded-md font-medium bg-brand text-black text-sm hover:opacity-90"
            >
              Get a live demo
            </Link>
            <Link
              href="/login"
              className="px-5 py-3 rounded-md font-medium bg-card text-sm border border-white/10 hover:border-white/20"
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
    <footer className="border-t border-white/10">
      <div className="mx-auto max-w-7xl px-4 py-10 grid md:grid-cols-4 gap-6 text-sm">
        <div>
          <div className="inline-flex items-center gap-2">
            <div className="size-8 rounded-md bg-brand/15 grid place-items-center">
              <span className="text-brand font-bold">E</span>
            </div>
            <span className="font-semibold tracking-tight">EduSentrix</span>
          </div>
          <p className="mt-3 text-muted">
            Built by Appsentrix for schools in Ghana & Africa.
          </p>
        </div>

        <div>
          <div className="font-medium">Product</div>
          <ul className="mt-3 space-y-2 text-muted">
            <li>
              <a href="#features" className="hover:text-white">
                Features
              </a>
            </li>
            <li>
              <a href="#pricing" className="hover:text-white">
                Pricing
              </a>
            </li>
            <li>
              <a href="#faq" className="hover:text-white">
                FAQ
              </a>
            </li>
          </ul>
        </div>

        <div>
          <div className="font-medium">Company</div>
          <ul className="mt-3 space-y-2 text-muted">
            <li>
              <Link href="/about" className="hover:text-white">
                About
              </Link>
            </li>
            <li>
              <Link href="/careers" className="hover:text-white">
                Careers
              </Link>
            </li>
            <li>
              <Link href="/contact" className="hover:text-white">
                Contact
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <div className="font-medium">Legal</div>
          <ul className="mt-3 space-y-2 text-muted">
            <li>
              <Link href="/terms" className="hover:text-white">
                Terms
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="hover:text-white">
                Privacy
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 pb-8 text-xs text-muted">
        © {new Date().getFullYear()} Appsentrix. All rights reserved.
      </div>
    </footer>
  );
}
