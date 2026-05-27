import type { Metadata } from "next";
import { EduSentrixWordmark } from "@/components/brand/EduSentrixWordmark";
import { PublicMarketingFooter } from "@/components/marketing/PublicMarketingFooter";
import { PublicMarketingNav } from "@/components/marketing/PublicMarketingNav";

export const metadata: Metadata = {
  title: "Privacy Policy — EduSentrix",
  description:
    "Plain-language privacy policy for EduSentrix School OS and EduSentrix Learn across web and mobile experiences.",
};

const LAST_UPDATED = "May 27, 2026";
const CONTACT_EMAIL = "support@tryedusentrix.app";
const CONTACT_PHONE = "0551171009";

const SECTIONS: Array<{ title: string; body: string[] }> = [
  {
    title: "1) Scope of this policy",
    body: [
      "This Privacy Policy explains how Appsentrix processes personal data when you use EduSentrix.",
      "It applies to EduSentrix School OS, EduSentrix Learn, and related web/mobile experiences for school admins, bursars, teachers, parents, students, and platform operators.",
    ],
  },
  {
    title: "2) Roles in data processing",
    body: [
      "For most school operational data, the school is the data controller and Appsentrix acts as a data processor/service provider.",
      "For platform account, security, billing, and support operations, Appsentrix may act as a controller for required business data.",
    ],
  },
  {
    title: "3) Data we collect",
    body: [
      "Account and identity data (name, email, phone, role, login metadata).",
      "School operational data (student records, attendance, timetable, communications, fees and billing events).",
      "EduSentrix Learn data (learning progress, assignment activity, exam-practice interactions, and related academic context).",
      "Technical and security data (IP address, browser/app metadata, session logs, device signals, and audit trails).",
      "Support and contact data (messages, support requests, and service communications).",
    ],
  },
  {
    title: "4) Why we process data",
    body: [
      "To provide, secure, maintain, and improve EduSentrix services.",
      "To support school operations requested by authorized school users.",
      "To authenticate users, enforce permissions, and prevent fraud or abuse.",
      "To provide customer support, service notifications, and account communications.",
      "To meet legal, compliance, accounting, and security obligations.",
    ],
  },
  {
    title: "5) Legal basis",
    body: [
      "We process data based on contract performance, legitimate interests, legal obligations, and consent where required.",
      "Schools are responsible for their own legal basis and notice obligations when they collect student/guardian data through EduSentrix.",
    ],
  },
  {
    title: "6) Child and student privacy",
    body: [
      "EduSentrix handles student data only for legitimate education and school operations purposes.",
      "Schools and guardians remain responsible for student supervision, lawful disclosures, and policy enforcement.",
      "We do not knowingly use student data for unrelated advertising purposes.",
    ],
  },
  {
    title: "7) EduSentrix Learn privacy",
    body: [
      "EduSentrix Learn is a separate student learning experience linked to school context.",
      "Learn activity data is used to deliver assignments, practice, progress insights, and learning support features.",
      "Schools decide which students are enabled and how Learn is used under school policy.",
    ],
  },
  {
    title: "8) Payments and financial data",
    body: [
      "Payment processing may involve third-party providers (for example card or mobile-money processors).",
      "EduSentrix receives transaction metadata needed for reconciliation and reporting; sensitive payment credentials are handled by payment providers under their controls.",
    ],
  },
  {
    title: "9) AI-assisted features and content safety",
    body: [
      "AI features may process prompts and related context needed to generate responses.",
      "AI output can be inaccurate; users must review output before high-impact use.",
      "We may apply moderation and safety controls to reduce harmful or abusive usage.",
    ],
  },
  {
    title: "10) Data sharing",
    body: [
      "We do not sell personal data.",
      "We share data only with authorized users, contracted service providers, legal authorities (when required), and other recipients needed to deliver the service lawfully.",
      "Service providers are required to handle data under contractual confidentiality and security obligations.",
    ],
  },
  {
    title: "11) International transfers",
    body: [
      "Some providers may process data in countries outside your own.",
      "Where transfers occur, we apply appropriate safeguards required by applicable law and contract.",
    ],
  },
  {
    title: "12) Security measures",
    body: [
      "We use layered security controls including access controls, encryption in transit, logging, monitoring, and environment protections.",
      "No system is absolutely risk-free; users and schools should also enforce strong passwords, role controls, and endpoint security practices.",
    ],
  },
  {
    title: "13) Data retention",
    body: [
      "We retain data only as long as needed for service delivery, security, legal, and operational requirements.",
      "Backups and logs may persist for limited periods after deletion requests.",
      "Retention windows may differ by data type and legal requirements.",
    ],
  },
  {
    title: "14) Data access, correction, export, and deletion",
    body: [
      "Authorized school administrators can manage, update, and export school data according to available product capabilities.",
      "Requests for deletion or correction should be submitted by authorized school contacts or account owners.",
      "Some data may be retained where legally required or needed for fraud prevention/security investigations.",
    ],
  },
  {
    title: "15) Cookies and analytics",
    body: [
      "We use necessary cookies/session technologies to authenticate users, keep sessions secure, and improve performance.",
      "We may use product analytics to understand usage trends and improve reliability.",
    ],
  },
  {
    title: "16) Breach and incident notification",
    body: [
      "If we confirm a significant security incident affecting your data, we notify impacted customers within a reasonable timeframe as required by law.",
      "We may require immediate security actions such as credential resets and access restrictions during containment.",
    ],
  },
  {
    title: "17) Third-party links and services",
    body: [
      "External services linked from EduSentrix have their own privacy practices.",
      "We are not responsible for third-party privacy policies outside our service boundaries.",
    ],
  },
  {
    title: "18) Policy updates",
    body: [
      "We may update this Privacy Policy to reflect legal, security, product, or operational changes.",
      "Updated versions become effective on the published date.",
    ],
  },
  {
    title: "19) Contact and privacy requests",
    body: [
      `For privacy questions or data requests, contact ${CONTACT_EMAIL} or call ${CONTACT_PHONE}.`,
      "For school-specific requests, include school name, role, and sufficient details so we can verify authority and respond quickly.",
    ],
  },
];

export default function PrivacyPage() {
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
        <PublicMarketingNav />
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="max-w-4xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/70">
              Legal / Privacy Policy
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
              <EduSentrixWordmark className="text-4xl sm:text-5xl" /> Privacy
            </h1>
            <p className="mt-4 text-sm text-white/45">Last updated: {LAST_UPDATED}</p>
            <p className="mt-5 text-base leading-relaxed text-white/65">
              This policy explains how data is handled across EduSentrix School OS and EduSentrix
              Learn, including role-based experiences on web and mobile.
            </p>
          </div>

          <div className="mt-10 space-y-4">
            {SECTIONS.map((section) => (
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
            Need privacy support? Email{" "}
            <a className="font-semibold underline decoration-cyan-300/50" href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>{" "}
            or call{" "}
            <a className="font-semibold underline decoration-cyan-300/50" href={`tel:${CONTACT_PHONE}`}>
              {CONTACT_PHONE}
            </a>
            .
          </section>
        </div>
        <PublicMarketingFooter />
      </div>
    </main>
  );
}
