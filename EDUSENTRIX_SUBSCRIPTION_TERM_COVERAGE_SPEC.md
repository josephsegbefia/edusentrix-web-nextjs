# EduSentrix Subscription Term Coverage Spec

## Purpose

EduSentrix subscriptions are sold around school operations, so billing must follow academic term coverage rather than generic calendar-only SaaS periods. One academic year is treated as three billing term units.

## Core Rules

1. A termly subscription covers one billing term unit.
2. An annual subscription covers three consecutive billing term units.
3. Annual coverage can start in any term. If purchased in Term 2, it covers Term 2, Term 3, and Term 1 of the next academic year.
4. Billing must not depend on the school admin having created all academic periods.
5. When academic periods exist, coverage snapshots should link to them and use their dates.
6. When academic periods are missing, the system creates estimated billing term labels and dates, then stores them as billing coverage snapshots.
7. Upgrade charges are immediate and prorated against unused paid coverage.
8. Downgrades are scheduled for the next renewal/next uncovered term. No automatic refund is issued.
9. Same-tier termly-to-annual cadence changes are scheduled from the next term by default.
10. Renewal extends coverage from the next uncovered term by one term unit for termly billing or three term units for annual billing.

## Pricing Rules

The per-term plan charge is:

```text
max(active_students * price_per_student_per_term, minimum_term_fee)
```

Annual billing is:

```text
per_term_charge * 3 - annual_discount
```

The minimum fee is still a per-term minimum. For annual billing, the minimum applies to each of the three covered terms.

## Change Rules

### Same Tier, Termly To Annual

The current paid term stays unchanged. Annual billing is scheduled from the next term and shown on the subscription dashboard as a pending cadence change.

### Upgrade

The upgraded tier unlocks immediately after payment. The invoice amount is:

```text
prorated target value for remaining coverage - unused current paid credit
```

If the result is zero or negative, no payment is required.

### Downgrade

Downgrades are scheduled for the next renewal boundary. The school keeps the paid higher-tier access until the current coverage ends.

## UI Requirements

School admins and platform admins must be able to open a branded explanation of subscription coverage, annual billing, upgrades, downgrades, and examples. The guide must also be downloadable as a PDF.

## Data Requirements

Subscriptions and invoices store a billing coverage snapshot containing:

- coverage unit: `term`
- covered term count
- whether the coverage was academic-period aligned or estimated
- segments for each covered term
- human-readable summary

This snapshot is authoritative for billing history even if academic periods are edited later.
