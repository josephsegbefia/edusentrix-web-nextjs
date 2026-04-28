# Student Accounts And Messaging Spec

## 1. Purpose

Student accounts give eligible learners a controlled academic workspace for assignments, quizzes, results, timetable, calendar, notices, profile, and teacher communication.

The platform already has student routes and student APIs. This spec defines the missing account lifecycle, permission boundaries, messaging policy, Leo moderation, parent-copy rules, password reset process, and graduation behavior.

## 2. Product Position

Student accounts are not a social network. They are a supervised school workspace.

The first version should focus on:

- academic work
- assignment submission
- quiz participation
- results visibility
- school notices
- timetable and calendar
- controlled teacher-student messaging
- safe account lifecycle management

Avoid adding social feeds, student-to-student direct messaging, public profiles, reactions, or open discussion channels in this phase.

## 3. Eligibility

Student login is only available for:

- Upper Primary
- JHS
- SHS

Student login is not available by default for:

- Nursery
- Kindergarten
- Lower Primary

Implementation must not depend only on grade names. Add a school-controlled eligibility layer:

```ts
type StudentLoginEligibilityLevel =
  | "upper_primary"
  | "jhs"
  | "shs";
```

Each grade should resolve to an eligibility level using school type and grade metadata. Schools may need a setting later to map custom grade labels.

## 4. Student Account States

```ts
type StudentAccountStatus =
  | "not_invited"
  | "invited"
  | "active"
  | "suspended"
  | "readonly"
  | "disabled";
```

State meanings:

- `not_invited`: Student record exists, but no login has been created.
- `invited`: Activation email has been sent, but the student has not activated.
- `active`: Student can sign in and use allowed features.
- `suspended`: Login is temporarily blocked by admin.
- `readonly`: Student can sign in to view historical records, but cannot submit work or send messages.
- `disabled`: Student cannot sign in.

Graduated students should become `readonly` by default.

Withdrawn or deleted students should become `disabled` by default unless the school explicitly keeps readonly archive access.

## 5. Data Model

### Student Model Additions

Add fields to the existing `Student` model:

```ts
type StudentAccount = {
  userId?: ObjectId | null;
  email?: string | null;
  status: StudentAccountStatus;
  eligibleForLogin: boolean;
  invitedAt?: Date | null;
  activatedAt?: Date | null;
  suspendedAt?: Date | null;
  suspendedByUserId?: ObjectId | null;
  readonlyAt?: Date | null;
  disabledAt?: Date | null;
  lastLoginAt?: Date | null;
};
```

Suggested indexes:

- `{ schoolId: 1, "account.userId": 1 }`
- `{ schoolId: 1, "account.email": 1 }`
- `{ schoolId: 1, "account.status": 1 }`

The student `userId` must link to the auth user and must not be reused across students.

## 6. Account Provisioning

### Admin Flow

Admins can:

- invite one eligible student
- bulk invite eligible students
- resend activation email
- suspend account
- reactivate suspended account
- set account readonly
- disable account
- reset password

### Homeroom Teacher Flow

Homeroom teachers can:

- invite students in their homeroom class
- resend activation emails for their homeroom students
- initiate password reset for their homeroom students

Homeroom teachers cannot:

- see generated passwords
- manually set a student password
- disable account permanently
- override eligibility
- change student account to readonly unless this is part of a controlled graduation flow

### Invite Rules

Student accounts can be created only when:

- student belongs to the school
- student is active
- student is in an eligible level
- student has an email address
- student does not already have an active linked user

If a student has no email address, the UI should show a clear action to add one.

## 7. Password Reset

Password resets can be initiated by:

- school admin
- homeroom teacher for students in their homeroom

Reset behavior:

- The admin or homeroom teacher clicks `Send password reset`.
- The system generates a secure one-time reset link or temporary password.
- The reset credential is emailed directly to the student.
- The admin or homeroom teacher must never see the generated password or reset token.
- The reset token should expire.
- The reset action must be audited.

Preferred implementation:

- Use a one-time reset link instead of emailing a plaintext password.
- If the auth provider requires a generated temporary password, force password change on next login.

Audit event:

```ts
{
  action: "student_account.password_reset_requested",
  actorUserId,
  studentId,
  metadata: {
    initiatedBy: "admin" | "homeroom_teacher",
    delivery: "email"
  }
}
```

Do not store plaintext temporary passwords.

## 8. Student Workspace

The student workspace should include:

- Dashboard: `/student`
- Assignments: `/student/assignments`
- Assignment detail and submission: `/student/assignments/[id]`
- Results: `/student/results`
- Timetable: `/student/timetable`
- Calendar: `/student/calendar`
- Notices: `/student/notices`
- Messages: `/student/messages`
- Profile: `/student/profile`

The existing student sidebar should add `Messages` once messaging is implemented.

Readonly students can access:

- dashboard
- historical assignments
- results
- timetable archive where available
- notices archive
- profile
- messages archive, read-only

Readonly students cannot:

- submit assignments
- start quizzes
- upload files
- send messages
- edit profile fields except safe account preferences if supported

## 9. Messaging Scope

Allowed messaging:

- Student can message their teachers.
- Teacher can message individual students they teach.
- Teacher can message students in their homeroom.
- Admin can view/audit message metadata and moderation outcomes according to policy.

Not allowed in this phase:

- Student-to-student direct messages.
- Student-created group chats.
- Cross-school messaging.
- Messaging teachers who do not teach or supervise the student.

Thread types:

```ts
type StudentMessageThreadType =
  | "student_teacher"
  | "student_homeroom_teacher"
  | "teacher_student";
```

## 10. Messaging Authorization

A student can message a teacher only if:

- student account is active
- student is not readonly, suspended, or disabled
- teacher belongs to the same school
- teacher is assigned to the student's class/subject or is the homeroom teacher

A teacher can message a student only if:

- teacher account is active
- student belongs to the same school
- teacher teaches the student's class/subject or is the homeroom teacher
- student account is active

School admin can configure whether teachers may initiate individual student messages. Default: enabled for eligible student accounts.

## 11. Strict Messaging Policy

Every student-teacher message must pass a policy check before sending.

Policy goals:

- protect students
- prevent harassment, abuse, grooming, threats, exploitation, or inappropriate personal content
- keep communication school-related
- discourage sharing private contact details
- detect self-harm or safeguarding concerns
- detect bullying or discriminatory language
- detect attempts to bypass the platform

### Message Policy Categories

```ts
type MessagePolicyDecision =
  | "allow"
  | "allow_with_parent_copy"
  | "block"
  | "escalate";
```

Decision meanings:

- `allow`: message is sent normally.
- `allow_with_parent_copy`: message is sent and parent/guardian is copied.
- `block`: message is not sent. Sender sees a safe, generic explanation.
- `escalate`: message is not sent or is held for review, and designated staff are alerted.

### Examples

Allow:

- homework clarification
- timetable question
- assignment feedback
- absence follow-up
- school event question

Allow with parent copy:

- repeated missed work
- behavior concern
- health/safety logistics
- sensitive performance concern
- after-hours message where school policy requires guardian visibility

Block:

- insulting or threatening content
- sexually inappropriate content
- request to move conversation to private phone/social media
- sharing private contact details in a risky context
- non-school personal conversation that crosses boundaries

Escalate:

- self-harm
- abuse disclosure
- threats of violence
- exploitation or grooming signals
- serious bullying
- illegal activity

## 12. Leo Moderation

Leo should check every outbound student-teacher message before it is delivered.

### Moderation Input

```ts
type LeoMessageModerationInput = {
  schoolId: string;
  senderUserId: string;
  senderRole: "student" | "teacher";
  recipientUserId: string;
  recipientRole: "student" | "teacher";
  threadId?: string | null;
  messageText: string;
  attachments: Array<{
    fileName: string;
    mimeType: string;
    sizeBytes: number;
  }>;
  context: {
    studentId: string;
    teacherId: string;
    relationship: "subject_teacher" | "homeroom_teacher";
    sentAtLocal: string;
    isAfterHours: boolean;
    priorPolicyFlagsCount: number;
  };
};
```

### Moderation Output

```ts
type LeoMessageModerationOutput = {
  decision: MessagePolicyDecision;
  reasons: string[];
  parentCopyRecommended: boolean;
  parentCopyRequired: boolean;
  escalationType?: "safeguarding" | "bullying" | "self_harm" | "abuse" | "other";
  userFacingMessage?: string;
};
```

### Moderation Requirements

- Message is not persisted as sent until Leo returns a decision.
- If Leo fails, use conservative fallback:
  - for ordinary academic messages, hold for retry or staff review
  - do not silently send unchecked messages
- Store moderation result with the message.
- Store enough metadata for audit without exposing sensitive model internals to students.
- Admin-facing audit can show policy category and outcome.

## 13. Parent Copy Rules

Parent copying is optional by default, but Leo can recommend or require it.

Parent copy modes:

```ts
type ParentCopyMode =
  | "none"
  | "suggested"
  | "required_by_policy"
  | "required_by_school_setting";
```

School-level settings:

```ts
type StudentMessagingSettings = {
  enabled: boolean;
  teacherInitiatedMessagesEnabled: boolean;
  studentInitiatedMessagesEnabled: boolean;
  parentCopyDefault: "off" | "teacher_choice" | "always";
  requireParentCopyForAfterHours: boolean;
  requireParentCopyForLowerEligibleLevels: boolean;
  allowLeoToRequireParentCopy: boolean;
  holdEscalatedMessagesForReview: boolean;
};
```

Defaults:

- `enabled: true`
- `teacherInitiatedMessagesEnabled: true`
- `studentInitiatedMessagesEnabled: true`
- `parentCopyDefault: "teacher_choice"`
- `requireParentCopyForAfterHours: true`
- `requireParentCopyForLowerEligibleLevels: true`
- `allowLeoToRequireParentCopy: true`
- `holdEscalatedMessagesForReview: true`

If Leo requires parent copy, the sender cannot override it.

If Leo suggests parent copy, the UI should show:

`Leo recommends copying the parent/guardian for this message.`

The teacher can accept or revise the message if policy allows.

For student-authored messages, if Leo recommends parent copy, the system should either copy automatically or hold for teacher/admin review depending on school settings.

## 14. Messaging UI

### Student Messages Page

Route:

`/student/messages`

UI:

- dark premium workspace matching student sidebar
- thread list on the left on desktop
- message panel on the right
- mobile uses stacked thread list/detail
- clear teacher identity and subject/class context
- composer at bottom
- attachment support only if allowed

Composer behavior:

- `Send` triggers Leo policy check.
- While checking, show `Checking message...`
- If allowed, send immediately.
- If parent copy is required, show a small badge in the sent message.
- If blocked, show a short non-technical explanation.
- If escalated, show a calm message: `This message needs staff review before it can be sent.`

### Teacher Messages Page

Existing teacher messaging should be extended to include student recipients.

Recipient picker:

- Use `PremiumSelect` or an existing searchable command picker.
- Group recipients by class/homeroom.
- Clearly distinguish student and parent recipients.

Before sending:

- Show parent-copy option when applicable.
- If Leo requires parent copy, lock the checkbox on.
- If Leo blocks/escalates, do not send.

## 15. Messaging Data Model

If existing message models can support this safely, extend them. Otherwise add explicit student messaging fields.

Suggested thread fields:

```ts
type MessageThread = {
  schoolId: ObjectId;
  type: "student_teacher";
  participantUserIds: ObjectId[];
  studentId: ObjectId;
  teacherId: ObjectId;
  parentCopiedUserIds: ObjectId[];
  lastMessageAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
```

Suggested message fields:

```ts
type Message = {
  schoolId: ObjectId;
  threadId: ObjectId;
  senderUserId: ObjectId;
  senderRole: "student" | "teacher";
  body: string;
  attachments: Array<{
    fileName: string;
    fileUrl: string;
    mimeType: string;
    sizeBytes: number;
  }>;
  status: "sent" | "blocked" | "held_for_review";
  parentCopyMode: ParentCopyMode;
  copiedParentUserIds: ObjectId[];
  moderation: {
    decision: MessagePolicyDecision;
    reasons: string[];
    parentCopyRecommended: boolean;
    parentCopyRequired: boolean;
    escalationType?: string | null;
    checkedAt: Date;
    provider: "leo";
  };
  createdAt: Date;
};
```

## 16. API Routes

Student:

```txt
GET  /api/student/messages/threads
POST /api/student/messages/threads
GET  /api/student/messages/threads/[threadId]
POST /api/student/messages/threads/[threadId]/messages
GET  /api/student/messages/recipients
```

Teacher:

```txt
GET  /api/teacher/messages/student-recipients
POST /api/teacher/messages/threads
POST /api/teacher/messages/threads/[threadId]/messages
```

Admin:

```txt
GET  /api/admin/student-accounts
POST /api/admin/student-accounts/invite
POST /api/admin/student-accounts/bulk-invite
POST /api/admin/student-accounts/[studentId]/resend-invite
POST /api/admin/student-accounts/[studentId]/reset-password
POST /api/admin/student-accounts/[studentId]/suspend
POST /api/admin/student-accounts/[studentId]/reactivate
POST /api/admin/student-accounts/[studentId]/readonly
POST /api/admin/student-accounts/[studentId]/disable
GET  /api/admin/student-messages/audit
```

Homeroom teacher:

```txt
POST /api/teacher/students/[studentId]/account/invite
POST /api/teacher/students/[studentId]/account/resend-invite
POST /api/teacher/students/[studentId]/account/reset-password
```

## 17. Audit Trail

Audit these events:

- `student_account.invited`
- `student_account.invite_resent`
- `student_account.activated`
- `student_account.password_reset_requested`
- `student_account.suspended`
- `student_account.reactivated`
- `student_account.readonly_enabled`
- `student_account.disabled`
- `student_message.sent`
- `student_message.blocked`
- `student_message.held_for_review`
- `student_message.parent_copied`
- `student_message.escalated`

Audit fields:

```ts
{
  schoolId,
  actorUserId,
  actorRole,
  action,
  entityType,
  entityId,
  studentId,
  teacherId,
  metadata,
  createdAt
}
```

Message audit metadata must include moderation decision, but should avoid storing duplicate sensitive message text unless required by existing audit policy.

## 18. Notifications And Email

Student account emails:

- activation invite
- password reset
- account suspended
- account reactivated
- account moved to readonly after graduation

Messaging notifications:

- new teacher message to student
- new student message to teacher
- parent copied on message
- held message requires review

Email templates should use the school brand where available.

## 19. Graduation And Readonly Mode

When students graduate:

- set account status to `readonly`
- preserve access to historical results and returned work
- block new assignment submissions
- block quiz starts
- block sending messages
- preserve message history as read-only

Admin can disable graduated accounts later.

Graduation flow should show a confirmation:

`Graduated student accounts will become read-only. They can view historical records but cannot submit work or send messages.`

## 20. Security And Privacy Requirements

- Students can only access their own data.
- Teachers can only message students they teach or supervise.
- Parent copy must use linked guardian records.
- Admin/homeroom teacher never sees generated passwords or reset tokens.
- Leo moderation must run before delivery.
- Blocked and escalated messages must not be delivered.
- Readonly students cannot mutate academic or messaging records.
- Suspended and disabled students cannot sign in.
- All account lifecycle changes must be audited.

## 21. Implementation Phases

### Phase 1: Account Lifecycle

- Add student account status fields.
- Add eligibility logic.
- Add admin invite/reset/suspend/reactivate/readonly/disable APIs.
- Add homeroom teacher invite/reset APIs.
- Add audit events.

### Phase 2: Student Workspace Hardening

- Polish `/student` dashboard.
- Ensure assignments, quizzes, results, timetable, calendar, notices, and profile enforce active/readonly behavior.
- Add empty states and access-denied states.

### Phase 3: Messaging Foundation

- Add student-teacher recipient resolution.
- Add threads/messages APIs.
- Add student messages UI.
- Extend teacher messages UI for student recipients.

### Phase 4: Leo Moderation

- Implement Leo message policy checker.
- Add message moderation persistence.
- Enforce allow/block/escalate/parent-copy decisions.
- Add admin audit view for moderation outcomes.

### Phase 5: Graduation Readonly

- Integrate readonly conversion into graduation/promotion workflows.
- Add readonly UI banners.
- Verify all student mutation routes block readonly accounts.

## 22. Acceptance Criteria

- Only eligible students can be invited.
- Admin can invite and manage student accounts.
- Homeroom teacher can reset password for their own homeroom students.
- Password reset sends directly to student and never reveals password/token to staff.
- Active student can log in and use student workspace.
- Readonly student can view history but cannot submit work or send messages.
- Student can message assigned teachers.
- Teacher can message individual students they teach or supervise.
- Every outbound student-teacher message is checked by Leo before delivery.
- Leo can allow, block, escalate, recommend parent copy, or require parent copy.
- Parent copy can be optional, suggested, or enforced.
- All account and messaging actions are audited.
