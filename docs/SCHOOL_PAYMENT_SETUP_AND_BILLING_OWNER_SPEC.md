# EduSentrix School Payment Setup & Billing Owner Spec

> **Version**: 1.0  
> **Date**: April 1, 2026  
> **Status**: Ready for phased implementation  
> **Audience**: Product, design, and engineering

---

## Table of Contents

1. [Overview](#1-overview)
2. [Current State](#2-current-state)
3. [Core Product Decisions](#3-core-product-decisions)
4. [Roles & Access Model](#4-roles--access-model)
5. [Payment Setup Settings Surface](#5-payment-setup-settings-surface)
6. [Onboarding and Launch Wizard Flow](#6-onboarding-and-launch-wizard-flow)
7. [Verification & Risk Controls](#7-verification--risk-controls)
8. [Data & Domain Model Changes](#8-data--domain-model-changes)
9. [Phased Delivery Plan](#9-phased-delivery-plan)
10. [Migration & Backfill](#10-migration--backfill)
11. [Acceptance Criteria](#11-acceptance-criteria)
12. [Open Questions](#12-open-questions)

---

## 1. Overview

EduSentrix currently allows schools to collect bank details during onboarding, but it does not provide a proper school-facing post-launch payment setup workflow. This creates three operational problems:

- parents can reach an online payment flow that later fails because the school is not payment-ready
- school-side users do not have a dedicated, secure place to manage payout details after onboarding
- there is no clear authority model for who is allowed to configure or change school payout settings

This spec defines a simple but strong operating model:

- online payout setup moves into a dedicated school settings area
- access is restricted to a narrow financial authority role, not general school admin access
- onboarding and the future launch wizard can hand off payment setup asynchronously without blocking normal school setup
- rollout happens in phases so existing working code keeps functioning while new flows are introduced

---

## 2. Current State

### 2.1 What exists today

- Old onboarding collects school bank details in `src/app/onboard/page.tsx`
- Onboarding saves those details in `src/app/api/onboarding/school/route.ts`
- Checkout blocks if `billing.paystack.subaccountCode` is missing in `src/app/api/parent/payments/checkout/route.ts`
- Parent fees currently expose `canPayOnline: true` too broadly in `src/app/api/parent/fees/route.ts`
- School admin billing currently shows only a read-only payment readiness signal in `src/app/(app)/admin/billing/page.tsx`
- Platform billing has platform-side payout and readiness visibility in `src/app/(app)/platform/billing/page.tsx`

### 2.2 Gaps confirmed in discovery

- There is no proper school-admin or school-finance settings page for payment setup after onboarding
- There is no separate school-side financial authority role today
- The existing onboarding finish flow does not complete the intended provisioning handoff
- A school admin who is not authorized to control payout details currently has no proper restricted alternative flow
- Parent UI can invite payment attempts before the school is genuinely ready

### 2.3 Principle for this spec

Do not replace existing working paths in one shot. Add the missing payment setup domain and route traffic gradually.

---

## 3. Core Product Decisions

### 3.1 Use a `Billing Owner`, not a broad `School Owner`

The platform does not need a full-time "school owner" user for day-to-day operations.

It does need a clearly accountable financial authority for:

- payout account setup
- Paystack subaccount activation
- payout account changes
- payment readiness approval

That role should be modeled as `Billing Owner`.

The person filling that role may be:

- the actual school owner
- a proprietor
- a bursar
- a finance lead
- another designated authority

The product should model financial authority, not job title.

### 3.2 The billing owner should have a restricted account

The billing owner should be on the platform, but not as a full admin by default.

They need a minimal restricted account because that gives EduSentrix:

- a real audit trail
- a repeatable way to manage future payout changes
- identity continuity across setup, edits, retries, and approvals
- cleaner security than a one-time anonymous form

### 3.3 Payment setup must not be visible to unauthorized school admins

If a school admin says they are not authorized to set payout details, they must not be able to later open that page and view or edit sensitive bank information.

This means:

- unauthorized users should not see the page link
- direct API access must return `403`
- masked or read-only fallback is acceptable only if explicitly designed; default should be no access

### 3.4 Online payments are enabled only when the school is payment-ready

The parent experience must reflect actual readiness.

`Pay Now` must only be offered when the school has:

- valid payout details
- required billing approval state
- successful Paystack subaccount provisioning

Until then, the platform should present a clear unavailable state instead of allowing a broken payment attempt.

### 3.5 The future launch wizard must not be the only place to manage payment setup

The new Dragonfly-style launch wizard will replace old onboarding, but it must hand off to a persistent `Payment Setup` settings area.

The wizard is for initial collection.

The settings area is the long-term source of truth.

---

## 4. Roles & Access Model

### 4.1 Roles in scope

#### `school_admin`

Operational school manager.

Can:

- complete operational onboarding or launch steps
- configure non-financial school settings
- invite staff
- manage classes, teachers, students, and normal school administration

Cannot by default:

- view payout bank details
- configure Paystack payout setup
- change payout destination

#### `billing_owner`

Restricted financial authority for payment setup.

Can:

- add and update payout bank details
- submit or resubmit payment setup
- see provisioning status and errors
- retry Paystack setup
- approve payout account changes
- optionally delegate payment setup authority later

Cannot by default:

- operate all school admin workflows
- access unrelated school operations unless separately authorized

### 4.2 Future-ready permission model

Even if the initial implementation uses a dedicated role, internal access checks should be designed around capabilities so the model can expand later.

Recommended capabilities:

- `payments.view`
- `payments.manage`
- `payments.approve_payout_change`

Initial mapping:

- `billing_owner` => all three
- `school_admin` => none by default

Future mapping:

- bursar or finance delegate => `payments.view` and `payments.manage`
- owner-only payout change approval => `payments.approve_payout_change`

### 4.3 Visibility rules

- `billing_owner` sees `Settings > Payment Setup`
- authorized delegates may see it later if the capability model is enabled
- `school_admin` without payments access does not see the nav entry
- direct route visits by unauthorized users return forbidden

---

## 5. Payment Setup Settings Surface

### 5.1 Purpose

Provide one dedicated school-side place to:

- add payout details
- view readiness state
- complete provisioning
- recover from provisioning failures
- manage payment authority safely

### 5.2 Recommended route

Recommended school-facing route:

- `/admin/settings/payment-setup`

This keeps it in school settings while clearly separating it from general configuration.

### 5.3 Page structure

#### Header

- Title: `Payment Setup`
- Subtitle: `Configure how your school receives online fee payments`
- Status badge: current payment readiness state

#### Section A: Payout Account

- bank name
- branch
- sort code
- account name
- account number
- masked display where appropriate

#### Section B: Payment Status

- `Not started`
- `Awaiting billing owner`
- `Submitted`
- `Pending provisioning`
- `Review required`
- `Provisioned`
- `Failed`

#### Section C: Provisioning Details

- Paystack subaccount status
- last provisioning attempt
- last known error
- retry action if authorized

#### Section D: Access & Authority

- current billing owner
- invite or replace billing owner
- optional future delegates

#### Section E: Audit

- who last updated payout details
- when the last change happened
- who approved the current payout configuration

### 5.4 Behavioral rules

- Unauthorized school admins cannot view the page
- Payment details remain masked unless the user has explicit payment access
- Editing bank details after provisioning should trigger a controlled re-approval or reprovisioning flow
- Parent online payment availability depends on this page's readiness state, not optimistic UI defaults

---

## 6. Onboarding and Launch Wizard Flow

### 6.1 Old onboarding reality

Today, bank details are collected during onboarding. That is acceptable as a temporary path, but it is not sufficient as the long-term operational model.

### 6.2 Target design for the new launch wizard

The future launch wizard should preserve the same major setup steps as the old onboarding flow, but payment setup should behave differently:

- the wizard can collect initial payment information
- the wizard must not be the only place to manage payment information
- the wizard must support asynchronous completion by a different person

### 6.3 Recommended flow in the launch wizard

At the payment step, ask:

- `Are you authorized to set the school's payout account for online collections?`

#### If the user is authorized

- allow them to proceed into payment setup
- require attestation that they are authorized
- submit payout details into the same domain model used by the settings page

#### If the user is not authorized

- ask for the billing owner's name and email
- create a pending billing owner invitation
- send a secure claim link
- mark the school's payment setup state as `awaiting_billing_owner`
- let the school admin continue the launch wizard without blocking the rest of setup

### 6.4 Owner invitation flow

Recommended sequence:

1. school admin enters billing owner contact
2. system sends a secure, time-bound link
3. billing owner claims a restricted account or signs in
4. billing owner lands directly in `Payment Setup`
5. billing owner completes payout details and provisioning
6. school payment readiness updates when the process succeeds

### 6.5 Why this is better than blocking onboarding

- operational setup can continue
- financial control stays with the correct authority
- the school does not need to coordinate all setup live in one sitting
- the product does not expose sensitive settings to the wrong user

---

## 7. Verification & Risk Controls

### 7.1 MVP verification approach

Do not block this system on perfect bank verification.

The first release should use practical controls:

- require account holder name
- require authorization attestation
- record who submitted the details
- compare submitted identity against school identity heuristically
- flag suspicious submissions for review

### 7.2 Review triggers

Examples of cases that should move to `review_required` instead of immediate provisioning:

- account holder name appears materially unrelated to school name
- payout details change soon after initial provisioning
- billing owner is newly changed and immediately updates bank details
- repeated provisioning failures suggest incorrect or inconsistent data

### 7.3 Higher-risk changes

Changes to payout destination after the school is already live should require a stronger control than first-time setup.

Recommended later controls:

- step-up verification
- short approval challenge
- dual confirmation for payout account changes

This can be introduced after the initial billing owner model is stable.

---

## 8. Data & Domain Model Changes

This section is intentionally additive so rollout can happen without destabilizing current behavior.

### 8.1 School payment setup status

Add an explicit status field for school payment setup rather than treating `subaccountCode != null` as the only truth signal.

Recommended states:

- `not_started`
- `awaiting_billing_owner`
- `details_submitted`
- `pending_provisioning`
- `review_required`
- `provisioned`
- `failed`

### 8.2 Billing owner identity

Store a school-scoped billing owner assignment.

Suggested conceptual fields:

- `billingOwnerUserId`
- `billingOwnerInvitation`
- `billingOwnerAssignedAt`
- `billingOwnerAssignedBy`

### 8.3 Audit metadata

Track:

- who submitted payout details
- who last changed them
- who approved the current configuration
- timestamps for each critical action

### 8.4 Payment readiness flag

Parent payment eligibility should derive from:

- payment setup status
- provisioning status
- any required review state

It should not depend only on whether an invoice is due.

---

## 9. Phased Delivery Plan

### Phase 1: Guardrails and truth alignment

Goal: stop exposing broken payment actions.

Deliver:

- derive school payment readiness from the actual billing/provisioning state
- stop showing parent `Pay Now` when the school is not payment-ready
- add clearer school payment status handling in school-facing and parent-facing APIs

Do not:

- replace onboarding
- introduce the new owner flow yet

Risk profile:

- low
- mostly additive and corrective

### Phase 2: School payment setup settings surface

Goal: create the proper post-onboarding home for payment setup.

Deliver:

- new `Payment Setup` settings page
- restricted access for financial authority only
- read/write payout details flow
- status display for provisioning and failure handling

Do not:

- remove old onboarding payment capture yet

Risk profile:

- low to medium
- isolated school-facing surface

### Phase 3: Billing owner role and invitation flow

Goal: let the right person complete setup even if the onboarding admin is not authorized.

Deliver:

- restricted `billing_owner` access model
- secure billing owner invite / claim flow
- school admin handoff path when not authorized
- `awaiting_billing_owner` status

Do not:

- force every existing school to adopt the new role immediately

Risk profile:

- medium
- introduces auth and account lifecycle changes

### Phase 4: Provisioning workflow completion

Goal: connect school-side setup to actual Paystack subaccount provisioning reliably.

Deliver:

- consistent provisioning trigger path
- retry path
- failure capture and surfacing
- backfill support for already-onboarded schools with valid bank data

Risk profile:

- medium
- touches billing and external integration workflow

### Phase 5: Launch wizard replacement

Goal: replace old onboarding with a Dragonfly-style launch wizard while preserving parity.

Deliver:

- new launch wizard with the same core setup steps as old onboarding
- payment step with authorized / not-authorized branching
- async billing owner handoff
- same shared backend payment setup domain as the settings page

Do not:

- remove old onboarding until feature parity and migration readiness are confirmed

Risk profile:

- medium
- UX replacement with significant user flow impact

### Phase 6: Hardening and delegated finance access

Goal: improve trust and operational flexibility.

Deliver:

- suspicious account review queue
- payout change approval controls
- optional finance delegate access
- stronger audit and notification flow

Risk profile:

- medium
- mostly enhancements on top of a stable base

---

## 10. Migration & Backfill

### 10.1 Existing schools

Existing schools should not be forced through the launch wizard again.

Backfill approach:

- infer provisional payment setup state from existing billing and bank data
- mark schools with bank details but no subaccount as `details_submitted` or `failed`, depending on what can be inferred safely
- identify schools with live parent invoices but no payment readiness and suppress online payment actions until fixed

### 10.2 Existing onboarding flow

Keep the old onboarding flow in place until:

- the new settings page exists
- the billing owner invitation flow exists
- the new launch wizard is parity-complete

### 10.3 Existing users

Do not reassign broad admin roles.

Add the billing owner capability as a separate school-scoped assignment.

---

## 11. Acceptance Criteria

### 11.1 Parent experience

- Parents never see a working-looking `Pay Now` action for a school that is not payment-ready
- Checkout no longer fails for the known "not configured" reason when the UI offered online payment

### 11.2 School admin experience

- Unauthorized school admins cannot view or edit payment setup
- Authorized financial users can complete or repair school payment setup from settings after onboarding

### 11.3 Billing owner experience

- A billing owner can receive a secure invite, claim access, and complete payment setup without needing full school admin permissions
- The billing owner lands directly in the payment setup flow and can return later for changes

### 11.4 System behavior

- Payment setup has an explicit lifecycle state
- Provisioning failures are visible and recoverable
- The launch wizard and settings page use the same underlying payment setup domain

### 11.5 Rollout safety

- Existing operational school admin flows remain intact while the new system is introduced
- Old onboarding is not removed before the new launch wizard reaches parity

---

## 12. Open Questions

These should be resolved before implementation of the relevant phase, not necessarily before Phase 1.

1. Should the product name remain `Billing Owner`, or should the UI label be something more familiar such as `Payments Contact` or `Financial Owner`?
2. Should schools be allowed to have more than one billing owner, or exactly one plus optional delegates?
3. What review heuristic should trigger manual verification for suspected personal accounts?
4. Should payout account changes require immediate step-up verification in the first release, or only after the initial workflow is stable?
5. Should the school admin see a non-sensitive status card like `Payment setup pending with billing owner`, or should the entire area remain invisible?

---

## Bottom Line

This spec intentionally separates:

- operational school administration
- financial payout authority
- initial setup collection
- ongoing payment configuration

That separation is the safest way to:

- unblock onboarding
- protect sensitive payment settings
- avoid broken parent payment flows
- introduce the future launch wizard without destabilizing current working code
