import type { Metadata } from "next";
import { EduSentrixWordmark } from "@/components/brand/EduSentrixWordmark";
import { PublicMarketingFooter } from "@/components/marketing/PublicMarketingFooter";
import { PublicMarketingNav } from "@/components/marketing/PublicMarketingNav";

export const metadata: Metadata = {
  title: "Terms of Use — EduSentrix",
  description:
    "Plain-language terms for EduSentrix School OS and EduSentrix Learn across web and mobile products.",
};

const LAST_UPDATED = "May 27, 2026";
const SUPPORT_EMAIL = "support@tryedusentrix.app";
const SUPPORT_PHONE = "0551171009";

const TERMS: Array<{ title: string; body: string[] }> = [
  {
    title: "1) Who we are",
    body: [
      "EduSentrix is a product designed and operated by Appsentrix.",
      "These Terms apply to EduSentrix School OS, EduSentrix Learn, all web apps, and all mobile experiences.",
      "By using EduSentrix, you agree to these Terms.",
    ],
  },
  {
    title: "2) Who can use EduSentrix",
    body: [
      "Schools and authorized users (admins, bursars, teachers, parents, students, and platform operators) can use the service.",
      "You must provide accurate account details and keep them current.",
      "You are responsible for activity on your account and for keeping login details secure.",
    ],
  },
  {
    title: "3) School authority and responsibility",
    body: [
      "If you register or manage a school account, you confirm you are allowed to act for that school.",
      "Schools are responsible for how their staff and invited users use EduSentrix.",
    ],
  },
  {
    title: "4) What the platform provides",
    body: [
      "EduSentrix provides software tools for school operations, including finance, academics, records, communication, and scheduling.",
      "EduSentrix Learn is a separate student learning platform connected to school teaching and assignments.",
      "We provide software infrastructure; schools remain responsible for academic, administrative, and financial decisions.",
    ],
  },
  {
    title: "5) Fees, billing, and payments",
    body: [
      "Subscription and service fees are based on your selected plan or written commercial agreement.",
      "Unless required by law or agreed in writing, paid amounts are non-refundable.",
      "We may suspend or limit service for overdue balances.",
      "Payment processors and telecom rails (for card/mobile money) have their own terms and service availability.",
    ],
  },
  {
    title: "6) Data ownership and usage rights",
    body: [
      "Schools own their school data. We do not claim ownership of your operational records.",
      "You grant us the right to host, process, back up, and transmit data solely to deliver and improve the service.",
      "We may use aggregated or anonymized usage data for analytics, reliability, and product improvement.",
    ],
  },
  {
    title: "7) Privacy and lawful data handling",
    body: [
      "Personal data is handled under our Privacy Policy and applicable laws.",
      "Schools are responsible for collecting data lawfully and for obtaining any required notices or consent from parents/guardians.",
      "You must not upload personal data you are not legally permitted to process.",
    ],
  },
  {
    title: "8) Child and student data protections",
    body: [
      "Schools and guardians remain responsible for lawful management of student data and student access controls.",
      "EduSentrix Learn is designed for school-linked learning use; school policy controls appropriate student use.",
      "You must not use EduSentrix to collect, share, or process sensitive child data beyond legitimate school purposes.",
    ],
  },
  {
    title: "9) Acceptable use",
    body: [
      "You must not use the platform for unlawful behavior, abuse, harassment, fraud, spam, or harmful content.",
      "Do not attempt unauthorized access, service disruption, or security probing without written permission.",
      "Do not upload malware, malicious scripts, or content that infringes third-party rights.",
    ],
  },
  {
    title: "10) Roles, permissions, and security controls",
    body: [
      "Access depends on role permissions and school configuration.",
      "We may force password reset, session revocation, or access restrictions to protect account security.",
      "You must promptly report suspected unauthorized access or credential compromise.",
    ],
  },
  {
    title: "11) Messaging and communications",
    body: [
      "Service communications (transactional emails, system alerts, and operational notifications) are part of normal platform use.",
      "Schools are responsible for the accuracy and legality of school-issued communications sent through the platform.",
    ],
  },
  {
    title: "12) AI-assisted features",
    body: [
      "AI outputs are assistive and may contain errors, omissions, or outdated statements.",
      "You are responsible for reviewing and validating AI-generated content before use in grading, finance, compliance, or high-impact decisions.",
      "AI output is not legal, medical, accounting, or regulatory advice.",
    ],
  },
  {
    title: "13) Third-party integrations",
    body: [
      "Some features rely on third-party providers (payments, email, cloud hosting, identity, push notifications).",
      "We are not liable for outages, delays, or failures caused by third-party systems outside our control.",
    ],
  },
  {
    title: "14) Availability, maintenance, and changes",
    body: [
      "We aim for reliable uptime, but uninterrupted service is not guaranteed.",
      "We may update, modify, or retire features to improve security, compliance, or product quality.",
      "Planned and emergency maintenance may temporarily impact access.",
    ],
  },
  {
    title: "15) Beta, pilot, and provisional modules",
    body: [
      "Some modules may be labeled pilot, preview, or provisional.",
      "Pilot features may change rapidly and may have reduced guarantees while stabilization is ongoing.",
    ],
  },
  {
    title: "16) Data retention, deletion, and export",
    body: [
      "Operational backups and logs may remain for a limited retention window after deletion requests, for security, audit, and recovery purposes.",
      "On account closure, data export may be available within a defined period subject to verification and legal requirements.",
      "We may retain records where required by law, fraud prevention, or legitimate security obligations.",
    ],
  },
  {
    title: "17) Security incident response",
    body: [
      "If we confirm a significant security incident affecting your data, we will notify impacted customers within a reasonable time as required by law.",
      "You agree to cooperate with reasonable mitigation, credential resets, and containment steps when necessary.",
    ],
  },
  {
    title: "18) Intellectual property",
    body: [
      "Appsentrix and its licensors own EduSentrix software, design systems, branding, and platform IP.",
      "You may not copy, reverse engineer, resell, or misuse the platform beyond allowed use.",
    ],
  },
  {
    title: "19) Disclaimer of warranties",
    body: [
      "EduSentrix is provided on an 'as available' and 'as is' basis to the maximum extent allowed by law.",
      "We do not guarantee specific school outcomes, financial outcomes, academic outcomes, or uninterrupted operation.",
    ],
  },
  {
    title: "20) Limitation of liability",
    body: [
      "To the extent allowed by law, Appsentrix is not liable for indirect, incidental, special, or consequential losses.",
      "Our total liability for any claim is limited to fees paid to us in the 12 months before the claim event.",
    ],
  },
  {
    title: "21) Indemnity",
    body: [
      "You agree to indemnify and hold Appsentrix harmless from claims arising from your misuse of the service, unlawful data processing, or violation of law/third-party rights.",
    ],
  },
  {
    title: "22) Suspension and termination",
    body: [
      "We may suspend or terminate access for Terms breaches, non-payment, abuse, legal risk, or security risk.",
      "Schools may request closure subject to billing settlement and applicable data retention obligations.",
    ],
  },
  {
    title: "23) Force majeure",
    body: [
      "Neither party is liable for delays or failures caused by events beyond reasonable control, including power outages, telecom disruption, civil unrest, or major provider outages.",
    ],
  },
  {
    title: "24) Governing law and disputes",
    body: [
      "These Terms are governed by the laws of Ghana unless your signed enterprise agreement states otherwise.",
      "Any dispute not resolved amicably will be handled under the applicable courts or dispute process agreed in your contract.",
    ],
  },
  {
    title: "25) Changes to these Terms",
    body: [
      "We may update these Terms. Updated versions are effective from the published date.",
      "Continued use after updates means you accept the revised Terms.",
    ],
  },
  {
    title: "26) General legal provisions",
    body: [
      "If one section of these Terms is held invalid, the remaining sections continue to apply (severability).",
      "Failure to enforce a section once does not waive our right to enforce it later (no waiver).",
      "We may assign these Terms as part of merger, restructuring, or asset transfer, with continuity of service obligations where applicable.",
    ],
  },
];

export default function TermsPage() {
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
        <PublicMarketingNav active="terms" />
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="max-w-4xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/70">
              Legal / Terms of Use
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
              <EduSentrixWordmark className="text-4xl sm:text-5xl" /> Terms
            </h1>
            <p className="mt-4 text-sm text-white/45">Last updated: {LAST_UPDATED}</p>
            <p className="mt-5 text-base leading-relaxed text-white/65">
              This page is written in plain language for schools, staff, parents, and students
              using EduSentrix School OS and EduSentrix Learn. It applies across web and mobile
              app experiences.
            </p>
          </div>

          <div className="mt-10 space-y-4">
            {TERMS.map((section) => (
              <section
                key={section.title}
                className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black p-6 shadow-xl shadow-black/30 backdrop-blur-xl"
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
                />
                <h2 className="relative text-lg font-semibold tracking-tight text-white">{section.title}</h2>
                <ul className="relative mt-3 space-y-2">
                  {section.body.map((line) => (
                    <li key={line} className="text-sm leading-relaxed text-white/65">
                      {line}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <section className="mt-8 rounded-2xl border border-cyan-500/25 bg-cyan-500/8 p-5 text-sm leading-relaxed text-cyan-100/90">
            Need clarification or legal contact? Email{" "}
            <a className="font-semibold underline decoration-cyan-300/50" href={`mailto:${SUPPORT_EMAIL}`}>
              {SUPPORT_EMAIL}
            </a>{" "}
            or call{" "}
            <a className="font-semibold underline decoration-cyan-300/50" href={`tel:${SUPPORT_PHONE}`}>
              {SUPPORT_PHONE}
            </a>
            .
          </section>
        </div>
        <PublicMarketingFooter />
      </div>
    </main>
  );
}
