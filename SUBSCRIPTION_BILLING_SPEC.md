# EduSentrix Subscription & Billing System — Developer Spec

> **Version**: 1.0  
> **Date**: February 2026  
> **Status**: Ready for implementation  
> **Audience**: Developers / AI Developers building this feature end-to-end

---

## Table of Contents

1. [Overview](#1-overview)
2. [Ghana School Context](#2-ghana-school-context)
3. [External Service Cost Reference](#3-external-service-cost-reference)
4. [Subscription Tiers](#4-subscription-tiers)
5. [Data Models](#5-data-models)
6. [Feature Gating System](#6-feature-gating-system)
7. [Usage Metering & Pilot Tracking](#7-usage-metering--pilot-tracking)
8. [Platform Admin Dashboard](#8-platform-admin-dashboard)
9. [API Endpoints](#9-api-endpoints)
10. [Frontend Components](#10-frontend-components)
11. [School-Facing Subscription UI](#11-school-facing-subscription-ui)
12. [Webhook & Automation](#12-webhook--automation)
13. [Migration Plan for Existing Schools](#13-migration-plan-for-existing-schools)
14. [Implementation Phases](#14-implementation-phases)
15. [Testing Checklist](#15-testing-checklist)

---

## 1. Overview

### Goal

Add a configurable subscription tier system to EduSentrix that:
- Limits features and resource usage based on subscription tier
- Provides a **1-month free trial** for all new schools
- Is fully configurable from the **Platform Admin** dashboard (`/platform`)
- Tracks resource consumption per school for cost analysis (critical for pilot phase)
- Enables the platform admin to manually set and change subscriptions, offer discounts, and manage per-school transaction fee rules
- Treats transaction fees as a percentage charged on money movements processed through EduSentrix:
  - parent-to-school collections
  - school-to-teacher disbursements
  - school-to-vendor disbursements
- Tracks third-party and platform-native usage by school with attributable cost estimates and margin analysis
- Automatically produces pilot closeout pricing intelligence before final tier pricing is locked
- Ensures profitability at scale by pricing above infrastructure cost

### Key Principles

1. **No losses** — pricing covers all infrastructure + staff + maintenance + profit margin
2. **Configurable** — tiers, features, limits, and prices are editable from the admin UI, NOT hardcoded
3. **Pilot-first** — the system tracks real usage before we lock in pricing
4. **Graceful degradation** — when a school hits a limit, show a clear upgrade prompt, don't crash
5. **Ghana-local payments** — use Paystack (already partially integrated for subaccounts and webhook-based capture) for subscription billing and school payment rails
6. **Commercial flexibility** — platform admin can negotiate school-specific pricing, discounts, and transaction fees
7. **Measured pricing** — final public tier pricing is approved only after pilot closeout usage and cost analysis
8. **Fee separation** — subscription fees, EduSentrix transaction fees, and processor fees are tracked as distinct financial streams
9. **Secure payout routing** — payout account changes are high-risk settings and require phone-based 2FA before they are saved

### 1.1 Operational Gaps for "World-Class" Standard

These are the practical admin capabilities missing if the goal is a serious SaaS billing console:

- **No revenue intelligence**
  - No MRR/ARR, churn, trial conversion, expansion/downgrade, overdue risk, gross margin, or tier-mix reporting.
  - This spec must therefore require a full revenue analytics surface, not just payment status.
- **No cost-to-serve visibility**
  - No actual service cost ledger or infrastructure cost tracking by school.
  - This spec must therefore require provider cost tracking plus school-level cost allocation.
- **No billing history or audit trail**
  - No subscription event timeline exists yet.
  - This spec must therefore treat audit-grade subscription events as a first-class requirement.
- **No pilot-to-paid operating workflow**
  - Pilot oversight without closeout analysis is insufficient.
  - This spec must therefore include pilot closeout automation, repricing recommendations, and review workflows.
- **No customer-facing subscription state surface**
  - School-facing subscription visibility is part of an end-to-end billing system.
  - This spec must therefore include current plan, pricing visibility, and self-service surfaces for schools.

### 1.2 Most Important Bottom Line

Right now, the platform admin account is essentially:

- a valid restricted shell
- an applications review area
- a sidebar with future destinations

It is **not yet** a subscription billing control center. This specification closes that gap by defining the operational, financial, and analytical systems needed for platform-grade billing.

### 1.3 Immediate Priorities

In delivery order, prioritize:

1. Establish the billing domain models.
2. Build the platform billing APIs.
3. Add the school subscription detail workflow.
4. Add the billing and revenue dashboards.
5. Add usage metering, cost attribution, and entitlements enforcement.

### 1.4 Locked Billing Rules

These rules are fixed and should drive implementation:

1. **Discounts apply to subscription charges only**
   - Discounts do **not** reduce transaction fees.
2. **Transaction fees are the school's responsibility**
   - They are charged on:
     - parent payments to the school processed via EduSentrix
     - school payments to teachers processed via EduSentrix
     - school payments to vendors processed via EduSentrix
3. **Custom base price and discount may coexist**
   - Billing order:
     - tier price
     - manual custom price override (if present)
     - discount on the subscription portion only
     - EduSentrix transaction fee calculated separately
     - processor fee tracked separately as gateway cost
4. **EduSentrix transaction fee is platform revenue**
   - It is not the same as the processor fee (for example, Paystack's fee).
5. **Pricing recommendations may be generated automatically, but never auto-applied**
   - AI creates the recommendation draft.
   - Platform admin must approve before any pricing change is adopted.

---

## 2. Ghana School Context

### School Size Profiles

| Profile | Students | Teachers | Admin | Parents (est.) | Total Users | Est. MAU |
|---------|----------|----------|-------|-----------------|-------------|----------|
| Micro | 30–80 | 3–6 | 1–2 | 25–65 | ~120 | ~40 |
| Small | 80–200 | 6–12 | 2–3 | 65–170 | ~350 | ~110 |
| Medium | 200–500 | 12–25 | 3–6 | 170–400 | ~850 | ~215 |
| Large | 500–1,500 | 25–60 | 5–12 | 400–1,100 | ~2,100 | ~500 |
| Network | 1,500+ | 60+ | 12+ | 1,100+ | 2,600+ | ~1,000 |

**Average Ghana private basic school**: ~250–350 students, ~15 teachers, ~4 admin.

### MAU Estimation (% of users logging in monthly)

| Role | Monthly Activity Rate |
|------|----------------------|
| Admin | ~100% |
| Teachers | ~90–95% |
| Students (portal) | ~30–50% |
| Parents (portal) | ~20–35% |

---

## 3. External Service Cost Reference

These are the services EduSentrix currently depends on. The platform admin dashboard should display spend for each.

| Service | Purpose | Pricing Model | Files in Codebase |
|---------|---------|---------------|-------------------|
| **Clerk** | Authentication & user management | Free: 10,000 MAU. Pro: $25/mo + $0.02/MAU | `src/app/api/webhooks/clerk/route.ts` |
| **MongoDB Atlas** | Database | M0 free (512MB). M10: ~$57/mo. M30: ~$310/mo. M50: ~$700/mo | `src/db/connectToDatabase.ts` |
| **UploadThing** | File storage (photos, docs) | Free: 2GB. Pro: $10/mo (100GB) | `src/lib/uploadthing/` |
| **OpenAI** | AI lesson notes, student insights | GPT-4o-mini: ~$0.15/1M input, ~$0.60/1M output tokens | `src/app/api/teacher/lesson-notes/ai/`, `src/app/api/admin/students/[id]/academics/ai-insights/` |
| **Brevo** | Transactional email | Free: 300/day. Starter: $9/mo (5K/mo) | `src/lib/email/brevo.ts` |
| **Paystack** | Payment processing | 1.95% per GHS transaction (capped GHS 50) | `src/lib/paystack.ts` |
| **Svix** | Webhook delivery | Free: 50K msg/mo. Starter: $50/mo | `src/app/api/webhooks/clerk/route.ts` |
| **Cloudinary** | Legacy image storage | Free tier / Plus $89/mo | `src/lib/cloudinary.ts` |
| **Vercel** | Hosting & serverless | Pro: $20/mo per seat | `next.config.ts` |

### Per-School Infrastructure Cost (Converges to ~$8–10/school/month at scale)

| Scale | Clerk | MongoDB | UploadThing | OpenAI | Vercel | Brevo | Total | Per School |
|-------|-------|---------|-------------|--------|--------|-------|-------|------------|
| 10 schools | $0 | $57 | $0 | $2 | $20 | $0 | ~$79 | ~$8 |
| 50 schools | $39 | $310 | $10 | $8 | $40 | $9 | ~$416 | ~$8 |
| 200 schools | $681 | $700 | $30 | $35 | $80 | $18 | ~$1,594 | ~$8 |
| 500 schools | $1,965 | $1,500 | $80 | $100 | $160 | $45 | ~$3,900 | ~$8 |

---

## 4. Subscription Tiers

### 4.1 Default Tier Configuration

> **IMPORTANT**: These are DEFAULT and TEMPORARY pilot-era values. The platform admin must be able to edit all of these from the UI. Store them in the database, not hardcoded. Final public pricing is subject to review after the pilot program closes and cost analysis is complete.

| | Starter | Standard | Premium | Enterprise |
|---|---------|----------|---------|------------|
| **Monthly (GHS)** | 350 | 750 | 1,500 | 3,500+ |
| **Annual (GHS)** | 3,500 | 7,500 | 15,000 | Custom |
| **Annual discount** | 2 months free | 2 months free | 2 months free | Negotiable |
| **Free trial** | 1 month | 1 month | 1 month | 1 month |
| **Max students** | 150 | 500 | 1,500 | Unlimited (-1) |
| **Max teachers** | 10 | 25 | -1 (unlimited) | -1 |
| **Max admin users** | 2 | 5 | 10 | -1 |
| **Max storage (GB)** | 2 | 20 | 100 | -1 |
| **AI calls/month** | 0 | 0 | 50 | -1 |
| **Invitations/month** | 50 | 200 | -1 | -1 |
| **Emails/month** | 100 | 500 | 2,000 | -1 |

> Use `-1` to represent "unlimited" in the database.

### 4.2 Feature Matrix

Each feature has a unique string key. The tier config stores an array of allowed feature keys.

```
FEATURE KEYS (for reference — store in DB as an array of strings on each tier)
─────────────────────────────────────────────────────────────────────
CORE (included in all tiers):
  "students"              — Student management (CRUD, card/table views)
  "teachers"              — Teacher management (CRUD, card/table views)
  "classes"               — Class group management
  "subjects"              — Subject management
  "periods"               — Academic period management
  "gradebook_basic"       — Basic gradebook (record grades)
  "attendance_basic"      — Basic attendance (homeroom)
  "reports_basic"         — Basic reports (CSV export only)
  "timetable"             — Master timetable
  "invitations"           — User invitations

STANDARD+ (Standard tier and above):
  "fees"                  — Fees & invoicing
  "payments"              — Payment collection (Paystack)
  "financial_center"      — Unified financial dashboard
  "expenses"              — Expense management
  "teacher_portal"        — Teacher portal access
  "lesson_notes_simple"   — Quick Note template only
  "teacher_studio"        — Assignments, quizzes, rubrics
  "parent_portal_view"    — Parent portal (view only)
  "calendar"              — Academic calendar
  "offline_support"       — Offline mutation queue
  "print_export"          — Print & PDF export

PREMIUM+ (Premium tier and above):
  "lesson_notes_all"      — All lesson note templates (NaCCA, Classic JHS)
  "ai_lesson_notes"       — AI-powered lesson note generation
  "ai_student_insights"   — AI academic insights per student
  "advanced_analytics"    — Advanced charts & analytics
  "community_hub"         — Polls & fundraising campaigns
  "student_portal"        — Student portal access
  "parent_portal_full"    — Parent portal (full features)
  "approval_workflow"     — Lesson note approval workflow
  "bulk_operations"       — Bulk import/export/actions
  "period_attendance"     — Period-based attendance

ENTERPRISE ONLY:
  "api_access"            — External API access
  "multi_campus"          — Multi-campus/branch management
  "white_label"           — Custom branding / white-label
  "sla_guarantee"         — SLA guarantee
  "custom_integrations"   — Custom integrations support
  "dedicated_support"     — Dedicated account manager
```

### 4.3 Special Tiers

| Tier Key | Purpose | Behavior |
|----------|---------|----------|
| `pilot` | Pilot program schools | All features unlocked, full usage metering, no billing |
| `custom` | Manually configured schools | Platform admin sets features/limits individually |
| `suspended` | Suspended accounts | No access, data preserved, show "Account Suspended" screen |

### 4.4 Temporary Tier Policy During Pilot

- `starter`, `standard`, `premium`, and `enterprise` are provisional until the pilot program is reviewed.
- Platform admin must be able to change prices, limits, and included features without schema changes.
- Early paid schools may require negotiated exceptions while the pricing model is still being calibrated.
- The pilot closeout process should produce pricing and limit recommendations before these tiers are treated as final public offers.

---

## 5. Data Models

### 5.1 `SubscriptionTier` (New Model)

Stores the tier definitions. Platform admin edits these. One document per tier.

```
File: src/models/SubscriptionTier.ts

SubscriptionTier {
  _id: ObjectId
  key: string                    // "starter", "standard", "premium", "enterprise", "pilot", "custom"
  name: string                   // "Starter", "Standard", "Premium", "Enterprise"
  description: string            // Marketing description
  isActive: boolean              // Can new schools subscribe to this tier?
  isPublic: boolean              // Show on public pricing page?
  sortOrder: number              // Display order (0, 1, 2, 3)
  
  // Pricing
  pricing: {
    currency: string             // "GHS"
    monthlyPrice: number         // e.g., 350 (in minor units or major — pick one, document it)
    annualPrice: number          // e.g., 3500
    annualDiscountLabel: string  // "2 months free"
  }
  
  // Trial
  trialDays: number              // 30 (1 month free trial)
  
  // Limits (-1 = unlimited)
  limits: {
    maxStudents: number          // 150
    maxTeachers: number          // 10
    maxAdminUsers: number        // 2
    maxStorageGB: number         // 2
    maxAICallsPerMonth: number   // 0
    maxInvitationsPerMonth: number // 50
    maxEmailsPerMonth: number    // 100
  }
  
  // Features (array of feature key strings)
  features: string[]             // ["students", "teachers", "classes", ...]
  
  // Support level
  supportLevel: "community" | "email" | "priority" | "dedicated"
  
  // Metadata
  createdAt: Date
  updatedAt: Date
}

Indexes:
  - { key: 1 } (unique)
  - { isActive: 1, isPublic: 1 }
  - { sortOrder: 1 }
```

### 5.2 `SchoolSubscription` (New Model)

One document per school. Tracks the school's current subscription state.

```
File: src/models/SchoolSubscription.ts

SchoolSubscription {
  _id: ObjectId
  schoolId: ObjectId             // ref: "School" (unique index)
  
  // Current tier
  tierId: ObjectId               // ref: "SubscriptionTier"
  tierKey: string                // Denormalized: "starter", "standard", etc.
  
  // Status
  status: "trialing" | "active" | "past_due" | "suspended" | "cancelled"
  
  // Trial
  trialStartDate: Date
  trialEndDate: Date             // trialStartDate + trialDays
  trialConverted: boolean        // Did they convert to paid after trial?
  
  // Billing cycle
  billingCycle: "monthly" | "annual"
  currentPeriodStart: Date
  currentPeriodEnd: Date
  
  // Manual overrides (platform admin can override any limit/feature)
  overrides: {
    maxStudents?: number
    maxTeachers?: number
    maxAdminUsers?: number
    maxStorageGB?: number
    maxAICallsPerMonth?: number
    maxInvitationsPerMonth?: number
    maxEmailsPerMonth?: number
    additionalFeatures?: string[]    // Features added on top of tier
    removedFeatures?: string[]       // Features removed from tier
    note?: string                    // Admin note for why override exists
  }
  
  // Manual commercial controls (platform admin can negotiate per school)
  commercial: {
    customPriceMonthly?: number | null
    customPriceAnnual?: number | null
    discountType?: "percentage" | "fixed" | "waiver" | null
    discountValue?: number | null
    discountReason?: string | null
    discountStartsAt?: Date | null
    discountEndsAt?: Date | null
    // Discounts apply to subscription only; they do not modify transaction fees.
    transactionFeeMode?: "school_pays_default" | "school_pays_custom"
    transactionFeeAppliesTo?: Array<"parent_to_school" | "school_to_teacher" | "school_to_vendor">
    transactionFeePercent?: number | null
    transactionFeeFlat?: number | null
    transactionFeeCap?: number | null
    transactionFeeNotes?: string | null
    manualBillingNotes?: string | null
  }
  
  // Payment
  paymentMethod: "paystack" | "bank_transfer" | "manual" | null
  paystackSubscriptionCode: string | null
  paystackCustomerCode: string | null
  lastPaymentDate: Date | null
  lastPaymentAmount: number | null
  nextPaymentDate: Date | null
  
  // Suspension
  suspendedAt: Date | null
  suspendedBy: ObjectId | null   // ref: "User" (platform admin)
  suspendedReason: string | null
  
  // Cancellation
  cancelledAt: Date | null
  cancelRequestedAt: Date | null
  cancelReason: string | null
  
  // Change history (last tier change)
  previousTierKey: string | null
  tierChangedAt: Date | null
  tierChangedBy: ObjectId | null // ref: "User"
  tierChangeReason: string | null
  
  createdAt: Date
  updatedAt: Date
}

Indexes:
  - { schoolId: 1 } (unique)
  - { status: 1 }
  - { tierKey: 1 }
  - { trialEndDate: 1 }  // For trial expiry cron
  - { currentPeriodEnd: 1 }  // For billing cycle checks
  - { "overrides.note": 1 } // For searching overridden schools
```

### 5.3 `UsageMetric` (New Model)

Tracks per-school resource consumption. Critical for pilot phase and for enforcing limits.

```
File: src/models/UsageMetric.ts

UsageMetric {
  _id: ObjectId
  schoolId: ObjectId             // ref: "School"
  
  // What was consumed
  metricType: string             // See metric types below
  category: string               // Module/feature area or billing dimension
  provider: string | null        // "clerk" | "mongodb" | "vercel" | "paystack" | "platform" | etc.
  
  // How much
  value: number                  // Count, bytes, tokens, etc.
  unit: string                   // "count" | "bytes" | "tokens" | "ghs" | "requests" | etc.
  
  // Estimated cost attribution
  estimatedCost: number | null   // Cost attributed to this usage record
  currency: string | null        // "USD" | "GHS"
  attributionMethod: "direct" | "allocated" | "estimated"
  
  // Context
  metadata: Mixed                // Extra info (endpoint, userId, model, etc.)
  
  // Time bucket (for aggregation)
  date: Date                     // Truncated to day (YYYY-MM-DD 00:00:00)
  
  createdAt: Date
}

Metric Types:
  "auth_mau"         — Monthly active users attributable to a school
  "api_request"      — API call count (category = endpoint group)
  "db_read"          — Database read operations
  "db_write"         — Database write operations
  "db_storage_bytes" — Database storage footprint estimate
  "storage_bytes"    — File storage consumed (value = bytes)
  "ai_tokens_input"  — OpenAI input tokens (category = "lesson_notes" | "student_insights")
  "ai_tokens_output" — OpenAI output tokens
  "ai_call"          — Individual AI API call count
  "email_sent"       — Transactional emails sent
  "login"            — User logins (category = role)
  "file_upload"      — File upload count (category = file type)
  "invitation_sent"  — Invitations sent
  "report_export"    — Report/CSV exports
  "feature_use"      — Feature access (category = feature key)
  "paystack_txn"     — Paystack transactions (value = amount in pesewas)
  "edusentrix_txn_fee_revenue" — EduSentrix transaction fee charged to the school
  "processor_fee_cost" — Payment processor fee charged by the gateway
  "hosting_request"  — Vercel/edge request volume
  "hosting_bandwidth_bytes" — Vercel bandwidth attributable to the school
  "platform_job_run" — Internal background job usage attributable to the school

Indexes:
  - { schoolId: 1, metricType: 1, date: 1 }  // Primary query pattern
  - { schoolId: 1, date: 1 }                  // School daily summary
  - { date: 1 }                               // Global daily aggregation
  - { metricType: 1, date: 1 }                // Metric-specific trends
```

### 5.4 `SubscriptionEvent` (New Model)

Audit log of all subscription-related events.

```
File: src/models/SubscriptionEvent.ts

SubscriptionEvent {
  _id: ObjectId
  schoolId: ObjectId             // ref: "School"
  
  eventType: string
    // "trial_started" | "trial_ended" | "trial_converted"
    // | "tier_changed" | "tier_upgraded" | "tier_downgraded"
    // | "payment_received" | "payment_failed"
    // | "suspended" | "reactivated" | "cancelled"
    // | "override_added" | "override_removed"
    // | "discount_set" | "discount_updated" | "discount_removed"
    // | "transaction_fee_set" | "transaction_fee_updated" | "transaction_fee_removed"
    // | "manual_price_set"
    // | "payout_destination_change_requested" | "payout_destination_changed"
    // | "limit_reached" | "limit_warning"
  
  actorId: ObjectId | null       // ref: "User" (who triggered this, null = system)
  actorRole: string | null       // "platform_admin" | "school_admin" | "system"
  
  details: Mixed                 // Event-specific data
    // For tier_changed: { fromTier, toTier, reason }
    // For payment_received: { amount, currency, method, reference }
    // For suspended: { reason }
    // For discount_set: { type, value, startsAt, endsAt, reason }
    // For transaction_fee_updated: { mode, percent, flat, cap, note }
    // For payout_destination_changed: { destinationType, channel, maskedAccount, changedBy }
    // For limit_reached: { metricType, currentValue, limit }
  
  createdAt: Date
}

Indexes:
  - { schoolId: 1, createdAt: -1 }
  - { eventType: 1, createdAt: -1 }
```

### 5.5 `ServiceCostEntry` (New Model)

Platform admin manually records or the system auto-records monthly service costs.

```
File: src/models/ServiceCostEntry.ts

ServiceCostEntry {
  _id: ObjectId
  
  service: string                // "clerk" | "mongodb" | "uploadthing" | "openai" | "brevo" | "paystack" | "svix" | "vercel" | "cloudinary" | "platform_internal"
  
  // Period
  month: number                  // 1-12
  year: number                   // 2026
  
  // Cost
  amount: number                 // In USD (or primary currency)
  currency: string               // "USD"
  
  // Details
  details: Mixed                 // Service-specific breakdown
    // For Clerk: { totalMAU, freeMAU, paidMAU, baseFee, perUserFee }
    // For MongoDB: { clusterTier, storageGB, opsPerSecond }
    // For OpenAI: { totalTokens, inputTokens, outputTokens }
    // For Paystack: { totalVolumeMinor, processorFeesMinor, settlementCount }
    // etc.
  
  // Allocation
  allocation: {
    method: "direct" | "weighted_usage" | "per_school_flat" | "manual"
    driver: string | null        // "mau" | "storage_bytes" | "request_count" | etc.
    schoolBreakdown?: Array<{
      schoolId: ObjectId
      usageAmount: number
      allocatedCost: number
      note?: string
    }>
  }
  
  sourceReference: string | null // Provider invoice ID, statement reference, or import batch ID
  
  // Entry method
  entryMethod: "manual" | "auto" // Did platform admin enter this or was it auto-fetched?
  enteredBy: ObjectId | null     // ref: "User" (if manual)
  
  createdAt: Date
  updatedAt: Date
}

Indexes:
  - { service: 1, year: 1, month: 1 } (unique compound)
  - { year: 1, month: 1 }
```

### 5.6 `PlatformPayoutConfig` (New Model)

Stores the platform-level destinations where money should be routed. This is separate from school settlement configuration.

```
File: src/models/PlatformPayoutConfig.ts

PlatformPayoutConfig {
  _id: ObjectId

  // Subscription fee revenue goes here
  subscriptionRevenueDestination: {
    channel: "bank_account" | "mobile_money"
    accountName: string
    bankCode?: string | null
    bankName?: string | null
    accountNumber?: string | null
    phoneNumber?: string | null
    provider?: string | null
    metadata?: Mixed
  }

  // EduSentrix transaction fee revenue goes here
  transactionFeeRevenueDestination: {
    channel: "bank_account" | "mobile_money"
    accountName: string
    bankCode?: string | null
    bankName?: string | null
    accountNumber?: string | null
    phoneNumber?: string | null
    provider?: string | null
    metadata?: Mixed
  }

  // Security and audit
  lastChangedAt: Date | null
  lastChangedBy: ObjectId | null   // ref: "User"
  lastVerifiedAt: Date | null      // successful 2FA verification time
  lastVerificationMethod: "sms_otp" | "voice_otp" | null
  changeReason: string | null

  createdAt: Date
  updatedAt: Date
}

Indexes:
  - { updatedAt: -1 }
```

---

## 6. Feature Gating System

### 6.1 Server-Side: `requireFeature()` Middleware

```
File: src/lib/auth/requireFeature.ts

Purpose: Check if the current school's subscription includes a feature before
         allowing access to an API route.

Usage in API routes:
  const featureCheck = await requireFeature("fees");
  if (!featureCheck.ok) return featureCheck.res; // Returns 403 with upgrade info

Implementation:
  1. Get schoolId from the authenticated user (via requireSchoolMember or requireTeacher)
  2. Fetch SchoolSubscription for that schoolId (use in-memory cache, 60s TTL)
  3. Fetch the SubscriptionTier referenced by tierId
  4. Merge tier features with overrides (additionalFeatures adds, removedFeatures removes)
  5. Check if the requested feature key is in the merged features list
  6. If not → return 403 JSON: { error: "Feature not available", upgradeRequired: true, feature: "fees", currentTier: "starter" }
  7. If yes → return { ok: true, subscription, tier }
```

### 6.2 Server-Side: `checkLimit()` Helper

```
File: src/lib/auth/checkLimit.ts

Purpose: Check if a school has exceeded a numeric limit before allowing a
         create/write operation.

Usage:
  const limitCheck = await checkLimit(schoolId, "maxStudents");
  if (!limitCheck.ok) return limitCheck.res; // Returns 403 with limit info

Implementation:
  1. Get SchoolSubscription + SubscriptionTier for schoolId
  2. Determine effective limit: override value ?? tier limit
  3. If limit === -1 → unlimited, always pass
  4. Get current count (e.g., Student.countDocuments({ schoolId, status: "active" }))
  5. If current >= limit → return 403 JSON:
     { error: "Limit reached", limitType: "maxStudents", current: 150, limit: 150, currentTier: "starter" }
  6. If under → return { ok: true, current, limit, remaining }
```

### 6.3 Server-Side: `trackUsage()` Helper

```
File: src/lib/billing/trackUsage.ts

Purpose: Record a usage metric for a school. Called from API routes, jobs, etc.

Usage:
  await trackUsage(schoolId, "ai_call", 1, { category: "lesson_notes", model: "gpt-4o-mini" });
  await trackUsage(schoolId, "email_sent", 1, { category: "invitation" });
  await trackUsage(schoolId, "storage_bytes", file.size, { category: "avatar" });

Implementation:
  1. Truncate current time to day boundary
  2. Upsert UsageMetric: findOneAndUpdate with $inc on value
     Filter: { schoolId, metricType, date: truncatedDate, category }
     Update: { $inc: { value }, $set: { metadata } }
     Options: { upsert: true }
  3. Fire-and-forget (don't await in critical paths, or use a lightweight queue)
```

### 6.4 Client-Side: `useSubscription()` Hook

```
File: src/hooks/useSubscription.ts

Purpose: Fetch the current school's subscription state and provide feature/limit
         checking utilities for the UI.

Returns:
  {
    subscription: SchoolSubscription | null
    tier: SubscriptionTier | null
    isLoading: boolean
    
    // Helpers
    hasFeature: (featureKey: string) => boolean
    getLimit: (limitKey: string) => number  // -1 = unlimited
    isTrialing: boolean
    trialDaysRemaining: number
    isSuspended: boolean
    
    // For upgrade prompts
    currentTierKey: string
    suggestedUpgradeTier: string | null
  }

Data source: GET /api/subscription/current (cached, 5 min stale time)
```

### 6.5 Client-Side: `<FeatureGate>` Component

```
File: src/components/billing/FeatureGate.tsx

Purpose: Conditionally render children based on feature availability.

Usage:
  <FeatureGate feature="fees" fallback={<UpgradePrompt feature="fees" />}>
    <FeesPage />
  </FeatureGate>

  <FeatureGate feature="ai_lesson_notes">
    <AIGenerateButton />  {/* Simply hidden if not available */}
  </FeatureGate>

Props:
  feature: string          // Feature key to check
  fallback?: ReactNode     // What to show if feature is not available (default: null)
  showUpgradePrompt?: boolean  // Show a styled upgrade card (default: false)
  children: ReactNode
```

### 6.6 Client-Side: `<LimitIndicator>` Component

```
File: src/components/billing/LimitIndicator.tsx

Purpose: Show current usage vs. limit with progress bar and upgrade prompt when near/at limit.

Usage:
  <LimitIndicator limitKey="maxStudents" currentCount={studentCount} />

Renders:
  - If under 80%: subtle indicator "142 / 150 students"
  - If 80-99%: amber warning "148 / 150 students — nearing limit"
  - If at limit: red block "150 / 150 students — upgrade to add more"
  - If unlimited: nothing (or "Unlimited" badge)
```

### 6.7 Sidebar & Navigation Gating

The admin sidebar (`AdminSidebar.tsx`), teacher sidebar, parent sidebar, and student layout should all use `hasFeature()` to show/hide navigation items.

```
Implementation approach:
  1. In each sidebar component, wrap nav items with feature checks
  2. Items for locked features should either:
     a. Be hidden entirely, OR
     b. Be shown with a lock icon and "Premium" badge, linking to upgrade page
  3. Recommendation: Option (b) for discoverability — let schools SEE what they're missing
```

---

## 7. Usage Metering & Pilot Tracking

### 7.1 Where to Instrument Usage Tracking

Add `trackUsage()` calls at these points in the codebase:

| Metric | Where to Add | Category |
|--------|-------------|----------|
| `api_request` | Global API middleware (or per-route-group) | Route group name |
| `ai_call` | `src/app/api/teacher/lesson-notes/ai/generate/route.ts` | `"lesson_notes"` |
| `ai_call` | `src/app/api/admin/students/[id]/academics/ai-insights/route.ts` | `"student_insights"` |
| `ai_tokens_input` | Same as above, after OpenAI call | model name |
| `ai_tokens_output` | Same as above, after OpenAI call | model name |
| `email_sent` | `src/lib/email/brevo.ts` → `sendEmail()` | template key |
| `storage_bytes` | UploadThing `onUploadComplete` callback | file type |
| `file_upload` | Same | file type |
| `login` | `src/app/api/webhooks/clerk/route.ts` on `session.created` | user role |
| `invitation_sent` | `src/app/api/admin/invitations/route.ts` POST | role type |
| `report_export` | `src/app/api/admin/reports/export/route.ts` | report category |
| `feature_use` | Each feature's main page/API (first access per day) | feature key |
| `paystack_txn` | `src/app/api/webhooks/paystack/route.ts` | transaction type |
| `payment_fee` | `src/app/api/webhooks/paystack/route.ts` | fee type / settlement channel |
| `auth_mau` | Monthly aggregation job from Clerk users/events | billing month |
| `db_read` / `db_write` | DB-heavy route groups or repository wrappers | model/route group |
| `db_storage_bytes` | Daily aggregation job (document/file ownership estimate) | collection or feature |
| `hosting_request` | Request middleware or Vercel analytics import | route group |
| `hosting_bandwidth_bytes` | Vercel analytics import job | route group / asset group |
| `platform_job_run` | Internal cron/job wrappers | job key |

### 7.2 Usage Aggregation

For the platform admin dashboard, provide aggregated views:

```
GET /api/platform/usage/summary?schoolId=X&period=monthly&year=2026&month=2

Returns:
{
  school: { _id, name },
  period: { year: 2026, month: 2 },
  metrics: {
    api_requests: 12450,
    ai_calls: 23,
    ai_tokens: { input: 45000, output: 18000 },
    emails_sent: 87,
    storage_bytes: 524288000,  // 500MB
    file_uploads: 45,
    logins: { admin: 120, teacher: 450, student: 890, parent: 320 },
    invitations_sent: 12,
    report_exports: 8,
	    paystack_transactions: { count: 45, volume_ghs: 125000 }
	  },
	  estimatedCost: {
	    clerk: 5.32,       // Based on MAU allocation
	    mongodb: 0.45,     // Based on storage + DB ops estimate
	    vercel: 0.20,      // Based on hosting requests + bandwidth
	    uploadthing: 0.05, // Based on storage
	    openai: 0.02,      // Based on tokens
	    brevo: 0.15,       // Based on emails
	    paystackProcessor: 1.40,    // Processor fee cost only
	    platformInternal: 0.55, // Shared internal overhead allocation
	    total: 8.14
	  },
	  revenueSignals: {
	    subscriptionRevenue: 637.5,
	    edusentrixTransactionFeeRevenue: 94.5,
	    netAfterProcessorFees: 730.6
	  }
	}
	```

### 7.3 Cost Attribution Rules

To make pricing decisions safely, usage tracking must support both **direct attribution** and **shared-cost allocation**:

- **Direct attribution**
  - Use when a provider cost is already attributable to one school's actions.
  - Examples: Paystack processor fees, OpenAI token usage, file storage attached to a school's assets.
- **Allocated shared costs**
  - Use when the cost is shared and must be distributed by a rational driver.
  - Examples: Clerk MAU, MongoDB cluster cost, Vercel hosting, internal platform overhead.
- **Allocation output**
  - Every monthly cost run should produce:
    - per-school usage totals by provider
    - per-school allocated cost by provider
    - total estimated cost-to-serve per school
    - margin estimate against the school's effective subscription revenue

Recommended default allocation drivers:

| Service | Default Driver | Notes |
|---------|----------------|-------|
| Clerk | `auth_mau` | Allocate by attributable monthly active users |
| MongoDB | `db_storage_bytes` + weighted `db_read/db_write` | Combine storage share and operation weight |
| Vercel | `hosting_request` + `hosting_bandwidth_bytes` | Blend request volume and egress |
| UploadThing / Cloudinary | `storage_bytes` | Direct or near-direct by owned assets |
| OpenAI | `ai_tokens_input` + `ai_tokens_output` | Direct attribution |
| Brevo | `email_sent` | Direct attribution |
| Paystack processor cost | `processor_fee_cost` / `paystack_txn` | Direct attribution |
| EduSentrix transaction fee revenue | `edusentrix_txn_fee_revenue` | Direct attribution |
| Platform internal overhead | Active school count or weighted usage score | Manual/admin-defined if needed |

### 7.4 Limit Enforcement Points

When tracking usage, also enforce per-month limits:

| Limit | Where Enforced | How |
|-------|---------------|-----|
| `maxStudents` | `POST /api/admin/students` | `checkLimit(schoolId, "maxStudents")` — count active students |
| `maxTeachers` | `POST /api/admin/teachers/create` | `checkLimit(schoolId, "maxTeachers")` — count active teachers |
| `maxAdminUsers` | `POST /api/admin/invitations` (role=school_admin) | Count users with school_admin role |
| `maxStorageGB` | UploadThing `onUploadComplete` | Sum all `storage_bytes` metrics for school |
| `maxAICallsPerMonth` | AI generation routes | Count `ai_call` metrics for current month |
| `maxInvitationsPerMonth` | `POST /api/admin/invitations` | Count `invitation_sent` for current month |
| `maxEmailsPerMonth` | `sendEmail()` wrapper | Count `email_sent` for current month |

---

## 8. Platform Admin Dashboard

### 8.1 New Pages Under `/platform`

```
/platform                          — Overview (UPDATE existing placeholder)
/platform/schools                  — School directory with subscription info (UPDATE)
/platform/billing                  — Billing & subscription management (NEW)
/platform/billing/tiers            — Tier configuration editor (NEW)
/platform/billing/tiers/[id]       — Edit individual tier (NEW)
/platform/billing/costs            — Service cost tracker (NEW)
/platform/billing/revenue          — Revenue & analytics (NEW)
/platform/schools/[id]             — Individual school detail (NEW)
/platform/schools/[id]/subscription — School subscription management (NEW)
/platform/schools/[id]/usage       — School usage metrics (NEW)
/platform/pilot                    — Pilot program dashboard (NEW)
```

`/platform/billing` should act as the operations landing page for:

- global default transaction fee policy
- subscription fee payout destination
- EduSentrix transaction fee payout destination
- payout account verification status
- links to tiers, cost tracking, and revenue analytics

### 8.2 Platform Overview Page (`/platform`) — UPDATE

Add to the existing placeholder:

```
KPI Cards:
  - Total Schools (active / trialing / suspended)
  - MRR (Monthly Recurring Revenue in GHS)
  - Total Users (across all schools)
  - Infrastructure Cost (current month, from ServiceCostEntry)
  - Gross Margin ((MRR - InfraCost) / MRR × 100)
  - Schools Approaching Trial End (next 7 days)

Quick Actions:
  - View Pending Applications
  - View Schools Needing Attention (payment failed, trial expiring, limit warnings)
  - Record Service Cost
  - View Pilot Insights
  - Review Margin Alerts
  - Run / Re-run Pilot Closeout Analysis
  - Update Payout Accounts

Charts:
  - School growth over time (line)
  - Revenue trend (area)
  - Tier distribution (pie)
  - Infrastructure cost trend (line)
```

### 8.3 School Directory (`/platform/schools`) — UPDATE

Enhance the schools list with subscription columns:

```
Table Columns:
  - School Name
  - Type (Basic / SHS)
  - Status (active / pending / deactivated)
  - Subscription Tier (badge: Starter/Standard/Premium/Enterprise/Pilot)
  - Subscription Status (badge: trialing/active/past_due/suspended/cancelled)
  - Trial Ends (if trialing, show days remaining)
  - Students (current / limit)
  - Teachers (current / limit)
  - MRR Contribution (GHS)
  - Last Active (date)

Filters:
  - Tier filter
  - Subscription status filter
  - Search by school name

Actions per row:
  - View Details
  - Change Tier
  - Set Discount
  - Configure Transaction Fees
  - Suspend / Reactivate
  - Override Limits
```

### 8.4 School Detail Page (`/platform/schools/[id]`)

```
Tabs:
  1. Overview
     - School info (name, type, region, status)
     - Current subscription card (tier, status, dates, payment info)
     - Resource usage summary (students, teachers, storage, AI calls)
     
	 2. Subscription
	     - Current tier details
	     - Tier change history (SubscriptionEvent timeline)
	     - Manual tier change form
	     - Manual pricing controls (custom monthly/annual amount if negotiated)
	     - Discount editor (set, adjust, remove)
	     - Transaction fee policy editor (set, adjust, remove)
	     - Show fee scope explicitly: parent collections, teacher payouts, vendor payouts
	     - Override editor (set custom limits, add/remove features)
	     - Suspend / Reactivate buttons
	     - Cancel subscription
     
  3. Usage
     - Usage metrics charts (per metric type, filterable by date range)
     - Daily/weekly/monthly aggregation toggle
     - Estimated cost breakdown by provider (Clerk, MongoDB, Vercel, Paystack, platform, etc.)
     - Usage amount + cost allocation method per provider
     - Usage vs. limit indicators
     
  4. Billing History
     - Payment history from SubscriptionEvent (payment_received, payment_failed)
     - Manual payment recording form
     - Commercial adjustment history (discounts, fee changes, manual price changes)
     
  5. Activity
     - Full SubscriptionEvent timeline for this school
```

### 8.5 Tier Configuration Editor (`/platform/billing/tiers`)

```
Layout:
  - Banner: "Current tier prices are provisional until pilot closeout review is approved."
  - Card grid showing all tiers (sortable by sortOrder)
  - Each card shows: name, price, student limit, feature count, status (active/inactive)
  - "Create New Tier" button
  - Click card → edit page

Edit Page (/platform/billing/tiers/[id]):
  Form fields:
    - Key (read-only after creation)
    - Name (editable)
    - Description (rich text or plain)
    - Is Active (toggle)
    - Is Public (toggle — show on pricing page?)
    - Sort Order (number)
    - Pricing section: monthly price, annual price, discount label, currency
    - Trial Days (number)
    - Limits section: each limit as a number input (-1 = unlimited)
    - Features section: checkbox grid of all feature keys
    - Support Level: dropdown (community, email, priority, dedicated)
  
  Actions:
    - Save
    - Delete (only if no schools are on this tier)
    - Duplicate (create a copy with key "copy-of-X")
    
  Preview:
    - Side panel showing how the tier card would look on a pricing page
```

### 8.6 Service Cost Tracker (`/platform/billing/costs`)

```
Layout:
  - Month/Year selector
  - Table: Service | Amount (USD) | Allocation Method | Details | Entry Method | Entered By | Actions
  - "Add Cost Entry" button → modal with:
    - Service dropdown
    - Month/Year
    - Amount
    - Currency
    - Details (JSON editor or structured form per service)
    - Allocation method
    - Allocation driver
    - Optional invoice / reference ID
  - "Sync Provider Costs" action (where provider APIs or manual imports are supported)
  - Summary row: Total infrastructure cost for the month
  - Chart: Monthly cost trend per service (stacked area chart)
  - Per-school cost calculation: Total cost / active schools
  - Per-school allocated cost breakdown drawer (which schools consumed what)
```

### 8.7 Revenue Dashboard (`/platform/billing/revenue`)

```
KPI Cards:
  - MRR (Monthly Recurring Revenue)
  - Realized MRR (after discounts and waivers)
  - EduSentrix Transaction Fee Revenue
  - ARR (Annual Recurring Revenue = MRR × 12)
  - ARPS (Average Revenue Per School = MRR / active paying schools)
  - Gross Margin (%)
  - Net Revenue (MRR - Infrastructure Cost)
  - Churn Rate (cancelled in last 30 days / total at start)
  - Discount Exposure (total revenue reduced by active discounts)
  - Processor Fee Cost
  - Net Payment Margin (EduSentrix transaction fee revenue minus processor cost)

Charts:
  - Revenue trend (line, monthly)
  - Revenue by tier (stacked bar)
  - Margin by tier (bar)
  - Trial → Paid conversion rate (funnel)
  - Infrastructure cost vs. revenue (dual axis)
  - Projected breakeven analysis
  - Expansion vs. downgrade trend
  
Tables:
  - Revenue breakdown by tier (count, MRR, percentage)
  - Top 10 schools by revenue
  - Top 10 schools by EduSentrix transaction fee revenue
  - Bottom 10 schools by margin (highest loss risk)
  - Schools with payment failures
  - Schools with active discounts / custom fee rules
```

### 8.8 Pilot Dashboard (`/platform/pilot`)

```
Only visible when there are schools with tier="pilot".

KPI Cards:
  - Active Pilot Schools
  - Total Pilot Users
  - Average Resource Usage Per School
  - Estimated Monthly Cost Per School (if they were paying)
  - Schools Below Price Floor (estimated cost > proposed revenue)

Per-School Comparison Table:
  - School Name | Students | Teachers | MAU | Storage | AI Calls | Emails | Est. Cost | Proposed Revenue | Margin | Suggested Tier

Charts:
  - Resource usage heatmap by school (rows) × metric (columns)
  - Feature adoption chart (which features are used most/least)
  - Cost projection: "If these schools were on [Tier], revenue would be X"
  - Price floor recommendation by school

Export:
  - CSV export of pilot data for analysis

Closeout Actions:
  - Run closeout analysis
  - Save closeout snapshot
  - Generate recommended pricing adjustments
  - Generate list of schools needing manual commercial review
```

---

## 9. API Endpoints

### 9.1 Subscription Tier Management (Platform Admin Only)

```
GET    /api/platform/tiers                    — List all tiers
POST   /api/platform/tiers                    — Create a new tier
GET    /api/platform/tiers/[id]               — Get tier details
PATCH  /api/platform/tiers/[id]               — Update tier
DELETE /api/platform/tiers/[id]               — Delete tier (only if no schools on it)
GET    /api/platform/tiers/feature-keys       — List all available feature keys with descriptions

Auth: requirePlatformAdmin()
```

### 9.2 School Subscription Management (Platform Admin Only)

```
GET    /api/platform/schools/[id]/subscription        — Get school's subscription
PATCH  /api/platform/schools/[id]/subscription        — Update subscription (change tier, status, cycle)
POST   /api/platform/schools/[id]/subscription/override — Set custom overrides
DELETE /api/platform/schools/[id]/subscription/override — Remove overrides
POST   /api/platform/schools/[id]/subscription/discount — Set or update school-specific discount
DELETE /api/platform/schools/[id]/subscription/discount — Remove school-specific discount
POST   /api/platform/schools/[id]/subscription/transaction-fees — Set or update school-specific fee policy
DELETE /api/platform/schools/[id]/subscription/transaction-fees — Remove school-specific fee policy
POST   /api/platform/schools/[id]/subscription/suspend  — Suspend school
POST   /api/platform/schools/[id]/subscription/reactivate — Reactivate school
POST   /api/platform/schools/[id]/subscription/cancel   — Cancel subscription

Payload examples:

PATCH /api/platform/schools/[id]/subscription
{
  "tierKey": "premium",
  "billingCycle": "annual",
  "customPriceAnnual": 12000,
  "reason": "Upgraded during sales call"
}

POST /api/platform/schools/[id]/subscription/override
{
  "maxStudents": 200,               // Override starter limit of 150
  "additionalFeatures": ["fees"],   // Grant fees to a starter school
  "note": "Special arrangement with school owner"
}

POST /api/platform/schools/[id]/subscription/discount
{
  "discountType": "percentage",
  "discountValue": 15,
  "startsAt": "2026-03-01",
  "endsAt": "2026-06-30",
  "reason": "Pilot conversion incentive"
}

POST /api/platform/schools/[id]/subscription/transaction-fees
{
  "transactionFeeMode": "school_pays_custom",
  "transactionFeeAppliesTo": ["parent_to_school", "school_to_teacher", "school_to_vendor"],
  "transactionFeePercent": 1.25,
  "transactionFeeFlat": 0,
  "transactionFeeCap": 30,
  "note": "Preferred payment processing terms"
}

POST /api/platform/schools/[id]/subscription/suspend
{
  "reason": "Non-payment for 3 months"
}

Auth: requirePlatformAdmin()
```

### 9.3 Usage Metrics (Platform Admin Only)

```
GET /api/platform/usage/summary
  Query: schoolId, period (daily|weekly|monthly), year, month, startDate, endDate
  Returns: Aggregated usage metrics for the school/period

GET /api/platform/usage/schools
  Query: period, year, month, sortBy, limit
  Returns: Usage summary for all schools (for comparison table)

GET /api/platform/usage/costs
  Query: year, month
  Returns: ServiceCostEntry records for the period

POST /api/platform/usage/costs
  Body: { service, month, year, amount, currency, details }
  Creates: ServiceCostEntry record

GET /api/platform/usage/revenue
  Query: period (monthly), year, month
  Returns: Revenue analytics (MRR, tier breakdown, trends)

POST /api/platform/usage/costs/sync
  Body: { year, month, services?: ["clerk", "mongodb", "vercel", ...] }
  Action: Pull provider usage/cost data where possible, then store ServiceCostEntry records

POST /api/platform/pilot/closeout
  Body: { periodStart, periodEnd, normalizeToMonthly?: true }
  Action: Generate pilot closeout cost, margin, and pricing recommendations
  Returns: Saved closeout snapshot + recommended tier/price actions

Auth: requirePlatformAdmin()
```

### 9.4 Subscription Events (Platform Admin Only)

```
GET /api/platform/schools/[id]/subscription/events
  Query: limit, offset, eventType
  Returns: SubscriptionEvent records for the school

Auth: requirePlatformAdmin()
```

### 9.5 Current School's Subscription (School Users)

```
GET /api/subscription/current
  Returns: Current school's subscription + tier details + effective limits + features + commercial adjustments
  Auth: Any authenticated school member
  Cache: 5 minutes stale time

  Response:
  {
    subscription: { ... },
    tier: { ... },
    effectiveLimits: {
      maxStudents: 150,       // After overrides applied
      maxTeachers: 10,
      ...
    },
    effectiveFeatures: ["students", "teachers", ...],  // After overrides applied
    usage: {
      students: 142,
      teachers: 8,
      storageGB: 1.2,
      aiCallsThisMonth: 0,
      ...
    },
    effectiveBilling: {
      standardPrice: 750,
      effectivePrice: 637.5,
      currency: "GHS"
    },
    discount: {
      type: "percentage",
      value: 15,
      endsAt: "2026-06-30"
    },
    transactionFeePolicy: {
      mode: "school_pays_custom",
      appliesTo: ["parent_to_school", "school_to_teacher", "school_to_vendor"],
      percent: 1.25,
      flat: 0,
      cap: 30
    },
    isTrialing: true,
    trialDaysRemaining: 15,
    isSuspended: false
  }
```

### 9.6 Public Pricing Page

```
GET /api/public/pricing
  Returns: All active, public tiers with pricing and feature lists
  Auth: None (public endpoint)
  Cache: 1 hour
```

### 9.7 Subscription Self-Service (School Admin)

```
POST /api/subscription/upgrade
  Body: { tierKey: "standard", billingCycle: "monthly" }
  Action: Initiate a Paystack payment for the new tier
  Auth: requireSchoolMember({ roles: ["school_admin"] })

POST /api/subscription/cancel
  Body: { reason: "..." }
  Action: Schedule cancellation at end of current period
  Auth: requireSchoolMember({ roles: ["school_admin"] })
```

### 9.8 Platform Payout Configuration (Platform Admin Only)

```
GET /api/platform/billing/payouts
  Returns: Current subscription-fee and transaction-fee payout destinations

PATCH /api/platform/billing/payouts
  Body: {
    destinationType: "subscription_revenue" | "transaction_fee_revenue",
    destination: {
      channel: "bank_account" | "mobile_money",
      accountName: "...",
      bankCode?: "...",
      accountNumber?: "...",
      phoneNumber?: "..."
    },
    changeReason: "..."
  }
  Action:
    1. Initiate payout destination change
    2. Send OTP to the platform admin's phone number
    3. Store change as pending until verification succeeds

POST /api/platform/billing/payouts/verify
  Body: {
    destinationType: "subscription_revenue" | "transaction_fee_revenue",
    otpCode: "123456"
  }
  Action:
    1. Verify OTP
    2. Commit the payout destination change
    3. Create SubscriptionEvent: "payout_destination_changed"

Auth: requirePlatformAdmin()
```

---

## 10. Frontend Components

### 10.1 New Components to Create

```
src/components/billing/
  ├── FeatureGate.tsx              — Conditional rendering by feature
  ├── LimitIndicator.tsx           — Usage vs limit progress bar
  ├── UpgradePrompt.tsx            — "Upgrade to unlock" card
  ├── SubscriptionBadge.tsx        — Tier badge (Starter, Standard, etc.)
  ├── SubscriptionStatusBadge.tsx  — Status badge (trialing, active, etc.)
  ├── TrialBanner.tsx              — "X days left in your trial" top banner
  ├── SuspendedOverlay.tsx         — Full-screen overlay for suspended schools
  ├── PricingTable.tsx             — Public pricing comparison table
  └── UsageCard.tsx                — Usage metric display card

src/components/platform/
  ├── TierConfigCard.tsx           — Tier card for the config grid
  ├── TierConfigForm.tsx           — Full tier edit form
  ├── SchoolSubscriptionCard.tsx   — Subscription info on school detail
  ├── SchoolCommercialProfileCard.tsx — Effective price, discount, fee policy
  ├── SubscriptionOverrideForm.tsx — Override limits/features form
  ├── DiscountEditorForm.tsx       — Set/update/remove school discount
  ├── TransactionFeePolicyForm.tsx — Set/update/remove per-school payment fee rules
  ├── PlatformPayoutAccountForm.tsx — Configure where subscription vs fee revenue is routed
  ├── PayoutDestinationCard.tsx    — Masked payout account summary card
  ├── TwoFactorChallengeModal.tsx  — OTP confirmation before sensitive payout changes
  ├── ServiceCostForm.tsx          — Add/edit service cost entry modal
  ├── ServiceCostChart.tsx         — Service cost trend chart
  ├── RevenueChart.tsx             — Revenue analytics charts
  ├── MarginBreakdownCard.tsx      — Revenue vs cost breakdown for a school/tier
  ├── UsageHeatmap.tsx             — Per-school usage heatmap
  ├── PilotComparisonTable.tsx     — Pilot schools comparison
  ├── PilotCloseoutReportCard.tsx  — Snapshot of closeout recommendations
  ├── SubscriptionTimeline.tsx     — Event timeline for a school
  └── SchoolSubscriptionActions.tsx — Suspend/reactivate/change tier buttons
```

### 10.2 New Hooks to Create

```
src/hooks/
  ├── useSubscription.ts              — Current school's subscription (for school users)
  └── billing/
      ├── useSubscriptionTiers.ts     — Fetch all tiers (admin)
      ├── useSubscriptionTierMutations.ts — CRUD tiers (admin)
      ├── useSchoolSubscription.ts    — Fetch school subscription (admin)
      ├── useSchoolSubscriptionActions.ts — Suspend/reactivate/override (admin)
      ├── useSchoolCommercialControls.ts — Discount + fee policy mutations (admin)
      ├── usePlatformPayoutSettings.ts — Fetch/update payout destinations with 2FA
      ├── useUsageMetrics.ts          — Fetch usage metrics (admin)
      ├── useServiceCosts.ts          — Fetch/record service costs (admin)
      ├── useRevenueAnalytics.ts      — Revenue data (admin)
      └── usePilotCloseoutAnalysis.ts — Pilot closeout snapshots + reruns
```

---

## 11. School-Facing Subscription UI

### 11.1 Trial Banner

When a school is on trial, show a persistent banner at the top of every page:

```
┌─────────────────────────────────────────────────────────────────┐
│ 🎉 You're on a free trial! 15 days remaining. [Upgrade Now]    │
└─────────────────────────────────────────────────────────────────┘

- Show on all pages for school_admin users
- Color: Blue when > 7 days, Amber when ≤ 7 days, Red when ≤ 3 days
- "Upgrade Now" links to /admin/settings/subscription (or /admin/billing)
```

### 11.2 Suspended Overlay

When a school is suspended, show a full-screen overlay:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│              🔒 Your Account Has Been Suspended                │
│                                                                 │
│   Your school's EduSentrix account has been suspended.          │
│   Reason: Non-payment                                           │
│                                                                 │
│   Please contact support to resolve this issue.                 │
│   [Contact Support]                                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

- This should be checked in the admin/teacher/parent/student layouts
- If subscription.status === "suspended" → show overlay, block all access
- Only platform_admin can lift suspension
```

### 11.3 School Admin Billing Page

Add a new page: `/admin/settings/subscription` (or `/admin/billing`)

```
Sections:
  1. Current Plan
     - Tier name, standard price, effective billed price, billing cycle
     - Status badge
     - Trial info (if trialing)
     - Active discount (if any)
     - Transaction fee policy disclosure
     - Explain that transaction fees apply to:
       - parent payments to the school via EduSentrix
       - school payments to teachers via EduSentrix
       - school payments to vendors via EduSentrix
     
  2. Usage Summary
     - Students: 142 / 150 (progress bar)
     - Teachers: 8 / 10
     - Storage: 1.2 GB / 2 GB
     - AI Calls: 0 / 0 (not available on your plan)
     
  3. Available Plans
     - Pricing table showing all public tiers
     - Current plan highlighted
     - "Upgrade" / "Downgrade" buttons
     
  4. Billing History
     - Payment records
     - Next payment date
     
  5. Cancel Subscription
     - Cancel button with confirmation dialog
```

### 11.4 Upgrade Prompts

When a locked feature is accessed or a limit is hit, show contextual upgrade prompts:

```
Feature locked example (shown instead of Fees page):
┌─────────────────────────────────────────────────────────────────┐
│  💎 Fees & Invoicing is available on Standard and above         │
│                                                                 │
│  Upgrade to Standard to unlock:                                 │
│  ✓ Fee structures & invoicing                                   │
│  ✓ Payment collection via Mobile Money                          │
│  ✓ Financial dashboard                                          │
│  ✓ Expense tracking                                             │
│                                                                 │
│  Starting at GHS 750/month     [View Plans] [Upgrade Now]       │
└─────────────────────────────────────────────────────────────────┘

Limit reached example (shown in Create Student modal):
┌─────────────────────────────────────────────────────────────────┐
│  ⚠️ Student limit reached (150/150)                             │
│                                                                 │
│  Your Starter plan supports up to 150 students.                │
│  Upgrade to Standard for up to 500 students.                    │
│                                                                 │
│  [Upgrade Now]                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 12. Webhook & Automation

### 12.1 Trial Expiry Cron Job

```
File: src/lib/jobs/trialExpiry.ts
Schedule: Daily at midnight

Logic:
  1. Find all SchoolSubscriptions where:
     status === "trialing" AND trialEndDate <= now
  2. For each:
     a. If school has a payment method → attempt first charge, set status = "active"
     b. If no payment method → set status = "past_due"
     c. Create SubscriptionEvent: "trial_ended"
     d. Send email to school admin: "Your trial has ended"
  3. Find schools where:
     status === "trialing" AND trialEndDate is 3 days from now
     → Send reminder email: "3 days left in your trial"
  4. Find schools where:
     status === "trialing" AND trialEndDate is 7 days from now
     → Send reminder email: "7 days left in your trial"
```

### 12.2 Payment Failure Handling

```
When Paystack webhook reports a failed recurring payment:
  1. Set subscription status to "past_due"
  2. Create SubscriptionEvent: "payment_failed"
  3. Send email to school admin: "Payment failed"
  4. After 3 consecutive failures → set status to "suspended" automatically
  5. Create SubscriptionEvent: "suspended" with reason "payment_failures"
```

### 12.3 Auto-Assign Subscription on School Approval

```
Update: src/app/api/platform/applications/[id]/approve/route.ts

After creating the School document:
  1. Look up the default trial tier (SubscriptionTier where key === "starter")
  2. Create SchoolSubscription:
     {
       schoolId: school._id,
       tierId: starterTier._id,
       tierKey: "starter",
       status: "trialing",
       trialStartDate: new Date(),
       trialEndDate: addDays(new Date(), starterTier.trialDays),
       billingCycle: "monthly",
       currentPeriodStart: new Date(),
       currentPeriodEnd: addDays(new Date(), starterTier.trialDays),
     }
  3. Create SubscriptionEvent: "trial_started"
```

### 12.4 Monthly Provider Cost Sync

```
File: src/lib/jobs/providerCostSync.ts
Schedule: Monthly (or manual re-run from platform admin)

Logic:
  1. Pull provider usage/cost statements where APIs are available, or ingest admin-uploaded statements.
     Providers in scope:
       - Clerk
       - MongoDB
       - Vercel
       - OpenAI
       - UploadThing
       - Paystack
       - any other billable service added to the stack
  2. Create or update ServiceCostEntry for each provider and billing month.
  3. Apply allocation rules:
     - direct attribution where possible
     - weighted shared-cost allocation where costs are pooled
     - all allocation must be computed server-side and persisted; no frontend-only estimates
  4. Persist per-school allocated costs inside ServiceCostEntry.allocation.schoolBreakdown.
  5. Write summarized UsageMetric cost attribution records if needed for fast school-level queries.
  6. Flag providers that still require manual review.
```

### 12.5 Pilot Closeout Automation

```
File: src/lib/jobs/pilotCloseout.ts
Trigger:
  - Automatically when the pilot program end date is reached, OR
  - Manually from /platform/pilot "Run closeout analysis"

Logic:
  1. Select the pilot measurement window (for example, trailing 30/60/90 days).
  2. Aggregate per-school usage across:
     - Clerk
     - MongoDB
     - Vercel
     - UploadThing / Cloudinary
     - OpenAI
     - Brevo
     - Paystack
     - Internal platform overhead
  3. Normalize the observed usage to a monthly cost-to-serve estimate.
  4. Compare estimated cost to:
     - provisional tier pricing
     - active discounts
     - school-specific transaction fee rules
  5. Compute:
     - proposed revenue
     - estimated margin
     - suggested tier
     - minimum recommended price floor
  6. Generate an AI-written pricing recommendation draft using the closeout data.
  7. Generate a closeout snapshot for platform admin review.
  8. Flag schools requiring manual commercial review before final rollout.
  9. Do not apply any recommendation until platform admin explicitly approves it.
  10. Notify platform admin that pricing recommendations are ready.
```

---

## 13. Migration Plan for Existing Schools

### For schools already in the system:

```
Migration script: src/scripts/migrate-subscriptions.ts

1. Fetch all schools with status === "active"
2. For each school:
   a. Check if SchoolSubscription already exists → skip
   b. Count students and teachers to determine appropriate tier
   c. Create SchoolSubscription:
      - tierKey: "pilot" (during pilot) or "standard" (if post-pilot)
      - status: "active" (grandfather them in)
      - trialConverted: true
      - billingCycle: "monthly"
      - currentPeriodStart: now
      - currentPeriodEnd: 30 days from now
      - overrides.note: "Migrated from pre-subscription system"
   d. Create SubscriptionEvent: "tier_changed" with details noting migration
3. Seed default SubscriptionTier documents if they don't exist
```

---

## 14. Implementation Phases

### Phase 1: Data Models & Core Logic (3–4 days)

```
Files to create:
  - src/models/SubscriptionTier.ts
  - src/models/SchoolSubscription.ts
  - src/models/UsageMetric.ts
  - src/models/SubscriptionEvent.ts
  - src/models/ServiceCostEntry.ts
  - src/models/PlatformPayoutConfig.ts
  - src/lib/auth/requireFeature.ts
  - src/lib/auth/checkLimit.ts
  - src/lib/billing/trackUsage.ts
  - src/lib/billing/tierConfig.ts (default tier seed data)
  - src/scripts/seed-tiers.ts (seed default tiers)
  - src/scripts/migrate-subscriptions.ts

Files to update:
  - src/app/api/platform/applications/[id]/approve/route.ts (auto-create subscription)
  
Testing:
  - Unit test requireFeature with various tier configs
  - Unit test checkLimit with edge cases (unlimited, at limit, over limit)
  - Unit test trackUsage upsert behavior
```

### Phase 2: Platform Admin — Tier Management (2–3 days)

```
Files to create:
  - API routes: /api/platform/tiers (CRUD)
  - API routes: /api/platform/tiers/feature-keys
  - Pages: /platform/billing/tiers, /platform/billing/tiers/[id]
  - Components: TierConfigCard, TierConfigForm
  - Hooks: useSubscriptionTiers, useSubscriptionTierMutations

Testing:
  - Create, edit, delete tiers from the UI
  - Verify feature key checkboxes work
  - Verify limits update correctly
```

### Phase 3: Platform Admin — School Subscription Management (3–4 days)

```
Files to create:
  - API routes: /api/platform/schools/[id]/subscription (GET, PATCH)
  - API routes: /api/platform/schools/[id]/subscription/override
  - API routes: /api/platform/schools/[id]/subscription/discount
  - API routes: /api/platform/schools/[id]/subscription/transaction-fees
  - API routes: /api/platform/billing/payouts
  - API routes: /api/platform/billing/payouts/verify
  - API routes: /api/platform/schools/[id]/subscription/suspend
  - API routes: /api/platform/schools/[id]/subscription/reactivate
  - API routes: /api/platform/schools/[id]/subscription/events
  - Pages: /platform/schools/[id], /platform/schools/[id]/subscription, /platform/schools/[id]/usage
  - Components: SchoolSubscriptionCard, SchoolCommercialProfileCard, SubscriptionOverrideForm, DiscountEditorForm, TransactionFeePolicyForm, PlatformPayoutAccountForm, PayoutDestinationCard, TwoFactorChallengeModal, SchoolSubscriptionActions, SubscriptionTimeline
  - Hooks: useSchoolSubscription, useSchoolSubscriptionActions, useSchoolCommercialControls, usePlatformPayoutSettings

Files to update:
  - /platform/schools page — add subscription columns to table
  
Testing:
  - Change school tier from UI
  - Set, update, and remove a school discount
  - Set, update, and remove school-specific transaction fee rules
  - Change payout destination only after successful OTP verification
  - Suspend and reactivate a school
  - Add overrides and verify they take effect
  - View event timeline
```

### Phase 4: Feature Gating & Limit Enforcement (3–4 days)

```
Files to create:
  - src/hooks/useSubscription.ts
  - src/components/billing/FeatureGate.tsx
  - src/components/billing/LimitIndicator.tsx
  - src/components/billing/UpgradePrompt.tsx
  - src/components/billing/SubscriptionBadge.tsx
  - src/components/billing/TrialBanner.tsx
  - src/components/billing/SuspendedOverlay.tsx
  - API routes: /api/subscription/current

Files to update:
  - Admin sidebar — add feature checks to nav items
  - Teacher sidebar — add feature checks
  - Parent/Student layouts — add feature checks
  - Admin layout — add TrialBanner and SuspendedOverlay
  - Student creation route — add checkLimit("maxStudents")
  - Teacher creation route — add checkLimit("maxTeachers")
  - Invitation route — add checkLimit("maxInvitationsPerMonth")
  - AI generation routes — add checkLimit("maxAICallsPerMonth") + requireFeature("ai_lesson_notes")
  - Fees routes — add requireFeature("fees")
  - Community hub routes — add requireFeature("community_hub")
  - (All other gated features per the feature matrix)

Testing:
  - As a starter school, verify locked features return 403
  - Verify sidebar hides/shows items correctly per tier
  - Hit student limit and verify upgrade prompt appears
  - Verify trial banner shows with correct countdown
  - Suspend a school and verify overlay blocks all access
```

### Phase 5: Usage Metering (2–3 days)

```
Files to create:
  - API routes: /api/platform/usage/summary
  - API routes: /api/platform/usage/schools
  - Hooks: useUsageMetrics
  - Components: UsageCard, UsageHeatmap
  - Optional helper: src/lib/billing/costAllocation.ts

Files to update:
  - AI generation routes — add trackUsage for tokens
  - Email service — add trackUsage for sends
  - UploadThing callback — add trackUsage for storage
  - Invitation route — add trackUsage for invitations
  - Report export route — add trackUsage for exports
  - Clerk webhook — add trackUsage for logins
  - Monthly provider reconciliation job — add auth_mau / hosting / DB / shared-cost import

Testing:
  - Create a student → verify api_request and feature_use metrics recorded
  - Generate AI content → verify ai_call and ai_tokens metrics
  - Upload file → verify storage_bytes metric
  - Check aggregation in usage summary API
  - Verify provider-attributed cost estimates roll up per school
```

### Phase 6: Cost Tracking & Revenue Dashboard (2–3 days)

```
Files to create:
  - API routes: /api/platform/usage/costs (GET, POST)
  - API routes: /api/platform/usage/costs/sync
  - API routes: /api/platform/usage/revenue
  - Pages: /platform/billing/costs, /platform/billing/revenue
  - Components: ServiceCostForm, ServiceCostChart, RevenueChart, MarginBreakdownCard
  - Hooks: useServiceCosts, useRevenueAnalytics
  - Page update: /platform page — add KPI cards

Testing:
  - Record service costs manually
  - Sync provider costs automatically where supported
  - View cost trends over months
  - View revenue breakdown by tier
  - Verify gross margin calculation
  - Verify discount exposure and fee policy effects on realized revenue
  - Verify EduSentrix transaction fee revenue and processor fee cost are reported separately
```

### Phase 7: School-Facing UI & Self-Service (2–3 days)

```
Files to create:
  - Pages: /admin/settings/subscription (or /admin/billing)
  - API routes: /api/subscription/upgrade
  - API routes: /api/subscription/cancel
  - API routes: /api/public/pricing
  - Components: PricingTable
  - Public pricing page (if needed)

Files to update:
  - Admin settings page — add subscription tab/link

Testing:
  - School admin can view their plan and usage
  - School admin can see available plans
  - Upgrade flow (Paystack integration)
  - Cancel flow with confirmation
```

### Phase 8: Pilot Dashboard & Automation (2–3 days)

```
Files to create:
  - Pages: /platform/pilot
  - Components: PilotComparisonTable, PilotCloseoutReportCard
  - Jobs: src/lib/jobs/trialExpiry.ts
  - Jobs: src/lib/jobs/providerCostSync.ts
  - Jobs: src/lib/jobs/pilotCloseout.ts
  - API route: /api/cron/trial-expiry (called by Vercel Cron or external)
  - API route: /api/platform/pilot/closeout

Files to update:
  - Paystack webhook — handle subscription payment events
  - Application approval — auto-create subscription with trial

Testing:
  - Approve application → verify trial subscription created
  - Trial expires → verify status change and email
  - Payment webhook → verify status updates
  - Pilot dashboard shows correct data
  - Pilot closeout analysis generates pricing recommendations automatically
```

### Phase 9: Migration & Polish (1–2 days)

```
Tasks:
  - Run migration script for existing schools
  - Seed default tiers
  - Update PlatformSidebar with new nav items
  - End-to-end testing of full flow
  - Documentation updates

Estimated Total: 20–28 days
```

---

## 15. Testing Checklist

### Feature Gating Tests

- [ ] Starter school cannot access /admin/fees
- [ ] Starter school cannot access /admin/community
- [ ] Starter school can access /admin/students
- [ ] Standard school can access /admin/fees but not /admin/community
- [ ] Premium school can access all features
- [ ] Enterprise school can access all features
- [ ] Pilot school can access all features
- [ ] Override `additionalFeatures: ["fees"]` on starter → can access /admin/fees
- [ ] Override `removedFeatures: ["teachers"]` on premium → cannot access teachers (edge case)

### Commercial Controls Tests

- [ ] Platform admin can manually assign a tier to a school
- [ ] Platform admin can set, update, and remove a discount for a school
- [ ] Platform admin can set, adjust, and remove transaction fee rules for a school
- [ ] Discount and fee changes create SubscriptionEvent records
- [ ] Payout destination changes require OTP verification via admin phone
- [ ] Subscription revenue and EduSentrix transaction fee revenue can route to different accounts

### Cost Intelligence Tests

- [ ] Usage is attributed by school for Clerk, MongoDB, Vercel, and platform-native activity
- [ ] Usage is attributed by school for OpenAI and UploadThing
- [ ] Shared provider costs are allocated by the configured driver
- [ ] Revenue dashboard shows realized MRR after discounts
- [ ] Pilot closeout analysis flags schools below the recommended price floor
- [ ] EduSentrix transaction fee revenue is tracked separately from processor fee cost

### Approval Workflow Tests

- [ ] Pilot closeout generates AI pricing recommendations automatically
- [ ] Pricing recommendations remain draft until platform admin approves them

### Limit Enforcement Tests

- [ ] Creating 151st student on starter (limit 150) → blocked with upgrade prompt
- [ ] Creating 11th teacher on starter (limit 10) → blocked
- [ ] Uploading file that exceeds storage limit → blocked
- [ ] AI call when maxAICallsPerMonth = 0 → blocked
- [ ] AI call #51 when maxAICallsPerMonth = 50 → blocked
- [ ] Override maxStudents to 200 on starter → can create up to 200
- [ ] Unlimited limit (-1) → no blocking ever

### Subscription Lifecycle Tests

- [ ] New school approval → trial subscription created automatically
- [ ] Trial banner shows correct countdown
- [ ] Trial expiry → status changes to past_due
- [ ] Trial → paid conversion (Paystack payment)
- [ ] Platform admin change tier → effective immediately
- [ ] Platform admin suspend → school sees overlay
- [ ] Platform admin reactivate → school can access again
- [ ] Platform admin set override → limits change for that school
- [ ] School admin cancel → scheduled at period end
- [ ] Payment failure → status changes to past_due

### Usage Tracking Tests

- [ ] AI call → UsageMetric record created
- [ ] File upload → storage_bytes metric incremented
- [ ] Email sent → email_sent metric incremented
- [ ] Login → login metric created
- [ ] Invitation → invitation_sent metric created
- [ ] Usage summary API returns correct aggregates
- [ ] Estimated cost calculation is reasonable

### Platform Admin UI Tests

- [ ] Create new tier → appears in tier list
- [ ] Edit tier pricing → saved correctly
- [ ] Edit tier features → checkboxes reflect saved state
- [ ] Delete tier with no schools → succeeds
- [ ] Delete tier with schools → blocked
- [ ] School directory shows subscription columns
- [ ] School detail page shows subscription info
- [ ] Suspend/reactivate from school detail → works
- [ ] Service cost entry → appears in cost dashboard
- [ ] Revenue dashboard → MRR calculation correct
- [ ] Pilot dashboard → shows pilot schools with usage data

---

## Appendix A: Default Tier Seed Data

```javascript
// src/lib/billing/tierConfig.ts

export const DEFAULT_TIERS = [
  {
    key: "starter",
    name: "Starter",
    description: "Essential school management for small schools. Covers core admin, basic gradebook, and attendance.",
    isActive: true,
    isPublic: true,
    sortOrder: 0,
    pricing: { currency: "GHS", monthlyPrice: 350, annualPrice: 3500, annualDiscountLabel: "2 months free" },
    trialDays: 30,
    limits: { maxStudents: 150, maxTeachers: 10, maxAdminUsers: 2, maxStorageGB: 2, maxAICallsPerMonth: 0, maxInvitationsPerMonth: 50, maxEmailsPerMonth: 100 },
    features: ["students", "teachers", "classes", "subjects", "periods", "gradebook_basic", "attendance_basic", "reports_basic", "timetable", "invitations"],
    supportLevel: "community",
  },
  {
    key: "standard",
    name: "Standard",
    description: "Complete school management with fees, teacher portal, and parent access. Ideal for growing schools.",
    isActive: true,
    isPublic: true,
    sortOrder: 1,
    pricing: { currency: "GHS", monthlyPrice: 750, annualPrice: 7500, annualDiscountLabel: "2 months free" },
    trialDays: 30,
    limits: { maxStudents: 500, maxTeachers: 25, maxAdminUsers: 5, maxStorageGB: 20, maxAICallsPerMonth: 0, maxInvitationsPerMonth: 200, maxEmailsPerMonth: 500 },
    features: [
      "students", "teachers", "classes", "subjects", "periods", "gradebook_basic", "attendance_basic", "reports_basic", "timetable", "invitations",
      "fees", "payments", "financial_center", "expenses", "teacher_portal", "lesson_notes_simple", "teacher_studio", "parent_portal_view", "calendar", "offline_support", "print_export"
    ],
    supportLevel: "email",
  },
  {
    key: "premium",
    name: "Premium",
    description: "Full-featured platform with AI tools, advanced analytics, community hub, and student portal. For established schools.",
    isActive: true,
    isPublic: true,
    sortOrder: 2,
    pricing: { currency: "GHS", monthlyPrice: 1500, annualPrice: 15000, annualDiscountLabel: "2 months free" },
    trialDays: 30,
    limits: { maxStudents: 1500, maxTeachers: -1, maxAdminUsers: 10, maxStorageGB: 100, maxAICallsPerMonth: 50, maxInvitationsPerMonth: -1, maxEmailsPerMonth: 2000 },
    features: [
      "students", "teachers", "classes", "subjects", "periods", "gradebook_basic", "attendance_basic", "reports_basic", "timetable", "invitations",
      "fees", "payments", "financial_center", "expenses", "teacher_portal", "lesson_notes_simple", "teacher_studio", "parent_portal_view", "calendar", "offline_support", "print_export",
      "lesson_notes_all", "ai_lesson_notes", "ai_student_insights", "advanced_analytics", "community_hub", "student_portal", "parent_portal_full", "approval_workflow", "bulk_operations", "period_attendance"
    ],
    supportLevel: "priority",
  },
  {
    key: "enterprise",
    name: "Enterprise",
    description: "Unlimited everything for school networks and large institutions. Custom integrations, SLA, and dedicated support.",
    isActive: true,
    isPublic: true,
    sortOrder: 3,
    pricing: { currency: "GHS", monthlyPrice: 3500, annualPrice: 35000, annualDiscountLabel: "Negotiable" },
    trialDays: 30,
    limits: { maxStudents: -1, maxTeachers: -1, maxAdminUsers: -1, maxStorageGB: -1, maxAICallsPerMonth: -1, maxInvitationsPerMonth: -1, maxEmailsPerMonth: -1 },
    features: [
      "students", "teachers", "classes", "subjects", "periods", "gradebook_basic", "attendance_basic", "reports_basic", "timetable", "invitations",
      "fees", "payments", "financial_center", "expenses", "teacher_portal", "lesson_notes_simple", "teacher_studio", "parent_portal_view", "calendar", "offline_support", "print_export",
      "lesson_notes_all", "ai_lesson_notes", "ai_student_insights", "advanced_analytics", "community_hub", "student_portal", "parent_portal_full", "approval_workflow", "bulk_operations", "period_attendance",
      "api_access", "multi_campus", "white_label", "sla_guarantee", "custom_integrations", "dedicated_support"
    ],
    supportLevel: "dedicated",
  },
  {
    key: "pilot",
    name: "Pilot Program",
    description: "Full access for pilot program schools. All features unlocked with full usage metering.",
    isActive: true,
    isPublic: false,
    sortOrder: 99,
    pricing: { currency: "GHS", monthlyPrice: 0, annualPrice: 0, annualDiscountLabel: "Free during pilot" },
    trialDays: 180,
    limits: { maxStudents: -1, maxTeachers: -1, maxAdminUsers: -1, maxStorageGB: -1, maxAICallsPerMonth: -1, maxInvitationsPerMonth: -1, maxEmailsPerMonth: -1 },
    features: [
      "students", "teachers", "classes", "subjects", "periods", "gradebook_basic", "attendance_basic", "reports_basic", "timetable", "invitations",
      "fees", "payments", "financial_center", "expenses", "teacher_portal", "lesson_notes_simple", "teacher_studio", "parent_portal_view", "calendar", "offline_support", "print_export",
      "lesson_notes_all", "ai_lesson_notes", "ai_student_insights", "advanced_analytics", "community_hub", "student_portal", "parent_portal_full", "approval_workflow", "bulk_operations", "period_attendance",
      "api_access", "multi_campus", "white_label", "sla_guarantee", "custom_integrations", "dedicated_support"
    ],
    supportLevel: "priority",
  },
];
```

## Appendix B: PlatformSidebar Update

```javascript
// Update src/components/platform/PlatformSidebar.tsx nav array:

const nav = [
  { label: "Overview", href: "/platform", icon: LayoutDashboard, exact: true },
  { label: "Applications", href: "/platform/applications", icon: CheckSquare },
  { label: "Schools", href: "/platform/schools", icon: Building2 },
  { label: "Users", href: "/platform/users", icon: Users },
  // NEW entries:
  { label: "Billing & Tiers", href: "/platform/billing", icon: Banknote },
  { label: "Pilot Program", href: "/platform/pilot", icon: FlaskConical },
  // Existing entries:
  { label: "Reconciliation", href: "/platform/reconciliation", icon: Landmark },
  { label: "Webhooks", href: "/platform/webhooks", icon: Webhook },
  { label: "Email Templates", href: "/platform/emails", icon: Mail },
  { label: "Feature Flags", href: "/platform/flags", icon: Flag },
  { label: "Audit Logs", href: "/platform/audit", icon: FileWarning },
  { label: "Settings", href: "/platform/settings", icon: Settings },
];
```

## Appendix C: Key Files Quick Reference

| What | File Path |
|------|-----------|
| School model | `src/models/School.ts` |
| Platform admin auth guard | `src/lib/auth/requirePlatformAdmin.ts` |
| School member auth guard | `src/lib/auth/requireSchoolMember.ts` |
| Teacher auth guard | `src/lib/auth/requireTeacher.ts` |
| Platform sidebar | `src/components/platform/PlatformSidebar.tsx` |
| Admin sidebar | `src/components/nav/admin-sidebar.tsx` |
| Platform layout | `src/app/(app)/platform/layout.tsx` |
| Admin layout | `src/app/(app)/admin/layout.tsx` |
| Application approval | `src/app/api/platform/applications/[id]/approve/route.ts` |
| Provisioning jobs | `src/lib/jobs/provisioning.ts` |
| Paystack integration | `src/lib/paystack.ts` |
| Email service (Brevo) | `src/lib/email/brevo.ts` |
| OpenAI (lesson notes) | `src/app/api/teacher/lesson-notes/ai/generate/route.ts` |
| OpenAI (insights) | `src/app/api/admin/students/[id]/academics/ai-insights/route.ts` |
| UploadThing config | `src/lib/uploadthing/` |
| RBAC / permissions | `src/lib/rbac/rbac.ts` |
| Feature flags (existing) | `src/models/SchoolSettings.ts` → `teacherStudio.enabled` |
| Student creation | `src/app/api/admin/students/route.ts` |
| Teacher creation | `src/app/api/admin/teachers/create/route.ts` |
| Invitation creation | `src/app/api/admin/invitations/route.ts` |
| Dashboard routing | `src/app/dashboard/page.tsx` |
