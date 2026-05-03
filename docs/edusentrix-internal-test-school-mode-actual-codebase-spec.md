# EduSentrix Internal Test School Mode — Codebase-Aligned Development Spec

## 1. Purpose

EduSentrix is now large enough that realistic production testing must happen inside the actual app flows, not only through seed scripts. This feature introduces a protected **Internal Test School Mode** that allows platform admins to mark selected schools as test schools, bypass real email invitations and real notifications, manually test the full setup journey, and optionally generate realistic school data across modules.

This spec is based on the current uploaded EduSentrix Next.js codebase structure and should be implemented without weakening the real-school onboarding, invitation, payment, notification, or data-integrity flows.

## 2. Primary Goals

1. Allow a platform admin to mark a school as an internal test school from the platform admin area.
2. Protect test-school activation and dangerous test actions with strong authorization and password/passphrase challenge.
3. Allow Joseph/platform admins to manually set up a test school through the real UI without receiving/managing hundreds of invitation emails.
4. Allow test-school configuration from a dedicated platform-admin page.
5. Allow realistic full-school data generation later, but keep the generated school simple: **one class group for each grade**.
6. Require academic period setup before generating seeded data.
7. Limit generated data to a maximum of **two academic periods**.
8. Ensure the current academic period aligns with real-life current/future dates.
9. Generate data by respecting actual EduSentrix models, relationships, API behavior, and module rules.
10. Keep all real schools on the proper production onboarding path.

## 3. Current Codebase Context

The implementation should fit into these existing areas:

### Existing Models

Relevant current models include:

```txt
src/models/School.ts
src/models/User.ts
src/models/UserMembership.ts
src/models/Invitation.ts
src/models/Invite.ts
src/models/Grade.ts
src/models/ClassGroup.ts
src/models/Subject.ts
src/models/Teacher.ts
src/models/Student.ts
src/models/Guardian.ts
src/models/AcademicPeriod.ts
src/models/SchoolSettings.ts
src/models/FeeStructure.ts
src/models/Invoice.ts
src/models/InvoiceLineItem.ts
src/models/Payment.ts
src/models/SchoolDailySchedule.ts
src/models/TimetableSlot.ts
src/models/TeacherAssignment.ts
src/models/LessonNote.ts
src/models/Lesson.ts
src/models/LibraryBook.ts
src/models/LibraryBookCopy.ts
src/models/LibraryLoan.ts
src/models/FundraisingCampaign.ts
src/models/CommunityPoll.ts
src/models/Vendor.ts
src/models/AuditEvent.ts
```

### Existing Platform Admin Areas

```txt
src/app/(app)/platform/schools/page.tsx
src/app/(app)/platform/schools/[id]/page.tsx
src/app/api/platform/schools/route.ts
src/app/api/platform/schools/[id]/route.ts
src/lib/auth/requirePlatformAdmin.ts
```

### Existing Invitation Areas

```txt
src/models/Invitation.ts
src/models/Invite.ts
src/app/api/admin/invitations/route.ts
src/app/api/admin/invitations/[id]/resend/route.ts
src/app/api/admin/teachers/create/route.ts
src/app/api/admin/teachers/bulk-create/route.ts
src/app/api/admin/students/[id]/guardians/route.ts
src/app/api/platform/schools/[id]/onboarding/owner-invite/route.ts
src/app/api/admin/settings/payment-setup/owner-invite/route.ts
src/app/api/admin/settings/payment-setup/delegate-invite/route.ts
```

### Existing Seed Scripts

Current package scripts include:

```json
{
  "seed:jhs": "tsx scripts/seed-jhs-classes.ts",
  "seed:jhs:dry": "tsx scripts/seed-jhs-classes.ts --dryRun",
  "seed:academics": "tsx scripts/seed-academics.ts",
  "seed:academics:dry": "tsx scripts/seed-academics.ts --dryRun",
  "seed:insights": "tsx scripts/seed-insights-data.ts",
  "seed:insights:dry": "tsx scripts/seed-insights-data.ts --dryRun"
}
```

The new internal test generator should build on the same scripting style, but should be module-aware and safe for a selected internal test school.

## 4. Key Product Distinction

There should be two test-school usage patterns:

### 4.1 Manual Test School

Used by Joseph/platform admins to manually go through real setup flows:

```txt
Create grades
Create class groups
Create subjects
Create teachers
Assign teachers
Create schedules
Create fees
Generate invoices
Create lesson notes
Create lessons
Test reports
Test dashboards
```

For this school, only email/notification/payment friction should be bypassed. The UI flows should remain real.

### 4.2 Seeded Test/Demo School

Used later for large realistic data:

```txt
All grades
One class group per grade
Many students
Teachers
Parents
Invoices
Payments
Lesson notes
Lessons
Library
Polls
Fundraising
Reports
Analytics
```

This school can be generated through a seed job/script after configuring academic periods.

## 5. Data Model Changes

## 5.1 School Model

Update:

```txt
src/models/School.ts
```

Add:

```ts
export type SchoolEnvironmentType = "production" | "internal_test" | "demo";

internalTesting?: {
  environmentType: SchoolEnvironmentType;
  isInternalTestSchool: boolean;

  activatedAt?: Date | null;
  activatedBy?: Types.ObjectId | null;
  deactivatedAt?: Date | null;
  deactivatedBy?: Types.ObjectId | null;

  controls?: {
    suppressInvitationEmails: boolean;
    autoActivateCreatedUsers: boolean;
    suppressSms: boolean;
    suppressWhatsapp: boolean;
    sandboxPaymentsOnly: boolean;
    allowLoginAsTestUsers: boolean;
    showTestSchoolBadge: boolean;
    allowSeedGeneration: boolean;
  };

  seed?: {
    status?: "not_started" | "configured" | "running" | "completed" | "failed";
    lastRunAt?: Date | null;
    lastRunBy?: Types.ObjectId | null;
    lastRunId?: Types.ObjectId | null;
    lastError?: string | null;
  };
};
```

Recommended defaults:

```ts
internalTesting: {
  environmentType: "production",
  isInternalTestSchool: false,
  controls: {
    suppressInvitationEmails: false,
    autoActivateCreatedUsers: false,
    suppressSms: false,
    suppressWhatsapp: false,
    sandboxPaymentsOnly: false,
    allowLoginAsTestUsers: false,
    showTestSchoolBadge: false,
    allowSeedGeneration: false,
  },
}
```

Do not use a plain top-level `isInternalTestSchool` unless you want quick lookups. If you do add it, treat it as denormalized and keep it in sync with `internalTesting.isInternalTestSchool`.

### Indexes

Add indexes:

```ts
schoolSchema.index({ "internalTesting.isInternalTestSchool": 1 });
schoolSchema.index({ "internalTesting.environmentType": 1 });
```

## 5.2 User Model

Update:

```txt
src/models/User.ts
```

Add:

```ts
testMeta?: {
  isTestUser: boolean;
  testSchoolId?: Types.ObjectId | null;
  autoActivated?: boolean;
  generatedBy?: "manual_internal_test" | "seed" | "impersonation" | null;
  createdByInternalTool?: boolean;
};

accountStatus?: "invited" | "active" | "suspended";
emailVerifiedForTest?: boolean;
```

For internal test users:

```ts
testMeta.isTestUser = true;
accountStatus = "active";
emailVerifiedForTest = true;
```

Do not mark real users as test users.

## 5.3 Invitation Model

Update:

```txt
src/models/Invitation.ts
```

Current status enum:

```ts
"pending" | "accepted" | "expired" | "revoked" | "failed"
```

Add:

```ts
"auto_accepted"
```

Also add optional fields:

```ts
isInternalTestBypass?: boolean;
bypassReason?: string | null;
autoAcceptedAt?: Date | null;
```

For test schools, when the system would normally create an invitation, it should create an `Invitation` record with:

```ts
status: "auto_accepted";
isInternalTestBypass: true;
bypassReason: "Internal test school: invitation email suppressed";
sentAt: new Date();
acceptedAt: new Date();
autoAcceptedAt: new Date();
clerkInvitationId: undefined;
```

This preserves auditability while avoiding real emails.

## 5.4 New Model: InternalTestSchoolUnlock

Create:

```txt
src/models/InternalTestSchoolUnlock.ts
```

Purpose: store short-lived unlock sessions after a platform admin passes the internal challenge.

```ts
export interface IInternalTestSchoolUnlock {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  schoolId: Types.ObjectId;
  purpose:
    | "activate_test_school"
    | "update_test_controls"
    | "run_seed_generation"
    | "dangerous_reset";
  expiresAt: Date;
  usedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

Indexes:

```ts
{ userId: 1, schoolId: 1, purpose: 1, expiresAt: 1 }
{ expiresAt: 1 }, expireAfterSeconds: 0
```

Unlock sessions should expire quickly, e.g. 10–15 minutes.

## 5.5 New Model: InternalTestSeedRun

Create:

```txt
src/models/InternalTestSeedRun.ts
```

```ts
export interface IInternalTestSeedRun {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  requestedBy: Types.ObjectId;

  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  mode: "dry_run" | "commit";

  config: {
    academicPeriods: Array<{
      yearLabel: string;
      term: string;
      startDate: Date;
      endDate: Date;
      isCurrent: boolean;
    }>;

    gradeScope: "basic_school_default" | "jhs_only" | "custom";
    oneClassGroupPerGrade: true;

    studentsPerClassGroup: number;
    teacherCountStrategy: "minimum_realistic" | "subject_based";

    includeModules: {
      academics: boolean;
      timetable: boolean;
      fees: boolean;
      invoices: boolean;
      payments: boolean;
      lessonNotes: boolean;
      lessons: boolean;
      library: boolean;
      polls: boolean;
      fundraising: boolean;
      vendors: boolean;
      attendance: boolean;
    };
  };

  summary?: {
    gradesCreated: number;
    classGroupsCreated: number;
    subjectsCreated: number;
    teachersCreated: number;
    studentsCreated: number;
    guardiansCreated: number;
    feeStructuresCreated: number;
    invoicesCreated: number;
    paymentsCreated: number;
    lessonNotesCreated: number;
    lessonsCreated: number;
    libraryBooksCreated: number;
    pollsCreated: number;
    campaignsCreated: number;
    vendorsCreated: number;
    warnings: string[];
  };

  error?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

## 6. Password / Challenge Protection

The user asked specifically to protect test-school activation with a password.

Because the app uses Clerk, the cleanest implementation should not store or verify the platform admin’s Clerk password directly inside EduSentrix. Instead, use layered protection:

### Required Protection Layers

1. Authenticated Clerk session.
2. Existing `requirePlatformAdmin()` guard.
3. Server-side feature flag:

```env
ENABLE_INTERNAL_TEST_TOOLS=true
```

4. Dedicated permission check where possible:

```txt
platform.internalTest.manage
```

If the current platform admin role system has no granular platform permissions yet, role-checking through `requirePlatformAdmin()` is acceptable for v1, but permission support should be planned.

5. Internal test tools challenge passphrase.
6. Confirmation phrase for dangerous actions.
7. Audit event on every unlock and action.

### Recommended Passphrase Design

Use an environment-based challenge secret, not a database plain-text password.

Add env:

```env
INTERNAL_TEST_TOOLS_CHALLENGE_HASH="..."
INTERNAL_TEST_TOOLS_CONFIRM_PHRASE="ENABLE TEST SCHOOL"
```

Do not store the plain passphrase.

Since `bcrypt` is not currently listed in `package.json`, either:

1. Use Node `crypto.scrypt`/`timingSafeEqual` with a stored salt+hash format, or
2. Add a dependency such as `bcryptjs` or `argon2`.

Recommended without new dependency:

```txt
Use Node crypto.scrypt for passphrase verification.
Store INTERNAL_TEST_TOOLS_CHALLENGE_HASH as: scrypt$N$r$p$salt$hash
Compare using crypto.timingSafeEqual.
```

Create helper:

```txt
src/lib/internal-test/verify-internal-test-challenge.ts
```

```ts
export async function verifyInternalTestChallenge(input: string): Promise<boolean>;
```

### Activation Request Should Require

Payload:

```ts
{
  challengePassword: string;
  confirmationPhrase: "ENABLE TEST SCHOOL";
  reason: string;
}
```

Rules:

- `reason` must be at least 12 characters.
- `confirmationPhrase` must exactly match env or configured constant.
- Challenge failures should be rate-limited per platform admin.
- Never log the password/passphrase.

### Unlock Session Flow

For high-risk actions, use a two-step flow.

1. Platform admin enters challenge.
2. Server creates an `InternalTestSchoolUnlock` valid for 10–15 minutes.
3. UI can perform one or more actions requiring that unlock.
4. Dangerous actions like seed generation and reset can require a fresh unlock.

## 7. Platform Admin UI

## 7.1 Add Test Mode Section to Existing School Detail Page

Update:

```txt
src/app/(app)/platform/schools/[id]/page.tsx
```

Add a card:

```txt
Internal Test School
```

Show:

- current environment type,
- whether internal test mode is active,
- activated date,
- activated by,
- controls summary,
- button to configure test mode.

Button:

```txt
Configure Test School
```

Route:

```txt
/platform/schools/[id]/test-mode
```

## 7.2 New Test Mode Page

Create:

```txt
src/app/(app)/platform/schools/[id]/test-mode/page.tsx
```

This page should be platform-admin-only.

Sections:

### A. Safety Header

Show a prominent warning:

```txt
Internal Test School Mode is for EduSentrix platform testing only.
Never enable this for a real customer school.
```

Show a badge if active:

```txt
INTERNAL TEST SCHOOL
```

### B. Activation Panel

If not active:

- Challenge password input.
- Confirmation phrase input.
- Reason textarea.
- Activate button.

Use existing premium UI components:

```txt
Card
Button
Input
Textarea
Badge
Alert
ResponsiveModal where appropriate
```

### C. Controls Panel

If active, allow toggling:

```txt
Suppress invitation emails
Auto-activate created users
Suppress SMS
Suppress WhatsApp
Use sandbox payments only
Allow login-as test users
Show test-school badge
Allow seed generation
```

Each toggle should require an unlock session or a fresh challenge for dangerous changes.

### D. Academic Period Configuration

Before seed generation, platform admin must configure academic periods.

Rules:

- Minimum: 1 academic period.
- Maximum: 2 academic periods.
- Exactly one period may be current.
- The current period must align with current real-life dates or future dates.
- Current period validation:
  - `startDate <= today <= endDate`, or
  - `startDate >= today` for a future current test period.
- No overlapping periods.
- `endDate > startDate`.

Use the **custom EduSentrix date picker** for all period dates. Do not use raw HTML date inputs.

### E. Seed Generator Configuration

Options:

```txt
Grade scope:
- Basic school default
- JHS only
- Custom

Class group strategy:
- One class group per grade only

Students per class group:
- default 25
- allowed 5–60

Include modules:
- Academics
- Timetable
- Fees
- Invoices
- Payments
- Lesson Notes
- Lessons
- Library
- Polls
- Fundraising
- Vendors
- Attendance
```

The **one class group per grade** rule must be fixed for this version.

Example generated class groups:

```txt
Creche A
Nursery A
KG1 A
KG2 A
Basic 1 A
Basic 2 A
Basic 3 A
Basic 4 A
Basic 5 A
Basic 6 A
JHS 1 A
JHS 2 A
JHS 3 A
```

If the school is `type: "SHS"`, use SHS grade rules later. For now, scope this feature to Basic schools unless SHS generation is explicitly enabled.

### F. Dry Run Preview

Before committing data generation, run a dry run:

```txt
Generate Preview
```

Show expected counts:

```txt
Grades: 13
Class groups: 13
Subjects: 18
Teachers: 24
Students: 325
Guardians: 300
Fee structures: 8
Invoices: 325
Lesson notes: 60
Lessons: 40
Library books: 120
```

Then require confirmation:

```txt
GENERATE TEST DATA
```

### G. Seed Run History

Show previous seed runs:

```txt
Run ID
Status
Mode
Requested by
Started
Completed
Counts
Warnings
Error
```

## 8. API Routes

## 8.1 Test Mode Status

Create:

```txt
src/app/api/platform/schools/[id]/test-mode/route.ts
```

Methods:

### GET

Returns:

```ts
{
  success: true,
  data: {
    schoolId: string;
    schoolName: string;
    internalTesting: School["internalTesting"];
    seedRuns: InternalTestSeedRun[];
  }
}
```

### PATCH

Updates safe controls after challenge/unlock.

Payload:

```ts
{
  unlockId?: string;
  controls: Partial<InternalTestControls>;
}
```

Validation:

- require platform admin,
- require `ENABLE_INTERNAL_TEST_TOOLS=true`,
- require active internal test school,
- require valid unlock for changing sensitive controls.

## 8.2 Activate Test School

Create:

```txt
src/app/api/platform/schools/[id]/test-mode/activate/route.ts
```

Method: POST

Payload:

```ts
{
  challengePassword: string;
  confirmationPhrase: string;
  reason: string;
}
```

Behavior:

- require platform admin,
- check feature flag,
- verify challenge passphrase,
- verify confirmation phrase,
- prevent activation if school has real production activity unless override is explicitly added later,
- update School.internalTesting,
- create audit event,
- return updated test mode state.

Default controls after activation:

```ts
{
  suppressInvitationEmails: true,
  autoActivateCreatedUsers: true,
  suppressSms: true,
  suppressWhatsapp: true,
  sandboxPaymentsOnly: true,
  allowLoginAsTestUsers: true,
  showTestSchoolBadge: true,
  allowSeedGeneration: false
}
```

`allowSeedGeneration` should require separate activation from the test mode controls page.

## 8.3 Deactivate Test School

Create:

```txt
src/app/api/platform/schools/[id]/test-mode/deactivate/route.ts
```

Method: POST

Payload:

```ts
{
  challengePassword: string;
  confirmationPhrase: "DISABLE TEST SCHOOL";
  reason: string;
}
```

Behavior:

- should not delete test data,
- turns off test controls,
- disables bypass behavior,
- logs audit event.

## 8.4 Unlock Internal Test Actions

Create:

```txt
src/app/api/platform/schools/[id]/test-mode/unlock/route.ts
```

Method: POST

Payload:

```ts
{
  challengePassword: string;
  purpose:
    | "activate_test_school"
    | "update_test_controls"
    | "run_seed_generation"
    | "dangerous_reset";
}
```

Returns:

```ts
{
  success: true,
  data: {
    unlockId: string;
    expiresAt: string;
  }
}
```

## 8.5 Configure Academic Periods for Seed Generation

Create:

```txt
src/app/api/platform/schools/[id]/test-mode/academic-periods/route.ts
```

Methods:

### GET

Returns existing configured periods and actual `AcademicPeriod` rows for the school.

### PUT

Payload:

```ts
{
  unlockId: string;
  periods: Array<{
    yearLabel: string;
    term: string;
    startDate: string;
    endDate: string;
    isCurrent: boolean;
  }>;
}
```

Rules:

- max 2 periods,
- at least 1 period,
- exactly one current period,
- no overlap,
- current period must align with today/future,
- use school timezone, default `Africa/Accra`,
- either create/update `AcademicPeriod` records or store staged config before seed generation.

Recommendation: create/update real `AcademicPeriod` records because existing modules already depend on `AcademicPeriod`.

## 8.6 Seed Preview

Create:

```txt
src/app/api/platform/schools/[id]/test-mode/seed/preview/route.ts
```

Method: POST

Payload:

```ts
{
  unlockId: string;
  config: InternalTestSeedConfig;
}
```

Behavior:

- dry-run only,
- no database writes except optional `InternalTestSeedRun` with `mode: "dry_run"`,
- validates model dependencies,
- returns expected counts and warnings.

## 8.7 Run Seed Generation

Create:

```txt
src/app/api/platform/schools/[id]/test-mode/seed/run/route.ts
```

Method: POST

Payload:

```ts
{
  unlockId: string;
  confirmationPhrase: "GENERATE TEST DATA";
  config: InternalTestSeedConfig;
}
```

Behavior:

- require internal test school,
- require `allowSeedGeneration: true`,
- require valid academic periods,
- create `InternalTestSeedRun` with `status: "running"`,
- call seed orchestration service,
- write realistic data,
- update run summary,
- audit all major actions.

## 9. Internal Test Helper Libraries

Create folder:

```txt
src/lib/internal-test
```

Files:

```txt
src/lib/internal-test/assert-internal-test-enabled.ts
src/lib/internal-test/verify-internal-test-challenge.ts
src/lib/internal-test/create-internal-test-unlock.ts
src/lib/internal-test/validate-internal-test-unlock.ts
src/lib/internal-test/is-internal-test-school.ts
src/lib/internal-test/test-invite-policy.ts
src/lib/internal-test/academic-period-validation.ts
src/lib/internal-test/seed/config.ts
src/lib/internal-test/seed/orchestrator.ts
src/lib/internal-test/seed/module-introspection.ts
src/lib/internal-test/seed/generators/grades.ts
src/lib/internal-test/seed/generators/class-groups.ts
src/lib/internal-test/seed/generators/subjects.ts
src/lib/internal-test/seed/generators/users.ts
src/lib/internal-test/seed/generators/teachers.ts
src/lib/internal-test/seed/generators/students.ts
src/lib/internal-test/seed/generators/fees.ts
src/lib/internal-test/seed/generators/timetable.ts
src/lib/internal-test/seed/generators/lesson-notes.ts
src/lib/internal-test/seed/generators/lessons.ts
src/lib/internal-test/seed/generators/library.ts
src/lib/internal-test/seed/generators/polls.ts
src/lib/internal-test/seed/generators/fundraising.ts
src/lib/internal-test/seed/generators/vendors.ts
src/lib/internal-test/seed/generators/attendance.ts
```

## 10. Invitation / Email Bypass Integration

The bypass must be centralized. Do not add ad-hoc `if test school` checks everywhere.

Create:

```txt
src/lib/internal-test/test-invite-policy.ts
```

```ts
export async function shouldBypassInvitationForSchool(schoolId: string | ObjectId): Promise<boolean>;

export async function createAutoAcceptedTestInvitation(input: {
  schoolId: ObjectId;
  email: string;
  role: InvitationRole;
  invitedBy: ObjectId;
  metadata?: Record<string, unknown>;
}): Promise<Invitation>;
```

Then update invitation-creating routes to call this helper before calling Clerk invitation APIs.

Routes to update:

```txt
src/app/api/admin/invitations/route.ts
src/app/api/admin/invitations/[id]/resend/route.ts
src/app/api/admin/teachers/create/route.ts
src/app/api/admin/teachers/bulk-create/route.ts
src/app/api/admin/students/[id]/guardians/route.ts
src/app/api/platform/schools/[id]/onboarding/owner-invite/route.ts
src/app/api/admin/settings/payment-setup/owner-invite/route.ts
src/app/api/admin/settings/payment-setup/delegate-invite/route.ts
```

Behavior for internal test school:

```txt
Do not call Clerk invitations.createInvitation.
Do not send real email.
Create Invitation record as auto_accepted.
Create/activate local User where appropriate.
Create Teacher/Guardian/staff records normally.
Mark user testMeta.isTestUser = true.
Return success with `emailSuppressed: true`.
```

Behavior for production school:

```txt
Continue existing Clerk/email invitation flow unchanged.
```

## 11. Test User Email Convention

The UI should still ask for emails, but docs and helper tooling should recommend fake internal addresses:

```txt
teacher.math@manual-test.edusentrix.local
teacher.science@manual-test.edusentrix.local
parent.001@manual-test.edusentrix.local
student.001@manual-test.edusentrix.local
bursar@manual-test.edusentrix.local
librarian@manual-test.edusentrix.local
```

Validation should allow these addresses if current email validation accepts them. If `.local` causes issues, use:

```txt
teacher.math+manualtest@edusentrix.test
parent.001+manualtest@edusentrix.test
student.001+manualtest@edusentrix.test
```

## 12. Test School Badge

If `showTestSchoolBadge` is true, the app shell should show a visible badge for that school.

Potential integration locations:

```txt
src/app/(app)/layout.tsx
src/components/app/*
src/components/admin/* shell/header components
```

Badge text:

```txt
INTERNAL TEST SCHOOL
```

Tone: amber/red warning, but still premium.

Do not show this for production schools.

## 13. Sandbox Payments and Notifications

For internal test schools:

- Paystack real collection must be disabled unless explicitly testing sandbox payment flow.
- Payment records may be generated as test payments only.
- SMS must be suppressed.
- WhatsApp must be suppressed.
- Email invitations must be suppressed.
- Operational emails should be suppressible based on controls.

Create helper:

```txt
src/lib/internal-test/is-test-communication-suppressed.ts
```

Use it in email/SMS/WhatsApp dispatch points.

Relevant email areas:

```txt
src/lib/email/*
src/lib/jobs/emailDispatch.ts
src/models/EmailDispatchJob.ts
src/models/EmailMessage.ts
src/models/EmailEvent.ts
```

For suppressed messages, optionally create an internal log event with:

```txt
suppressed: true
reason: Internal test school communication suppression
```

## 14. Seed Generation Rules

## 14.1 One Class Group Per Grade

This is mandatory for the new version.

Generated class groups should be:

```txt
A
```

Because `ClassGroup.name` currently stores the group name, not full grade label.

Examples:

```txt
Grade: JHS 1, ClassGroup.name: A -> display as JHS 1 A
Grade: Basic 4, ClassGroup.name: A -> display as Basic 4 A
```

Do not generate multiple streams like Gold, Blue, A/B/C in this version.

## 14.2 Grade Scope

For Basic schools, default grades:

```txt
Creche
Nursery
KG1
KG2
Basic 1
Basic 2
Basic 3
Basic 4
Basic 5
Basic 6
JHS 1
JHS 2
JHS 3
```

If the UI is configured for JHS-only, generate:

```txt
JHS 1
JHS 2
JHS 3
```

For now, keep SHS generation out of scope unless explicitly selected later.

## 14.3 Academic Period Limits

- Minimum periods: 1.
- Maximum periods: 2.
- Exactly one current period.
- Current period must be current or future relative to today.
- Dates must be configured before seed generation.
- Data generation should attach records to configured academic periods where applicable.

## 14.4 Module-Aware Generation

The generator must not blindly insert random documents. It should inspect and respect:

- model required fields,
- model indexes and uniqueness,
- schoolId scoping,
- grade/class/subject relationships,
- academic period references,
- teacher assignments,
- fee structure/invoice relationships,
- lesson note/lesson relationship,
- library book/book copy/loan relationships,
- payment/invoice line allocation relationships.

The implementation should use existing services/helpers where available instead of bypassing business logic.

Examples:

- Use `Grade` and `ClassGroup` models with uniqueness rules.
- Use `AcademicPeriod` as real rows.
- Use `FeeStructure`, `Invoice`, and `InvoiceLineItem` in a consistent way.
- Use `LessonNote` then `Lesson` from `LessonNote` where possible.
- Use `LibraryBook`, `LibraryBookCopy`, and `LibraryLoan` consistently.

## 14.5 Idempotency

Seed generation must be idempotent or clearly guarded.

Options:

1. Block seeding if test data already exists unless user selects reset.
2. Use deterministic keys/metadata to upsert generated records.
3. Store `generatedByInternalTestRunId` metadata where possible.

Recommended for v1:

```txt
Block repeat committed seed if a completed seed run exists unless user explicitly chooses "Reset generated data" in a later feature.
```

Do not implement destructive reset in v1 unless strictly needed.

## 15. Suggested Seed Counts

Defaults:

```txt
Students per class group: 25
Teachers: subject-based minimum realistic count
Parents/guardians: around 80–95% of students
Fee structures: 5–8 per academic period
Invoices: one invoice per student per period
Payments: mix of paid, partial, unpaid, overdue
Lesson notes: a few per subject/class/period
Lessons: generated from some lesson notes
Library books: 80–150 books
Library loans: realistic mix of active/returned/overdue
Polls: 3–5
Fundraising campaigns: 2–3
Vendors: 8–15
Attendance: sampled days, not every day unless selected
```

## 16. Manual Test School Flow

For Joseph’s manual testing, the recommended workflow is:

1. Create school through normal platform/admin flow.
2. Open platform school detail page.
3. Activate Internal Test School Mode.
4. Enable:
   - suppress invitation emails,
   - auto-activate users,
   - sandbox payments,
   - show test badge,
   - login-as test users.
5. Manually set up JHS first:
   - grades,
   - one class group per JHS grade,
   - subjects,
   - teachers,
   - teacher assignments,
   - class schedule,
   - fees,
   - invoices,
   - lesson notes,
   - lessons.
6. Later, create another test school and use seed generation.

## 17. Login-As Test User

Add later or in v1.5 if not already available.

Route suggestion:

```txt
/platform/schools/[id]/test-mode/users
```

Only allow login-as when:

```txt
Current user is platform_admin
School is internal_test
Target user has testMeta.isTestUser = true
allowLoginAsTestUsers = true
```

Every impersonation must be audit logged.

If true impersonation is complex with Clerk, start with a role/session simulation panel that allows viewing deep links for test accounts or issuing test-only magic access. Do not compromise Clerk production auth.

## 18. Audit Logging

Use existing audit infrastructure if possible:

```txt
src/models/AuditEvent.ts
src/lib/audit/*
```

Log events:

```txt
internal_test_school.activated
internal_test_school.deactivated
internal_test_school.controls_updated
internal_test_school.unlock_created
internal_test_school.challenge_failed
internal_test_school.academic_periods_configured
internal_test_school.seed_previewed
internal_test_school.seed_started
internal_test_school.seed_completed
internal_test_school.seed_failed
internal_test_school.invitation_suppressed
internal_test_school.user_auto_activated
internal_test_school.notification_suppressed
internal_test_school.payment_sandbox_enforced
internal_test_school.login_as_started
```

Audit metadata should include:

```txt
schoolId
actorUserId
actorEmail
action
reason
ip/user-agent if available
before/after for controls
seedRunId where applicable
```

Never log challenge password/passphrase.

## 19. UI Quality Requirements

The internal test school pages must match the premium EduSentrix platform/admin style.

Required:

- dark premium glass cards,
- strong warning states for dangerous actions,
- badges for test mode,
- confirmation modals,
- Sonner toasts,
- skeleton/loading states,
- empty states,
- custom EduSentrix date picker for all date fields,
- premium dropdown/select for all select fields,
- no raw HTML date inputs,
- no plain browser confirm dialogs.

## 20. Environment Variables

Add:

```env
ENABLE_INTERNAL_TEST_TOOLS=false
INTERNAL_TEST_TOOLS_CONFIRM_PHRASE="ENABLE TEST SCHOOL"
INTERNAL_TEST_TOOLS_DISABLE_CONFIRM_PHRASE="DISABLE TEST SCHOOL"
INTERNAL_TEST_TOOLS_GENERATE_CONFIRM_PHRASE="GENERATE TEST DATA"
INTERNAL_TEST_TOOLS_CHALLENGE_HASH=""
INTERNAL_TEST_UNLOCK_TTL_MINUTES=15
```

Production should have `ENABLE_INTERNAL_TEST_TOOLS=false` by default. Enable it only in the production environment where Joseph/platform admins intentionally test.

## 21. Implementation Chunks

## Chunk 1 — Models and Helpers

Files:

```txt
src/models/School.ts
src/models/User.ts
src/models/Invitation.ts
src/models/InternalTestSchoolUnlock.ts
src/models/InternalTestSeedRun.ts
src/lib/internal-test/*
```

Tasks:

- add model fields,
- add unlock model,
- add seed run model,
- add challenge verifier,
- add internal-test school helper,
- add academic period validation helper.

Acceptance:

- TypeScript compiles.
- Existing production schools remain unchanged.
- Existing invitation statuses still work.

## Chunk 2 — Platform Admin Activation APIs

Files:

```txt
src/app/api/platform/schools/[id]/test-mode/route.ts
src/app/api/platform/schools/[id]/test-mode/activate/route.ts
src/app/api/platform/schools/[id]/test-mode/deactivate/route.ts
src/app/api/platform/schools/[id]/test-mode/unlock/route.ts
```

Acceptance:

- platform admin can read status,
- non-platform users are blocked,
- feature flag disables routes,
- activation requires challenge and confirmation phrase,
- audit logs are written.

## Chunk 3 — Platform Admin UI

Files:

```txt
src/app/(app)/platform/schools/[id]/page.tsx
src/app/(app)/platform/schools/[id]/test-mode/page.tsx
src/components/platform/internal-test/*
```

Acceptance:

- school detail shows test mode state,
- test mode page can activate and configure controls,
- UI uses premium components,
- custom date picker is used for academic periods.

## Chunk 4 — Email/Invitation Bypass

Files to update:

```txt
src/app/api/admin/invitations/route.ts
src/app/api/admin/invitations/[id]/resend/route.ts
src/app/api/admin/teachers/create/route.ts
src/app/api/admin/teachers/bulk-create/route.ts
src/app/api/admin/students/[id]/guardians/route.ts
src/app/api/platform/schools/[id]/onboarding/owner-invite/route.ts
src/app/api/admin/settings/payment-setup/owner-invite/route.ts
src/app/api/admin/settings/payment-setup/delegate-invite/route.ts
```

Acceptance:

- internal test schools do not send Clerk invitations,
- production schools continue normal invitation flow,
- test invitation records are created as `auto_accepted`,
- test users are auto-active.

## Chunk 5 — Academic Period Config

Files:

```txt
src/app/api/platform/schools/[id]/test-mode/academic-periods/route.ts
src/components/platform/internal-test/InternalTestAcademicPeriodsForm.tsx
```

Acceptance:

- max two periods,
- one current period,
- no overlaps,
- custom date picker used,
- records saved to `AcademicPeriod`.

## Chunk 6 — Seed Preview and Seed Run

Files:

```txt
src/app/api/platform/schools/[id]/test-mode/seed/preview/route.ts
src/app/api/platform/schools/[id]/test-mode/seed/run/route.ts
src/lib/internal-test/seed/*
scripts/seed-internal-test-school.ts
```

Package script:

```json
{
  "seed:internal-test-school": "tsx scripts/seed-internal-test-school.ts",
  "seed:internal-test-school:dry": "tsx scripts/seed-internal-test-school.ts --dryRun"
}
```

Acceptance:

- dry run returns counts without writes,
- commit creates data,
- one class group per grade,
- max two periods,
- realistic module data,
- run summary saved.

## Chunk 7 — Test Badge and Communication Suppression

Files:

```txt
src/components/app/*
src/lib/email/*
src/lib/jobs/emailDispatch.ts
src/lib/internal-test/is-test-communication-suppressed.ts
```

Acceptance:

- test badge visible in test school,
- emails/SMS/WhatsApp suppressed when controls are enabled,
- suppression is logged.

## 22. Testing Requirements

Add tests for:

```txt
challenge verification
platform admin authorization
activation route
controls update route
academic period validation
invitation bypass
production invitation non-bypass
seed preview count generation
one-class-group-per-grade guarantee
max-two-period validation
```

Potential test folder:

```txt
tests/internal-test-school-mode.test.ts
```

## 23. Non-Negotiable Safety Rules

1. Never enable test bypass for production schools by accident.
2. Never suppress real invitations unless the school is explicitly marked internal test.
3. Never generate seed data for non-test schools.
4. Never run seed generation without platform admin + challenge unlock.
5. Never store challenge passwords in plain text.
6. Never use raw date inputs in the test mode UI.
7. Never allow more than two academic periods for generated test data.
8. Never generate more than one class group per grade in this version.
9. Never weaken the real school onboarding/invite flow.
10. Always audit dangerous internal test actions.

## 24. Final Desired Outcome

After implementation, Joseph/platform admins can:

1. Create/select a school.
2. Open the school in platform admin.
3. Activate internal test school mode with a protected challenge.
4. Suppress emails and auto-activate test users only for that school.
5. Manually test the full JHS setup flow through real UI.
6. Configure one or two academic periods.
7. Later generate realistic full-school data with one class group per grade.
8. Test all modules safely without touching real schools or real users.

