# EduSentrix Subscription System

> Spec reference: `EDUSENTRIX_SUBSCRIPTION_MANAGEMENT_SPEC_FINAL_REBUILD.md`

This module is the single authority for school subscription enforcement, feature entitlements, plan limits, usage metering, and billing calculations across the EduSentrix platform.

---

## Module Map

| File | Purpose |
|---|---|
| `feature-keys.ts` | Canonical `FEATURE_KEYS` registry. All feature references in the app must use these constants — never raw strings. |
| `limit-keys.ts` | Canonical `LIMIT_KEYS` and `DEFAULT_PLAN_LIMITS`. Per-plan quantitative limits (students, credits, storage, etc.). |
| `plan-codes.ts` | `PLAN_CODES`, `PLAN_META`, `normaliseSubscriptionStatus`, `isKnownPlanCode`. |
| `plan-entitlements.ts` | `PLAN_ENTITLEMENTS` map: every `PlanCode × FeatureKey → "YES" \| "LIMITED" \| "OPTIONAL" \| "NO"`. |
| `access-mode.ts` | `resolveAccessMode()` — maps status + dates to `SchoolAccessMode` (`full`, `pilot_limited`, `grace`, `restricted_read_only`, `suspended`). Also `canCreateInAccessMode`, `canUseAiInAccessMode`, `getAccessModeBannerMessage`. |
| `resolve-school-entitlements.ts` | **Primary entitlement resolver.** Returns `SchoolEntitlementSnapshot` with `.hasFeature()`, `.getLimit()`, live usage, and charge summary. Always call this instead of reading raw subscription documents. |
| `guards.ts` | `requireSchoolFeature`, `enforceSchoolLimit`, `requireSchoolWriteAccess`, `requireUsageCredits` — server-only guards for API routes and server actions. |
| `require-page-feature.ts` | `requirePageFeature` — server-side page-level guard for Next.js App Router layouts. |
| `transaction-fees.ts` | `resolveTransactionChargeConfig`, `computeTransactionFeeFromConfig` — fee calculation helpers. |
| `resolve-payment-charge-policy.ts` | `resolvePaymentChargePolicy` — resolves the active `PaymentChargePolicy` for a school and payment category, following the 4-level precedence rule. |
| `usage-tracker.ts` | `trackUsage`, `reserveUsageCredits`, `finalizeUsageCredits`, `refundUsageCredits` — metered usage tracking with a safe reserve/finalize/refund pattern for AI and meeting credits. |
| `record-event.ts` | `recordSubscriptionEvent` — fire-and-forget audit log writer for subscription lifecycle and entitlement events. |
| `subscription-errors.ts` | Structured error classes: `SubscriptionError`, `FeatureGatedError`, `LimitExceededError`, `AccessModeError`, `UsageExhaustedError`. Use these in API routes; they have `toApiResponse()`. |
| `role-entitlement-rules.ts` | `ROLE_ENTITLEMENT_RULES`, `roleCanReadFeature`, `roleCanWriteFeature`, `roleAndPlanCanRead`, `roleAndPlanCanWrite` — per-role feature access rules layered on top of plan entitlements. |
| `consistency-scanner.ts` | `runEntitlementConsistencyScan` — detects entitlement leakage and mismatches across all schools. Used by the platform leakage dashboard. |
| `health-scan.ts` | `runSubscriptionHealthScan` — flags schools with expiring or lapsed subscriptions for operator attention. |
| `index.ts` | Re-exports all public symbols from the module for clean imports. |

---

## Enforcement Flags

All guards and resolvers respect these environment variables. **Set them to `"true"` in production when enforcement is ready.**

| Variable | Effect |
|---|---|
| `SUBSCRIPTION_ENFORCEMENT_ENABLED` | Master switch. While `false`, `resolveAccessMode` always returns `full` and `hasFeature()` always returns `true`. |
| `SUBSCRIPTION_API_GATES_ENABLED` | Enables API route guards (`requireSchoolFeature`, `enforceSchoolLimit`). |
| `SUBSCRIPTION_FRONTEND_GATES_ENABLED` | Enables page-level gates (`requirePageFeature`) and locked-module UI components. |
| `SUBSCRIPTION_PAYMENT_CHARGES_ENABLED` | Enables `resolvePaymentChargePolicy` to apply real charges. While `false`, charges are waived. |
| `SUBSCRIPTION_AUDIT_LOGS_ENABLED` | Enables fire-and-forget audit events on guard denials and lifecycle changes. |

---

## How Feature Gating Works

```
SchoolEntitlementSnapshot = resolveSchoolEntitlements(schoolId)
  ↓
snapshot.hasFeature(FEATURE_KEYS.ACADEMICS_SCHEMES)
  = subscription.features.includes(key)        ← plan entitlements
  && accessMode not in [suspended]             ← access mode check
  && enforcement flag is on
```

API routes should use guards, not snapshot calls directly:

```typescript
// In an API route:
const guard = await requireSchoolFeature(schoolId, FEATURE_KEYS.ACADEMICS_SCHEMES);
if (!guard.allowed) return NextResponse.json({ success: false, error: guard.reason }, { status: 403 });
```

Page-level gates live in `layout.tsx` files:

```typescript
// In src/app/(app)/admin/schemes/layout.tsx:
const gate = await requirePageFeature(FEATURE_KEYS.ACADEMICS_SCHEMES);
if (gate) return gate;
return <>{children}</>;
```

---

## AI Credit Reserve / Finalize / Refund Pattern

For metered features like Leo AI that make external calls (which can fail), always use the three-step pattern:

```typescript
// 1. Reserve credits before the expensive call
const { ok, reservation, reason } = await reserveUsageCredits({
  schoolId, creditType: "leo_credits", amount: 1
});
if (!ok || !reservation) return errorResponse(reason);

try {
  // 2. Make the expensive call
  const result = await callLeoApi(...);

  // 3a. On success — finalize
  await finalizeUsageCredits(reservation, actualCreditsUsed).catch(() => {});
  return successResponse(result);
} catch {
  // 3b. On failure — refund
  await refundUsageCredits(reservation, "Call failed").catch(() => {});
  return errorResponse("AI generation failed");
}
```

---

## Payment Charge Policy Precedence

The `resolvePaymentChargePolicy` function follows this 4-level precedence order:

1. `school_category` — school-specific + payment category (highest priority)
2. `school` — school-specific default
3. `category` — global category default
4. `global` — global default (lowest priority)
5. No matching policy → `payerMode: "waived"`, zero charge

---

## Access Mode Reference

| Mode | Readable | Writable (gated) | AI | Payments |
|---|---|---|---|---|
| `full` | ✅ | ✅ | ✅ | ✅ |
| `pilot_limited` | ✅ | ✅ (pilot features only) | ✅ | ✅ |
| `grace` | ✅ | ✅ | ❌ | ✅ |
| `restricted_read_only` | ✅ | ❌ | ❌ | ✅ |
| `suspended` | ❌ | ❌ | ❌ | ❌ |

---

## Plan Tier Summary

| Plan | Code | Purpose |
|---|---|---|
| Pilot | `pilot` | Free onboarding. Limited features explicitly enabled. |
| Starter | `starter` | Core school ops: students, fees, comms, basic academics. |
| Growth | `growth` | Adds schemes, lesson notes, Leo AI, examinations. |
| Premium | `premium` | Adds advanced analytics, meetings, priority support, higher limits. |

---

## Tests

```bash
# Run all subscription tests
npx tsx --test tests/subscription.*.test.ts

# Individual test files
npx tsx --test tests/subscription.pricing.test.ts
npx tsx --test tests/subscription.access-mode-extended.test.ts
npx tsx --test tests/subscription.role-entitlements.test.ts
npx tsx --test tests/subscription.plan-map.test.ts
npx tsx --test tests/subscription.access-mode.test.ts
npx tsx --test tests/subscription.feature-keys.test.ts
npx tsx --test tests/subscription.limit-keys.test.ts
```
