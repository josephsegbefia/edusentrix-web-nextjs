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

type ProposalSectionSeed = Pick<
  IProposalTemplateSection,
  "key" | "title" | "content" | "displayStyle"
>;

const standardSections: ProposalSectionSeed[] = [
  {
    key: "executive_summary",
    title: "Summary",
    displayStyle: "highlight",
    content:
      "EduSentrix is proposed for {{schoolName}} as a practical school operations platform for records, fees, academics, communication, and leadership visibility.\n\nThe recommended first step is to focus on the workflows that will make the fastest operational difference, then expand after staff are comfortable with the system.",
  },
  {
    key: "school_fit",
    title: "Why It Fits {{schoolName}}",
    displayStyle: "standard",
    content:
      "- Reduce manual follow-up across administration, finance, academics, and communication.\n- Give leadership a clearer view of student records, payments, attendance, and school activity.\n- Provide parents and staff with a more consistent digital experience.\n- Start with the most urgent workflows instead of trying to change everything at once.",
  },
  {
    key: "solution",
    title: "Recommended Solution",
    displayStyle: "callout",
    content:
      "Recommended focus areas:\n{{selectedModules}}\n\nEduSentrix will be configured around the school's structure, roles, classes, and immediate operational priorities.",
  },
  {
    key: "implementation",
    title: "Rollout Approach",
    displayStyle: "standard",
    content:
      "Phase 1: confirm school structure, users, classes, and priority workflows.\nPhase 2: configure the platform and onboard key staff.\nPhase 3: review live usage, support adoption, and expand into the next set of modules.",
  },
  {
    key: "subscription_pricing",
    title: "Commercial Summary",
    displayStyle: "table",
    content:
      "Pricing should be confirmed from the selected subscription plan, active student count, implementation scope, and any approved payment terms before this proposal is sent.",
  },
  {
    key: "next_step",
    title: "Next Step",
    displayStyle: "highlight",
    content:
      "We recommend a short review call with {{schoolName}} to confirm the priority workflows, agree the rollout path, and decide whether to proceed with a pilot or full implementation.\n\nContact: {{email}} | {{whatsapp}} | {{website}}",
  },
];

const onePageSections: Record<"pilot" | "pricing" | "demo_follow_up", ProposalSectionSeed[]> = {
  pilot: [
    {
      key: "summary",
      title: "Pilot Summary",
      displayStyle: "highlight",
      content:
        "This pilot gives {{schoolName}} a focused way to test EduSentrix with a limited set of high-value workflows before wider rollout.",
    },
    {
      key: "pilot_scope",
      title: "Pilot Scope",
      displayStyle: "standard",
      content:
        "Recommended pilot focus:\n{{selectedModules}}\n\nThe pilot should stay narrow enough for staff to adopt quickly and broad enough for leadership to judge operational value.",
    },
    {
      key: "success_criteria",
      title: "What Success Looks Like",
      displayStyle: "callout",
      content:
        "- Staff can complete the selected workflows without parallel paper-heavy tracking.\n- Leadership can review useful operational information from the platform.\n- Parents or staff involved in the pilot receive clearer communication and follow-up.",
    },
    {
      key: "next_step",
      title: "Next Step",
      displayStyle: "highlight",
      content:
        "Confirm the pilot group, start date, responsible staff, and review date. Contact: {{email}} | {{whatsapp}}",
    },
  ],
  pricing: [
    {
      key: "pricing_summary",
      title: "Pricing Summary",
      displayStyle: "highlight",
      content:
        "This pricing note summarizes the recommended EduSentrix commercial option for {{schoolName}}. Final figures should be checked against the active plan, student count, and approved terms before sending.",
    },
    {
      key: "recommended_option",
      title: "Recommended Option",
      displayStyle: "table",
      content:
        "Recommended plan: to be confirmed from the platform subscription setup.\nStudent range: to be confirmed.\nPayment terms: to be confirmed.\nImplementation fee: to be confirmed where applicable.",
    },
    {
      key: "coverage",
      title: "What This Covers",
      displayStyle: "standard",
      content:
        "Primary focus:\n{{selectedModules}}\n\nThe selected plan should match the school's immediate rollout priorities and avoid paying for modules that are not being used yet.",
    },
    {
      key: "next_step",
      title: "Next Step",
      displayStyle: "highlight",
      content: "Confirm the preferred plan and rollout timeline. Contact: {{email}} | {{whatsapp}}",
    },
  ],
  demo_follow_up: [
    {
      key: "demo_summary",
      title: "Demo Follow-up",
      displayStyle: "highlight",
      content:
        "Thank you for reviewing EduSentrix. Based on the discussion with {{schoolName}}, the most useful next step is to focus on the workflows that solve immediate operational pressure.",
    },
    {
      key: "priority_workflows",
      title: "Priority Workflows",
      displayStyle: "standard",
      content:
        "Suggested priorities:\n{{selectedModules}}\n\nThese can be refined after the school confirms its most urgent operational needs.",
    },
    {
      key: "recommended_next_step",
      title: "Recommended Next Step",
      displayStyle: "highlight",
      content:
        "Schedule a short follow-up to confirm scope, pricing, and whether {{schoolName}} prefers a pilot or full implementation path. Contact: {{email}} | {{whatsapp}}",
    },
  ],
};

export function defaultProposalSections(type: ProposalType = "general"): IProposalTemplateSection[] {
  const sections =
    type === "pilot" || type === "pricing" || type === "demo_follow_up"
      ? onePageSections[type]
      : standardSections;

  return sections.map((section, index) => ({
    ...section,
    subtitle: "",
    order: index + 1,
    enabled: true,
    pageBreakBefore: false,
    pageBreakAfter: false,
  }));
}

export const DEFAULT_PROPOSAL_TEMPLATE = {
  name: "EduSentrix Concise School Proposal",
  type: "general" as ProposalType,
  description: "Two-page maximum proposal for focused school outreach.",
  sections: defaultProposalSections("general"),
  isDefault: true,
};
