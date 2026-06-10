# School Activities And Event Payments Spec

## Purpose

Schools need a way to collect money for term-time activities that are not known at reopening and should not be treated as tuition, term fees, arrears, or standard invoices. Examples include excursions, sports trips, graduation charges, PTA activities, practical fees, club trips, and special one-off contributions.

This feature adds a separate but finance-integrated module for payable school activities. It must be clear to parents, auditable for administrators, and compatible with the existing payment setup, reconciliation, parent dashboard, and multi-ward parent experience.

## Product Decision

Activity payments are **not normal school fees**.

They should:

- Be created during a term at any time.
- Target a whole school, grade, class group, or selected students.
- Generate per-student payable obligations only when published.
- Be visible to parents separately from tuition/term fees.
- Allow a parent to pay for one ward or multiple eligible wards in one checkout.
- Use the existing payment provider and reconciliation infrastructure where possible.
- Remain reportable as a separate finance category.

They should not:

- Inflate tuition arrears.
- Be hidden inside fee structures.
- Require rebuilding term fee invoices.
- Require a parent to pay for all wards at once.
- Create duplicate charges when an activity is edited or republished.

## User Roles

### School Admin

Can create, publish, edit draft activities, cancel activities, review collection progress, and manage eligibility.

### Bursar / Finance Delegate

Can review collections, export unpaid lists, reconcile payments, mark approved offline payments where that capability already exists, and issue refunds/credits according to school policy.

### Parent

Can see activities for their wards, read details, select eligible wards, and pay.

### Student

Student-facing visibility can be added later. Initial implementation should focus on admin and parent surfaces.

## Core Concepts

### School Activity

The event or activity created by the school.

Example:

- Title: `JHS Excursion to Aburi Gardens`
- Event date: `2026-07-12`
- Payment deadline: `2026-06-30`
- Amount per student: `GHS 300`
- Eligibility: `JHS 1 A`, `JHS 1 B`, `JHS 2 A`
- Status: `published`

### Student Activity Charge

The actual payable obligation generated for one eligible student.

Example:

- Activity: `JHS Excursion to Aburi Gardens`
- Student: `Jeniah Heracles`
- Amount: `GHS 300`
- Status: `unpaid`

This is the record parents pay against.

### Multi-Ward Checkout

If a parent has multiple eligible wards, the parent chooses which ward charges to pay in one checkout.

Example:

| Ward | Class | Amount | Status |
|---|---|---:|---|
| Jeniah Heracles | JHS 1 A | GHS 300 | Unpaid |
| Kobby Heracles | JHS 1 B | GHS 300 | Unpaid |

Parent can pay:

- Jeniah only: `GHS 300`
- Kobby only: `GHS 300`
- Both: `GHS 600`

## Proposed Data Model

### `SchoolActivity`

Collection: `schoolactivities`

Fields:

- `_id`
- `schoolId`
- `academicPeriodId`
- `title`
- `description`
- `category`
  - `excursion`
  - `graduation`
  - `sports`
  - `club`
  - `pta`
  - `exam_practical`
  - `supplies`
  - `other`
- `eventDate`
- `paymentDeadline`
- `amountMinor`
- `currency`
- `allowPartialPayment`
- `visibility`
  - `draft`
  - `published`
  - `closed`
  - `cancelled`
- `eligibilityMode`
  - `school`
  - `grades`
  - `class_groups`
  - `students`
- `eligibleGradeIds`
- `eligibleClassGroupIds`
- `eligibleStudentIds`
- `attachmentUrl`
- `attachmentName`
- `coverImageUrl`
- `createdBy`
- `updatedBy`
- `publishedAt`
- `publishedBy`
- `closedAt`
- `cancelledAt`
- `cancellationReason`
- `createdAt`
- `updatedAt`

Indexes:

- `{ schoolId: 1, academicPeriodId: 1, visibility: 1, eventDate: 1 }`
- `{ schoolId: 1, paymentDeadline: 1 }`
- `{ schoolId: 1, category: 1, createdAt: -1 }`

### `StudentActivityCharge`

Collection: `studentactivitycharges`

Fields:

- `_id`
- `schoolId`
- `activityId`
- `academicPeriodId`
- `studentId`
- `gradeId`
- `classGroupId`
- `amountMinor`
- `currency`
- `status`
  - `unpaid`
  - `partially_paid`
  - `paid`
  - `overdue`
  - `waived`
  - `cancelled`
  - `refunded`
  - `credited`
- `amountPaidMinor`
- `amountOutstandingMinor`
- `dueAt`
- `paidAt`
- `paymentIds`
- `paymentIntentIds`
- `waivedAt`
- `waivedBy`
- `waiverReason`
- `cancelledAt`
- `createdAt`
- `updatedAt`

Indexes:

- Unique: `{ schoolId: 1, activityId: 1, studentId: 1 }`
- `{ schoolId: 1, studentId: 1, status: 1 }`
- `{ schoolId: 1, activityId: 1, status: 1 }`
- `{ schoolId: 1, classGroupId: 1, status: 1 }`
- `{ schoolId: 1, dueAt: 1, status: 1 }`

The unique index is required so publishing or republishing an activity cannot duplicate charges.

## Status Lifecycle

### Activity Status

`draft`

- Editable.
- Not visible to parents.
- No charges exist unless the implementation chooses preview-only generated rows. Initial implementation should not create real charges in draft.

`published`

- Visible to eligible parents.
- Charges generated for eligible students.
- Amount and eligibility become restricted.

`closed`

- No new payment attempts.
- Historical reporting remains visible.

`cancelled`

- Unpaid charges become cancelled.
- Paid charges require school policy handling: refund, credit, or manual follow-up.

### Charge Status

`unpaid`

- Parent can pay.

`partially_paid`

- Only if `allowPartialPayment` is enabled.

`paid`

- Fully settled.

`overdue`

- Deadline passed and unpaid/outstanding.

`waived`

- Admin/bursar waived the charge.

`cancelled`

- Activity cancelled or student removed before payment.

`refunded` / `credited`

- Used after paid activity cancellation or adjustment.

## Admin Experience

### Activity List

Route suggestion:

- `/admin/finance/activity-payments`
- or `/admin/activities/payments`

Recommended placement:

- Finance group if the school thinks of it as collections.
- Activities/Operations group if the school thinks of it as event management.

Initial recommended label:

**Activity Payments**

List should show:

- Activity title
- Category
- Event date
- Payment deadline
- Amount
- Published/draft/closed/cancelled status
- Eligible student count
- Paid count
- Unpaid count
- Collection percentage
- Total expected
- Total collected

Actions:

- Create activity
- Edit draft
- Publish
- View collection
- Close
- Cancel
- Export unpaid

### Activity Create/Edit Form

Use a wizard to avoid clutter.

Step 1: Activity Details

- Title
- Category
- Description
- Event date
- Payment deadline
- Attachment/cover image optional

Step 2: Payment Setup

- Amount
- Currency
- Partial payment toggle
- Late payment policy text optional

Step 3: Eligibility

- Whole school
- Grade(s)
- Class group(s)
- Selected students

Step 4: Review And Publish

- Summary
- Eligible student count
- Expected total
- Warning if deadline is before today or event date
- Publish button

### Collection Detail

Shows:

- Activity summary
- Collection metrics
- Student table
- Filters: paid, unpaid, overdue, waived, class group
- Search student
- Export CSV

Student table:

| Student | Class | Amount | Paid | Outstanding | Status | Last Payment |
|---|---|---:|---:|---:|---|---|

Actions:

- View payments
- Waive charge
- Cancel charge
- Send reminder

## Parent Experience

### Parent Dashboard

Add a card:

**Upcoming Activity Payments**

Shows:

- Number of unpaid activity charges
- Nearest deadline
- Total outstanding for activity payments
- Link to activity payments page

### Parent Fees Page

Add a tab:

- `School Fees`
- `Activity Payments`
- `Payment History`

Activity Payments tab shows grouped activities.

Each activity card:

- Title
- Description
- Event date
- Deadline
- Amount per ward
- Eligible ward rows
- Status per ward
- Select checkboxes for unpaid wards
- Pay selected

Example:

| Ward | Class | Amount | Status | Select |
|---|---|---:|---|---|
| Jeniah Heracles | JHS 1 A | GHS 300 | Unpaid | checked |
| Kobby Heracles | JHS 1 B | GHS 300 | Paid | disabled |

Footer:

- Selected wards: `1`
- Total: `GHS 300`
- `Pay selected`

### Ward Detail Page

On each ward detail page, show activity payment summary:

- Upcoming unpaid activity payments for this ward.
- Paid activity history for this ward.

This should not replace the main parent payment page.

## Payment Integration

Use existing payment setup and provider flow.

Payment intent metadata should include:

- `paymentType: "activity_payment"`
- `activityId`
- `studentActivityChargeIds`
- `studentIds`
- `schoolId`
- `parentUserId`

On successful payment:

- Create/update payment record using existing payment model patterns.
- Allocate payment to each selected `StudentActivityCharge`.
- Update `amountPaidMinor`.
- Update `amountOutstandingMinor`.
- Set status to `paid` when outstanding is zero.
- Keep normal invoice/fee allocation separate.

If multiple ward charges are paid in one checkout, either:

- create one payment with multiple allocations, or
- create one parent payment intent and multiple charge allocations.

Do not create term fee invoices for activity payments in the first implementation.

## Reconciliation

Activity payments must appear in finance reconciliation with clear category labels.

Required labels:

- `Activity Payment`
- Activity title
- Student name
- Parent payer name/email if available

Finance exports should allow filtering by:

- payment type
- activity
- class group
- payment status
- date range

## Notifications

Initial implementation:

- No automatic email requirement for MVP.
- Parent dashboard and parent fees tab are enough.

Later:

- Publish notification to eligible parents.
- Reminder before deadline.
- Overdue reminder.
- Cancellation notice.

Notifications must use existing communication infrastructure and should not add SMS/WhatsApp unless that provider story is intentionally restored.

## Permissions

Admin permissions:

- `activity_payments.view`
- `activity_payments.manage`
- `activity_payments.publish`
- `activity_payments.cancel`
- `activity_payments.waive`

MVP can map these onto existing finance/admin permissions if the permission registry is not ready.

Recommended MVP permission mapping:

- School admin: all activity payment actions.
- Finance delegate/bursar: view collections, export, waive if finance permission allows.
- Teacher: no access unless later involved in trip management.
- Parent: own eligible ward charges only.

## API Surface

### Admin

`GET /api/admin/activity-payments`

List activities.

`POST /api/admin/activity-payments`

Create draft activity.

`GET /api/admin/activity-payments/[id]`

Get activity detail and collection summary.

`PATCH /api/admin/activity-payments/[id]`

Edit draft activity.

`POST /api/admin/activity-payments/[id]/publish`

Generate charges idempotently and publish.

`POST /api/admin/activity-payments/[id]/close`

Close collections.

`POST /api/admin/activity-payments/[id]/cancel`

Cancel activity and unpaid charges.

`GET /api/admin/activity-payments/[id]/charges`

Student charge table.

`POST /api/admin/activity-payments/charges/[chargeId]/waive`

Waive one student charge.

### Parent

`GET /api/parent/activity-payments`

List activity charges for all wards accessible to the parent.

`GET /api/parent/wards/[id]/activity-payments`

List activity charges for one ward.

`POST /api/parent/activity-payments/checkout`

Create checkout for selected charge IDs.

`GET /api/parent/activity-payments/checkout-status`

Check payment status after redirect.

## Implementation Slices

### Slice 1: Data Model And Domain Helpers

Add:

- `SchoolActivity` model
- `StudentActivityCharge` model
- activity eligibility resolver
- idempotent charge generation helper
- amount/status calculation helper

Acceptance criteria:

- Publishing the same activity twice does not duplicate charges.
- Eligibility resolver returns correct students for school, grade, class group, and selected student modes.
- Charge statuses calculate correctly from amount paid/outstanding/deadline.

### Slice 2: Admin Draft Create/Edit

Add admin APIs and UI for draft creation.

Acceptance criteria:

- Admin can create a draft activity.
- Admin can edit draft details.
- No parent-visible charge exists before publish.
- Eligibility count is previewed before publish.

### Slice 3: Publish And Charge Generation

Add publish endpoint and collection summary.

Acceptance criteria:

- Publishing creates exactly one charge per eligible active student.
- Activity becomes visible to parents.
- Collection summary shows expected amount, paid amount, unpaid count, and total eligible students.
- Republish/retry is idempotent.

### Slice 4: Admin Collection Dashboard

Add detail page with charge table.

Acceptance criteria:

- Admin can filter by status/class/search.
- Admin can export collection list.
- Admin can waive unpaid charges with reason.
- Admin can close or cancel activity with confirmation.

### Slice 5: Parent Activity Payments List

Add parent-facing list for all wards.

Acceptance criteria:

- Parent sees only charges for wards they are linked to.
- Activity cards show event details, deadline, amount, and status per ward.
- Parent can select eligible unpaid ward charges.
- Paid/cancelled/waived charges cannot be selected.

### Slice 6: Checkout And Payment Allocation

Integrate with existing provider checkout.

Acceptance criteria:

- Parent can pay one selected activity charge.
- Parent can pay multiple ward charges in one checkout.
- Successful payment updates all selected charges.
- Activity payments remain separate from tuition/fee invoices.
- Payment history clearly labels activity payments.

### Slice 7: Reconciliation And Reporting

Expose activity payments in finance reporting.

Acceptance criteria:

- Finance can filter payments by activity payment type.
- Reconciliation labels show activity title and student names.
- Admin collection totals match payment allocation totals.

### Slice 8: Notifications And Reminders

Add optional reminders after core flow is stable.

Acceptance criteria:

- Admin can notify eligible parents after publish.
- Admin can send reminders to unpaid parents.
- Reminder recipients are scoped to actual unpaid charges.

## Edge Cases

### Parent Has Multiple Wards

Parent can choose which eligible ward charges to pay.

### One Ward Is Eligible, Another Is Not

Only eligible wards are shown for that activity.

### Parent Pays For One Ward Only

Only that ward charge becomes paid. Other ward charges remain unpaid.

### Activity Cancelled Before Payment

Unpaid charges become cancelled.

### Activity Cancelled After Payment

Paid charges must be marked for refund or credit. Do not silently delete paid records.

### Student Changes Class After Publish

Charge keeps snapshot `gradeId` and `classGroupId` from generation time. Admin can optionally regenerate eligibility in a later slice, but MVP should avoid automatic destructive changes.

### Student Withdrawn

Unpaid charge can be cancelled or waived. Paid charge remains historical.

### Deadline Passes

Charge becomes overdue for reporting and parent display. Whether payment is still allowed should be configurable later. MVP may allow payment after deadline unless activity is closed.

### Duplicate Publish Request

Unique `{ schoolId, activityId, studentId }` prevents duplicate charges.

## UI Quality Requirements

- Use existing premium glass workspace primitives where possible.
- Keep finance language serious and clear.
- Do not mix activity payments into normal fee arrears without a label.
- Parent UI must be simple: event, wards, amount, deadline, pay selected.
- Avoid fake actions. Buttons must either work or be disabled with a clear reason.
- Use confirmation dialog for publish, close, cancel, and waive.
- Use `CustomDatePicker` for dates in polished admin flows.

## Open Questions

1. Should activity payments be allowed after deadline if activity is still open?
2. Should schools be able to mark an activity as optional vs mandatory?
3. Should paid activity cancellation create parent credit automatically or require bursar action?
4. Should activities support capacity limits?
5. Should activities require parent consent forms before payment?

Recommended MVP answers:

- Allow payment after deadline until closed.
- Add `mandatory` later; MVP can treat all published activity charges as payable obligations.
- Require bursar/admin action for credits/refunds.
- No capacity limits in MVP.
- Consent forms later.

## Rollout Notes

This feature should be built after confirming existing payment setup and reconciliation are stable. It touches money movement, parent UX, and finance reporting, so each slice should be verified before starting the next.

Do not start with notifications. Start with clean models, idempotent charge generation, and parent checkout correctness.
