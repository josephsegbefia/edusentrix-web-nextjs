# EduSentrix Communications Engine Specification

## 1. Document Overview

**Product:** EduSentrix  
**Module:** Communications Engine  
**Target Area:** Notices, announcements, direct messages, in-app notifications, email, WhatsApp, SMS, school inboxes, delivery tracking, and communication workflows  
**Primary Users:** School administrators, headteachers, bursars, teachers, parents, students, platform admins  
**Technical Stack Context:** Next.js, TypeScript, MongoDB/Mongoose, Clerk authentication, role-based access, EduSentrix web platform, companion mobile app  
**Compatibility Position:** No real schools are currently using the platform. Legacy notice models and fragmented communication flows may be removed, replaced, or migrated only if useful for test/demo data. Clean architecture is preferred over backwards compatibility.

---

## 2. Executive Summary

EduSentrix needs a complete Communications Engine that supports all official information flow between the different user roles in the school ecosystem.

The current system has several separate communication-related pieces, including notices, library notices, in-app notifications, parent/teacher messages, email inboxes, email threads, Brevo email sending, email reply routing, and a basic WhatsApp transport stub. However, these pieces are fragmented and do not currently behave as one unified communication platform.

The goal of this specification is to replace the fragmented notice/announcement setup with a clean, powerful, school-wide Communications Engine that can handle:

- Notices
- Announcements
- Direct messages
- In-app notifications
- Email
- WhatsApp
- SMS
- Fee reminders
- Attendance alerts
- Academic updates
- Lesson updates
- Emergency alerts
- Video meeting invitations
- Delivery tracking
- Reply handling
- School-aware email routing
- Communication preferences and consent
- Templates
- Audit logs
- Reports and analytics

The final system should allow a school to send the right message to the right audience through the right channels and know exactly who received it.

---

## 3. Core Product Vision

The Communications Engine should make EduSentrix feel like a serious school communication platform, not just an app with notices.

The vision is:

> A school should be able to create one communication, select an audience, choose channels such as in-app, email, WhatsApp, and SMS, preview who will receive it, send or schedule it, and track delivery across every channel.

Example:

Ave Maria School wants to send a PTA meeting notice to all parents.

The school admin should be able to:

1. Create a communication titled “PTA Meeting Notice”.
2. Select audience: all parents.
3. Select channels: in-app, email, WhatsApp.
4. Preview recipient count.
5. See how many parents have email, WhatsApp, SMS, or missing contact details.
6. Send or schedule the message.
7. Track sent, delivered, read, failed, skipped, and replies.
8. Receive email replies in Ave Maria School’s inbox.
9. See all communication history under the school.

This is the standard the new system must support.

---

## 4. Current Situation

The codebase currently has several communication-related concepts that appear separate:

- `Notice`
- `LibraryNotice`
- `Notification`
- `MessageThread`
- `Message`
- `EmailThread`
- `EmailMessage`
- `EmailEvent`
- `EmailDispatchJob`
- `EmailBatch`
- `EmailPreference`
- `EmailSuppression`
- WhatsApp notification stub
- Admin email inbox/compose
- Platform email inbox/compose
- Teacher notices
- Parent/teacher direct messages

These are useful building blocks, but the architecture is fragmented.

### 4.1 Main Current Problems

1. Notices and announcements are split across multiple models.
2. Teacher notices and library notices are separate concepts.
3. Email exists as a strong subsystem but is not fully connected to notices and announcements.
4. In-app notifications are output records, not parent communication records.
5. WhatsApp is not production-ready.
6. SMS is not implemented as a real channel.
7. There is no single parent `Communication` model.
8. There is no central delivery ledger across channels.
9. Audience resolution is not centralized.
10. Communication preferences are email-focused rather than multi-channel.
11. Delivery reports are not unified.
12. Replies are not connected to a general communication record.
13. Schools cannot yet manage all communication from one Communication Center.

---

## 5. Strategic Decision

Because there are no real schools using EduSentrix yet, the system should be rebuilt cleanly.

### 5.1 Remove or Retire Legacy Communication Models

Legacy models may be removed, retired, or kept temporarily only during development.

Recommended action:

| Existing Concept | Decision |
|---|---|
| `Notice` | Retire or replace with `Communication` |
| `LibraryNotice` | Retire or replace with `Communication` |
| `Notification` | Keep as in-app delivery output |
| `MessageThread` | Keep but integrate with Communications Engine |
| `Message` | Keep but integrate with Communications Engine |
| `EmailThread` | Keep and integrate |
| `EmailMessage` | Keep and integrate |
| `EmailDispatchJob` | Reuse or replace with general outbox job |
| `EmailPreference` | Replace or extend into `CommunicationPreference` |
| `EmailSuppression` | Keep or generalize into `CommunicationSuppression` |
| WhatsApp stub | Replace with provider adapter architecture |
| SMS | Add new adapter |

### 5.2 New Source of Truth

The new parent record for all official communication should be:

```txt
Communication
```

Every notice, announcement, fee reminder, attendance alert, academic update, direct broadcast, emergency message, and video meeting invite should begin as a `Communication`.

Channel-specific records such as `Notification`, `EmailMessage`, `WhatsAppMessage`, and `SmsMessage` should be delivery outputs.

### 5.3 Tightened Boundary: Broadcasts vs Conversations

The first implementation should treat `Communication` as the source of truth for official school-originated communication:

- notices
- announcements
- fee reminders
- attendance alerts
- academic updates
- lesson updates
- exam notices
- event notices
- emergency alerts
- newsletters
- video meeting invitations

Direct chat-style conversations should continue to use `MessageThread` and `Message`. When an official communication allows replies, the replies may open or link to a `MessageThread`, but the outbound broadcast itself remains a `Communication`.

This keeps the Communications Engine clean: broadcasts are auditable, reportable, and channel-routed; conversations remain conversational and thread-based.

### 5.4 Tightened Rule: Channels Are Adapters

In-app, email, WhatsApp, and SMS must not become separate product flows. They are delivery adapters under one communication record and one delivery ledger.

The correct flow is:

```txt
Communication -> Audience Snapshot -> Channel Routing -> Delivery Ledger -> Channel Adapter
```

The UI should not ask users to create separate email notices, WhatsApp notices, or SMS notices. The user creates one communication and chooses channels.

### 5.5 Tightened MVP Rule

The first production-ready slice should support in-app and email delivery end to end because the platform already has reliable infrastructure for those channels.

WhatsApp and SMS should be implemented as adapter-ready ledgers with message records, consent checks, provider event records, and clean skipped/failed states. Real provider sending should remain behind explicit provider configuration, consent rules, cost controls, and school-level enablement.

---

## 6. Core Architecture

The target architecture:

```txt
Communication
  ├── Audience Resolution
  ├── Audience Snapshot
  ├── Channel Routing
  ├── Delivery Ledger
  │     ├── In-App Notification
  │     ├── Email
  │     ├── WhatsApp
  │     └── SMS
  ├── Replies / Inbox
  ├── Preferences / Consent
  ├── Provider Events
  └── Audit Logs
```

### 6.1 Main Models

The new system should introduce:

1. `Communication`
2. `CommunicationDelivery`
3. `CommunicationAudienceSnapshot`
4. `CommunicationTemplate`
5. `CommunicationPreference`
6. `CommunicationSuppression`
7. `CommunicationProviderEvent`
8. `CommunicationOutboxJob`
9. `WhatsAppMessage`
10. `SmsMessage`

Existing models to keep as delivery outputs:

1. `Notification`
2. `EmailThread`
3. `EmailMessage`
4. `MessageThread`
5. `Message`

---

## 7. Communication Types

The system should support these communication types:

```ts
type CommunicationType =
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
```

### 7.1 Type Descriptions

| Type | Description |
|---|---|
| `notice` | General school notice |
| `announcement` | Formal announcement to a wider audience |
| `direct_message` | Conversation-style message between users |
| `fee_reminder` | Fee balance or payment reminder |
| `attendance_alert` | Absence or attendance-related alert |
| `academic_update` | Academic or class progress update |
| `lesson_update` | Lesson-related update for students/parents |
| `exam_notice` | Exam timetable, exam reminder, or exam-related update |
| `event_notice` | School event information |
| `emergency_alert` | Urgent communication requiring fast delivery |
| `video_meeting_invite` | Invitation to in-app school meeting |
| `newsletter` | Longer school update |
| `system_alert` | Platform/system-generated alert |

---

## 8. Communication Channels

Supported channels:

```ts
type CommunicationChannel =
  | "in_app"
  | "email"
  | "whatsapp"
  | "sms";
```

### 8.1 Channel Role

| Channel | Purpose |
|---|---|
| `in_app` | Default internal notification channel |
| `email` | Formal communication and replies |
| `whatsapp` | High-engagement parent/staff communication |
| `sms` | Urgent fallback or short message channel |

### 8.2 Default Channel Strategy

In-app should be created for all internal users where applicable.

Email should be used for formal messages, long messages, attachments, and records.

WhatsApp should be used where consent exists and the school wants fast parent/staff engagement.

SMS should be used for urgent messages, fallback cases, or schools that pay for SMS credits.

---

## 9. Audience Types

```ts
type CommunicationAudienceType =
  | "entire_school"
  | "roles"
  | "grades"
  | "class_groups"
  | "subjects"
  | "students"
  | "parents"
  | "teachers"
  | "staff"
  | "fee_defaulters"
  | "attendance_cases"
  | "custom_users"
  | "custom_contacts";
```

### 9.1 Example Audiences

- All parents
- All teachers
- All students
- Parents of Primary 6 A
- Students in JHS 1 A
- Teachers assigned to Mathematics
- Parents of fee defaulters
- Parents of absent students today
- Bursars and school admins
- Custom list of recipients

---

## 10. Permissions and Sending Rules

The Communications Engine must be permission-driven.

### 10.1 Suggested Permissions

```ts
school.communications.read
school.communications.create
school.communications.update
school.communications.send
school.communications.schedule
school.communications.archive
school.communications.deleteDraft
school.communications.viewReports
school.communications.manageTemplates
school.communications.managePreferences
school.communications.sendSms
school.communications.sendWhatsapp
school.communications.sendEmergency

teacher.communications.createClassNotice
teacher.communications.messageParents
teacher.communications.messageStudents
teacher.communications.viewReplies

platform.communications.read
platform.communications.sendPlatformNotice
platform.communications.viewProviderLogs
platform.communications.manageSuppressions
platform.communications.manageTemplates
```

### 10.2 Role-Based Defaults

| Role | Default Capabilities |
|---|---|
| School Admin | Send school-wide/class/parent/staff communications |
| Headteacher | Send school-wide and academic communications |
| Bursar | Send fee reminders and billing-related messages |
| Teacher | Send class notices and messages to parents/students of assigned classes |
| Parent | Receive messages, reply where enabled |
| Student | Receive academic notices/messages where enabled |
| Platform Admin | Monitor and manage communication infrastructure |

### 10.3 Teacher Scope Rule

Teachers must only send messages to:

- students in assigned class groups,
- parents/guardians of assigned students,
- classes/subjects assigned to the teacher,
- allowed school staff if school policy permits.

Teachers must not send school-wide communications unless granted permission.

---

## 11. Data Models

The following models assume MongoDB and Mongoose.

---

# 11.1 Communication Model

## Purpose

The parent record for every notice, announcement, alert, reminder, and broadcast.

## Schema

```ts
import mongoose, { Schema, Types } from "mongoose";

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

export type CommunicationPriority =
  | "low"
  | "normal"
  | "high"
  | "critical";

export interface ICommunication {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;

  type: CommunicationType;
  status: CommunicationStatus;
  priority: CommunicationPriority;

  title: string;
  body: string;
  summary?: string;

  audience: {
    type:
      | "entire_school"
      | "roles"
      | "grades"
      | "class_groups"
      | "subjects"
      | "students"
      | "parents"
      | "teachers"
      | "staff"
      | "fee_defaulters"
      | "attendance_cases"
      | "custom_users"
      | "custom_contacts";
    roleTargets?: string[];
    gradeIds?: Types.ObjectId[];
    classGroupIds?: Types.ObjectId[];
    subjectIds?: Types.ObjectId[];
    studentIds?: Types.ObjectId[];
    userIds?: Types.ObjectId[];
    externalContacts?: Array<{
      name?: string;
      email?: string;
      phone?: string;
      roleHint?: string;
    }>;
    filters?: Record<string, unknown>;
  };

  channels: {
    inApp: boolean;
    email: boolean;
    whatsapp: boolean;
    sms: boolean;
  };

  channelPolicy: {
    respectPreferences: boolean;
    allowFallback: boolean;
    requireVerifiedContact: boolean;
    quietHoursMode: "respect" | "bypass_for_urgent";
  };

  scheduledFor?: Date;
  queuedAt?: Date;
  sentAt?: Date;

  createdBy: Types.ObjectId;
  createdByRole: string;

  relatedEntityType?: string;
  relatedEntityId?: Types.ObjectId;

  attachments?: Array<{
    name: string;
    url: string;
    type: string;
    size?: number;
  }>;

  replyPolicy: {
    allowReplies: boolean;
    replyInbox: "general" | "billing" | "academic" | "support" | "no_reply";
    createMessageThreadOnReply: boolean;
  };

  metadata?: Record<string, unknown>;

  createdAt: Date;
  updatedAt: Date;
}
```

## Required Indexes

```ts
communicationSchema.index({ schoolId: 1, status: 1, createdAt: -1 });
communicationSchema.index({ schoolId: 1, type: 1, createdAt: -1 });
communicationSchema.index({ schoolId: 1, scheduledFor: 1 });
communicationSchema.index({ createdBy: 1, createdAt: -1 });
```

---

# 11.2 CommunicationAudienceSnapshot Model

## Purpose

Stores exactly who was targeted at the time the communication was sent.

This is important because school data changes over time. If a school sends a notice to “all parents,” the system must preserve the exact recipients included at the time of sending.

## Schema

```ts
export interface ICommunicationAudienceSnapshot {
  _id: Types.ObjectId;
  communicationId: Types.ObjectId;
  schoolId: Types.ObjectId;

  totalResolved: number;
  totalWithEmail: number;
  totalWithWhatsapp: number;
  totalWithSms: number;
  totalWithInApp: number;
  totalSkipped: number;

  recipients: Array<{
    userId?: Types.ObjectId;
    studentId?: Types.ObjectId;
    guardianId?: Types.ObjectId;
    role: string;
    name?: string;
    email?: string;
    phone?: string;
    whatsappPhone?: string;
    classGroupIds?: Types.ObjectId[];
    gradeIds?: Types.ObjectId[];
    reasonIncluded?: string;
    skipped?: boolean;
    skippedReason?: string;
  }>;

  createdAt: Date;
}
```

## Required Indexes

```ts
communicationAudienceSnapshotSchema.index({ communicationId: 1 }, { unique: true });
communicationAudienceSnapshotSchema.index({ schoolId: 1, createdAt: -1 });
```

---

# 11.3 CommunicationDelivery Model

## Purpose

Tracks each recipient-channel delivery attempt.

One communication sent to 100 parents via in-app, email, and WhatsApp may create up to 300 delivery records.

## Schema

```ts
export type CommunicationDeliveryChannel =
  | "in_app"
  | "email"
  | "whatsapp"
  | "sms";

export type CommunicationDeliveryStatus =
  | "pending"
  | "queued"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "skipped"
  | "dead_letter";

export interface ICommunicationDelivery {
  _id: Types.ObjectId;

  communicationId: Types.ObjectId;
  schoolId: Types.ObjectId;

  recipientUserId?: Types.ObjectId;
  recipientStudentId?: Types.ObjectId;
  recipientGuardianId?: Types.ObjectId;

  recipientRole:
    | "parent"
    | "teacher"
    | "student"
    | "school_admin"
    | "headteacher"
    | "bursar"
    | "staff"
    | "external";

  recipientName?: string;

  channel: CommunicationDeliveryChannel;
  destination: string;

  status: CommunicationDeliveryStatus;

  provider?: "brevo" | "meta_whatsapp" | "sms_provider" | "in_app" | "internal";
  providerMessageId?: string;

  attempts: number;
  maxAttempts: number;

  failureReason?: string;
  skippedReason?: string;

  lastAttemptAt?: Date;
  queuedAt?: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  failedAt?: Date;

  relatedNotificationId?: Types.ObjectId;
  relatedEmailThreadId?: Types.ObjectId;
  relatedEmailMessageId?: Types.ObjectId;
  relatedMessageThreadId?: Types.ObjectId;
  relatedMessageId?: Types.ObjectId;
  relatedWhatsAppMessageId?: Types.ObjectId;
  relatedSmsMessageId?: Types.ObjectId;

  metadata?: Record<string, unknown>;

  createdAt: Date;
  updatedAt: Date;
}
```

## Required Indexes

```ts
communicationDeliverySchema.index({ communicationId: 1, channel: 1, status: 1 });
communicationDeliverySchema.index({ schoolId: 1, channel: 1, status: 1, createdAt: -1 });
communicationDeliverySchema.index({ recipientUserId: 1, createdAt: -1 });
communicationDeliverySchema.index({ providerMessageId: 1 });
```

---

# 11.4 CommunicationTemplate Model

## Purpose

Reusable message templates for common school communication.

Examples:

- PTA meeting notice
- Fee reminder
- Attendance alert
- Emergency closure
- Exam notice
- Video meeting invitation
- Term reopening notice

## Schema

```ts
export interface ICommunicationTemplate {
  _id: Types.ObjectId;
  schoolId?: Types.ObjectId; // null/global for platform default templates

  name: string;
  description?: string;

  type: CommunicationType;

  titleTemplate: string;
  bodyTemplate: string;

  defaultChannels: {
    inApp: boolean;
    email: boolean;
    whatsapp: boolean;
    sms: boolean;
  };

  defaultPriority: CommunicationPriority;

  variables: Array<{
    key: string;
    label: string;
    required: boolean;
    example?: string;
  }>;

  isSystemDefault: boolean;
  isActive: boolean;

  createdBy?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}
```

---

# 11.5 CommunicationPreference Model

## Purpose

Stores user/contact preferences and consent across communication channels.

This replaces email-only preferences with a broader channel preference system.

## Schema

```ts
export interface ICommunicationPreference {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;

  userId?: Types.ObjectId;
  guardianId?: Types.ObjectId;
  studentId?: Types.ObjectId;

  role:
    | "parent"
    | "teacher"
    | "student"
    | "school_admin"
    | "headteacher"
    | "bursar"
    | "staff";

  channels: {
    inApp: {
      enabled: boolean;
    };
    email: {
      enabled: boolean;
      address?: string;
      verified?: boolean;
    };
    whatsapp: {
      enabled: boolean;
      phone?: string;
      verified?: boolean;
      consentAt?: Date;
    };
    sms: {
      enabled: boolean;
      phone?: string;
      verified?: boolean;
      consentAt?: Date;
    };
  };

  mutedTypes?: CommunicationType[];
  quietHours?: {
    enabled: boolean;
    startTime: string;
    endTime: string;
    timezone: string;
  };

  createdAt: Date;
  updatedAt: Date;
}
```

---

# 11.6 CommunicationSuppression Model

## Purpose

Prevents sending to blocked, unsubscribed, bounced, invalid, or suppressed destinations.

## Schema

```ts
export interface ICommunicationSuppression {
  _id: Types.ObjectId;

  schoolId?: Types.ObjectId;

  channel: "email" | "whatsapp" | "sms";
  destination: string;

  reason:
    | "bounce"
    | "complaint"
    | "unsubscribe"
    | "invalid_contact"
    | "manual_block"
    | "provider_block";

  source?: "brevo" | "meta_whatsapp" | "sms_provider" | "manual" | "system";

  createdAt: Date;
  expiresAt?: Date;
}
```

---

# 11.7 CommunicationProviderEvent Model

## Purpose

Stores provider webhook events for email, WhatsApp, and SMS.

## Schema

```ts
export interface ICommunicationProviderEvent {
  _id: Types.ObjectId;

  schoolId?: Types.ObjectId;
  communicationId?: Types.ObjectId;
  deliveryId?: Types.ObjectId;

  channel: "email" | "whatsapp" | "sms";
  provider: "brevo" | "meta_whatsapp" | "sms_provider";

  providerMessageId?: string;
  eventType:
    | "queued"
    | "sent"
    | "delivered"
    | "opened"
    | "clicked"
    | "bounced"
    | "failed"
    | "complained"
    | "unsubscribed"
    | "reply_received";

  rawPayload: Record<string, unknown>;

  occurredAt?: Date;
  createdAt: Date;
}
```

---

# 11.8 CommunicationOutboxJob Model

## Purpose

General queue/outbox for sending through all channels.

This may replace or sit above `EmailDispatchJob`.

## Schema

```ts
export interface ICommunicationOutboxJob {
  _id: Types.ObjectId;

  communicationId: Types.ObjectId;
  deliveryId: Types.ObjectId;
  schoolId: Types.ObjectId;

  channel: "in_app" | "email" | "whatsapp" | "sms";

  status:
    | "pending"
    | "processing"
    | "completed"
    | "failed"
    | "dead_letter";

  attempts: number;
  maxAttempts: number;
  nextAttemptAt?: Date;
  lockedAt?: Date;
  lockedBy?: string;

  errorMessage?: string;

  createdAt: Date;
  updatedAt: Date;
}
```

---

# 11.9 WhatsAppMessage Model

## Purpose

Stores WhatsApp-specific outbound and inbound messages.

## Schema

```ts
export interface IWhatsAppMessage {
  _id: Types.ObjectId;

  schoolId: Types.ObjectId;
  communicationId?: Types.ObjectId;
  deliveryId?: Types.ObjectId;

  direction: "outbound" | "inbound";

  from: string;
  to: string;

  messageType: "template" | "text" | "media";

  templateName?: string;
  templateLanguage?: string;
  templateParams?: Record<string, string>;

  body?: string;
  mediaUrl?: string;

  provider: "meta_whatsapp";
  providerMessageId?: string;

  status?: "queued" | "sent" | "delivered" | "read" | "failed";
  rawPayload?: Record<string, unknown>;

  createdAt: Date;
  updatedAt: Date;
}
```

---

# 11.10 SmsMessage Model

## Purpose

Stores SMS-specific outbound and inbound messages.

## Schema

```ts
export interface ISmsMessage {
  _id: Types.ObjectId;

  schoolId: Types.ObjectId;
  communicationId?: Types.ObjectId;
  deliveryId?: Types.ObjectId;

  direction: "outbound" | "inbound";

  from?: string;
  to: string;

  body: string;
  segments: number;
  estimatedCost?: number;

  provider: "sms_provider";
  providerMessageId?: string;

  status?: "queued" | "sent" | "delivered" | "failed";
  rawPayload?: Record<string, unknown>;

  createdAt: Date;
  updatedAt: Date;
}
```

---

## 12. Services and Utilities

Recommended folder structure:

```txt
src/lib/communications/
  audience/
    resolveAudience.ts
    resolveParents.ts
    resolveTeachers.ts
    resolveStudents.ts
    resolveFeeDefaulters.ts
    resolveAttendanceCases.ts
  channels/
    inAppAdapter.ts
    emailAdapter.ts
    whatsappAdapter.ts
    smsAdapter.ts
  delivery/
    createDeliveryRecords.ts
    dispatchCommunication.ts
    processOutboxJobs.ts
    updateDeliveryStatus.ts
    retryFailedDeliveries.ts
  routing/
    buildReplyAlias.ts
    parseReplyAlias.ts
    routeInboundEmail.ts
    routeInboundWhatsapp.ts
  templates/
    renderTemplate.ts
    defaultTemplates.ts
  preferences/
    getCommunicationPreferences.ts
    applyCommunicationPreferences.ts
  suppressions/
    checkSuppression.ts
    createSuppression.ts
  reports/
    getCommunicationSummary.ts
    getDeliveryBreakdown.ts
```

---

## 13. Audience Resolution Service

### 13.1 Purpose

The audience resolver is one of the most important parts of the engine.

It turns a high-level audience selection into actual recipients.

Example input:

```ts
{
  schoolId,
  audience: {
    type: "class_groups",
    classGroupIds: ["..."]
  },
  targetRoles: ["parent"]
}
```

Example output:

```ts
[
  {
    userId: "...",
    guardianId: "...",
    role: "parent",
    name: "Ama Mensah",
    email: "ama@example.com",
    phone: "0240000000",
    whatsappPhone: "0240000000",
    linkedStudentIds: ["..."],
    classGroupIds: ["..."]
  }
]
```

### 13.2 Required Resolver Capabilities

The resolver must support:

- all parents in a school,
- parents of selected class groups,
- parents of selected students,
- all teachers,
- teachers assigned to selected class groups,
- teachers assigned to selected subjects,
- all students,
- selected students,
- all school admins/staff,
- fee defaulters,
- attendance alert recipients,
- custom users,
- custom external contacts.

### 13.3 Recipient Deduplication

The resolver must deduplicate recipients.

If one parent has two children in the same class group, they should receive one communication unless the communication is intentionally child-specific.

### 13.4 Missing Contact Handling

The resolver must identify:

- users without email,
- users without phone,
- users without WhatsApp consent,
- users without app account,
- invalid contacts,
- suppressed contacts.

This information should be shown before sending.

---

## 14. Channel Routing Service

### 14.1 Purpose

The channel router decides which delivery records to create for each recipient.

It must consider:

- selected channels,
- recipient available contact details,
- preferences,
- consent,
- suppressions,
- priority,
- quiet hours,
- fallback rules.

### 14.2 Example Rules

1. Always create in-app delivery if recipient has a user account.
2. Send email if email channel is selected and recipient has valid email.
3. Send WhatsApp if selected, phone exists, and consent exists.
4. Send SMS if selected and phone exists.
5. Skip delivery if contact is suppressed.
6. Respect quiet hours unless communication is critical.
7. For emergency alerts, allow quiet hours bypass.
8. For SMS, check school SMS credits before queuing.

---

## 15. Dispatch Flow

### 15.1 Draft Creation Flow

```txt
Admin/teacher creates communication
→ Communication saved as draft
→ Audience can be previewed
→ Channels can be selected
→ Recipient/channel counts are shown
```

### 15.2 Send Now Flow

```txt
User clicks Send
→ Permission check
→ Audience is resolved
→ Audience snapshot is created
→ Channel router creates delivery records
→ Outbox jobs are created
→ Communication status becomes queued/sending
→ Worker processes jobs
→ Delivery statuses update
→ Communication summary updates
```

### 15.3 Scheduled Send Flow

```txt
User schedules communication
→ Communication status becomes scheduled
→ Cron checks scheduled communications
→ At scheduled time, dispatch flow begins
```

### 15.4 Dispatch Must Be Asynchronous

Do not send hundreds of emails/SMS/WhatsApp messages directly inside the request lifecycle.

Use outbox jobs and a worker/cron processor.

---

## 16. Channel Adapters

## 16.1 In-App Adapter

### Purpose

Creates internal `Notification` records.

### Behavior

For each in-app delivery:

1. Create `Notification`.
2. Link `CommunicationDelivery.relatedNotificationId`.
3. Mark delivery as `sent` or `delivered`.
4. If push notifications are later supported, enqueue push delivery.

---

## 16.2 Email Adapter

### Purpose

Sends email using EduSentrix verified domain while preserving school identity.

### Sender Pattern

Use:

```txt
From: {{schoolName}} via EduSentrix <hello@tryedusentrix.app>
Reply-To: school+s_{{schoolId}}+c_{{communicationId}}+t_{{threadToken}}@reply.tryedusentrix.app
```

For billing:

```txt
From: {{schoolName}} Accounts via EduSentrix <billing@tryedusentrix.app>
Reply-To: billing+s_{{schoolId}}+c_{{communicationId}}+t_{{threadToken}}@reply.tryedusentrix.app
```

For no-reply:

```txt
From: {{schoolName}} via EduSentrix <no-reply@tryedusentrix.app>
Reply-To: no-reply@tryedusentrix.app
```

### Email Branding

Each school email should include:

- school name,
- optional school logo if available,
- EduSentrix powered-by footer,
- clear reply behavior.

Footer example:

```txt
This message was sent by {{schoolName}} through EduSentrix.
Replies are routed securely to {{schoolName}}.
```

### Email Domain Requirements

Use EduSentrix domain:

```txt
tryedusentrix.app
reply.tryedusentrix.app
```

Required DNS:

- SPF
- DKIM
- DMARC
- inbound routing/MX for `reply.tryedusentrix.app`

### Existing Email System

The existing email infrastructure can be reused if it is stable:

- EmailThread
- EmailMessage
- EmailEvent
- EmailDispatchJob
- inbound Brevo parser
- reply alias parser
- rate limiter
- suppressions
- preferences

However, outbound email must now be triggered through the Communications Engine.

---

## 16.3 WhatsApp Adapter

### Purpose

Send WhatsApp messages to parents/staff through a real provider.

Recommended provider path:

- Meta WhatsApp Cloud API, or
- a reliable WhatsApp Business API provider.

### Important WhatsApp Rule

Business-initiated WhatsApp messages usually require approved templates.

The system should support WhatsApp templates such as:

```txt
FEE_REMINDER
ATTENDANCE_ALERT
GENERAL_NOTICE
PTA_MEETING_NOTICE
PAYMENT_CONFIRMATION
EMERGENCY_ALERT
VIDEO_MEETING_INVITE
TERM_REOPENING_NOTICE
```

### WhatsApp Adapter Functions

```ts
sendWhatsAppTemplateMessage({
  to,
  templateName,
  language,
  params,
  communicationId,
  deliveryId,
  schoolId,
});

sendWhatsAppTextMessage({
  to,
  body,
  communicationId,
  deliveryId,
  schoolId,
});

handleWhatsAppWebhook(payload);
```

### Consent

WhatsApp sending must respect consent.

Do not send bulk WhatsApp messages to contacts without permission/opt-in.

---

## 16.4 SMS Adapter

### Purpose

Send short messages through an SMS provider.

### SMS Use Cases

- emergency notices,
- fee reminders,
- attendance alerts,
- meeting reminders,
- fallback when WhatsApp/email fails.

### SMS Controls

SMS costs money, so add controls:

- school SMS credit balance,
- estimated cost before sending,
- character/segment count,
- permission for bulk SMS,
- approval for expensive sends,
- delivery status tracking.

### SMS Adapter Function

```ts
sendSms({
  to,
  body,
  schoolId,
  communicationId,
  deliveryId,
});
```

---

## 17. Email Reply Routing

### 17.1 Goal

EduSentrix should use its own domain but still know which school sent the email and where replies should go.

### 17.2 Reply Alias Format

Use structured aliases:

```txt
school+s_<schoolId>+c_<communicationId>+t_<threadToken>@reply.tryedusentrix.app
```

For billing:

```txt
billing+s_<schoolId>+c_<communicationId>+t_<threadToken>@reply.tryedusentrix.app
```

For academic:

```txt
academic+s_<schoolId>+c_<communicationId>+t_<threadToken>@reply.tryedusentrix.app
```

### 17.3 Inbound Email Flow

```txt
Parent replies to email
→ Email goes to reply.tryedusentrix.app
→ Brevo inbound webhook receives email
→ Parser extracts schoolId, communicationId, threadToken
→ System finds/creates EmailThread
→ EmailMessage is saved
→ CommunicationProviderEvent is saved
→ School inbox unread count updates
→ Admin/teacher sees reply in appropriate inbox
```

### 17.4 Inbox Types

Support multiple school inbox contexts:

```txt
General Inbox
Billing Inbox
Academic Inbox
Support Inbox
```

---

## 18. UI/UX Requirements

## 18.1 School Admin Communication Center

Route suggestion:

```txt
/admin/communications
```

Sections:

```txt
Overview
Announcements
Notices
Messages
Email Inbox
WhatsApp/SMS Logs
Templates
Audiences
Delivery Reports
Preferences
```

### Overview Cards

Show:

- communications sent this week,
- pending scheduled messages,
- failed deliveries,
- unread replies,
- SMS credits,
- WhatsApp delivery health,
- recent announcements.

---

## 18.2 Create Communication Flow

Route:

```txt
/admin/communications/new
```

Recommended steps:

### Step 1: Message Type

Select:

- Notice
- Announcement
- Fee Reminder
- Attendance Alert
- Academic Update
- Emergency Alert
- Video Meeting Invite
- Direct Message

### Step 2: Audience

Select:

- entire school
- parents
- teachers
- students
- staff
- class groups
- grades
- fee defaulters
- attendance cases
- custom recipients

### Step 3: Compose

Fields:

- title
- body
- attachments
- template selector
- AI draft button, future
- language option, future

### Step 4: Channels

Select:

- in-app
- email
- WhatsApp
- SMS

Show channel availability:

```txt
Recipients found: 250
In-app reachable: 180
Email reachable: 220
WhatsApp reachable: 190
SMS reachable: 240
Missing contact details: 10
Opted out: 5
Estimated SMS cost: GHS ...
```

### Step 5: Review

Show:

- message preview,
- recipients summary,
- selected channels,
- delivery warnings,
- cost estimate,
- schedule/send options.

### Step 6: Send or Schedule

Actions:

- Save Draft
- Schedule
- Send Now

---

## 18.3 Delivery Report Page

For each communication, show:

```txt
Total recipients
Total deliveries
Sent
Delivered
Read
Failed
Skipped
Replies
```

Breakdown by channel:

```txt
In-app: sent/read
Email: sent/delivered/opened/bounced
WhatsApp: sent/delivered/read/failed
SMS: sent/delivered/failed
```

Also show failed recipients and reasons.

Actions:

- retry failed,
- export report,
- message recipients who failed via another channel,
- view replies.

---

## 18.4 Teacher Communication UI

Teachers should have a simplified communication area.

Route:

```txt
/teacher/communications
```

Capabilities:

- send class notices,
- message parents of assigned students,
- message assigned class groups,
- view replies,
- view delivery reports for own messages.

Teachers should not see complex SMS/WhatsApp budget controls unless allowed.

---

## 18.5 Parent Mobile App

Parents should see:

- notices,
- messages,
- fee reminders,
- attendance alerts,
- video meeting invites,
- unread counts,
- reply where enabled.

---

## 18.6 Student Mobile App

Students should see:

- academic notices,
- lesson updates,
- exam notices,
- school announcements,
- video meeting invites,
- messages where enabled.

---

## 19. Templates

### 19.1 Default Templates

Seed these templates:

1. PTA Meeting Notice
2. Fee Payment Reminder
3. Exam Notice
4. Attendance Alert
5. Emergency School Closure
6. Term Reopening Notice
7. Video Meeting Invitation
8. General Announcement
9. Academic Update
10. Event Notice

### 19.2 Template Variables

Support variables:

```txt
{{schoolName}}
{{studentName}}
{{parentName}}
{{classGroupName}}
{{feeBalance}}
{{dueDate}}
{{meetingDate}}
{{meetingTime}}
{{meetingLink}}
{{academicPeriod}}
{{termName}}
{{teacherName}}
```

---

## 20. AI Assistance

AI should be added after the core engine is working.

### 20.1 AI Features

- Draft announcement
- Rewrite notice professionally
- Shorten for SMS
- Convert email to WhatsApp-friendly version
- Generate fee reminder
- Generate PTA notice
- Generate emergency message
- Suggest best audience
- Summarize replies
- Summarize delivery failures
- Translate message, future

### 20.2 AI Safety

AI-generated messages must always require human review before sending.

Show:

```txt
AI-generated draft. Please review before sending.
```

---

## 21. Scheduling and Automation

### 21.1 Scheduled Communications

Support scheduling:

```txt
Send now
Send later
Recurring, future phase
```

### 21.2 Automated Communications

Future automated triggers:

- fee due reminders,
- overdue fee reminders,
- daily absence alerts,
- exam reminder,
- term reopening reminders,
- video meeting reminders.

Automation must still respect preferences and channel policy.

---

## 22. Reporting and Analytics

Communication reporting should show:

- communications by type,
- communications by channel,
- delivery success rate,
- failed delivery rate,
- most active audiences,
- unread notices,
- reply volume,
- SMS usage,
- WhatsApp usage,
- email bounce rate.

Platform admin should see provider-level health:

- email delivery health,
- WhatsApp failures,
- SMS failures,
- suppressed destinations,
- schools with high failure rates.

---

## 23. API Routes

Recommended API routes:

### Communication

```txt
GET    /api/admin/communications
POST   /api/admin/communications
GET    /api/admin/communications/[id]
PATCH  /api/admin/communications/[id]
DELETE /api/admin/communications/[id]
POST   /api/admin/communications/[id]/preview-audience
POST   /api/admin/communications/[id]/send
POST   /api/admin/communications/[id]/schedule
POST   /api/admin/communications/[id]/cancel
POST   /api/admin/communications/[id]/archive
GET    /api/admin/communications/[id]/deliveries
GET    /api/admin/communications/[id]/report
POST   /api/admin/communications/[id]/retry-failed
```

### Templates

```txt
GET    /api/admin/communication-templates
POST   /api/admin/communication-templates
GET    /api/admin/communication-templates/[id]
PATCH  /api/admin/communication-templates/[id]
DELETE /api/admin/communication-templates/[id]
```

### Inbox

```txt
GET  /api/admin/communications/inbox
GET  /api/admin/communications/inbox/threads/[id]
POST /api/admin/communications/inbox/threads/[id]/reply
```

### Preferences

```txt
GET   /api/admin/communication-preferences
PATCH /api/admin/communication-preferences/[id]
```

### Provider Webhooks

```txt
POST /api/webhooks/email/brevo
POST /api/webhooks/whatsapp/meta
POST /api/webhooks/sms/provider
```

### Worker/Cron

```txt
POST /api/jobs/communications/process-outbox
POST /api/jobs/communications/process-scheduled
POST /api/jobs/communications/retry-failed
```

---

## 24. Background Jobs

The system needs background job processing.

### 24.1 Process Scheduled Communications

Runs every minute or every few minutes.

```txt
Find scheduled communications whose scheduledFor <= now
Dispatch them
```

### 24.2 Process Outbox Jobs

Runs frequently.

```txt
Find pending jobs
Lock job
Send through adapter
Update delivery
Update job
```

### 24.3 Retry Failed Jobs

Runs periodically.

```txt
Retry failed jobs with attempts < maxAttempts
Dead-letter permanently failed jobs
```

---

## 25. Security, Privacy, and Compliance

### 25.1 Access Control

Every action must enforce school membership and role permissions.

### 25.2 School Isolation

A user from School A must never see communications from School B.

Every query must include `schoolId`.

### 25.3 Sensitive Data

Communication may include student, fee, attendance, and parent data.

Ensure:

- no cross-school leaks,
- no unauthorized recipient access,
- no exposed internal metadata,
- secure reply token validation,
- audit logs for sending.

### 25.4 Consent

WhatsApp and SMS require proper consent/opt-in.

Email must support unsubscribe/suppression for non-essential communications where appropriate.

Emergency and required school communication may have different policy rules, but must be handled carefully.

### 25.5 Audit Logs

Log:

- communication created,
- edited,
- sent,
- scheduled,
- cancelled,
- archived,
- failed,
- retried,
- replied to,
- preference changed,
- suppression added.

---

## 26. Environment Variables

```env
COMMUNICATIONS_ENABLED=true

EMAIL_PROVIDER=brevo
EMAIL_FROM_DEFAULT="EduSentrix <hello@tryedusentrix.app>"
EMAIL_BILLING_FROM="EduSentrix Billing <billing@tryedusentrix.app>"
EMAIL_REPLY_DOMAIN=reply.tryedusentrix.app
BREVO_API_KEY=
BREVO_INBOUND_SECRET=

WHATSAPP_PROVIDER=meta
META_WHATSAPP_TOKEN=
META_WHATSAPP_PHONE_NUMBER_ID=
META_WHATSAPP_WEBHOOK_SECRET=

SMS_PROVIDER=
SMS_API_KEY=
SMS_SENDER_ID=EduSentrix

COMMUNICATION_OUTBOX_BATCH_SIZE=50
COMMUNICATION_MAX_RETRY_ATTEMPTS=3
```

---

## 27. Migration / Fresh Start Plan

Because there are no real schools yet, use a clean replacement strategy.

### 27.1 Recommended Approach

1. Keep existing email infrastructure if stable.
2. Remove or stop using `Notice` for new communication.
3. Remove or stop using `LibraryNotice` for new communication.
4. Create new `Communication` and related models.
5. Build the new Communication Center UI.
6. Route all new notices/announcements through `Communication`.
7. Integrate in-app notifications as a channel output.
8. Integrate existing email as a channel output.
9. Replace WhatsApp stub with real adapter architecture.
10. Add SMS adapter.

### 27.2 Test Data

Existing test notices can be deleted or ignored.

Seed new demo communications for:

- PTA meeting notice
- Fee reminder
- Attendance alert
- Emergency alert
- Exam notice
- Video meeting invite

---

## 28. Implementation Phases

## Phase 1 — Foundation

Deliverables:

- Communication model
- CommunicationDelivery model
- CommunicationAudienceSnapshot model
- CommunicationTemplate model
- CommunicationPreference model
- CommunicationOutboxJob model
- Audience resolver
- Channel router
- In-app adapter
- Basic email adapter using existing email system
- Basic admin Communication Center list/create/send flow

Acceptance:

- Admin can create a communication.
- Admin can select audience and channels.
- System resolves recipients.
- System creates delivery records.
- In-app notifications are created.
- Emails are queued/sent through existing provider.

---

## Phase 2 — Notices and Announcements Replacement

Deliverables:

- Replace admin/teacher notice creation with Communication.
- Retire legacy `Notice` and `LibraryNotice` screens.
- Add communication templates.
- Add recipient preview.
- Add delivery report page.

Acceptance:

- School admins can send notices and announcements through the new engine.
- Teachers can send class notices within assignment scope.
- Delivery reports show recipient/channel status.

---

## Phase 3 — Email Inbox and Reply Routing

Deliverables:

- School-aware sender names.
- Reply aliases.
- Inbound reply routing.
- General/billing/academic inboxes.
- Reply from inbox.
- Thread linking to Communication.

Acceptance:

- Email sent by a school uses EduSentrix domain.
- Reply goes to correct school inbox.
- Reply is linked to the original Communication.

---

## Phase 4 — WhatsApp

Deliverables:

- WhatsApp provider adapter.
- WhatsApp template registry.
- WhatsApp delivery records.
- WhatsApp webhook handling.
- Consent checks.
- WhatsApp logs.

Acceptance:

- Admin can send approved WhatsApp template messages.
- Delivery status updates from provider webhooks.
- Contacts without consent are skipped.

---

## Phase 5 — SMS

Deliverables:

- SMS adapter.
- SMS delivery records.
- SMS cost/segment preview.
- SMS credit/budget controls.
- SMS delivery reports.

Acceptance:

- Admin can send SMS when allowed.
- Estimated cost is shown before sending.
- SMS delivery statuses are tracked.

---

## Phase 6 — Advanced Automation and AI

Deliverables:

- AI message drafting.
- AI SMS shortening.
- AI audience suggestions.
- Automated fee reminders.
- Automated attendance alerts.
- Communication analytics dashboard.

Acceptance:

- AI can draft editable messages.
- Automated communications respect preferences.
- Admin can see communication performance analytics.

---

## 29. Testing Requirements

### 29.1 Unit Tests

Test:

- audience resolution,
- recipient deduplication,
- placeholder rendering,
- channel routing,
- suppression checks,
- preference application,
- reply alias parsing,
- SMS segment calculation,
- communication status transitions.

### 29.2 Integration Tests

Test:

1. Send announcement to all parents via in-app and email.
2. Send class notice from teacher to assigned class parents.
3. Prevent teacher from messaging unassigned class.
4. Send fee reminder to fee defaulters.
5. Skip recipients without contact details.
6. Skip suppressed emails.
7. Route email reply to correct school inbox.
8. Create delivery records for each channel.
9. Retry failed deliveries.
10. Schedule communication and send at correct time.

### 29.3 UI Tests

Test:

- create communication wizard,
- audience preview,
- channel selection,
- delivery report,
- inbox view,
- template selection,
- failed delivery retry.

### 29.4 Security Tests

Test:

- cross-school access blocked,
- role permissions enforced,
- public webhooks validated,
- reply tokens validated,
- unauthorized SMS/WhatsApp sending blocked.

---

## 30. Acceptance Criteria

The Communications Engine is complete when:

1. Schools can create notices and announcements from one Communication Center.
2. Schools can select audiences such as parents, teachers, students, class groups, grades, fee defaulters, and custom recipients.
3. Schools can send through in-app, email, WhatsApp, and SMS.
4. Email uses the EduSentrix domain while clearly identifying the sending school.
5. Incoming email replies are routed to the correct school inbox.
6. Delivery records are created per recipient per channel.
7. Admins can see sent, delivered, read, failed, skipped, and replied statuses.
8. Teachers can only communicate with allowed classes/students/parents.
9. Parents and students can receive notices/messages in the mobile app.
10. WhatsApp and SMS respect consent/preferences.
11. Failed deliveries can be retried.
12. Legacy Notice and LibraryNotice models are no longer the main source of truth.
13. The system supports future AI drafting and automated reminders.
14. All communication is school-isolated and permission-checked.
15. The system can support real school operations without fragmented communication flows.

---

## 31. Recommended MVP Build Order

Build in this exact order:

1. Communication models
2. Communication templates seed
3. Audience resolver
4. Channel router
5. In-app adapter
6. Email adapter using existing email system
7. Communication create API
8. Audience preview API
9. Send communication API
10. Admin Communication Center UI
11. Delivery report UI
12. Teacher scoped communication UI
13. Email reply routing polish
14. WhatsApp adapter
15. SMS adapter
16. AI drafting

This order gives a working engine early and avoids spending too much time on WhatsApp/SMS before the core architecture is stable.

---

## 32. Final Recommendation

Do not patch the current Notices module in isolation.

Build the new Communications Engine as the official source of truth, then remove or retire old notice and library notice flows.

The most important pieces are:

1. `Communication` as the parent message/campaign record.
2. `CommunicationAudienceSnapshot` to preserve who was targeted.
3. `CommunicationDelivery` as the delivery ledger.
4. Audience resolver to prevent sending to the wrong people.
5. Channel router to apply preferences, contact availability, and consent.
6. Existing email infrastructure reused as a channel.
7. Real WhatsApp and SMS adapters added as separate channels.
8. Communication Center UI for school admins and scoped communication UI for teachers.

If implemented properly, this will make EduSentrix’s communication system a major competitive advantage.

The school will not just “post notices.” It will manage official school communication with accountability, delivery tracking, and multi-channel reach.
