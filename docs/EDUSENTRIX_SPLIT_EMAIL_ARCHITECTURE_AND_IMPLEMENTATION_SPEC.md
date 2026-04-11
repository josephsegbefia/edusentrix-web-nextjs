# EduSentrix Split Email Architecture & Implementation Spec

> **Version**: 1.1  
> **Date**: April 11, 2026  
> **Status**: Ready for phased implementation  
> **Audience**: Product, design, and engineering  
> **Intent**: This document is written so an AI coding agent or engineer can implement the system without inventing missing product rules.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Goals and Non-Goals](#2-goals-and-non-goals)
3. [Current State in EduSentrix](#3-current-state-in-edusentrix)
4. [Core Product Decisions](#4-core-product-decisions)
5. [What the Operator Must Set Up Externally](#5-what-the-operator-must-set-up-externally)
6. [Target Architecture](#6-target-architecture)
7. [Data Model Changes](#7-data-model-changes)
8. [Template and Message Catalog](#8-template-and-message-catalog)
9. [Backend Implementation Plan](#9-backend-implementation-plan)
10. [Frontend Implementation Plan](#10-frontend-implementation-plan)
11. [Privacy, Security, and Compliance Rules](#11-privacy-security-and-compliance-rules)
12. [Migration and Backfill Strategy](#12-migration-and-backfill-strategy)
13. [Phased Delivery Plan](#13-phased-delivery-plan)
14. [Acceptance Criteria](#14-acceptance-criteria)
15. [AI Execution Checklist](#15-ai-execution-checklist)

---

## 1. Overview

EduSentrix needs a full split email architecture similar in spirit to the Dragonfly system:

- **Brevo** handles automated and high-volume email.
- **Brevo inbound parsing** on a dedicated reply subdomain handles primary app reply ingestion.
- **Spaceship / Spacemail** hosts real inboxes and handles manual one-to-one human mail plus fallback mailbox continuity.
- All outbound and inbound email is auditable.
- The platform supports both **Edusentrix-branded** and **school-branded** email.
- The platform can route replies back to the correct school or platform inbox without creating a real mailbox for every school in v1.

This must be implemented without breaking currently working invitation, payment, reminder, or notification flows.

---

## 2. Goals and Non-Goals

### 2.1 Goals

- Build a **platform-wide** email system for EduSentrix.
- Keep auth emails **Clerk-delivered**, but fully customized and branded.
- Use **custom emails for all invitation flows**.
- Support **transactional**, **operational**, **manual**, and **bulk** email.
- Store **all outbound and inbound messages** plus provider events and delivery outcomes.
- Support **school branding** for school-originated messages.
- Add **school and platform inboxes** for reply handling.
- Add **notification preferences**, **quiet hours**, **opt-outs**, and **digest behavior** in phase 1.
- Support **attachments and generated PDFs** where policy allows.
- Enforce strict rules so **student-specific data only goes to verified guardian/parent email addresses** or secured links.

### 2.2 Non-Goals for v1

- EduSentrix will **not** provision a real mailbox account per school in v1.
- EduSentrix will **not** become a mailbox hosting provider for school domains in v1.
- EduSentrix will **not** take over delivery of authentication emails from Clerk.
- EduSentrix will **not** expose raw student academic or disciplinary data directly in email bodies by default.
- EduSentrix will **not** replace internal messaging; email complements it.

### 2.3 V1 Position on School Email Accounts

Schools may eventually use verified custom sender identities, but v1 should use:

- Edusentrix-managed sender infrastructure
- school-branded templates
- Edusentrix-managed routed reply aliases
- optional future support for school-owned reply-to addresses after verification

This is the standard SaaS pattern for a multi-tenant launch and avoids operational failure from trying to host mailboxes for every school too early.

---

## 3. Current State in EduSentrix

### 3.1 What already exists

- A basic Brevo sender exists in `src/lib/email/brevo.ts`
- A small HTML template layer exists in `src/lib/email/templates.ts`
- Invitation flows already send branded emails in:
  - `src/app/api/admin/teachers/create/route.ts`
  - `src/app/api/admin/teachers/bulk-create/route.ts`
  - `src/app/api/admin/invitations/[id]/resend/route.ts`
  - `src/app/api/admin/settings/payment-setup/owner-invite/route.ts`
  - `src/app/api/admin/settings/payment-setup/delegate-invite/route.ts`
  - `src/app/api/admin/students/[id]/guardians/route.ts`
  - `src/app/api/platform/applications/[id]/approve/route.ts`
- Fee reminder email dispatch exists in `src/lib/notifications/fee-reminders.ts`
- Payment setup email notifications exist in `src/lib/school-payments/payment-setup-notifications.ts`
- Clerk webhook syncing exists in `src/app/api/webhooks/clerk/route.ts`
- Teacher notification preferences and quiet hours exist in:
  - `src/models/TeacherSettings.ts`
  - `src/app/api/teacher/settings/route.ts`
  - `src/app/(app)/teacher/settings/page.tsx`
- School settings page already exists in `src/app/(app)/admin/settings/page.tsx`
- School identity data already includes `name`, `logo`, `email`, and billing fields in `src/models/School.ts`

### 3.2 Confirmed gaps

- No unified email service layer with provider abstraction, audit logging, or inbound sync
- No generic outbound/inbound email history model
- No platform or school inbox UI
- No real reply routing model
- No delivery-event webhook ingestion from Brevo
- No suppression or unsubscribe model
- No generalized preference model across roles
- No school email branding settings beyond logo/name
- No email dispatch queue with retries, dead-letter handling, or fair scheduling
- No explicit rate limiting or multi-tenant bulk governance
- No sender-reputation isolation strategy for bulk versus transactional traffic
- Current invitation flows can produce duplication if Clerk sends its own invite email and EduSentrix sends another branded email

### 3.3 Principle for this spec

Do not rip out the current invitation and reminder code first. Introduce a compatibility layer, then migrate call sites gradually.

---

## 4. Core Product Decisions

### 4.1 Provider split

- **Brevo** handles:
  - transactional school email
  - automated platform email
  - bulk and digest email
  - outbound delivery event webhooks
  - inbound parsing on the reply subdomain
- **Spaceship / Spacemail** hosts the real inboxes:
  - `hello@tryedusentrix.app`
  - `support@tryedusentrix.app`
  - `billing@tryedusentrix.app`
- **Spaceship / Spacemail** also handles:
  - manual one-to-one SMTP sending when the app needs a human-mailbox identity
  - direct mailbox continuity for operator mail
  - fallback/recovery mailbox sync only, not primary app reply routing

### 4.2 Branding rules

- Messages sent by the platform are **Edusentrix-branded**.
- Messages sent on behalf of a school are **school-branded**.
- School branding includes:
  - logo
  - school display name
  - primary color
  - secondary color
  - footer/signature details
  - preferred reply identity

### 4.3 School reply identity rule

Schools can control reply identity in the product, but v1 uses **routed Edusentrix aliases** as the effective reply address.

Example:

- visible sender branding: `Saint Anthony's School via EduSentrix`
- reply-to: `school+<schoolId>+thread+<threadToken>@reply.tryedusentrix.app`

This allows:

- correct reply routing
- school-level inboxes
- no separate mailbox provisioning per school

### 4.4 Clerk-delivered auth email rule

EduSentrix will **not** self-deliver auth emails.

Clerk remains both the identity provider and the delivery provider for:

- verification code
- sign-in code
- password reset
- any other built-in auth template Clerk already supports

EduSentrix still controls:

- branding
- copy
- sender local part
- reply-to behavior

through Clerk template customization.

Reason:

- auth deliverability is the most operationally sensitive email path
- moving auth mail onto Brevo would make EduSentrix responsible for critical sign-in availability
- there is no product upside large enough to justify that reliability tradeoff in the first implementation

### 4.5 Invitation rule

All invitation flows must use **custom EduSentrix emails**.

Clerk invitations should still be created for identity and acceptance flow, but invitation creation must use:

- `notify: false`
- EduSentrix-branded or school-branded delivery through the email service

This prevents duplicate invitation emails.

### 4.6 Inbox access

- **Platform support** gets access to platform inboxes.
- **School admins** get access to their school inboxes.
- **Bursars** can send manual and bulk finance-related email but school admin remains the main school inbox authority unless a later phase expands shared inbox permissions.

### 4.7 Allowed email senders in-app

Roles allowed to send manual email:

- `platform_admin`
- `school_admin`
- `bursar`

Roles not allowed to send email in v1:

- `teacher`
- `parent`
- `student`
- `staff`
- `billing_owner` unless later expanded

### 4.8 Reply routing rule

The platform will not depend on one mailbox per school. Instead:

- automated and manual emails carry a unique reply alias
- replies to app-generated email flow first through **Brevo inbound parsing** on `reply.tryedusentrix.app`
- replies are matched back to school/thread/entity
- Spacemail IMAP is used only for:
  - direct emails that land in `hello@`, `support@`, or `billing@`
  - operator continuity
  - disaster recovery / replay support

Primary inbound routing must therefore be webhook-based, not poll-based.

### 4.9 Sensitive data rule

Student-specific information must not be emailed to arbitrary addresses. Sensitive school emails must follow these rules:

- only send directly to verified guardian/parent email on record
- if content is sensitive, send a summary plus secure action link
- raw detail unmasking requires authenticated access or a signed one-time secure link

### 4.10 Preference rule

Phase 1 includes:

- user-level email preferences
- quiet hours
- digest settings
- category-level opt-out for optional mail
- suppression handling for bounces and complaints

Transactional and safety-critical mail remains non-optional.

### 4.11 Preference source-of-truth rule

EduSentrix must not attempt a risky dual-write migration between `TeacherSettings` and `EmailPreference`.

Instead:

- `TeacherSettings` remains the authoritative persistence model for teachers in phase 1
- `EmailPreference` becomes the authoritative persistence model for all other roles in scope
- all send paths use a shared resolver that produces a single canonical **resolved preference** read model

Implementation rule:

- reads unify
- writes stay role-native until a later migration

This avoids data drift and preserves the existing teacher settings UI/API.

### 4.12 Delivery resilience and retry rule

Every email send and inbound routing operation must be classified as either:

- retryable
- non-retryable
- dead-lettered after max attempts

Transient provider failures such as:

- `429`
- `5xx`
- timeouts
- network errors
- temporary attachment generation failures

must be retried with exponential backoff and jitter.

Permanent failures such as:

- invalid recipient
- invalid payload
- hard policy rejection
- unauthorized attachment request

must fail immediately without retry loops.

### 4.13 Rate limiting and fair scheduling rule

The system must use two levels of protection:

- **admission control** when a user schedules or sends email
- **dispatch throttling** when the worker actually talks to providers

Fairness rule:

- transactional traffic always outranks bulk traffic
- one school must not be able to monopolize the queue
- bulk sends must be chunked and interleaved across schools

### 4.14 Sender reputation and bulk governance rule

EduSentrix is a multi-tenant sender, so bulk email cannot share the same operational posture as transactional email.

Required rules:

- bulk and transactional traffic must be logically isolated
- bulk mail must be tagged and monitored per school
- complaint, bounce, and unsubscribe spikes must auto-pause bulk sends for the affected school
- newly enabled schools must start in a conservative **warm-up** bulk mode
- high-volume schools must be eligible for sender-pool isolation or a dedicated IP strategy later
- transactional billing and auth-related traffic must never be degraded by a school's poor bulk-email hygiene

### 4.15 IMAP rule

IMAP is not the primary app routing path.

It is only a:

- fallback continuity mechanism
- recovery path for direct mailbox mail
- operator support tool

This prevents the app from depending on fragile polling latency for normal reply handling.

---

## 5. What the Operator Must Set Up Externally

This is the exact work required outside the codebase.

### 5.1 DNS and domain ownership

Required domains:

- `tryedusentrix.app`
- `reply.tryedusentrix.app` or equivalent reply-routing subdomain

Required DNS records:

- Brevo SPF and DKIM
- DMARC for the sending domain
- MX delegation for `reply.tryedusentrix.app` to Brevo inbound parsing
- MX records for Spacemail mailbox hosting
- any Brevo webhook verification requirements

### 5.2 Brevo

Configure:

- transactional email API key
- authenticated sender domain
- inbound parsing webhook for `reply.tryedusentrix.app`
- sender identities:
  - `hello@tryedusentrix.app`
  - `billing@tryedusentrix.app`
- webhook endpoint for:
  - sent
  - delivered
  - opened
  - clicked
  - deferred
  - blocked
  - bounced
  - complaint / spam
  - unsubscribed
  - error
- tagging and custom-header strategy so each message carries:
  - school identifier
  - sender family
  - traffic class
  - template key
- a dedicated IP or isolated sender pool plan for later high-volume bulk traffic

### 5.3 Spacemail / Spaceship

Create:

- `hello@tryedusentrix.app`
- `support@tryedusentrix.app`
- `billing@tryedusentrix.app`

Enable:

- SMTP
- IMAP
- aliases
- mailbox rules or forwarding for operator convenience where needed

Important:

- the **reply subdomain is delegated to Brevo inbound parsing**
- Spacemail does **not** own the primary app reply-routing domain

### 5.4 Clerk

Operator actions:

- keep Clerk as the identity provider
- add webhook endpoint for required user/invitation events
- customize Clerk email templates for EduSentrix branding
- keep `Delivered by Clerk` enabled for auth templates
- during implementation, switch invitation creation to custom delivery using `notify: false`

### 5.5 Environment variables to provide

Minimum env contract:

```env
NEXT_PUBLIC_APP_URL=
APP_URL=

BREVO_API_KEY=
BREVO_DEFAULT_FROM_EMAIL=hello@tryedusentrix.app
BREVO_DEFAULT_FROM_NAME=Edusentrix
BREVO_BILLING_FROM_EMAIL=billing@tryedusentrix.app
BREVO_SUPPORT_REPLY_TO=support@tryedusentrix.app
BREVO_WEBHOOK_SECRET=
BREVO_INBOUND_PARSE_WEBHOOK_SECRET=

SPACEMAIL_SMTP_HOST=
SPACEMAIL_SMTP_PORT=
SPACEMAIL_SMTP_USER=support@tryedusentrix.app
SPACEMAIL_SMTP_PASSWORD=

SPACEMAIL_IMAP_HOST=
SPACEMAIL_IMAP_PORT=
SPACEMAIL_IMAP_USER=support@tryedusentrix.app
SPACEMAIL_IMAP_PASSWORD=

EMAIL_REPLY_DOMAIN=reply.tryedusentrix.app
EMAIL_AUDIT_ENABLED=true
EMAIL_SYNC_ENABLED=true
EMAIL_DISPATCH_CRON_SECRET=
EMAIL_IMAP_RECOVERY_CRON_SECRET=

CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=
```

### 5.6 Production delivery rule

Per product direction, real recipients are allowed in production-like environments. Development environments should still support a safety override if needed later.

---

## 6. Target Architecture

### 6.1 High-level architecture

```text
EduSentrix app action / scheduled job / webhook
        |
        v
Email orchestration layer
        |
        +--> Brevo provider --------------> automated / template / bulk / transactional email
        |        |
        |        +--> outbound event webhooks
        |        +--> inbound parse on reply subdomain
        |
        +--> Spacemail SMTP --------------> manual human email
        |
        +--> Audit persistence -----------> EmailMessage / EmailEvent / EmailThread / EmailBatch / EmailDispatchJob
        |
        +--> Reply routing metadata -----> reply aliases + thread tokens

Inbound replies
        |
        v
reply.tryedusentrix.app
        |
        +--> Brevo inbound parsing webhook
        |
        +--> raw inbound persistence
        |
        +--> routing worker / retry queue
        |
        +--> school inbox / platform inbox UI

Direct mailbox continuity
        |
        v
Spacemail inboxes (hello/support/billing)
        |
        +--> IMAP recovery sync only
        |
        +--> platform inbox / operator tools
```

### 6.2 Sender identities

Platform sender examples:

- `Edusentrix <hello@tryedusentrix.app>`
- `Edusentrix Billing <billing@tryedusentrix.app>`

School sender examples:

- `Saint Anthony's School via Edusentrix <hello@tryedusentrix.app>`
- `Saint Anthony's School Billing via Edusentrix <billing@tryedusentrix.app>`

### 6.3 Effective reply-to behavior

Default mode:

- all automated and school-branded emails use a generated reply alias under the Edusentrix reply domain
- the reply subdomain is delegated to Brevo inbound parsing
- replies route back into Edusentrix inboxes through webhook ingestion, not mailbox polling

Example alias format:

```text
school+s_<schoolId>+t_<threadToken>@reply.tryedusentrix.app
platform+p_support+t_<threadToken>@reply.tryedusentrix.app
billing+s_<schoolId>+i_<invoiceId>+t_<threadToken>@reply.tryedusentrix.app
```

The router should decode:

- school context
- inbox scope
- entity hint
- thread token

### 6.4 Threading model

Each message belongs to one of:

- platform support thread
- school operational thread
- school finance thread
- entity-linked thread such as invitation, invoice, application, or payment setup

Threading should use:

- internal `threadId`
- provider message ID
- `Message-ID`
- `In-Reply-To`
- reply alias token

The reply alias token is the primary router. Headers are a secondary fallback.

### 6.5 Delivery event ingestion

Brevo webhook ingestion must update message status transitions:

- queued
- sent
- delivered
- opened
- clicked
- deferred
- blocked
- bounced
- complained
- unsubscribed
- failed

### 6.6 Inbound ingestion strategy

Primary path:

- Brevo inbound parsing webhook receives all mail sent to `*@reply.tryedusentrix.app`
- the webhook handler validates the request and persists the raw inbound payload first
- a routing worker resolves thread, school, mailbox key, and entity context
- if routing fails, the inbound item is retried from a durable job queue

Fallback path:

- Spacemail IMAP recovery sync is available only for direct mailbox traffic or operational replay
- IMAP recovery is not required for normal reply processing

### 6.7 Quiet hours and digests

Email preferences support:

- immediate delivery
- urgent-only delivery
- daily digest
- weekly digest
- quiet hours

Transactional mail ignores quiet hours if legally or operationally necessary. Optional mail should respect quiet hours and digest settings.

### 6.8 Attachments and generated PDFs

Supported attachment classes in v1:

- invoice PDF
- receipt PDF
- statement PDF
- report card PDF only when policy allows and recipient is guardian-safe

Generated files should be attached only when:

- the recipient is authorized
- the template classification allows attachment
- the data sensitivity checker permits it

### 6.9 Suppression and opt-out model

The system must distinguish:

- **hard suppression**: bounce, complaint, blocked
- **soft preference opt-out**: optional categories
- **channel-level pause**: quiet hours or digest

Transactional flows should record attempted delivery even when optional delivery would have been skipped.

### 6.10 Delivery resilience and dead-letter handling

Outbound and inbound operations must use durable jobs with:

- attempt count
- next run time
- max attempts
- last error
- terminal dead-letter state

Rules:

- retry transient provider and network errors
- do not retry deterministic validation failures
- preserve raw inbound payloads before routing
- preserve unsent or failed outbound intent for operator retry where appropriate

### 6.11 Multi-tenant sender reputation strategy

The system must isolate traffic logically by:

- sender family: `hello`, `billing`, `support`
- traffic class: `transactional`, `manual`, `bulk`, `digest`
- school ID
- template key

At scale:

- bulk mail is never dispatched from the same queue priority as transactional mail
- complaint and bounce thresholds auto-pause bulk traffic per school
- schools with repeated issues can be downgraded to manual review only
- high-volume bulk traffic is eligible for later dedicated-IP or sender-pool isolation

### 6.12 Rate limiting and fair scheduling

Required controls:

- per-user manual-send hourly limits
- per-school bulk-send hourly and daily limits
- per-school concurrent dispatch caps
- global provider throttle windows when Brevo returns `429`

Dispatching must be:

- priority aware
- fair across schools
- chunked for large batches
- resumable after pauses or provider throttling

---

## 7. Data Model Changes

### 7.1 `EmailMessage`

**Purpose**: single source of truth for every inbound and outbound email.

```ts
{
  _id: ObjectId
  provider: "brevo" | "spaceship" | "clerk" | "system"
  direction: "outbound" | "inbound"

  mailboxScope: "platform" | "school"
  mailboxKey: string // e.g. "platform_support", "school:<schoolId>:general", "school:<schoolId>:billing"

  schoolId?: ObjectId | null
  threadId?: ObjectId | null
  batchId?: ObjectId | null

  from: string
  fromName?: string | null
  to: string
  cc?: string | null
  bcc?: string | null
  replyTo?: string | null

  subject: string
  htmlBody?: string | null
  textBody?: string | null
  previewText?: string | null

  status:
    | "draft"
    | "queued"
    | "routing"
    | "sent"
    | "delivered"
    | "opened"
    | "clicked"
    | "deferred"
    | "blocked"
    | "bounced"
    | "complained"
    | "unsubscribed"
    | "failed"
    | "dead_letter"
    | "received"

  messageClass:
    | "auth"
    | "invitation"
    | "billing_transactional"
    | "billing_reminder"
    | "academic"
    | "attendance"
    | "announcement"
    | "manual"
    | "bulk"
    | "support"
    | "digest"
    | "system"

  trafficClass:
    | "transactional"
    | "manual"
    | "bulk"
    | "digest"
    | "system"

  priority:
    | "critical"
    | "high"
    | "normal"
    | "low"

  templateKey?: string | null
  templateVersion?: string | null

  relatedEntityType?: string | null
  relatedEntityId?: string | null

  actorId?: string | null
  actorName?: string | null
  actorRole?: string | null

  recipientUserId?: ObjectId | null
  recipientRole?: string | null
  recipientEmailVerified?: boolean | null

  sensitivity:
    | "low"
    | "moderate"
    | "high"
    | "guardian_only"

  secureContentMode:
    | "none"
    | "summary_plus_link"
    | "attachment"
    | "portal_only"

  providerMessageId?: string | null
  messageIdHeader?: string | null
  inReplyTo?: string | null
  referencesHeader?: string[] | null

  replyAlias?: string | null
  routingToken?: string | null

  attachments?: Array<{
    name: string
    mimeType: string
    sizeBytes?: number | null
    storageKey?: string | null
    generated: boolean
  }>

  failureReason?: string | null
  skipReason?: string | null
  sentAt?: Date | null
  deliveredAt?: Date | null
  openedAt?: Date | null
  receivedAt?: Date | null
  createdAt: Date
  updatedAt: Date
}
```

### 7.2 `EmailThread`

**Purpose**: conversation grouping, inbox ownership, and unread counts.

```ts
{
  _id: ObjectId
  mailboxScope: "platform" | "school"
  mailboxKey: string
  schoolId?: ObjectId | null

  subject: string
  participants: Array<{
    email: string
    name?: string | null
    roleHint?: string | null
    userId?: ObjectId | null
  }>

  threadType:
    | "support"
    | "billing"
    | "school_ops"
    | "invitation"
    | "application"
    | "payment_setup"
    | "invoice"
    | "manual"

  relatedEntityType?: string | null
  relatedEntityId?: string | null

  lastMessageAt: Date
  lastOutboundAt?: Date | null
  lastInboundAt?: Date | null
  unreadCountPlatform: number
  unreadCountSchool: number

  routingToken: string
  status: "open" | "closed" | "archived"
  createdAt: Date
  updatedAt: Date
}
```

### 7.3 `EmailEvent`

**Purpose**: immutable provider event trail.

```ts
{
  _id: ObjectId
  emailMessageId: ObjectId
  schoolId?: ObjectId | null
  provider: "brevo" | "spaceship"
  eventType: string
  providerMessageId?: string | null
  payload: Record<string, unknown>
  occurredAt: Date
  createdAt: Date
}
```

### 7.4 `EmailPreference`

**Purpose**: generic preference store for roles other than teachers in phase 1. Teachers continue to use `TeacherSettings` as the write source of truth.

```ts
{
  _id: ObjectId
  userId: ObjectId
  schoolId?: ObjectId | null
  role: "platform_admin" | "school_admin" | "bursar" | "teacher" | "parent" | "staff"

  locale?: string
  timezone?: string

  channels: {
    email: boolean
    inApp: boolean
    whatsapp?: boolean
    sms?: boolean
  }

  email: {
    immediate: {
      attendance: boolean
      academics: boolean
      announcements: boolean
      billingReminders: boolean
      manualMessages: boolean
      lessonNoteReview: boolean
    }
    digest: {
      daily: boolean
      weekly: boolean
    }
    urgentOnly: boolean
    quietHours: {
      enabled: boolean
      startTime: string
      endTime: string
    }
    optOutCategories: string[]
  }

  updatedAt: Date
  createdAt: Date
}
```

### 7.4a Resolved preference read model

This is a code-level read model, not a persisted Mongo collection.

```ts
type ResolvedEmailPreference = {
  source:
    | "teacher_settings"
    | "email_preference"
    | "school_default"
    | "platform_default"
  role: string
  channels: {
    email: boolean
    inApp: boolean
    whatsapp?: boolean
    sms?: boolean
  }
  categories: {
    attendance: boolean
    academics: boolean
    announcements: boolean
    billingReminders: boolean
    manualMessages: boolean
    lessonNoteReview: boolean
  }
  digest: {
    daily: boolean
    weekly: boolean
  }
  urgentOnly: boolean
  quietHours: {
    enabled: boolean
    startTime: string
    endTime: string
  }
  optOutCategories: string[]
}
```

Resolver rule:

- for teachers, map from `TeacherSettings`
- for all other supported roles, read from `EmailPreference`
- then apply school defaults, platform defaults, and suppressions

### 7.5 `EmailSuppression`

**Purpose**: enforce bounce/complaint safety and user opt-outs.

```ts
{
  _id: ObjectId
  email: string
  schoolId?: ObjectId | null
  scope: "global" | "school"
  reason:
    | "bounce"
    | "complaint"
    | "manual_block"
    | "unsubscribe_optional"
  categories?: string[]
  sourceProvider?: string | null
  active: boolean
  createdAt: Date
  updatedAt: Date
}
```

### 7.6 `EmailDispatchJob`

**Purpose**: durable job queue for outbound dispatch, inbound routing retries, and recovery work. This should follow the same durable-Mongo pattern already used by `ProvisioningJob`.

```ts
{
  _id: ObjectId
  kind:
    | "outbound_single"
    | "batch_chunk"
    | "digest_chunk"
    | "inbound_route"
    | "imap_recovery"

  emailMessageId?: ObjectId | null
  emailBatchId?: ObjectId | null
  schoolId?: ObjectId | null

  senderFamily?: "hello" | "billing" | "support" | null
  trafficClass: "transactional" | "manual" | "bulk" | "digest" | "system"
  priority: "critical" | "high" | "normal" | "low"

  status: "pending" | "running" | "failed" | "done" | "dead_letter"
  attempts: number
  maxAttempts: number
  nextRunAt?: Date | null
  lastError?: string | null

  rateScopeKey?: string | null
  claimedBy?: string | null
  lockedAt?: Date | null

  payload?: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}
```

### 7.7 `EmailRateWindow`

**Purpose**: enforce multi-tenant rate limits and fairness without requiring Redis in the first implementation.

```ts
{
  _id: ObjectId
  scopeType: "global" | "school" | "user" | "sender_family"
  scopeKey: string
  trafficClass: "transactional" | "manual" | "bulk" | "digest"
  windowStart: Date
  windowMinutes: number
  sentCount: number
  deferredCount: number
  bounceCount: number
  complaintCount: number
  createdAt: Date
  updatedAt: Date
}
```

### 7.8 `EmailBatch`

**Purpose**: track bulk email campaigns and mass sends.

```ts
{
  _id: ObjectId
  schoolId?: ObjectId | null
  mailboxScope: "platform" | "school"
  kind: "bulk" | "digest" | "scheduled_reminder"
  createdBy: ObjectId
  subject: string
  templateKey?: string | null
  recipientCount: number
  sentCount: number
  failedCount: number
  status: "draft" | "queued" | "running" | "completed" | "failed" | "cancelled"
  relatedEntityType?: string | null
  relatedEntityId?: string | null
  createdAt: Date
  updatedAt: Date
}
```

### 7.9 School branding and school email settings

Recommendation: add a dedicated email section to `SchoolSettings`, while keeping core identity in `School`.

```ts
SchoolSettings.email = {
  branding: {
    logoUrl?: string | null
    displayName?: string | null
    primaryColor?: string | null
    secondaryColor?: string | null
    footerText?: string | null
    signatureName?: string | null
  }
  sender: {
    mode: "edusentrix_managed"
    senderDisplayName?: string | null
    billingDisplayName?: string | null
    preferredReplyLabel?: string | null
    requestedReplyToEmail?: string | null
    effectiveReplyMode: "platform_routed_alias"
  }
  policy: {
    enableBulkEmail: boolean
    bulkSendingMode: "disabled" | "warmup" | "normal" | "paused"
    defaultQuietHoursEnabled: boolean
    quietHoursStart?: string | null
    quietHoursEnd?: string | null
    allowAttachmentsByDefault: boolean
    sensitiveEmailMode: "summary_plus_link"
  }
}
```

---

## 8. Template and Message Catalog

Every message type below is mandatory per product direction.

| Category | Message | Brand | Sender Family | Preference Class | Sensitivity |
|---|---|---|---|---|---|
| Auth | Verification code | Edusentrix via Clerk | `clerk` | transactional | moderate |
| Auth | Sign-in code | Edusentrix via Clerk | `clerk` | transactional | moderate |
| Auth | Password reset | Edusentrix via Clerk | `clerk` | transactional | moderate |
| Invitations | School admin invite | school | `hello` | transactional | moderate |
| Invitations | Teacher invite | school | `hello` | transactional | moderate |
| Invitations | Parent invite | school | `hello` | transactional | moderate |
| Invitations | Student invite | school | `hello` | transactional | moderate |
| Invitations | Staff invite | school | `hello` | transactional | moderate |
| Invitations | Billing owner invite | school | `billing` | transactional | moderate |
| Invitations | Bursar invite | school | `billing` | transactional | moderate |
| Platform | Application received | Edusentrix | `hello` | transactional | low |
| Platform | Application approved | Edusentrix | `hello` | transactional | low |
| Platform | Application rejected | Edusentrix | `hello` | transactional | low |
| Onboarding | School welcome/onboarding | Edusentrix | `hello` | transactional | low |
| Billing | Payment setup reminder | school | `billing` | transactional | low |
| Billing | Payment setup success | school | `billing` | transactional | low |
| Billing | Payment setup failure/review required | school | `billing` | transactional | low |
| Subscription | Trial ending | Edusentrix | `billing` | transactional | low |
| Subscription | Subscription suspended/cancelled/reactivated | Edusentrix | `billing` | transactional | low |
| Fees | Invoice issued | school | `billing` | transactional | guardian_only |
| Fees | Fee reminder | school | `billing` | optional or scheduled | guardian_only |
| Fees | Payment receipt | school | `billing` | transactional | guardian_only |
| Fees | Failed payment | school | `billing` | transactional | guardian_only |
| Fees | Refund confirmation | school | `billing` | transactional | guardian_only |
| Attendance | Attendance alert | school | `hello` | configurable | guardian_only |
| Academics | Assignment published | school | `hello` | configurable | guardian_only |
| Academics | Results/report card ready | school | `hello` | configurable | guardian_only |
| Community | Calendar event / announcement | school | `hello` | configurable | low to moderate |
| Lesson notes | Reminder to submit | school | `hello` | configurable | low |
| Lesson notes | Review comment / revisions requested | school | `hello` | configurable | low |
| Manual | One-to-one school email | school | `hello` or `billing` | manual | context dependent |
| Manual | One-to-one platform support email | Edusentrix | `support` | manual | context dependent |
| Bulk | School bulk email to parents/teachers/staff | school | `hello` or `billing` | optional | low to moderate |
| Digest | Weekly digest / summary | school or Edusentrix | varies | optional | low |

### 8.1 Sensitive email rule for academic and fee templates

For `guardian_only` categories:

- body contains summary only
- detail view is behind portal login or signed secure link
- attachments allowed only when recipient authorization is confirmed

---

## 9. Backend Implementation Plan

### 9.1 Target folder structure

```text
src/lib/email/
  index.ts
  registry.ts
  policy.ts
  routing.ts
  threading.ts
  sensitivity.ts
  preferences.ts
  suppressions.ts
  deliverability.ts
  quotas.ts
  adapters/
    teacher-settings.ts
  renderers/
    platform.ts
    school.ts
  providers/
    brevo-provider.ts
    spaceship-provider.ts
  services/
    send-brevo-email.ts
    send-manual-support-email.ts
    receive-brevo-inbound.ts
    mailbox-sync.ts
    dispatch-batch.ts
    send-invitation-email.ts
  templates/
    invitations.ts
    billing.ts
    academics.ts
    operations.ts
  attachments/
    invoice-pdf.ts
    receipt-pdf.ts
    report-card-pdf.ts
```

### 9.2 Compatibility rule

Keep `src/lib/email/brevo.ts` and `src/lib/email/templates.ts` working at first.

Implementation strategy:

- make the old `sendEmail()` call into the new orchestration layer
- keep old template keys valid during migration
- gradually move callers onto richer typed services

### 9.3 Models to add

Add:

- `src/models/EmailMessage.ts`
- `src/models/EmailThread.ts`
- `src/models/EmailEvent.ts`
- `src/models/EmailPreference.ts`
- `src/models/EmailSuppression.ts`
- `src/models/EmailDispatchJob.ts`
- `src/models/EmailRateWindow.ts`
- `src/models/EmailBatch.ts`

Extend:

- `src/models/SchoolSettings.ts`
- `src/models/TeacherSettings.ts` only if a non-breaking adapter helper or metadata field is necessary

### 9.4 Provider services to add

- `send-brevo-email.ts`
  - automated and tracked outbound mail
  - persists message records
- `send-manual-support-email.ts`
  - SMTP-based manual support/human email
  - persists message records
- `receive-brevo-inbound.ts`
  - webhook-first inbound processing for reply aliases
  - persists raw inbound payloads before routing
- `mailbox-sync.ts`
  - IMAP recovery sync only
  - imports direct mailbox mail for operator continuity or recovery
  - not part of the normal reply path

### 9.5 Reply routing service

Add:

- `src/lib/email/routing.ts`

Responsibilities:

- create reply alias tokens
- encode school scope, thread token, mailbox key, and entity hints
- parse inbound aliases
- validate token integrity
- route message to thread or create new thread if necessary

### 9.6 Brevo webhook route

Add:

- `src/app/api/webhooks/brevo/route.ts`

Responsibilities:

- verify webhook signature
- resolve `providerMessageId`
- append immutable `EmailEvent`
- update `EmailMessage.status`
- apply suppression if bounce/complaint/unsubscribe requires it

### 9.7 Brevo inbound parse route

Add:

- `src/app/api/webhooks/brevo-inbound/route.ts`

Responsibilities:

- verify inbound parse secret
- persist raw inbound item immediately
- enqueue routing work
- dedupe by provider message ID / message-id / routing token
- avoid expensive routing logic directly in the webhook request when possible

### 9.8 IMAP recovery sync route

Add:

- `src/app/api/cron/mailbox-sync/route.ts`

Responsibilities:

- poll only the direct Spacemail mailboxes
- import direct mailbox traffic not captured by the reply-domain webhook path
- support operator continuity and recovery
- remain idempotent and low-frequency

### 9.9 Email dispatch queue route

Add:

- `src/app/api/cron/email-dispatch/route.ts`

Responsibilities:

- process queued bulk/digest jobs
- process retryable outbound single-message jobs
- process inbound routing retries
- honor preferences and quiet hours
- honor quotas and fairness controls
- create `EmailMessage` records
- send via provider

### 9.10 Admin APIs

Add:

- `src/app/api/admin/settings/email/route.ts`
- `src/app/api/admin/email/inbox/route.ts`
- `src/app/api/admin/email/threads/[id]/route.ts`
- `src/app/api/admin/email/threads/[id]/messages/route.ts`
- `src/app/api/admin/email/compose/route.ts`
- `src/app/api/admin/email/bulk/route.ts`
- `src/app/api/admin/email/history/route.ts`
- `src/app/api/admin/email/preferences/route.ts`

Responsibilities:

- school email branding/settings
- school inbox read view
- compose and reply
- bulk email composition and dispatch
- entity-linked email history lookup

### 9.11 Platform APIs

Add:

- `src/app/api/platform/email/inbox/route.ts`
- `src/app/api/platform/email/threads/[id]/route.ts`
- `src/app/api/platform/email/compose/route.ts`
- `src/app/api/platform/email/suppressions/route.ts`

Responsibilities:

- global support inbox
- platform billing inbox
- platform admin manual sends
- suppression administration

### 9.12 Existing routes to migrate carefully

Do not break these. Migrate them in place:

- `src/app/api/admin/teachers/create/route.ts`
- `src/app/api/admin/teachers/bulk-create/route.ts`
- `src/app/api/admin/invitations/[id]/resend/route.ts`
- `src/app/api/admin/students/[id]/guardians/route.ts`
- `src/app/api/admin/settings/payment-setup/owner-invite/route.ts`
- `src/app/api/admin/settings/payment-setup/delegate-invite/route.ts`
- `src/app/api/platform/applications/route.ts`
- `src/app/api/platform/applications/[id]/approve/route.ts`
- `src/lib/notifications/fee-reminders.ts`
- `src/lib/school-payments/payment-setup-notifications.ts`

### 9.13 Clerk integration changes

Current code uses Clerk invitations and also sends branded invite emails manually. That should become:

- create Clerk invitation with `notify: false`
- store invitation metadata locally
- send EduSentrix or school-branded invitation through the email service

Current webhook file `src/app/api/webhooks/clerk/route.ts` should remain the identity linkage point. Extend only as needed for invite lifecycle alignment and user linking.

### 9.14 Auth email handling

Do **not** add a `send-auth-email.ts` service in the first implementation.

Instead:

- customize auth templates in Clerk Dashboard
- keep `Delivered by Clerk` enabled for auth templates
- treat auth mail as operationally outside the EduSentrix outbound pipeline

Optional future work can add lightweight auth-email observability, but delivery remains Clerk-owned.

### 9.15 PDF generation and attachment services

Add or reuse per-domain generators:

- invoice PDF from fees domain
- receipt PDF from payments domain
- report card PDF from reports domain

Do not duplicate PDF generation logic if the fees/reports domains already expose generation routes. Reuse shared builders where practical.

### 9.16 Error handling, retry, and dead-letter policy

Reuse the durable job pattern already present in the codebase around:

- `src/models/ProvisioningJob.ts`
- `src/lib/jobs/provisioning.ts`

Email jobs must follow the same shape:

- durable Mongo-backed queue
- atomic claim
- exponential backoff
- terminal dead-letter state
- best-effort status stamping on related entities

Policy:

- retry on provider `429`, `5xx`, timeouts, and connection failures
- retry on transient PDF generation failures
- do not retry invalid-recipient or invalid-payload failures
- dead-letter after `maxAttempts`
- expose operator retry from the UI only when the underlying issue is likely recoverable

### 9.17 Rate limiting and fair scheduling

Implement two layers:

1. **API admission control**
   - block or defer excessive manual and bulk send requests before queueing
2. **worker throttling**
   - enforce global, per-school, per-user, and per-sender-family limits while dispatching

Baseline rules:

- transactional: highest priority
- manual: above bulk
- bulk: chunked and scheduled
- digest: lowest priority

Fairness rules:

- max one running bulk chunk per school at a time
- round-robin between schools for bulk work
- if Brevo returns `429`, set a global cooldown window and stop claiming additional outbound jobs briefly

### 9.18 Sender reputation and suppression strategy

Required controls:

- per-school deliverability metrics
- per-school complaint and bounce thresholds
- automatic bulk pause on threshold breach
- mandatory unsubscribe footer for optional bulk/digest mail
- hard suppression on hard bounce or complaint
- no bulk mail from schools with unresolved deliverability risk

Operational strategy:

- bulk sends use a separate traffic class from transactional mail
- every outbound message carries school and traffic metadata in tags/custom headers
- dashboards must allow filtering by school, sender family, and traffic class
- new schools begin in `warmup` mode with conservative quotas before graduating to normal bulk mode
- if total bulk volume becomes material, move bulk traffic to a dedicated IP or isolated sender pool without touching transactional flows

### 9.19 Preference resolution adapter

Do not dual-write `TeacherSettings` into `EmailPreference` in the initial rollout.

Instead implement:

- `resolveEmailPreference(userId, role, schoolId, category)`

Resolution order:

1. hard suppression
2. role-native source
   - teachers -> `TeacherSettings`
   - others -> `EmailPreference`
3. school defaults
4. platform defaults
5. message-class overrides for transactional traffic

This preserves current teacher behavior while still giving the rest of the platform a generic preference model.

### 9.20 Multi-tenant scaling strategy

The system must be able to handle many schools without one school degrading others.

Required design rules:

- no synchronous N-recipient bulk sending inside request handlers
- chunk large batches into deterministic slices
- isolate queue priority by traffic class
- capture per-school metrics and sender health
- support later migration to dedicated IP or pool isolation without rewriting the model layer

---

## 10. Frontend Implementation Plan

### 10.1 Admin settings surfaces

Add a new settings route:

- `/admin/settings/email`

This should follow the current settings visual language in:

- `src/app/(app)/admin/settings/page.tsx`

Sections:

- Branding
- Sender identity
- Reply routing
- Quiet hours
- Bulk email policy
- Sensitive email policy
- Default attachment policy

### 10.2 School inbox surface

Add:

- `/admin/email`

Sections:

- Inbox
- Sent
- Failures / retries
- Bulk sends
- Delivery health
- Templates

Capabilities:

- read threads
- reply
- compose new
- filter by inbox type: general, billing, school operations

### 10.3 Platform inbox surface

Add:

- `/platform/email`

Sections:

- Support inbox
- Billing inbox
- Sent mail
- Suppressions

### 10.4 Entity-linked history panels

Add compact email history components to selected existing screens:

- school application detail
- invitation detail/list
- payment setup detail
- invoice detail
- payment detail
- fee reminder history

These should show:

- last sent at
- sender family
- delivery status
- opened / clicked if applicable
- resend action where allowed

### 10.5 Preferences UI

Phase 1 preferences UI should exist for:

- teacher
- parent
- school admin
- bursar

Teacher settings already exist and should be extended carefully, not replaced abruptly.

Parent preferences can be added under:

- `/parent/notifications`

School admin and bursar preferences can be under:

- `/admin/settings/email`

### 10.6 Compose UI behavior

Manual compose should enforce:

- role-based recipient restrictions
- category selection
- optional attachment support
- sensitivity warning when content may include student-specific data
- preview before send

### 10.7 Bulk send UI behavior

School admin and bursar bulk email UI should support:

- recipient audience selectors:
  - parents
  - teachers
  - staff
- filters:
  - class
  - grade
  - invoice/outstanding state
  - role
- draft preview
- estimated send count
- blocked/suppressed recipient count preview
- school quota preview
- expected send duration / throttling hint
- mandatory unsubscribe / footer preview for optional mail
- delivery health warnings before send
- auto-pause explanation if school bulk mail is currently restricted

### 10.8 Design consistency rule

Any new page or panel should preserve the established EduSentrix UI language already present in:

- admin settings
- teacher settings
- lesson note review surfaces
- payment setup surfaces

Do not introduce a separate visual system for email management.

---

## 11. Privacy, Security, and Compliance Rules

### 11.1 Student data restrictions

Never send detailed student-specific content to arbitrary addresses.

Allowed:

- verified guardian email on record
- verified parent/guardian user linked to the student
- school operations contacts where content is non-student-specific

Not allowed:

- ad hoc recipient typed into manual compose for student-sensitive data
- external recipients not on the approved guardian relationship

### 11.2 Unmasking rule

When content is sensitive:

- email shows summary only
- CTA opens secure portal view
- optional one-time signed link may be used for specific cases

Signed links must be:

- time-limited
- single-use or short-use
- bound to recipient email
- scoped to the related entity

### 11.3 Suppression handling

Hard suppression applies immediately for:

- complaints
- hard bounces
- manual platform block

Optional suppression applies for:

- unsubscribed optional categories

### 11.4 Bulk email safety rules

Bulk email must:

- include a clear unsubscribe path for optional categories
- exclude guardian-only or sensitive student detail from the body
- respect school and platform quotas
- auto-pause when complaint or bounce thresholds are exceeded
- never outrank transactional traffic in the queue

### 11.5 Auditability

Every outbound and inbound message must capture:

- who triggered it
- why it was sent
- what entity it was about
- which provider handled it
- final status and failure reason

### 11.6 RBAC

Platform admin:

- full platform email access

School admin:

- school inbox, school settings, school sends

Bursar:

- manual and bulk finance-oriented send access
- no global school settings ownership unless separately granted

Teachers:

- no manual email compose in v1
- keep using internal messaging

---

## 12. Migration and Backfill Strategy

### 12.1 No-breaking-change migration rule

Migration order:

1. introduce models and provider services
2. wrap current Brevo sender
3. begin auditing messages without changing all call sites
4. migrate invitation flows
5. add Brevo inbound parse and routing
6. migrate fee reminders and payment setup notifications
7. add inboxes and preferences
8. leave auth with Clerk and only harden branding there

### 12.2 Existing invitations

Current invitation routes should be changed from:

- Clerk invite plus branded email

To:

- Clerk invite with `notify: false`
- EduSentrix-managed branded email
- local audit record

### 12.3 Existing templates

Keep current template keys working:

- `SCHOOL_INVITE`
- `SCHOOL_ONBOARDING`
- `ADMIN_CREATED`
- `USER_INVITE`
- `APPLICATION_RECEIVED`
- `REMINDER`
- `FEE_REMINDER`
- `PASSWORD_OTP`

Then map them into the new registry so old callers do not break while migration is in progress.

Important:

- `PASSWORD_OTP` remains a compatibility template only
- it must not become the primary auth delivery path while Clerk remains the auth email sender

### 12.4 Existing preferences

Teacher settings already contain email prefs and quiet hours. Preserve them.

Migration approach:

- keep `TeacherSettings.notifications.email.*`
- keep teacher writes inside `TeacherSettings`
- introduce unified email preference resolver
- derive missing defaults for other roles
- store non-teacher preferences in `EmailPreference`
- do not dual-write teachers in phase 1

### 12.5 Backfill

Do not attempt historical backfill of all legacy emails unless there is an existing authoritative log source. Start with forward-only auditing from the new system.

---

## 13. Phased Delivery Plan

All items are mandatory. Phases define order, not optionality.

### Phase 1: Foundation and Compatibility

- add email models
- add email dispatch job and rate-window models
- add Brevo and Spacemail provider services
- add compatibility wrapper around current Brevo sender
- add reply alias routing service
- add email audit persistence
- add Brevo outbound and inbound webhook endpoints

### Phase 2: Invitations and Inbound Routing

- convert Clerk invitation flows to `notify: false`
- move all invite emails onto the new email service
- add primary inbound reply routing through Brevo inbound parsing
- add invite templates

### Phase 3: Core Transactional School Email

- application received / approved / rejected
- onboarding welcome
- payment setup reminder / success / failure
- invoice issued
- fee reminder
- payment receipt
- failed payment
- refund confirmation

### Phase 4: Preferences, Suppression, and Policy

- add `EmailPreference`
- add `EmailSuppression`
- add `resolveEmailPreference()` adapter layer
- add quiet hours
- add digest scheduling
- add guardian-only and summary-plus-link policy enforcement

### Phase 5: Inboxes and Manual Email

- add platform inbox
- add school inbox
- add manual compose
- add IMAP recovery sync
- add entity-linked history

### Phase 6: Bulk Email, Deliverability, and Attachments

- bulk send UI and API
- batch tracking
- school quotas and fair scheduling
- deliverability health dashboards
- auto-pause on complaint/bounce thresholds
- attachments and PDFs
- retry flows and failure dashboards

### Phase 7: Advanced School Branding

- school email settings UI
- branding previews
- reply identity controls
- optional groundwork for later verified custom sender/reply support

---

## 14. Acceptance Criteria

The system is acceptable when all of the following are true.

### 14.1 Delivery and audit

- Every outbound email creates an `EmailMessage`.
- Every Brevo event creates an `EmailEvent`.
- Every inbound reply creates an inbound `EmailMessage`.
- Delivery outcomes are visible in the relevant UI.

### 14.2 Invitation behavior

- Clerk invitation identity records are still created.
- Clerk does not send duplicate invitation emails.
- EduSentrix sends the visible invitation email instead.
- Invitation resend uses the same pattern.

### 14.2a Auth behavior

- Clerk continues to deliver auth emails.
- Auth templates are branded for EduSentrix in Clerk.
- The EduSentrix email pipeline does not become a critical dependency for sign-in or password reset.

### 14.3 School branding

- School-originated messages show school branding.
- Platform-originated messages show Edusentrix branding.
- Branding settings are editable from a school admin settings surface.

### 14.4 Reply routing

- Replies to platform messages reach the platform inbox.
- Replies to school messages reach the correct school inbox.
- Replies to billing messages route to the right school/platform billing context.
- Primary reply routing works through Brevo inbound parsing on the reply subdomain.
- IMAP recovery is not required for normal reply handling.

### 14.5 Preferences and policy

- Optional messages honor preferences and quiet hours.
- Transactional messages are still deliverable when appropriate.
- Suppressed recipients are skipped safely.
- Sensitive student data is not leaked in email bodies to unsafe recipients.
- Teachers continue to honor existing `TeacherSettings` preferences without a breaking migration.

### 14.5a Deliverability and scale

- One school's bulk send cannot block another school's transactional mail.
- Bulk traffic is quota-controlled and fair-scheduled.
- Complaint or bounce spikes auto-pause bulk traffic for the affected school.

### 14.6 UI and operations

- School admin can view school inbox and school email settings.
- Platform admin can view platform inbox and suppressions.
- Bursar can send allowed bulk/manual messages.
- Existing working invitation and fee reminder flows still function after migration.

---

## 15. AI Execution Checklist

This is the recommended build order for an AI agent.

### Step 1

Create new models:

- `EmailMessage`
- `EmailThread`
- `EmailEvent`
- `EmailPreference`
- `EmailSuppression`
- `EmailDispatchJob`
- `EmailRateWindow`
- `EmailBatch`

### Step 2

Create new provider and service files under `src/lib/email/` while preserving `src/lib/email/brevo.ts`.

### Step 3

Refactor `src/lib/email/brevo.ts` so `sendEmail()` and `sendRawEmail()` delegate into the new orchestration layer without changing their public call signature.

### Step 4

Add Brevo outbound webhook route and Brevo inbound parse route.

### Step 5

Add reply alias generation and inbound routing.

### Step 6

Change every Clerk invitation creation call to `notify: false` and send the branded email through EduSentrix instead.

Primary files to update:

- `src/app/api/admin/teachers/create/route.ts`
- `src/app/api/admin/teachers/bulk-create/route.ts`
- `src/app/api/admin/invitations/[id]/resend/route.ts`
- `src/app/api/admin/students/[id]/guardians/route.ts`
- `src/app/api/admin/settings/payment-setup/owner-invite/route.ts`
- `src/app/api/admin/settings/payment-setup/delegate-invite/route.ts`
- `src/app/api/platform/applications/[id]/approve/route.ts`

### Step 7

Add school email branding settings into `SchoolSettings` and build `/admin/settings/email`.

### Step 8

Build `/admin/email` and `/platform/email`.

### Step 9

Migrate current fee reminder and payment setup notification paths onto the new service:

- `src/lib/notifications/fee-reminders.ts`
- `src/lib/school-payments/payment-setup-notifications.ts`

### Step 10

Add generic preferences and suppression logic, then wire teacher settings into the new shared policy layer.

### Step 11

Add rate limits, fair scheduling, deliverability health, attachments, PDFs, secure-link unmask flows, and bulk send jobs.

### Step 12

Run a complete regression pass on:

- teacher invite
- guardian invite
- billing owner invite
- platform application approval
- fee reminder
- payment setup notification
- Clerk auth template flow
- inbound reply routing

---

## Appendix: Official References

- Clerk application invitations: <https://clerk.com/docs/guides/development/custom-flows/authentication/application-invitations>
- Clerk invitation API with `notify`: <https://clerk.com/docs/reference/backend/invitations/create-invitation>
- Clerk email and SMS templates: <https://clerk.com/docs/guides/customizing-clerk/email-sms-templates>
- Clerk webhooks overview: <https://clerk.com/docs/guides/development/webhooks/overview>
- Brevo transactional webhooks: <https://developers.brevo.com/docs/transactional-webhooks>
- Brevo inbound parsing: <https://developers.brevo.com/docs/inbound-parse-webhooks>
- Brevo webhook retry mechanism: <https://developers.brevo.com/docs/retry-mechanism>
- Brevo domain authentication: <https://help.brevo.com/hc/en-us/articles/12163873383186--New-Authenticate-your-domain-to-improve-the-deliverability-of-your-emails-DKIM-and-Brevo-code->
- Brevo dedicated IP guidance: <https://help.brevo.com/hc/en-us/articles/22135465350290-New-Admin-account-Set-up-a-dedicated-IP-for-your-sub-organizations>
- Spacemail IMAP/SMTP setup: <https://www.spaceship.com/en-GB/knowledgebase/connect-spacemail-to-email-client/>
