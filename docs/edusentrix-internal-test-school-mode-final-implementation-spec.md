# EduSentrix Internal Test School Mode — Final Implementation Spec

**Product:** EduSentrix Platform  
**Module:** Platform Admin / Internal QA Tooling  
**Spec Type:** Final implementation and completion verification spec  
**Primary Goal:** Allow platform admins to create, configure, manually test, seed, reset, and safely manage internal test schools without weakening the real school onboarding, invitation, payment, notification, or security flows.

---

## 1. Executive Summary

EduSentrix needs an internal-only **Test School Mode** that allows the platform team to test the platform like a real running school while avoiding unnecessary real-world side effects such as sending hundreds of invitation emails, triggering real payments, or notifying fake users.

This feature must support two testing styles:

1. **Manual Test School**  
   A platform admin manually goes through real setup workflows from the UI, such as creating JHS grades, class groups, subjects, teachers, students, fee structures, invoices, schedules, lesson notes, lessons, and related data. The UI flow should remain real, but side effects such as email invitations should be safely suppressed.

2. **Seeded Test / Demo School**  
   A platform admin generates realistic school data across core modules for dashboards, reports, performance testing, product demos, role testing, and end-to-end QA.

The generated seeded school must be simple and manageable:

> **One class group per grade.**

Example:

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

This feature must be protected by layered security and must never create a bypass for real schools.

---

## 2. Core Principles

### 2.1 Internal Only

The feature must only be available to platform admins with explicit internal-test permission.

Real schools, school admins, teachers, parents, students, bursars, and other school-level users must never see or access this feature.

### 2.2 Do Not Weaken Production Onboarding

Real schools must continue to use the proper onboarding and invitation flows:

```txt
Create user
→ create membership/profile
→ send invitation email
→ user accepts invitation
→ user verifies/activates account
→ user accesses EduSentrix
```

Internal test schools may use:

```txt
Create user
→ create membership/profile
→ suppress invitation email
→ auto-activate test account or mark invitation as internally accepted
→ allow platform admin impersonation/login-as
```

But only when the school is explicitly marked as an internal test school.

### 2.3 Use Existing Models and Relationships

Do **not** create a parallel fake data system disconnected from EduSentrix models.

Test users and generated records must use the same domain relationships that real users use:

- `School`
- `User`
- school membership/role records if present
- `Teacher`
- `Student`
- `Parent`
- staff/admin records
- `Grade`
- `ClassGroup`
- `Subject`
- fees/invoices/payment models
- lesson note models
- lessons models
- library models
- other module models as supported

The difference between real and test records should be metadata and suppressed side effects, not separate business logic.

### 2.4 Centralize Side-Effect Bypass

Email, SMS, WhatsApp, payment, and notification suppression must be centralized in shared services.

Avoid scattered checks like this across route handlers:

```ts
if (school.isInternalTestSchool) return;
```

Instead, use shared helpers:

```ts
shouldBypassInvitation({ school, user })
shouldSuppressNotification({ school, channel })
shouldUseSandboxPayments({ school })
```

### 2.5 Reset Must Be Mandatory

A seeded test school must be safely resettable.

Generation should not ship without reset/cleanup support.

Every generated record should be traceable to a generation batch/job so it can be safely deleted without removing manually created records.

### 2.6 Audit Everything

Every sensitive action must be audit logged:

- activating test mode
- disabling test mode
- changing test school configuration
- generating data
- resetting generated data
- suppressing invitations
- impersonating test users
- activating sandbox payments
- changing test school security options

---

## 3. Terminology

| Term | Meaning |
|---|---|
| Platform Admin | Internal EduSentrix operator with platform-level access. |
| Internal Test School | A school marked for internal testing. External side effects can be suppressed. |
| Manual Test School | Internal test school where the platform admin manually uses the UI to create data. |
| Seeded Test School | Internal test school where the system generates realistic data. |
| Test User | A user created under a test school for testing roles and workflows. |
| Generation Job | A tracked background/incremental task that creates test data. |
| Test Data Batch | A group identifier attached to generated records so they can be reset safely. |
| Step-up Authentication | Re-verification of platform admin identity before sensitive action. |

---

## 4. Security Model

### 4.1 Required Gates

To activate or configure Test School Mode, all of the following must pass:

```txt
1. User is authenticated.
2. User is a platform admin.
3. User has platform.internalTest.manage permission.
4. Server feature flag ENABLE_INTERNAL_TEST_TOOLS=true.
5. User completes step-up verification.
6. User enters confirmation phrase.
7. Action is audit logged.
```

### 4.2 Permission

Add a platform-level permission:

```txt
platform.internalTest.manage
```

This permission should be separate from generic platform admin access.

A platform admin without this permission should not be able to:

- activate test mode
- disable test mode
- view internal test configuration page
- generate school data
- reset generated data
- impersonate test users

### 4.3 Environment Gate

Add server-side environment flag:

```env
ENABLE_INTERNAL_TEST_TOOLS=true
```

If not set to `true`, all internal test school endpoints must return `403` or `404`.

Recommended behavior:

- In production, keep disabled unless actively needed.
- In staging/demo environments, it may be enabled.
- Never expose the feature based only on frontend checks.

### 4.4 Step-up Authentication With Clerk

EduSentrix uses Clerk. The implementation must not assume platform admins have local password hashes.

Preferred approach:

```txt
Use Clerk-supported re-authentication / step-up verification where available.
```

If Clerk step-up is available in the current app:

```txt
Platform admin clicks sensitive action
→ UI prompts re-verification
→ Clerk verifies recent authentication
→ frontend receives step-up success
→ server verifies authenticated platform admin and permission
→ action proceeds
```

### 4.5 Fallback: Server-Side Internal Activation Secret

If Clerk step-up cannot be implemented cleanly in the current codebase, use a fallback internal secret.

Add:

```env
INTERNAL_TEST_ACTIVATION_SECRET=very-long-random-secret
```

Activation/configuration request must include:

```ts
{
  activationSecret: string;
  confirmationPhrase: string;
}
```

The server must compare the submitted secret against `INTERNAL_TEST_ACTIVATION_SECRET` using a constant-time comparison.

Do **not** store this secret in the database.

Do **not** expose it to the frontend.

Do **not** implement a separate local platform-admin password system just for this feature.

### 4.6 Confirmation Phrase

For dangerous actions, require confirmation phrase.

Activation phrase:

```txt
ENABLE TEST SCHOOL
```

Reset phrase:

```txt
RESET TEST DATA
```

Disable phrase:

```txt
DISABLE TEST SCHOOL
```

The phrase must be typed exactly.

### 4.7 Recommended Security Flow for Activation

```txt
Platform Admin opens Platform Admin → Schools → School Detail
↓
Clicks “Enable Internal Test School Mode”
↓
System shows warning modal
↓
System requires Clerk step-up OR internal activation secret
↓
System requires confirmation phrase: ENABLE TEST SCHOOL
↓
Server validates platform admin + permission + env flag + step-up/secret
↓
School is marked as internal_test
↓
Default test controls are created
↓
Audit log is recorded
```

---

## 5. School Model Changes

Update the `School` model or equivalent school schema.

Recommended fields:

```ts
type SchoolEnvironmentType = "production" | "demo" | "internal_test";

type School = {
  // existing fields...

  environmentType?: SchoolEnvironmentType;
  isInternalTestSchool?: boolean;

  internalTest?: {
    enabled: boolean;
    enabledAt?: Date;
    enabledBy?: ObjectId;
    disabledAt?: Date;
    disabledBy?: ObjectId;

    mode?: "manual" | "seeded" | "manual_and_seeded";

    visibleBadgeEnabled: boolean;
    notes?: string;
  };
};
```

### 5.1 Field Rules

When test mode is enabled:

```ts
environmentType = "internal_test";
isInternalTestSchool = true;
internalTest.enabled = true;
```

When disabled:

```ts
environmentType = "production"; // or previous value if tracked
isInternalTestSchool = false;
internalTest.enabled = false;
internalTest.disabledAt = new Date();
internalTest.disabledBy = currentUserId;
```

### 5.2 Completion Verification

- A production school cannot accidentally receive test behavior unless `isInternalTestSchool === true`.
- A test school shows a visible badge across school-scoped pages.
- Test mode activation is impossible without server env flag and platform permission.
- Disabling test mode stops future invitation bypass and side-effect suppression.

---

## 6. Test School Configuration Model

Create a dedicated model if not already present:

```txt
src/models/InternalTestSchoolConfig.ts
```

Recommended schema:

```ts
type InternalTestSchoolConfig = {
  schoolId: ObjectId;

  suppressEmailInvitations: boolean;
  autoActivateCreatedUsers: boolean;
  markEmailsAsVerified: boolean;

  suppressSms: boolean;
  suppressWhatsapp: boolean;
  suppressPushNotifications: boolean;
  suppressParentNotifications: boolean;

  useSandboxPayments: boolean;
  disableRealPaymentCollection: boolean;

  allowImpersonation: boolean;
  showInternalTestBadge: boolean;

  allowSeedGeneration: boolean;
  allowResetGeneratedData: boolean;

  createdAt: Date;
  updatedAt: Date;
  updatedBy?: ObjectId;
};
```

### 6.1 Default Configuration on Activation

When test mode is enabled, create default config:

```ts
{
  suppressEmailInvitations: true,
  autoActivateCreatedUsers: true,
  markEmailsAsVerified: true,

  suppressSms: true,
  suppressWhatsapp: true,
  suppressPushNotifications: true,
  suppressParentNotifications: true,

  useSandboxPayments: true,
  disableRealPaymentCollection: true,

  allowImpersonation: true,
  showInternalTestBadge: true,

  allowSeedGeneration: true,
  allowResetGeneratedData: true
}
```

### 6.2 Completion Verification

- Config page shows all toggles.
- Config changes are saved server-side.
- Config changes are audit logged.
- Toggling `suppressEmailInvitations` affects future user creation only.
- Toggling `useSandboxPayments` affects test school payment flow only.

---

## 7. Test User and Invitation Behavior

### 7.1 Existing Model Alignment

Before implementation, engineers must inspect the actual codebase for:

```txt
User model
Teacher model
Student model
Parent model
Staff/admin model
School membership model, if present
Invitation model/service, if present
Clerk user creation logic
Role guard helpers
```

The implementation must extend existing flows, not create parallel user records.

### 7.2 Recommended Test User Metadata

Add to `User` or membership model depending on actual architecture:

```ts
isTestUser?: boolean;
testUserSource?: "manual_test_school" | "seeded_test_school";
testSchoolId?: ObjectId;
testDataBatchId?: string;
```

If user roles are stored in membership records, add the metadata there too or instead.

### 7.3 Invitation Suppression

Create central helper:

```txt
src/lib/internal-test/shouldBypassInvitation.ts
```

```ts
export function shouldBypassInvitation(input: {
  school: { isInternalTestSchool?: boolean };
  config?: { suppressEmailInvitations?: boolean; autoActivateCreatedUsers?: boolean } | null;
}) {
  return Boolean(
    input.school.isInternalTestSchool &&
    input.config?.suppressEmailInvitations
  );
}
```

Use it inside the existing invitation service, not inside every API route.

### 7.4 Internal Test User Creation Behavior

For internal test school user creation:

```ts
{
  isTestUser: true,
  testUserSource: "manual_test_school" | "seeded_test_school",
  invitationEmailSent: false,
  invitationSuppressed: true,
  invitationSuppressionReason: "internal_test_school",
  emailVerified: true, // if config.markEmailsAsVerified
  accountStatus: "active" // if compatible with existing enum
}
```

If existing invitation status enum supports extension:

```ts
inviteStatus: "auto_accepted"
```

If not, do not force a new enum. Use suppression metadata.

### 7.5 Fake Email Pattern

For generated users, use fake but valid-looking emails:

```txt
teacher.math.jhs1@test.edusentrix.local
parent.0001@test.edusentrix.local
student.0001@test.edusentrix.local
bursar@test.edusentrix.local
```

Emails must not be sent.

### 7.6 Completion Verification

- Creating a teacher in a test school still creates proper teacher/user/membership relationships.
- No real email is sent when invitation suppression is enabled.
- Creating a teacher in a real school still sends the normal invite.
- Test users can be identified in database and UI.
- The bypass is centralized and covered by tests.

---

## 8. Platform Admin UI

### 8.1 Entry Points

Add platform admin access from school detail page:

```txt
/platform/schools/[schoolId]
```

Add internal test control page:

```txt
/platform/schools/[schoolId]/internal-test
```

Only show the link/button when:

```txt
current user is platform admin
+ has platform.internalTest.manage
+ ENABLE_INTERNAL_TEST_TOOLS=true
```

### 8.2 Test School Badge

When a school is internal test, show a persistent badge:

```txt
Internal Test School
```

Badge should appear in:

- platform school detail
- school admin layout/header
- teacher layout/header
- student/parent testing views where appropriate

The badge must be controlled by `showInternalTestBadge`.

### 8.3 Internal Test Control Page Sections

The page must contain:

1. **Status Panel**
   - test mode enabled/disabled
   - enabled by
   - enabled date
   - school environment type

2. **Safety Controls**
   - suppress email invitations
   - auto-activate users
   - mark email as verified
   - suppress SMS
   - suppress WhatsApp
   - suppress push notifications
   - sandbox payments
   - disable real payment collection
   - allow impersonation
   - show test badge

3. **Academic Period Setup for Generation**
   - number of academic periods: 1 or 2 only
   - period names
   - term labels
   - start dates
   - end dates
   - current period flag

4. **Seed Generation Panel**
   - choose V1 seed scope
   - configure counts
   - run generation
   - view job progress

5. **Generated Data Reset Panel**
   - select batch/job
   - view generated record counts
   - reset generated data

6. **Impersonation Panel**
   - list test users by role
   - login as / impersonate
   - audit warning

7. **Audit Log Panel**
   - recent internal test actions

### 8.4 UI Requirements

Use existing EduSentrix premium UI conventions:

- premium cards/glass panels
- premium dropdown/select component
- custom date picker for all dates
- confirmation modals
- danger zone section for disabling/resetting
- Sonner/busy toasts
- loading skeletons
- clear empty states
- status badges

Do not use raw `<select>` for important dropdowns.

Do not use native date inputs if a custom date picker exists.

### 8.5 Completion Verification

- Page is inaccessible to non-platform admins.
- Page is inaccessible when env flag is disabled.
- All date fields use the custom date picker.
- All dropdown fields use premium dropdown/select.
- Dangerous actions require confirmation phrase.
- Audit events appear after actions.

---

## 9. API Routes

Recommended route group:

```txt
src/app/api/platform/schools/[schoolId]/internal-test
```

### 9.1 Activate Test Mode

```txt
POST /api/platform/schools/[schoolId]/internal-test/activate
```

Payload:

```ts
{
  mode: "manual" | "seeded" | "manual_and_seeded";
  confirmationPhrase: "ENABLE TEST SCHOOL";
  activationSecret?: string; // fallback only
}
```

Server requirements:

- require platform admin
- require `platform.internalTest.manage`
- require env flag
- require Clerk step-up or internal activation secret
- require confirmation phrase
- update school fields
- create default config
- audit log

### 9.2 Disable Test Mode

```txt
POST /api/platform/schools/[schoolId]/internal-test/disable
```

Payload:

```ts
{
  confirmationPhrase: "DISABLE TEST SCHOOL";
  activationSecret?: string;
}
```

Must not delete data automatically.

### 9.3 Get Config

```txt
GET /api/platform/schools/[schoolId]/internal-test/config
```

Response:

```ts
{
  school: {
    id: string;
    name: string;
    isInternalTestSchool: boolean;
    environmentType: string;
  };
  config: InternalTestSchoolConfig;
}
```

### 9.4 Update Config

```txt
PATCH /api/platform/schools/[schoolId]/internal-test/config
```

Must validate allowed fields and audit changes.

### 9.5 Create Generation Job

```txt
POST /api/platform/schools/[schoolId]/internal-test/generation-jobs
```

Payload:

```ts
{
  academicPeriods: Array<{
    name: string;
    termLabel: string;
    startDate: string;
    endDate: string;
    isCurrent: boolean;
  }>;

  counts?: {
    studentsPerClassGroup?: number;
    teachers?: number;
    parentsPerStudentRatio?: number;
  };

  scope: "core_v1" | "extended_v2";
}
```

Validation:

- school must be internal test
- config.allowSeedGeneration must be true
- academicPeriods length must be 1 or 2
- dates must not overlap
- exactly one current period
- current period should align with current/future real dates
- end date after start date
- one class group per grade rule is enforced

### 9.6 Get Generation Job

```txt
GET /api/platform/schools/[schoolId]/internal-test/generation-jobs/[jobId]
```

Returns progress, steps, counts, errors, logs.

### 9.7 List Generation Jobs

```txt
GET /api/platform/schools/[schoolId]/internal-test/generation-jobs
```

### 9.8 Reset Generated Data

```txt
POST /api/platform/schools/[schoolId]/internal-test/reset
```

Payload:

```ts
{
  testDataBatchId: string;
  confirmationPhrase: "RESET TEST DATA";
  activationSecret?: string;
}
```

Must delete only records marked as generated by test mode for that batch.

### 9.9 Impersonate Test User

```txt
POST /api/platform/schools/[schoolId]/internal-test/impersonate
```

Payload:

```ts
{
  targetUserId: string;
}
```

Preconditions:

- platform admin
- permission
- env flag
- school is internal test
- config.allowImpersonation is true
- target user belongs to school
- target user is test user
- audit log created

Implementation must align with existing auth/session/Clerk architecture.

If true impersonation is not technically supported yet, provide a safe alternative:

```txt
Open role-specific test session selector / simulation mode
```

but do not fake permissions in a way that bypasses real guards without audit.

---

## 10. Generation Job Model

Create:

```txt
src/models/InternalTestDataGenerationJob.ts
```

Recommended schema:

```ts
type GenerationStepStatus = "pending" | "running" | "completed" | "failed" | "skipped";

type InternalTestDataGenerationJob = {
  schoolId: ObjectId;
  requestedBy: ObjectId;

  testDataBatchId: string;
  scope: "core_v1" | "extended_v2";

  status: "queued" | "running" | "completed" | "failed" | "cancelled";

  academicPeriods: Array<{
    name: string;
    termLabel: string;
    startDate: Date;
    endDate: Date;
    isCurrent: boolean;
  }>;

  counts: {
    studentsPerClassGroup: number;
    teachers: number;
    parentsPerStudentRatio: number;
  };

  steps: Array<{
    key: string;
    label: string;
    status: GenerationStepStatus;
    startedAt?: Date;
    completedAt?: Date;
    createdCount?: number;
    updatedCount?: number;
    error?: string;
  }>;

  createdCounts: Record<string, number>;
  errors: Array<{
    step: string;
    message: string;
    details?: unknown;
  }>;

  startedAt?: Date;
  completedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
};
```

### 10.1 Job Execution Requirements

Each generation step must be:

- ordered
- logged
- idempotent where possible
- retry-safe where possible
- associated with `testDataBatchId`

If a step fails, the job should record the failure and stop or mark downstream steps skipped.

### 10.2 Completion Verification

- Job progress can be viewed from UI.
- Failed step shows useful error.
- Retrying does not duplicate already completed records for the same batch.
- Generated records are countable by module.

---

## 11. Generated Record Metadata

Every generated record should include metadata where schema allows:

```ts
generatedByTestMode?: boolean;
testGenerationJobId?: ObjectId;
testDataBatchId?: string;
testDataKind?: string;
```

If a model should not be modified, create a registry collection:

```txt
src/models/InternalTestGeneratedRecord.ts
```

```ts
type InternalTestGeneratedRecord = {
  schoolId: ObjectId;
  testDataBatchId: string;
  generationJobId: ObjectId;
  collectionName: string;
  documentId: ObjectId;
  module: string;
  createdAt: Date;
};
```

Preferred approach: use metadata fields where practical, registry as fallback.

### 11.1 Completion Verification

- Reset can identify generated records precisely.
- Manually created test records are not deleted unless explicitly marked generated.
- Generated data counts can be calculated.

---

## 12. Academic Period Generation Rules

### 12.1 User Input

Before generating data, platform admin must define 1 or 2 academic periods.

Fields:

```txt
Period name
Term label
Start date
End date
Is current period
```

### 12.2 Validation Rules

```txt
Maximum academic periods: 2
Minimum academic periods: 1
Only one current period
Dates must not overlap
End date must be after start date
Current period should align with current/future real-life dates
```

“Current period should align with real-life dates” means:

- if a period is marked current, today should be within its date range or the start date should be in the near future for upcoming testing.
- do not allow a current period that ended long ago.

### 12.3 Completion Verification

- User cannot generate with 0 periods.
- User cannot generate with 3+ periods.
- User cannot mark two periods current.
- User cannot enter overlapping dates.
- UI uses custom date picker.

---

## 13. Seeded School Structure

### 13.1 Grades

Create one grade each:

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

### 13.2 Class Groups

Create exactly one class group per grade:

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

### 13.3 Subjects

Generate realistic Ghana/NaCCA-aligned subjects per level.

#### Early Years

```txt
Communication & Language
Personal, Social & Emotional Development
Physical Development
Creative Play
Music & Movement
Story Time
Health & Hygiene Routines
Outdoor Play
```

#### KG

```txt
Language & Literacy
Numeracy
Creative Arts
Music & Movement
Our World and Our People
Religious & Moral Education
Physical Education
Ghanaian Language
Computing Readiness
Story Time
```

#### Primary

```txt
English Language
Mathematics
Science
Our World and Our People
Creative Arts
Religious and Moral Education
Computing
Ghanaian Language
Physical Education
History
```

#### JHS

```txt
English Language
Mathematics
Integrated Science
Social Studies
Computing
Religious and Moral Education
Creative Arts and Design
Career Technology
Ghanaian Language
French
Physical Education
```

### 13.4 Completion Verification

- Exactly one class group exists per grade for seeded test school.
- Every class group is linked to the correct grade.
- Subjects are linked to appropriate grade/class levels where the current model supports it.

---

## 14. Core V1 Generation Scope

The first complete version of generated data must cover the following modules:

```txt
1. School shell/config verification
2. Academic periods
3. Grades
4. One class group per grade
5. Subjects
6. Staff/admin test accounts
7. Teachers
8. Teacher assignments
9. Students
10. Parents/guardians
11. Parent-student links
12. Daily schedules / timetable basics
13. Fee structures
14. Student invoices
15. Sample payments
16. Notices/basic announcements
17. Lesson notes
18. Lessons
19. Flashcard decks/cards
20. Library books
21. Library loans
```

### 14.1 Explicit V2 Scope

Do not block V1 completion on these modules unless already easy to generate:

```txt
Curriculum & Scheme of Work
Coverage analytics
Polls
Fundraising campaigns
Video meeting schedules
Vendor/supplier records
Inventory/assets
AI/Leo activity logs
Advanced notification logs
Advanced analytics events
```

These should be V1.5/V2 generator extensions.

### 14.2 Completion Verification

- V1 generation creates a usable school across admin, teacher, student, parent, fees, lessons, and library flows.
- V1 does not claim full coverage of every EduSentrix module.
- V2 module generation has extension points and clearly named step keys.

---

## 15. Generation Dependency Order

The generator must create records in this order:

```txt
1. Validate school is internal test
2. Create/generate academic periods
3. Create grades
4. Create one class group per grade
5. Create subjects
6. Create staff/admin test users
7. Create teacher test users and teacher profiles
8. Assign teachers to subjects/class groups
9. Create student test users/profiles
10. Create parent/guardian test users/profiles
11. Link parents to students
12. Create daily schedules/timetable basics
13. Create fee structures
14. Generate invoices
15. Generate sample payments
16. Create notices
17. Create lesson notes
18. Create lessons from lesson notes
19. Create flashcards/resources where supported
20. Create library books
21. Create library loans
22. Finalize job counts and audit log
```

### 15.1 Completion Verification

- No child record is created before its parent dependency exists.
- Teachers are assigned only to existing subjects/class groups.
- Students are assigned only to existing class groups.
- Invoices are generated only for existing students/fees.
- Lessons are generated only from existing lesson notes.

---

## 16. Module-Aware Generation Contracts

Each module generator must use actual EduSentrix model requirements.

Before coding each generator, engineers must inspect:

```txt
model schema
required fields
indexes/unique constraints
existing API route behavior
service/helper functions
relationships
status enums
permissions assumptions
```

### 16.1 Preferred Implementation Pattern

Create generator modules:

```txt
src/lib/internal-test/generators/generateAcademicPeriods.ts
src/lib/internal-test/generators/generateGradesAndClassGroups.ts
src/lib/internal-test/generators/generateSubjects.ts
src/lib/internal-test/generators/generateUsers.ts
src/lib/internal-test/generators/generateTeachers.ts
src/lib/internal-test/generators/generateStudentsAndParents.ts
src/lib/internal-test/generators/generateSchedules.ts
src/lib/internal-test/generators/generateFeesAndInvoices.ts
src/lib/internal-test/generators/generateLessonNotesAndLessons.ts
src/lib/internal-test/generators/generateLibrary.ts
```

Each generator should return:

```ts
type GeneratorResult = {
  createdCount: number;
  updatedCount?: number;
  skippedCount?: number;
  warnings?: string[];
};
```

### 16.2 Use Existing Services Where Possible

Prefer existing domain helpers/services over raw inserts.

Example:

```txt
Use the same fee generation logic used by production invoice creation if available.
Use the same teacher assignment helpers if available.
Use the same lesson creation helper from lesson notes if available.
```

Only use direct model creation when no service exists.

### 16.3 Completion Verification

- Each generator file states which models/services it uses.
- Each generator validates required IDs before writing.
- Generated records pass the same dashboard/API reads as manually created records.

---

## 17. Invitation, Notification, and Payment Suppression

### 17.1 Invitation Suppression

The invitation service must check:

```ts
shouldBypassInvitation({ school, config })
```

If true:

```txt
Do not send email
Mark invitation suppressed or auto-accepted depending on model support
Mark generated/manual test user active if config allows
Audit suppressed invitation count if practical
```

### 17.2 Notification Suppression

Notification service must check:

```ts
shouldSuppressNotification({ school, config, channel })
```

Channels:

```txt
email
sms
whatsapp
push
in_app
```

In-app notifications may still be created if useful for testing, but external delivery must be suppressed when configured.

### 17.3 Payment Sandbox

Payment and fee collection code must check:

```ts
shouldUseSandboxPayments({ school, config })
```

For internal test schools:

- do not initiate real Paystack collections unless explicitly allowed for a payment-specific test
- generated payments should be marked as test/sandbox
- no real settlement/reconciliation side effects

### 17.4 Completion Verification

- Test school user creation sends no real invite.
- Real school user creation still sends invites.
- Test school payment simulation does not call real payment collection by default.
- Notification suppression is tested per channel.

---

## 18. Impersonation / Login-As Test User

### 18.1 Purpose

Platform admins need to test role-based experiences:

```txt
school admin
academic head
teacher
student
parent
bursar
librarian
```

### 18.2 Preconditions

Allow impersonation only when:

```txt
User is platform admin
User has platform.internalTest.manage
ENABLE_INTERNAL_TEST_TOOLS=true
School is internal test
Config allows impersonation
Target user belongs to the school
Target user is marked test user
```

### 18.3 Audit Logging

Every impersonation action must log:

```txt
platform admin user id
target user id
target role
school id
time
reason if provided
```

### 18.4 Completion Verification

- Platform admin can impersonate only test users.
- Cannot impersonate real school users through this feature.
- Impersonation is visible in audit logs.
- UI clearly indicates when viewing as another user.

---

## 19. Reset / Cleanup

### 19.1 Required Behavior

Reset must delete generated data by `testDataBatchId` and `schoolId` only.

It must not delete:

- manually created records without generated metadata
- platform admin user
- school shell unless explicitly requested in a separate dangerous operation
- internal test configuration unless requested

### 19.2 Reset Flow

```txt
Platform admin opens Reset Generated Data
↓
Selects generation batch/job
↓
System shows counts by module
↓
Admin types RESET TEST DATA
↓
Server validates permission + env + step-up/secret if required
↓
System deletes generated records in reverse dependency order
↓
Audit log is recorded
```

### 19.3 Reverse Dependency Delete Order

```txt
library loans
lesson flashcards/resources/lessons
lesson notes
payments
invoices
fee structures
schedules/timetable entries
parent-student links
parents
students
teacher assignments
teachers
staff test users
subjects
class groups
grades
academic periods
```

Only delete records for the selected generated batch.

### 19.4 Completion Verification

- Reset is present before generation feature is considered complete.
- Reset removes generated data and preserves manually created test data.
- Reset logs counts of deleted records.
- Reset failure leaves useful error logs.

---

## 20. Audit Logging

Use existing audit model if available. If not, create:

```txt
src/models/PlatformAuditLog.ts
```

Events:

```txt
internal_test.enabled
internal_test.disabled
internal_test.config_updated
internal_test.generation_started
internal_test.generation_completed
internal_test.generation_failed
internal_test.reset_started
internal_test.reset_completed
internal_test.reset_failed
internal_test.impersonation_started
internal_test.invitation_suppressed
internal_test.payment_sandbox_used
```

Each audit log should include:

```ts
{
  actorId: ObjectId;
  schoolId?: ObjectId;
  action: string;
  entityType?: string;
  entityId?: ObjectId;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}
```

### 20.1 Completion Verification

- Activation creates audit log.
- Config update creates audit log with changed fields.
- Generation start/end creates audit logs.
- Reset creates audit logs.
- Impersonation creates audit log.

---

## 21. Recommended Folder Structure

```txt
src/lib/internal-test/
  auth.ts
  guards.ts
  config.ts
  shouldBypassInvitation.ts
  shouldSuppressNotification.ts
  shouldUseSandboxPayments.ts
  generation/
    createGenerationJob.ts
    runGenerationJob.ts
    resetGeneratedData.ts
    generationSteps.ts
  generators/
    generateAcademicPeriods.ts
    generateGradesAndClassGroups.ts
    generateSubjects.ts
    generateUsers.ts
    generateTeachers.ts
    generateStudentsAndParents.ts
    generateSchedules.ts
    generateFeesAndInvoices.ts
    generateLessonNotesAndLessons.ts
    generateLibrary.ts
  audit.ts
  constants.ts

src/models/
  InternalTestSchoolConfig.ts
  InternalTestDataGenerationJob.ts
  InternalTestGeneratedRecord.ts // optional fallback registry

src/app/api/platform/schools/[schoolId]/internal-test/
  activate/route.ts
  disable/route.ts
  config/route.ts
  generation-jobs/route.ts
  generation-jobs/[jobId]/route.ts
  reset/route.ts
  impersonate/route.ts

src/app/(platform)/platform/schools/[schoolId]/internal-test/
  page.tsx
  components/
    InternalTestStatusCard.tsx
    InternalTestConfigPanel.tsx
    AcademicPeriodsForGenerationForm.tsx
    SeedGenerationPanel.tsx
    GenerationJobProgress.tsx
    ResetGeneratedDataPanel.tsx
    TestUserImpersonationPanel.tsx
    InternalTestAuditPanel.tsx
```

Adapt the route group to the actual platform admin folder convention in the codebase.

---

## 22. Implementation Chunks

### Chunk 1 — Security and Permissions

Build:

- `platform.internalTest.manage` permission
- env gate helper
- platform admin guard wrapper
- Clerk step-up integration or internal activation secret fallback
- confirmation phrase validation

Completion verification:

- endpoints cannot be called without env flag
- endpoints cannot be called without permission
- activation cannot proceed without step-up/secret

---

### Chunk 2 — School and Config Models

Build:

- school test mode fields
- `InternalTestSchoolConfig`
- default config creation on activation

Completion verification:

- enabling test mode updates school and config
- disabling test mode stops test behavior
- config can be fetched and updated

---

### Chunk 3 — Platform Admin UI

Build:

- internal test control page
- activation modal
- config toggles
- test badge
- audit panel placeholder

Completion verification:

- only platform admins with permission can access
- UI uses premium controls
- dangerous actions require confirmation

---

### Chunk 4 — Centralized Side-Effect Suppression

Build:

- invitation bypass helper
- notification suppression helper
- payment sandbox helper
- integrate helpers into existing services

Completion verification:

- test school invite suppressed
- real school invite still sent
- test payment sandboxed

---

### Chunk 5 — Generation Job Framework

Build:

- generation job model
- create/list/get job APIs
- progress tracking
- job step framework
- batch id generation

Completion verification:

- job is created and visible
- job has steps and status
- failure is recorded cleanly

---

### Chunk 6 — Academic Period Input

Build:

- generation academic period form
- validation for max 2 periods
- date overlap validation
- current period validation
- custom date picker usage

Completion verification:

- invalid periods are rejected client and server side
- exactly one current period is enforced

---

### Chunk 7 — Core V1 Generators

Build generators for:

- academic periods
- grades
- one class group per grade
- subjects
- staff/teachers/students/parents
- teacher assignments
- basic schedules
- fees/invoices/payments
- notices
- lesson notes/lessons/flashcards
- library basics

Completion verification:

- generated school is usable from admin/teacher/student/parent views
- one class group per grade rule is enforced
- generated records have batch metadata

---

### Chunk 8 — Impersonation

Build:

- test user list
- impersonation endpoint
- UI panel
- audit logs

Completion verification:

- can impersonate test user
- cannot impersonate real user
- audit log created

---

### Chunk 9 — Reset/Cleanup

Build:

- reset endpoint
- reverse dependency delete
- reset UI
- generated record counts
- audit logs

Completion verification:

- generated records deleted
- manual records preserved
- reset requires confirmation

---

### Chunk 10 — V2 Generator Extensions

Add optional generators for:

- curriculum/scheme of work
- polls
- fundraising
- video meeting schedules
- vendors/suppliers
- inventory/assets
- AI logs
- advanced analytics

Completion verification:

- each extension has its own step
- each extension can fail without corrupting core generated data

---

## 23. Acceptance Criteria

The feature is complete only when all of the following pass.

### Security

- Non-platform admins cannot access internal test pages or APIs.
- Platform admins without `platform.internalTest.manage` cannot access.
- Env flag disables all feature routes.
- Activation requires step-up or internal activation secret.
- Dangerous actions require confirmation phrases.

### Test School Activation

- A school can be marked internal test from platform admin.
- Activation creates default config.
- Test badge is visible.
- Disabling test mode stops future bypass behavior.

### Manual Testing Support

- Platform admin can manually create teachers/students/parents/staff through normal UI.
- Test school suppresses invitation emails.
- Created test users are active/usable according to config.
- Real schools still send normal invitations.

### Seed Generation

- Admin can configure 1 or 2 academic periods.
- Current period validation works.
- Seeded school creates one class group per grade.
- Core V1 data is generated in correct dependency order.
- Generated data works across core dashboards.

### Reset

- Generated data can be reset by batch.
- Manually created test data is preserved.
- Reset is audit logged.
- Reset has confirmation phrase.

### Side Effects

- No real emails are sent for test-school suppressed invitations.
- No real SMS/WhatsApp/push notifications are sent when suppressed.
- No real payments are initiated when sandbox mode is enabled.

### UI

- Internal test page uses premium EduSentrix styling.
- Date fields use custom date picker.
- Dropdowns use premium dropdown/select.
- Loading, empty, success, and error states are handled.
- Dangerous actions are visually separated in a danger zone.

### Audit

- Activation, config updates, generation, reset, and impersonation are logged.
- Audit logs are visible from the internal test control page.

---

## 24. Non-Goals for V1

Do not attempt these in V1 unless already trivial:

- perfect generation for every EduSentrix module
- public demo signup
- school-admin-controlled test mode
- real payment gateway tests
- production white-label demo provisioning
- AI-generated full school content for every subject
- full curriculum coverage generation
- multi-campus test schools
- multiple class groups per grade

---

## 25. Final Implementation Warning

This feature is powerful and dangerous if implemented loosely.

The correct architecture is:

```txt
Platform Admin Only
→ Protected activation
→ Internal test config
→ Centralized side-effect suppression
→ Real domain models and relationships
→ Traceable generated data
→ Safe reset
→ Full audit trail
```

The wrong architecture is:

```txt
Scattered test checks
→ fake disconnected data
→ no reset
→ no audit logs
→ global invite bypass
→ accidental real school bypass
```

Engineers and AI agents must treat this as internal infrastructure, not a normal school-facing feature.

