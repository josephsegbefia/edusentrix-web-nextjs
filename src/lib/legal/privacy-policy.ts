import type { LegalSection } from "@/lib/legal/terms-of-use";

export const PRIVACY_POLICY_LAST_UPDATED = "May 27, 2026";
export const PRIVACY_POLICY_CONTACT_EMAIL = "support@tryedusentrix.app";
export const PRIVACY_POLICY_CONTACT_PHONE = "0551171009";

export const PRIVACY_POLICY_INTRO =
  "This policy explains how data is handled across EduSentrix School OS and EduSentrix Learn, including role-based experiences on web and mobile.";

export const PRIVACY_POLICY_SECTIONS: LegalSection[] = [
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
      `For privacy questions or data requests, contact ${PRIVACY_POLICY_CONTACT_EMAIL} or call ${PRIVACY_POLICY_CONTACT_PHONE}.`,
      "For school-specific requests, include school name, role, and sufficient details so we can verify authority and respond quickly.",
    ],
  },
];
