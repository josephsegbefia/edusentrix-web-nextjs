import type { Metadata } from "next";
import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import { Building2, Mail, Phone, PlayCircle, School, ShieldCheck } from "lucide-react";
import { authPageGlowStyle } from "@/components/auth/auth-surfaces";
import { EduSentrixWordmark } from "@/components/brand/EduSentrixWordmark";
import { PublicContactForm } from "@/components/marketing/PublicContactForm";
import { PublicMarketingFooter } from "@/components/marketing/PublicMarketingFooter";
import { PublicMarketingNav } from "@/components/marketing/PublicMarketingNav";

export const metadata: Metadata = {
  title: "Contact — EduSentrix",
  description:
    "Contact EduSentrix for school onboarding, support, and EduSentrix Learn inquiries in Ghana.",
};

const SUPPORT_EMAIL = "support@tryedusentrix.app";
const CONTACT_PHONE = "0551171009";

export default function ContactPage() {
  return (
    <main className="m-page relative min-h-dvh antialiased">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={authPageGlowStyle}
      />

      <div className="relative">
        <PublicMarketingNav />
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-200/80">
              Contact <EduSentrixWordmark tone="adaptive" className="text-xs uppercase tracking-[0.18em]" />
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
              Talk to the EduSentrix team
            </h1>
            <p className="mt-5 text-lg leading-relaxed m-muted">
              We are onboarding schools in Ghana first. Reach us for school enrollment, existing
              school support, partnerships, and EduSentrix Learn inquiries.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <InfoCard
              icon={Mail}
              title="Email support"
              body={
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="font-medium text-cyan-700 dark:text-cyan-200 transition-colors hover:text-cyan-800 dark:hover:text-cyan-100"
                >
                  {SUPPORT_EMAIL}
                </a>
              }
            />
            <InfoCard
              icon={Phone}
              title="Call us"
              body={
                <a
                  href={`tel:${CONTACT_PHONE}`}
                  className="font-medium text-cyan-700 dark:text-cyan-200 transition-colors hover:text-cyan-800 dark:hover:text-cyan-100"
                >
                  {CONTACT_PHONE}
                </a>
              }
            />
            <InfoCard
              icon={ShieldCheck}
              title="Already on EduSentrix?"
              body={
                <Link href="/sign-in" className="font-medium text-cyan-700 dark:text-cyan-200 hover:text-cyan-800 dark:hover:text-cyan-100">
                  Sign in to your account
                </Link>
              }
            />
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <section className="m-card rounded-3xl p-6 sm:p-8">
              <h2 className="text-2xl font-semibold tracking-tight">Send us a message</h2>
              <p className="mt-3 text-sm leading-relaxed m-muted">
                This form goes directly to the platform admin account inbox for follow-up.
              </p>
              <div className="mt-6">
                <PublicContactForm />
              </div>
            </section>

            <section className="m-card rounded-3xl p-6 sm:p-8">
              <h2 className="text-xl font-semibold tracking-tight text-(--m-fg)">Quick paths</h2>
              <div className="mt-5 space-y-4">
                <QuickPath
                  href="/enroll"
                  icon={School}
                  title="Enrol your school"
                  body="Start your school onboarding request."
                />
                <QuickPath
                  href="https://demo.tryedusentrix.app"
                  icon={PlayCircle}
                  title="Explore live demo"
                  body="See the product before a full setup."
                  external
                />
                <QuickPath
                  href="/about"
                  icon={Building2}
                  title="About EduSentrix + Learn"
                  body="See our mission and product scope."
                />
              </div>

              <div className="mt-8 rounded-2xl border border-(--m-border) bg-(--m-subtle) p-4 text-sm leading-relaxed m-muted">
                Include your school name, region, estimated student count, and what you need help
                with so we can respond faster.
              </div>
            </section>
          </div>

          <p className="mt-10 text-center text-sm m-faint">
            <EduSentrixWordmark tone="adaptive" className="text-sm" /> is designed and built by{" "}
            <span className="m-muted">Appsentrix</span>.
          </p>
        </div>
        <PublicMarketingFooter />
      </div>
    </main>
  );
}

function InfoCard({
  icon: Icon,
  title,
  body,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  body: ReactNode;
}) {
  return (
    <div className="m-card group relative overflow-hidden rounded-2xl p-5 backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5">
      <div
        className="pointer-events-none absolute inset-0 bg-linear-to-br from-cyan-500/10 via-cyan-500/5 to-transparent opacity-70 transition-opacity duration-300 group-hover:opacity-100"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-(--m-border) to-transparent"
        aria-hidden
      />
      <div className="relative">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/20">
          <Icon className="h-5 w-5 text-cyan-700 dark:text-cyan-300" />
        </div>
        <div className="mt-3 text-sm font-semibold text-(--m-fg)">{title}</div>
        <div className="mt-1 text-sm m-muted">{body}</div>
      </div>
    </div>
  );
}

function QuickPath({
  href,
  icon: Icon,
  title,
  body,
  external = false,
}: {
  href: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
  body: string;
  external?: boolean;
}) {
  const classes =
    "flex items-start gap-3 rounded-2xl border border-(--m-border) bg-(--m-subtle) p-4 transition-colors hover:border-(--m-border) hover:bg-(--m-subtle)";
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={classes}>
        <Icon className="mt-0.5 h-5 w-5 text-emerald-700 dark:text-emerald-300" />
        <div>
          <p className="text-sm font-semibold text-(--m-fg)">{title}</p>
          <p className="mt-1 text-sm m-muted">{body}</p>
        </div>
      </a>
    );
  }
  return (
    <Link href={href} className={classes}>
      <Icon className="mt-0.5 h-5 w-5 text-emerald-700 dark:text-emerald-300" />
      <div>
        <p className="text-sm font-semibold text-(--m-fg)">{title}</p>
        <p className="mt-1 text-sm m-muted">{body}</p>
      </div>
    </Link>
  );
}
