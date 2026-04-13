# EduSentrix Audit Hardening Spec

> **Version**: 1.1  
> **Date**: April 12, 2026  
> **Status**: Ready for phased implementation  
> **Audience**: Product, design, and engineering  
> **Intent**: This document is written so an AI coding agent or engineer can harden auditability across EduSentrix without breaking existing working code or replacing reliable domain flows prematurely.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Goals and Non-Goals](#2-goals-and-non-goals)
3. [Current State in EduSentrix](#3-current-state-in-edusentrix)
4. [Core Product Decisions](#4-core-product-decisions)
5. [Risk Tiers and Audit Guarantees](#5-risk-tiers-and-audit-guarantees)
6. [Unexcusable Actions by Role](#6-unexcusable-actions-by-role)
7. [Target Architecture](#7-target-architecture)
8. [Data Model Changes](#8-data-model-changes)
9. [Audit Event Catalog and Action Codes](#9-audit-event-catalog-and-action-codes)
10. [Backend Implementation Plan](#10-backend-implementation-plan)
11. [Frontend Implementation Plan](#11-frontend-implementation-plan)
12. [Security, Privacy, and Retention Rules](#12-security-privacy-and-retention-rules)
13. [Migration and Backfill Strategy](#13-migration-and-backfill-strategy)
14. [Phased Delivery Plan](#14-phased-delivery-plan)
15. [Acceptance Criteria](#15-acceptance-criteria)
16. [AI Execution Checklist](#16-ai-execution-checklist)

---

## 1. Overview

EduSentrix already has pieces of an audit trail, but they are uneven:

- a generic school activity feed exists in `src/models/Activity.ts`
- platform applications have a dedicated audit model in `src/models/ApplicationAudit.ts`
- payments have a dedicated event trail in `src/models/PaymentAuditEvent.ts`
- timetable changes have a dedicated change log in `src/models/TimetableChangeLog.ts`
- email now has a detailed message history in `src/models/EmailMessage.ts`

The problem is not that nothing exists. The problem is that the current system is not uniformly trustworthy:

- some logs are best-effort only
- some logs can be deleted
- some workflows do not capture before/after or reason context
- some high-risk actions are only visible in operational feeds, not durable audit records
- platform-wide audit review is not unified

This spec defines a world-class but additive hardening model:

- critical actions get immutable, durable audit events
- current specialized audit stores remain in place
- current working routes and domain flows are not rewritten from scratch
- the old `Activity` model becomes an operational feed, not the primary source of truth
- new audit infrastructure slots into current code paths incrementally

The design goal is clear:

- **do not break working code**
- **do not force a big-bang rewrite**
- **do not allow critical actions to occur without durable accountability**

---

## 2. Goals and Non-Goals

### 2.1 Goals

- Harden auditability across all account types:
  - `platform_admin`
  - `school_admin`
  - `billing_owner`
  - `bursar`
  - `staff`
  - `teacher`
  - `parent`
  - `student`
  - `system`, `webhook`, and `job` actors
- Define which actions are non-negotiable and must never happen without durable audit.
- Add a single central `AuditEvent` envelope without removing existing domain audit stores.
- Make audit writes tiered so the platform uses the right strength for the right action.
- Preserve current API contracts and domain behavior while adding stronger audit guarantees underneath.
- Support entity timelines for:
  - school
  - student
  - teacher
  - invoice
  - payment
  - timetable version
  - lesson note
  - application
  - subscription
  - email thread
- Add the missing platform-wide audit surface that the product structure already implies.
- Introduce tamper-evident audit chains for critical events.

### 2.2 Non-Goals

- This spec does not replace internal messaging.
- This spec does not replace current domain models such as `PaymentAuditEvent` or `ApplicationAudit`.
- This spec does not require every low-risk read action to be logged forever.
- This spec does not require a full SIEM or external compliance platform in v1.
- This spec does not attempt to retroactively reconstruct all historical actor context perfectly for old data.

### 2.3 Guiding Principle

Current flows must continue to work even if a specific phase of audit hardening has not yet been rolled out to that area.

That means:

- add audit infrastructure behind stable route contracts
- dual-write before cutting over readers
- keep existing timeline UIs working while introducing stronger backing models

---

## 3. Current State in EduSentrix

### 3.1 Existing audit-related components

- Generic activity feed:
  - `src/models/Activity.ts`
  - `src/lib/audit/recordActivity.ts`
  - `src/app/api/admin/activity/route.ts`
  - `src/app/api/admin/activities/route.ts`
- Teacher-specific activity:
  - `src/models/TeacherActivity.ts`
  - `src/lib/teachers/logTeacherActivity.ts`
- Platform application audit:
  - `src/models/ApplicationAudit.ts`
  - `src/lib/audit/recordApplicationAudit.ts`
- Payment audit:
  - `src/models/PaymentAuditEvent.ts`
  - payment endpoints and webhook handlers
- Timetable audit:
  - `src/models/TimetableChangeLog.ts`
  - `src/lib/timetable/audit.ts`
- Email delivery audit:
  - `src/models/EmailMessage.ts`
  - `src/lib/email/brevo.ts`
  - `src/app/api/webhooks/brevo/route.ts`
  - `src/app/api/webhooks/brevo-inbound/route.ts`

### 3.2 Confirmed weaknesses

- `recordActivity()` is best-effort and swallows failures.
- `logTeacherActivity()` is best-effort and swallows failures.
- generic `Activity` records can be deleted by school admins after one month.
- the generic activity layer has route inconsistency:
  - one endpoint filters by `action`
  - another filters by `type`
- platform navigation advertises `/platform/audit`, but there is no implemented platform audit page yet.
- some critical flows have rich domain logs, but no unified cross-domain audit viewer.
- many sensitive changes do not yet capture:
  - request context
  - IP
  - user agent
  - reason code
  - approval chain
  - before/after diffs

### 3.3 Current strengths to preserve

- `PaymentAuditEvent` is already meaningful and should not be thrown away.
- `ApplicationAudit` is already a proper append-only event store for that domain.
- `TimetableChangeLog` already captures before/after snapshots and supports session-based writes.
- `EmailMessage` is richer than the old generic audit layer and should remain a first-class audit source for email.

### 3.4 Principle for this spec

Do not replace strong domain audit stores with one weaker generic store.

Instead:

- keep strong domain logs
- add a central normalized audit envelope
- allow entity timelines to combine specialized and normalized records

---

## 4. Core Product Decisions

### 4.1 Audit is tiered

EduSentrix must distinguish between:

- operational feed events
- important but retryable business events
- critical events that must never commit without audit

This spec defines:

- `Tier 0`: transactional, non-negotiable audit
- `Tier 1`: durable, retryable audit
- `Tier 2`: best-effort operational feed

### 4.2 Existing specialized audit models stay

The new central audit system does **not** replace:

- `ApplicationAudit`
- `PaymentAuditEvent`
- `TimetableChangeLog`
- `EmailMessage`

These remain valid domain sources.

The new `AuditEvent` model becomes:

- the common cross-domain envelope
- the source for platform-wide audit review
- the place where uniform actor, request, target, and risk metadata live

### 4.3 Generic `Activity` is no longer the source of truth for critical actions

`Activity` stays in the product for:

- dashboard feeds
- lightweight recent activity panels
- low-risk operational awareness

It should no longer be considered sufficient for:

- financial accountability
- academic record integrity
- permission-sensitive changes
- platform governance

### 4.4 Immutable means append-only

For `Tier 0` and `Tier 1`:

- audit records must not be edited or deleted through the app
- corrections happen through compensating events
- masking/unmasking does not mutate old events beyond controlled redaction fields
- any redaction itself is an auditable action

### 4.5 AI, webhooks, and jobs are first-class actors

Audit cannot assume every action was performed by a signed-in human user.

The platform must support actor types:

- `user`
- `system`
- `webhook`
- `job`
- `ai_assist`
- `migration`

### 4.6 Reads are not all equal

Most reads do not need permanent audit.

These do:

- secure report download
- export generation
- unmask of hidden financial or guardian data
- access to sensitive email threads
- access to certain payment or subscription details if unmasked

### 4.7 Non-negotiable events must capture reason context

For overrides, reversals, rejections, deletions, or high-risk edits, audit must capture:

- structured reason code
- free-text explanation
- actor
- reviewed-by or approved-by actor if applicable

### 4.8 Tenant boundary must be explicit

Every auditable event must be clearly scoped to:

- `platform`
- `school`
- optionally a school sub-domain such as finance or academics

This is mandatory for filtering, retention, and breach containment.

### 4.9 Canonical audit relationship

EduSentrix will temporarily operate with both:

- domain-native audit stores
- the normalized `AuditEvent` envelope

That is acceptable only if the relationship is explicit.

The rule is:

- the specialized domain store remains the **domain-native source**
- `AuditEvent` becomes the **cross-domain search, governance, and UI envelope**
- neither side should silently drift

Examples:

- `PaymentAuditEvent` remains the finance-native timeline for payments
- `ApplicationAudit` remains the application-native timeline for school applications
- `TimetableChangeLog` remains the change-native store for slot and version diffs
- `AuditEvent` becomes the platform-wide audit search source and the common event envelope for all critical actions

This means implementation must include:

- dual-write on critical routes
- route-level integration tests that assert both writes
- a reconciliation job that can detect and report divergence

### 4.10 Audit UI must be built from one shared event contract

EduSentrix should not build separate audit UIs with different event shapes.

All audit surfaces should consume one normalized UI DTO contract:

- `id`
- `actionLabel`
- `actionCode`
- `result`
- `occurredAt`
- `actor`
- `target`
- `reason`
- `diffSummary`
- `sensitivity`
- `detailsPayload`

The product may render this DTO differently per surface, but the payload contract should remain shared.

This prevents:

- platform audit and school timelines drifting apart
- repeated frontend formatting logic
- inconsistent redaction behavior

### 4.11 Tier 0 routes must be operationally safe

Tier 0 integrity is non-negotiable, but production safety matters too.

Therefore:

- every Tier 0 route must have an idempotency story
- every Tier 0 route must have a documented failure mode when audit persistence fails
- every Tier 0 route must support safe retry without duplicate financial or academic side effects

The platform should prefer:

- explicit idempotency keys for externally-triggered writes
- deterministic replay guards for internal writes
- correlation IDs for operator tracing

---

## 5. Risk Tiers and Audit Guarantees

### 5.1 Tier 0: transactional and mandatory

Definition:

- the business action must not commit if the audit write fails

Implementation rule:

- write audit inside the same database session / transaction as the business change where the main flow already uses transactions
- or perform the audit write first-class in the same critical code path and fail the action if audit persistence fails

Examples:

- payment approval, rejection, reversal
- fee write-off
- payout detail changes
- billing owner reassignment acceptance
- grade publish and grade change after publish
- promotion finalize / rollback / override
- platform application approval / rejection
- subscription cancellation / suspension / reactivation
- secure export generation
- guardian unlink / primary guardian switch

Operational contract:

- if audit persistence fails before transaction commit, the route fails
- if the route is externally retryable, the business action must be protected by idempotency
- if the route cannot be safely retried, the operator-visible error must instruct retry only after verification
- every Tier 0 route must emit enough correlation data for support to trace the failure

### 5.2 Tier 1: durable and retryable

Definition:

- the business action may complete, but the audit must be guaranteed through durable retry

Implementation rule:

- write to an audit outbox or queued audit job
- retries continue until success or explicit dead-letter state
- dead letters raise operator alerts

Examples:

- manual email sends
- bulk notifications
- reminder dispatches
- announcement publication
- attendance notifications
- low-risk document uploads
- parent message sends

### 5.3 Tier 2: best-effort operational feed

Definition:

- useful for dashboards and recent activity, but not relied on for formal accountability

Examples:

- “teacher created a note”
- “report PDF viewed”
- “campaign shared”
- “recent classroom activity”

### 5.4 Upgrade rule

If a product team is unsure whether an action is Tier 1 or Tier 2, default to Tier 1.

If the action touches:

- money
- identity / permissions
- student official records
- approvals / overrides
- exports / disclosure

default to Tier 0.

### 5.5 Tier 0 failure handling contract

This section closes the gap between correct design and on-call reality.

When Tier 0 audit persistence fails:

- the platform must prefer **fail closed**
- the route must return a clear error class, not a generic 500 if a domain-specific message can be returned safely
- the route must include or log a `requestId` / `correlationId`
- the route must not leave a partially committed state

Required implementation behavior:

- transactional routes:
  - abort the session
  - return failure
- non-transactional critical routes:
  - either revert the domain write
  - or refuse to adopt Tier 0 for that route until it can be made transactional or compensatable

Required product behavior:

- money must not double-record on retry
- grade publish must not partially publish on retry
- payout updates must not partially apply on retry

Required operator behavior:

- Tier 0 audit failure is page-worthy if it affects live financial, identity, or record-integrity workflows
- logs and alerts must include:
  - route
  - actor
  - school
  - action code
  - correlation id
  - business entity id when known

### 5.6 Tier 1 failure handling contract

When Tier 1 persistence fails synchronously:

- the route may still succeed
- the event must enter a durable retry path
- retries must use bounded exponential backoff
- dead-letter must occur only after a defined attempt threshold

Tier 1 dead letters must:

- create an operator alert
- remain queryable in the audit UI later
- support manual replay

---

## 6. Unexcusable Actions by Role

These actions must never occur without durable audit. This is the minimum acceptable standard.

### 6.1 Platform admin

Must be audited as Tier 0:

- school application approve / reject / review note / pipeline reassignment
- school creation or linking to application
- subscription suspend / reactivate / cancel / override / discount / tier change
- transaction fee policy changes
- platform payout destination changes
- platform payment setup review decisions
- feature flag changes
- platform admin invitation and role changes
- data exports across schools
- manual webhook replay or operational override
- suppression unblock and high-risk email routing changes

Must be audited as Tier 1:

- manual support emails
- bulk platform notices
- school reminder sends

### 6.2 School admin

Must be audited as Tier 0:

- student create / update / deactivate / withdraw / transfer / promote override
- teacher create / update / activate / deactivate / subject assignment / homeroom assignment
- guardian create / update / unlink / primary guardian change
- class, subject, academic period, and curriculum configuration changes
- timetable publish, archive, backfill, and any schedule conflict override
- invoice issue, cancel, waive, write-off, and reminder override
- report issue / re-issue / publish / revoke
- school identity and sensitive settings changes
- invitation revoke for staff, teachers, parents, billing owner, bursar
- lesson note approval / revisions requested / publish override

Must be audited as Tier 1:

- fee reminder sends
- community poll publish / close
- fundraising publish / close / share
- school announcements

### 6.3 Billing owner

Must be audited as Tier 0:

- bank account number change
- bank name, branch, account name, sort code, and payout method changes
- payment setup submission / resubmission
- provisioning retry / cancel / review action
- billing owner acceptance
- billing owner handoff
- delegate assignment and removal
- any reveal of masked payout details

### 6.4 Bursar

Must be audited as Tier 0:

- payment record
- payment approval / rejection / reversal
- duplicate warning override
- reconciliation match / unmatch
- credit balance apply / refund / adjustment
- expense create / submit / approve / reject / cancel / mark paid
- disbursement create / approve / reconcile
- cash closure note
- manual finance transaction create / approve / reconcile

Must be audited as Tier 1:

- billing emails and fee reminder bulk sends

### 6.5 Teacher

Must be audited as Tier 0:

- attendance mark / edit / backdate
- grade entry publish
- grade change after publish
- assignment or quiz publish / close / grading override
- lesson note submit / revise / publish / response to admin comment
- escalation create / resolve
- deletion of teaching resources that were previously shared or published

Must be audited as Tier 1:

- notices to students or parents
- parent message sends
- AI-assisted content acceptance into official lesson notes or notices

### 6.6 Staff

Must be audited as Tier 0 when permissions allow:

- any student record change
- any finance record change
- any document deletion
- any delegated approval

### 6.7 Parent

Must be audited as Tier 0:

- payment checkout initiation, success, failure, duplicate callback handling, dispute trigger
- guardian account claim and ward linkage acceptance
- secure report download
- contact detail change that affects official communication

Must be audited as Tier 1:

- parent message sends
- acknowledgement of school financial or policy notices

### 6.8 Student

Must be audited as Tier 0:

- quiz start / submit / auto-submit
- official assignment submission and resubmission after deadline
- secure result or report download if policy requires proof of disclosure

Must be audited as Tier 1:

- acknowledgement of notices

### 6.9 System, webhook, job, and AI actors

Must be audited as Tier 0:

- Paystack payment receipt and transfer updates
- Clerk invitation acceptance linking
- provisioning job success / failure / manual cancel
- subscription checkout application
- reconciliation runs that alter payment state
- migration or backfill jobs that modify official records

Must be audited as Tier 1:

- reminder jobs
- digest jobs
- AI generation accepted into official persisted records

---

## 7. Target Architecture

### 7.1 New central components

Add:

- `src/models/AuditEvent.ts`
- `src/lib/audit/policy.ts`
- `src/lib/audit/request-context.ts`
- `src/lib/audit/writeAuditEvent.ts`
- `src/lib/audit/writeTransactionalAuditEvent.ts`
- `src/lib/audit/writeRetryableAuditEvent.ts`
- `src/lib/audit/hash-chain.ts`
- `src/lib/audit/deriveActivityFeed.ts`
- `src/lib/audit/registerAuditAlert.ts`

### 7.2 Architectural roles

#### `AuditEvent`

Common envelope for all high-value audit data.

#### `AuditPolicy`

Static registry mapping each action code to:

- tier
- domain
- sensitivity
- redaction policy
- required fields
- whether before/after is mandatory
- whether reason code is mandatory

#### `AuditWriter`

Single write surface for new audit events so routes do not reinvent audit behavior.

#### `ActivityFeedDeriver`

Optional compatibility writer that mirrors selected audit events into old `Activity`.

### 7.3 Compatibility rule

No existing feature should be forced to stop using its current domain audit model in phase 1.

Instead:

- payments can keep `PaymentAuditEvent`
- applications can keep `ApplicationAudit`
- timetable can keep `TimetableChangeLog`
- new code dual-writes `AuditEvent` plus current domain store

### 7.4 Request context propagation

Every audited write path should be able to receive a normalized context object:

- request id
- correlation id
- actor id
- actor role
- school id
- IP
- user agent
- source route
- source client surface

This should come from helper functions rather than repeated route-level ad hoc logic.

### 7.5 Tamper evidence

For Tier 0 and Tier 1:

- each `AuditEvent` should carry `previousHash` and `eventHash`
- hash chains should be per `streamKey`
- recommended `streamKey` shape:
  - `platform`
  - `school:<schoolId>`
  - optionally `school:<schoolId>:finance`

This does not replace database security, but it provides tamper evidence.

### 7.6 Dual-write authority and reconciliation

Dual-write is acceptable only with a clear authority rule.

Required rule:

- domain-specific stores remain authoritative for domain-native detail
- `AuditEvent` is authoritative for normalized cross-domain audit search and governance

Reconciliation requirement:

- add a periodic reconciliation job for high-value domains
- first domains in scope:
  - payments
  - applications
  - timetable
- the job should detect:
  - domain event exists, envelope missing
  - envelope exists, domain event missing
  - mismatched result or action code

Output:

- reconciliation findings should be written to an internal audit reconciliation report
- critical mismatches should raise alerts

### 7.7 Hash-chain concurrency rule

Hash chains require a concurrency rule or they become unreliable.

The implementation rule for v1 is:

- hash chains are serialized per `streamKey`
- a write must resolve the current stream head before computing `previousHash`
- the write must fail and retry if the stream head changed between read and insert

Recommended implementation options:

- optimistic compare-and-swap with stream-head retry
- or a separate `AuditStreamHead` collection with versioned updates

Not acceptable:

- naive read-then-write with no contention handling
- global locking across all tenants

### 7.8 Payload budgeting rule

Audit payloads must not grow without limits.

Required rules:

- `before` and `after` should store normalized diffs or field subsets, not full document dumps, unless the policy explicitly requires a full snapshot
- large blobs, HTML bodies, generated PDFs, tokens, or webhook raw payloads should be linked or summarized, not copied wholesale into `AuditEvent`
- each action policy should define:
  - allowed payload fields
  - maximum payload size
  - whether truncation or hashing is required

---

## 8. Data Model Changes

### 8.1 New `AuditEvent` model

Recommended core shape:

- `_id`
- `scopeType`: `platform | school`
- `scopeId`: `null | schoolId`
- `domain`: `identity | academics | finance | billing | communication | applications | timetable | system | email`
- `tier`: `0 | 1 | 2`
- `actionCode`
- `result`: `attempted | succeeded | failed | skipped | compensated`
- `occurredAt`
- `recordedAt`

Actor fields:

- `actorType`: `user | system | webhook | job | ai_assist | migration`
- `actorId`
- `actorRole`
- `actorEmail`
- `actorName`

Target fields:

- `targetEntityType`
- `targetEntityId`
- `secondaryEntityType`
- `secondaryEntityId`

Approval / workflow fields:

- `reviewedById`
- `reviewedByRole`
- `approvedById`
- `approvedByRole`

Reason fields:

- `reasonCode`
- `reason`

Request fields:

- `requestId`
- `correlationId`
- `idempotencyKey`
- `ipAddress`
- `userAgent`
- `routePath`
- `clientSurface`

Payload fields:

- `before`
- `after`
- `changedFields`
- `metadata`

Integrity fields:

- `streamKey`
- `previousHash`
- `eventHash`

Privacy fields:

- `sensitivity`: `low | moderate | high | guardian_only | financial_secret`
- `redactionMode`: `none | masked | hidden`

Lifecycle fields:

- `retentionClass`
- `archivedAt`

### 8.2 Recommended indexes

- `{ scopeType: 1, scopeId: 1, occurredAt: -1 }`
- `{ targetEntityType: 1, targetEntityId: 1, occurredAt: -1 }`
- `{ actionCode: 1, occurredAt: -1 }`
- `{ actorId: 1, occurredAt: -1 }`
- `{ correlationId: 1 }`
- `{ idempotencyKey: 1 }`
- `{ streamKey: 1, occurredAt: 1 }`
- `{ streamKey: 1, recordedAt: -1 }`
- `{ tier: 1, domain: 1, occurredAt: -1 }`
- `{ result: 1, occurredAt: -1 }`

### 8.3 Keep existing models

Do not remove:

- `Activity`
- `TeacherActivity`
- `ApplicationAudit`
- `PaymentAuditEvent`
- `TimetableChangeLog`
- `EmailMessage`

### 8.4 Optional support models

Recommended later:

- `AuditReadEvent`
- `AuditExportJob`
- `AuditAlert`
- `AuditDeadLetter`

---

## 9. Audit Event Catalog and Action Codes

### 9.1 Naming rules

Action codes should be explicit and stable:

- `school.settings.updated`
- `billing.payout_account.updated`
- `billing.owner.assigned`
- `payment.recorded`
- `payment.reversed`
- `payment.duplicate_override.accepted`
- `attendance.marked`
- `attendance.backdated`
- `grade.published`
- `grade.post_publish_edited`
- `lesson_note.review_requested`
- `lesson_note.comment_resolved`
- `application.approved`
- `subscription.cancelled`
- `email.bulk.sent`
- `report.downloaded.secure`
- `data.unmasked`

### 9.2 Minimum metadata rules

#### Financial actions

Must include:

- currency
- amount minor
- reference ids
- invoice / payment / student ids where relevant

#### Academic actions

Must include:

- period / term context
- class / subject context
- student ids where relevant

#### Identity and permission actions

Must include:

- subject user id
- old role / new role
- school context

#### Export and disclosure actions

Must include:

- export type
- record count
- masking policy applied

### 9.3 Prohibited payload content

The policy registry must explicitly forbid storing the following in `AuditEvent` payloads unless a policy says otherwise in masked or hashed form:

- raw bank account numbers
- raw card or processor secrets
- webhook signatures
- auth tokens or session tokens
- full password-reset or magic links
- raw provider credentials
- unrestricted student disciplinary or medical notes in generic metadata
- full HTML email bodies for events that only need status metadata

When an action needs sensitive comparison:

- store masked values
- or store a structured hash plus last-4 form
- or store a pointer to the authoritative domain record

### 9.4 Before / after rules

Mandatory before/after for:

- payout details
- grade changes after publish
- timetable slot updates
- role / permission changes
- guardian primary switch
- subscription state changes
- settings changes

At minimum, `changedFields` plus normalized old/new values must be stored.

### 9.5 Idempotency rules for critical actions

Tier 0 actions that can be replayed by clients, browsers, providers, or jobs must have an idempotency rule.

Examples:

- payment-related actions must use payment or processor reference keys
- subscription changes must use checkout or subscription intent ids
- payout configuration writes should use request-scoped idempotency keys
- export jobs should use stable request fingerprints where duplicate generation is not desired

The policy registry should be able to declare:

- `requiresIdempotencyKey`
- `idempotencyScope`
- `replayBehavior`

---

## 10. Backend Implementation Plan

### 10.1 Phase 1 foundation

Add the new audit primitives:

- `AuditEvent` model
- policy registry
- request-context builder
- centralized writer helpers

Do not change current route responses.

### 10.2 Policy registry

Create a central mapping file where each action defines:

- domain
- tier
- sensitivity
- required metadata
- requiresReason
- requiresBeforeAfter
- requiresIdempotencyKey
- prohibitedFields
- maxPayloadBytes
- derivesActivityFeed

This prevents random event shapes across the codebase.

### 10.3 Transactional writer

Introduce `writeTransactionalAuditEvent()` that:

- requires a session when the caller already has one
- validates against policy
- computes hashes
- writes the event
- throws on failure
- validates payload-size and prohibited-field rules

Use this only for Tier 0.

### 10.4 Retryable writer

Introduce `writeRetryableAuditEvent()` that:

- writes directly if possible
- falls back to a durable audit job / outbox
- marks dead-letter on repeated failure
- records retry count and next attempt time

Use this for Tier 1.

### 10.5 Compatibility layer for old `Activity`

Keep `recordActivity()` working, but change its role:

- it becomes a Tier 2 compatibility helper
- selected `AuditEvent`s may mirror into `Activity`
- `Activity` is no longer authoritative for sensitive operations

### 10.6 Hardening existing specialized domains first

First integrate `AuditEvent` dual-write into:

- platform applications
- payment flows
- billing owner / payment setup
- timetable

These already have good domain patterns and will give the cleanest rollout.

For these domains, phase 1 of hardening must also add:

- dual-write assertions in tests
- reconciliation queries
- normalized action code mapping between domain event and `AuditEvent`

### 10.7 Then harden people and records

Next integrate:

- student changes
- teacher changes
- guardian changes
- attendance changes
- grade publish and post-publish edits
- report publish and secure downloads

### 10.8 Then harden communication and exports

Integrate:

- bulk email
- secure report downloads
- exports
- unmask actions
- sensitive inbox thread views

### 10.9 Route-level requirement

Every audited write route should follow one of these patterns:

#### Pattern A: transactional domain route

- validate
- start session
- perform domain write
- write Tier 0 audit in same session
- commit

#### Pattern B: non-transactional but critical route

- validate
- perform domain write
- write Tier 0 audit
- if audit fails, revert or fail the route

#### Pattern C: retryable route

- perform domain write
- enqueue or persist Tier 1 audit if immediate write fails

### 10.10 Operational contract for on-call and support

Every Tier 0 and Tier 1 implementation must document:

- what happens if Mongo is up but audit write fails validation
- what happens if Mongo session commit fails
- what happens if the route is retried
- who gets alerted
- how support identifies whether the business action committed

Minimum production contract:

- Tier 0 failure => structured error log + alert for critical domains
- Tier 1 dead letter => structured log + operator queue + replay path
- repeated reconciliation drift => alert
- repeated hash-chain conflicts above threshold => alert

### 10.11 Request context capture

Add a shared helper to collect:

- `x-forwarded-for`
- request user agent
- route path
- authenticated actor
- school id
- optional client feature tag from headers

When no authenticated user exists, the helper must still resolve:

- actor type
- route
- tenant scope
- correlation id

### 10.12 Alert rules

Add anomaly hooks for:

- payout account changes
- repeated duplicate overrides
- repeated grade edits after publish
- attendance backdating
- export spikes
- repeated unmask access
- dead-lettered Tier 0 or Tier 1 audit writes

Also add alerts for:

- reconciliation drift between domain store and `AuditEvent`
- repeated Tier 0 idempotency conflicts
- repeated hash-chain head conflicts for one stream

### 10.13 Test strategy

Audit hardening is not complete without dedicated test coverage.

Required test layers:

#### Unit tests

- policy validation
- prohibited-field enforcement
- payload-size enforcement
- hash computation
- redaction helpers

#### Integration tests

- Tier 0 routes commit both domain write and audit write
- Tier 0 routes roll back when audit write fails
- Tier 1 routes succeed and enqueue retry when direct audit persistence fails
- dual-write routes produce both domain-specific and normalized audit records
- unmask actions create audit events
- secure downloads create audit events

#### Replay and idempotency tests

- duplicate client retries do not create duplicate business actions
- provider webhook replays do not create duplicate financial events
- repeated request with same idempotency key yields safe replay behavior

#### Concurrency tests

- simultaneous writes on same `streamKey` do not corrupt the hash chain
- stream-head retry logic resolves contention correctly

#### Reconciliation tests

- missing envelope event is detected
- missing domain event is detected
- mismatched action/result is detected

---

## 11. Frontend Implementation Plan

### 11.1 Platform audit page

Implement the missing `/platform/audit` page already implied by navigation.

Capabilities:

- filter by school, domain, role, action, outcome, date
- inspect event details
- inspect before/after diffs
- export filtered audit data
- view dead-letter and alert states later

### 11.2 School admin audit surfaces

Do not add a giant generic audit page first.

Add timeline panels where users already work:

- student detail
- teacher detail
- invoice/payment detail
- payment setup
- lesson note review
- timetable version detail
- reports

### 11.3 Viewer rules

- school admins see their school only
- billing owner and bursar see finance-relevant trails only
- teachers do not see school-wide audit
- parents and students see only their own sensitive action history where relevant

### 11.4 Presentation rules

Each audit event should show:

- action label
- actor
- time
- result
- reason
- target entity
- structured diff or metadata summary

### 11.5 Redaction rules in UI

Financial and guardian-sensitive fields should be masked by default.

Unmask flow must:

- require privilege
- require explicit action
- create an audit event itself

### 11.6 Shared UI contract

All audit UIs should be built from the same primitives:

- `AuditTable`
- `AuditFiltersBar`
- `AuditEventDrawer`
- `AuditDiffPanel`
- `AuditActorBadge`
- `AuditSensitivityBadge`
- `AuditReasonBlock`

The first implementation should not create separate bespoke components for:

- platform audit
- payment detail timeline
- application audit drawer
- school-level entity timelines

Instead:

- reuse the same event drawer and diff renderer
- allow only the surrounding page shell and default filters to differ

### 11.7 API contract for frontend readers

The normalized audit read API should support:

- filtering by:
  - scope
  - domain
  - action code
  - actor role
  - result
  - date range
  - entity
- pagination
- redacted and expanded detail variants
- timeline mode and global search mode

This should be defined before multiple audit pages are implemented.

---

## 12. Security, Privacy, and Retention Rules

### 12.1 Retention classes

Recommended minimums:

- `financial_critical`: 7 years
- `academic_record`: 7 years
- `identity_and_permissions`: 5 years
- `operational`: 2 years
- `feed_noise`: 90 days

### 12.2 Data minimization

Do not store raw secrets in audit payloads.

Examples:

- bank account numbers must be masked
- tokens and webhook signatures must never be stored raw
- only approved disclosure metadata should be recorded for secure document downloads

### 12.3 PII minimization at policy level

The privacy section alone is not enough.

Each action policy must declare:

- allowed actor fields
- allowed target fields
- allowed metadata keys
- whether `before` / `after` may contain PII
- masking rule for each sensitive field

If a policy does not explicitly allow a field, the writer should reject or drop it.

### 12.4 Guardian-only sensitivity

Where records involve student-specific disclosures:

- access or export actions must record whether the recipient or viewer was an authorized guardian

### 12.5 Deletion policy

- Tier 0 and Tier 1 audit events cannot be user-deleted
- if legal deletion is ever required, store a redacted tombstone event rather than removing chronology silently

### 12.6 Tamper evidence scope

Hash chaining is required for Tier 0 and recommended for Tier 1.

Tier 2 does not need tamper evidence.

### 12.7 Storage and retention budget discipline

Audit growth must be governed.

Required rules:

- each policy has a maximum payload budget
- Tier 2 feed events may be aggressively retained or summarized
- full diff retention should be restricted to the actions that justify it
- archived audit data should remain queryable by export or cold-read paths later, not necessarily in the hot primary UI

---

## 13. Migration and Backfill Strategy

### 13.1 No breaking rewrite

Do not replace current audit code paths in one shot.

### 13.2 Backfill goals

Backfill only what is trustworthy enough to reconstruct:

- applications
- payment audit events
- timetable change logs
- email message history

Mark all backfilled records with:

- `actorType: migration`
- `result: succeeded`
- `metadata.backfilled = true`

### 13.3 What not to fake

Do not invent:

- IP addresses
- user agents
- precise reasons
- precise before/after states that never existed

### 13.4 Cutover sequence

1. Add `AuditEvent`.
2. Dual-write from strong existing stores.
3. Add readers and timelines.
4. Tighten deletion and immutability rules.
5. Migrate selected old activity feed views to read from normalized audit sources.

---

## 14. Phased Delivery Plan

### Phase 1: foundation

- add `AuditEvent`
- add policy registry
- add centralized writers
- add request context helper
- add explicit Tier 0 operational contract and idempotency guidance

### Phase 2: financial and platform hardening

- payments
- billing owner / payment setup
- subscription changes
- platform applications
- dual-write reconciliation for those domains

### Phase 3: timetable and governance

- timetable dual-write
- secure platform audit page
- remove delete capability for authoritative audit records

### Phase 4: people and academic records

- student, teacher, guardian changes
- attendance edits
- grade publish and post-publish edits
- report issue and secure download

### Phase 5: lesson notes and teacher workflows

- lesson note review and revision chain
- escalations
- notices and official classroom publication

### Phase 6: communication, exports, and disclosure

- bulk email
- exports
- inbox access events
- unmask events

### Phase 7: alerts and tamper evidence

- hash chain verification jobs
- anomaly alerts
- dead-letter audit handling
- drift reconciliation reporting

---

## 15. Acceptance Criteria

The system is considered acceptably hardened when:

- every action listed in Section 6 has an explicit audit tier and action code
- Tier 0 routes fail or roll back if audit cannot be written
- Tier 1 routes have durable retry and dead-letter behavior
- Tier 0 routes have explicit idempotency and safe replay behavior
- `Activity` is no longer the primary audit source for sensitive operations
- `/platform/audit` exists and can filter normalized events
- student, teacher, payment, and application detail pages can show authoritative timelines
- audit UI surfaces use a shared event drawer and diff contract
- audit delete is not available for authoritative records
- payout detail unmasking creates its own audit event
- secure report download is auditable
- backfilled audit data is clearly marked as migrated, not original
- dual-write reconciliation exists for the first hardened domains
- hash-chain contention handling is implemented for `streamKey` writes
- prohibited-field and payload-budget rules are enforced by policy

---

## 16. AI Execution Checklist

1. Add `src/models/AuditEvent.ts` with indexed normalized fields and hash-chain support.
2. Add `src/lib/audit/policy.ts` with explicit action-code definitions and tiers.
3. Add `src/lib/audit/request-context.ts` to normalize actor, request, and tenant context.
4. Add `src/lib/audit/writeTransactionalAuditEvent.ts`.
5. Add `src/lib/audit/writeRetryableAuditEvent.ts`.
6. Add a compatibility helper that can mirror selected normalized events into `Activity`.
7. Add policy-level prohibited-field, payload-budget, and idempotency validation.
8. Add reconciliation support for normalized-vs-domain audit parity in first hardened domains.
9. Wire dual-write into:
   - platform applications
   - payment flows
   - payment setup / billing owner flows
   - timetable
10. Remove or constrain authoritative audit deletion paths. The existing delete path for generic `Activity` should no longer apply to Tier 0 or Tier 1 authoritative records.
11. Implement `/platform/audit` with filters and a shared event detail drawer.
12. Add entity-level timelines for:
   - student
   - teacher
   - payment
   - application
   - timetable version
13. Add audit for secure downloads, exports, and unmask events.
14. Add dead-letter handling and alert hooks for failed Tier 1 persistence.
15. Add concurrency-safe stream-head handling for hash chains.
16. Add route-level integration tests for Tier 0 rollback, Tier 1 retry, dual-write, and idempotent replay.
17. Add backfill scripts only for trustworthy existing sources.
18. Keep route responses and domain behavior stable throughout rollout.

---

## Appendix A: Existing Files This Spec Intentionally Builds On

- `src/models/Activity.ts`
- `src/lib/audit/recordActivity.ts`
- `src/models/TeacherActivity.ts`
- `src/lib/teachers/logTeacherActivity.ts`
- `src/models/ApplicationAudit.ts`
- `src/lib/audit/recordApplicationAudit.ts`
- `src/models/PaymentAuditEvent.ts`
- `src/models/TimetableChangeLog.ts`
- `src/lib/timetable/audit.ts`
- `src/models/EmailMessage.ts`
- `src/lib/email/brevo.ts`

## Appendix B: Existing Files This Spec Intentionally Challenges

- `src/app/api/admin/activity/[id]/route.ts`
  - authoritative audit data should not be deletable by school admins
- `src/app/api/admin/activity/route.ts`
  - should not remain the primary school audit source for critical operations
- `src/app/api/admin/activities/route.ts`
  - should eventually be reconciled with the normalized audit architecture
- `src/components/platform/PlatformSidebar.tsx`
  - already advertises `/platform/audit`, so the missing page should be implemented rather than ignored
