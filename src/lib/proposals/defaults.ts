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
    content: "",
  },
  {
    key: "challenge",
    title: "The Challenge Schools Face",
    displayStyle: "standard",
    content: "",
  },
  {
    key: "solution",
    title: "Proposed Solution",
    displayStyle: "callout",
    content: "",
  },
  {
    key: "platform",
    title: "EduSentrix Web Platform",
    displayStyle: "cards",
    content: "",
  },
  {
    key: "mobile_app",
    title: "Companion Mobile App",
    displayStyle: "standard",
    content: "",
  },
  {
    key: "finance",
    title: "Fees, Invoices & Payments",
    displayStyle: "standard",
    content: "",
  },
  {
    key: "academics",
    title: "Academic Planning",
    displayStyle: "standard",
    content: "",
  },
  {
    key: "timetable",
    title: "Smart Timetables & Scheduling",
    displayStyle: "standard",
    content: "",
  },
  {
    key: "communications",
    title: "Notices & Communication",
    displayStyle: "standard",
    content: "",
  },
  {
    key: "ai",
    title: "AI-Powered School Assistant",
    displayStyle: "callout",
    content: "",
  },
  {
    key: "implementation",
    title: "Implementation Approach",
    displayStyle: "standard",
    content: "",
  },
  {
    key: "next_step",
    title: "Recommended Next Step",
    displayStyle: "highlight",
    content: "",
  },
  {
    key: "contact",
    title: "Contact",
    displayStyle: "standard",
    content: "",
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
