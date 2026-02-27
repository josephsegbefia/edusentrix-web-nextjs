# Communication Transport System Specification v1.0

## 1. Objective

Design and implement a unified, reliable, and secure communication transport system across all product roles:

1. Platform admin
2. School admin
3. Bursar
4. Teacher
5. Parent
6. Student
7. Staff

The system must support:

1. In-app messaging (person-to-person and role-to-role)
2. In-app/system notifications (events, reminders, alerts)
3. WhatsApp Power Tool (role-scoped quick actions + opted-in alerts)

WhatsApp is an acceleration layer, not a replacement for app workflows.

## 2. Product Outcomes

1. No silent communication loss.
2. High delivery success with fallback behavior.
3. Role-safe messaging and action execution.
4. Strong auditability and compliance.
5. Clear user controls for consent and preferences.

## 3. Scope

1. Unified communication domain model.
2. Channel orchestration for in-app, WhatsApp, email (and SMS-ready contract).
3. Delivery ledger with lifecycle tracking and retries.
4. Cross-role messaging policy and permissions.
5. WhatsApp command/action framework per role.
6. Admin delivery operations console.

## 4. Non-Goals (v1)

1. Replacing core app forms/workflows with chat-only flows.
2. Supporting every possible WhatsApp action in v1.
3. AI-generated outbound messaging by default.
4. End-to-end encrypted external chat between arbitrary users.

## 5. Terminology

1. **Conversation Message**: human-authored message in a thread.
2. **Notification**: system-generated event update.
3. **Transport**: channel delivery record for a message/notification.
4. **Delivery Attempt**: one send attempt on one channel.
5. **Dead Letter**: message that exhausted retries.
6. **Channel Endpoint**: destination address per channel (e.g. WhatsApp phone).
7. **Policy Router**: logic that selects channel, priority, fallback.
8. **Power Tool Action**: limited, role-approved WhatsApp command.

## 6. Core Design Principles

1. Store-first then send: persist event/message before channel dispatch.
2. At-least-once channel dispatch with idempotent dedupe.
3. Strong RBAC + tenancy scoping on every message/action.
4. Opt-in, consent, quiet hours, and legal template constraints.
5. Explicit delivery states and replay tooling.
6. Sensitive workflows redirect to app deep links when risk is high.

## 7. System Architecture

## 7.1 Logical Components

1. `Comms API Layer`: thread, notification, preference, admin endpoints.
2. `Comms Domain Service`: validation, routing, policy checks.
3. `Outbox + Queue`: reliable async dispatch.
4. `Channel Adapters`:
   - In-app adapter
   - WhatsApp adapter
   - Email adapter
   - SMS adapter (contract first, provider later)
5. `Delivery Ledger`: status and attempt tracking.
6. `Webhook Ingestion`: channel callbacks (`delivered`, `read`, `failed`).
7. `Control Tower`: monitoring, dead-letter replay, incident insights.

## 7.2 Message Classes

1. `conversational`: user-to-user thread messages.
2. `transactional`: fee events, attendance alerts, failed transactions, reminders.
3. `broadcast`: notices/announcements to role/class/grade cohorts.
4. `critical`: operational incidents requiring acknowledgment.

## 7.3 Priority Levels

1. `low`
2. `normal`
3. `high`
4. `critical`

Priority controls retry strategy, fallback behavior, and quiet-hour bypass rules.

## 8. Delivery Reliability Model

## 8.1 Delivery States

1. `queued`
2. `sent`
3. `delivered`
4. `read`
5. `failed`
6. `dead_letter`
7. `cancelled`

## 8.2 Attempt Strategy

1. Retry with exponential backoff.
2. Maximum attempts per channel configured by policy.
3. Channel-specific timeout budget.
4. Move to dead-letter after retry exhaustion.

## 8.3 Fallback Chain (Default)

1. In-app (always for internal users)
2. Preferred external channel (WhatsApp/email)
3. Secondary external channel (email/SMS where available)
4. Escalation notification to sender/admin if delivery remains failed

## 8.4 Idempotency

1. Every dispatch has `idempotencyKey`.
2. Duplicate queue or webhook events must be safe.
3. Replay cannot create duplicate user-visible notifications.

## 9. Security, Privacy, and Safety

1. Tenant isolation by `schoolId`.
2. RBAC enforcement for send, read, act, broadcast.
3. Consent required for WhatsApp and optional external channels.
4. Guardian access only for linked wards.
5. Quiet hours for non-critical sends.
6. PII minimization in external templates.
7. Template allowlist for high-risk messages.
8. Full audit log for who sent what, to whom, when.
9. Abuse controls:
   - Rate limits
   - Burst caps
   - Role-based recipient caps
10. Incident controls:
   - Block list for compromised endpoints
   - Kill switch for channel/provider outages

## 10. Communication Policy and Permissions

## 10.1 Directional Messaging Policy (v1)

1. Platform Admin -> School Admin: allowed
2. School Admin -> Teacher/Parent/Student/Staff/Bursar: allowed
3. Bursar -> Parent/School Admin: allowed (financial domain)
4. Teacher <-> Parent: allowed for assigned student context
5. Teacher -> Student: allowed within assigned class/subject context
6. Parent -> Teacher/Admin/Bursar: allowed with ward context
7. Student -> Teacher: allowed within class/subject thread policy
8. Staff -> School Admin and assigned operational roles: allowed

All directions require context checks and policy enforcement.

## 10.2 Broadcast Policy (v1)

1. Platform Admin: cross-school operational announcements only.
2. School Admin: school-wide and scoped broadcasts.
3. Teacher: class/subject/custom student audience, no school-wide by default.
4. Bursar: finance notices to financially relevant recipients.

## 11. WhatsApp Power Tool Strategy

WhatsApp features are role-scoped, opt-in, and template-governed.

## 11.1 Essential Commands First (Phase 1)

### Parent (highest priority)

1. `BALANCE`:
   - Returns outstanding amount per ward and total.
2. `WARD <name|id>`:
   - Returns quick profile summary and class.
3. `ATTENDANCE <ward>`:
   - Recent attendance status summary.
4. `REMINDERS`:
   - Upcoming due items and school notices.
5. `HELP`:
   - Command list and safe links to app.

### Teacher

1. `TODAY`:
   - Today timetable and next lesson.
2. `NEXT`:
   - Next upcoming class + countdown.
3. `ALERTS`:
   - Pending submissions, escalations, urgent reminders.
4. `CLASS <id|name>`:
   - Quick class snapshot (count, pending tasks).
5. `HELP`

### Bursar

1. `FAILED_TX`:
   - Recent failed transaction summary.
2. `PENDING_PAYMENTS`:
   - Pending payment approvals/reconciliation items.
3. `STUDENT_BALANCE <id>`:
   - Student-level balance summary.
4. `RECEIPT_STATUS <ref>`:
   - Verify payment reference and receipt state.
5. `HELP`

### School Admin

1. `OVERVIEW`:
   - Operational communication summary.
2. `DELIVERY_HEALTH`:
   - Delivery success/failure snapshot by channel.
3. `ANNOUNCE_STATUS <campaignId>`:
   - Broadcast delivery status.
4. `ESCALATIONS`:
   - High-priority unresolved items.
5. `HELP`

### Platform Admin

1. `TENANT_HEALTH <school>`:
   - Delivery and incident health for a tenant.
2. `INCIDENTS`:
   - Active communication incidents.
3. `HELP`

### Student (minimal safe scope)

1. `TODAY`:
   - Next class and today's reminders.
2. `DUE`:
   - Assignment due summary.
3. `HELP`

### Staff (non-teaching)

1. `TASKS`:
   - Assigned operational tasks/reminders.
2. `ALERTS`:
   - Critical operational notices.
3. `HELP`

## 11.2 WhatsApp Push Alert Essentials (Opted-in)

1. Fee payment success/failure.
2. Failed transaction alerts.
3. Upcoming lesson reminders for teachers.
4. Attendance alerts to guardians.
5. Assignment due reminders.
6. Escalation state changes.
7. Critical school announcements.

## 11.3 Guardrails

1. No high-risk mutations without secure app confirmation.
2. Read-only financial snapshots in WhatsApp by default.
3. Sensitive details truncated with deep-link handoff.
4. Per-role feature flags and school-level channel enablement.

## 12. Data Model (New + Evolving)

## 12.1 New Collections

1. `CommsTransport`
   - One logical transport record per message-recipient-channel.
2. `CommsDeliveryAttempt`
   - Per-attempt record (provider response, latency, error code).
3. `CommsEndpoint`
   - Channel addresses and verification state per user.
4. `CommsConsent`
   - Consent and legal basis per user/channel/feature.
5. `CommsTemplate`
   - Approved channel templates with placeholders and policy tags.
6. `CommsDeadLetter`
   - Failed transports awaiting replay/triage.
7. `CommsWebhookEvent`
   - Raw normalized callback events from providers.
8. `CommsCampaign`
   - Broadcast envelope with aggregated delivery stats.

## 12.2 Existing Collections to Extend (Additive)

1. `Notification`:
   - Add transport references, channel, and delivery summary fields.
2. `Message`:
   - Add external-channel mirrors for WhatsApp-inbound/outbound linkage.
3. `MessageThread`:
   - Add thread type/context metadata (finance, academic, operations).
4. `TeacherSettings`:
   - Keep role-specific WhatsApp preferences as-is.
5. Add equivalent settings profiles for parent/admin/bursar where needed.

## 13. API Surface (Proposed v1)

## 13.1 Conversations

1. `GET /api/comms/threads`
2. `POST /api/comms/threads`
3. `GET /api/comms/threads/:threadId/messages`
4. `POST /api/comms/threads/:threadId/messages`
5. `POST /api/comms/threads/:threadId/read`

## 13.2 Notifications

1. `GET /api/comms/notifications`
2. `POST /api/comms/notifications/:id/read`
3. `POST /api/comms/notifications/read-all`

## 13.3 Preferences and Consent

1. `GET /api/comms/preferences`
2. `PATCH /api/comms/preferences`
3. `POST /api/comms/channels/whatsapp/link`
4. `POST /api/comms/channels/whatsapp/unlink`
5. `POST /api/comms/channels/whatsapp/test`

## 13.4 WhatsApp Power Tool

1. `POST /api/comms/whatsapp/webhook`
2. `POST /api/comms/whatsapp/commands/execute` (internal normalized handler)
3. `GET /api/comms/whatsapp/commands/catalog` (role-scoped)

## 13.5 Admin Control Tower

1. `GET /api/admin/comms/transports`
2. `GET /api/admin/comms/transports/:id`
3. `POST /api/admin/comms/transports/:id/retry`
4. `GET /api/admin/comms/dead-letter`
5. `POST /api/admin/comms/dead-letter/:id/replay`
6. `GET /api/admin/comms/health`
7. `GET /api/admin/comms/campaigns/:id/status`

## 14. Event Sources (Initial)

1. Fee and payment events:
   - payment success
   - payment failure
   - overdue reminders
2. Academic events:
   - lesson upcoming reminders
   - submissions due/late
   - grading updates
3. Attendance events:
   - absent/late alerts
4. Operations events:
   - escalations
   - urgent announcements

## 15. Routing Policy Rules

1. `critical`:
   - In-app + WhatsApp (if consented) + email fallback.
2. `high`:
   - In-app + preferred external channel.
3. `normal`:
   - In-app, external only if opted-in.
4. `low`:
   - Digest mode where possible.

Routing must consider:

1. Role
2. User preferences
3. School-level channel toggles
4. Quiet hours
5. Provider health
6. Regulatory constraints

## 16. Observability and SLOs

## 16.1 Core Metrics

1. Queue lag
2. Sent rate
3. Delivery rate by channel
4. Read rate
5. Failure rate by error code
6. Retry count
7. Dead-letter count
8. End-to-end latency (event -> delivered)

## 16.2 Suggested SLO Targets (Initial)

1. Internal in-app notification persistence: 99.95%
2. External dispatch attempt success: 99.0%+
3. Critical event enqueue latency: < 5s p95
4. Dead-letter unresolved older than 30 min: 0 for critical

## 17. Admin Control Tower Requirements

1. Real-time channel health and error spikes.
2. Message drill-down by recipient and channel.
3. Manual retry/replay controls.
4. Campaign delivery analytics.
5. Incident bannering and kill-switch controls.

## 18. Rollout Plan

### Phase 1: Foundation

1. Unified transport ledger + outbox.
2. In-app + WhatsApp + email adapters (SMS contract).
3. Parent/Teacher/Bursar essential WhatsApp commands.
4. Delivery control basics (retry + dead-letter view).

### Phase 2: Cross-Role Expansion

1. School admin and platform admin command sets.
2. Student/staff minimal command sets.
3. Advanced routing and fallback controls.

### Phase 3: Hardening

1. Deep observability dashboards.
2. Policy automation and dynamic throttling.
3. Enhanced compliance controls and exportable audits.

## 19. Success Metrics

1. Reduction in missed critical communications.
2. Delivery success rate by channel.
3. Dead-letter rate trend.
4. Parent WhatsApp balance-check engagement.
5. Teacher reminder engagement and completion lift.
6. Bursar response time to failed transaction alerts.

## 20. Acceptance Criteria (Program-Level)

1. Cross-role communication routes work according to policy.
2. Essential WhatsApp commands are functional and role-safe.
3. No silent message drops (all messages terminally tracked).
4. Retry/dead-letter operations are available to admins.
5. Consent/privacy controls are enforced.
6. Existing communication features continue working.

## 21. Open Decisions

1. WhatsApp provider choice and production SLA commitments.
2. Exact command syntax UX (`keyword` vs menu buttons).
3. Role onboarding and consent collection flow.
4. Retention period per message class.
5. Regional/legal requirements for archived communications.
