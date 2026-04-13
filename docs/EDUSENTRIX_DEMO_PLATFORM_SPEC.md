# EduSentrix Demo Platform Spec

> **Version**: 1.1  
> **Date**: April 13, 2026  
> **Status**: Ready for implementation  
> **Audience**: Product, design, engineering, growth, sales  
> **Intent**: This document defines a safe, self-serve demo platform for EduSentrix at `demo.tryedusentrix.app` that gives prospective schools a realistic product experience without exposing development data, requiring Clerk login, or allowing real-world external side effects.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Goals and Non-Goals](#2-goals-and-non-goals)
3. [Current EduSentrix Constraints](#3-current-edusentrix-constraints)
4. [Industry Pattern and Chosen Model](#4-industry-pattern-and-chosen-model)
5. [Core Product Decisions](#5-core-product-decisions)
6. [Target User Experience](#6-target-user-experience)
7. [Architecture](#7-architecture)
8. [Data Model](#8-data-model)
9. [Demo Authentication and Persona Model](#9-demo-authentication-and-persona-model)
10. [Sandbox Provisioning, Allocation, and Reset](#10-sandbox-provisioning-allocation-and-reset)
11. [Demo Action Policy Matrix](#11-demo-action-policy-matrix)
12. [Lead Capture and Follow-Up Workflow](#12-lead-capture-and-follow-up-workflow)
13. [Frontend Implementation Plan](#13-frontend-implementation-plan)
14. [Backend Implementation Plan](#14-backend-implementation-plan)
15. [Security, Abuse Prevention, and Privacy Rules](#15-security-abuse-prevention-and-privacy-rules)
16. [Infrastructure and Environment Setup](#16-infrastructure-and-environment-setup)
17. [Observability, Audit, and Analytics](#17-observability-audit-and-analytics)
18. [Phased Delivery Plan](#18-phased-delivery-plan)
19. [Acceptance Criteria](#19-acceptance-criteria)
20. [AI Execution Checklist](#20-ai-execution-checklist)

---

## 1. Overview

EduSentrix needs a public demo environment where a prospective school administrator can experience the platform before committing. The demo must feel real enough to be persuasive, but it must not leak development data, require a normal login flow, or trigger real external systems like Paystack, Clerk invitations, email, WhatsApp, or uploads into live buckets.

The right solution is not to expose the current development database. The right solution is a dedicated demo environment:

- hosted at `demo.tryedusentrix.app`
- backed by a separate demo deployment
- backed by a separate demo MongoDB database
- seeded with curated synthetic school data
- driven by ephemeral, session-scoped sandbox tenants

Each prospect gets a dedicated demo sandbox. The sandbox is isolated from other prospects, supports realistic interaction, and is reset after the session expires.

This spec is additive:

- it does not replace the current Clerk-authenticated product
- it does not change production or development data topology
- it does not require a rewrite of role-specific app areas
- it introduces a demo-specific session path that slots into existing role guard helpers and `/api/me`

---

## 2. Goals and Non-Goals

### 2.1 Goals

- Let a prospect start a demo without a standard login.
- Capture lead details before access:
  - name
  - email
  - phone number
  - school name
  - school address
- Give the prospect a realistic, interactive product experience with seeded data.
- Support multiple concurrent demo users safely.
- Reset all prospect-created changes after the demo ends.
- Prevent real external side effects.
- Let the prospect explore multiple roles later from the same sandbox.
- Give the EduSentrix team usable lead and session telemetry for follow-up.
- Keep implementation non-breaking for current development and production flows.

### 2.2 Non-Goals

- The demo environment is not a public copy of the development environment.
- The demo environment is not a staging environment for internal QA.
- The demo environment does not create real Clerk users for prospects.
- The demo environment does not send real school-originated communications.
- The demo environment does not process real payments or create real payout rails.
- The demo environment does not host real per-school mailboxes.
- The demo environment does not need to support every obscure platform workflow in phase 1.

---

## 3. Current EduSentrix Constraints

EduSentrix today is strongly Clerk-centered on web and strongly school-scoped in MongoDB.

Relevant current surfaces:

- Web auth and user hydration:
  - `src/middleware.ts`
  - `src/providers/auth-provider.tsx`
  - `src/app/api/me/route.ts`
  - `src/lib/auth/get-current-user.ts`
- Shared role guard helpers:
  - `src/lib/auth/requireSchoolAdmin.ts`
  - `src/lib/auth/requireTeacher.ts`
  - `src/lib/auth/requireParent.ts`
  - `src/lib/auth/requireStudent.ts`
  - `src/lib/auth/requireBursar.ts`
  - `src/lib/auth/requirePaymentSetupAccess.ts`
- Core school and user models:
  - `src/models/School.ts`
  - `src/models/User.ts`
  - `src/models/UserMembership.ts`
- Existing public lead/application flow:
  - `src/app/api/platform/applications/route.ts`
  - `src/models/Application.ts`
  - `src/constants/application-pipeline.ts`

External side-effect surfaces already in the repo include:

- Paystack and checkout:
  - `src/lib/paystack.ts`
  - `src/lib/jobs/provisioning.ts`
  - `src/lib/finance/disbursements.ts`
  - parent payment and subscription routes
- Email:
  - `src/lib/email/services/send-brevo-email.ts`
  - `src/lib/email/services/send-manual-support-email.ts`
  - `src/lib/email/brevo.ts`
- WhatsApp:
  - `src/lib/notifications/whatsapp.ts`
  - fee reminders, attendance alerts, teacher notices
- Clerk invitations and magic-link onboarding:
  - invitation routes
  - `src/lib/auth/generateOnboardingMagicLink.ts`
- File uploads:
  - `src/app/api/uploadthing/route.ts`
  - `src/lib/uploadthing/core.ts`
- Cron and provider jobs:
  - `src/app/api/cron/*`

These constraints imply one clear design rule:

**do not implement demo mode as an unauthenticated public view into the normal app and dev database**

That would create cross-user collisions, unstable state, data leakage risk, and hard-to-reverse external side effects.

---

## 4. Industry Pattern and Chosen Model

### 4.1 Common industry patterns

B2B SaaS demo products usually use one of these:

1. read-only canned product tours
2. guided shared demo environments
3. self-serve sandbox tenants

EduSentrix needs the third option.

### 4.2 Chosen model

EduSentrix will use a **self-serve sandbox tenant** model:

- a prospect submits a short lead form
- the platform creates a demo session
- the platform allocates an isolated sandbox school
- the browser receives a signed HTTP-only session cookie
- the prospect enters the app without Clerk login
- the prospect can interact with seeded data and create new records
- the sandbox is reset after the session expires

### 4.3 Why this is the correct model

- It feels real, not like a static tour.
- It isolates prospects from one another.
- It avoids the risk of exposing the development database.
- It allows meaningful creation and editing flows.
- It makes cleanup predictable.
- It scales better than one shared demo school.

---

## 5. Core Product Decisions

### 5.1 Separate deployment and separate database

The demo must run on:

- a separate Vercel project or clearly isolated deployment target
- a separate MongoDB database dedicated to demo traffic

It must **not** share the production database.  
It must **not** share the normal development database.

### 5.2 Synthetic, curated demo data only

The demo database must contain synthetic data only:

- fake students
- fake parents
- fake teachers
- fake fees
- fake invoices
- fake attendance
- fake lesson notes
- fake reports
- fake timetable

No real school or learner data may appear in the demo dataset.

### 5.3 One sandbox school per active prospect session

Each active prospect gets a dedicated demo school clone.  
No two prospects share the same sandbox school at the same time.

### 5.4 No Clerk login in demo mode

Prospects do not sign in through Clerk on the demo host.  
The demo host uses its own session cookie and session resolver.

### 5.5 Reuse existing app branches through shared guard helpers

EduSentrix already centralizes much of its role resolution in:

- `/api/me`
- `getCurrentUser()`
- `requireSchoolAdmin()`
- `requireTeacher()`
- `requireParent()`
- `requireStudent()`
- `requireBursar()`

The demo implementation must plug into those shared auth/guard surfaces rather than fork the entire app.

### 5.6 Prewarmed sandbox pool

Do not clone a sandbox on the critical path of every prospect request if it can be avoided.  
Maintain a pool of prewarmed sandboxes.

### 5.7 Reset whole sandboxes, not individual user changes

Do not attempt record-by-record “undo.”  
The reset unit is the full sandbox school.

### 5.8 External side effects are controlled by policy

Every meaningful action in demo mode must resolve through a central demo action policy:

- `allow`
- `simulate`
- `deny`

### 5.9 Start with one flagship template, then expand

Phase 1 should ship with one polished flagship school template:

- Ghana
- Basic school
- rich data across admin, teacher, parent, student, and finance surfaces

Later phases can add:

- SHS template
- Cambridge/international profile
- multi-campus or premium finance profile

### 5.10 Platform follow-up is separate from sandbox access

Demo access must capture and store lead data.  
It should not automatically create a full school application by default.

Instead:

- `DemoLead` is the canonical demo-lead record
- it may link to an `Application` later
- platform admins can convert a demo lead to an application when appropriate

This avoids polluting the school-application approval queue with unqualified demo requests.

---

## 6. Target User Experience

### 6.1 Entry flow

1. Prospect visits `demo.tryedusentrix.app`
2. Prospect sees a concise “Try the demo” page
3. Prospect enters:
   - full name
   - work email
   - phone number
   - school name
   - school address
4. Prospect completes CAPTCHA / abuse check
5. Platform creates or resumes a demo session
6. Prospect is redirected into the demo school admin experience

### 6.2 In-app experience

Once inside the demo:

- a persistent `Demo Mode` banner is visible
- the current role is obvious
- the session expiry time is visible
- blocked actions explain why they are blocked
- simulated actions clearly state they are not live
- downloads are watermarked `Demo`

### 6.3 Role exploration

Phase 1:

- default entry role is `school_admin`

Phase 2:

- add a controlled role switcher for:
  - `teacher`
  - `parent`
  - `student`
  - `bursar`

The role switcher changes the active demo persona inside the same sandbox, not the underlying sandbox itself.

### 6.4 Session ending

When the session nears expiry:

- show a warning banner or modal
- allow a short extension if policy allows
- after expiry, move the user to a demo-ended screen
- prompt them to request a follow-up or full onboarding call

---

## 7. Architecture

### 7.1 Deployment topology

- `tryedusentrix.app`
  - production app
  - production DB
  - real providers
- `demo.tryedusentrix.app`
  - demo app
  - demo DB
  - demo provider stubs or blocked integrations

Recommended deployment shape:

- same codebase
- separate Vercel project or isolated environment alias
- separate environment variables
- separate Mongo database

### 7.2 Request resolution model

On the demo host:

- middleware must recognize the host as demo
- Clerk is not the primary web-auth source
- demo routes and protected app routes are allowed when a valid demo session cookie exists

On the normal host:

- current Clerk behavior remains unchanged

### 7.3 Core demo services

Add a new demo module with services such as:

- `resolveDemoHost()`
- `createDemoLead()`
- `createDemoSession()`
- `allocateDemoSandbox()`
- `resolveDemoSessionFromCookie()`
- `resolveDemoPersona()`
- `assertDemoActionPolicy()`
- `resetDemoSandbox()`

### 7.4 Demo policy registry

Introduce a policy registry for demo mode with entries like:

- `payments.parent_checkout`
- `payments.school_provisioning`
- `payments.disbursement_approval`
- `communications.email_send`
- `communications.whatsapp_send`
- `identity.invite_create`
- `identity.magic_link_create`
- `uploads.file_upload`
- `exports.pdf_generate`
- `integrations.provider_sync`
- `ai.generate`

Each entry resolves to:

- `allow`
- `simulate`
- `deny`

### 7.5 Why a policy registry is necessary

Without one, demo restrictions will end up scattered across individual routes and provider calls. That becomes brittle and unsafe quickly.

### 7.6 Side-effect coverage is a first-class implementation track

Patching shared auth helpers is necessary, but it is not sufficient.

The demo implementation must treat side-effect interception as its own delivery track with explicit coverage over:

- provider wrappers
- direct route handlers
- background jobs
- internal runner endpoints
- webhook-triggered flows
- upload and delete helpers
- export and PDF generators

For every side-effect family, engineering must record:

- the code surface
- the external system it could touch
- the primary interception point
- the fallback interception point
- the demo action policy key
- whether the action is `allow`, `simulate`, or `deny`
- the verification test proving it is covered

This coverage matrix is not optional documentation. It is an implementation artifact and a release gate.

The gate must be read correctly:

- inventory first
- matrix second
- coverage is only meaningful relative to the completed inventory of known paths

Unknown paths remain a residual implementation risk until the inventory is generated and reviewed.

### 7.7 Provider wrappers first, but not provider wrappers only

When possible, interception should happen in centralized service layers such as:

- Paystack helpers
- email send services
- WhatsApp send services
- upload providers
- invitation or magic-link helpers

However, the spec assumes some direct call paths will still exist in routes or jobs.  
Therefore every known direct path must either:

- be migrated behind a wrapper
- or have a route-local demo policy guard

No Phase 1 release is acceptable if any known external side-effect path is still unclassified.

---

## 8. Data Model

### 8.1 `DemoLead`

Canonical prospect record for demo access.

Suggested fields:

- `_id`
- `fullName`
- `email`
- `phone`
- `schoolName`
- `schoolAddress`
- `city`
- `region`
- `source`
- `utm`
- `notes`
- `status`
  - `new`
  - `active_demo`
  - `completed_demo`
  - `follow_up_due`
  - `converted`
  - `closed_lost`
- `linkedApplicationId`
- `firstSessionId`
- `lastSessionId`
- `firstSeenAt`
- `lastSeenAt`
- `createdAt`
- `updatedAt`

### 8.2 `DemoSession`

Tracks one prospect access window.

Suggested fields:

- `_id`
- `leadId`
- `sandboxId`
- `sandboxSchoolId`
- `sessionTokenHash`
- `status`
  - `active`
  - `expired`
  - `ended`
  - `capacity_blocked`
  - `abandoned`
- `activePersonaRole`
- `activePersonaUserId`
- `startedAt`
- `expiresAt`
- `lastActiveAt`
- `endedAt`
- `ipAddress`
- `userAgent`
- `resumeNonceHash`
- `version`
- `createdAt`
- `updatedAt`

### 8.3 `DemoSandbox`

Tracks one pooled sandbox school.

Suggested fields:

- `_id`
- `templateKey`
- `templateVersion`
- `schoolId`
- `state`
  - `available`
  - `allocated`
  - `resetting`
  - `tainted`
  - `disabled`
- `allocatedSessionId`
- `allocatedLeadId`
- `allocatedAt`
- `expiresAt`
- `lastResetAt`
- `lastResetDurationMs`
- `lastResetError`
- `seedFingerprint`
- `createdAt`
- `updatedAt`

### 8.4 `DemoTemplateVersion`

Tracks the demo template dataset used to create sandboxes.

Suggested fields:

- `_id`
- `templateKey`
- `version`
- `status`
  - `active`
  - `deprecated`
  - `draft`
- `schoolType`
- `curriculumCode`
- `seedScriptVersion`
- `manifestVersion`
- `notes`
- `createdAt`
- `updatedAt`

### 8.5 `DemoEvent`

Operational and product telemetry for demo usage.

Suggested fields:

- `_id`
- `leadId`
- `sessionId`
- `sandboxId`
- `schoolId`
- `actorRole`
- `actorUserId`
- `eventType`
- `eventCode`
- `metadata`
- `createdAt`

Examples:

- `demo.session.started`
- `demo.role.switched`
- `demo.action.blocked`
- `demo.action.simulated`
- `demo.session.expired`
- `demo.lead.converted`

### 8.6 `DemoScopedCollectionRegistry`

This can be code, not Mongo data.  
Its job is to make sandbox reset deterministic.

For each collection involved in a sandbox, record:

- collection/model name
- whether it is school-scoped
- primary school scope field
- foreign key fields that need remapping
- fields that must be scrubbed or regenerated
- delete/reset order
- seed order

This registry is essential because EduSentrix spans many collections and references. It prevents hand-written, fragile reset logic.

---

## 9. Demo Authentication and Persona Model

### 9.1 Session cookie

Demo auth uses a signed, HTTP-only cookie such as:

- `edusentrix_demo_session`

Requirements:

- signed
- opaque token, not raw Mongo ID
- server-side lookup by token hash
- secure and same-site appropriate
- shorter lifetime than normal product auth

### 9.2 Persona model

Each sandbox will contain synthetic demo users for each supported role.

Examples:

- school admin persona
- bursar persona
- teacher persona
- parent persona
- student persona

The session stores which persona is currently active.

### 9.3 Why personas are better than anonymous access

The existing app expects role-shaped users and school membership context.  
Using synthetic demo users lets the app keep most of its assumptions intact.

### 9.4 Shared auth abstraction

Do not inject demo logic into every route by hand.

Introduce a shared resolution layer:

- `resolveCurrentActor()`
- `resolveCurrentSchoolContext()`
- `resolveDemoOrClerkUser()`

Then adapt:

- `src/app/api/me/route.ts`
- `src/lib/auth/get-current-user.ts`
- shared `require*` helpers
- `src/middleware.ts`

### 9.5 Middleware rules

On `demo.tryedusentrix.app`:

- public access to demo entry routes is allowed
- app routes are allowed if a valid demo session exists
- unauthenticated demo traffic redirects to the demo landing page, not `/sign-in`

On non-demo hosts:

- keep current Clerk middleware behavior

### 9.6 `/api/me` behavior in demo mode

When the request is on the demo host and a valid demo session exists:

- `/api/me` returns the current demo persona
- the response shape must remain compatible with the current frontend auth provider

This is critical because `src/providers/auth-provider.tsx` already hydrates the app from `/api/me`.

### 9.7 Guard-helper integration

Patch the shared role helpers, not every page:

- `requireSchoolAdmin()`
- `requireTeacher()`
- `requireParent()`
- `requireStudent()`
- `requireBursar()`

Each helper should:

- first resolve demo actor if the host is demo and a valid demo session exists
- otherwise continue with current Clerk-backed behavior

This is the main non-breaking integration strategy.

### 9.8 Canonical demo actor DTO contract

Demo users are synthetic, but they must still look like first-class app actors to the frontend.

The canonical rule is:

- the demo actor response must preserve the current production-compatible shape first
- demo-only fields are additive, not replacing existing fields

Minimum compatible fields returned from `/api/me` in demo mode:

```ts
type DemoAppUser = {
  _id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  role?: AppRole;
  schoolId?: string;
  pendingOnboarding?: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;

  // additive demo-only metadata
  isDemo: true;
  demoSessionId: string;
  demoLeadId: string;
  demoSandboxId: string;
  demoPersonaRole: AppRole;
  demoSchoolId: string;
};
```

Important implementation rules:

- `_id` should resolve to a synthetic but stable persona user ID, ideally a real synthetic `User` document ID in the demo DB
- `role` must continue to represent the active persona role
- `schoolId` must continue to point to the sandbox school
- `pendingOnboarding` should normally be `false` in demo mode unless a specific onboarding demo flow intentionally needs otherwise
- `isDemo` is the canonical UI signal for any demo-specific presentation logic

### 9.9 UI compatibility rule for demo actors

The UI should not branch everywhere on demo mode.

Instead:

- shared app code should treat demo actors as normal authenticated users
- demo-aware UI differences must key off `isDemo`
- only genuinely demo-specific surfaces should inspect `demoSessionId`, `demoSandboxId`, or `demoPersonaRole`

This prevents demo mode from leaking into dozens of arbitrary components.

---

## 10. Sandbox Provisioning, Allocation, and Reset

### 10.1 Template school strategy

Phase 1 should use one polished flagship template school:

- one demo school template
- fully populated with rich fake data
- enough depth to showcase the product meaningfully

This template should live only in the demo database.

### 10.2 Prewarmed pool

Maintain a pool of sandboxes created from the active template.

Recommended initial pool:

- 10 to 20 demo sandboxes

The exact number depends on traffic, but prewarming avoids waiting for a new clone on the request path.

### 10.3 Allocation

Allocation must be atomic.

Use a single `findOneAndUpdate` or equivalent pattern:

- query `state = available`
- sort by oldest available or last reset
- set `state = allocated`
- set `allocatedSessionId`
- set `allocatedLeadId`
- set `allocatedAt`
- set `expiresAt`

If no sandbox is available:

- create a `capacity_blocked` session record
- show a graceful capacity message
- optionally offer “notify me when a demo slot opens”

### 10.4 Reset strategy

Reset is a background job, not an inline request action.

Reset steps:

1. mark sandbox `resetting`
2. delete all school-scoped data for the sandbox using the registry
3. reseed from the active template manifest
4. verify core records exist
5. mark sandbox `available`
6. rotate or invalidate any leftover session bindings

### 10.5 Failure handling

If reset fails:

- mark sandbox `tainted`
- remove it from allocation
- create an operational alert
- require admin/operator repair or automated rebuild

### 10.6 Why not record-by-record undo

Record-by-record undo is too fragile because:

- the product spans many collections
- actions can cascade across documents
- some records have many foreign keys
- external side effects may already have been simulated/logged

The correct reset unit is the sandbox school.

### 10.7 Session expiry

Recommended default:

- 90-minute active session

Rules:

- session extends on activity up to a hard maximum if desired
- expiry triggers sandbox release workflow
- expired session cookies must stop resolving

### 10.8 Resume behavior

If the same lead returns before expiry:

- reuse the active session if it exists

If the session has expired:

- create a new session
- allocate a new sandbox

### 10.9 Template integrity contract

The flagship template is its own milestone, not a small seed script.

Each demo template version must have:

- a manifest of seeded entity counts and relationships
- a deterministic seed routine
- a deterministic reset routine
- a post-seed verification suite

The verification suite must confirm at least:

- the school exists and has branding
- the expected demo personas exist
- teacher-class-subject assignments resolve
- parent-ward relationships resolve
- invoices and balances render without crashing
- lesson notes, attendance, calendar, and reports have usable data
- the sidebar and role dashboards load for each supported demo role

A sandbox may not return to `available` until template verification passes.

### 10.10 Resume, replay, and shared-inbox abuse rules

The following edge cases must be handled explicitly:

- same email, same browser, active session:
  - reuse active session
- same email, different browser, active session:
  - do not automatically hijack the active session
  - require an explicit resume flow or a new session decision
- shared corporate inboxes:
  - do not assume email alone is a secure session owner once a sandbox is active
- repeated form submits and refreshes:
  - must be idempotent enough not to allocate multiple sandboxes accidentally
- malicious replay of old cookies:
  - expired or rotated session tokens must stop resolving immediately

Phase 1 can choose a conservative policy:

- same email + different browser => create a new session if capacity allows

That is safer than trying to infer legitimate ownership too aggressively.

---

## 11. Demo Action Policy Matrix

### 11.1 Policy classes

- `allow`: action works inside the sandbox
- `simulate`: user sees a realistic outcome, but no real external side effect occurs
- `deny`: action is blocked with clear explanation

### 11.2 Absolute deny or simulate rules

These actions must never be live in demo mode.

#### Payments and billing

- Parent fee checkout via Paystack: `simulate`
- Subscription upgrade checkout: `simulate`
- School payment setup provisioning/subaccount creation: `deny`
- Payout account verification against live providers: `deny`
- Paystack disbursement approval/dispatch: `deny`
- Refunds or transfer verification: `deny`

Relevant surfaces include:

- parent checkout pages and routes
- `src/lib/paystack.ts`
- `src/lib/jobs/provisioning.ts`
- `src/lib/finance/disbursements.ts`
- subscription upgrade routes

#### Identity and invitations

- Clerk user invitation creation: `simulate`
- onboarding magic links: `simulate`
- password or real account creation: `deny`
- billing owner invitation emails: `simulate`

Relevant surfaces include:

- admin invitation routes
- onboarding owner-invite flow
- `src/lib/auth/generateOnboardingMagicLink.ts`

#### Communications

- school-originated outbound email: `simulate`
- school-originated WhatsApp: `simulate`
- school-originated SMS: `deny` in phase 1 unless a demo stub exists
- platform support email to prospect during demo: `allow` only outside the sandbox flow

Relevant surfaces include:

- `src/lib/email/services/send-brevo-email.ts`
- `src/lib/email/brevo.ts`
- `src/lib/notifications/whatsapp.ts`
- reminder and notice routes

#### Files and exports

- report-card PDF generation: `allow` with `Demo` watermark
- receipts and statements: `allow` with `Demo` watermark
- uploads:
  - `allow` only if a demo-only upload bucket is configured
  - otherwise `deny`

Relevant surfaces include:

- report download flows
- `src/app/api/uploadthing/route.ts`
- `src/lib/uploadthing/core.ts`

#### Integrations, jobs, and external syncs

- provider sync jobs: `deny`
- cron admin endpoints: `deny`
- webhook replay tools: `deny`
- real reconciliation with provider data: `deny`

### 11.3 Safe allow rules inside the sandbox

These actions should work normally inside the sandbox:

- create and edit classes
- create and edit students
- create and edit teachers
- create and edit fee structures
- issue demo invoices
- record manual or cash payments locally
- create lesson notes
- mark attendance
- view dashboards and reports
- edit school branding and settings
- create notices, events, and calendar items

### 11.4 AI actions

AI is a differentiator and should remain visible in demo mode, but it must be bounded.

Phase 1 policy:

- `allow` AI generation
- enforce per-session request caps
- show `Demo` context where the AI output could otherwise be mistaken for live operational content

### 11.5 Blocked-action UX contract

When an action is blocked or simulated:

- do not return vague 403s
- explain that the environment is a demo sandbox
- explain whether the action is simulated or unavailable
- if simulated, show what would normally happen in the live product

Example:

- payment checkout -> show a demo checkout success/failure path without hitting Paystack
- invite teacher -> create local demo invite status, but do not call Clerk or send email

### 11.6 Simulation UX contract

`simulate` is not one generic behavior. Each simulated action family needs a product contract.

Every simulated action must define:

- the user-facing entry point
- the loading or pending state
- the resulting success or blocked state
- any fake identifiers or references shown to the user
- the exact copy that explains the simulation
- whether downstream UI state changes as if the action succeeded
- the audit or telemetry event that records the simulation
- what reset behavior happens when the sandbox is recycled

Examples:

- parent checkout simulation:
  - open a realistic checkout confirmation flow
  - produce a fake reference
  - update local demo transaction state
  - show that no real payment was processed
- teacher invite simulation:
  - create a local invited state
  - show pending acceptance
  - never call Clerk or email
- school email simulation:
  - show the rendered message preview
  - mark it as `Demo only`
  - optionally write a local outbound demo message record

### 11.7 Side-effect coverage matrix

Phase 1 implementation must maintain a concrete coverage matrix that maps every known external side-effect path.

Minimum tracked families:

- Paystack checkout and payouts
- subscription billing checkout
- school payment provisioning
- disbursement approval and reconciliation
- Clerk invite and magic-link creation
- school-originated email
- school-originated WhatsApp
- upload and delete flows
- provider sync jobs
- cron and runner endpoints
- export or PDF flows with externally visible artifacts

For each family, record:

- surface owner
- code path
- interception point
- policy decision
- simulation decision if applicable
- verification status

The matrix must reach 100% known coverage before Phase 1 is considered releasable.

---

## 12. Lead Capture and Follow-Up Workflow

### 12.1 Canonical lead record

`DemoLead` is the canonical object for the prospect’s demo request.

### 12.2 Relationship to school applications

Do not auto-create a normal `Application` for every demo request.

Instead:

- capture demo leads separately
- allow platform admins to convert a demo lead into a normal application later
- optionally link an existing application if the same school already entered the pipeline

### 12.3 Why this is better

- demo requests and formal school applications are not the same business event
- this preserves the integrity of the application approval queue
- it still supports sales follow-up and CRM handoff

### 12.4 Platform follow-up UI

Add a platform surface such as:

- `/platform/demo-leads`

Capabilities:

- view demo leads
- search by school, email, phone
- see session count and last activity
- see whether the prospect requested follow-up
- convert to application
- link to existing application
- mark outcome

### 12.5 Optional pipeline integration

The existing application pipeline already has a `demo` stage in `src/constants/application-pipeline.ts`.

Use that stage later when:

- a demo lead is explicitly converted into the application pipeline
- or a platform admin links the demo lead to a real `Application`

Do not overload the application collection as the primary store for sandbox access.

---

## 13. Frontend Implementation Plan

### 13.1 Demo landing page

Add a public landing page on the demo host with:

- clear value proposition
- short lead form
- privacy note
- explicit “no credit card / no login needed” messaging if desired

### 13.2 Demo session bootstrap

After successful lead capture:

- set the demo session cookie
- redirect to the default admin landing route

### 13.3 Demo banner

Add a persistent top banner or shell banner on demo routes:

- `Demo Mode`
- active role
- session expiry
- reset/demo help link
- follow-up CTA

### 13.4 Role switcher

Phase 2 component:

- visible but controlled
- switches persona
- redirects to the correct role home route

### 13.5 Blocked and simulated action messaging

Use consistent in-app presentation:

- inline alert
- modal
- toast only for low-risk informational cases

Do not use silent no-ops.

### 13.6 Watermarking

Watermark the following:

- report downloads
- fee receipts
- statements
- generated letters

Watermark text:

- `EduSentrix Demo`

### 13.7 Capacity and expiry screens

Provide dedicated screens for:

- demo capacity exhausted
- session expired
- sandbox unavailable

These should invite the prospect to request a follow-up rather than showing a raw error.

### 13.8 Keep UI consistent with existing app patterns

New UI should use the existing shell, cards, alerts, and forms where possible.  
Do not make the demo UI look like a separate product.

---

## 14. Backend Implementation Plan

### 14.1 Demo module boundaries

Add a new bounded module such as:

- `src/lib/demo/*`
- `src/models/DemoLead.ts`
- `src/models/DemoSession.ts`
- `src/models/DemoSandbox.ts`
- `src/models/DemoTemplateVersion.ts`
- `src/models/DemoEvent.ts`

### 14.2 Demo APIs

Suggested route inventory:

- `POST /api/demo/request-access`
  - validate lead form
  - create or reuse lead
  - allocate sandbox
  - create session
  - set cookie
- `POST /api/demo/switch-role`
  - update active persona
- `POST /api/demo/end-session`
  - expire session early
- `GET /api/demo/session`
  - return session metadata for banner/UI
- `POST /api/demo/reset-request`
  - optional support/admin action

Platform-facing:

- `GET /api/platform/demo-leads`
- `PATCH /api/platform/demo-leads/[id]`
- `POST /api/platform/demo-leads/[id]/convert`

Operational:

- `POST /api/cron/demo-reaper`
- `POST /api/cron/demo-pool-rebuild`

### 14.3 Guard-helper integration sequence

Do not patch every route individually first.

Patch in this order:

1. middleware host detection
2. `/api/me`
3. `getCurrentUser()`
4. shared `require*` helpers
5. high-risk provider/service wrappers

### 14.4 Provider-action interception

Add a shared helper such as:

- `resolveDemoActionDisposition()`
- `assertDemoAllowedOrSimulate()`

Critical rule:

- block or simulate before calling external providers

### 14.5 Seed and reset tooling

Add scripts for:

- initial template seed
- prewarm sandbox pool
- reset one sandbox
- verify pool health

### 14.6 Idempotency and concurrency

Lead capture and sandbox allocation must be idempotent enough to handle refreshes and double-submits.

Rules:

- same email + active session -> reuse session
- same browser retry after successful allocation -> do not allocate a second sandbox
- allocation must be atomic

### 14.7 Implementation inventory for direct side-effect paths

Before building demo mode, engineering must compile a route-and-service inventory of current side-effect paths in this repo.

At minimum, the inventory must cover:

- all direct Paystack call sites
- all direct email send call sites
- all direct WhatsApp send call sites
- all Clerk invitation and magic-link call sites
- all upload creation and deletion call sites
- all internal runner endpoints
- all cron endpoints

This inventory should be generated from the current codebase, checked into docs or implementation notes, and used as the source list for side-effect coverage.

---

## 15. Security, Abuse Prevention, and Privacy Rules

### 15.1 No demo access without lead capture

Public demo access requires the lead form first.

### 15.2 CAPTCHA and rate limiting

Protect the request-access endpoint with:

- CAPTCHA
- IP rate limits
- email/domain rate limits
- optional device fingerprint or coarse abuse heuristics

### 15.3 No indexing

The demo host should be marked:

- `noindex`
- `nofollow` where appropriate

### 15.4 Synthetic data only

Never seed real learners, guardians, or schools into the demo DB.

### 15.5 Cookie and session security

- use HTTP-only cookies
- hash tokens in storage
- short expiry
- invalidate on session end

### 15.6 Capacity protection

Do not allow unbounded sandbox creation.  
The pool and allocation caps protect database cost and abuse.

### 15.7 Demo upload policy

If uploads are enabled:

- use a demo-only bucket or path prefix
- apply lifecycle cleanup
- never mix demo uploads with production assets

If that cannot be guaranteed in phase 1:

- disable uploads in demo mode

### 15.8 Abuse handling and identity ambiguity

The demo system captures leads before access, but lead data is not the same as verified identity.

Therefore:

- do not treat possession of an email address alone as authorization to resume an existing sandbox from any browser
- do not let repeated requests from one actor consume unlimited sandboxes
- cap active sessions per email, per IP, and per coarse device or browser fingerprint where possible
- mark suspicious allocation patterns for review
- prefer creating a fresh sandbox over risky cross-browser session reassignment

### 15.9 Search engine and public indexing policy

The demo landing page may remain publicly reachable, but app-internal demo routes must not be indexed.

Rules:

- landing pages should carry explicit product/demo messaging
- authenticated demo app routes should be `noindex`
- expired-session and capacity screens should also be `noindex`

### 15.10 Demo AI quota and key isolation

Phase 1 must make an explicit decision on AI isolation:

- whether demo AI shares the production OpenAI key
- whether demo AI has a separate key
- what quota applies per session and per day

The preferred model is:

- same provider integration shape
- separate demo quota controls
- explicit tagging of demo AI usage in telemetry

---

## 16. Infrastructure and Environment Setup

### 16.1 Required environment separation

Create a dedicated demo environment with its own values for at least:

- `MONGODB_URI`
- database name
- base URL
- cookie secrets
- demo session secret
- CAPTCHA keys
- any provider-mode flags

### 16.2 Provider configuration rules

On the demo deployment:

- Paystack live actions must be disabled
- Clerk invite/account-creation flows must be disabled or simulated
- school-originated email must be simulated
- school-originated WhatsApp must be simulated
- upload bucket must be demo-only or disabled

### 16.3 Cron behavior

The demo deployment must run only demo-safe jobs:

- session reaper
- sandbox reset/rebuild

It must not run production/provider jobs by accident.

### 16.4 Recommended env flags

Examples:

- `APP_RUNTIME_MODE=demo`
- `NEXT_PUBLIC_APP_RUNTIME_MODE=demo`
- `DEMO_BASE_URL=https://demo.tryedusentrix.app`
- `DEMO_SESSION_SECRET=...`
- `DEMO_DEFAULT_SESSION_MINUTES=90`
- `DEMO_MAX_ACTIVE_SESSIONS=20`
- `DEMO_UPLOADS_ENABLED=false`
- `DEMO_AI_ENABLED=true`
- `DEMO_AI_MAX_REQUESTS_PER_SESSION=20`

### 16.5 Pre-build decisions to lock before implementation

The following questions must be settled before coding starts in earnest:

- while the current app still mounts `ClerkProvider` globally, what is the temporary compatibility path for the demo host before demo-session auth fully replaces Clerk on that host?
- will demo AI use the same OpenAI key as the live product or a separately budgeted key?
- are uploads enabled in Phase 1, and if so, is a demo-only bucket available?
- what exact watermark treatment should apply to PDFs, statements, and receipts?
- should same-email different-browser access resume the same session or always create a new one?
- will the demo landing page be indexable, or should the entire demo host be `noindex`?
- should the demo Vercel project remain password-protected until sandbox auth is implemented?

None of these should be left to ad hoc engineering decisions mid-build.

These decisions are effectively Phase 1 prerequisites even if some related UI surfaces, such as richer platform follow-up views, are scheduled for a later phase.

---

## 17. Observability, Audit, and Analytics

### 17.1 Operational telemetry

Track:

- leads created
- sessions started
- sessions expired
- pool allocation latency
- pool exhaustion events
- reset failures
- blocked or simulated actions by type

### 17.2 Product insight telemetry

Track:

- which modules prospects visit most
- whether they switch roles
- where they abandon
- which blocked actions they hit most
- whether they request follow-up

### 17.3 Audit

Demo activity should be auditable, but it does not need the same compliance guarantees as live production actions.

Still record:

- lead creation
- session allocation
- role switching
- blocked external actions
- demo lead conversion to application

This should integrate cleanly with the broader audit hardening work later.

### 17.4 Demo audit stream separation

Demo audit events must never be indistinguishable from production events.

Required tagging:

- `environment = demo`
- `isDemo = true`
- `demoSessionId`
- `demoSandboxId`
- `demoLeadId` where available

Required viewer behavior:

- production audit UIs should exclude demo events by default
- demo and production events must not share the same logical stream identity without environment tagging
- operational analytics may aggregate both only when explicitly grouped by environment

This keeps demo traffic from polluting the production audit story.

---

## 18. Phased Delivery Plan

### Phase 1: Safe demo foundation

- separate demo deployment and DB
- `DemoLead`, `DemoSession`, `DemoSandbox`, `DemoTemplateVersion`
- public lead form
- session cookie flow
- demo-aware middleware and `/api/me`
- one flagship sandbox template
- sandbox pool allocation
- reset worker
- hard deny/simulate for payments, invites, email, WhatsApp, cron, and provider sync

### Phase 2: Better realism

- role switcher
- watermarked downloads
- simulated invite and checkout flows
- demo banner with expiry
- platform demo leads page

### Phase 3: Sales and ops maturity

- convert demo lead to application
- richer telemetry
- pool health dashboard
- more template profiles

---

## 19. Acceptance Criteria

- Visiting `demo.tryedusentrix.app` does not expose the development or production app session directly.
- A prospect must provide the required lead details before entering the demo.
- Two concurrent prospects never share the same active demo school.
- Demo traffic never writes to the normal development or production databases.
- Demo sessions work without Clerk login.
- Existing production and development Clerk login flows remain unchanged.
- Shared app auth hydration still works through `/api/me` in demo mode.
- Supported demo roles can navigate their app areas without being thrown to `/sign-in`.
- Parent checkout cannot hit real Paystack in demo mode.
- Billing setup cannot create a real Paystack subaccount in demo mode.
- Demo invite actions do not create real Clerk users or send real school emails.
- Demo email and WhatsApp actions are visibly simulated.
- A sandbox reset removes prospect-created data and returns the sandbox to the seeded state.
- Expired sessions lose access cleanly.
- Platform admins can view demo leads and follow up.
- Demo downloads are watermarked if generation is enabled.
- `/api/me` returns a production-compatible actor shape in demo mode, with additive demo metadata rather than a separate incompatible schema.
- Demo personas can move through existing role shells without broad UI branching.
- Every known external side-effect family has a recorded interception point and verification status.
- Phase 1 cannot ship unless the side-effect inventory is completed and the side-effect coverage matrix reaches 100% coverage of those known paths.
- Demo audit events are clearly tagged and excluded from production audit views by default.
- Template verification must pass before a sandbox is marked `available`.

---

## 20. AI Execution Checklist

1. Create the new spec-backed demo models:
   - `DemoLead`
   - `DemoSession`
   - `DemoSandbox`
   - `DemoTemplateVersion`
   - `DemoEvent`
2. Add a demo runtime detection helper keyed by host and env.
3. Add demo session cookie creation, hashing, and lookup helpers.
4. Implement `POST /api/demo/request-access`.
5. Implement atomic sandbox allocation.
6. Extend `src/middleware.ts` to respect demo host + demo session.
7. Extend `src/app/api/me/route.ts` for demo persona resolution.
8. Extend `src/lib/auth/get-current-user.ts` for demo-aware lookup.
9. Patch shared role guard helpers to resolve demo personas first.
10. Introduce a central demo action-policy helper.
11. Patch high-risk side-effect surfaces first:
    - parent checkout
    - subscription upgrade
    - payment setup provisioning
    - disbursement approval
    - invitation send
    - email send
    - WhatsApp send
    - uploadthing
    - cron/provider sync routes
12. Build one flagship demo school template seed script.
13. Build the sandbox reset and prewarm scripts.
14. Add the public demo landing page and lead form.
15. Add the demo banner and session-expiry UI.
16. Add the platform demo leads view.
17. Add watermarks and simulated-action UX.
18. Generate and commit the side-effect inventory described in `§14.7`.
19. Create the side-effect coverage matrix from that inventory and verify every known path is intercepted.
20. Add telemetry, operational logging, pool health checks, and demo audit tagging.
21. Verify production and development behavior remain unchanged.

---

## Final Implementation Principle

The demo environment must feel like the real product to the prospect, but it must behave like a controlled sandbox to the platform.

That means:

- isolated tenants
- synthetic data
- session-based access
- hard side-effect controls
- deterministic reset
- no contamination of development or production systems

Anything weaker than that will eventually create data, reliability, or trust problems.
