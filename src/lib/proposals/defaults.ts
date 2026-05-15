import type { IProposalTemplateSection, ProposalType } from "@/models/ProposalTemplate";

export const PROPOSAL_MODULES = [
  "Web Admin Dashboard",
  "Companion Mobile App",
  "Student Records",
  "Parent & Guardian Management",
  "Fees, Invoices & Payments",
  "Bursar Workflows",
  "Teacher Management",
  "Subjects, Grades & Class Groups",
  "Smart Timetables & Scheduling",
  "Attendance",
  "Lesson Notes & Academic Planning",
  "Notices & Communication",
  "Reports & Analytics",
  "AI Assistant",
  "In-App Video Meetings",
  "Role-Based Access",
  "Security & Data Protection",
  "Support & Training",
] as const;

export const PROPOSAL_TYPE_LABELS: Record<ProposalType, string> = {
  general: "General School Proposal",
  pilot: "Pilot Proposal",
  full_implementation: "Full Implementation Proposal",
  pricing: "Pricing Proposal",
  demo_follow_up: "Demo Follow-up Proposal",
};

const baseSections: Array<Pick<IProposalTemplateSection, "key" | "title" | "content" | "displayStyle">> = [
  {
    key: "executive_summary",
    title: "Executive Summary",
    displayStyle: "highlight",
    content:
      "This proposal introduces EduSentrix to {{schoolName}} as a modern school operating system for administration, academic planning, finance, communication, and reporting.",
  },
  {
    key: "challenge",
    title: "The Challenge Schools Face",
    displayStyle: "standard",
    content:
      "Many schools manage records, fees, timetables, lesson notes, communication, and reports across disconnected tools. This creates delays, weak visibility, and unnecessary administrative pressure.",
  },
  {
    key: "solution",
    title: "Proposed Solution",
    displayStyle: "callout",
    content:
      "EduSentrix brings core school operations into one coordinated platform, supported by role-based access, a companion mobile app, AI assistance, and clear implementation support.",
  },
  {
    key: "platform",
    title: "EduSentrix Web Platform",
    displayStyle: "cards",
    content:
      "Administrators and staff can manage students, parents, teachers, subjects, class groups, fees, payments, attendance, timetables, reports, documents, and communications from a secure web console.",
  },
  {
    key: "mobile_app",
    title: "Companion Mobile App",
    displayStyle: "standard",
    content:
      "Teachers, parents, students, and administrators can receive updates, view important school information, and participate in key workflows through the companion mobile experience.",
  },
  {
    key: "finance",
    title: "Fees, Invoices & Payments",
    displayStyle: "standard",
    content:
      "EduSentrix supports structured fee setup, invoice generation, balances, payments, bursar workflows, reconciliation, and school finance visibility.",
  },
  {
    key: "academics",
    title: "Academic Planning",
    displayStyle: "standard",
    content:
      "The platform supports schemes of learning, lesson notes, lesson delivery, academic calendars, assessments, examinations, and curriculum-aware planning.",
  },
  {
    key: "timetable",
    title: "Smart Timetables & Scheduling",
    displayStyle: "standard",
    content:
      "Class scheduling is designed to respect teacher assignments, contact hours, class group scope, and conflict detection.",
  },
  {
    key: "communications",
    title: "Notices & Communication",
    displayStyle: "standard",
    content:
      "EduSentrix provides app inbox communication, email delivery, notices, meetings, and clear communication history for school communities.",
  },
  {
    key: "ai",
    title: "AI-Powered School Assistant",
    displayStyle: "callout",
    content:
      "Leo, the EduSentrix assistant, helps users work faster by offering guided suggestions, quality checks, planning support, and operational assistance.",
  },
  {
    key: "implementation",
    title: "Implementation Approach",
    displayStyle: "standard",
    content:
      "EduSentrix implementation can begin with a guided pilot, data setup, staff orientation, workflow configuration, and review before full rollout.",
  },
  {
    key: "next_step",
    title: "Recommended Next Step",
    displayStyle: "highlight",
    content:
      "We recommend scheduling a focused demo with {{schoolName}} to walk through the modules most relevant to the school's current operational priorities.",
  },
  {
    key: "contact",
    title: "Contact",
    displayStyle: "standard",
    content:
      "Website: {{website}}\nEmail: {{email}}\nWhatsApp: {{whatsapp}}\nPrepared by: {{preparedBy}}",
  },
];

export function defaultProposalSections(): IProposalTemplateSection[] {
  return baseSections.map((section, index) => ({
    ...section,
    subtitle: "",
    order: index + 1,
    enabled: true,
    pageBreakBefore: section.key === "contact",
    pageBreakAfter: false,
  }));
}

export const DEFAULT_PROPOSAL_TEMPLATE = {
  name: "EduSentrix Full School Proposal",
  type: "full_implementation" as ProposalType,
  description: "Default proposal for introducing EduSentrix as a full school operating system.",
  sections: defaultProposalSections(),
  isDefault: true,
};
