# Communication Transport System Implementation Plan (Tickets + Sequence)

## 1. Delivery Strategy

1. Build additively to avoid regressions:
   - Keep current `Notification`, `Message`, and `MessageThread` flows live.
   - Introduce transport as a parallel layer first (shadow mode), then cut over by feature flag.
2. Roll out with strict flags:
   - `comms.transport.enabled`
   - `comms.whatsapp.enabled`
   - `comms.whatsapp.commands.enabled`
   - `comms.controlTower.enabled`
3. Ship per-tenant canary rollout:
   - Internal school test tenant
   - 1-2 pilot schools
   - then progressive rollout.
4. Guard production stability:
   - If transport dispatch fails, preserve in-app persistence.
   - If provider outage occurs, activate channel kill switch and fallback policy.

## 2. Ticket Conventions

1. Prefixes:
   - `COMMS-BE-*` backend
   - `COMMS-FE-*` frontend
   - `COMMS-OPS-*` infrastructure/observability
   - `COMMS-QA-*` quality/release
2. Every ticket must include:
   - Scope
   - Dependencies
   - Deliverables
   - Acceptance criteria
   - Rollback plan

## 3. Backend Tickets

### COMMS-BE-001: Data Models + Indexes (Additive)

1. Scope:
   - Create: `CommsTransport`, `CommsDeliveryAttempt`, `CommsEndpoint`, `CommsConsent`, `CommsDeadLetter`, `CommsWebhookEvent`, `CommsCampaign`.
   - Extend existing `Notification`, `Message`, `MessageThread` with transport references.
2. Dependencies: none
3. Acceptance criteria:
   - No breaking schema changes.
   - Required indexes for lookup by `schoolId`, `recipientUserId`, `status`, `createdAt`.
   - Existing endpoints remain functional without new fields.

### COMMS-BE-002: Outbox + Dispatcher Worker

1. Scope:
   - Implement store-first outbox pattern.
   - Add async dispatcher with retry/backoff.
2. Dependencies: `COMMS-BE-001`
3. Acceptance criteria:
   - `queued -> sent/delivered/failed/dead_letter` lifecycle works.
   - Idempotency key prevents duplicate sends.
   - Replay does not create duplicate user-visible notifications.

### COMMS-BE-003: Channel Adapter Layer

1. Scope:
   - Normalize adapters for in-app, WhatsApp, email; keep SMS as contract stub.
   - Standardize provider error mapping.
2. Dependencies: `COMMS-BE-002`
3. Acceptance criteria:
   - Unified adapter response contract.
   - Provider-specific failures mapped to normalized error codes.
   - Existing in-app notification behavior preserved.

### COMMS-BE-004: Policy Router + RBAC Guardrails

1. Scope:
   - Implement priority-based routing, quiet hours, consent checks, and role-direction rules.
2. Dependencies: `COMMS-BE-001`, `COMMS-BE-003`
3. Acceptance criteria:
   - Unauthorized route attempts blocked with clear error code.
   - Quiet-hours bypass only for `critical` policy class.
   - Tenant isolation enforced on all transport operations.

### COMMS-BE-005: Event Producers Integration

1. Scope:
   - Wire fee/payment, attendance, assignment, timetable reminder, and escalation events into transport.
2. Dependencies: `COMMS-BE-004`
3. Acceptance criteria:
   - Event -> transport creation latency within target.
   - Legacy notification emitters remain compatible during transition.

### COMMS-BE-006: WhatsApp Inbound/Webhook + Command Engine

1. Scope:
   - Inbound webhook verification, dedupe, and command parsing.
   - Role-scoped command execution with strict allowlist.
2. Dependencies: `COMMS-BE-003`, `COMMS-BE-004`
3. Acceptance criteria:
   - Only consented + linked users can execute commands.
   - Unknown commands return safe help response.
   - All inbound actions audited.

### COMMS-BE-007: Admin Control Tower APIs

1. Scope:
   - Delivery search, transport detail, retry/replay, dead-letter views, health summary.
2. Dependencies: `COMMS-BE-002`, `COMMS-BE-006`
3. Acceptance criteria:
   - Pagination/filtering available on large datasets.
   - Retry/replay endpoints enforce role permissions.

### COMMS-BE-008: Audit, Compliance, and Data Retention

1. Scope:
   - Immutable audit events for send/read/retry/replay/admin actions.
   - Retention/archival jobs per message class.
2. Dependencies: `COMMS-BE-007`
3. Acceptance criteria:
   - Audit writes are durable and queryable.
   - Retention policies configurable per tenant policy.

## 4. Frontend Tickets

### COMMS-FE-001: Unified Inbox and Thread Surface

1. Scope:
   - Consolidate conversation threads and system messages into a coherent inbox view.
2. Dependencies: `COMMS-BE-007`
3. Acceptance criteria:
   - Role-filtered inbox loads with pagination.
   - Unread/read state sync is reliable.

### COMMS-FE-002: Notification Center Upgrade

1. Scope:
   - Add transport status indicators and failure/escalation badges where appropriate.
2. Dependencies: `COMMS-BE-002`
3. Acceptance criteria:
   - Users can distinguish delivered vs pending vs failed critical alerts.

### COMMS-FE-003: Preferences + Consent Center

1. Scope:
   - Role-specific channel preferences, quiet hours, WhatsApp linking/opt-in, test send.
2. Dependencies: `COMMS-BE-006`
3. Acceptance criteria:
   - Consent capture includes timestamp and actor.
   - Disabled states are explicit when school policy blocks a channel.

### COMMS-FE-004: Admin Control Tower UI

1. Scope:
   - Delivery health dashboard, dead-letter queue, replay actions, campaign status.
2. Dependencies: `COMMS-BE-007`
3. Acceptance criteria:
   - Admins can identify and action failed deliveries within minutes.

### COMMS-FE-005: WhatsApp Power Tool Catalog (Per Role)

1. Scope:
   - Expose available WhatsApp commands and capability explanations in settings/help pages.
2. Dependencies: `COMMS-BE-006`
3. Acceptance criteria:
   - Catalog is role-aware and policy-aware.
   - Commands not enabled for role are hidden.

## 5. Ops and QA Tickets

### COMMS-OPS-001: Queue + Scheduler Hardening

1. Scope:
   - Configure queue workers, retry policies, dead-letter handling, and deployment runbooks.
2. Acceptance criteria:
   - Worker scaling and alert thresholds documented and tested.

### COMMS-OPS-002: Observability and Alerts

1. Scope:
   - Dashboards for queue lag, delivery success, webhook failures, dead-letter growth.
   - Alerts for SLO breaches.
2. Acceptance criteria:
   - On-call can detect and triage comm incidents quickly.

### COMMS-QA-001: Contract and Regression Suite

1. Scope:
   - API contract tests and non-regression coverage for legacy notifications/messages.
2. Acceptance criteria:
   - No regressions in existing teacher/parent/admin comm flows.

### COMMS-QA-002: Reliability and Failure Injection

1. Scope:
   - Simulate provider timeouts, webhook duplication, queue delays, and partial outages.
2. Acceptance criteria:
   - System degrades gracefully and records terminal states without silent loss.

### COMMS-QA-003: Security and Permission Matrix Tests

1. Scope:
   - Validate role-direction rules, tenant isolation, consent enforcement, and abuse limits.
2. Acceptance criteria:
   - No cross-tenant data access and no unauthorized command execution.

## 6. Essential WhatsApp Power Tool Capabilities (Role-First)

1. Parent:
   - `BALANCE`, `WARD`, `ATTENDANCE`, `REMINDERS`, `HELP`
2. Teacher:
   - `TODAY`, `NEXT`, `ALERTS`, `CLASS`, `HELP`
3. Bursar:
   - `FAILED_TX`, `PENDING_PAYMENTS`, `STUDENT_BALANCE`, `RECEIPT_STATUS`, `HELP`
4. School Admin:
   - `OVERVIEW`, `DELIVERY_HEALTH`, `ANNOUNCE_STATUS`, `ESCALATIONS`, `HELP`
5. Platform Admin:
   - `TENANT_HEALTH`, `INCIDENTS`, `HELP`
6. Student:
   - `TODAY`, `DUE`, `HELP`
7. Staff:
   - `TASKS`, `ALERTS`, `HELP`

Guardrail: any high-risk mutation (for example fee reversal, student status change, identity updates) must redirect to app confirmation with authenticated deep link.

## 7. Phase Sequence and Exit Criteria

### Phase A: Foundation

1. Deliver `COMMS-BE-001..003`, `COMMS-OPS-001`, `COMMS-QA-001`.
2. Exit criteria:
   - Transport ledger stable in shadow mode.
   - Existing communication features unchanged.

### Phase B: Policy + Essential WhatsApp Commands

1. Deliver `COMMS-BE-004..006`, `COMMS-FE-003`, `COMMS-FE-005`, `COMMS-QA-003`.
2. Exit criteria:
   - Parent/Teacher/Bursar essential commands working in pilot tenants.
   - Consent and RBAC verified.

### Phase C: Control Tower + Broad Rollout

1. Deliver `COMMS-BE-007..008`, `COMMS-FE-001..004`, `COMMS-OPS-002`, `COMMS-QA-002`.
2. Exit criteria:
   - Dead-letter replay operational.
   - SLO dashboards active.
   - Progressive rollout complete.

## 8. Non-Regression Checklist

1. Existing teacher notices continue to publish.
2. Existing parent/teacher messaging threads remain readable and writable.
3. Existing notification pages and read-state APIs remain backward compatible.
4. WhatsApp feature toggles in current settings do not break.
5. Payment and attendance alerts still reach in-app channel even when external provider is degraded.

## 9. Risk Register (Top Items)

1. Provider instability:
   - Mitigation: fallback routing, circuit breaker, kill switch.
2. Duplicate delivery during retries:
   - Mitigation: strict idempotency keys and dedupe indices.
3. Role misuse or over-broadcast:
   - Mitigation: hard RBAC rules, recipient caps, approval workflow for large campaigns.
4. Consent/legal non-compliance:
   - Mitigation: auditable consent artifacts and enforceable template policy.
5. Performance under peak events:
   - Mitigation: queue autoscaling, batch processing, p95 latency alarms.

## 10. Definition of Done (Program Level)

1. Cross-role communication works per policy matrix.
2. Essential role-specific WhatsApp commands are production-safe.
3. No silent loss: every message reaches terminal state in ledger.
4. Admins can detect, retry, and replay failures.
5. Security, consent, and audit controls pass QA sign-off.
6. Existing communication functionality remains stable through rollout.
