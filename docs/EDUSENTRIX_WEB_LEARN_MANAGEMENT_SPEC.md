# EduSentrix Web — EduSentrix Learn Management Spec

## 1. Purpose

This spec defines how the main **EduSentrix Web Next.js platform** should manage EduSentrix Learn from the web side.

This is separate from the mobile backend integration spec.

The web platform is located at:

```txt
/Users/josephelormsegbefia/desktop/elorm/appsentrix/edusentrix-web-nextjs
```

Production web platform:

```txt
https://tryedusentrix.app/
```

EduSentrix Learn is a separate student learning companion app, but the web platform must manage:

- student eligibility
- Learn account creation
- parent payment and access
- gifted access
- student activity visibility
- teacher visibility
- parent access and credential delivery
- platform oversight
- school/admin controls
- safe analytics

---

## 2. Non-Negotiable AI Agent Instructions

Before every slice, the AI agent must:

1. Read the web project `AGENTS.md`.
2. Inspect existing route, sidebar, auth, model, API, UI, and permission patterns.
3. If touching the mobile project, also read mobile `AGENTS.md` and `DESIGN_SYSTEM.md`.
4. Keep all changes additive and scoped.
5. Do not rewrite unrelated admin/teacher/parent/platform modules.
6. Do not break existing fees, payments, lesson notes, lessons, or parent modules.
7. Do not expose student Learn credentials to unauthorized users.
8. Do not put EduSentrix Learn parent payments into school fee invoices/payments.
9. Enforce school, grade, class group, teacher, parent-child, and platform scoping server-side.
10. Do not add new libraries unless approved.
11. Use existing premium UI primitives and sidebar conventions.
12. Include audit logs for sensitive actions.
13. Keep mobile Learn student data separate from school fee data.

---

## 3. Product Model

EduSentrix Learn access is controlled by two layers:

### 3.1 School eligibility

A school is eligible if:

- it is not on the Starter plan,
- its subscription is active/trial/pilot or otherwise platform-allowed,
- lesson notes/lessons features exist for the school,
- the school is not suspended/cancelled,
- platform has not disabled EduSentrix Learn for the school.

### 3.2 Student access

A student has access if:

- the student is active,
- the student belongs to an eligible school,
- the student has a LearnStudentAccount,
- the student has active LearnAccess for the current term,
- access is parent-paid, platform-gifted, school-sponsored, or manually granted,
- first-login password change is handled.

### 3.3 Parent payment

EduSentrix Learn is paid by parents directly to EduSentrix/Appsentrix.

Current price:

```txt
GHS 300 per student per term
```

The price must be configurable.

The payment is not a school fee and must not appear in school fee balances.

### 3.4 Gifted access

A platform admin can gift a student access if the student belongs to an eligible school.

School admins should not gift access unless platform policy later allows it.

---

## 4. Required Web Navigation

Add an **EduSentrix Learn** sidebar item to these role areas:

```txt
Platform admin
School admin
Teacher
Parent
```

Do not add a student web Learn area unless explicitly requested later, because the student Learn experience is the mobile app.

### 4.1 Platform sidebar

Observed file:

```txt
src/components/platform/PlatformSidebar.tsx
```

Add item:

```txt
Label: EduSentrix Learn
Href: /platform/learn
Icon: LeoIcon or GraduationCap/Sparkles
Permission: platform.learn.read
```

### 4.2 School admin sidebar

Observed file:

```txt
src/components/nav/sidebars/school-admin-sidebar.tsx
```

Add item:

```txt
Label: EduSentrix Learn
Href: /admin/learn
Icon: LeoIcon or Sparkles/BookOpen
```

Recommended section:

```txt
Learning
```

or near existing lesson/academics features.

### 4.3 Teacher sidebar

Observed file:

```txt
src/components/nav/sidebars/teacher-sidebar.tsx
```

Add item:

```txt
Label: EduSentrix Learn
Href: /teacher/learn
Icon: LeoIcon or Presentation/Sparkles
```

Recommended section:

```txt
Teacher Studio
```

or `Teaching`.

### 4.4 Parent sidebar

Observed file:

```txt
src/components/nav/sidebars/parent-sidebar.tsx
```

Add item:

```txt
Label: EduSentrix Learn
Href: /parent/learn
Icon: LeoIcon or BookOpen/Sparkles
```

Recommended section:

```txt
My Children
```

---

## 5. Recommended Web Routes

Create these route groups/pages.

### 5.1 Platform admin

```txt
src/app/platform/learn/page.tsx
src/app/platform/learn/schools/page.tsx
src/app/platform/learn/students/page.tsx
src/app/platform/learn/gifts/page.tsx
src/app/platform/learn/payments/page.tsx
src/app/platform/learn/settings/page.tsx
```

### 5.2 School admin

```txt
src/app/admin/learn/page.tsx
src/app/admin/learn/eligible-students/page.tsx
src/app/admin/learn/accounts/page.tsx
src/app/admin/learn/activity/page.tsx
src/app/admin/learn/settings/page.tsx
```

### 5.3 Teacher

```txt
src/app/teacher/learn/page.tsx
src/app/teacher/learn/activity/page.tsx
src/app/teacher/learn/class/[classGroupId]/page.tsx
src/app/teacher/learn/student/[studentId]/page.tsx
```

### 5.4 Parent

```txt
src/app/parent/learn/page.tsx
src/app/parent/learn/wards/[studentId]/page.tsx
src/app/parent/learn/payments/page.tsx
src/app/parent/learn/credentials/page.tsx
```

---

## 6. Required Models

Add these models from the mobile backend spec:

```txt
LearnStudentAccount
LearnStudentSession
LearnAccess
LearnPaymentIntent
LearnActivityEvent
LearnGuidedAdventure
LearnLanguagePracticeProgress
```

The web management side uses these same models.

Do not reuse school fee payment models for EduSentrix Learn parent payments.

---

# Slice 1 — Platform Permissions and Navigation

## Agent instruction before starting

Read web `AGENTS.md`. Inspect platform permission registry, PlatformSidebar, role guards, and existing platform pages. Do not break existing platform navigation.

## Goal

Add EduSentrix Learn management to the platform admin area.

## Permissions to add

Add platform permissions such as:

```txt
platform.learn.read
platform.learn.manage
platform.learn.giftAccess
platform.learn.pricing.manage
platform.learn.payments.read
platform.learn.analytics.read
platform.learn.audit.read
```

Use the existing platform permission registry pattern.

## Navigation

Add to platform sidebar:

```txt
EduSentrix Learn → /platform/learn
```

Only show if the operator has relevant permissions.

## Platform learn landing page

`/platform/learn` should show:

- total eligible schools
- active Learn students
- gifted students
- parent-paid access count
- revenue estimate for current term
- recent Learn activity
- schools with high/low adoption
- quick links:
  - Schools
  - Students
  - Gifts
  - Payments
  - Settings

## Acceptance criteria

- Permission keys exist.
- Platform sidebar shows Learn only when permitted.
- `/platform/learn` loads without breaking platform shell.
- Page uses existing platform UI style.

---

# Slice 2 — Learn Pricing and Global Settings

## Agent instruction before starting

Read web `AGENTS.md`. Inspect existing platform settings/billing patterns. Keep pricing configurable.

## Goal

Create platform-level EduSentrix Learn settings.

## Route

```txt
/platform/learn/settings
```

## Suggested model

Create:

```txt
src/models/LearnPlatformSettings.ts
```

Suggested fields:

```ts
export interface ILearnPlatformSettings {
  _id: Types.ObjectId;
  pricePerStudentPerTermMinor: number;
  currency: 'GHS';
  allowPlatformGifts: boolean;
  defaultAccessDuration: 'term';
  starterPlanBlocked: boolean;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
```

Default:

```txt
pricePerStudentPerTermMinor = 30000
currency = GHS
```

## UI requirements

Allow platform admin to:

- view current price
- update price
- enable/disable gifts
- see current eligibility rules
- view audit history placeholder

## Acceptance criteria

- Price is not hardcoded in payment flow.
- Settings page exists.
- Updates require platform permission.
- Changes are audited.

---

# Slice 3 — School Eligibility Engine

## Agent instruction before starting

Read web `AGENTS.md`. Inspect SchoolSubscription, SubscriptionTier, billing entitlements, and feature-access helpers.

## Goal

Create a server-side eligibility helper for EduSentrix Learn.

## File

```txt
src/lib/learn/eligibility.ts
```

## Helper

```ts
export async function getSchoolLearnEligibility(schoolId: Types.ObjectId) {
  return {
    eligible: boolean;
    reason?: string;
    planCode?: string | null;
    planName?: string | null;
    hasLessonFeatures: boolean;
  };
}
```

## Rules

A school is not eligible if:

- tierCode is Starter or equivalent,
- plan lacks lesson-note/lesson features,
- subscription is cancelled/suspended/expired,
- school is disabled,
- platform settings disable Learn.

## Acceptance criteria

- Eligibility helper exists.
- Used by platform/admin/mobile entitlement routes.
- Does not duplicate logic in multiple routes.
- Starter plan is blocked.

---

# Slice 4 — School Admin Learn Dashboard

## Agent instruction before starting

Read web `AGENTS.md`. Inspect admin sidebar, admin route shell, requireSchoolAdmin guard, premium page primitives, and current admin dashboard patterns.

## Goal

Create the school admin EduSentrix Learn dashboard.

## Routes

```txt
/admin/learn
/admin/learn/eligible-students
/admin/learn/accounts
/admin/learn/activity
/admin/learn/settings
```

## Main admin dashboard should show

- school eligibility status
- number of eligible students
- active Learn students
- pending parent payments
- students without accounts
- students with first-login pending
- total activities this week
- top active classes
- recent Leo tutor usage
- quick actions:
  - View eligible students
  - Create Learn accounts
  - View activity
  - View settings

## Guard

Use existing school admin guard:

```txt
requireSchoolAdmin
```

or approved school admin/delegated permission guard if needed.

## Acceptance criteria

- `/admin/learn` exists.
- School admins see only their school.
- Starter/non-eligible school gets a helpful state.
- No platform/global data leaks.

---

# Slice 5 — Eligible Students and Account Creation

## Agent instruction before starting

Read web `AGENTS.md`. Inspect Student, Guardian, User, UserMembership, ClassGroup, Grade, existing student admin pages, and notification/message systems.

## Goal

Allow school admins to see eligible students and create EduSentrix Learn usernames/passwords.

## Eligibility for listing

A student appears as eligible if:

- school is eligible,
- student status is active,
- student has gradeId and classGroupId,
- student is not graduated/withdrawn,
- student does not already have an active LearnStudentAccount, or account status needs action,
- student has at least one linked guardian/parent where possible.

## Routes/API

Web page:

```txt
/admin/learn/eligible-students
```

APIs:

```txt
GET  /api/admin/learn/eligible-students
POST /api/admin/learn/accounts
POST /api/admin/learn/accounts/bulk-create
```

## Username generation

Generate username from student name.

Suggested format:

```txt
first.last
first.last2
first.last.schoolSuffix
```

Rules:

- lowercase
- remove spaces/special characters
- normalize accents
- ensure uniqueness globally in LearnStudentAccount
- add numeric suffix if needed
- show preview before creation

Example:

```txt
Ama Mensah → ama.mensah
Ama Mensah duplicate → ama.mensah2
```

## Temporary password generation

Generate secure temporary password.

Rules:

- random
- at least 10 characters
- readable enough for parent to type
- no ambiguous characters where possible
- store only hash
- show only once to admin if necessary
- preferably send directly to parent account instead of exposing widely

## Credential delivery to parent

Once account is created:

- send credential message to linked parent account under EduSentrix Learn,
- include username and temporary password,
- explain first login requires password change,
- do not send via insecure public page,
- optionally notify via existing parent notification/message system.

## Acceptance criteria

- Admin can see eligible students.
- Admin can create account for one student.
- Admin can bulk-create accounts.
- Username is unique.
- Password is hashed.
- Parent receives credentials.
- Student must change password on first login.
- Action is audited.

---

# Slice 6 — Parent Learn Portal

## Agent instruction before starting

Read web `AGENTS.md`. Inspect parent routes, parent sidebar, requireParent guard, Guardian model, parent wards APIs, and parent notification patterns.

## Goal

Create parent-facing EduSentrix Learn management.

## Routes

```txt
/parent/learn
/parent/learn/wards/[studentId]
/parent/learn/payments
/parent/learn/credentials
```

## Parent landing page should show

For each ward:

- Learn eligibility
- access status
- payment status
- expiry date
- username status:
  - created
  - pending first login
  - active
  - locked
- activity summary:
  - quests completed
  - Leo usage
  - flashcards reviewed
  - weak areas improving
- CTA:
  - Pay for Learn access
  - View credentials
  - Reset password request
  - View activity

## Scoping

Parent can only see students where:

```txt
Guardian.userId === current parent user id
```

Do not use client-supplied studentId without verifying guardian relationship.

## Acceptance criteria

- Parent Learn page exists.
- Parent sees only their wards.
- Parent can view credentials only for their own ward.
- Parent can initiate Learn access payment.
- Parent does not see school fee data inside Learn pages.

---

# Slice 7 — Parent Learn Payment Flow

## Agent instruction before starting

Read web `AGENTS.md`. Inspect existing Paystack/payment integration and webhook patterns. Do not reuse school fee invoice/payment records for Learn access.

## Goal

Allow parents to pay EduSentrix/Appsentrix directly for EduSentrix Learn access.

## Routes/APIs

```txt
POST /api/parent/learn/payments/initiate
GET  /api/parent/learn/payments
GET  /api/parent/learn/payments/:paymentIntentId
```

Webhook extension:

```txt
src/app/api/webhooks/paystack/route.ts
```

or a Learn-specific webhook handler if existing architecture supports routing internally.

## Rules

- Create `LearnPaymentIntent`.
- Amount comes from `LearnPlatformSettings`.
- Parent must be guardian of student.
- Student’s school must be eligible.
- On Paystack success, create or activate `LearnAccess`.
- Do not create school fee invoice.
- Do not update `StudentCreditBalance`.
- Do not show in bursar fee reconciliation.
- Platform finance view may show Learn revenue separately.

## Acceptance criteria

- Parent can initiate Learn payment.
- Payment success activates LearnAccess.
- Payment flow is separated from school fees.
- Webhook is idempotent.
- Parent sees Learn payment status.
- Mobile entitlement updates after payment.

---

# Slice 8 — Platform Gift Access

## Agent instruction before starting

Read web `AGENTS.md`. Inspect platform permissions, audit logging patterns, and platform school/student pages.

## Goal

Allow platform admins to gift EduSentrix Learn access to eligible students.

## Routes

```txt
/platform/learn/gifts
```

APIs:

```txt
POST /api/platform/learn/gifts
GET  /api/platform/learn/gifts
POST /api/platform/learn/gifts/:accessId/revoke
```

## Rules

- Only platform users with `platform.learn.giftAccess` can gift.
- Student school must be eligible.
- Gift applies to term/current academic period.
- Create `LearnAccess` with `source = platform_gift`.
- Include reason/note.
- Audit the action.
- Parent should see access as gifted.

## Acceptance criteria

- Platform admin can gift access.
- Gifted access works in mobile entitlement.
- Revoke works.
- Audit trail exists.

---

# Slice 9 — Teacher Learn View

## Agent instruction before starting

Read web `AGENTS.md`. Inspect teacher sidebar, teacher context, teacher classes, requireTeacher guard, teacher lesson/session models.

## Goal

Let teachers view EduSentrix Learn activity for their own classes/students.

## Routes

```txt
/teacher/learn
/teacher/learn/activity
/teacher/learn/class/[classGroupId]
/teacher/learn/student/[studentId]
```

## Teacher should see

- classes they teach
- number of students using Learn
- recent activity per class
- weak topics summary
- quest completion summary
- flashcard usage
- Leo tutor usage summary
- assignment help usage summary
- Explore with Leo activity
- Ghanaian language practice where relevant

## Scoping

Teacher can only see:

- class groups they teach,
- subjects they are assigned to,
- students in those classes,
- activity connected to their classes/subjects.

Teacher must not see:

- parent payment details,
- school financial data,
- platform gift financial metadata,
- unrelated class data.

## Acceptance criteria

- Teacher Learn dashboard exists.
- Teacher sees only assigned classes/students.
- No parent payment/fee data is visible.
- Data is useful for teaching intervention.

---

# Slice 10 — School Admin Learn Activity and Analytics

## Agent instruction before starting

Read web `AGENTS.md`. Inspect admin analytics UI patterns and LearnActivityEvent model.

## Goal

Give school admins visibility into EduSentrix Learn adoption and learning activity.

## Routes

```txt
/admin/learn/activity
/admin/learn/accounts
```

## Admin activity view should show

- active students
- inactive students
- first-login pending students
- quests completed
- tutor usage volume
- flashcard reviews
- revision sessions
- exam prep practice
- Explore with Leo usage
- Ghanaian language practice
- class group breakdown
- grade breakdown
- date filters

## Admin accounts view should show

- student
- grade
- class group
- username
- account status
- Learn access status
- first login status
- parent credential delivery status
- actions:
  - reset password
  - disable account
  - resend credentials
  - view activity

## Acceptance criteria

- Admin can manage Learn accounts.
- Admin can view activity by grade/class group.
- No parent payment details beyond access status unless intentionally allowed.
- No school fee data appears.

---

# Slice 11 — Platform Learn Analytics and Payments

## Agent instruction before starting

Read web `AGENTS.md`. Inspect platform billing/payment pages and audit patterns. Keep Learn payment analytics separate from school fee payments.

## Goal

Give platform admins global Learn oversight.

## Routes

```txt
/platform/learn/students
/platform/learn/schools
/platform/learn/payments
```

## Platform views should show

- schools eligible for Learn
- schools not eligible and reasons
- active Learn students
- parent-paid count
- gifted count
- expired access count
- revenue for current term
- payment success/failure
- adoption by school
- activity by school/class level

## Rules

- This is platform-only.
- Requires platform permissions.
- Keep Learn revenue separate from school fee payments.
- Include export later placeholder if useful.

## Acceptance criteria

- Platform Learn analytics pages exist.
- Platform Learn payments page exists.
- Learn revenue is separate from school fees.
- Permission guard works.

---

# Slice 12 — Parent Credential Delivery and Reset Flow

## Agent instruction before starting

Read web `AGENTS.md`. Inspect parent messages/notifications and account patterns.

## Goal

Create a secure credential delivery and reset process.

## Credential creation flow

1. Admin creates Learn account.
2. System generates username and temporary password.
3. Password is hashed in `LearnStudentAccount`.
4. Parent receives credentials in parent Learn area.
5. Student logs into mobile app.
6. Mobile forces password change.
7. Parent sees status as active.

## Reset flow

Parent or admin can request/reset password.

Recommended APIs:

```txt
POST /api/parent/learn/wards/:studentId/request-password-reset
POST /api/admin/learn/accounts/:accountId/reset-password
POST /api/admin/learn/accounts/:accountId/resend-credentials
```

## Rules

- Temporary password display should be limited.
- Reset must force password change.
- All resets are audited.
- Parent can only reset credentials for their own ward.

## Acceptance criteria

- Parent can view credential status.
- Admin can reset/resend credentials.
- Reset forces password change.
- No unauthorized credential access.

---

# Slice 13 — Web API Routes for Learn Management

## Agent instruction before starting

Read web `AGENTS.md`. Inspect existing API route conventions and guards.

## Required API groups

Platform:

```txt
/api/platform/learn/overview
/api/platform/learn/schools
/api/platform/learn/students
/api/platform/learn/gifts
/api/platform/learn/payments
/api/platform/learn/settings
```

School admin:

```txt
/api/admin/learn/overview
/api/admin/learn/eligible-students
/api/admin/learn/accounts
/api/admin/learn/accounts/:accountId/reset-password
/api/admin/learn/accounts/:accountId/resend-credentials
/api/admin/learn/activity
/api/admin/learn/settings
```

Teacher:

```txt
/api/teacher/learn/overview
/api/teacher/learn/activity
/api/teacher/learn/classes/:classGroupId
/api/teacher/learn/students/:studentId
```

Parent:

```txt
/api/parent/learn/overview
/api/parent/learn/wards/:studentId
/api/parent/learn/payments/initiate
/api/parent/learn/payments
/api/parent/learn/credentials
/api/parent/learn/wards/:studentId/request-password-reset
```

## Acceptance criteria

- API routes follow existing conventions.
- Each route uses correct guard.
- Each route enforces scope.
- No fees data leaks to Learn pages.
- Responses are serialized, not raw Mongoose documents.

---

# Slice 14 — Audit, Notifications, and Activity Logging

## Agent instruction before starting

Read web `AGENTS.md`. Inspect audit and notification helpers.

## Goal

Audit sensitive Learn actions and notify relevant users.

## Actions to audit

```txt
Learn account created
Bulk Learn accounts created
Credentials resent
Password reset
Account disabled/enabled
Learn access gifted
Gift revoked
Parent Learn payment initiated
Parent Learn payment succeeded
Learn price changed
School Learn settings changed
```

## Notifications

Notify parent when:

- Learn account created
- credentials available
- password reset
- payment succeeds
- access is about to expire
- access expired

Notify school admin when:

- many students pending first login
- many parent payments pending
- high adoption/low adoption summaries

## Acceptance criteria

- Sensitive actions are audited.
- Parent credential/payment notifications exist or are queued through existing system.
- No raw passwords are logged.
- No payment secrets are logged.

---

# Slice 15 — QA and Data Leakage Review

## Agent instruction before starting

Read web `AGENTS.md`. This slice is review/fix only, not a rewrite.

## Confirm

- Starter schools cannot activate Learn.
- Eligible schools can list eligible students.
- Admin can create credentials.
- Parent can receive credentials.
- Student must change password.
- Parent can pay for access.
- Platform can gift access.
- Teacher sees only assigned class activity.
- Parent sees only wards.
- Admin sees only own school.
- Platform sees global data only with permission.
- Mobile app gets only student-safe data.
- No Learn mobile route returns fees data.
- Learn payments are separate from school fees.
- School scoping, grade scoping, class group scoping, teacher scoping, and parent-child scoping are enforced server-side.

## Final acceptance criteria

EduSentrix Web is ready to support EduSentrix Learn when:

- sidebars contain Learn nav items for platform/admin/teacher/parent,
- Learn pages exist for all roles,
- Learn account creation works,
- parent payment/gift access flows are specified and implemented,
- mobile Learn APIs exist,
- sensitive data is scoped and protected,
- no school fees leak into Learn mobile or student learning APIs.
