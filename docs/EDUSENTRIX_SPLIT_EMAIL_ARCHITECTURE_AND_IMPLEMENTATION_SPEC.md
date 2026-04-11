# EduSentrix Split Email Architecture & Implementation Spec

> **Version**: 1.0  
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
- **Spaceship / Spacemail** hosts real inboxes and handles manual one-to-one and inbound reply traffic.
- All outbound and inbound email is auditable.
- The platform supports both **Edusentrix-branded** and **school-branded** email.
- The platform can route replies back to the correct school or platform inbox without creating a real mailbox for every school in v1.

This must be implemented without breaking currently working invitation, payment, reminder, or notification flows.

---

## 2. Goals and Non-Goals

### 2.1 Goals

- Build a **platform-wide** email system for EduSentrix.
- Self-deliver all **auth emails**.
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
- Current invitation flows can produce duplication if Clerk sends its own invite email and EduSentrix sends another branded email

### 3.3 Principle for this spec

Do not rip out the current invitation and reminder code first. Introduce a compatibility layer, then migrate call sites gradually.

---

## 4. Core Product Decisions

### 4.1 Provider split

- **Brevo** handles all automated/platform email.
- **Spaceship / Spacemail** hosts the real inboxes:
  - `hello@tryedusentrix.app`
  - `support@tryedusentrix.app`
  - `billing@tryedusentrix.app`

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

### 4.4 Self-delivered auth email rule

EduSentrix will self-deliver all auth emails. Clerk remains the identity system, but EduSentrix becomes the delivery and branding layer for:

- verification code
- sign-in code
- password reset
- invitation-adjacent auth steps

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
- inbound sync reads all mail from the shared mailbox
- replies are matched back to school/thread/entity

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
- MX records for Spacemail mailbox hosting
- any Brevo webhook verification requirements

### 5.2 Brevo

Configure:

- transactional email API key
- authenticated sender domain
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

### 5.3 Spacemail / Spaceship

Create:

- `hello@tryedusentrix.app`
- `support@tryedusentrix.app`
- `billing@tryedusentrix.app`

Enable:

- SMTP
- IMAP
- aliases
- catch-all or equivalent reply-routing support on the reply domain

### 5.4 Clerk

Operator actions:

- keep Clerk as the identity provider
- add webhook endpoint for required user/invitation events
- disable Clerk-delivered auth emails where applicable so EduSentrix self-delivers
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
        |
        +--> Spacemail SMTP --------------> manual human email
        |
        +--> Audit persistence -----------> EmailMessage / EmailEvent / EmailThread / EmailBatch
        |
        +--> Reply routing metadata -----> reply aliases + thread tokens

Inbound replies
        |
        v
Spacemail inbox / aliases
        |
        +--> IMAP sync job
        |
        +--> message parser + router
        |
        +--> EmailMessage(direction=inbound)
        |
        +--> school inbox / platform inbox UI
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
- replies route back into Edusentrix inboxes

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

### 6.6 Quiet hours and digests

Email preferences support:

- immediate delivery
- urgent-only delivery
- daily digest
- weekly digest
- quiet hours

Transactional mail ignores quiet hours if legally or operationally necessary. Optional mail should respect quiet hours and digest settings.

### 6.7 Attachments and generated PDFs

Supported attachment classes in v1:

- invoice PDF
- receipt PDF
- statement PDF
- report card PDF only when policy allows and recipient is guardian-safe

Generated files should be attached only when:

- the recipient is authorized
- the template classification allows attachment
- the data sensitivity checker permits it

### 6.8 Suppression and opt-out model

The system must distinguish:

- **hard suppression**: bounce, complaint, blocked
- **soft preference opt-out**: optional categories
- **channel-level pause**: quiet hours or digest

Transactional flows should record attempted delivery even when optional delivery would have been skipped.

---

## 7. Data Model Changes

### 7.1 `EmailMessage`

**Purpose**: single source of truth for every inbound and outbound email.

```ts
{
  _id: ObjectId
  provider: "brevo" | "spaceship" | "clerk_proxy" | "system"
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

**Purpose**: unified preferences for roles beyond existing teacher settings.

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

### 7.6 `EmailBatch`

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

### 7.7 School branding and school email settings

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
| Auth | Verification code | Edusentrix | `hello` | transactional | moderate |
| Auth | Sign-in code | Edusentrix | `hello` | transactional | moderate |
| Auth | Password reset | Edusentrix | `hello` | transactional | moderate |
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
  renderers/
    platform.ts
    school.ts
  providers/
    brevo-provider.ts
    spaceship-provider.ts
  services/
    send-brevo-email.ts
    send-manual-support-email.ts
    mailbox-sync.ts
    dispatch-batch.ts
    send-auth-email.ts
    send-invitation-email.ts
  templates/
    auth.ts
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
- `src/models/EmailBatch.ts`

Extend:

- `src/models/SchoolSettings.ts`
- `src/models/TeacherSettings.ts` only by mapping to new generic preference rules, not by breaking current fields

### 9.4 Provider services to add

- `send-brevo-email.ts`
  - automated and tracked outbound mail
  - persists message records
- `send-manual-support-email.ts`
  - SMTP-based manual support/human email
  - persists message records
- `mailbox-sync.ts`
  - IMAP inbound sync
  - routes inbound replies
  - stores inbound messages

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

### 9.7 Mailbox sync route

Add:

- `src/app/api/cron/mailbox-sync/route.ts`

Responsibilities:

- poll IMAP inbox
- fetch recent inbound mail
- parse sender, recipients, subject, headers, text/html
- route to school/platform inbox
- dedupe by provider message ID / message-id

### 9.8 Email dispatch queue route

Add:

- `src/app/api/cron/email-dispatch/route.ts`

Responsibilities:

- process queued bulk/digest jobs
- honor preferences and quiet hours
- create `EmailMessage` records
- send via provider

### 9.9 Admin APIs

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

### 9.10 Platform APIs

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

### 9.11 Existing routes to migrate carefully

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

### 9.12 Clerk integration changes

Current code uses Clerk invitations and also sends branded invite emails manually. That should become:

- create Clerk invitation with `notify: false`
- store invitation metadata locally
- send EduSentrix or school-branded invitation through the email service

Current webhook file `src/app/api/webhooks/clerk/route.ts` should remain the identity linkage point. Extend only as needed for self-delivered auth and invite lifecycle alignment.

### 9.13 Auth email handling

Add:

- `src/lib/email/services/send-auth-email.ts`

Use this for:

- verification code
- sign-in code
- password reset

Clerk remains the identity backend, but email delivery comes through EduSentrix branding and audit tracking.

### 9.14 PDF generation and attachment services

Add or reuse per-domain generators:

- invoice PDF from fees domain
- receipt PDF from payments domain
- report card PDF from reports domain

Do not duplicate PDF generation logic if the fees/reports domains already expose generation routes. Reuse shared builders where practical.

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

### 11.4 Auditability

Every outbound and inbound message must capture:

- who triggered it
- why it was sent
- what entity it was about
- which provider handled it
- final status and failure reason

### 11.5 RBAC

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
5. migrate fee reminders and payment setup notifications
6. add inboxes and preferences
7. add self-delivered auth emails

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

### 12.4 Existing preferences

Teacher settings already contain email prefs and quiet hours. Preserve them.

Migration approach:

- keep `TeacherSettings.notifications.email.*`
- introduce unified email preference reader
- derive missing defaults for other roles

### 12.5 Backfill

Do not attempt historical backfill of all legacy emails unless there is an existing authoritative log source. Start with forward-only auditing from the new system.

---

## 13. Phased Delivery Plan

All items are mandatory. Phases define order, not optionality.

### Phase 1: Foundation and Compatibility

- add email models
- add Brevo and Spacemail provider services
- add compatibility wrapper around current Brevo sender
- add reply alias routing service
- add email audit persistence

### Phase 2: Invitations and Auth

- convert Clerk invitation flows to `notify: false`
- move all invite emails onto the new email service
- add self-delivered auth email support
- add invite and auth templates

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
- add quiet hours
- add digest scheduling
- add guardian-only and summary-plus-link policy enforcement

### Phase 5: Inboxes and Manual Email

- add platform inbox
- add school inbox
- add manual compose
- add reply handling via IMAP sync
- add entity-linked history

### Phase 6: Bulk Email and Attachments

- bulk send UI and API
- batch tracking
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

### 14.3 School branding

- School-originated messages show school branding.
- Platform-originated messages show Edusentrix branding.
- Branding settings are editable from a school admin settings surface.

### 14.4 Reply routing

- Replies to platform messages reach the platform inbox.
- Replies to school messages reach the correct school inbox.
- Replies to billing messages route to the right school/platform billing context.

### 14.5 Preferences and policy

- Optional messages honor preferences and quiet hours.
- Transactional messages are still deliverable when appropriate.
- Suppressed recipients are skipped safely.
- Sensitive student data is not leaked in email bodies to unsafe recipients.

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
- `EmailBatch`

### Step 2

Create new provider and service files under `src/lib/email/` while preserving `src/lib/email/brevo.ts`.

### Step 3

Refactor `src/lib/email/brevo.ts` so `sendEmail()` and `sendRawEmail()` delegate into the new orchestration layer without changing their public call signature.

### Step 4

Add Brevo webhook route and Spacemail IMAP sync route.

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

Add attachments, PDFs, secure-link unmask flows, and bulk send jobs.

### Step 12

Run a complete regression pass on:

- teacher invite
- guardian invite
- billing owner invite
- platform application approval
- fee reminder
- payment setup notification
- auth email flow
- inbound reply routing

---

## Appendix: Official References

- Clerk application invitations: <https://clerk.com/docs/guides/development/custom-flows/authentication/application-invitations>
- Clerk invitation API with `notify`: <https://clerk.com/docs/reference/backend/invitations/create-invitation>
- Clerk webhooks overview: <https://clerk.com/docs/guides/development/webhooks/overview>
- Brevo transactional webhooks: <https://developers.brevo.com/docs/transactional-webhooks>
- Brevo domain authentication: <https://help.brevo.com/hc/en-us/articles/12163873383186--New-Authenticate-your-domain-to-improve-the-deliverability-of-your-emails-DKIM-and-Brevo-code->
- Spacemail IMAP/SMTP setup: <https://www.spaceship.com/en-GB/knowledgebase/connect-spacemail-to-email-client/>

