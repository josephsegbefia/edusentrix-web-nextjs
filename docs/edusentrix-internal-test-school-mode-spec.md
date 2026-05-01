# EduSentrix Internal Test School Mode — Development Specification

## 1. Purpose

EduSentrix needs a safe internal testing workflow that allows the platform owner/team to create and operate a full production-like school without sending real invitations, SMS, WhatsApp messages, or payment requests.

This feature is intended only for internal production testing, QA, demo preparation, performance validation, and full workflow verification.

The system must support two kinds of internal testing:

1. **Manual Test School**
   - The platform admin manually goes through real product workflows.
   - Used to catch UI/UX issues, validation bugs, unclear flows, permission issues, and module integration problems.

2. **Seeded Test/Demo School**
   - The platform generates realistic data across the entire school.
   - Used for dashboards, analytics, pagination, reports, performance testing, and demo preparation.

Real schools must continue to use the normal production onboarding and invitation flow.

---

## 2. Core Principle

Do not weaken the real production onboarding system.

Instead, introduce a strictly protected internal mode:

```ts
school.environmentType = "internal_test";
school.isInternalTestSchool = true;
```

Only platform admins should be able to activate or configure this mode, and activation must require an additional password confirmation.

---

## 3. Key Requirements

### 3.1 Platform Admin Test School Activation

From the Platform Admin dashboard, authorized platform admins must be able to mark a school as an internal test school.

Location suggestion:

```txt
/platform/schools/[schoolId]/internal-test
```

or under a protected tab:

```txt
Platform Admin → Schools → Selected School → Internal Test Controls
```

The activation UI must include:

- Current school name
- Current school ID
- Current environment type
- Warning message
- Password confirmation field
- Reason textarea
- Confirm activation button

The action must be protected by:

- platform admin role check
- dedicated internal-test permission
- password re-verification
- confirmation phrase or checkbox
- audit logging

Recommended permission:

```txt
platform.internalTest.manage
```

---

## 4. Best Way to Protect Test School Activation With a Password

### 4.1 Recommended Protection Strategy

Use a **two-layer protection model**:

1. **User password re-authentication**
2. **Server-side internal action secret**

This is safer than only asking for a random shared password.

### Layer 1: Re-authenticate the platform admin

When the platform admin clicks “Activate Internal Test School”, ask for their own platform admin password again.

The backend must verify that the password belongs to the currently authenticated platform admin.

This ensures that if an admin leaves their laptop open, someone else cannot casually enable test mode.

Example request:

```ts
POST /api/platform/schools/:schoolId/internal-test/activate
{
  "adminPassword": "current admin password",
  "reason": "Manual production testing for JHS setup flow"
}
```

Backend flow:

```ts
1. Verify current user is authenticated.
2. Verify current user is platform admin.
3. Verify current user has platform.internalTest.manage permission.
4. Verify submitted password against current user's password hash.
5. If valid, continue.
6. If invalid, reject and log failed attempt.
```

### Layer 2: Require an internal action secret

Add a server-only environment variable:

```env
INTERNAL_TEST_ACTION_SECRET="long-random-secret"
```

The platform admin does not need to type this. It is used by the backend to ensure the route can only execute in an environment where internal test tooling is intentionally enabled.

Recommended environment flags:

```env
ENABLE_INTERNAL_TEST_TOOLS=true
INTERNAL_TEST_ACTION_SECRET="long-random-secret"
```

Backend must reject activation if:

```ts
process.env.ENABLE_INTERNAL_TEST_TOOLS !== "true"
```

This prevents accidental use in environments where the feature should be disabled.

### Optional Layer 3: Confirmation phrase

For extra safety, require the platform admin to type:

```txt
ENABLE TEST SCHOOL
```

This prevents accidental clicks.

### Optional Layer 4: Time-based activation lock

For very strict control, allow activation only after a short-lived challenge token is issued.

Flow:

```txt
Request activation challenge
↓
Backend creates short-lived challenge token
↓
Admin enters password + confirmation phrase
↓
Backend validates challenge + password
↓
School is marked as internal_test
```

This is optional for V1.

### What Not To Do

Do not use only a shared password like:

```txt
Enter test mode password: ********
```

A shared password is risky because it can be leaked, copied, or reused by multiple people. If you use a shared internal password at all, it should be in addition to user password re-authentication, not instead of it.

### Final Recommendation

For V1, use:

```txt
Platform admin role
+ platform.internalTest.manage permission
+ admin password re-authentication
+ ENABLE_INTERNAL_TEST_TOOLS server flag
+ confirmation phrase
+ audit logs
```

This is strong, practical, and easy to implement.

---

## 5. Data Model Changes

### 5.1 School Model Additions

```ts
export type SchoolEnvironmentType = "production" | "demo" | "internal_test";

export interface School {
  _id: ObjectId;
  name: string;

  environmentType: SchoolEnvironmentType;
  isInternalTestSchool: boolean;

  internalTestConfig?: {
    suppressEmails: boolean;
    suppressSms: boolean;
    suppressWhatsApp: boolean;
    autoActivateUsers: boolean;
    allowImpersonation: boolean;
    forceSandboxPayments: boolean;
    showTestModeBadge: boolean;
    allowSeedDataGeneration: boolean;
    maxAcademicPeriodsForSeed: number;
    createdAt?: Date;
    activatedAt?: Date;
    activatedBy?: ObjectId;
    activationReason?: string;
  };

  createdAt: Date;
  updatedAt: Date;
}
```

Default production schools:

```ts
{
  environmentType: "production",
  isInternalTestSchool: false,
  internalTestConfig: undefined
}
```

Internal test schools:

```ts
{
  environmentType: "internal_test",
  isInternalTestSchool: true,
  internalTestConfig: {
    suppressEmails: true,
    suppressSms: true,
    suppressWhatsApp: true,
    autoActivateUsers: true,
    allowImpersonation: true,
    forceSandboxPayments: true,
    showTestModeBadge: true,
    allowSeedDataGeneration: true,
    maxAcademicPeriodsForSeed: 2
  }
}
```

---

### 5.2 User Model Additions

```ts
export interface User {
  _id: ObjectId;
  schoolId?: ObjectId;
  name: string;
  email: string;
  role: string;

  isTestUser: boolean;
  accountStatus: "invited" | "active" | "suspended";
  inviteStatus: "pending" | "accepted" | "auto_accepted" | "expired";
  emailVerified: boolean;

  createdAt: Date;
  updatedAt: Date;
}
```

For users created in an internal test school:

```ts
{
  isTestUser: true,
  accountStatus: "active",
  inviteStatus: "auto_accepted",
  emailVerified: true
}
```

For real school users:

```ts
{
  isTestUser: false,
  accountStatus: "invited",
  inviteStatus: "pending",
  emailVerified: false
}
```

---

### 5.3 Internal Test Generation Job Model

A data generation run must be tracked.

```ts
export interface InternalTestGenerationJob {
  _id: ObjectId;
  schoolId: ObjectId;

  requestedBy: ObjectId;

  status: "queued" | "running" | "completed" | "failed" | "cancelled";

  mode: "full_school" | "module_specific";

  selectedAcademicPeriodIds: ObjectId[];

  periodDateConfig: {
    academicPeriodId: ObjectId;
    name: string;
    termNumber?: number;
    startDate: Date;
    endDate: Date;
    isCurrent: boolean;
  }[];

  modules: {
    academics: boolean;
    students: boolean;
    teachers: boolean;
    parents: boolean;
    attendance: boolean;
    fees: boolean;
    invoices: boolean;
    payments: boolean;
    lessonNotes: boolean;
    lessons: boolean;
    curriculumScheme: boolean;
    library: boolean;
    polls: boolean;
    fundraising: boolean;
    vendors: boolean;
    inventory: boolean;
    videoMeetings: boolean;
    notifications: boolean;
  };

  requestedCounts: {
    grades?: number;
    classGroups?: number;
    students?: number;
    teachers?: number;
    parents?: number;
    staff?: number;
    libraryBooks?: number;
    vendors?: number;
    lessonNotes?: number;
    lessons?: number;
    invoices?: number;
    payments?: number;
  };

  generatedCounts?: Record<string, number>;

  logs: {
    level: "info" | "warning" | "error";
    message: string;
    module?: string;
    timestamp: Date;
  }[];

  errorMessage?: string;

  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}
```

---

## 6. Internal Test School Configuration Page

### 6.1 Page Route

```txt
/platform/schools/[schoolId]/internal-test
```

### 6.2 Access Control

Only platform admins with the permission below can access this page:

```txt
platform.internalTest.manage
```

If unauthorized, return 403.

### 6.3 UI Requirements

This page must follow the EduSentrix premium design system.

Required UI standards:

- Use the existing premium card layout.
- Use the existing premium dropdown component.
- Use the custom EduSentrix date picker.
- Use existing buttons, badges, modals, and toast system.
- Use clear warning states for dangerous actions.
- Maintain the same premium dark/glassmorphism feel used across EduSentrix.
- Do not introduce raw browser selects or native date inputs.
- Do not use plain unstyled inputs.

The page must show a visible badge:

```txt
Internal Test School
```

when active.

---

## 7. Internal Test Configuration Sections

The page should contain the following sections.

### 7.1 Activation Panel

Shown if school is not yet an internal test school.

Fields:

- Admin password
- Confirmation phrase
- Reason for activation

Confirmation phrase:

```txt
ENABLE TEST SCHOOL
```

Button:

```txt
Activate Internal Test School
```

After activation, show active status and configuration controls.

---

### 7.2 Test Safety Settings

Configurable switches:

```txt
Suppress email invitations
Auto-activate created users
Suppress SMS notifications
Suppress WhatsApp notifications
Force sandbox payments
Allow login-as test users
Show test mode badge
Allow data generation
```

Defaults for internal test school:

```ts
{
  suppressEmails: true,
  autoActivateUsers: true,
  suppressSms: true,
  suppressWhatsApp: true,
  forceSandboxPayments: true,
  allowImpersonation: true,
  showTestModeBadge: true,
  allowSeedDataGeneration: true
}
```

---

### 7.3 Academic Period Generator Settings

Before running a full school data generation script, the user must configure academic periods.

Rules:

- Maximum academic periods for generation: **2**
- Minimum academic periods: **1**
- Periods must have start and end dates.
- End date must be after start date.
- Period date ranges must not overlap.
- One period may be marked as current.
- The current period must align with real-life dates in the future or current timeline.

Recommended interpretation of current period:

```txt
The current generated academic period should start on or before today's date and end after today's date, OR should be the next upcoming realistic term if the school is being prepared for future testing.
```

Because production testing often needs current/future dates, the UI should strongly warn if all configured periods are entirely in the past.

Fields per period:

- Academic year label
- Term label
- Term number
- Start date
- End date
- Mark as current

Use the custom EduSentrix date picker for start/end dates.

Do not use raw native HTML date inputs.

Example:

```txt
Academic Year: 2026/2027
Term: Term 1
Start Date: 2026-09-08
End Date: 2026-12-18
Current: true
```

Maximum allowed selected/configured periods:

```ts
MAX_GENERATION_PERIODS = 2;
```

---

### 7.4 Data Generation Scope

The platform admin should be able to choose what to generate.

Options:

```txt
Generate full school data
Generate academics only
Generate students/parents only
Generate fees/invoices/payments only
Generate lesson notes and lessons only
Generate library data only
Generate vendors/inventory only
Generate communication demo data only
```

V1 may implement full school generation first, with module-specific generation added after.

---

### 7.5 Counts and Density Settings

The platform admin should configure the amount of data to generate.

Fields:

```txt
Number of grades
Class groups per grade
Students per class group
Teachers
Parents
Staff
Library books
Vendors
Fee structures
Invoices
Payments
Lesson notes
Lessons
Polls
Fundraising campaigns
Video meetings
```

Suggested V1 presets:

```txt
Small School
Medium School
Large School
```

Example:

```ts
Small School = {
  grades: 6,
  classGroupsPerGrade: 1,
  studentsPerClassGroup: 20,
  teachers: 15,
  parents: 80,
  staff: 6
}
```

The UI should make it clear that high-volume generation may take time and should run as a background job.

---

### 7.6 Data Generation Preview

Before generation, show a preview summary:

```txt
This will generate:
- 1 school setup context
- 2 academic periods
- 9 grades
- 18 class groups
- 540 students
- 480 parents
- 45 teachers
- 12 staff users
- 18 fee structures
- 1,080 invoices
- 700 sample payments
- 90 lesson notes
- 60 lessons
- 500 library books
- 20 vendors
```

Require confirmation before running generation.

Confirmation phrase:

```txt
GENERATE TEST DATA
```

---

### 7.7 Job History

The page should show previous generation jobs.

Columns:

```txt
Date
Requested By
Mode
Academic Periods
Status
Generated Counts
Errors
Actions
```

Actions:

```txt
View logs
Download summary
Retry failed job
Cancel running job
```

---

## 8. Module-Aware Data Generation Requirement

The platform must generate realistic data by investigating how each module works.

This is a strict requirement.

The generation script must not blindly insert disconnected records.

Before generating data for a module, the generation service must inspect or rely on documented knowledge of:

```txt
Mongoose models
Required fields
Relationships
Indexes
Enums
Validation rules
API route expectations
Service-layer business logic
Status lifecycles
Permissions and school scoping
```

Generated records must follow the same relationships expected by the real app.

For example:

```txt
Students must belong to school, grade, and class group.
Parents must be linked to students.
Teachers must be linked to subjects and class groups.
Fee structures must link to academic periods and grade/class scopes.
Invoices must link to students and fee structures.
Payments must link to invoices and use sandbox references.
Lesson notes must link to teacher, subject, class group, grade, term, and optionally scheme items.
Lessons must be generated from lesson notes, not independently.
Library loans must link to real students/teachers and real book copies.
```

---

## 9. Generation Architecture

### 9.1 Recommended Service Structure

```txt
src/features/internal-test/
  actions/
    activateInternalTestSchool.ts
    updateInternalTestConfig.ts
    startGenerationJob.ts
    cancelGenerationJob.ts

  services/
    internalTestGuard.ts
    internalTestConfigService.ts
    testUserFactory.ts
    testSchoolGenerationService.ts
    moduleInspectorService.ts
    generationLogger.ts

  generators/
    generateAcademicPeriods.ts
    generateGrades.ts
    generateClassGroups.ts
    generateSubjects.ts
    generateTeachers.ts
    generateStudents.ts
    generateParents.ts
    generateFees.ts
    generateInvoices.ts
    generatePayments.ts
    generateCurriculumScheme.ts
    generateLessonNotes.ts
    generateLessons.ts
    generateLibrary.ts
    generatePolls.ts
    generateFundraising.ts
    generateVendors.ts
    generateInventory.ts
    generateVideoMeetings.ts
    generateNotifications.ts

  schemas/
    internalTestConfigSchema.ts
    generationRequestSchema.ts

  components/
    InternalTestActivationPanel.tsx
    InternalTestSafetySettings.tsx
    AcademicPeriodGenerationForm.tsx
    DataGenerationScopeForm.tsx
    DataGenerationPreview.tsx
    GenerationJobHistory.tsx
```

Adapt folder naming to the current EduSentrix project structure.

---

### 9.2 Module Inspector Service

The spec requires a module-aware generation layer.

Implementation options:

#### Option A: Static module contracts

Each module exposes a generation contract.

Example:

```ts
export interface ModuleGenerationContract {
  moduleName: string;
  requiredModels: string[];
  requiredRelationships: string[];
  generationOrder: string[];
  validations: string[];
}
```

Each module can define its own contract:

```ts
export const feesGenerationContract = {
  moduleName: "fees",
  requiredModels: ["FeeStructure", "Invoice", "Payment"],
  requiredRelationships: [
    "Invoice.studentId -> Student._id",
    "Invoice.feeStructureId -> FeeStructure._id",
    "Payment.invoiceId -> Invoice._id"
  ],
  generationOrder: ["FeeStructure", "Invoice", "Payment"],
  validations: ["amountDue >= amountPaid", "status matches balances"]
};
```

This is recommended for V1 because it is reliable.

#### Option B: Runtime model introspection

The generator inspects Mongoose schemas at runtime.

This can help identify required fields and refs, but it should not replace explicit module contracts because business logic lives outside schemas.

Recommended approach:

```txt
Use static generation contracts first.
Optionally add runtime schema checks later.
```

---

## 10. Generation Order

The full school generation must follow dependency order.

Recommended order:

```txt
1. Academic periods
2. Grades
3. Class groups
4. Subjects / learning areas
5. Staff roles
6. Teachers
7. Teacher assignments
8. Students
9. Parents / guardians
10. Student-parent links
11. Daily schedules / timetable foundations
12. Curriculum framework references
13. Scheme of work
14. Fee structures
15. Invoices
16. Payments
17. Lesson notes
18. Lessons
19. Flashcards/resources
20. Library books/copies
21. Library loans
22. Vendors/suppliers
23. Inventory/assets
24. Polls
25. Fundraising campaigns
26. Video meeting schedules
27. Notifications/logs
28. Analytics/events
```

Each step must validate that required parent records exist before generating child records.

---

## 11. Email Workaround for Internal Test Schools

The normal UI flow for creating teachers, parents, students, and staff should remain unchanged.

However, for an internal test school, the backend invitation service should bypass email sending.

Create a central helper:

```ts
export function shouldBypassInvitation(school: School) {
  return school.environmentType === "internal_test" &&
    school.internalTestConfig?.suppressEmails === true;
}
```

Use inside invitation service:

```ts
if (shouldBypassInvitation(school)) {
  return createAutoAcceptedTestUser(input);
}

return createInvitedUserAndSendEmail(input);
```

Do not scatter this logic throughout the codebase.

---

## 12. Fake Email Strategy

Generated users should use fake internal addresses.

Recommended domain patterns:

```txt
teacher001@manual-test.edusentrix.local
parent001@manual-test.edusentrix.local
student001@manual-test.edusentrix.local
bursar@manual-test.edusentrix.local
```

or:

```txt
teacher001+school-slug@edusentrix.test
parent001+school-slug@edusentrix.test
student001+school-slug@edusentrix.test
```

No emails should be sent to these addresses.

---

## 13. Login-As / Impersonation for Test Users

Internal test schools should support platform-admin-only impersonation.

Rules:

```ts
currentUser must be platform admin
school.isInternalTestSchool must be true
targetUser.isTestUser must be true
school.internalTestConfig.allowImpersonation must be true
```

Actions must be audit logged.

Audit example:

```txt
Platform admin Joseph Segbefia logged in as JHS Mathematics Teacher in EduSentrix Manual Test Academy.
```

Never allow impersonation of real production users through this internal test tool.

---

## 14. Payment Safety

For internal test schools:

```ts
school.internalTestConfig.forceSandboxPayments === true
```

Payment behaviour:

- Do not initiate live payment collection by default.
- Use sandbox payment references.
- Mark generated payments as sandbox/test payments.
- Prevent settlement/reconciliation jobs from treating test payments as real money.

Generated payment reference example:

```txt
TEST-PAY-2026-000001
```

---

## 15. Notification Safety

For internal test schools:

- Suppress SMS
- Suppress WhatsApp
- Suppress real email
- Store notification records as test logs if needed

Notification records should include:

```ts
isTestNotification: true
wasSuppressed: true
suppressionReason: "Internal test school"
```

---

## 16. API Routes

### 16.1 Activate Internal Test School

```txt
POST /api/platform/schools/:schoolId/internal-test/activate
```

Body:

```ts
{
  adminPassword: string;
  confirmationPhrase: "ENABLE TEST SCHOOL";
  reason: string;
}
```

Response:

```ts
{
  success: true;
  schoolId: string;
  environmentType: "internal_test";
}
```

---

### 16.2 Update Internal Test Config

```txt
PATCH /api/platform/schools/:schoolId/internal-test/config
```

Body:

```ts
{
  suppressEmails?: boolean;
  suppressSms?: boolean;
  suppressWhatsApp?: boolean;
  autoActivateUsers?: boolean;
  allowImpersonation?: boolean;
  forceSandboxPayments?: boolean;
  showTestModeBadge?: boolean;
  allowSeedDataGeneration?: boolean;
}
```

---

### 16.3 Start Generation Job

```txt
POST /api/platform/schools/:schoolId/internal-test/generation-jobs
```

Body:

```ts
{
  mode: "full_school" | "module_specific";
  selectedAcademicPeriods: {
    name: string;
    termNumber?: number;
    startDate: string;
    endDate: string;
    isCurrent: boolean;
  }[];
  modules: Record<string, boolean>;
  requestedCounts: Record<string, number>;
  confirmationPhrase: "GENERATE TEST DATA";
}
```

Validation:

- School must be internal test school.
- Data generation must be enabled.
- Academic periods count must be between 1 and 2.
- Dates must be valid.
- Periods must not overlap.
- At least one module must be selected.
- Confirmation phrase must match.

---

### 16.4 Get Generation Jobs

```txt
GET /api/platform/schools/:schoolId/internal-test/generation-jobs
```

---

### 16.5 Get Generation Job Details

```txt
GET /api/platform/schools/:schoolId/internal-test/generation-jobs/:jobId
```

---

### 16.6 Cancel Generation Job

```txt
POST /api/platform/schools/:schoolId/internal-test/generation-jobs/:jobId/cancel
```

---

### 16.7 Impersonate Test User

```txt
POST /api/platform/schools/:schoolId/internal-test/impersonate
```

Body:

```ts
{
  targetUserId: string;
  reason: string;
}
```

---

## 17. Validation Rules

### 17.1 Activation Validation

- Current user must be platform admin.
- Current user must have `platform.internalTest.manage`.
- `ENABLE_INTERNAL_TEST_TOOLS` must be true.
- Password must match current platform admin account.
- Confirmation phrase must match.
- Reason must be provided.
- School must not already be a real onboarded production client with active subscription unless a superadmin override exists.

### 17.2 Generation Validation

- School must be internal test school.
- Data generation must be enabled for school.
- Max academic periods: 2.
- Period start date must be before end date.
- Periods cannot overlap.
- Exactly one period should be marked current when multiple periods exist.
- Generated current period should align with realistic current/future testing dates.
- Counts must be within safe limits.
- Payment mode must be sandbox.
- Real notifications must be suppressed.

---

## 18. Audit Logging

All sensitive actions must be logged.

Log these events:

```txt
Internal test school activated
Internal test school config updated
Data generation job started
Data generation job completed
Data generation job failed
Data generation job cancelled
Test user impersonated
Email suppressed
SMS suppressed
WhatsApp suppressed
Sandbox payment created
```

Audit log fields:

```ts
{
  actorId: ObjectId;
  actorRole: string;
  schoolId: ObjectId;
  action: string;
  metadata: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}
```

---

## 19. UI/UX Requirements

### 19.1 Premium UI Requirements

The internal test page must feel like the rest of EduSentrix.

Mandatory:

- Use custom EduSentrix date picker for all dates.
- Use premium dropdown for all select fields.
- Use premium modal/dialog for confirmations.
- Use existing Card, Button, Badge, Input, Switch, Tabs, and Toast patterns.
- Use Sonner or existing toast provider for feedback.
- Use consistent spacing, rounded corners, shadows, and glassmorphism tokens.
- Use skeleton loaders for loading states.
- Use empty states for no jobs/no config.
- Use destructive action styling for activation and data generation confirmation.

Forbidden:

- Native unstyled select.
- Native unstyled date input.
- Raw browser confirm dialogs.
- Plain tables without premium styling.
- UI that looks different from the platform admin experience.

### 19.2 Test Mode Badge

When school is internal test, show badge in relevant layouts:

```txt
Internal Test School
```

Suggested placement:

- Platform admin school detail header
- School admin dashboard header
- User impersonation banner

---

## 20. Acceptance Criteria

### Activation

- Platform admin can mark a school as internal test only after password re-authentication.
- Non-platform admins cannot see the page.
- Missing permission returns 403.
- Wrong password fails activation.
- Activation is audit logged.
- School receives internal test config defaults.

### Email Workaround

- Creating users in internal test school does not send real emails.
- Users are marked active and auto-accepted if configured.
- Real schools still send invitations normally.
- Email bypass logic is centralized.

### Test Configuration

- Platform admin can toggle suppress email/SMS/WhatsApp settings.
- Platform admin can enable/disable seed generation.
- Platform admin can force sandbox payments.
- Changes are audit logged.

### Academic Period Setup

- Admin can configure one or two academic periods.
- Admin cannot configure more than two periods.
- Period dates use the custom date picker.
- Invalid date ranges are rejected.
- Overlapping periods are rejected.
- Current period is validated and warned if unrealistic.

### Data Generation

- Platform admin can start a full school data generation job.
- Generation requires confirmation phrase.
- Generation respects selected academic periods.
- Generation produces realistic connected data.
- Generation follows module dependency order.
- Generated users are test users.
- Generated payments are sandbox payments.
- Generated notifications are suppressed/test logs.
- Job logs are visible in the UI.

### Safety

- Real schools cannot accidentally bypass invitations.
- Real notifications are never sent from internal test schools unless explicitly allowed by future superadmin-only override.
- Test data is clearly marked.
- Impersonation works only for test users in internal test schools.

---

## 21. Recommended Build Chunks

### Chunk 1: School Environment Flag + Guard

Build:

- `environmentType`
- `isInternalTestSchool`
- `internalTestConfig`
- internal test guard helpers
- permission checks

Deliverable:

```txt
Backend can identify internal test schools safely.
```

---

### Chunk 2: Activation API + Password Re-authentication

Build:

- activation route
- password verification
- confirmation phrase validation
- environment flag check
- audit logging

Deliverable:

```txt
Platform admin can securely activate internal test mode.
```

---

### Chunk 3: Platform Admin Internal Test Page

Build:

- activation panel
- safety settings panel
- test mode badge
- premium UI components
- custom date picker integration
- premium dropdown integration

Deliverable:

```txt
Platform admin has a protected UI for test school controls.
```

---

### Chunk 4: Email/Invitation Bypass

Build:

- centralized `shouldBypassInvitation()` helper
- auto-accepted test user creation
- invitation service integration
- audit logs for suppressed email

Deliverable:

```txt
Manual test school user creation works without sending email invitations.
```

---

### Chunk 5: Academic Period Generation Form

Build:

- academic period form
- max two periods validation
- date validation
- current/future warning
- preview state

Deliverable:

```txt
Platform admin can define generation periods safely.
```

---

### Chunk 6: Generation Job Model + API

Build:

- job model
- start job route
- job listing
- job details/logs
- cancel route

Deliverable:

```txt
Data generation can be requested and tracked.
```

---

### Chunk 7: Full School Generation Service

Build in dependency order:

- academic periods
- grades
- class groups
- subjects
- teachers
- students
- parents
- fees
- invoices
- payments
- lesson notes
- lessons
- library
- vendors
- polls
- fundraising
- video meetings
- notifications

Deliverable:

```txt
A full connected test school can be generated.
```

---

### Chunk 8: Module Contracts + Validation

Build:

- static module generation contracts
- validation per generated module
- relationship checks
- failure logs

Deliverable:

```txt
Generation becomes module-aware and less fragile.
```

---

### Chunk 9: Impersonation for Test Users

Build:

- test user list
- impersonation endpoint
- impersonation banner
- audit logs
- safe exit impersonation

Deliverable:

```txt
Platform admin can test role dashboards safely.
```

---

### Chunk 10: Cleanup / Reset Tools

Build:

- clear generated data by job ID
- reset test school
- archive test school
- export generation summary

Deliverable:

```txt
Platform admin can clean test data safely.
```

---

## 22. Final Implementation Notes

This feature is powerful and dangerous if poorly protected.

The system must never allow internal test bypasses to leak into real schools.

The most important safety rules are:

```txt
1. Internal test mode must only be activated by platform admins.
2. Activation must require password re-authentication.
3. Email/SMS/WhatsApp/payment bypasses must only apply to internal test schools.
4. Generated users, payments, and notifications must be clearly marked as test data.
5. Data generation must be module-aware and relationship-safe.
6. The UI must use EduSentrix premium components, including the custom date picker and premium dropdown.
```

