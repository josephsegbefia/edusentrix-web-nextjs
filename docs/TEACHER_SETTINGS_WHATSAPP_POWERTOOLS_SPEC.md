# Teacher Settings + WhatsApp Power Tools Spec

## 1) Purpose

Define a focused, high-impact settings experience for teachers and a cross-role WhatsApp Power Tool strategy (teacher, parent, admin) that covers only critical workflows.

This spec intentionally excludes low-impact platform-wide settings.

---

## 2) Product Goals

1. Give every teacher a dedicated settings page at `/teacher/settings`.
2. Let teachers link a WhatsApp number and explicitly opt into automation.
3. Prioritize operational communication flows that improve attendance, assignment completion, and urgent escalation follow-up.
4. Keep admins in control of school-wide channel policy while giving teachers personal control of delivery preferences.

---

## 3) Non-Goals

1. Rebuilding all admin settings for teachers.
2. Building a complete WhatsApp bot covering every web feature.
3. Replacing in-app workflows with chat-first workflows in v1.

---

## 4) IA: Teacher Settings Page

Route: `GET /teacher/settings` (frontend page)

Tabs:
1. `WhatsApp Power Tools`
2. `Notifications`
3. `Profile`

### 4.1 WhatsApp Power Tools (Core)

Settings:
1. WhatsApp number input (international format)
2. Link/unlink toggle
3. Consent toggle (required for automation)
4. Feature toggles:
   1. Attendance alerts
   2. Notice broadcasts
   3. Assignment reminders
   4. Submission updates
   5. Escalation alerts
   6. Weekly digest
5. Quiet hours (enabled + start/end time)
6. Send test WhatsApp message action

### 4.2 Notifications

Settings:
1. In-app notification toggles (messages, notices, submissions, escalations, reminders)
2. Email digest toggles (weekly digest, urgent-only)

### 4.3 Profile

Settings:
1. Read-only teacher identity summary
2. Editable locale/timezone

---

## 5) WhatsApp Power Tool Feature Set (Brainstormed Scope)

### 5.1 Teacher-facing (v1)

1. Attendance alerts to guardians for absent/late students.
2. Notice push for class-level and custom audiences.
3. Assignment due reminders.
4. Submission status updates (graded/returned).
5. Escalation state-change alerts.
6. Weekly teaching summary digest.

### 5.2 Parent-facing (v1/v1.5)

1. Daily attendance and lateness summary.
2. Assignment due and overdue reminders.
3. Important notice highlights.
4. Critical escalation alerts for their child.

### 5.3 Admin-facing (v1/v1.5)

1. School-wide channel enablement and policy guardrails.
2. Delivery success/failure dashboard.
3. Template governance and approval for sensitive message types.
4. Audit logs for high-risk messages (escalations, disciplinary alerts).

---

## 6) Architecture and Data Contract

### 6.1 Model

`TeacherSettings` (new)

Key fields:
1. `schoolId`, `teacherId`, `userId`
2. `locale`, `timezone`
3. `notifications.inApp`, `notifications.email`
4. `whatsapp.phoneNumber`, `whatsapp.linked`, `whatsapp.consentGiven`
5. `whatsapp.featureFlags`
6. `whatsapp.quietHours`
7. `whatsapp.lastTestMessageAt`

### 6.2 API

1. `GET /api/teacher/settings`
   1. Returns merged defaults + saved values
   2. Returns capability flags (e.g., school channel status)
2. `PATCH /api/teacher/settings`
   1. Validates and updates settings
   2. Enforces consent/link preconditions
   3. Normalizes WhatsApp phone
3. `POST /api/teacher/settings/whatsapp/test`
   1. Sends test message using provider abstraction
   2. Updates `lastTestMessageAt`

---

## 7) UX + Compliance Rules

1. Explicit consent is mandatory before enabling power features.
2. If WhatsApp is unlinked, all WhatsApp feature toggles are disabled.
3. Show school-level channel status clearly so teachers understand policy constraints.
4. Keep high-risk channels auditable.
5. Quiet hours suppress non-urgent outbound sends.

---

## 8) Rollout Plan

### Phase A (now)

1. Teacher settings UI + persistence
2. WhatsApp linking, consent, feature toggles
3. Test message endpoint

### Phase B

1. Delivery queue with retries and status tracking
2. Template management + message preview
3. Parent preferences and opt-out controls

### Phase C

1. Admin analytics dashboard for WhatsApp performance
2. Rules engine (time windows, priority routing, fallback channel)
3. Contextual two-way reply handling for selected workflows

---

## 9) Success Metrics

1. `% teachers with linked WhatsApp`
2. `% teachers with consent enabled`
3. Message delivery success rate
4. Assignment reminder impact on on-time submission rate
5. Attendance notification open/engagement proxy
6. Support tickets related to missed communication (should decrease)

---

## 10) Open Decisions

1. Verification method for linked numbers (OTP vs provider webhook verification).
2. Parent opt-in model (global school consent vs guardian-level granular consent).
3. Final provider choice and regional throughput constraints.
4. Standard template catalog and approval workflow ownership.
