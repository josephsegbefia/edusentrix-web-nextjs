import type { CommunicationChannel, CommunicationType } from "@/lib/communications/types";

export type DefaultCommunicationTemplate = {
  key: string;
  name: string;
  description: string;
  type: CommunicationType;
  defaultChannels: CommunicationChannel[];
  subject: string;
  bodyHtml: string;
  bodyText: string;
  variables: string[];
};

export const DEFAULT_COMMUNICATION_TEMPLATES: DefaultCommunicationTemplate[] = [
  {
    key: "pta_meeting_notice",
    name: "PTA meeting notice",
    description: "General parent meeting announcement.",
    type: "event_notice",
    defaultChannels: ["in_app", "email"],
    subject: "PTA Meeting Notice",
    bodyHtml: "<p>Dear parent/guardian,</p><p>You are invited to the upcoming PTA meeting. Please make time to attend.</p>",
    bodyText: "Dear parent/guardian, you are invited to the upcoming PTA meeting. Please make time to attend.",
    variables: ["meetingDate", "meetingTime", "venue"],
  },
  {
    key: "fee_balance_reminder",
    name: "Fee balance reminder",
    description: "Polite reminder for outstanding school fees.",
    type: "fee_reminder",
    defaultChannels: ["in_app", "email"],
    subject: "School Fee Balance Reminder",
    bodyHtml: "<p>Dear parent/guardian,</p><p>This is a reminder to review and settle any outstanding school fee balance.</p>",
    bodyText: "Dear parent/guardian, this is a reminder to review and settle any outstanding school fee balance.",
    variables: ["studentName", "balance", "dueDate"],
  },
  {
    key: "emergency_school_alert",
    name: "Emergency school alert",
    description: "Urgent school-wide communication.",
    type: "emergency_alert",
    defaultChannels: ["in_app", "email"],
    subject: "Urgent School Alert",
    bodyHtml: "<p>Dear school community,</p><p>Please take note of this urgent update from the school.</p>",
    bodyText: "Dear school community, please take note of this urgent update from the school.",
    variables: ["summary", "actionRequired"],
  },
  {
    key: "exam_notice",
    name: "Exam notice",
    description: "Exam timetable or exam instruction announcement.",
    type: "exam_notice",
    defaultChannels: ["in_app", "email"],
    subject: "Examination Notice",
    bodyHtml: "<p>Dear parent/guardian,</p><p>Please take note of the examination information shared by the school.</p>",
    bodyText: "Dear parent/guardian, please take note of the examination information shared by the school.",
    variables: ["examName", "startDate", "instructions"],
  },
];
