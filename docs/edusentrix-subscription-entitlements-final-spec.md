# EduSentrix Subscription, Trials, Entitlements & Usage Metering — Implementation Spec

**Project:** EduSentrix Web Next.js  
**Purpose:** Build a safe, configurable subscription and feature-gating system that fits the current codebase without breaking existing school workflows.  
**Audience:** Software engineers and AI coding agents.  
**Status:** Implementation-ready after codebase review.  

---

## 0. Codebase Review Confirmation

This specification is based on inspection of the uploaded EduSentrix codebase. The current project already contains a partial subscription/billing foundation.

Relevant existing files discovered:

```txt
src/models/SubscriptionTier.ts
src/models/SchoolSubscription.ts
src/models/SubscriptionEvent.ts
src/models/SubscriptionCheckoutIntent.ts
src/models/UsageMetric.ts
src/models/AIFeatureUsageEvent.ts
src/models/PlatformBillingSettings.ts
src/models/School.ts

src/lib/billing/entitlements.ts
src/lib/billing/feature-access.ts
src/lib/billing/trackUsage.ts
src/lib/billing/transaction-fees.ts
src/lib/billing/subscription-checkout.ts

src/lib/platform-billing/subscription-tiers.ts
src/lib/platform-billing/subscription-pricing.ts
src/lib/platform-billing/school-subscription-actions.ts

src/app/api/subscription/current/route.ts
src/app/api/subscription/upgrade/route.ts
src/app/api/subscription/cancel/route.ts
src/app/api/platform/billing/tiers/route.ts
src/app/api/platform/billing/tiers/[tierId]/route.ts
src/app/api/platform/billing/subscriptions/route.ts
src/app/api/platform/schools/[id]/subscription/route.ts
src/app/api/platform/schools/[id]/subscription/transaction-fees/route.ts
src/app/api/platform/schools/[id]/usage/route.ts

src/app/(app)/admin/billing/page.tsx
src/app/(app)/platform/billing/page.tsx
src/app/(app)/platform/schools/[id]/subscription/page.tsx
src/app/(app)/platform/schools/[id]/usage/page.tsx
src/components/billing/*
src/hooks/useSubscription.ts
```

### Current strengths

- Subscription models already exist.
- Platform admin can create/edit subscription tiers.
- School subscriptions can be assigned from the platform side.
- Transaction fee overrides exist at school level.
- UsageMetric exists for provider/cost attribution.
- School admin has a billing page showing current plan and feature/limit data.
- Entitlement helper foundation exists in `src/lib/billing/entitlements.ts` and `src/lib/billing/feature-access.ts`.

### Current gaps to close

- Current tiers are pilot monthly tiers, not term-based School OS tiers.
- Tier model only stores `features: string[]`; it needs richer limits, pricing, trial/pilot allowances, storage, AI, video, and transaction fee policies.
- `billingCadence` only supports `monthly`; EduSentrix needs `term`, `annual`, and `custom`.
- Current public pricing API exposes tiers through `/api/public/pricing`; we should not expose subscriptions on the marketing/public side.
- School admin billing page loads public pricing and offers upgrade actions. This must be redesigned to show current subscription and features only, not public marketing-style plan selection.
- Feature keys are incomplete for modules now built/planned: Lessons, Lesson Notes, Curriculum/Scheme, Library, Examinations, Question Bank, Leo, Video, Vendors, Inventory, Fundraising, Polls, API access.
- Entitlement enforcement is not yet centralized enough across backend APIs.
- AI usage tracking currently supports only a narrow `AIFeatureUsageEvent` enum.
- Usage tracking is mostly monthly. Schools need term/pilot/trial windows too.
- Trial and pilot lifecycle are under-modeled. Current `status: trial` and `pilotEndsAt` are not enough.
- Storage/video limits are not represented well enough.
- Reset/downgrade/grace behavior is not defined.

---

## 1. Product Decision: Do Not Expose Subscriptions on Marketing Pages

EduSentrix subscriptions should **not** be publicly exposed on the marketing website for now.

### Required behavior

- Remove or disable public plan exposure from marketing pages.
- Do not show pricing cards publicly unless intentionally enabled later.
- School admins may see their current subscription and access information after login.
- Platform admins may manage tiers, pricing, limits, trials, pilots, and school assignments.

### Existing code to change

Current file:

```txt
src/app/api/public/pricing/route.ts
```

Current school admin billing page calls:

```txt
/api/public/pricing
```

### Required change

Either remove the public route or make it internal-disabled by default.

Recommended implementation:

```ts
// src/app/api/public/pricing/route.ts
export async function GET() {
  return NextResponse.json(
    { success: false, error: "Public pricing is not available." },
    { status: 404 }
  );
}
```

Or guard it behind an env flag:

```env
NEXT_PUBLIC_SHOW_MARKETING_PRICING=false
```

If false, return 404.

### Completion verification

- Visiting `/api/public/pricing` does not reveal subscription tiers unless explicitly enabled by environment.
- No marketing/public page renders subscription tiers.
- `/admin/billing` no longer depends on `/api/public/pricing`.

---

## 2. Subscription Tier Strategy

EduSentrix should have **four main tiers**, plus trial/pilot subscription modes.

### Core tiers

```txt
Starter
Growth
Premium
Enterprise
```

### Billing approach

Use:

```txt
Term-based subscription
+ minimum term fee
+ onboarding/setup fee where applicable
+ transaction/platform fees
+ usage-based add-ons for AI, video, storage, messaging
```

### Recommended base tier pricing

| Tier | Price / Student / Term | Minimum / Term | Positioning |
|---|---:|---:|---|
| Starter | GH₵12 | GH₵1,500 | Small schools starting digitization |
| Growth | GH₵20 | GH₵3,000 | Main recommended School OS plan |
| Premium | GH₵30 | GH₵5,000 | Advanced AI, analytics, video, operations |
| Enterprise | Custom | Custom | Multi-campus, API, integrations, SLA |

### Trial and pilot modes

Trial/pilot should be modeled as **subscription statuses/modes**, not separate public-facing tiers only.

Recommended lifecycle statuses:

```ts
type SchoolSubscriptionStatus =
  | "draft"
  | "trialing"
  | "pilot"
  | "active"
  | "past_due"
  | "grace"
  | "suspended"
  | "cancelled"
  | "expired";
```

### Trial options

#### One-month guided trial

- Duration: 30 days.
- School pays no base subscription fee during the trial.
- School still pays transaction/platform fees.
- Limited Leo AI usage.
- Limited video meeting scheduling/hosted minutes.
- Limited storage.
- Limited messaging/notifications.
- No API access.
- No custom domain.

#### One-term pilot

- Duration: one academic term.
- School pays no or discounted base subscription fee depending on your commercial decision.
- School still pays transaction/platform fees.
- School may pay onboarding/training fee if you choose.
- Limited Leo, video, storage, messaging, and expensive features.
- School agrees to feedback/testimonial/case-study conditions if desired.

### Trial fees to charge

During free trial and pilot, schools should still pay:

1. **Transaction/platform fees** on successful parent payments and fundraising donations.
2. **Payment gateway fees** passed through or included transparently.
3. **SMS/WhatsApp credits** if you enable real messaging.
4. **Extra storage** beyond trial allowance.
5. **Hosted video bundles** beyond trial allowance.
6. **Optional onboarding/training fee** for real-school setup.
7. **Custom data migration fee** if they ask you to migrate real data.

Recommended trial/pilot limits:

| Resource | 30-day Trial | One-term Pilot |
|---|---:|---:|
| Leo AI actions | 50–100 | 300–500 |
| AI token cap | Small hard cap | Medium hard cap |
| Hosted video | 0–100 participant-minutes | 300–500 participant-minutes |
| External video scheduling | Allowed | Allowed |
| Storage | 1–2 GB | 5–10 GB |
| Notification credits | 100 | 300–500 |
| Real payments | Allowed only if school payment setup is provisioned | Allowed if provisioned |
| API access | No | No, unless approved |

---

## 3. Feature Matrix

Use feature keys, not hardcoded plan names.

### Starter features

```txt
core.school_ops
students.manage
teachers.manage
parents.manage
classes.manage
subjects.manage
attendance.basic
notices.basic
fees.basic
payments.manual_recording
reports.basic
storage.basic
roles.basic
```

### Growth features

Includes Starter plus:

```txt
fees.full
invoices.generate
payments.online
parent_portal.basic
teacher_portal.full
student_portal.basic
lesson_notes.full
lessons.full
curriculum_scheme.full
library.full
polls.full
fundraising.full
notifications.basic
analytics.basic
examinations.basic
question_bank.basic
video.external_scheduling
```

### Premium features

Includes Growth plus:

```txt
leo.enabled
leo.lesson_support
leo.flashcard_generation
leo.exam_question_generation
leo.report_insights
analytics.advanced
video.hosted
vendors.full
inventory.full
permissions.advanced
audit.advanced
reports.advanced
templates.custom
support.priority
storage.premium
```

### Enterprise features

Includes Premium plus:

```txt
api_access.enabled
multi_campus.enabled
custom_domain.enabled
custom_integrations.enabled
sla.enabled
white_label.optional
branded_mobile_app.optional
storage.custom
ai.custom_limits
video.custom_limits
support.dedicated
```

### Required feature key rule

Feature keys must be stable strings. Do not rename casually because they will be stored in DB and referenced by code.

---

## 4. Data Model Upgrade Plan

### 4.1 Upgrade `SubscriptionTier`

Current model:

```txt
src/models/SubscriptionTier.ts
```

Current limitations:

- `billingCadence` only supports `monthly`.
- `priceMinor` is a flat monthly value.
- Features are a flat string array.
- Limits are mostly inferred from tier code in `feature-access.ts`.
- No transaction fee defaults.
- No trial/pilot allowances.
- No versioning.

### Required new/extended fields

```ts
export type BillingCadence = "term" | "annual" | "monthly" | "custom";

export interface ISubscriptionTier {
  code: string;
  name: string;
  description?: string | null;

  version: number;
  active: boolean;
  publicVisible: boolean; // default false
  sortOrder: number;

  billingCadence: BillingCadence;

  pricing: {
    pricePerStudentPerTermMinor?: number | null;
    minimumTermFeeMinor?: number | null;
    annualDiscountPercent?: number | null;
    flatTermPriceMinor?: number | null;
    onboardingFeeMinor?: number | null;
    currency: "GHS";
  };

  features: string[];

  limits: {
    maxStudents?: number | null;
    maxTeachers?: number | null;
    maxParents?: number | null;
    maxStaff?: number | null;
    maxStorageBytes?: number | null;
    maxLeoActionsPerTerm?: number | null;
    maxLeoTokensPerTerm?: number | null;
    maxHostedVideoParticipantMinutesPerTerm?: number | null;
    maxNotificationCreditsPerTerm?: number | null;
    maxUploadBytesPerTerm?: number | null;
    maxApiRequestsPerTerm?: number | null;
  };

  transactionFees: {
    schoolFeesPercent: number;
    fundraisingPercent: number;
    vendorPayoutPercent?: number | null;
    capPerTransactionMinor?: number | null;
    payerModeDefault: "payer_pays" | "school_absorbs";
  };

  trialDefaults?: {
    enabled: boolean;
    durationDays: number;
    limits: Record<string, number | null>;
  };

  pilotDefaults?: {
    enabled: boolean;
    durationMode: "term" | "custom";
    baseSubscriptionFeeMode: "free" | "discounted" | "fixed";
    discountPercent?: number | null;
    fixedFeeMinor?: number | null;
    limits: Record<string, number | null>;
  };
}
```

### Backward compatibility

Do not delete existing fields immediately:

```txt
priceMinor
studentLimit
provisional
```

Keep them for migration compatibility, but move new code to use `pricing` and `limits`.

### Completion verification

- `SubscriptionTier` supports Starter/Growth/Premium/Enterprise with term-based pricing.
- Platform admin can edit feature keys and limits.
- Existing assigned school subscriptions continue to load after migration.
- Existing UI does not crash if old tiers lack new nested fields.

---

### 4.2 Upgrade `SchoolSubscription`

Current file:

```txt
src/models/SchoolSubscription.ts
```

Current limitations:

- One subscription per school with basic status.
- Has `pilotEndsAt`, but no proper trial/pilot start/end lifecycle.
- No billing period dates.
- No plan version snapshot.
- No usage window references.

### Required fields

```ts
export interface ISchoolSubscription {
  schoolId: Types.ObjectId;

  tierId?: Types.ObjectId | null;
  tierCode?: string | null;
  tierName?: string | null;
  tierVersion?: number | null;

  status:
    | "draft"
    | "trialing"
    | "pilot"
    | "active"
    | "past_due"
    | "grace"
    | "suspended"
    | "cancelled"
    | "expired";

  lifecycleMode: "trial" | "pilot" | "paid" | "custom";

  billingCadence: "term" | "annual" | "monthly" | "custom";
  currency: "GHS";

  academicYearId?: Types.ObjectId | null;
  termId?: Types.ObjectId | null;

  startsAt?: Date | null;
  endsAt?: Date | null;
  trialStartedAt?: Date | null;
  trialEndsAt?: Date | null;
  pilotStartedAt?: Date | null;
  pilotEndsAt?: Date | null;
  gracePeriodEndsAt?: Date | null;

  studentCountAtBilling?: number | null;

  basePriceMinor: number;
  manualPriceOverrideMinor?: number | null;
  discountMode: "none" | "percent" | "fixed";
  discountValue?: number | null;
  effectivePriceMinor: number;

  includedLimitsSnapshot: Record<string, number | null>;
  featuresSnapshot: string[];
  transactionFeeSnapshot: {
    schoolFeesPercent: number;
    fundraisingPercent: number;
    capPerTransactionMinor?: number | null;
    payerModeDefault: "payer_pays" | "school_absorbs";
  };

  note?: string | null;
  updatedBy?: Types.ObjectId | null;
  updatedByEmail?: string | null;
}
```

### Completion verification

- Trial, pilot, paid, suspended, cancelled states can be represented without ambiguity.
- Trial end date and pilot end date are not confused.
- Subscription snapshot can be shown to school admin without querying tier every time.
- Existing subscriptions migrate safely.

---

### 4.3 Keep `UsageMetric`, but add event-level usage where needed

Current file:

```txt
src/models/UsageMetric.ts
```

`UsageMetric` is good for aggregated provider/cost metrics. Keep it.

But expensive operations also need detailed event records.

Add or extend models:

```txt
AIUsageEvent
VideoUsageEvent
StorageUsageEvent or FileUsageEvent
AppSessionUsageEvent
PaymentRevenueEvent
```

If you prefer not to create many models, add a generic event model:

```ts
type UsageEvent = {
  schoolId: ObjectId;
  userId?: ObjectId | null;
  module: string;
  eventType: string;
  metricKey: string;
  quantity: number;
  unitLabel: string;
  estimatedCostMinor?: number;
  metadata?: Record<string, unknown>;
  occurredAt: Date;
};
```

Then roll up into `UsageMetric` by period.

### Completion verification

- Platform admin can see both high-level totals and enough event detail to investigate costs.
- AI usage shows tokens/model/feature.
- Video usage shows participant-minutes.
- Storage usage shows bytes/module/provider.
- App usage shows session duration by school/user/role/module.

---

## 5. Entitlement Architecture

### Required principle

Do not write feature checks like:

```ts
if (plan === "premium")
```

Use central feature keys and limit checks.

### Existing files to extend

```txt
src/lib/billing/feature-access.ts
src/lib/billing/entitlements.ts
src/hooks/useSubscription.ts
src/components/billing/FeatureGate.tsx
src/components/billing/UpgradePrompt.tsx
```

### Required server helpers

Create or extend:

```txt
src/lib/billing/requireEntitlement.ts
src/lib/billing/checkUsageLimit.ts
src/lib/billing/recordUsageEvent.ts
src/lib/billing/getSchoolEntitlementSnapshot.ts
```

Example API:

```ts
await requireEntitlement({
  schoolId,
  feature: "leo.exam_question_generation",
});

await requireUsageLimit({
  schoolId,
  metric: "leo.tokens",
  requestedAmount: estimatedTokens,
  window: "subscription_period",
});
```

### Required frontend helpers

Create/extend:

```txt
src/hooks/useEntitlement.ts
src/hooks/useUsageSummary.ts
src/components/billing/FeatureGate.tsx
src/components/billing/UsageMeter.tsx
src/components/billing/UpgradePrompt.tsx
src/components/billing/SubscriptionFeatureList.tsx
```

### Backend enforcement requirement

Every premium/expensive API must enforce entitlements server-side.

High-priority APIs to gate:

```txt
Leo/AI endpoints
Video meeting creation/hosted call endpoints
File upload completion/storage accounting
Payment initialization where online payments are tier-controlled
Fundraising donation activation
Examinations AI question generation
Lessons AI generation
Lesson Notes AI generation
Advanced analytics APIs
Vendor/inventory APIs if premium-only
API access endpoints
```

### Graceful downgrade behavior

If a school loses access to a feature:

```txt
Existing data remains visible/read-only where safe.
New creation/actions are blocked.
Expensive operations are blocked.
Show upgrade prompt instead of crashing.
```

Example:

- Existing AI-generated lesson content remains visible.
- New AI generation is blocked.
- Existing uploaded files remain accessible.
- New upload is blocked if storage limit exceeded.
- Existing vendor records remain visible.
- Creating new vendor purchase orders is blocked if vendors are Premium-only.

### Completion verification

- FeatureGate hides UI but backend also blocks unauthorized calls.
- Direct API calls cannot bypass plan restrictions.
- Downgraded schools do not lose existing data.
- Suspended/cancelled schools see restricted access overlay.

---

## 6. School Admin Subscription View

### Product rule

School admins should see:

```txt
Current subscription
Subscription status
Trial/pilot/paid dates
Features available
Usage limits and usage consumed
Upgrade/contact support prompt if needed
Payment readiness
Transaction fee policy summary
```

They should **not** see public marketing pricing by default.

### Existing file to rebuild

```txt
src/app/(app)/admin/billing/page.tsx
```

### Remove from school admin billing page

- Remove call to `/api/public/pricing`.
- Remove public tier selection cards.
- Remove generic “Available Pilot Tiers” section.
- Remove self-service plan switching unless you intentionally enable it later.

### Add to school admin billing page

Sections:

1. **Current Plan Card**
   - Tier name
   - Status: trialing/pilot/active/past due/grace/suspended/cancelled
   - Start date
   - End date
   - Trial/pilot remaining days
   - Billing cadence

2. **What Your School Can Access**
   - Human-readable feature list grouped by module:
     - Core Management
     - Finance & Payments
     - Academics
     - Communication
     - AI/Leo
     - Video
     - Storage
     - Advanced/Enterprise

3. **Usage Meters**
   - Students
   - Teachers
   - Storage
   - Leo actions/tokens
   - Video participant-minutes
   - Notifications
   - Payment volume

4. **Transaction Fees**
   - School fee platform fee percent
   - Fundraising fee percent
   - Cap per transaction
   - Payer mode: parent pays or school absorbs
   - Note that gateway fees may also apply

5. **Payment Readiness**
   - whether school can collect online payments
   - payout setup status
   - link to payment setup if user has permission

6. **Request Upgrade / Contact EduSentrix**
   - Since we do not expose public pricing, use a request button.
   - Route suggestion:
     ```txt
     /admin/billing/request-upgrade
     ```
   - Or a modal: “Request plan review”.

### UI requirements

- Keep existing premium dark/glass feel.
- Use existing `Card`, `Button`, `Badge`, `LimitIndicator`, `SubscriptionBadge`.
- Create `SubscriptionFeatureList`, `UsageMeter`, and `TrialPilotBanner` components.
- No raw ugly tables for school-facing view.

### Completion verification

- School admin can clearly see current tier and features.
- No public plan list appears.
- Trial/pilot end date is visible.
- Expensive feature limits are visible.
- Usage meters reflect actual tracked usage.

---

## 7. Platform Admin Subscription Management

### Existing files

```txt
src/app/(app)/platform/billing/page.tsx
src/app/(app)/platform/schools/[id]/subscription/page.tsx
src/app/api/platform/billing/tiers/*
src/app/api/platform/schools/[id]/subscription/*
```

### Required platform admin capabilities

Platform admin must be able to:

```txt
Create/edit/deactivate subscription tiers
Set term pricing and minimum fees
Set feature entitlements
Set limits per tier
Set transaction fee defaults per tier
Set trial/pilot defaults
Assign a school to a tier
Set school lifecycle status: trialing/pilot/active/etc.
Set trial dates and pilot dates
Set billing academic year/term
Set manual price override
Set discount
Set school-specific transaction fee overrides
View school usage and cost-to-serve
View revenue and margin estimates
Suspend/reactivate/cancel subscriptions
View subscription event timeline and audit logs
```

### Plan versioning requirement

Do not silently mutate existing subscriptions when a tier is edited.

Implement one of these:

#### Preferred

Add tier versioning:

```txt
SubscriptionTier.code + version
SchoolSubscription.tierVersion
```

Editing a tier creates a new version. Existing schools stay on old version unless migrated.

#### Simpler acceptable V1

Keep existing tier edits but store subscription snapshots on `SchoolSubscription`:

```txt
featuresSnapshot
includedLimitsSnapshot
transactionFeeSnapshot
```

Then existing schools do not break if the tier changes.

### Completion verification

- Editing a tier does not unexpectedly remove features from existing schools without explicit migration.
- Platform admin can view assigned school count for each tier.
- Platform admin cannot deactivate a tier assigned to schools unless schools are migrated.
- Every subscription change creates `SubscriptionEvent` and audit event.

---

## 8. Usage Tracking & Cost Protection

### Track all direct cost drivers

Platform admin should track:

```txt
AI usage
Video usage
Storage usage
Upload bandwidth where possible
MongoDB storage/operations estimated allocation
App session time
Notifications/email/SMS/WhatsApp
Payment volume
Gateway/platform fees
UploadThing usage
Vercel/internal compute estimates where possible
```

### 8.1 AI usage

Current file:

```txt
src/models/AIFeatureUsageEvent.ts
```

Current enum is too narrow:

```txt
fees_account_brief
fees_reminder_template
```

Expand AI features:

```txt
lesson_note_generation
lesson_summary_generation
lesson_flashcard_generation
exam_question_generation
exam_quality_check
scheme_generation
student_insight
report_insight
parent_message_draft
teacher_feedback_draft
leo_chat
```

Record:

```ts
{
  schoolId,
  userId,
  role,
  feature,
  module,
  modelUsed,
  promptTokens,
  completionTokens,
  totalTokens,
  estimatedCostMinor,
  subscriptionId,
  createdAt
}
```

Every Leo/AI route must:

1. Check entitlement.
2. Estimate or reserve usage limit.
3. Execute AI.
4. Record actual usage.
5. Roll up to `UsageMetric`.

### 8.2 Video usage

Create:

```txt
src/models/VideoUsageEvent.ts
```

Fields:

```ts
{
  schoolId,
  meetingId,
  hostUserId,
  provider: "external_link" | "livekit" | "other",
  startedAt,
  endedAt,
  durationSeconds,
  participantCount,
  participantMinutes,
  recordingEnabled,
  recordingStorageBytes,
  estimatedCostMinor
}
```

Pricing rule:

```txt
Video scheduling with external links is cheap and may be included in Growth+.
EduSentrix-hosted calls are priced by participant-minutes and should be Premium/Enterprise or add-on.
```

### 8.3 Storage usage

Track storage by school/module/file.

Create or extend file metadata records to include:

```ts
{
  schoolId,
  module,
  uploadedBy,
  provider: "uploadthing",
  fileKey,
  fileUrl,
  fileName,
  mimeType,
  sizeBytes,
  deletedAt
}
```

Roll up to:

```txt
UsageMetric(provider="uploadthing", metricKey="storage_bytes")
UsageMetric(provider="uploadthing", metricKey="uploaded_bytes")
```

Storage pricing:

| Tier | Included Storage |
|---|---:|
| Starter | 2 GB |
| Growth | 10 GB |
| Premium | 50 GB |
| Enterprise | Custom |

Extra storage:

```txt
Extra 10 GB: GH₵100–GH₵150 / term
Extra 50 GB: GH₵400–GH₵600 / term
```

### 8.4 App usage hours

Create:

```txt
src/models/AppSessionUsageEvent.ts
```

Or implement lightweight session tracking via heartbeat.

Fields:

```ts
{
  schoolId,
  userId,
  role,
  sessionStartedAt,
  lastSeenAt,
  durationSeconds,
  routesVisited,
  moduleBreakdown
}
```

Important: use this for aggregate school usage, not invasive user surveillance.

### Completion verification

- AI usage appears in platform school usage view.
- Storage usage appears in platform school usage view.
- Video usage appears in platform school usage view.
- Usage is tied to subscription period/trial/pilot window.
- Expensive actions are blocked before exceeding hard limits.

---

## 9. Transaction Fees

### Existing implementation

Files:

```txt
src/lib/billing/transaction-fees.ts
src/app/api/platform/schools/[id]/subscription/transaction-fees/route.ts
School.billing.transactionFees
```

This is good and should be kept.

### Recommended platform fees

| Transaction | Platform Fee |
|---|---:|
| School fees | 1.2% |
| Fundraising donations | 2.0% |
| Vendor/supplier payments, future | 0.5%–1.0% |

Recommended cap:

```txt
GH₵30–GH₵50 per transaction for school fee payments
```

### Fee payer mode

Add explicit payer mode:

```ts
feePayerMode: "payer_pays" | "school_absorbs";
```

Default:

```txt
payer_pays
```

### Trial/pilot rule

During free trial and pilot:

```txt
Subscription base fee may be zero/discounted.
Transaction platform fees are still charged.
Gateway fees are still charged/passed through.
```

### Completion verification

- Trial school still pays platform transaction fees.
- Pilot school still pays platform transaction fees.
- Discounts never reduce transaction fees.
- Transaction fee policy appears in school admin billing summary.
- Platform admin can override transaction fee policy per school.

---

## 10. Free Trial and Pilot Implementation

### New trial creation flow

When a new real school is created, platform admin can assign:

```txt
30-day trial
One-term pilot
Paid subscription
Draft/no subscription yet
```

### Trial subscription example

```ts
{
  status: "trialing",
  lifecycleMode: "trial",
  tierCode: "growth",
  trialStartedAt: now,
  trialEndsAt: now + 30 days,
  effectivePriceMinor: 0,
  includedLimitsSnapshot: {
    maxLeoActionsPerTerm: 50,
    maxHostedVideoParticipantMinutesPerTerm: 0,
    maxStorageBytes: 2GB,
    maxNotificationCreditsPerTerm: 100
  }
}
```

### Pilot subscription example

```ts
{
  status: "pilot",
  lifecycleMode: "pilot",
  tierCode: "growth" | "premium",
  pilotStartedAt,
  pilotEndsAt: termEndDate,
  effectivePriceMinor: 0 or discounted,
  includedLimitsSnapshot: {
    maxLeoActionsPerTerm: 500,
    maxHostedVideoParticipantMinutesPerTerm: 500,
    maxStorageBytes: 10GB,
    maxNotificationCreditsPerTerm: 500
  }
}
```

### Trial expiration behavior

When trial ends:

```txt
Move to grace or expired.
Keep data visible.
Block creation/actions for premium/expensive features.
Allow platform admin to convert to paid/pilot.
Show school admin banner.
```

### Pilot expiration behavior

When pilot ends:

```txt
Move to grace/past_due/expired depending on business process.
Generate closeout usage summary.
Show platform admin recommended pricing/migration action.
Do not auto-delete data.
Do not auto-convert without platform admin action.
```

### Existing cron to extend

Current file:

```txt
src/app/api/cron/platform-billing/route.ts
```

Add lifecycle checks:

```txt
trialing -> grace/expired when trialEndsAt passed
pilot -> grace/past_due when pilotEndsAt passed
past_due -> suspended after gracePeriodEndsAt
```

### Completion verification

- Trial schools do not pay base subscription during trial.
- Trial schools still pay transaction fees.
- Trial limits are enforced.
- Pilot schools still pay transaction fees.
- Pilot limits are enforced.
- Expired trial/pilot does not silently allow unlimited usage.

---

## 11. Subscription APIs

### Existing APIs to preserve and upgrade

```txt
GET /api/subscription/current
POST /api/subscription/upgrade
POST /api/subscription/cancel
GET /api/platform/billing/tiers
POST /api/platform/billing/tiers
PATCH /api/platform/billing/tiers/[tierId]
GET /api/platform/schools/[id]/subscription
PATCH /api/platform/schools/[id]/subscription
GET /api/platform/schools/[id]/usage
```

### New/updated APIs required

#### School admin

```txt
GET /api/subscription/current
GET /api/subscription/usage
POST /api/subscription/request-upgrade
```

`/api/subscription/current` should return:

```ts
{
  school,
  subscription,
  status,
  currentPeriod,
  features,
  limits,
  usage,
  transactionFeePolicy,
  paymentReady,
  upgradeContactEnabled
}
```

#### Platform admin

```txt
GET /api/platform/billing/tiers
POST /api/platform/billing/tiers
PATCH /api/platform/billing/tiers/[tierId]
POST /api/platform/billing/tiers/[tierId]/clone-version
GET /api/platform/schools/[id]/subscription
PATCH /api/platform/schools/[id]/subscription
POST /api/platform/schools/[id]/subscription/start-trial
POST /api/platform/schools/[id]/subscription/start-pilot
POST /api/platform/schools/[id]/subscription/convert-to-paid
POST /api/platform/schools/[id]/subscription/suspend
POST /api/platform/schools/[id]/subscription/reactivate
POST /api/platform/schools/[id]/subscription/cancel
GET /api/platform/schools/[id]/usage
GET /api/platform/schools/[id]/usage/events
GET /api/platform/billing/revenue
GET /api/platform/billing/costs
```

### Completion verification

- Platform admin can create trial/pilot/paid subscriptions without DB scripts.
- School admin can load current subscription without public pricing API.
- Feature entitlements returned by `/api/subscription/current` match backend enforcement.

---

## 12. Pricing and Entitlement Defaults to Seed

Replace current `pilot_starter`, `pilot_growth`, `pilot_scale` defaults with real internal tiers, but do not expose them publicly.

File to update:

```txt
src/lib/platform-billing/subscription-tiers.ts
```

Seed:

```txt
starter
growth
premium
enterprise
trial_growth
pilot_growth
pilot_premium
```

### Notes

- `trial_growth` and `pilot_*` can be internal-only tier templates if easier.
- Alternatively use `growth`/`premium` tier with `SchoolSubscription.lifecycleMode = trial/pilot` and limit overrides.
- Preferred: lifecycle mode + limit overrides, because it avoids too many pseudo-tiers.

### Completion verification

- Default tiers are not hardcoded pilot monthly tiers anymore.
- Platform admin sees Starter/Growth/Premium/Enterprise.
- Public users do not see tiers.
- Existing schools with old pilot tiers still load after migration.

---

## 13. Migration Plan

### Step 1: Add new fields without removing old ones

Update models with optional fields.

### Step 2: Backfill existing tiers

For old `pilot_starter`, `pilot_growth`, `pilot_scale`:

- keep active until schools are migrated,
- mark as legacy/internal,
- create new Starter/Growth/Premium/Enterprise tiers.

### Step 3: Backfill existing subscriptions

For each `SchoolSubscription`:

- set `lifecycleMode` based on status and `pilotEndsAt`.
- set `billingCadence`.
- set `featuresSnapshot` from current tier.
- set `includedLimitsSnapshot` from current `resolveTierLimits`.
- set transaction fee snapshot from platform defaults.

### Step 4: Replace admin billing school UI

Remove dependency on `/api/public/pricing`.

### Step 5: Add centralized enforcement gradually

Start with expensive features:

```txt
AI
Video
Storage
Payments
Fundraising
Upload/file creation
```

Then gate lower-cost modules later.

### Completion verification

- App works before and after migration.
- No school loses access unexpectedly.
- Subscription pages do not crash on old data.
- Old pilot tiers can be retired manually.

---

## 14. Feature Gating Implementation Order

### Chunk 1: Model/schema upgrade

Files:

```txt
src/models/SubscriptionTier.ts
src/models/SchoolSubscription.ts
src/models/UsageMetric.ts
src/models/AIFeatureUsageEvent.ts
```

Add fields as described.

### Chunk 2: Entitlement resolver

Files:

```txt
src/lib/billing/feature-access.ts
src/lib/billing/entitlements.ts
src/lib/billing/requireEntitlement.ts
src/lib/billing/checkUsageLimit.ts
```

### Chunk 3: Platform tier editor

Files:

```txt
src/app/(app)/platform/billing/page.tsx
src/app/api/platform/billing/tiers/*
```

Add UI support for pricing, limits, transaction fees, trial/pilot defaults.

### Chunk 4: School subscription assignment

Files:

```txt
src/app/(app)/platform/schools/[id]/subscription/page.tsx
src/app/api/platform/schools/[id]/subscription/route.ts
```

Add lifecycle mode, trial dates, pilot dates, billing period, tier snapshot.

### Chunk 5: School admin billing page rebuild

File:

```txt
src/app/(app)/admin/billing/page.tsx
```

Show current plan/features/usage only.

### Chunk 6: Usage metering

Add/extend:

```txt
AI usage event recording
Video usage event recording
Storage usage event recording
App session usage recording
Usage rollups
```

### Chunk 7: Gate expensive APIs

Apply server-side gates to:

```txt
Leo/AI
Video
Storage/uploads
Payments
Fundraising
Examinations AI
Lessons AI
Lesson Notes AI
Advanced analytics
```

### Chunk 8: Trial/pilot lifecycle cron

Extend:

```txt
src/app/api/cron/platform-billing/route.ts
```

### Chunk 9: Platform usage dashboard

Extend:

```txt
src/app/(app)/platform/schools/[id]/usage/page.tsx
src/app/api/platform/schools/[id]/usage/route.ts
```

Add usage grouped by provider/module/feature/cost.

### Chunk 10: Tests

Add tests for:

```txt
entitlement resolver
limit checker
trial expiration
pilot expiration
transaction fee computation
AI limit enforcement
storage limit enforcement
video participant-minute enforcement
school admin billing snapshot
platform tier editing
```

---

## 15. Acceptance Criteria

### Subscription tiers

- Platform admin can configure Starter/Growth/Premium/Enterprise from UI.
- Tiers include features, limits, storage, AI, video, transaction fees, and trial/pilot defaults.
- Tiers are not exposed publicly.

### School subscription

- Platform admin can assign trial, pilot, or paid subscription to a school.
- Trial can run for 30 days.
- Pilot can run for a term.
- Trial/pilot can have limit overrides.
- Trial/pilot still charge transaction fees.

### School admin view

- School admin sees current subscription status.
- School admin sees accessible features.
- School admin sees usage limits and usage consumed.
- School admin does not see marketing pricing cards.
- School admin can request upgrade/contact support.

### Feature gating

- Backend blocks unauthorized expensive features.
- Frontend hides/locks unauthorized features with upgrade prompt.
- Existing data remains visible after downgrade.
- Suspended/cancelled schools are restricted.

### Usage tracking

- AI usage is tracked by feature, tokens, model, and school.
- Video usage is tracked by participant-minutes.
- Storage usage is tracked by bytes and module.
- Payment transaction volume and platform fees are tracked.
- Platform admin can view school cost-to-serve.

### Cost protection

- No AI endpoint can be used unlimited without entitlement/limit check.
- No hosted video can be used unlimited without entitlement/limit check.
- Upload/storage limits are enforced.
- Transaction fees are charged during trial/pilot.
- Discounts apply only to subscription fee, not transaction/platform fees.

---

## 16. Important Non-Goals for V1

Do not build these in the first implementation unless already trivial:

```txt
Public pricing page
Fully automated self-service plan switching for schools
White-label billing automation
Complex metered invoice generation
External accounting integration
Automated card charging for subscription renewals
Full predictive pricing AI
```

Focus first on:

```txt
Admin-controlled subscriptions
School visibility
Feature gating
Usage limits
Cost tracking
Trial/pilot lifecycle
Transaction fee enforcement
```

---

## 17. Final Architecture Summary

The correct architecture is:

```txt
SubscriptionTier
  defines default features, pricing, limits, transaction policies

SchoolSubscription
  stores assigned tier, lifecycle status, dates, snapshots, overrides

Entitlement Resolver
  tells frontend/backend what the school can access

Usage Events + UsageMetric
  track AI, video, storage, payments, notifications, app usage, cost

Feature Gates
  protect expensive/premium backend APIs and frontend UI

School Admin Billing Page
  shows current plan, features, usage, transaction policy, upgrade request

Platform Admin Billing Console
  edits tiers, assigns subscriptions, tracks usage/revenue/cost/margins
```

This approach fits the existing EduSentrix codebase while preventing silent bugs, public pricing exposure, and cost leakage.

---

# Addendum A — Expiration Access Policy, Annual Billing, and UI Completion Requirements

This addendum closes three important product gaps:

1. What happens when a school subscription ends.
2. How yearly/annual subscriptions work.
3. Exact UI expectations for school admin and platform admin subscription screens.

These requirements are part of the definition of done for the subscription feature.

---

## A1. Subscription End Policy — Do Not Immediately Block Everything

### Product rule

When a school subscription, free trial, or pilot ends, EduSentrix must **not immediately hard-block the whole school from accessing the platform**.

A hard block can damage trust, interrupt school operations, and create support pressure. Instead, use a staged lifecycle:

```txt
active/trialing/pilot
→ grace
→ restricted_read_only
→ suspended
→ archived/cancelled
```

### Access behavior by status

| Status | School access | Data visibility | New actions | Expensive features | Platform/admin action |
|---|---|---|---|---|---|
| `active` | Full according to tier | Full | Allowed within entitlements | Allowed within limits | Normal |
| `trialing` | Trial access | Full trial data | Allowed within trial limits | Strictly limited | Convert to paid/pilot |
| `pilot` | Pilot access | Full pilot data | Allowed within pilot limits | Strictly limited | Convert to paid/extend/end |
| `grace` | Mostly normal access | Full | Allowed for core workflows | Blocked or reduced | Renew/convert |
| `restricted_read_only` | Read-only core access | Full | Block most creates/updates | Block all expensive actions | Renew/reactivate |
| `suspended` | Minimal access only | Billing/account view only | Blocked | Blocked | Platform admin/reactivation |
| `cancelled` | No active subscription | Data retained per retention policy | Blocked | Blocked | Platform admin/manual |
| `archived` | No school access | Data archived | Blocked | Blocked | Platform admin only |

### Grace period recommendation

Default grace period:

```txt
7 to 14 days
```

Recommended default:

```txt
14 days
```

During grace:

```txt
Core admin workflows may remain usable.
Leo AI should be blocked or reduced to emergency/demo credits only.
Hosted video should be blocked.
New file uploads should be blocked if storage is already over limit.
Online payments may remain enabled because they generate transaction revenue.
School admin sees persistent renewal banner.
Platform admin sees school as at-risk.
```

### Restricted read-only mode

After grace ends, move school to:

```txt
restricted_read_only
```

Read-only means users can view existing records but cannot create major new records.

Allowed examples:

```txt
View dashboard
View students
View teachers
View fee balances
View lesson notes
View lessons
View reports already generated
View subscription/billing page
Request renewal/contact support
```

Blocked examples:

```txt
Create students
Create teachers
Generate invoices
Create lesson notes
Create lessons
Use Leo
Create hosted video meeting
Upload new files
Create exam paper
Generate AI questions
Create fundraising campaign
Send bulk notifications
```

Exception: platform admin may configure certain revenue-generating or operationally important features to remain available, such as payment collection, if this helps the school settle outstanding balances.

### Suspended mode

Suspended schools should only access:

```txt
Subscription status page
Billing/contact page
Limited read-only school identity info
```

All module dashboards should show a subscription lock screen.

### Never delete immediately

EduSentrix must not delete school data automatically when a subscription ends.

Use retention policy later:

```txt
Cancelled schools: retain data for 90–180 days unless contract says otherwise.
Archived schools: platform admin only.
Permanent deletion: manual admin action with confirmation and audit log.
```

---

## A2. Backend Enforcement for Expired/Ended Subscriptions

### Add access mode resolver

Create:

```txt
src/lib/billing/resolve-school-access-mode.ts
```

Function:

```ts
export type SchoolAccessMode =
  | "full"
  | "trial_limited"
  | "pilot_limited"
  | "grace"
  | "restricted_read_only"
  | "suspended";

export async function resolveSchoolAccessMode(schoolId: string): Promise<SchoolAccessMode>;
```

### Access mode should consider

```txt
SchoolSubscription.status
startsAt
endsAt
trialEndsAt
pilotEndsAt
gracePeriodEndsAt
manual platform admin override
school-specific subscription lock setting
```

### Add write guard

Create:

```txt
src/lib/billing/require-school-write-access.ts
```

Example:

```ts
await requireSchoolWriteAccess({
  schoolId,
  action: "students.create",
});
```

This should block writes when access mode is:

```txt
restricted_read_only
suspended
cancelled
archived
```

unless the action is explicitly allowed.

### Add expensive action guard

Create or extend:

```txt
src/lib/billing/require-entitlement.ts
src/lib/billing/check-usage-limit.ts
```

Expensive actions must be blocked when status is not active/pilot/trial with available limits.

Expensive actions include:

```txt
Leo AI
AI exam generation
AI lesson generation
hosted video minutes
large file upload
bulk notifications
PDF-heavy exports if they become costly
API access
```

### Completion verification

- Expired subscription does not crash the app.
- Expired school can still view existing data during read-only mode.
- Expired school cannot create expensive resources.
- Direct API calls cannot bypass read-only or suspension.
- School admin gets a clear renewal message.
- Platform admin can manually reactivate or extend grace.

---

## A3. Annual / Yearly Subscriptions

### Product rule

EduSentrix must support:

```txt
term billing
annual billing
custom billing
```

Monthly may exist internally but should not be the default school sales model.

### Billing cadence enum

Ensure `SubscriptionTier` and `SchoolSubscription` support:

```ts
export type BillingCadence = "term" | "annual" | "monthly" | "custom";
```

### Annual subscription behavior

Annual subscription means:

```txt
The school pays for the full academic year.
The subscription covers multiple academic terms.
The plan limits may be annual or term-reset depending on metric.
```

### Annual discount

Each tier should support:

```ts
annualDiscountPercent?: number;
```

Recommended default:

```txt
10% annual discount
```

### Annual billing calculation

If a plan has:

```txt
pricePerStudentPerTerm = GH₵20
termsPerAcademicYear = 3
studentCount = 500
annualDiscountPercent = 10
```

Then:

```txt
Base annual = 20 × 500 × 3 = GH₵30,000
Discount = 10% = GH₵3,000
Final annual = GH₵27,000
```

Minimum annual fee should respect term minimums:

```txt
minimumAnnualFee = minimumTermFee × termsPerAcademicYear × (1 - annualDiscountPercent)
```

### Usage limits for annual subscriptions

Use two limit reset strategies:

#### Term-reset limits

For school operational features:

```txt
AI actions if desired
notifications
video minutes
```

These may reset each term even if subscription is annual.

#### Annual pool limits

For storage and high-level annual contracts:

```txt
storage
annual AI token pool for Enterprise
annual hosted video pool for Enterprise
```

Subscription tier should support:

```ts
usageResetPolicy: "term" | "annual" | "custom";
```

For simplicity, recommended V1:

```txt
Annual subscription pays once for the year.
Usage limits still reset termly unless explicitly configured otherwise.
Storage is cumulative and does not reset.
```

### School admin UI for annual billing

School admin billing page must show:

```txt
Billing cadence: Annual
Academic year covered
Terms covered
Start date
End date
Next renewal date
Annual discount applied
Usage reset policy
```

### Platform admin UI for annual billing

Platform admin should be able to:

```txt
Assign annual subscription
Set academic year covered
Select terms included
Set annual discount
Override annual amount
Set usage reset policy
Extend annual subscription
Convert term subscription to annual
Convert annual subscription back to term for next cycle only
```

### Completion verification

- Platform admin can create annual subscription.
- School admin can see annual subscription clearly.
- Annual price calculation is correct.
- Annual subscription does not expose public pricing.
- Usage limits still enforce correctly.
- Yearly subscription can coexist with term subscriptions without breaking entitlement checks.

---

## A4. Free Trial and Pilot Fee Rules

### One-month free trial

A one-month free trial should not charge base subscription fees.

During one-month trial, the school may still pay:

```txt
Payment transaction platform fees
Gateway fees
SMS/WhatsApp notification costs beyond free allowance
Extra storage beyond trial allowance
Hosted video add-on if enabled manually
Custom onboarding/data migration fee if EduSentrix team performs setup
```

Recommended trial defaults:

```txt
Duration: 30 days
Base subscription: GH₵0
Transaction fees: yes
Gateway fees: yes
Leo: limited
Hosted video: none or very limited
Storage: 1–2 GB
Notifications: small allowance
Online payments: sandbox by default, real payments only if platform admin enables
```

### Pilot term

Pilot term is not the same as a free trial.

Recommended pilot:

```txt
Duration: 1 academic term
Base subscription: discounted or waived depending on sales strategy
Transaction fees: yes
Gateway fees: yes
Leo: limited
Hosted video: limited or add-on
Storage: limited
Notifications: limited/free allowance then paid
Onboarding fee: waived or discounted for pilot schools
```

Recommended pilot pricing options:

```txt
Option A: 50% off Growth plan for one term
Option B: base subscription waived but transaction/storage/AI/video overages paid
Option C: fixed pilot fee + transaction fees
```

For serious schools, Option A is preferred because paying schools are more committed.

### Trial/pilot expensive resource limits

Set per subscription snapshot:

```ts
trialLimitsSnapshot: {
  maxLeoActions: 50,
  maxLeoTokens: 100000,
  maxHostedVideoParticipantMinutes: 0,
  maxStorageBytes: 2 * GB,
  maxNotificationCredits: 100
}
```

Pilot example:

```ts
pilotLimitsSnapshot: {
  maxLeoActionsPerTerm: 250,
  maxLeoTokensPerTerm: 500000,
  maxHostedVideoParticipantMinutesPerTerm: 300,
  maxStorageBytes: 10 * GB,
  maxNotificationCreditsPerTerm: 500
}
```

### Completion verification

- Trial schools are not charged base subscription.
- Trial schools still pay platform transaction fees.
- Trial schools cannot exceed AI/video/storage limits.
- Pilot schools have limited expensive features.
- Pilot/trial end transitions work.
- UI clearly shows trial/pilot remaining days and usage.

---

## A5. Detailed School Admin UI Specification

### Page

```txt
src/app/(app)/admin/billing/page.tsx
```

### Purpose

The school admin billing page is not a marketing/pricing page. It is a subscription visibility and usage-control page.

### Required layout

#### 1. Subscription hero card

Show:

```txt
Current plan name
Status badge
Billing cadence: Term / Annual / Custom / Trial / Pilot
Current period covered
Days remaining
Renewal/end date
Access mode: Full / Grace / Read-only / Suspended
```

For trial/pilot, show:

```txt
Trial/Pilot banner
Remaining days
What happens after it ends
Transaction fee notice
```

#### 2. Feature access section

Grouped feature list:

```txt
Core Administration
Academics
Payments & Finance
Communication
AI / Leo
Video Meetings
Storage & Files
Advanced Modules
Enterprise Features
```

Each feature should show:

```txt
Enabled / Not included / Limited
Limit where relevant
Upgrade/contact prompt when locked
```

#### 3. Usage meters

Show meters for:

```txt
Students count vs limit
Teachers count vs limit
Storage used vs allowance
Leo actions/tokens used vs allowance
Hosted video participant-minutes used vs allowance
Notification credits used vs allowance
Payment volume
Fundraising volume
```

Use progress bars and clear warnings:

```txt
Under 70%: normal
70–90%: warning
90–100%: danger
Over limit: blocked/upgrade required
```

#### 4. Transaction fee card

Show:

```txt
School fee platform fee %
Fundraising platform fee %
Cap per transaction
Who pays fees: parent/payer or school absorbs
Gateway fee note
```

#### 5. Expiration/renewal card

Show lifecycle-specific instructions.

For grace/read-only:

```txt
Your subscription has ended. Existing data remains safe. Some actions are restricted until renewal.
```

Actions:

```txt
Request renewal
Contact EduSentrix
Download usage summary
```

#### 6. No public pricing

Do not show public plan comparison cards.

Allowed:

```txt
Request plan review
Contact platform admin
Show current plan only
```

### UI components

Use premium platform components only:

```txt
Card
Button
Badge
Progress/LimitIndicator
SubscriptionBadge
UsageMeter
FeatureAccessList
TrialPilotBanner
SubscriptionStatusBanner
```

Do not use raw unstyled tables.

### Completion verification

- School admin understands current subscription without contacting support.
- Trial/pilot limits are visible.
- Annual billing is displayed correctly.
- Expired subscription state is clearly displayed.
- Public pricing is not exposed.
- UI matches EduSentrix premium feel.

---

## A6. Detailed Platform Admin UI Specification

### Pages

```txt
src/app/(app)/platform/billing/page.tsx
src/app/(app)/platform/schools/[id]/subscription/page.tsx
src/app/(app)/platform/schools/[id]/usage/page.tsx
```

### Platform billing tiers page

Must support:

```txt
Create tier
Edit tier
Deactivate tier
Create new tier version
Set tier visibility public/internal
Set term price
Set annual price/discount
Set minimum term fee
Set onboarding fee
Configure entitlements
Configure limits
Configure transaction fees
Configure trial defaults
Configure pilot defaults
```

### School subscription detail page

Must support:

```txt
Assign tier
Select billing cadence: term / annual / custom
Set academic year
Set term(s)
Set start/end dates
Set trial dates
Set pilot dates
Set grace period
Set status
Set school-specific overrides
Set transaction fee override
Set storage/AI/video override
Suspend/reactivate/cancel
Extend trial/pilot/grace
Convert trial/pilot to paid
View event timeline
View usage and margin estimate
```

### Usage dashboard

Must show:

```txt
AI usage and estimated cost
Video participant-minutes and estimated cost
Storage used and estimated cost
UploadThing file usage by module
MongoDB storage-sensitive counts where possible
Notifications sent and estimated cost
Payment volume
EduSentrix platform fees earned
Gateway fees estimate
App usage hours
Most active modules
Cost-to-serve estimate
Margin estimate
```

### Completion verification

- Platform admin can manage term and annual subscriptions.
- Platform admin can configure trial/pilot limits.
- Platform admin can see cost-driving usage.
- Tier changes do not silently mutate existing school subscriptions unless explicitly migrated.
- All sensitive actions create subscription event/audit logs.

---

## A7. Required Acceptance Criteria Updates

The subscription feature is not complete until all of the following pass:

```txt
1. A school can be assigned Starter/Growth/Premium/Enterprise.
2. A school can be assigned term billing.
3. A school can be assigned annual billing.
4. Trial subscriptions can run for one month.
5. Pilot subscriptions can run for one term.
6. Trial/pilot schools pay transaction fees.
7. Trial/pilot schools have limited Leo/video/storage/notifications.
8. Subscription ending moves school through grace/read-only/suspended instead of instant hard block.
9. Existing data remains visible in read-only mode.
10. Expensive actions are blocked after limits or expiration.
11. School admin can see current plan, cadence, status, dates, features, usage, and transaction fees.
12. School admin cannot see public pricing cards.
13. Platform admin can edit tiers, limits, transaction fees, trial/pilot defaults, annual discounts, and school overrides.
14. Platform admin can view AI/video/storage/payment/app-usage metrics.
15. Backend gates enforce entitlements even when UI is bypassed.
16. Downgrade/expiration does not delete existing data.
17. All lifecycle changes are logged.
18. Annual price calculation is tested.
19. Usage reset behavior is tested for term and annual billing.
20. No silent bugs occur when old subscription records lack new fields; defaults are safely resolved.
```
