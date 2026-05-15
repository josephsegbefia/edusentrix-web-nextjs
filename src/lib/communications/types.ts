import type { Types } from "mongoose";

export type CommunicationType =
  | "notice"
  | "announcement"
  | "direct_message"
  | "fee_reminder"
  | "attendance_alert"
  | "academic_update"
  | "lesson_update"
  | "exam_notice"
  | "event_notice"
  | "emergency_alert"
  | "video_meeting_invite"
  | "newsletter"
  | "system_alert";

export type CommunicationStatus =
  | "draft"
  | "scheduled"
  | "queued"
  | "sending"
  | "sent"
  | "partially_sent"
  | "failed"
  | "cancelled"
  | "archived";

export type CommunicationPriority = "low" | "normal" | "high" | "urgent";

export type CommunicationChannel = "in_app" | "email" | "whatsapp" | "sms";

export type CommunicationAudienceType =
  | "entire_school"
  | "parents"
  | "students"
  | "teachers"
  | "staff"
  | "grades"
  | "class_groups"
  | "custom_users"
  | "custom_contacts";

export type CommunicationRecipientRole =
  | "parent"
  | "student"
  | "teacher"
  | "staff"
  | "school_admin"
  | "bursar"
  | "external";

export type CommunicationDeliveryStatus =
  | "pending"
  | "queued"
  | "sending"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "skipped"
  | "cancelled";

export type CommunicationOutboxStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "dead_letter";

export type CommunicationAudienceRule = {
  type: CommunicationAudienceType;
  gradeIds?: Types.ObjectId[];
  classGroupIds?: Types.ObjectId[];
  userIds?: Types.ObjectId[];
  targetRoles?: CommunicationRecipientRole[];
  externalContacts?: Array<{
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    whatsappPhone?: string | null;
    role?: CommunicationRecipientRole;
  }>;
};

export type ResolvedCommunicationRecipient = {
  key: string;
  userId?: Types.ObjectId | null;
  studentId?: Types.ObjectId | null;
  guardianId?: Types.ObjectId | null;
  role: CommunicationRecipientRole;
  name: string;
  email?: string | null;
  phone?: string | null;
  whatsappPhone?: string | null;
  gradeId?: Types.ObjectId | null;
  classGroupId?: Types.ObjectId | null;
  reasonIncluded: string;
};
