# Platform Admin Missing Pages Spec

> **Version**: 1.0  
> **Date**: April 15, 2026  
> **Status**: Ready for implementation planning  
> **Audience**: Product, design, and engineering  
> **Intent**: Define the missing platform-admin surfaces currently advertised in navigation but not implemented, and specify what each page should contain, how it should function, what backend support it needs, and how to phase delivery safely.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Current State In Repo](#2-current-state-in-repo)
3. [Goals and Non-Goals](#3-goals-and-non-goals)
4. [Missing Pages Inventory](#4-missing-pages-inventory)
5. [Information Architecture Decisions](#5-information-architecture-decisions)
6. [Page Specifications](#6-page-specifications)
7. [Backend Requirements](#7-backend-requirements)
8. [Frontend Implementation Plan](#8-frontend-implementation-plan)
9. [Navigation and UX Rules](#9-navigation-and-ux-rules)
10. [Phased Delivery Plan](#10-phased-delivery-plan)
11. [Acceptance Criteria](#11-acceptance-criteria)
12. [Developer Checklist](#12-developer-checklist)

---

## 1. Overview

The platform admin shell currently advertises routes in the sidebar that do not exist in the app tree.

This is not just a polish problem. It creates three real issues:

1. navigation trust is broken for the highest-privilege operator account
2. platform operations are split across hidden existing pages and missing future pages
3. developers do not yet have a single product decision document for what these missing surfaces are supposed to be

This spec defines the missing platform-admin pages, how they should work, and how they should relate to the existing platform surfaces such as:

- `/platform`
- `/platform/applications`
- `/platform/schools`
- `/platform/billing`
- `/platform/pilot`
- `/platform/email`
- `/platform/audit`

The goal is not to create six shallow placeholder pages. The goal is to make the platform account into a reliable operating console.

---

## 2. Current State In Repo

### 2.1 Sidebar routes currently advertised

The platform sidebar currently includes:

- `/platform`
- `/platform/applications`
- `/platform/schools`
- `/platform/users`
- `/platform/billing`
- `/platform/pilot`
- `/platform/reconciliation`
- `/platform/webhooks`
- `/platform/email`
- `/platform/emails`
- `/platform/flags`
- `/platform/audit`
- `/platform/settings`

Source:

- `src/components/platform/PlatformSidebar.tsx`

### 2.2 Platform routes that actually exist

The app tree currently contains:

- `/platform`
- `/platform/applications`
- `/platform/audit`
- `/platform/billing`
- `/platform/billing/costs`
- `/platform/billing/events`
- `/platform/billing/revenue`
- `/platform/billing/sync`
- `/platform/billing/tiers`
- `/platform/billing/usage`
- `/platform/demo-leads`
- `/platform/email`
- `/platform/pilot`
- `/platform/schools`
- `/platform/schools/[id]`

### 2.3 Missing pages confirmed from navigation

These sidebar pages do not currently exist:

1. `/platform/users`
2. `/platform/reconciliation`
3. `/platform/webhooks`
4. `/platform/emails`
5. `/platform/flags`
6. `/platform/settings`

### 2.4 Existing backend and model support already available

Some missing pages already have nearby backend support:

- `GET /api/platform/users/platform-admins`
  - minimal platform-admin list only
- `GET /api/platform/email/inbox`
- `POST /api/platform/email/compose`
- `GET|POST|DELETE /api/platform/email/suppressions`
- `GET /api/platform/tiers/feature-keys`
- `GET /api/platform/audit`
- platform billing APIs already expose operational cost, usage, sync, tiers, subscriptions, and payouts

Relevant models and domains already present:

- `User`
- `UserMembership`
- `EmailThread`
- `EmailMessage`
- `EmailSuppression`
- `ProviderSyncRun`
- `ReconciliationRun`
- `ReconciliationAlert`
- `ReconciliationIngestion`
- `AuditEvent`
- `SchoolSettings`
- `SubscriptionTier`

### 2.5 Existing product warning already documented

The UAT guide already flags this problem:

- platform sidebar items may exist without matching implementations
- navigation integrity should be treated as a real test item

Source:

- `docs/REAL_WORLD_UAT_GUIDE.md`

---

## 3. Goals and Non-Goals

### 3.1 Goals

- Define the missing platform-admin pages clearly enough for engineering execution.
- Preserve consistency with the existing platform visual language and page patterns.
- Reuse current APIs and models where possible before inventing new ones.
- Separate operational consoles from configuration consoles.
- Avoid duplicate surfaces that conflict with already-existing Billing and Email pages.
- Make navigation trustworthy again.

### 3.2 Non-Goals

- This spec does not implement the pages itself.
- This spec does not redesign the entire platform admin IA from scratch.
- This spec does not move every existing platform page in v1.
- This spec does not require editable DB-backed template or feature-flag systems on day one.
- This spec does not introduce high-risk actions like replaying webhooks or impersonating users unless explicitly called out for a later phase.

---

## 4. Missing Pages Inventory

| Route | Status Today | Proposed Purpose | Implementation Priority |
| --- | --- | --- | --- |
| `/platform/users` | Missing | Platform-wide user directory and access operations | P1 |
| `/platform/reconciliation` | Missing | Cross-school reconciliation exceptions dashboard | P1 |
| `/platform/webhooks` | Missing | Inbound integration health and webhook event operations | P1 |
| `/platform/emails` | Missing | Email template registry and preview surface | P2 |
| `/platform/flags` | Missing | Release-flag and entitlement diagnostics console | P2 |
| `/platform/settings` | Missing | Platform-level non-financial settings and configuration status | P3 |

---

## 5. Information Architecture Decisions

### 5.1 Route decisions

The current sidebar uses the six missing routes above. To minimize disruption, v1 implementation should honor those paths.

However, two of them are structurally awkward:

1. `/platform/reconciliation`
   - conceptually belongs under Billing
2. `/platform/emails`
   - conceptually belongs under the existing `/platform/email` domain

### 5.2 Recommended v1 rule

Implement the current routes first so the sidebar stops breaking.

### 5.3 Recommended v2 cleanup

After the pages exist and usage stabilizes:

- move `/platform/reconciliation` to `/platform/billing/reconciliation`
- move `/platform/emails` to `/platform/email/templates`
- keep redirects from old routes so links do not break

### 5.4 Hidden existing pages that should eventually be surfaced

The platform IA also already has real pages not present in the sidebar:

- `/platform/demo-leads`
- `/platform/billing/costs`
- `/platform/billing/events`
- `/platform/billing/revenue`
- `/platform/billing/sync`
- `/platform/billing/tiers`
- `/platform/billing/usage`

This spec does not require nav restructuring immediately, but any platform-nav cleanup should consider them.

---

## 6. Page Specifications

## 6.1 `/platform/users`

### Purpose

A platform-wide user operations directory for:

- locating users quickly
- inspecting access state
- reviewing school memberships
- resolving onboarding and role-assignment issues

This is not a school-specific member list. It is a platform operator surface.

### Primary users

- platform admins

### Data sources

- `User`
- `UserMembership`
- invitation-related and school-link context where available

### Core page sections

1. Header
   - title: `Users`
   - subtitle describing cross-school user access oversight
   - actions:
     - refresh
     - export CSV later, not required in v1

2. KPI row
   - total users
   - users pending onboarding
   - invited memberships
   - suspended memberships

3. Filters bar
   - query: name, email, phone
   - role filter
   - membership status filter
   - school filter
   - orphaned users only toggle
     - user exists but no active membership
   - platform admins only toggle

4. Results table
   - name
   - email
   - base role
   - school count
   - membership roles summary
   - pending onboarding state
   - last updated
   - actions: view details

5. User detail drawer
   - identity summary
   - Clerk linkage if present
   - school memberships
   - membership statuses
   - linked schools with deep links
   - invitations or onboarding indicators
   - audit/history link

### V1 interactions

- search and filter users
- inspect user detail
- jump to school detail page
- jump to audit page filtered by actor email or user id where possible

### V1 non-goals

- impersonation
- direct destructive account deletion
- direct multi-role editing from this page unless fully audited

### Suggested API work

New API needed:

- `GET /api/platform/users`
  - supports query, role, status, schoolId, page, limit
- `GET /api/platform/users/[id]`
  - returns user + memberships + linked schools + onboarding summary

Optional later:

- `PATCH /api/platform/users/[id]/membership`
- `POST /api/platform/users/[id]/resend-invite`

### Acceptance intent

The page must let a platform admin answer:

- who is this user
- what school(s) do they belong to
- what access do they actually have
- are they invited, active, or suspended

---

## 6.2 `/platform/reconciliation`

### Purpose

A cross-school reconciliation exception console.

This page should help platform admins identify which schools have finance risk that requires intervention. It is not meant to replace school-level reconciliation workflows.

### Primary users

- platform admins

### Data sources

- `ReconciliationAlert`
- `ReconciliationRun`
- `ReconciliationIngestion`
- school summary and payment-readiness metadata

### Core page sections

1. Header
   - title: `Reconciliation`
   - subtitle: cross-school exception monitoring
   - actions:
     - refresh
     - open billing sync page

2. KPI row
   - schools with active critical alerts
   - total active alerts
   - failed runs in last 7 days
   - stale unmatched items

3. Filters
   - severity
   - alert status
   - school
   - source type
   - staleness bucket

4. School risk table
   - school name
   - payment setup status
   - critical alerts count
   - active alerts count
   - latest run status
   - latest run time
   - unresolved ingestion count
   - actions:
     - open school detail
     - open school finance reconciliation page

5. Active alerts panel
   - alert title
   - school
   - severity
   - queue
   - first detected
   - last detected
   - deep links

6. Recent run failures panel
   - school
   - run mode
   - error message
   - summary snapshot

### V1 interactions

- filter and rank school-level reconciliation risk
- open affected school context
- inspect latest alert or run detail

### V1 non-goals

- matching or unmatching payments directly from the platform page
- editing school finance data directly from this page

### Suggested API work

New API needed:

- `GET /api/platform/reconciliation/summary`
  - global counts and risk KPIs
- `GET /api/platform/reconciliation/schools`
  - per-school rollup
- `GET /api/platform/reconciliation/alerts`
  - platform-wide alerts list
- `GET /api/platform/reconciliation/runs`
  - recent reconciliation runs across schools

### Acceptance intent

The page must let a platform admin answer:

- which schools are currently financially risky because reconciliation is unhealthy
- what kind of failure is happening
- where to go next to resolve it

---

## 6.3 `/platform/webhooks`

### Purpose

A read-first integration health console for inbound provider events.

This page should unify webhook visibility across:

- Clerk
- Paystack
- Brevo

and possibly future providers later.

### Primary users

- platform admins

### Data sources

- current webhook handlers
- audit events where actor type is `webhook`
- email events
- payment intent or provider-sync traces
- any new webhook event store introduced for this page

### Current gap

The repo has webhook handlers, but no dedicated, normalized webhook operations surface.

### Core page sections

1. Header
   - title: `Webhooks`
   - subtitle: inbound integration health and failure visibility
   - actions:
     - refresh

2. Provider status cards
   - Clerk
   - Paystack
   - Brevo
   - each card shows:
     - last event received time
     - recent success/failure count
     - signature verification status health
     - retry risk indicator if derivable

3. Recent events table
   - provider
   - event type
   - received at
   - processing result
   - related entity
   - error summary
   - action: inspect

4. Event detail drawer
   - provider
   - event type
   - received timestamp
   - processing status
   - related school/payment/email/thread if known
   - raw payload excerpt
   - normalized interpretation
   - linked audit or domain record

5. Failure panel
   - events that failed verification
   - events that failed processing
   - events missing linked entity resolution

### V1 interactions

- inspect recent webhook traffic
- filter by provider and status
- see what broke and where
- deep-link to affected domain surface

### V1 non-goals

- replay from UI
- manual redelivery
- editing provider secrets from this page

### Suggested API work

Preferred v1 design:

- introduce `WebhookEvent` model or equivalent normalized read model
- write one record per received webhook with processing outcome

New APIs:

- `GET /api/platform/webhooks`
- `GET /api/platform/webhooks/[id]`
- optional `GET /api/platform/webhooks/summary`

Fallback if no new model is introduced immediately:

- assemble partial visibility from `AuditEvent`, `EmailEvent`, and payment records
- but this is weaker and should be treated as transitional only

### Acceptance intent

The page must let a platform admin answer:

- are inbound integrations healthy
- what provider is failing
- what entity was affected
- whether the event was rejected, accepted, or partially processed

---

## 6.4 `/platform/emails`

### Purpose

An email template registry and preview surface.

This page should complement the existing `/platform/email` inbox and compose page rather than duplicating it.

### Primary users

- platform admins
- product and support operators who need to understand outbound messaging

### Data sources

- `src/lib/email/templates.ts`
- `src/lib/email/registry.ts`
- optional fixture builders or example payloads

### Core page sections

1. Header
   - title: `Email Templates`
   - subtitle: template registry, preview, and safe test-send tools

2. Template list
   - template key
   - subject pattern
   - traffic class
   - brand scope
   - delivery sensitivity
   - usage notes

3. Template detail panel
   - template key
   - expected payload fields
   - rendered subject
   - rendered HTML preview
   - rendered text preview
   - linked workflows where used

4. Preview controls
   - choose fixture payload
   - toggle plain text / HTML
   - optional dark or light preview wrapper if relevant

5. Test-send card
   - recipient email
   - template selection
   - fixture selection
   - send test message to self only in v1

### V1 interactions

- browse templates
- preview a rendered result
- send a test email to a controlled address

### V1 non-goals

- live template editing
- database-backed template authoring
- visual drag-and-drop editor

### Suggested API work

New APIs:

- `GET /api/platform/email/templates`
  - returns normalized registry metadata
- `POST /api/platform/email/templates/preview`
  - returns rendered subject/html/text for a fixture payload
- `POST /api/platform/email/templates/test-send`
  - test send to approved recipient

Implementation note:

Templates are code-rendered today. V1 should keep them code-owned and expose a registry/preview layer only.

### Acceptance intent

The page must let a platform admin answer:

- what templates exist
- what they look like
- what payload they expect
- whether a safe test-send works

---

## 6.5 `/platform/flags`

### Purpose

A release diagnostics page that explains which features are enabled, where their value comes from, and what surfaces they affect.

This page must clearly separate:

1. environment or hardcoded release flags
2. school-level settings
3. subscription-tier feature entitlements

### Primary users

- platform admins
- developers during rollout verification

### Data sources

- timetable feature flag helpers
- teacher-studio feature helpers
- subscription tier feature keys
- school settings where relevant

### Core page sections

1. Header
   - title: `Feature Flags`
   - subtitle: release diagnostics and entitlement visibility

2. Summary cards
   - environment-backed flags count
   - school-scoped toggles count
   - tier-backed feature keys count
   - inconsistent or unknown flag sources count

3. Flag registry table
   - flag key
   - category
   - source of truth
   - effective value
   - scope
   - impacted surfaces
   - notes

4. School impact panel
   - filter by school
   - show effective settings for selected school where relevant

5. Tier entitlement panel
   - list feature keys from subscription tiers
   - show which tiers expose them

### V1 interactions

- inspect flags and sources
- compare schools or tiers
- understand whether a feature is off because of env, entitlement, or settings

### V1 non-goals

- editing env-backed flags from the UI
- ad hoc string flags stored in a weak key-value table

### Suggested API work

New APIs:

- `GET /api/platform/flags`
  - normalized list of known flags and effective values
- `GET /api/platform/flags/schools/[id]`
  - optional school-specific effective view

Can reuse:

- `GET /api/platform/tiers/feature-keys`

Implementation note:

V1 should be read-only unless a real persistent platform-flag model is introduced. Do not present writable toggles if the value is actually environment-owned.

### Acceptance intent

The page must let a platform admin answer:

- what is enabled
- why it is enabled
- what scope it applies to
- what product surfaces depend on it

---

## 6.6 `/platform/settings`

### Purpose

A platform-level, non-financial settings and configuration-status page.

This page must not duplicate the payout and billing controls already living in `/platform/billing`.

### Primary users

- platform admins

### Data sources

- a new `PlatformSettings` model in later phases
- environment-derived health summaries in v1
- platform-admin roster
- integration configuration status summaries

### Core page sections

1. Header
   - title: `Settings`
   - subtitle: platform configuration and operational readiness

2. Platform identity card
   - platform name
   - support email
   - public app URLs
   - demo URL

3. Platform admins card
   - list platform admins using existing platform-admin list API
   - add/edit not required in v1 unless there is a safe audited path

4. Integration status card
   - Clerk configured
   - Paystack configured
   - Brevo configured
   - OpenAI configured
   - UploadThing configured
   - each shown as configured/unconfigured

5. Operations readiness card
   - health endpoint available
   - backup strategy documented
   - monitoring configured
   - webhook secret presence
   - cron secret presence

6. Platform defaults section
   - reserved for future persistent non-secret platform settings

### V1 interactions

- inspect configuration readiness
- review platform-admin roster
- identify missing operational setup

### V1 non-goals

- editing secrets
- editing environment variables
- storing sensitive credentials in the database

### Suggested API work

New APIs:

- `GET /api/platform/settings`
  - returns safe configuration status only
- optional `PATCH /api/platform/settings`
  - only if a real non-secret `PlatformSettings` model is introduced

Can reuse:

- `GET /api/platform/users/platform-admins`

### Acceptance intent

The page must let a platform admin answer:

- is the platform configured correctly for live operations
- who currently administers it
- what important operational gaps remain

---

## 7. Backend Requirements

## 7.1 New APIs required for a complete implementation

| Page | API | Purpose |
| --- | --- | --- |
| Users | `GET /api/platform/users` | paginated searchable directory |
| Users | `GET /api/platform/users/[id]` | detail view |
| Reconciliation | `GET /api/platform/reconciliation/summary` | KPI rollup |
| Reconciliation | `GET /api/platform/reconciliation/schools` | school-level rollup |
| Reconciliation | `GET /api/platform/reconciliation/alerts` | platform-wide alerts |
| Reconciliation | `GET /api/platform/reconciliation/runs` | recent run history |
| Webhooks | `GET /api/platform/webhooks` | recent webhook events |
| Webhooks | `GET /api/platform/webhooks/[id]` | detail |
| Emails | `GET /api/platform/email/templates` | normalized template registry |
| Emails | `POST /api/platform/email/templates/preview` | preview renderer |
| Emails | `POST /api/platform/email/templates/test-send` | safe test send |
| Flags | `GET /api/platform/flags` | normalized flag registry |
| Settings | `GET /api/platform/settings` | safe config status |

## 7.2 New models likely needed

Required:

- `WebhookEvent`
  - if webhook operations are to be truly observable

Optional later:

- `PlatformSettings`
  - for non-secret persistent settings only

Not required for v1:

- template-edit model
- generic mutable feature-flag store

---

## 8. Frontend Implementation Plan

### 8.1 Shared patterns

All new pages should follow the existing platform surface conventions:

- large page title + short explanatory subtitle
- command-center style KPI cards
- client-side filtering where data volume is reasonable
- detail drawer instead of route explosion where appropriate
- `force-dynamic` only where needed
- use existing `Card`, `Button`, `Badge`, `Input`, `Textarea`, `Select`

### 8.2 Suggested file structure

- `src/app/(app)/platform/users/page.tsx`
- `src/app/(app)/platform/reconciliation/page.tsx`
- `src/app/(app)/platform/webhooks/page.tsx`
- `src/app/(app)/platform/emails/page.tsx`
- `src/app/(app)/platform/flags/page.tsx`
- `src/app/(app)/platform/settings/page.tsx`

Suggested component folders:

- `src/components/platform/users/*`
- `src/components/platform/reconciliation/*`
- `src/components/platform/webhooks/*`
- `src/components/platform/emails/*`
- `src/components/platform/flags/*`
- `src/components/platform/settings/*`

### 8.3 Loading and error rules

- every page must have explicit loading state
- every page must have empty-state UX
- every page must degrade gracefully if one section fails
- do not let one broken widget blank the whole page

---

## 9. Navigation and UX Rules

1. No sidebar link may point to a non-existent page after rollout.
2. Every new page must have at least one strong primary use case.
3. Do not create duplicate operational surfaces if a domain already has one.
4. Deep links should connect:
   - Users -> School detail / Audit
   - Reconciliation -> School detail / school finance reconciliation
   - Webhooks -> payment, audit, or email records
   - Emails -> inbox or compose where relevant
   - Flags -> tiers or schools where relevant
   - Settings -> billing for payout-specific actions
5. Where a page is read-only in v1, the UI should say so clearly instead of implying edit support.

---

## 10. Phased Delivery Plan

## Phase 1: Navigation Integrity and High-Value Operations

Implement:

1. `/platform/users`
2. `/platform/reconciliation`
3. `/platform/webhooks`

Why:

- these solve the biggest operator blind spots
- they directly support live pilot operations

## Phase 2: Communication and Release Diagnostics

Implement:

1. `/platform/emails`
2. `/platform/flags`

Why:

- these improve operator clarity and rollout confidence
- they are less urgent than user/integration/finance operations

## Phase 3: Configuration Maturity

Implement:

1. `/platform/settings`

Why:

- this page is most valuable once the platform has a clearer non-secret settings model

---

## 11. Acceptance Criteria

### 11.1 Navigation

- all sidebar routes resolve
- no platform sidebar item lands on 404

### 11.2 Users

- platform admin can search for a user by email
- platform admin can inspect user memberships and statuses
- page loads quickly for typical operator use

### 11.3 Reconciliation

- platform admin can identify top-risk schools from one screen
- platform admin can filter alerts and jump into school context

### 11.4 Webhooks

- platform admin can inspect recent provider webhook activity
- failed or rejected events are visible
- linked domain entities are inspectable where available

### 11.5 Emails

- platform admin can list templates and preview a rendered result
- test send works for approved recipients

### 11.6 Flags

- platform admin can see which features are enabled and why
- env-backed flags are clearly marked as read-only

### 11.7 Settings

- platform admin can inspect safe platform configuration health
- sensitive secrets are not exposed

---

## 12. Developer Checklist

1. Add the missing routes under `src/app/(app)/platform`.
2. Build the pages with the existing platform visual language.
3. Reuse current APIs where possible.
4. Add new APIs only where the current backend does not support the page purpose.
5. Do not expose writable controls for values that are actually environment-backed.
6. Introduce a normalized `WebhookEvent` read model before attempting full webhook operations UX.
7. Keep email templates code-owned in v1; expose preview, not editing.
8. Ensure platform pages are protected by `platform_admin` role checks.
9. Audit the sidebar once implementation lands.
10. Update the UAT guide after the pages are shipped.

---

## Recommended Implementation Order

1. `Users`
2. `Webhooks`
3. `Reconciliation`
4. `Emails`
5. `Flags`
6. `Settings`

This order prioritizes live operator usefulness over completeness.
