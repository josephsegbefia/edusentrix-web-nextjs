# EduSentrix Subscription Management & Feature Gating Spec

> **Final rebuild note:** This version includes the May 2026 senior hardening addendum. It supersedes earlier subscription specs and must be treated as the implementation source of truth. The project is rebuilding the subscription system from scratch with canonical feature keys and no runtime legacy aliases.


**Product:** EduSentrix Web Platform  
**Audience:** AI coding agents, product owner, platform engineers  
**Stack:** Next.js App Router, React 19, TypeScript, MongoDB/Mongoose, Clerk, Tailwind CSS v4, shadcn/Radix primitives, TanStack React Query, Sonner, UploadThing/Cloudinary where already integrated  
**Date:** 27 May 2026  
**Status:** Developer-ready product + technical specification. Do not code until a slice is selected.

---

## 1. Purpose

EduSentrix previously had subscription-related models, billing helpers, and entitlement placeholders, but active gating was removed. This spec defines a clean rebuild of subscription management from the ground up without breaking the current web platform.

The goal is to create:

1. A clean platform-admin subscription and revenue management experience.
2. A clear school-admin subscription and billing page.
3. Proper feature gating across frontend navigation, pages, API routes, AI actions, file uploads, payments, meetings, and add-ons.
4. Flexible school-specific pricing and transaction charge overrides.
5. Safe Pilot controls so schools can be onboarded with custom module access.
6. Usage-based add-ons for Leo AI, meetings, storage, Edusentrix Learn, and future communication credits.

This spec is intentionally detailed and broken into small implementation slices so AI agents can execute safely.

---

## 2. Current Codebase Findings

The uploaded EduSentrix web project already contains several subscription-related files and concepts. These should be treated as a starting point, not as final design.

### 2.1 Existing files and areas discovered

Relevant existing files include:

- `src/models/SubscriptionTier.ts`
- `src/models/SchoolSubscription.ts`
- `src/models/SubscriptionEvent.ts`
- `src/models/SubscriptionCheckoutIntent.ts`
- `src/models/PlatformBillingSettings.ts`
- `src/lib/billing/entitlements.ts`
- `src/lib/auth/requireFeature.ts`
- `src/lib/auth/checkLimit.ts`
- `src/lib/platform-billing/subscription-pricing.ts`
- `src/lib/platform-billing/platform-schools.ts`
- `src/app/(app)/platform/schools/[id]/subscription` references exist in links
- `src/app/(app)/platform/flags/page.tsx`
- Platform permissions already include `platform.subscriptions.manage`

### 2.2 Important current behavior

Current gating is effectively disabled:

- `hasFeature()` returns `true`.
- `checkLimit()` always allows the action.
- `requireFeatureForSchool()` returns the school snapshot and does not block.
- `enforceSchoolLimit()` always allows the action.
- The current entitlement snapshot acts like every school has full access.

This is useful because the rebuild can be introduced gradually without fighting active production gates.

### 2.3 Current UI standards to preserve

The repository has a strong `AGENTS.md` contract. Subscription UI must follow it.

Use these primitives and conventions:

- `WorkspacePageShell`
- `WorkspacePageHeader`
- `GlassPanel`
- `glassPanelClass`
- `glassInsetClass`
- `glassPrimaryButtonClass`
- `glassSecondaryButtonClass`
- `PremiumDropdownMenu`
- `PremiumSelect`
- `CustomDatePicker`
- `ResponsiveModal`
- `useConfirmationDialog`
- Sonner/app toast conventions
- `lucide-react` icons

Do not use raw browser alerts, browser confirms, raw date inputs, fake actions, or overloaded dashboard cards.

---

## 3. Product Principles

### 3.1 Separate four concepts

Do not mix these concepts into one giant subscription object.

1. **Plans** define access and base pricing.
2. **School Subscriptions** define what a specific school currently has.
3. **Transaction Charges** define platform fees on payments.
4. **Add-ons and Credits** define usage-heavy extras.

### 3.2 Subscription plan controls access

A school's plan controls access to modules such as:

- Admissions
- Students
- Fees
- Lesson Notes
- Schemes of Learning
- Lessons
- Examinations
- Question Bank
- Leo AI
- Meetings
- Edusentrix Learn management
- Analytics

### 3.3 Add-ons control expensive usage

Add-ons should control usage-heavy features:

- Leo AI credits
- Meeting participant-minutes
- Edusentrix Learn student seats
- Extra storage
- Future SMS/WhatsApp credits

### 3.4 Payment charges control transaction revenue

Transaction fees must be independent from subscription fees.

A school may pay a low subscription but still generate platform revenue through:

- School fee payments
- Admission fee payments
- Store payments
- Donation/fundraising payments
- Edusentrix Learn payments
- Meeting credit purchases
- AI credit purchases

### 3.5 No unlimited AI or meetings

Never offer truly unlimited AI or meetings. Even Premium should have allowances and paid overage/add-on options.

### 3.6 Pilot is platform-admin controlled only

Pilot is not a public self-service tier. It is a controlled onboarding, sales, demo, and trial mode.

### 3.7 Gating must be truthful but graceful

When a module is locked:

- Do not pretend the feature works.
- Do not show broken buttons.
- Use clean locked states.
- Keep existing data readable when appropriate.
- Block new creation after subscription expires or usage limits are reached.

---

## 4. Subscription Plans

EduSentrix will have four plan levels:

0. Pilot
1. Starter
2. Growth
3. Premium

### 4.1 Pilot

**Purpose:** onboarding, demos, controlled trials, implementation testing, and school-specific rollout.

Pilot is not public. Only platform admins can assign it.

#### Pilot capabilities

The platform admin must be able to choose:

- Enabled modules
- Student limit
- Teacher/staff limit
- Storage allowance
- Leo AI allowance
- Meeting allowance
- Payment charge percentage
- Whether payments are live, sandbox, or disabled
- Whether Edusentrix Learn is enabled
- Pilot expiry date
- Grace behavior after pilot ends

#### Recommended Pilot default modules

- School profile
- Students
- Teachers/staff
- Grades/classes/class groups
- Academic periods
- Basic fees
- Admissions, optional
- Payment collection, optional
- Basic communications, optional
- Basic reports, optional
- Leo AI, optional and limited

#### Pilot should not automatically include

- Full Leo AI
- Full Lesson Notes
- Full Schemes of Learning
- Full Lessons
- Full Question Bank
- Full Examinations
- Full Meetings
- Full Edusentrix Learn
- Advanced analytics
- Automation workflows

### 4.2 Starter

**Purpose:** basic school digitization and records management.

Starter is for schools that need records, admissions, fees, payments, and basic communication.

#### Starter includes

- School profile
- Academic years and terms
- Student records
- Parent/guardian records
- Teacher/staff records
- Grades and class groups
- Subject offerings/basic academic setup
- Basic attendance
- Admissions
- Admission fee collection
- Fees and invoices
- Parent payment collection
- Basic payment reports
- Basic notices/announcements
- Basic documents/storage
- Basic support

#### Starter excludes

- Leo AI
- Lesson Notes
- Schemes of Learning
- Lessons
- Examinations
- Question Bank
- Edusentrix Learn activation
- Meetings
- Advanced analytics
- AI-generated reports
- Automation workflows

### 4.3 Growth

**Purpose:** serious school operations with academic planning and basic AI.

Growth should be the recommended plan.

#### Growth includes everything in Starter, plus

- Schemes of Learning
- Lesson Notes
- Lessons/classroom delivery planning
- Curriculum planning workflows
- Basic examinations
- Basic question bank
- Basic Leo AI credits
- AI lesson note assistance
- AI report summaries
- Edusentrix Learn activation eligibility
- Better academic reports
- Better finance reports
- Higher storage allowance
- Priority support

#### Growth does not include Edusentrix Learn seats for free

Growth should unlock the ability to activate Edusentrix Learn, but Edusentrix Learn itself remains a separate service or add-on.

### 4.4 Premium

**Purpose:** full smart school operating system.

Premium should be positioned as the plan for schools that want administration, academics, finance, communication, analytics, and AI-assisted operations at a high level.

#### Premium includes everything in Growth, plus

- Full examinations
- Full question bank
- Advanced academic analytics
- Advanced finance analytics
- AI-powered school insights
- AI fee/payment summaries
- AI attendance and performance alerts
- Advanced communications workflows
- Automation/checklists
- Meeting module access with included participant-minute allowance
- Higher Leo AI credit allowance
- More storage
- Advanced role/permission controls
- Audit logs and compliance reports
- Data export tools
- Priority onboarding support
- Premium support response
- Custom configuration support

#### Premium still has limits

Premium should not mean unlimited AI, unlimited meetings, or unlimited storage.

Example allowances:

- Higher Leo AI credits per term
- Included meeting participant-minutes per term
- Higher storage allowance
- Paid overages through add-on packages

---

## 5. Recommended Plan Matrix

| Feature / Module | Pilot | Starter | Growth | Premium |
|---|---:|---:|---:|---:|
| School profile | Optional | Yes | Yes | Yes |
| Students | Optional | Yes | Yes | Yes |
| Parents/guardians | Optional | Yes | Yes | Yes |
| Teachers/staff | Optional | Yes | Yes | Yes |
| Grades/classes | Optional | Yes | Yes | Yes |
| Subject offerings | Optional | Basic | Yes | Yes |
| Academic periods | Optional | Yes | Yes | Yes |
| Admissions | Optional | Yes | Yes | Yes |
| Admission fees | Optional | Yes | Yes | Yes |
| Fees/invoices | Optional | Yes | Yes | Yes |
| Parent payments | Optional | Yes | Yes | Yes |
| Basic communications | Optional | Yes | Yes | Yes |
| Reports | Optional | Basic | Better | Advanced |
| Documents/storage | Optional | Limited | Higher | High |
| Schemes of Learning | Optional | No | Yes | Yes |
| Lesson Notes | Optional | No | Yes | Yes |
| Lessons | Optional | No | Yes | Yes |
| Leo AI | Optional limited | No | Included limited | Included higher |
| Examinations | Optional | No | Basic | Full |
| Question Bank | Optional | No | Basic | Full |
| Edusentrix Learn activation | Optional | No | Yes | Yes |
| Meetings | Optional | Add-on only | Add-on only | Access + allowance |
| Advanced analytics | Optional | No | Limited | Yes |
| Automation workflows | Optional | No | Limited | Yes |
| Audit/compliance reports | Optional | No | No | Yes |
| Priority support | No | No | Yes | Yes |

---

## 6. Pricing Model

### 6.1 Core formula

Use per-student-per-term pricing with a minimum term fee.

```ts
termSubscriptionAmount = Math.max(
  activeStudentCount * pricePerStudentPerTermMinor,
  minimumTermFeeMinor
);
```

### 6.2 Active student count

Billing should count:

- Active students
- Currently enrolled students
- Students attached to the current school
- Students not archived
- Students not graduated/alumni unless still active in the billing period

Do not count:

- Rejected applicants
- Draft admission applications
- Archived students
- Graduated alumni unless explicitly reactivated
- Deleted records

### 6.3 Example pricing placeholders

These are placeholder values for internal testing and should be configurable by platform admin.

| Plan | Price per student per term | Minimum term fee |
|---|---:|---:|
| Starter | GHS 8 | GHS 800 |
| Growth | GHS 15 | GHS 1,500 |
| Premium | GHS 25 | GHS 2,500 |
| Pilot | Custom | Custom |

### 6.4 Supported billing cadences

Support at least:

- Termly
- Yearly
- Custom

Monthly can remain technically supported if already in types, but it should not be emphasized in Ghanaian school operations unless the product owner later requests it.

### 6.5 School-specific pricing overrides

A school should inherit the plan defaults unless overridden.

Supported overrides:

- Custom price per student
- Custom minimum fee
- Manual fixed subscription price
- Discount percentage
- Fixed discount amount
- Custom renewal date
- Custom grace period
- Custom feature access
- Custom transaction charge policy

---

## 7. Transaction Charges

Transaction charges are platform fees applied to successful payments made through EduSentrix.

### 7.1 Payment categories

Support charges for:

- School fees
- Admission fees
- Store/order payments
- Donations/fundraising
- Event/trip payments
- Edusentrix Learn payments
- Meeting credit purchases
- Leo AI credit purchases
- Storage bundle purchases

### 7.2 Charge settings

Each charge policy should support:

- Charge type: percentage, fixed, hybrid
- Percentage value
- Fixed fee minor amount
- Minimum charge minor amount
- Maximum cap minor amount
- Currency
- Active/inactive status
- Category scope
- School override support

### 7.3 Charge payer modes

Support three payer modes:

1. **Payer pays**  
   Parent/student pays the base amount plus platform charge.

2. **School absorbs**  
   Parent/student pays only the base amount. Edusentrix deducts the platform fee before settlement.

3. **Waived**  
   No platform charge is applied.

### 7.4 Default recommendation

Recommended defaults:

- Admission fees: payer pays
- Optional services: payer pays
- School fees: school chooses payer pays or school absorbs
- Pilot schools: platform admin decides

### 7.5 Charge precedence

When calculating a transaction charge, resolve in this order:

1. School-specific category override
2. School-specific default override
3. Global category setting
4. Global default setting
5. No charge if none is configured

---

## 8. Add-ons and Credits

### 8.1 Add-on categories

Support the following add-ons:

- Leo AI credits
- Meeting participant-minutes
- Edusentrix Learn seats
- Extra storage
- Future SMS/WhatsApp credits

### 8.2 Leo AI credits

Every AI action should consume credits.

Example credit cost model:

| AI Action | Suggested credit cost |
|---|---:|
| Rewrite notice | 1 |
| Generate short message | 1 |
| Summarize report | 2 |
| Generate lesson note | 5 |
| Generate scheme suggestions | 5 |
| Analyze class performance | 8 |
| Generate exam questions | 10 |
| Deep school insight report | 15 |

Suggested included credits per term:

| Plan | Included Leo credits per term |
|---|---:|
| Starter | 0 |
| Growth | 300-500 |
| Premium | 1,500-3,000 |
| Pilot | Platform-admin defined |

Extra packages:

- 500 credits
- 1,000 credits
- 5,000 credits

### 8.3 Meetings

Meetings should be charged using participant-minutes.

```ts
participantMinutes = estimatedDurationMinutes * estimatedParticipantCount;
```

Example:

```ts
30 minutes * 20 participants = 600 participant-minutes;
```

Meeting modes:

1. Pay-as-you-go credits
2. Termly meeting bundle
3. Premium included allowance with overage purchase

Scheduling rule:

- Estimate required participant-minutes before scheduling.
- Allow scheduling if balance is enough.
- Warn if balance is low.
- Block or require purchase if balance is insufficient.

### 8.4 Edusentrix Learn

Edusentrix Learn should remain separate from the main subscription.

Growth and Premium can unlock Learn activation, but student seats should be separately billed.

School admin should be able to:

- Activate Learn for selected students or classes
- See active Learn student count
- See Learn subscription/seat cost
- Pay for Learn seats
- View usage summary

Platform admin should configure:

- Price per active learner per term
- Minimum Learn fee
- Free trial seat count
- Whether school pays or parent pays
- Eligibility by school subscription plan

### 8.5 Storage

Recommended included storage:

| Plan | Included storage |
|---|---:|
| Starter | 5GB |
| Growth | 25GB |
| Premium | 100GB |
| Pilot | Custom |

Extra bundles:

- +10GB per term
- +50GB per term
- +100GB per term

### 8.6 Future communication credits

Keep room for later:

- SMS credits
- WhatsApp notification credits
- Email volume tracking

Do not build SMS/WhatsApp UI unless provider support is intentionally restored.

---

## 9. Feature Key Registry

Create a central registry for all feature keys. Do not scatter string literals throughout the codebase.

Recommended file:

```txt
src/lib/billing/feature-registry.ts
```

Recommended feature key groups:

```ts
export const FEATURE_KEYS = {
  core: {
    students: "core.students",
    guardians: "core.guardians",
    teachers: "core.teachers",
    classes: "core.classes",
    academicPeriods: "core.academic_periods",
  },
  admissions: {
    applications: "admissions.applications",
    fees: "admissions.fees",
  },
  finance: {
    fees: "finance.fees",
    invoices: "finance.invoices",
    payments: "finance.payments",
    reconciliation: "finance.reconciliation",
    reports: "finance.reports",
  },
  academics: {
    subjectOfferings: "academics.subject_offerings",
    curriculum: "academics.curriculum",
    schemes: "academics.schemes",
    lessonNotes: "academics.lesson_notes",
    lessons: "academics.lessons",
  },
  assessment: {
    examinations: "assessment.examinations",
    questionBank: "assessment.question_bank",
  },
  ai: {
    leo: "ai.leo",
    lessonGeneration: "ai.lesson_generation",
    schemeAssistance: "ai.scheme_assistance",
    examGeneration: "ai.exam_generation",
    analytics: "ai.analytics",
  },
  learn: {
    manage: "learn.manage",
    studentApp: "learn.student_app",
  },
  meetings: {
    video: "meetings.video",
  },
  communications: {
    notices: "communications.notices",
    messaging: "communications.messaging",
  },
  analytics: {
    basic: "analytics.basic",
    advanced: "analytics.advanced",
  },
  documents: {
    storage: "documents.storage",
  },
  platform: {
    auditLogs: "platform.audit_logs",
    dataExports: "platform.data_exports",
    automation: "platform.automation",
  },
} as const;
```

### 9.1 Feature key rules

- Feature keys must be human-readable.
- Feature keys must map clearly to modules/pages/API actions.
- Avoid generic keys like `premium_feature`.
- Avoid old underscore-only keys unless migration requires aliases.
- Maintain a compatibility alias map for old keys like `ai_lesson_notes` if they still exist in code.

---

## 10. Limit Registry

Create a central registry for limit keys.

Recommended file:

```txt
src/lib/billing/limit-registry.ts
```

Recommended limits:

```ts
export const LIMIT_KEYS = {
  maxStudents: "maxStudents",
  maxTeachers: "maxTeachers",
  maxInvitationsPerMonth: "maxInvitationsPerMonth",
  maxStorageBytes: "maxStorageBytes",
  leoCreditsPerTerm: "leoCreditsPerTerm",
  meetingParticipantMinutesPerTerm: "meetingParticipantMinutesPerTerm",
  learnSeats: "learnSeats",
  reportExportsPerTerm: "reportExportsPerTerm",
  examGenerationsPerTerm: "examGenerationsPerTerm",
} as const;
```

### 10.1 Limit behavior

- `null` means unlimited only when explicitly allowed by product policy.
- `0` means not included.
- Positive number means included limit.
- Do not treat missing limit as unlimited. Missing should mean fallback to plan default or safe deny depending on context.

---

## 11. Data Model Design

The current models can be revised rather than fully discarded, but AI agents must not blindly preserve old fields if they conflict with this spec.

### 11.1 SubscriptionPlan model

The existing `SubscriptionTier` can be renamed conceptually to `SubscriptionPlan`, or retained as `SubscriptionTier` if renaming would cause too much churn. Product language should say “Plan”.

Recommended fields:

```ts
type PlanCode = "pilot" | "starter" | "growth" | "premium";

type SubscriptionPlan = {
  _id: ObjectId;
  code: PlanCode;
  name: string;
  description?: string;
  publicVisible: boolean;
  active: boolean;
  sortOrder: number;
  version: number;

  pricing: {
    currency: "GHS";
    billingCadence: "term" | "annual" | "custom";
    pricePerStudentPerTermMinor: number | null;
    minimumTermFeeMinor: number | null;
    annualDiscountPercent?: number | null;
    onboardingFeeMinor?: number | null;
  };

  features: string[];
  limits: Record<string, number | null>;
  includedCredits: {
    leoCreditsPerTerm?: number;
    meetingParticipantMinutesPerTerm?: number;
    storageBytes?: number;
  };

  transactionFeeDefaults?: TransactionFeePolicySnapshot | null;
  pilotDefaults?: PilotDefaults | null;

  createdAt: Date;
  updatedAt: Date;
};
```

### 11.2 SchoolSubscription model

This model represents a school’s current commercial state.

Recommended fields:

```ts
type SchoolSubscription = {
  _id: ObjectId;
  schoolId: ObjectId;

  planId: ObjectId | null;
  planCode: "pilot" | "starter" | "growth" | "premium" | null;
  planName: string | null;
  planVersion: number | null;

  status:
    | "draft"
    | "pilot"
    | "active"
    | "past_due"
    | "grace"
    | "restricted_read_only"
    | "suspended"
    | "cancelled"
    | "expired";

  lifecycleMode: "pilot" | "paid" | "custom" | null;
  billingCadence: "term" | "annual" | "custom" | null;

  startsAt: Date | null;
  endsAt: Date | null;
  pilotStartsAt: Date | null;
  pilotEndsAt: Date | null;
  gracePeriodEndsAt: Date | null;

  academicYearId: ObjectId | null;
  academicTermId: ObjectId | null;

  studentCountSnapshot: number;
  basePriceMinor: number;
  manualPriceOverrideMinor: number | null;
  discountMode: "none" | "percent" | "fixed";
  discountValue: number | null;
  effectivePriceMinor: number;

  featuresSnapshot: string[];
  limitsSnapshot: Record<string, number | null>;
  transactionFeeSnapshot: TransactionFeePolicySnapshot | null;

  schoolOverrides: {
    pricePerStudentPerTermMinor?: number | null;
    minimumTermFeeMinor?: number | null;
    featuresAdd?: string[];
    featuresRemove?: string[];
    limits?: Record<string, number | null>;
    transactionFees?: TransactionFeePolicySnapshot | null;
  };

  note?: string | null;
  updatedBy?: ObjectId | null;
  updatedByEmail?: string | null;

  createdAt: Date;
  updatedAt: Date;
};
```

### 11.3 SubscriptionEvent model

Keep this model and expand event types.

Recommended event types:

```ts
type SubscriptionEventType =
  | "subscription.assigned"
  | "subscription.updated"
  | "subscription.renewed"
  | "subscription.expired"
  | "subscription.grace_started"
  | "subscription.suspended"
  | "subscription.reactivated"
  | "subscription.cancelled"
  | "subscription.plan_changed"
  | "subscription.price_override_changed"
  | "subscription.features_overridden"
  | "subscription.transaction_charge_changed"
  | "addon.purchased"
  | "credits.adjusted";
```

Each event should store:

- schoolId
- subscriptionId
- actorId
- actorEmail
- type
- before snapshot where relevant
- after snapshot where relevant
- metadata
- createdAt

### 11.4 TransactionFeePolicy model or embedded settings

Use global settings + per-school overrides.

Option A: Add to `PlatformBillingSettings` for global defaults and store school-specific overrides in `SchoolSubscription`.

Option B: Create a new model `PaymentChargePolicy`.

Recommended: use `PaymentChargePolicy` if the logic grows beyond simple settings.

```ts
type PaymentChargePolicy = {
  _id: ObjectId;
  scope: "global" | "school" | "category" | "school_category";
  schoolId?: ObjectId | null;
  category?: PaymentCategory | null;
  active: boolean;
  chargeType: "percentage" | "fixed" | "hybrid";
  percentageBps?: number | null;
  fixedFeeMinor?: number | null;
  minChargeMinor?: number | null;
  maxChargeMinor?: number | null;
  payerMode: "payer_pays" | "school_absorbs" | "waived";
  currency: "GHS";
  createdAt: Date;
  updatedAt: Date;
};
```

Use basis points for percentages:

```ts
1.2% = 120 basis points
```

### 11.5 UsageBalance model

Track credits and usage balances per school.

```ts
type UsageBalance = {
  _id: ObjectId;
  schoolId: ObjectId;
  periodKey: string;
  academicYearId?: ObjectId | null;
  academicTermId?: ObjectId | null;
  balanceType:
    | "leo_credits"
    | "meeting_participant_minutes"
    | "storage_bytes"
    | "learn_seats"
    | "sms_credits"
    | "whatsapp_credits";
  includedQuantity: number;
  purchasedQuantity: number;
  usedQuantity: number;
  adjustedQuantity: number;
  expiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
```

Computed remaining:

```ts
remaining = includedQuantity + purchasedQuantity + adjustedQuantity - usedQuantity;
```

### 11.6 UsageEvent model

The current code references `UsageEvent`. Ensure it exists or create it.

```ts
type UsageEvent = {
  _id: ObjectId;
  schoolId: ObjectId;
  userId?: ObjectId | null;
  category: "ai" | "meeting" | "storage" | "payment" | "notification" | "export" | "other";
  metricKey: string;
  quantity: number;
  unitLabel: string;
  balanceType?: string | null;
  entityType?: string | null;
  entityId?: ObjectId | null;
  provider?: string | null;
  estimatedCostMinor?: number | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
};
```

### 11.7 AddOnPackage model

```ts
type AddOnPackage = {
  _id: ObjectId;
  code: string;
  name: string;
  description?: string;
  type:
    | "leo_credits"
    | "meeting_participant_minutes"
    | "storage_bytes"
    | "learn_seats"
    | "sms_credits"
    | "whatsapp_credits";
  quantity: number;
  priceMinor: number;
  currency: "GHS";
  active: boolean;
  availableToPlans: string[];
  expiresWithBillingPeriod: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};
```

---

## 12. Entitlement Resolver

Create one source of truth for school subscription access.

Recommended file:

```txt
src/lib/billing/resolve-school-entitlements.ts
```

### 12.1 Resolver output

```ts
type SchoolEntitlementSnapshot = {
  schoolId: string;
  schoolName: string;
  schoolStatus: string;
  paymentReady: boolean;

  subscription: {
    id: string | null;
    status: string;
    accessMode:
      | "full"
      | "pilot_limited"
      | "grace"
      | "restricted_read_only"
      | "suspended";
    planId: string | null;
    planCode: string | null;
    planName: string | null;
    startsAt: string | null;
    endsAt: string | null;
    pilotEndsAt: string | null;
    gracePeriodEndsAt: string | null;
    effectivePriceMinor: number;
  };

  features: string[];
  limits: Record<string, number | null>;

  usage: {
    students: number;
    teachers: number;
    leoCreditsRemaining: number | null;
    meetingParticipantMinutesRemaining: number | null;
    storageBytesUsed: number;
    storageBytesLimit: number | null;
  };

  transactionChargeSummary: {
    defaultPayerMode: string;
    schoolFeesRateLabel: string;
    admissionFeesRateLabel: string;
  };

  hasFeature(featureKey: string): boolean;
  getLimit(limitKey: string): number | null;
};
```

### 12.2 Access modes

Use simple access modes:

- `full`: normal active access.
- `pilot_limited`: only selected Pilot features are enabled.
- `grace`: keep most access but show renewal warnings.
- `restricted_read_only`: allow reading historical data, block creation/editing for gated modules.
- `suspended`: block most app areas except subscription/payment/support pages.

### 12.3 Status normalization

Avoid duplicate statuses like both `trial` and `trialing` going forward.

Recommended final statuses:

```ts
type SubscriptionStatus =
  | "draft"
  | "pilot"
  | "active"
  | "past_due"
  | "grace"
  | "restricted_read_only"
  | "suspended"
  | "cancelled"
  | "expired";
```

If old statuses exist, normalize them:

- `trial` -> `pilot` or `grace` depending context
- `trialing` -> `pilot`
- `archived` -> `expired` or `cancelled`

Do not delete old data blindly. Normalize at read time first.

---

## 13. Gating Strategy

### 13.1 Backend gating

Backend gating is mandatory. Frontend hiding alone is not enough.

Use helpers:

```ts
await requireFeatureForSchool(schoolId, FEATURE_KEYS.academics.lessonNotes);
await enforceSchoolLimit({ schoolId, limitKey: LIMIT_KEYS.maxStudents, increment: 1 });
await requireUsageCredits({ schoolId, balanceType: "leo_credits", quantity: 5 });
```

### 13.2 Frontend gating

Frontend should:

- Hide irrelevant modules for low plans when appropriate.
- Show tasteful locked cards where upsell context helps.
- Avoid cluttering the sidebar with too many locked items.
- Never show a working-looking button for a blocked action.

### 13.3 Route/page gating

For page-level gates:

- If feature unavailable, render a locked-state page.
- Explain what plan unlocks it.
- Provide “Contact platform admin” or “Request upgrade” action if wired.

### 13.4 Action-level gating

For actions inside otherwise accessible pages:

- Disable the action with a tooltip/helper text.
- Example: Fees page is accessible on Starter, but advanced reconciliation export may require Premium.

### 13.5 Expired subscription behavior

When a subscription expires:

1. Enter `grace` for a configured number of days.
2. During grace, show banners but keep access.
3. After grace, enter `restricted_read_only`.
4. In read-only mode, block creating/editing new operational data but allow viewing, exporting if allowed, and paying subscription invoices.
5. Platform admin can manually extend grace or reactivate.

---


## 13A. Leakage-Proof Feature Gating Contract

This section is mandatory. Every AI agent implementing subscriptions must treat this as the source of truth for gating. A feature is not considered properly gated until it is protected at every applicable layer listed below.

### 13A.1 Core principle

EduSentrix must use a **deny-by-default** model.

If a school has no valid subscription, no entitlement snapshot, an expired entitlement cache, or an unknown feature key, the platform must deny access to protected features by default. Only the safe account-management surfaces may remain available:

- School dashboard shell with limited read-only summary.
- Subscription and billing page.
- Renewal/payment page.
- Basic school profile view.
- Help/support/contact page.
- Platform-admin managed recovery flows.

No AI agent should implement a protected feature that relies only on hiding a link, hiding a button, or checking a client-side boolean.

### 13A.2 Required gating layers

Every gated feature must be protected across these layers where applicable.

| Layer | Purpose | Required for |
|---|---|---|
| Feature registry | Single source of truth for feature keys | All modules and add-ons |
| Plan entitlement map | Defines which plan includes which features | Pilot, Starter, Growth, Premium |
| School subscription resolver | Resolves the school’s real active entitlement | Every school-scoped page/API |
| School override resolver | Applies custom school pricing/features safely | Pilot/custom contracts |
| Navigation gate | Hides or locks links/cards/actions | Sidebar, top nav, quick actions |
| Page gate | Blocks direct URL access | App routes/pages/layouts |
| API/server action gate | Blocks direct API/action access | Mutations, writes, exports, AI, uploads |
| Usage/limit gate | Blocks cost/limit overuse | AI, meetings, storage, users, Learn seats |
| Payment charge resolver | Prevents transaction fee bypass | All payment creation flows |
| Audit/event log | Records decisions and overrides | Admin changes, denied access, credit use |
| Automated leakage tests | Catches regressions before release | CI and local test scripts |
| Runtime anomaly detection | Catches post-shipping inconsistencies | Production monitoring/audit jobs |

A feature is only accepted when all relevant layers are implemented and tested.

### 13A.3 Plan access matrix

Use this matrix when defining `planEntitlements.ts`, sidebar route metadata, page guards, and API guards.

Legend:

- `YES`: included by default.
- `NO`: unavailable unless platform admin explicitly overrides.
- `OPTIONAL`: controlled manually by platform admin, mostly for Pilot.
- `ADD_ON`: not included directly; school can purchase/activate separately.
- `LIMITED`: included but usage-limited.

| Feature key | Feature/module | Pilot | Starter | Growth | Premium | Required enforcement layers |
|---|---|---:|---:|---:|---:|---|
| `core.dashboard` | School dashboard shell | OPTIONAL | YES | YES | YES | nav, page |
| `core.students` | Student records | OPTIONAL | YES | YES | YES | nav, page, API |
| `core.teachers` | Teacher/staff records | OPTIONAL | YES | YES | YES | nav, page, API |
| `core.parents` | Parent/guardian records | OPTIONAL | YES | YES | YES | nav, page, API |
| `core.class_groups` | Class groups/classes | OPTIONAL | YES | YES | YES | nav, page, API |
| `core.grades` | Grades/levels | OPTIONAL | YES | YES | YES | nav, page, API |
| `core.subjects` | Subjects/subject offerings | OPTIONAL | YES | YES | YES | nav, page, API |
| `core.academic_periods` | Academic years/terms | OPTIONAL | YES | YES | YES | nav, page, API |
| `attendance.basic` | Basic attendance | OPTIONAL | YES | YES | YES | nav, page, API |
| `admissions.applications` | Admissions/applications | OPTIONAL | YES | YES | YES | nav, page, API |
| `admissions.fees` | Admission fee collection | OPTIONAL | YES | YES | YES | nav, page, API, payment-charge |
| `finance.fees` | Fee setup | OPTIONAL | YES | YES | YES | nav, page, API |
| `finance.invoices` | Invoices/bills | OPTIONAL | YES | YES | YES | nav, page, API |
| `finance.payments` | Parent/student payments | OPTIONAL | YES | YES | YES | nav, page, API, payment-charge |
| `finance.reconciliation` | Payment reconciliation | OPTIONAL | LIMITED | YES | YES | nav, page, API |
| `finance.reports.basic` | Basic finance reports | OPTIONAL | YES | YES | YES | nav, page, API |
| `finance.reports.advanced` | Advanced finance analytics | OPTIONAL | NO | LIMITED | YES | nav, page, API |
| `communications.notices` | Notices/announcements | OPTIONAL | YES | YES | YES | nav, page, API |
| `communications.messaging` | Direct/bulk messaging | OPTIONAL | LIMITED | YES | YES | nav, page, API, usage later |
| `documents.basic` | Basic document uploads | OPTIONAL | YES | YES | YES | nav, page, API, storage-limit |
| `documents.storage_overage` | Extra storage | OPTIONAL | ADD_ON | ADD_ON | ADD_ON | API, usage-limit, billing |
| `academics.curriculum` | Curriculum planning | OPTIONAL | NO | YES | YES | nav, page, API |
| `academics.schemes` | Schemes of Learning | OPTIONAL | NO | YES | YES | nav, page, API |
| `academics.lesson_notes` | Lesson Notes | OPTIONAL | NO | YES | YES | nav, page, API |
| `academics.lessons` | Lessons/class delivery | OPTIONAL | NO | YES | YES | nav, page, API |
| `assessment.examinations.basic` | Basic examinations | OPTIONAL | NO | LIMITED | YES | nav, page, API |
| `assessment.examinations.full` | Full examinations | OPTIONAL | NO | NO | YES | nav, page, API |
| `assessment.question_bank.basic` | Basic question bank | OPTIONAL | NO | LIMITED | YES | nav, page, API |
| `assessment.question_bank.full` | Full question bank | OPTIONAL | NO | NO | YES | nav, page, API |
| `ai.leo` | Leo AI access | OPTIONAL | NO | LIMITED | LIMITED | nav, page, API, usage-limit |
| `ai.lesson_generation` | AI lesson generation | OPTIONAL | NO | LIMITED | YES | API, usage-limit |
| `ai.exam_generation` | AI exam/question generation | OPTIONAL | NO | LIMITED | YES | API, usage-limit |
| `ai.analytics` | AI insights/analytics | OPTIONAL | NO | LIMITED | YES | nav, page, API, usage-limit |
| `learn.manage` | Manage Edusentrix Learn activation | OPTIONAL | NO | ADD_ON | ADD_ON | nav, page, API, billing |
| `learn.student_app` | Student Learn access | OPTIONAL | NO | ADD_ON | ADD_ON | API, seat-limit, billing |
| `meetings.video` | Meeting module access | OPTIONAL | ADD_ON | ADD_ON | LIMITED | nav, page, API, meeting-credit |
| `analytics.basic` | Basic analytics | OPTIONAL | YES | YES | YES | nav, page, API |
| `analytics.advanced` | Advanced analytics | OPTIONAL | NO | LIMITED | YES | nav, page, API |
| `automation.workflows` | Automation/checklists | OPTIONAL | NO | LIMITED | YES | nav, page, API |
| `audit.school_logs` | School-level audit logs | OPTIONAL | NO | LIMITED | YES | nav, page, API |
| `settings.roles.basic` | Basic role/user management | OPTIONAL | YES | YES | YES | nav, page, API |
| `settings.roles.advanced` | Advanced permissions/RBAC | OPTIONAL | NO | NO | YES | nav, page, API |
| `exports.basic` | Basic CSV/PDF exports | OPTIONAL | YES | YES | YES | API |
| `exports.advanced` | Advanced exports/data packs | OPTIONAL | NO | LIMITED | YES | API |

### 13A.4 Tier-specific enforcement rules

#### Pilot

Pilot is **custom and deny-by-default**.

Implementation rules:

1. Pilot schools must not inherit Starter, Growth, or Premium defaults automatically.
2. Every enabled Pilot feature must be explicitly listed in `schoolSubscription.featureOverrides.enabled` or the resolved Pilot entitlement profile.
3. Pilot must always have an expiry date.
4. Pilot can have custom limits for students, teachers, AI credits, storage, meetings, admissions, and payment charges.
5. Platform admin must be able to view exactly what the Pilot school can access.
6. Every Pilot override must create an audit event.

#### Starter

Starter includes basic operations only.

Implementation rules:

1. Starter must not access academic premium modules: schemes, lesson notes, lessons, examinations, question bank, Leo AI, advanced analytics, meetings, or Learn.
2. Starter may use admissions, fees, invoices, payment collection, basic communications, basic documents, and basic reports.
3. Starter write APIs for locked modules must return a structured `FEATURE_LOCKED` error, not a generic crash.
4. Starter UI should show locked upgrade cards for high-value modules, but must not expose create/edit actions for locked modules.

#### Growth

Growth is the recommended academic operations plan.

Implementation rules:

1. Growth includes schemes, lesson notes, lessons, curriculum planning, basic exams, basic question bank, and limited Leo AI.
2. Growth may activate Edusentrix Learn separately, but Learn student access must remain add-on/seat-gated.
3. Growth must enforce Leo AI credits before every AI call.
4. Growth must not access Premium-only full exam/question-bank capabilities unless explicitly overridden.
5. Growth advanced analytics must be limited to approved screens/widgets.

#### Premium

Premium is the full operating system plan, but not unlimited usage.

Implementation rules:

1. Premium includes full examinations, full question bank, advanced analytics, school audit logs, advanced finance reports, advanced permissions, and higher AI/storage/meeting allowances.
2. Premium still requires usage checks for AI, meetings, Learn seats, communications, and storage.
3. Premium may include meeting module access with included credits, but must block meetings when credits are exhausted unless the school buys more.
4. Premium must not bypass payment charge policies.

### 13A.5 Route metadata contract

Every school-admin route must declare access metadata in one route registry. Do not scatter route access strings across sidebar components.

Example shape:

```ts
export const SCHOOL_ADMIN_ROUTES = [
  {
    path: "/admin/students",
    label: "Students",
    requiredFeature: "core.students",
    requiredRoles: ["school_admin", "teacher"],
    lockedBehavior: "show_locked_state",
  },
  {
    path: "/admin/lesson-notes",
    label: "Lesson Notes",
    requiredFeature: "academics.lesson_notes",
    requiredRoles: ["school_admin", "teacher"],
    lockedBehavior: "show_upgrade_card",
  },
  {
    path: "/admin/leo",
    label: "Leo AI",
    requiredFeature: "ai.leo",
    requiredRoles: ["school_admin", "teacher"],
    requiredLimit: "leo_ai_credits",
    lockedBehavior: "show_credit_or_upgrade_state",
  },
] as const;
```

This metadata must power:

- Sidebar visibility.
- Dashboard quick actions.
- Page-level guards.
- Automated route-gating tests.

### 13A.6 API guard contract

Every protected API route/server action must declare its feature requirement close to the handler.

Example:

```ts
await requireSchoolFeature({
  schoolId,
  userId,
  feature: "academics.lesson_notes",
  action: "lesson_notes.create",
});
```

For usage-based features:

```ts
await requireSchoolFeature({
  schoolId,
  userId,
  feature: "ai.lesson_generation",
  action: "ai.generate_lesson_note",
});

await requireUsageBalance({
  schoolId,
  userId,
  meter: "leo_ai_credits",
  amount: 5,
  action: "ai.generate_lesson_note",
});
```

For payment flows:

```ts
const chargePolicy = await resolvePaymentChargePolicy({
  schoolId,
  category: "school_fee",
  amountMinor,
  payerType: "parent",
});
```

No payment intent, checkout session, Paystack initialization, admission payment, or companion-app payment should be created without the central payment charge resolver.

### 13A.7 Direct URL and deep-link protection

The app must assume users will try direct URLs and mobile deep links.

Required behavior:

- Locked page route: render `LockedFeatureState`.
- Expired subscription: render `SubscriptionRequiredState`.
- Role mismatch: render `UnauthorizedState`.
- Unknown school context: redirect to safe school selector or support page.
- API route: return structured `403` with `code: "FEATURE_LOCKED"`, `feature`, `requiredPlan`, and safe upgrade metadata.

Do not redirect locked features to the dashboard without explanation. That hides problems and makes debugging harder.

### 13A.8 Companion mobile app protection

The mobile app must not be trusted to calculate feature access or transaction fees.

Rules:

1. Mobile can display entitlement summaries from the backend.
2. Mobile must call backend APIs for payment creation, admission payments, Learn activation, meetings, and AI actions.
3. Backend must enforce the same `requireSchoolFeature`, `requireUsageBalance`, and `resolvePaymentChargePolicy` logic used by web.
4. Mobile deep links must be treated like direct URL access.

### 13A.9 Upload and storage leakage prevention

For UploadThing, Cloudinary, or any direct-upload provider, never allow the client to upload just because it has a UI button.

Rules:

1. The upload permission/signature endpoint must check `documents.basic` or the relevant document feature.
2. The endpoint must check storage limits before issuing upload permission.
3. The backend must record the expected upload size and reconcile actual uploaded size after completion.
4. If upload succeeds but metadata save fails, create a recovery/audit event.
5. Extra storage add-ons must be included in storage-limit resolution.

### 13A.10 AI credit leakage prevention

Leo AI and related AI tools must use a reserve/finalize pattern.

Required flow:

```txt
1. Check feature access.
2. Estimate required credits.
3. Reserve credits atomically.
4. Run AI action.
5. Finalize actual usage.
6. Refund/release reserved credits if the AI action fails.
7. Write usage event either way.
```

No AI endpoint may call an LLM before feature and credit checks pass.

### 13A.11 Meeting credit leakage prevention

Meetings must use participant-minute accounting.

Required flow:

```txt
1. Check meetings feature access.
2. Estimate participant-minutes from duration × expected participants.
3. Require available credits or included plan allowance.
4. Reserve credits when scheduling.
5. Reconcile actual usage after meeting ends.
6. Bill or deduct overage according to school policy.
```

Premium may include meeting credits but must not have unlimited meetings unless platform admin explicitly grants a written override.

### 13A.12 Payment charge leakage prevention

Every payment flow must resolve charges server-side.

Payment categories include at minimum:

- `school_fee`
- `admission_fee`
- `store_payment`
- `learn_subscription`
- `meeting_credit_purchase`
- `leo_credit_purchase`
- `storage_addon_purchase`
- `event_or_trip_payment`
- `donation_or_fundraising`

The resolver must support:

- Global default.
- Per-school override.
- Per-category override.
- Cap/floor.
- Payer pays / school absorbs / waived.
- Audit event for unusual waivers or manual overrides.

The frontend can show an estimate, but the backend-calculated charge is final.

---

## 13B. Post-Shipping Leakage Detection and Inconsistency Monitoring

Yes, EduSentrix can catch subscription inconsistencies and feature leakages after shipping. This must be built as a combination of automated tests, runtime audit logs, scheduled scans, and admin-visible alerts.

### 13B.1 Gating test matrix

Create a machine-readable test matrix from the same feature registry and plan entitlement map used by the app.

Each feature should have tests for:

- Pilot disabled.
- Pilot enabled.
- Starter.
- Growth.
- Premium.
- Expired subscription.
- Grace period.
- Read-only state.
- School-specific override enabled.
- School-specific override disabled.

For each state, test:

- Sidebar/navigation visibility.
- Direct page URL access.
- Create/update/delete API access.
- Usage-based action access.
- Payment charge calculation, where applicable.

### 13B.2 CI leakage tests

Add automated tests that run before merge/deploy.

Minimum test types:

1. **Feature registry completeness test**
   - Every route requiring subscription access has a registered feature key.
   - Every registered feature key appears in the plan matrix.
   - No unknown feature strings are used in code.

2. **Route gating test**
   - Every route in the school admin nav registry has `requiredFeature` unless it is explicitly public/safe.
   - Direct URL access for locked features returns locked state.

3. **API gating test**
   - Every protected API mutation includes `requireSchoolFeature`.
   - AI APIs include `requireUsageBalance`.
   - Upload APIs include storage checks.
   - Payment APIs include `resolvePaymentChargePolicy`.

4. **Plan matrix test**
   - Starter cannot access Growth/Premium-only features.
   - Growth cannot access Premium-only full features.
   - Pilot cannot access any feature not explicitly enabled.
   - Premium still respects usage limits.

5. **Payment charge test**
   - Every payment category resolves a charge policy.
   - Per-school overrides beat global defaults.
   - Category overrides are applied correctly.
   - Waivers are audited.

### 13B.3 Static leakage scanner

Create a script such as:

```txt
pnpm audit:feature-gates
```

The script should scan the codebase for risky patterns:

- API routes under protected modules that do not call `requireSchoolFeature`.
- AI endpoints that call model providers before checking credits.
- Payment initialization endpoints that do not call `resolvePaymentChargePolicy`.
- Upload signature endpoints that do not check storage entitlement.
- Hardcoded feature strings not imported from `FEATURE_KEYS`.
- Direct `hasFeature()` checks in UI without corresponding server guard.
- Routes added to sidebar without route metadata.

This scanner does not replace tests, but it catches common mistakes by AI agents.

### 13B.4 Runtime denied-access audit events

When a gate blocks a school, write a lightweight audit event.

Event examples:

- `feature.access_denied`
- `feature.locked_page_viewed`
- `api.feature_blocked`
- `usage.insufficient_credits`
- `payment.charge_policy_missing`
- `subscription.expired_access_blocked`
- `pilot.feature_not_enabled`

Each event should include:

- `schoolId`
- `userId`
- `featureKey`
- `action`
- `routeOrEndpoint`
- `subscriptionPlan`
- `subscriptionStatus`
- `reasonCode`
- `timestamp`

This helps identify confusing UX, attempted bypasses, and missed upgrades.

### 13B.5 Runtime allowed-access audit sampling

For high-risk actions, log successful access too.

High-risk actions include:

- AI generation.
- Meeting scheduling.
- Payment initialization.
- Admission payment setup.
- File upload permission/signature creation.
- Advanced export.
- Plan override update.
- Feature override update.

Do not log sensitive content. Log only metadata.

### 13B.6 Scheduled entitlement consistency scanner

Create a scheduled job that runs daily, or at least before/after deployments.

The job should detect:

- Schools with expired subscriptions but active entitlements.
- Schools with active AI usage but no AI entitlement.
- Schools with meeting usage but no meeting entitlement/add-on.
- Schools with Learn students active but no Learn add-on/seat purchase.
- Schools that exceeded storage limit.
- Payments created without a payment charge policy.
- Pilot schools with no expiry date.
- Pilot schools with broad wildcard/full-access overrides.
- Unknown feature keys stored in overrides.
- Entitlement snapshots older than the latest plan/subscription update.

Suggested command:

```txt
pnpm audit:entitlements
```

### 13B.7 Platform admin leakage dashboard

Add a platform-admin-only view later:

```txt
/platform/subscriptions/leakage-audit
```

Show clean cards, not a cluttered table-first UI.

Recommended cards:

- Possible access leakage.
- Missing payment charge policy.
- Expired schools still active.
- AI usage without valid credits.
- Meeting usage without valid credits.
- Storage over limit.
- Pilot schools needing review.
- Unknown/legacy feature keys.

Each card should have:

- Count.
- Severity.
- Latest detected date.
- View details button.
- Resolve/acknowledge action.

### 13B.8 Release checklist before enabling gates

Before shipping enforcement, the AI agent must confirm:

- Feature registry is complete.
- Plan matrix is complete.
- Route metadata exists for all school-admin routes.
- API mutation guards are implemented.
- Usage gates are implemented for AI, meetings, storage, and Learn seats.
- Payment charge resolver is integrated into every payment creation flow.
- Locked states render correctly.
- Platform admin can override school access safely.
- Audit events are written for overrides and denied access.
- Leakage audit scripts pass.
- Manual smoke test completed for Pilot, Starter, Growth, Premium, expired, and grace states.

### 13B.9 Severity levels

Use these severities for leakage audit findings:

| Severity | Meaning | Example | Required action |
|---|---|---|---|
| Critical | Revenue/cost/security leakage | Starter generated AI content | Fix before deploy or hotfix immediately |
| High | Paid feature exposed incorrectly | Growth accessed full Premium exams | Fix in current sprint |
| Medium | Confusing or inconsistent UI | Locked nav hidden but direct page shows partial shell | Fix before broad rollout |
| Low | Metadata/audit issue | Missing reason text in audit event | Fix when touching area |

### 13B.10 AI-agent prompt for leakage hardening

Use this prompt when assigning an AI agent to harden a module:

```txt
You are working inside the EduSentrix Web Platform. Read AGENTS.md and the subscription spec first. Harden the selected module against subscription leakage. Do not redesign unrelated UI. For the selected module, identify its feature key, route metadata, page guard, API/server-action guard, usage-limit checks if any, payment charge checks if any, and audit events. Use FEATURE_KEYS only; do not create raw string keys. Ensure Starter, Growth, Premium, Pilot disabled, Pilot enabled, expired, and grace states behave correctly. Add or update tests for direct URL access and API access. Keep UI clean, glassy, and not overloaded. Return a summary of changed files and any remaining risk.
```


## 14. Platform Admin UI

Create a dedicated section:

```txt
/platform/subscriptions
```

Suggested sub-routes:

```txt
/platform/subscriptions
/platform/subscriptions/plans
/platform/subscriptions/schools
/platform/subscriptions/payment-charges
/platform/subscriptions/add-ons
/platform/subscriptions/usage
/platform/subscriptions/invoices
/platform/subscriptions/settings
```

### 14.1 UI design standard

Use the existing glass UI:

- `WorkspacePageShell`
- `WorkspacePageHeader`
- dark glass panels
- restrained teal/cyan accents
- compact operational layouts
- no overloaded KPI wall
- no marketing-style hero sections
- responsive cards and tables

### 14.2 Platform Overview page

Purpose: quick revenue and risk summary.

Sections:

1. Header with title “Subscriptions & Revenue”.
2. Four compact KPI cards:
   - Active schools
   - Term subscription revenue
   - Transaction fee revenue
   - Schools needing attention
3. Clean plan distribution card.
4. Upcoming renewals list.
5. Schools in pilot list.
6. Recent subscription events.

Keep information scannable. Avoid showing every metric on the first page.

### 14.3 Plans page

Purpose: manage plan definitions.

UI:

- Plan cards for Pilot, Starter, Growth, Premium.
- Each card shows:
  - Plan name
  - Visibility
  - Active status
  - Price per student
  - Minimum fee
  - Included credits summary
  - Number of enabled features
- Actions:
  - Edit plan
  - Duplicate version
  - Activate/deactivate
  - View features

Plan edit should use a wizard or tabbed drawer:

1. Basics
2. Pricing
3. Features
4. Limits & Credits
5. Transaction defaults
6. Review

Do not place all fields in one giant form.

### 14.4 School Subscriptions page

Purpose: manage every school’s subscription state.

Table columns:

- School
- Plan
- Status
- Active students
- Current amount
- Renewal/expiry date
- Payment charge policy
- Add-ons
- Last payment
- Actions

Filters:

- Plan
- Status
- Renewal soon
- Pilot schools
- Past due
- Custom pricing

Actions:

- Assign/change plan
- Set custom pricing
- Set feature overrides
- Extend pilot
- Start grace
- Suspend
- Reactivate
- View usage
- View events

### 14.5 School subscription detail page

Can live at:

```txt
/platform/schools/[id]/subscription
```

Sections:

1. Current subscription summary
2. Pricing calculation
3. Feature access
4. Usage and credits
5. Payment charge policy
6. Add-ons
7. Billing history
8. Event timeline

Do not overload the page. Use tabs:

- Overview
- Pricing
- Features
- Charges
- Usage
- Events

### 14.6 Payment Charges page

Purpose: manage transaction fee policies.

Sections:

1. Global default charge
2. Category-specific charges
3. School overrides
4. Recent charge changes

UI for each policy:

- Category
- Rate
- Cap
- Payer mode
- Active status
- Last updated

Use clear labels:

- “Parent/payer pays”
- “School absorbs”
- “Waived”

Avoid technical labels like `payer_pays` in the UI.

### 14.7 Add-ons page

Purpose: manage purchasable packages.

Tabs:

- Leo AI Credits
- Meeting Credits
- Learn Seats
- Storage
- Future: Communication Credits

Each package card shows:

- Name
- Quantity
- Price
- Eligible plans
- Expiry behavior
- Active status

### 14.8 Usage page

Purpose: track school usage that affects cost and pricing.

Filters:

- School
- Plan
- Usage category
- Date/term

Cards/charts:

- AI credits consumed
- Meeting participant-minutes
- Storage usage
- Payment volume
- Transaction count
- Top high-cost schools

Do not overbuild analytics in the first implementation. Start with simple cards and tables.

---

## 15. School Admin UI

Create a school-admin page:

```txt
/admin/subscription
```

This page should also be reachable from settings, but it deserves a direct route because billing matters.

### 15.1 Page layout

Use clean glass UI with sections:

1. Current plan card
2. Renewal and payment status
3. Feature access checklist
4. Usage cards
5. Add-ons
6. Billing history

### 15.2 Current plan card

Show:

- Current plan
- Status
- Renewal/expiry date
- Active student count
- Current billing amount
- Billing cadence
- Payment charge summary

Example copy:

```txt
Growth Plan
Active until 14 August 2026
487 active students
GHS 7,305 per term
```

### 15.3 Feature access checklist

Group features, do not list 100 raw feature keys.

Groups:

- Core Records
- Admissions & Payments
- Academics
- AI & Automation
- Learn & Meetings
- Analytics

Use simple status pills:

- Included
- Add-on
- Locked
- Pilot-enabled

### 15.4 Usage cards

Show only the most important usage items:

- Leo AI credits remaining
- Meeting credits remaining
- Storage used
- Payment volume this term
- Learn active seats

Do not show technical metrics like provider tokens unless in advanced detail.

### 15.5 Add-ons section

Cards:

- Buy Leo AI credits
- Buy meeting credits
- Activate Edusentrix Learn
- Buy extra storage

If purchase flow is not implemented yet, show disabled buttons with honest copy:

```txt
Purchasing will be available after platform billing setup is complete.
```

### 15.6 Billing history

Show:

- Subscription invoices
- Add-on purchases
- Payment receipts
- Status
- Date
- Amount

### 15.7 Locked module UX

When school admin opens a locked module, show:

- Module name
- Why it is locked
- Which plan unlocks it
- What value the module provides
- Action to request upgrade if implemented

Keep it small and premium. Do not turn locked pages into aggressive sales pages.

---

## 16. Admissions Fee Integration

The admissions module should allow schools to collect admission/application fees.

### 16.1 Admission cycle settings

When school admin creates or edits an admission cycle, allow:

- Application fee amount
- Currency
- Payment required before submission
- Payment required before review
- Waiver support
- Waiver code
- Payment deadline
- Refund policy/help text

### 16.2 Admission payment flow

Applicants should be able to:

1. Start application.
2. Fill required fields.
3. Pay application fee if required.
4. Submit application after payment confirmation.

### 16.3 Platform charge

Admission fee payments should pass through the transaction charge resolver.

Example:

- Admission fee: GHS 50
- Platform charge: 2%
- Payer mode: payer pays
- Applicant pays: GHS 51

### 16.4 Starter plan

Admissions and admission fees should be included in Starter because this is a core school admin/revenue feature.

---

## 17. API Design

### 17.1 Platform admin API routes

Recommended route group:

```txt
/api/platform/subscriptions/overview
/api/platform/subscriptions/plans
/api/platform/subscriptions/plans/[id]
/api/platform/subscriptions/schools
/api/platform/subscriptions/schools/[schoolId]
/api/platform/subscriptions/schools/[schoolId]/pricing
/api/platform/subscriptions/schools/[schoolId]/features
/api/platform/subscriptions/schools/[schoolId]/charges
/api/platform/subscriptions/schools/[schoolId]/events
/api/platform/subscriptions/payment-charges
/api/platform/subscriptions/add-ons
/api/platform/subscriptions/usage
```

### 17.2 School admin API routes

Recommended routes:

```txt
/api/admin/subscription/summary
/api/admin/subscription/usage
/api/admin/subscription/add-ons
/api/admin/subscription/billing-history
/api/admin/subscription/request-upgrade
```

### 17.3 Entitlement API

School-scoped users should fetch a compact entitlement snapshot:

```txt
/api/admin/entitlements
/api/teacher/entitlements
/api/parent/entitlements
/api/student/entitlements
```

Or use one role-aware route:

```txt
/api/me/entitlements
```

### 17.4 Response shape

Use consistent response shapes:

```ts
{
  success: true,
  data: ...
}
```

Errors:

```ts
{
  success: false,
  error: "Human readable message",
  code?: "FEATURE_LOCKED" | "LIMIT_REACHED" | "SUBSCRIPTION_EXPIRED"
}
```

---

## 18. Permissions

Platform subscription management must require platform permissions.

Use existing permission keys where possible:

- `platform.subscriptions.manage`
- `platform.billing.read`
- `platform.billing.manage`
- `platform.audit.read`
- `platform.schools.read`

Add only if necessary:

- `platform.subscriptionPlans.manage`
- `platform.paymentCharges.manage`
- `platform.addOns.manage`
- `platform.usage.read`

School admin subscription page should require school admin membership or equivalent school billing permission.

---

## 19. Implementation Slices for AI Agents

Each slice below is intentionally small. Agents should complete one slice at a time, run focused checks, and report changed files.

---

### Slice 1: Subscription architecture cleanup inventory

**Goal:** Produce an exact inventory of current subscription/billing/gating files and how they are used.

**Tasks:**

1. Search for subscription, entitlement, feature gating, billing, plan, and limit references.
2. List files that currently return always-allowed behavior.
3. List routes that already call `hasFeature`, `requireFeatureForSchool`, or `enforceSchoolLimit`.
4. Identify old feature keys used in the codebase.
5. Do not modify code.

**Acceptance criteria:**

- A short internal implementation note exists.
- No code behavior is changed.
- All risky legacy touchpoints are identified.

**AI prompt:**

```txt
Read AGENTS.md first. Inspect the EduSentrix web project for subscription, billing, entitlement, feature-gating, and limit-related files. Do not modify code. Produce a concise inventory of current models, helpers, API routes, pages, and disabled placeholder behavior. Highlight old feature keys and any routes already calling hasFeature, requireFeatureForSchool, or enforceSchoolLimit. Do not propose broad rewrites yet.
```

---

### Slice 2: Define feature and limit registries

**Goal:** Create central typed registries for feature keys and limit keys.

**Tasks:**

1. Create `src/lib/billing/feature-registry.ts`.
2. Create `src/lib/billing/limit-registry.ts`.
3. Export typed constants and helper types.
4. Add compatibility aliases for old feature keys discovered in Slice 1.
5. Do not wire gating yet.

**Acceptance criteria:**

- Feature keys are grouped by domain.
- Limit keys are typed.
- No route behavior changes.
- Existing imports are not broken.

**AI prompt:**

```txt
Create central feature and limit registries for EduSentrix subscription gating. Follow AGENTS.md. Use typed `as const` objects, helper union types, and compatibility aliases for existing legacy keys. Do not wire the registries into runtime gates yet. Keep the file names under `src/lib/billing`. Avoid changing behavior in existing routes.
```

---

### Slice 3: Normalize subscription statuses and pricing helpers

**Goal:** Build safe pure helpers for status normalization and price calculation.

**Tasks:**

1. Add or update pricing helper functions.
2. Implement student-count pricing formula.
3. Implement discount calculation.
4. Implement status normalization.
5. Add tests for pure helpers.

**Acceptance criteria:**

- Helpers are pure and easy to test.
- `trial/trialing` can be normalized if found.
- Price calculation supports per-student + minimum fee + overrides.
- Tests cover edge cases.

**AI prompt:**

```txt
Implement pure subscription pricing and status helpers only. Do not touch UI or API routes. Include tests using the repository's node test setup. Support per-student-per-term pricing with minimum fee, fixed override, percent discount, fixed discount, and status normalization from old values to the new simplified status set. Keep functions deterministic and strongly typed.
```

---

### Slice 4: Update data models safely

**Goal:** Align models with the new plan/subscription/add-on architecture.

**Tasks:**

1. Update `SubscriptionTier` or create a new conceptual `SubscriptionPlan` model while minimizing churn.
2. Update `SchoolSubscription` fields for snapshots, overrides, status, features, limits, charges.
3. Add `PaymentChargePolicy` if chosen.
4. Add `UsageBalance` if missing.
5. Add or confirm `UsageEvent`.
6. Add `AddOnPackage`.
7. Avoid destructive migrations.

**Acceptance criteria:**

- Models compile.
- Existing model names used elsewhere are not broken.
- Indexes support schoolId/status/date queries.
- No data deletion script is created.

**AI prompt:**

```txt
Read AGENTS.md and inspect existing Mongoose models before editing. Update subscription-related models to support the new spec while minimizing breaking changes. Prefer additive fields and compatibility over destructive renames. Add PaymentChargePolicy, UsageBalance, and AddOnPackage models if they do not exist. Keep schoolId scoping and indexes. Do not create destructive migrations.
```

---

### Slice 5: Seed default plans and add-on packages

**Goal:** Add a safe seed script for default plans.

**Tasks:**

1. Create `scripts/seed-subscription-plans.ts`.
2. Seed Pilot, Starter, Growth, Premium.
3. Seed default add-on packages.
4. Use upsert logic by code.
5. Support `--dryRun`.
6. Do not overwrite customized production values unless explicitly asked.

**Acceptance criteria:**

- Script supports dry run.
- Script logs planned changes.
- Existing customized plan records are not blindly overwritten.
- Seeded plan features match this spec.

**AI prompt:**

```txt
Create a safe seed script for EduSentrix subscription plans and add-on packages. Use upsert/find-or-create by code. Include `--dryRun`. Do not overwrite customized values unless the record is missing or clearly marked provisional. Seed Pilot, Starter, Growth, Premium, Leo credit packages, meeting participant-minute packages, and storage packages. Follow existing scripts style.
```

---

### Slice 6: Build entitlement resolver without enforcing gates

**Goal:** Build the new resolver while keeping enforcement disabled.

**Tasks:**

1. Create `resolveSchoolEntitlements()`.
2. Load school, subscription, plan, usage balances, and counts.
3. Return snapshot shape.
4. Add feature and limit helpers on snapshot.
5. Keep old `getSchoolSubscriptionSnapshot()` compatible by wrapping the new resolver.
6. Do not make `hasFeature()` block yet.

**Acceptance criteria:**

- Resolver returns accurate plan/status/features/limits.
- Existing callers still work.
- No user-facing behavior changes yet.
- Tests or manual route checks pass.

**AI prompt:**

```txt
Build the new school entitlement resolver as a read-only foundation. It should read the school, current subscription, plan snapshots, feature overrides, limits, usage balances, active student count, active teacher count, and payment readiness. Preserve compatibility with existing `getSchoolSubscriptionSnapshot`. Do not enforce feature blocking yet; this slice is observability only.
```

---

### Slice 7: Platform subscription overview UI

**Goal:** Create the platform-admin subscriptions overview page.

**Route:**

```txt
/platform/subscriptions
```

**Tasks:**

1. Add page shell using glass UI primitives.
2. Add compact KPI cards.
3. Add plan distribution.
4. Add upcoming renewals.
5. Add schools in pilot.
6. Add recent events.
7. Use real API data or honest empty states only.

**Acceptance criteria:**

- UI follows glass standard.
- No fake metrics are shown.
- Loading, empty, and error states exist.
- Page is responsive.

**AI prompt:**

```txt
Build the `/platform/subscriptions` overview page using the EduSentrix glass workspace UI. Use `WorkspacePageShell`, `WorkspacePageHeader`, `GlassPanel`, and existing UI primitives. Keep the page clean: four KPI cards maximum, plan distribution, upcoming renewals, pilot schools, and recent events. Do not use fake data. If API is not ready, show honest empty/disabled states.
```

---

### Slice 8: Platform plans management UI

**Goal:** Create plan management page and edit flow.

**Route:**

```txt
/platform/subscriptions/plans
```

**Tasks:**

1. Show four plan cards.
2. Build plan edit drawer/modal.
3. Split edit flow into sections:
   - Basics
   - Pricing
   - Features
   - Limits & Credits
   - Transaction Defaults
   - Review
4. Use `PremiumSelect`, `CustomDatePicker` where needed, `Switch`, `Checkbox`.
5. Avoid one giant form.

**Acceptance criteria:**

- Plan cards are easy to scan.
- Edit flow is not overloaded.
- Validation is clear.
- Actions are wired or honestly disabled.

**AI prompt:**

```txt
Create the platform plan management UI for EduSentrix. Follow AGENTS.md and glass UI standards. Build scannable plan cards and a clean edit drawer/modal split into Basics, Pricing, Features, Limits & Credits, Transaction Defaults, and Review. Avoid one giant overloaded form. Use real API integration if available; otherwise show disabled actions with honest copy.
```

---

### Slice 9: Platform school subscription management UI

**Goal:** Build school subscription list and detail surfaces.

**Routes:**

```txt
/platform/subscriptions/schools
/platform/schools/[id]/subscription
```

**Tasks:**

1. Build list/table with filters.
2. Build detail page tabs:
   - Overview
   - Pricing
   - Features
   - Charges
   - Usage
   - Events
3. Add actions for assigning plan, pricing override, feature override, pilot extension, suspend/reactivate.
4. Use confirmation dialog for risky actions.

**Acceptance criteria:**

- No destructive action uses browser confirm.
- Detail tabs are clean and not cluttered.
- School-specific pricing and charges are understandable.
- All actions require platform permission.

**AI prompt:**

```txt
Build platform school subscription management screens. Use glass UI and keep data dense but readable. Add a school subscriptions list with filters and a school subscription detail page with tabs for Overview, Pricing, Features, Charges, Usage, and Events. Risky actions must use the standard confirmation dialog. Do not show fake working controls.
```

---

### Slice 10: Payment charge policy engine

**Goal:** Implement transaction charge calculation and APIs.

**Tasks:**

1. Implement charge resolver precedence.
2. Implement charge calculator.
3. Add platform APIs to manage charge policies.
4. Add tests for payer pays, school absorbs, waived, caps, minimums.
5. Do not integrate into Paystack flow yet.

**Acceptance criteria:**

- Charge calculation is deterministic.
- Tests cover key cases.
- Existing payment flow is untouched.

**AI prompt:**

```txt
Implement the EduSentrix payment charge policy engine without integrating it into payment collection yet. Add resolver precedence: school-category, school-default, global-category, global-default. Support percentage, fixed, hybrid, min, max cap, and payer modes. Add focused tests. Do not change Paystack/webhook behavior in this slice.
```

---

### Slice 11: Integrate transaction charges into payment flows

**Goal:** Apply payment charges to selected payment categories.

**Tasks:**

1. Identify school fee and admission fee payment creation flows.
2. Apply charge calculator before Paystack initialization.
3. Store charge breakdown on payment intent/payment record.
4. Ensure webhook reconciliation can verify base amount + charge.
5. Show payer-facing charge breakdown.

**Acceptance criteria:**

- Charge is shown before payment.
- Payment records store full breakdown.
- Existing payment reconciliation is not broken.
- Tests or manual checks cover admission fee and school fee examples.

**AI prompt:**

```txt
Integrate the payment charge calculator into EduSentrix payment creation flows carefully. Start with school fees and admission fees only. Store base amount, platform charge, payer mode, total payable, and charge policy snapshot. Ensure Paystack initialization uses the correct total. Do not break existing payment webhook reconciliation.
```

---

### Slice 12: School admin subscription page

**Goal:** Build `/admin/subscription`.

**Tasks:**

1. Current plan card.
2. Renewal/payment status.
3. Feature access checklist.
4. Usage cards.
5. Add-ons section.
6. Billing history.

**Acceptance criteria:**

- Page is clean and not overloaded.
- No fake purchase flows.
- Locked or disabled features are clear.
- Mobile responsive.

**AI prompt:**

```txt
Build the school admin `/admin/subscription` page using EduSentrix glass UI. Show current plan, status, renewal date, active student count, billing amount, feature access, usage, add-ons, and billing history. Keep it clean and scannable. Do not use fake purchase buttons; disable unavailable actions honestly.
```

---

### Slice 13: Locked module UI component

**Goal:** Create reusable locked-state UI for gated modules.

**Tasks:**

1. Create `FeatureLockedPanel` component.
2. Props:
   - featureName
   - requiredPlan
   - description
   - currentPlan
   - requestUpgrade action optional
3. Use glass style.
4. Add examples in gated pages.

**Acceptance criteria:**

- Component is reusable.
- Copy is non-aggressive.
- Works on mobile.

**AI prompt:**

```txt
Create a reusable `FeatureLockedPanel` component for EduSentrix gated modules. Use glass UI styling. It should clearly explain the locked feature, current plan, required plan, and optional request-upgrade action. Keep the copy calm and premium, not salesy. Do not wire it into many pages yet; just create and demonstrate in one safe place if needed.
```

---

### Slice 14: Turn on frontend navigation gating

**Goal:** Hide or lock navigation items based on entitlement snapshot.

**Tasks:**

1. Identify admin/sidebar/bottom nav config files.
2. Add feature metadata to nav items.
3. Filter or mark locked items based on entitlements.
4. Avoid cluttering nav with many locked modules.
5. Do not enforce backend gates yet if not ready.

**Acceptance criteria:**

- Nav is role-safe and plan-aware.
- Core accessible items remain visible.
- Locked modules are not confusing.

**AI prompt:**

```txt
Add entitlement-aware navigation gating to EduSentrix admin navigation. Inspect existing nav/sidebar files first. Add feature metadata to nav items and use the school entitlement snapshot to hide or show locked states. Keep navigation clean; do not fill the sidebar with many locked items. Do not change backend enforcement in this slice.
```

---

### Slice 15: Enable backend feature gates gradually

**Goal:** Replace always-true gates with real feature checks for selected modules only.

**Tasks:**

1. Update `hasFeature()` to use resolver.
2. Update `requireFeatureForSchool()` to block unavailable features.
3. Start with non-core modules:
   - Lesson Notes
   - Schemes
   - Lessons
   - Leo AI
   - Examinations
   - Question Bank
   - Meetings
4. Do not gate Students/Fees/Admissions until tested.

**Acceptance criteria:**

- Locked routes return clear errors.
- Existing Starter core workflows continue to work.
- Tests cover at least one allowed and one blocked feature.

**AI prompt:**

```txt
Gradually enable backend feature gating. Replace always-true `hasFeature` and no-op `requireFeatureForSchool` with real entitlement checks, but only enforce non-core modules first: lesson notes, schemes, lessons, Leo AI, examinations, question bank, and meetings. Do not gate core students, fees, or admissions yet. Return clear structured errors.
```

---

### Slice 16: Usage credit enforcement for Leo AI

**Goal:** Deduct Leo credits for AI actions.

**Tasks:**

1. Define credit costs for Leo actions.
2. Add `requireUsageCredits()` helper.
3. Add `consumeUsageCredits()` helper.
4. Wrap selected Leo actions.
5. Log usage events.
6. Show remaining credits in school admin subscription page.

**Acceptance criteria:**

- AI actions fail clearly when credits are exhausted.
- Credits are deducted once per successful action.
- Failed AI actions do not consume credits unless explicitly configured.
- Usage is visible.

**AI prompt:**

```txt
Implement Leo AI credit enforcement for EduSentrix. Define action credit costs, add helpers to check and consume credits, and log usage events. Integrate only selected Leo actions first. Ensure failed AI actions do not double-charge. Show clear errors when credits are exhausted.
```

---

### Slice 17: Meeting credits enforcement

**Goal:** Gate meetings by participant-minutes.

**Tasks:**

1. Add meeting credit estimator.
2. Check credits before scheduling.
3. Reserve/deduct credits appropriately.
4. Show warning if estimate exceeds balance.
5. Track actual usage later if meeting provider events support it.

**Acceptance criteria:**

- Meeting creation checks participant-minutes.
- User sees required credits before scheduling.
- Insufficient credits blocks scheduling or prompts purchase.

**AI prompt:**

```txt
Implement meeting participant-minute credit checks. Before scheduling a meeting, estimate required participant-minutes from expected duration and participants. Check the school's balance and show clear errors if insufficient. Keep the UI clean and do not imply unlimited meetings.
```

---

### Slice 18: Admissions fee settings

**Goal:** Add admission fee collection to admission cycles.

**Tasks:**

1. Update admission cycle model/settings.
2. Add school admin UI fields.
3. Add validation.
4. Add applicant payment requirement logic.
5. Integrate transaction charges after charge engine is ready.

**Acceptance criteria:**

- School can set application fee.
- Applicant cannot complete submission if required fee is unpaid.
- Waiver logic is supported or honestly omitted.

**AI prompt:**

```txt
Add admission fee settings to EduSentrix admission cycles. Allow school admins to set application fee amount, payment requirement timing, payment deadline, waiver option, and refund/help text. Ensure applicant submission respects the payment requirement. Use existing payment patterns and do not break current admissions flow.
```

---

### Slice 19: Billing history and invoices

**Goal:** Show subscription and add-on billing records.

**Tasks:**

1. Identify or create billing invoice model if needed.
2. Store subscription invoices and add-on purchases.
3. Show platform and school billing history.
4. Link payment records where available.

**Acceptance criteria:**

- School admin can view billing history.
- Platform admin can view school billing history.
- Records are real, not fake.

**AI prompt:**

```txt
Implement billing history for EduSentrix subscriptions and add-ons. Reuse existing invoice/payment models if appropriate, or create a small billing record model if necessary. Show real records on platform and school subscription pages. Do not display fake invoice rows.
```

---

### Slice 20: Expiry, grace, and read-only behavior

**Goal:** Implement lifecycle transitions safely.

**Tasks:**

1. Create lifecycle evaluation helper.
2. Add script or scheduled-compatible function to mark expired subscriptions.
3. Add grace period behavior.
4. Add read-only access mode after grace.
5. Add platform admin manual override.

**Acceptance criteria:**

- No data is deleted.
- Expired schools retain access to subscription/payment/support pages.
- Creation/editing is blocked only after grace/read-only mode.

**AI prompt:**

```txt
Implement subscription lifecycle transitions for EduSentrix. Add helper logic for active, grace, restricted read-only, suspended, and expired states. Do not delete school data. Ensure expired schools can still view subscription/payment/support pages. Keep manual platform override possible and audited.
```

---

### Slice 21: Tests and verification hardening

**Goal:** Add focused tests for subscription logic.

**Tasks:**

1. Test pricing helpers.
2. Test status normalization.
3. Test entitlement resolver.
4. Test feature gates.
5. Test limit enforcement.
6. Test transaction charge calculator.
7. Test usage credit consumption.

**Acceptance criteria:**

- Tests run with existing `npm test` setup.
- Critical business logic is covered.
- No broad fragile UI snapshot tests.

**AI prompt:**

```txt
Add focused tests for EduSentrix subscription logic. Cover pricing, status normalization, entitlement resolution, feature gates, limits, transaction charge calculation, and usage credits. Use the repository's existing node test setup. Avoid broad fragile UI snapshot tests.
```

---

## 20. Rollout Plan

### Phase 1: Foundation without enforcement

- Inventory existing code.
- Add registries.
- Add model changes.
- Add seed script.
- Add resolver.
- Build platform overview and school admin read-only summary.

### Phase 2: Admin management UI

- Plans management.
- School subscription assignment.
- Pricing overrides.
- Payment charge policy management.
- Add-on package management.

### Phase 3: Soft gating

- Frontend navigation gating.
- Locked module UI.
- School admin visibility.
- No hard backend blocking yet except obvious locked AI/meeting routes.

### Phase 4: Backend enforcement

- Enable gates for non-core modules.
- Enable Leo credits.
- Enable meeting credits.
- Enable storage limits.

### Phase 5: Payment and admissions integration

- Transaction charge engine.
- School fees charge integration.
- Admission fees charge integration.
- Billing history.

### Phase 6: Lifecycle automation

- Renewal reminders.
- Grace periods.
- Read-only mode.
- Suspension/reactivation.
- Audit logs.

---

## 21. UI Copy Guidelines

### 21.1 Locked module copy

Use calm, professional copy.

Good:

```txt
Lesson Notes is available on Growth and Premium. Your current plan does not include this module.
```

Avoid:

```txt
Upgrade now to unlock amazing premium power features!!!
```

### 21.2 Usage warnings

Good:

```txt
Your school has 42 Leo credits left this term. This action requires 10 credits.
```

Good:

```txt
This meeting needs about 600 participant-minutes. Your current balance is 420.
```

### 21.3 Grace period copy

Good:

```txt
Your subscription is in grace period until 21 August 2026. Please renew to avoid read-only access.
```

---


### Slice 25: Add leakage-proof feature gating matrix

**Goal:** Convert the tier matrix in section 13A into code-backed registries and tests.

**Tasks:**

1. Create or update the canonical feature registry.
2. Create a plan entitlement map for Pilot, Starter, Growth, and Premium.
3. Ensure Pilot is deny-by-default.
4. Add tests that assert Starter cannot access Growth/Premium features, Growth cannot access Premium-only full features, and Premium still requires usage limits.
5. Add comments explaining that route/UI gating is not security.

**Acceptance criteria:**

- No feature key is used outside the registry.
- Every feature in the matrix has a plan decision.
- Pilot defaults to no protected feature unless explicitly enabled.
- Tests fail if a new feature is added without a plan decision.

**AI prompt:**

```txt
Implement the leakage-proof feature gating matrix from section 13A. Use a central FEATURE_KEYS registry and a plan entitlement map. Pilot must be deny-by-default. Do not add UI yet. Add tests that prove Starter cannot access Growth/Premium features, Growth cannot access Premium-only features, and Premium still respects usage-based limits. Do not use raw string feature keys.
```

---

### Slice 26: Add route and page-level gating coverage

**Goal:** Make sure direct URLs cannot leak locked features.

**Tasks:**

1. Create a route metadata registry for school-admin routes.
2. Add required feature metadata to every protected route.
3. Wire sidebar/navigation to the same route registry.
4. Add a reusable page guard that renders clean locked states.
5. Add tests for direct URL access under Starter, Growth, Premium, Pilot disabled, and expired states.

**Acceptance criteria:**

- Sidebar and page guards use the same metadata.
- Locked routes render `LockedFeatureState`, not broken pages.
- Expired schools see subscription/renewal state.
- A route cannot be added to navigation without access metadata.

**AI prompt:**

```txt
Add route and page-level subscription gating for school-admin routes. Use one route metadata registry as the source of truth for sidebar visibility and page guards. Do not scatter feature checks in sidebar components. Direct URL access to locked features must render a clean glass-style locked state. Add tests for Starter, Growth, Premium, Pilot disabled, and expired states.
```

---

### Slice 27: Add API/server-action leakage guards

**Goal:** Ensure protected features cannot be used through direct API calls.

**Tasks:**

1. Audit protected API routes/server actions.
2. Add `requireSchoolFeature` to each protected mutation.
3. Add structured `FEATURE_LOCKED` responses.
4. Ensure schoolId is validated from auth context, not trusted from the client.
5. Add API tests for locked and allowed states.

**Acceptance criteria:**

- UI-hidden features cannot be accessed by direct API calls.
- Locked APIs return structured 403 errors.
- Every protected mutation has a feature guard.
- Tests prove blocked access for Starter to Growth/Premium modules.

**AI prompt:**

```txt
Harden protected API routes and server actions against subscription leakage. Add requireSchoolFeature to every protected mutation. Validate schoolId through auth context. Return structured FEATURE_LOCKED errors. Do not rely on frontend checks. Add tests proving direct API calls are blocked for locked plans.
```

---

### Slice 28: Add usage and payment leakage guards

**Goal:** Prevent cost leakage from AI, meetings, storage, Learn seats, and payment flows.

**Tasks:**

1. Add reserve/finalize credit flow for Leo AI.
2. Add participant-minute credit checks for meetings.
3. Add storage checks before upload permission/signature creation.
4. Add Learn seat checks before student activation.
5. Ensure all payment creation flows use `resolvePaymentChargePolicy`.
6. Add tests for insufficient credits, exhausted allowances, and missing charge policy.

**Acceptance criteria:**

- No AI call can run before credits are checked/reserved.
- No meeting can be scheduled without sufficient meeting allowance/credits.
- No upload permission is issued beyond storage allowance.
- No payment intent is created without server-side charge resolution.

**AI prompt:**

```txt
Implement usage and payment leakage guards. AI must use check/reserve/finalize credits. Meetings must use participant-minute estimates. Upload permission endpoints must enforce storage limits before issuing upload signatures. Learn activation must enforce seat limits. All payment creation flows must call resolvePaymentChargePolicy server-side. Add tests for insufficient credits and missing charge policy.
```

---

### Slice 29: Add post-shipping leakage audits

**Goal:** Detect inconsistencies after deployment.

**Tasks:**

1. Add a static feature-gate scanner command.
2. Add scheduled entitlement consistency scanner logic.
3. Add audit events for denied access and high-risk allowed actions.
4. Add platform-admin leakage audit summary data endpoint.
5. Add initial glass UI cards for leakage audit findings if time permits.

**Acceptance criteria:**

- `pnpm audit:feature-gates` catches missing route/API guard patterns.
- `pnpm audit:entitlements` detects expired schools with active entitlements, AI usage without AI access, meeting usage without credits, Learn usage without seats, and payments without charge policy.
- Denied access events are logged with schoolId, userId, featureKey, action, reasonCode, and timestamp.
- High-risk allowed actions are sampled/logged without sensitive content.

**AI prompt:**

```txt
Add post-shipping subscription leakage detection. Create a static scanner for missing feature gates and a scheduled entitlement consistency scanner for runtime inconsistencies. Add audit events for denied access and high-risk allowed actions. Do not log sensitive content. Keep any platform-admin UI clean and glass-style with summary cards first.
```

---

## 22. Important Safety Rules for AI Agents

1. Read `AGENTS.md` before editing.
2. Do not introduce a new payment provider.
3. Do not introduce a new database.
4. Do not remove existing school data.
5. Do not gate core modules until the foundation is tested.
6. Do not show fake revenue or fake billing records.
7. Do not create overloaded forms.
8. Do not use raw browser date inputs in polished admin flows.
9. Do not use `window.confirm`, `alert`, or `prompt`.
10. Do not bypass schoolId scoping.
11. Do not trust client-provided schoolId without auth context validation.
12. Do not make Premium unlimited for AI, meetings, or storage.
13. Do not mix transaction fees into subscription plan pricing.
14. Do not make Pilot public/self-service.
15. Do not create broad refactors outside the selected slice.
16. Do not implement a protected feature without route, page, API, and usage/payment gates where applicable.
17. Do not add a new school-admin route without route metadata and a feature decision.
18. Do not add a new payment flow without `resolvePaymentChargePolicy`.
19. Do not call Leo AI or any model provider before checking and reserving credits.
20. Do not issue upload permissions before checking storage entitlement.
21. Do not allow Pilot access through inherited public plan defaults.
22. Do not ship subscription enforcement unless leakage audit tests pass.

---

## 23. Final Recommended Navigation

### Platform Admin

```txt
Platform Admin
  └── Subscriptions & Revenue
        ├── Overview
        ├── Plans
        ├── School Subscriptions
        ├── Payment Charges
        ├── Add-ons & Credits
        ├── Usage
        ├── Invoices
        └── Settings
```

### School Admin

```txt
School Admin
  └── Subscription & Billing
        ├── Current Plan
        ├── Feature Access
        ├── Usage
        ├── Add-ons
        └── Billing History
```

---

## 24. Final Product Decision Summary

- Keep four levels: Pilot, Starter, Growth, Premium.
- Pilot is custom and platform-admin controlled.
- Starter is for basic records, admissions, fees, and payments.
- Growth is the recommended plan with academics and basic Leo AI.
- Premium is the full operating system with advanced analytics, automation, higher credits, audit/compliance, and meeting access.
- Edusentrix Learn remains a separate add-on/service.
- Meetings use participant-minute credits.
- Leo AI uses credit-based consumption.
- Payment charges are separate from subscriptions.
- Admission fees should be supported and charged through the same transaction fee system.
- Gating should be introduced gradually, starting with non-core modules.
- UI must remain clean, glassy, premium, and truthful.



---

# 25. Senior Rebuild Hardening Addendum — May 2026

This addendum supersedes any earlier ambiguous subscription implementation guidance. It exists to prevent AI agents from mixing old subscription keys, removed UI files, and new architecture during the rebuild.

## 25.1 Final implementation decision

We are **renaming and replacing the old feature-key system completely**.

Do **not** support long-term aliases.
Do **not** keep old feature keys as active entitlement keys.
Do **not** build new plan logic on top of `lesson_notes`, `ai_leo_copilot`, `edusentrix_learn`, `fees`, `payments`, or other legacy flat keys.

The final system must use the canonical dotted feature keys from the new registry, for example:

```ts
"academics.lesson_notes"
"ai.leo"
"learn.manage"
"finance.payments"
```

Legacy keys may only appear inside a **temporary migration scanner/report** whose job is to find and remove them. They must not be accepted by the runtime entitlement resolver after the migration slice is complete.

## 25.2 Repo delta as of May 2026

The current repo state is a rebuild state, not a finished subscription state.

Known current conditions:

1. Old subscription/billing UI routes may be removed or incomplete.
2. Old subscription-related models still exist in the codebase.
3. Current gating stubs intentionally allow access while the rebuild is pending.
4. Some previous docs/specs mention deleted routes such as old platform billing pages, school subscription editor pages, or `/admin/billing` screens.
5. New agents must **rebuild per this spec** and must not assume those deleted pages exist.

The following current files are known to contain old subscription concepts or disabled gating behavior and must be treated as rebuild targets:

```txt
src/lib/billing/feature-access.ts
src/lib/billing/entitlements.ts
src/lib/billing/require-entitlement.ts
src/lib/billing/check-usage-limit.ts
src/lib/billing/require-school-write-access.ts
src/lib/billing/resolve-school-access-mode.ts
src/lib/auth/requireFeature.ts
src/lib/billing/transaction-fees.ts
src/lib/platform-billing/subscription-pricing.ts
src/models/SubscriptionTier.ts
src/models/SchoolSubscription.ts
src/models/SubscriptionEvent.ts
src/models/SubscriptionCheckoutIntent.ts
src/models/PlatformBillingSettings.ts
src/models/AIFeatureUsageEvent.ts
src/models/LearnPaymentIntent.ts
src/models/Payment.ts
src/models/PaymentIntent.ts
src/models/PaymentAuditEvent.ts
```

Agents must inspect the actual tree before editing. If a route or component in this spec does not exist, create it cleanly using the new architecture instead of trying to resurrect old deleted UI.

## 25.3 New single source of truth file paths

Use these file paths for the new subscription rebuild unless the actual repo structure forces a minor adjustment. If a path already exists with legacy code, replace it carefully with the new implementation rather than creating duplicate competing files.

```txt
src/lib/subscriptions/feature-keys.ts
src/lib/subscriptions/limit-keys.ts
src/lib/subscriptions/plan-codes.ts
src/lib/subscriptions/plan-entitlements.ts
src/lib/subscriptions/role-entitlement-rules.ts
src/lib/subscriptions/route-feature-registry.ts
src/lib/subscriptions/api-feature-registry.ts
src/lib/subscriptions/resolve-school-entitlements.ts
src/lib/subscriptions/require-feature-for-school.ts
src/lib/subscriptions/require-usage-balance.ts
src/lib/subscriptions/resolve-school-access-mode.ts
src/lib/subscriptions/resolve-payment-charge-policy.ts
src/lib/subscriptions/subscription-errors.ts
src/lib/subscriptions/subscription-audit.ts
src/lib/subscriptions/legacy-feature-key-scanner.ts
src/lib/subscriptions/README.md
```

Recommended UI paths:

```txt
src/app/(platform)/platform/subscriptions/page.tsx
src/app/(platform)/platform/subscriptions/plans/page.tsx
src/app/(platform)/platform/subscriptions/schools/page.tsx
src/app/(platform)/platform/subscriptions/schools/[schoolId]/page.tsx
src/app/(platform)/platform/subscriptions/payment-charges/page.tsx
src/app/(platform)/platform/subscriptions/add-ons/page.tsx
src/app/(platform)/platform/subscriptions/usage/page.tsx
src/app/(app)/admin/subscription/page.tsx
```

If the project uses a different platform route group, adapt the route group but keep the same page responsibilities.

## 25.4 Legacy-to-canonical feature key migration map

This map is for **replacement**, not aliasing. Agents must replace old keys in callers, route metadata, API guards, tests, seed data, and old entitlement logic.

| Legacy key / concept | Canonical replacement | Notes |
|---|---|---|
| `core_school_ops` | `core.school_profile`, `core.academic_periods`, `core.classes` | Split broad key into explicit core features. |
| `students` | `core.students` | Student records and student CRUD. |
| `teachers` | `core.teachers` | Teacher/staff records and teacher CRUD. |
| `invitations` | `core.invitations` | Invite/onboarding flow. |
| `fees` | `finance.fees` | Fee setup and fee invoices. |
| `payments` | `finance.payments` | Payment collection and payment records. |
| `parent_payments` | `finance.parent_payments` | Parent-facing payment flows. |
| `disbursements` | `finance.disbursements` | Settlement/payout/admin finance operations. |
| `reports` | `analytics.basic` | Basic reports only. |
| `analytics` | `analytics.advanced` | Advanced analytics. Basic reports should use `analytics.basic`. |
| `curriculum_scheme` | `academics.schemes` | Scheme of Learning / curriculum planning. |
| `lesson_notes` | `academics.lesson_notes` | Lesson notes authoring and management. |
| `edusentrix_learn` | `learn.manage` and/or `learn.student_access` | School admin manages Learn seats via `learn.manage`; mobile student access uses `learn.student_access`. |
| `examinations` | `assessment.examinations` | Exam setup and exam management. |
| `question_bank` | `assessment.question_bank` | Question bank authoring and reuse. |
| `ai_lesson_notes` | `ai.lesson_generation` | AI-powered lesson note generation. Requires `ai.leo` too. |
| `ai_leo_copilot` | `ai.leo` | General Leo assistant access. |
| `community` | `communications.community` | Community feature if retained. |
| `community_hub` | `communications.community` | Merge into one key unless separate product need emerges. |
| `enterprise` | remove as feature key | Enterprise/Premium is a plan level, not a feature. |
| `api_access` | `developer.api_access` | Only if external/public API access is actually offered. Otherwise remove. |
| `priority_support` | `support.priority` | Support level feature/benefit. |

## 25.5 Canonical feature registry v1

Use a typed registry with metadata. Do not use raw string literals throughout the app.

```ts
export const FEATURE_KEYS = {
  SCHOOL_PROFILE: "core.school_profile",
  ACADEMIC_PERIODS: "core.academic_periods",
  CLASSES: "core.classes",
  STUDENTS: "core.students",
  TEACHERS: "core.teachers",
  PARENTS: "core.parents",
  INVITATIONS: "core.invitations",

  ADMISSIONS: "admissions.applications",
  ADMISSION_FEES: "admissions.fees",

  FINANCE_FEES: "finance.fees",
  FINANCE_PAYMENTS: "finance.payments",
  FINANCE_PARENT_PAYMENTS: "finance.parent_payments",
  FINANCE_RECONCILIATION: "finance.reconciliation",
  FINANCE_DISBURSEMENTS: "finance.disbursements",
  FINANCE_REPORTS: "finance.reports",

  COMMUNICATION_NOTICES: "communications.notices",
  COMMUNICATION_MESSAGING: "communications.messaging",
  COMMUNICATION_COMMUNITY: "communications.community",

  ACADEMICS_SUBJECTS: "academics.subjects",
  ACADEMICS_CURRICULUM: "academics.curriculum",
  ACADEMICS_SCHEMES: "academics.schemes",
  ACADEMICS_LESSON_NOTES: "academics.lesson_notes",
  ACADEMICS_LESSONS: "academics.lessons",

  ASSESSMENT_EXAMINATIONS: "assessment.examinations",
  ASSESSMENT_QUESTION_BANK: "assessment.question_bank",

  AI_LEO: "ai.leo",
  AI_LESSON_GENERATION: "ai.lesson_generation",
  AI_ANALYTICS: "ai.analytics",
  AI_EXAM_GENERATION: "ai.exam_generation",

  LEARN_MANAGE: "learn.manage",
  LEARN_STUDENT_ACCESS: "learn.student_access",

  MEETINGS_VIDEO: "meetings.video",

  ANALYTICS_BASIC: "analytics.basic",
  ANALYTICS_ADVANCED: "analytics.advanced",

  DOCUMENTS_STORAGE: "documents.storage",
  DOCUMENTS_EXPORTS: "documents.exports",

  SUPPORT_PRIORITY: "support.priority",
  DEVELOPER_API_ACCESS: "developer.api_access",
} as const;
```

Every feature should have metadata:

```ts
type FeatureDefinition = {
  key: FeatureKey;
  label: string;
  description: string;
  module: string;
  riskLevel: "low" | "medium" | "high";
  requiresUsageCheck?: boolean;
  requiresPaymentChargeCheck?: boolean;
  allowedForRoles?: SchoolRole[];
};
```

## 25.6 Do not use runtime aliases

To prevent leakage and dead keys, the final resolver must reject unknown feature keys.

Required behavior:

```ts
assertKnownFeatureKey(featureKey)
```

If an unknown feature key is used:

1. In development: throw a hard error.
2. In test/CI: fail the test.
3. In production: deny access, log a critical audit event, and return a safe locked response.

Do not silently allow unknown keys.

## 25.7 Migration process that avoids breakage

Because the app is being rebuilt but still contains existing modules, use a controlled replacement process.

### Step 1: Introduce canonical registry without enforcing

Create the canonical registry and tests. Keep `SUBSCRIPTION_ENFORCEMENT_ENABLED=false` initially.

Expected result:

- App still works.
- New registry compiles.
- No UI enforcement yet.

### Step 2: Static scan for legacy keys

Add a scanner that searches for legacy strings and reports them.

Command:

```bash
pnpm audit:legacy-feature-keys
```

The scanner should search at least:

```txt
src/**/*.{ts,tsx}
tests/**/*.{ts,tsx}
docs/**/*.md
```

It should exclude only:

```txt
src/lib/subscriptions/legacy-feature-key-scanner.ts
subscription migration docs
```

### Step 3: Replace callers module by module

Replace old keys in this order:

1. billing/entitlement internals
2. backend guards
3. API route handlers
4. page-level route metadata
5. navigation/sidebar/menu configs
6. locked UI components
7. tests
8. docs/prompts

### Step 4: Delete old alias logic

Remove old alias behavior like:

```ts
const FEATURE_ALIASES = { ... }
```

Remove old behavior where:

```ts
hasTierFeature() returns true
hasFeature() returns true
checkLimit() returns allowed: true
```

### Step 5: Compatibility wrapper only for imports, not keys

If many modules import from `@/lib/billing/feature-access`, keep a temporary wrapper file that re-exports the new canonical registry from `@/lib/subscriptions/feature-keys`.

Allowed:

```ts
export { FEATURE_KEYS } from "@/lib/subscriptions/feature-keys";
export type { FeatureKey } from "@/lib/subscriptions/feature-keys";
```

Not allowed:

```ts
export const FEATURE_ALIASES = ...
export function normalizeLegacyFeatureKey(...) { ... }
```

The wrapper prevents import breakage while still forcing canonical keys.

### Step 6: Turn scanner from warning to CI failure

Once replacements are complete:

```bash
pnpm audit:legacy-feature-keys
```

must fail CI if any active legacy feature key is found.

### Step 7: Enable soft gates

Turn on frontend/page locked states for non-core modules first.

### Step 8: Enable backend gates

Turn on API/server-action enforcement for non-core modules first.

### Step 9: Enable full enforcement

Only after the test matrix passes.

## 25.8 Required environment flags

Use feature flags for the rollout, but avoid creating permanent ambiguity.

```env
SUBSCRIPTION_ENFORCEMENT_ENABLED=false
SUBSCRIPTION_FRONTEND_GATES_ENABLED=false
SUBSCRIPTION_API_GATES_ENABLED=false
SUBSCRIPTION_USAGE_GATES_ENABLED=false
SUBSCRIPTION_PAYMENT_CHARGES_ENABLED=false
SUBSCRIPTION_AUDIT_LOGS_ENABLED=true
```

Rules:

1. Audit logging can start early.
2. Frontend gates can turn on before API gates for soft launch.
3. API gates must turn on before production billing is trusted.
4. Payment charges must be calculated server-side even during soft launch if real payments are active.
5. Flags are temporary rollout tools, not replacements for plan logic.

## 25.9 P0/P1/P2 implementation order

Agents must follow this order. Do not start UI-heavy slices before the foundation is stable.

### P0 — Foundation and safety

| Order | Slice | Must finish before moving on |
|---:|---|---|
| P0.1 | Repo subscription cleanup inventory | Yes |
| P0.2 | Canonical feature registry and limit registry | Yes |
| P0.3 | Legacy key scanner and migration map | Yes |
| P0.4 | Plan codes and plan entitlement map | Yes |
| P0.5 | Subscription status/access-mode normalizer | Yes |
| P0.6 | School entitlement resolver, enforcement off | Yes |
| P0.7 | Route feature registry | Yes |
| P0.8 | API feature registry | Yes |
| P0.9 | Tests for registry, plan map, unknown key rejection | Yes |

### P1 — Controlled gating and admin management

| Order | Slice | Notes |
|---:|---|---|
| P1.1 | Platform plan seed/admin plan list | Keep UI simple. |
| P1.2 | Platform school subscription assignment | Must support Pilot custom modules. |
| P1.3 | School admin subscription read-only page | Show current plan, renewal, usage. |
| P1.4 | Locked module component | Glass UI, clear but not noisy. |
| P1.5 | Frontend navigation/page gates | Start with non-core modules. |
| P1.6 | API/server action gates | Start with AI, exams, schemes, Learn manage. |
| P1.7 | Usage gates for Leo AI and storage | Prevent cost leakage. |
| P1.8 | Transaction fee resolver | Server-side only. |
| P1.9 | Payment flow integration | Admissions and school fees first. |

### P2 — Advanced revenue and lifecycle

| Order | Slice | Notes |
|---:|---|---|
| P2.1 | Meeting credits | Participant-minute metering. |
| P2.2 | Learn seat billing | School-paid/parent-paid modes. |
| P2.3 | Add-on storefront | Buy credits/bundles. |
| P2.4 | Billing invoices/receipts | Subscription and add-ons. |
| P2.5 | Expiry automation | Active → grace → read-only → suspended. |
| P2.6 | Leakage dashboard | Platform admin monitoring. |
| P2.7 | Advanced analytics split | Premium-only analytics. |
| P2.8 | Communications credits | SMS/WhatsApp later. |

## 25.10 Role inheritance rules

Subscription entitlement is school-level, but role permissions still apply.

A user can access a feature only if:

```txt
school has feature entitlement
AND subscription access mode allows action
AND user role/permission allows action
AND usage/payment limits pass, if applicable
```

### Role behavior

| Role | Subscription behavior |
|---|---|
| Platform admin | Can manage subscriptions and override school access. Must not bypass school usage logs when acting inside a school context. |
| School admin | Can access all enabled school admin modules for the school, subject to role permissions. |
| Billing owner / bursar | Can access finance/payment/admission fee modules only if the school has finance/payment features. |
| Teacher | Can access lesson notes, schemes, lessons, exams, and Leo only if the school plan includes those features and the teacher role has permission. |
| Parent | Can access parent-facing payments, notices, student records, and Learn only if enabled for the school and linked student. |
| Student | Can access Edusentrix Learn only if the school/parent has an active Learn seat for that student. |
| Delegated admin | Can only access delegated modules if both the school entitlement and delegation permission allow it. Delegation never creates subscription access by itself. |

### Important rule

Delegated access is **not** a subscription override.

If a platform staff member is delegated to help a school set up lesson notes but the school does not have `academics.lesson_notes`, the system must either:

1. require a platform-admin temporary feature override, or
2. show the delegated admin a locked/setup-unavailable state.

Do not silently bypass subscription gates for delegated admins.

## 25.11 Concrete plan limits v1

All `LIMITED` features must resolve to numeric limits. These numbers are starting defaults and can be changed by platform admin later.

| Limit | Pilot | Starter | Growth | Premium |
|---|---:|---:|---:|---:|
| Active students | Custom | 500 | 1,500 | Custom/null |
| Active teachers | Custom | 40 | 120 | Custom/null |
| Storage | Custom | 5GB | 25GB | 100GB |
| Leo AI credits / term | Custom | 0 | 500 | 2,500 |
| Meeting participant-minutes / term | Custom | 0 | 0 by default/add-on | 1,000 included |
| Learn active seats | Custom | 0 | Add-on only | Add-on only or negotiated |
| Admission cycles / academic year | Custom | 2 | 5 | Custom/null |
| Bulk communication sends / month | Custom | 500 | 2,000 | 10,000 |
| Data exports / month | Custom | 5 | 20 | 100 |

If a plan row says `Custom`, the value must be explicitly set for the Pilot school or default to blocked/zero for expensive features.

## 25.12 Grace/read-only/suspended business rules

| Action | Active | Grace | Read-only | Suspended |
|---|---:|---:|---:|---:|
| Login | Yes | Yes | Yes | Yes |
| View existing records | Yes | Yes | Yes | Limited to billing/support/data export |
| Create students/teachers | Yes | Yes | No | No |
| Edit existing records | Yes | Yes | No, except critical contact fixes | No |
| Collect school fees | Yes | Yes | Yes, recommended | Optional, platform-configurable |
| Collect admission fees | Yes | Yes | No for new cycles; existing submitted invoices can be paid | Optional, platform-configurable |
| Create new admission cycle | Yes | Yes | No | No |
| Send notices | Yes | Yes | Emergency-only/manual platform setting | No |
| Use Leo AI | Yes if credits | No or platform-configurable | No | No |
| Schedule meetings | Yes if credits | No or platform-configurable | No | No |
| Upload files | Yes if storage available | Yes if storage available | No | No |
| Export data | Yes | Yes | Yes | Yes, via billing/support controlled route |
| Renew/pay subscription | Yes | Yes | Yes | Yes |

Revenue-critical recommendation: allow fee payment collection in grace and read-only mode so schools can still receive money and settle arrears, but block new operational growth.

## 25.13 Ghana/Paystack payment rules

Payment charges must be resolved on the server before creating a payment intent.

The resolver must consider:

1. school-specific payment charge override
2. payment category override
3. global default charge
4. payer mode: `payer_pays`, `school_absorbs`, `waived`
5. cap amount
6. minimum charge, if any
7. currency
8. channel metadata where available: mobile money, card, bank transfer

Paystack/provider processing fees are separate from Edusentrix platform charges.

Do not hardcode Paystack fee assumptions into the subscription resolver. Provider fees may vary by channel and time. Store provider fee information on payment records when returned by the provider/webhook, then reconcile separately.

Parent checkout must show a clear fee breakdown when payer pays:

```txt
School charge: GHS 500.00
Edusentrix service fee: GHS 5.00
Total to pay: GHS 505.00
```

If school absorbs:

```txt
Total to pay: GHS 500.00
```

The school/admin settlement view should still show the absorbed platform fee.

## 25.14 Companion app and Learn mobile entitlement APIs

The web backend remains the authority for mobile access.

Known/expected mobile-facing entitlement routes must be listed in the API feature registry and protected by entitlement logic, including:

```txt
/api/parent/entitlements
/api/learn/mobile/student/entitlement
/api/learn/mobile/**
/api/parent/payments
```

Rules:

1. Mobile clients must not calculate feature access locally.
2. Mobile clients must not calculate platform charges locally.
3. Mobile clients can display server-returned entitlement state.
4. Learn mobile access requires both `learn.student_access` and an active seat/payment/assignment for the student.
5. Parent payment flows require `finance.parent_payments` and server-side charge resolution.

## 25.15 Static scanners required before shipping

Create these scripts:

```json
{
  "scripts": {
    "audit:legacy-feature-keys": "tsx scripts/audit-legacy-feature-keys.ts",
    "audit:feature-gates": "tsx scripts/audit-feature-gates.ts",
    "audit:entitlements": "tsx scripts/audit-entitlements.ts"
  }
}
```

### `audit:legacy-feature-keys`

Fails if active source code still references legacy feature keys.

### `audit:feature-gates`

Checks that every route/API declared as protected has:

1. canonical feature key
2. role rule, where needed
3. page guard or API guard
4. test case coverage

### `audit:entitlements`

Runs a plan matrix consistency check:

1. Starter cannot access Growth/Premium-only features.
2. Growth cannot access Premium-only features unless explicitly included.
3. Pilot cannot access anything not explicitly enabled.
4. Unknown feature keys are denied.
5. Expired/read-only schools cannot perform write actions.

## 25.16 Agent prompt — canonical key rebuild slice

Use this prompt when assigning the feature-key rebuild to an AI agent:

```txt
You are working in the EduSentrix Next.js codebase. Rebuild the subscription feature-key system from legacy flat keys to canonical dotted feature keys.

Important decisions:
- Do not support runtime aliases.
- Do not keep legacy keys active.
- Unknown feature keys must fail in dev/test and deny+audit in production.
- Create the new registry in src/lib/subscriptions/feature-keys.ts.
- Replace old feature key usage gradually but safely.
- If existing imports from src/lib/billing/feature-access.ts would break too much code, convert that file into a temporary re-export wrapper only. It must not contain FEATURE_ALIASES or hasTierFeature returning true.
- Add pnpm audit:legacy-feature-keys to detect old keys.
- Do not enable enforcement yet unless the current slice explicitly says to.

Deliverables:
1. canonical FEATURE_KEYS registry
2. FeatureKey type
3. feature metadata definitions
4. assertKnownFeatureKey()
5. old-key scanner script
6. tests proving old keys are not accepted by the new resolver
7. no UI changes in this slice
```

## 25.17 Agent prompt — repo-delta rebuild slice

Use this prompt when assigning the rebuild planning/inventory slice:

```txt
You are working in the EduSentrix Next.js codebase after the old subscription UI was removed. Do not assume old billing/subscription pages exist. Inspect the actual file tree and create a rebuild inventory.

Your task:
- Identify existing subscription models, old billing utilities, disabled gating stubs, payment charge utilities, and any remaining UI references.
- Mark each item as KEEP, REPLACE, WRAP TEMPORARILY, DELETE LATER, or CREATE NEW.
- Do not code new UI.
- Do not re-enable old subscription behavior.
- Produce a concise implementation checklist mapped to actual file paths.

Important:
- The final architecture lives under src/lib/subscriptions/*.
- Old src/lib/billing/* files should either be replaced or temporarily re-export the new implementation.
- This project is rebuilding from scratch, so missing old pages are not errors.
```

## 25.18 Agent prompt — route/API leakage scanner slice

```txt
Build the subscription leakage scanner for EduSentrix.

The scanner must inspect route/API registries and verify that protected modules have page and API gates. It should not guess based only on file names; use explicit route-feature-registry.ts and api-feature-registry.ts as the source of truth.

Fail conditions:
- route has protected feature but no page guard
- API has protected feature but no server guard
- unknown feature key used anywhere
- legacy feature key found in active code
- expensive feature lacks usage guard where required
- payment flow lacks server-side charge resolver where required

Add tests for Starter, Growth, Premium, Pilot, expired, grace, read-only, and suspended schools.
```

## 25.19 What agents must not do

Agents must not:

1. reintroduce `FEATURE_ALIASES` as runtime behavior
2. return `true` from `hasFeature()` by default
3. create new subscription routes based on deleted old UI without checking current routing structure
4. gate only the sidebar and call the feature done
5. let mobile apps calculate charges or entitlements locally
6. allow Pilot to inherit Growth/Premium features automatically
7. treat `enterprise` as a feature key
8. silently allow unknown keys
9. implement Premium as unlimited AI or unlimited meetings
10. make UI dense or table-heavy where a glass card summary is clearer

## 25.20 Replacement acceptance checklist

The rebuild is not complete until all of the following pass:

```txt
[ ] canonical FEATURE_KEYS exists and is typed
[ ] old legacy feature keys removed from active runtime code
[ ] unknown feature keys fail/deny safely
[ ] plan entitlement map uses only canonical keys
[ ] Pilot is deny-by-default
[ ] Starter cannot access academics/AI/exams/Learn/meetings
[ ] Growth can access academic planning + limited AI but not Premium-only automation/advanced analytics
[ ] Premium has broad access but still respects AI/meeting/storage limits
[ ] school-specific overrides are audited
[ ] route registry uses canonical keys
[ ] API registry uses canonical keys
[ ] every protected page has a page-level guard
[ ] every protected mutation/API has server-side guard
[ ] Leo AI has credit reservation/finalization
[ ] uploads require storage entitlement before upload permission/signature
[ ] payment intents use server-side charge policy resolver
[ ] Learn mobile entitlement endpoint checks school entitlement + student seat
[ ] delegated admins cannot bypass school subscription gates
[ ] grace/read-only/suspended rules are tested
[ ] audit:legacy-feature-keys passes
[ ] audit:feature-gates passes
[ ] audit:entitlements passes
[ ] UI stays clean, glassy, spacious, and not overloaded
```
