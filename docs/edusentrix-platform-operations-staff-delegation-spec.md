# EduSentrix Platform Operations, Staff Roles, Delegation & School Setup Spec

## 1. Purpose

EduSentrix is moving from a single-founder/admin-operated product into a real School OS with multiple internal workers supporting onboarding, implementation, billing, support, school setup, training, and platform operations.

This spec defines how to extend the existing Platform Admin area into a proper **EduSentrix Platform Operations Console** without breaking the current school-side flows.

The system must allow platform admins to:

- Create and invite EduSentrix internal staff.
- Assign human-readable platform permissions.
- Use role presets/job titles for common worker types.
- Delegate specific schools/tasks to staff.
- Create schools directly from the platform side.
- Fully assist schools through setup: academic periods, grades, class groups, subjects, staff, students, parents, schedules, fees, invoices, calendars, payments, curriculum, and go-live readiness.
- Track all actions with immutable audit trails.
- Avoid giving every internal worker full `platform_admin` power.

---

## 2. Current Codebase Context

The current codebase already has a strong foundation in the platform area.

Existing platform routes/pages include:

```txt
src/app/(app)/platform/page.tsx
src/app/(app)/platform/layout.tsx
src/components/platform/PlatformSidebar.tsx
src/app/(app)/platform/schools/page.tsx
src/app/(app)/platform/schools/[id]/page.tsx
src/app/(app)/platform/schools/[id]/onboarding/page.tsx
src/app/(app)/platform/billing/page.tsx
src/app/(app)/platform/billing/tiers/page.tsx
src/app/(app)/platform/billing/usage/page.tsx
src/app/(app)/platform/billing/costs/page.tsx
src/app/(app)/platform/billing/revenue/page.tsx
src/app/(app)/platform/audit/page.tsx
src/app/(app)/platform/applications/page.tsx
src/app/(app)/platform/users/page.tsx
src/app/(app)/platform/settings/page.tsx
```

Existing important models/utilities include:

```txt
src/models/User.ts
src/models/School.ts
src/models/AuditEvent.ts
src/models/PlatformAuditLog.ts
src/models/Delegation.ts
src/models/SchoolSubscription.ts
src/models/SubscriptionTier.ts
src/models/UsageMetric.ts
```

Existing platform access is currently too broad because `src/app/(app)/platform/layout.tsx` primarily checks:

```ts
actor?.role === "platform_admin"
```

This must evolve into permission-based platform staff access while preserving current platform admin access.

---

## 3. Product Principle

Do not make every EduSentrix worker a super admin.

The correct model is:

```txt
Platform Staff Profile
→ Job Title / Role Preset
→ Platform Permissions
→ Optional Delegated School/Task Scope
→ Immutable Audit Trail
```

Permissions define what a staff member can do.

Delegations define where, when, or for whom they are allowed to do it.

Example:

```txt
Ama is an Implementation Specialist.
She has permission to execute school setup.
But she can only execute setup for schools delegated to her.
```

---

## 4. Recommended Platform Worker Job Titles

### 4.1 Executive / Control Roles

#### Platform Owner

Highest-level owner of EduSentrix platform operations.

Can manage:

- Platform staff.
- Billing and subscriptions.
- School lifecycle.
- Feature flags.
- Sensitive platform settings.
- Audit logs.
- Enterprise contracts.

This should be assigned to the founder/primary operator only.

#### Platform Administrator

Senior internal admin with broad operational access.

Can manage:

- Schools.
- Applications.
- Subscriptions.
- Implementation workspaces.
- Support operations.
- Staff invitations, depending on configuration.

Should not necessarily have all owner-level system powers.

#### Platform Operations Manager

Responsible for day-to-day platform operations.

Can oversee:

- School implementation progress.
- Staff tasks.
- Support backlog.
- Go-live readiness.
- Operational reports.

---

### 4.2 Sales / Growth Roles

#### School Success Lead

Owns client relationship after signup and ensures the school succeeds.

Focus areas:

- School onboarding follow-up.
- Usage adoption.
- Training coordination.
- Renewal readiness.
- Client satisfaction.

#### Admissions & Applications Officer

Handles incoming school applications and demo requests.

Can:

- View school applications.
- Approve/reject applications if granted.
- Convert applications into schools.
- Follow up with leads.

#### Sales & Partnerships Officer

Handles school acquisition, partnerships, and growth pipeline.

Can:

- View leads.
- Track demos.
- Record sales notes.
- Hand over signed schools to implementation.

---

### 4.3 Implementation Roles

#### Implementation Manager

Oversees school setup projects.

Can:

- Assign implementation tasks.
- Review setup progress.
- Mark schools ready for go-live.
- Manage implementation specialists.

#### Implementation Specialist

Does hands-on school setup work.

Can, when delegated:

- Configure academic periods.
- Add grades/class groups.
- Add subjects.
- Import teachers/students/parents.
- Set up fees and invoices.
- Prepare timetables/calendars.

#### Data Migration Specialist

Handles bulk uploads and imports.

Can:

- Import students.
- Import parents.
- Import teachers.
- Import fees.
- Validate CSV/Excel files.
- Fix import errors.

#### Academic Setup Specialist

Focuses on academic configuration.

Can configure:

- Curriculum setup.
- Scheme of work.
- Subjects.
- Lesson note setup.
- Academic periods.
- Class schedules.

---

### 4.4 Support Roles

#### Support Agent

Handles school support tickets and communication.

Can:

- View assigned school support requests.
- Respond to schools.
- Add support notes.
- Escalate issues.

#### Technical Support Specialist

Handles technical issues requiring deeper platform knowledge.

Can:

- View diagnostic information.
- Investigate bugs.
- Review logs where permitted.
- Escalate engineering issues.

#### Training Coordinator

Coordinates training sessions for schools.

Can:

- Track training progress.
- Schedule onboarding sessions.
- Mark training milestones complete.
- Record attendance and feedback.

---

### 4.5 Finance / Billing Roles

#### Finance Officer

Manages billing and financial operations.

Can:

- View billing data.
- Manage subscriptions if granted.
- Review payment setup.
- Track school payment readiness.
- Review platform fees and revenue reports.

#### Payment Operations Officer

Focuses on payment setup and transaction operations.

Can:

- Review Paystack setup.
- Review payout proposals.
- Monitor payment readiness.
- Investigate failed payment setup.

---

### 4.6 Governance / Review Roles

#### Platform Auditor

Read-only oversight role.

Can:

- View audit logs.
- View schools.
- View billing summaries if granted.
- Cannot modify operational data.

#### Quality Assurance Reviewer

Reviews school setup before go-live.

Can:

- View implementation workspace.
- Review setup checklist.
- Flag missing setup items.
- Approve or request correction before go-live, if granted.

---

## 5. Platform Permission Registry

### 5.1 Why this is needed

Backend permissions should remain machine-readable:

```txt
platform.schools.read
platform.schools.create
platform.billing.manage
```

But frontend UI should show human-readable names:

```txt
View Schools
Create Schools
Manage Billing
```

Create a single platform permission registry.

Recommended file:

```txt
src/lib/platform/permissions/registry.ts
```

### 5.2 Permission Registry Type

```ts
export type PlatformPermissionRisk = "low" | "medium" | "high" | "critical";

export type PlatformPermissionCategory =
  | "Schools"
  | "Implementation"
  | "EduSentrix Staff"
  | "Billing & Subscriptions"
  | "Payments"
  | "Audit"
  | "Support"
  | "Applications"
  | "System";

export type PlatformPermissionDefinition = {
  key: PlatformPermissionKey;
  label: string;
  description: string;
  category: PlatformPermissionCategory;
  riskLevel: PlatformPermissionRisk;
  assignable: boolean;
};
```

### 5.3 Permission Keys and Human-Readable Labels

#### Schools

| Key | UI Label | Description | Risk |
|---|---|---|---|
| `platform.schools.read` | View Schools | View school list, school profiles, setup status, subscription status, and school metadata. | Low |
| `platform.schools.create` | Create Schools | Create new schools directly from the platform admin dashboard. | High |
| `platform.schools.update` | Update School Details | Edit school profile, contact details, operational metadata, and setup information. | Medium |
| `platform.schools.activate` | Activate Schools | Activate schools and mark them ready/live. | High |
| `platform.schools.suspend` | Suspend Schools | Suspend a school’s access to EduSentrix. Must be audited. | Critical |
| `platform.schools.delete` | Delete Schools | Permanently delete or queue deletion for a school. This should be extremely restricted. | Critical |

#### Implementation / School Setup

| Key | UI Label | Description | Risk |
|---|---|---|---|
| `platform.implementation.read` | View Implementation Workspaces | View school setup workspaces, onboarding checklists, assigned staff, blockers, and go-live readiness. | Low |
| `platform.implementation.manage` | Manage Implementation Workspaces | Update implementation status, setup checklist, go-live readiness, and onboarding notes. | Medium |
| `platform.implementation.assignTasks` | Assign Implementation Tasks | Assign setup tasks to EduSentrix staff. | Medium |
| `platform.implementation.executeSetup` | Execute School Setup | Create school setup data such as academic periods, grades, class groups, subjects, teachers, students, fees, schedules, and invoices. | High |
| `platform.implementation.goLiveReview` | Approve Go-Live Readiness | Mark a school ready for go-live after setup checks. | High |

#### EduSentrix Staff

| Key | UI Label | Description | Risk |
|---|---|---|---|
| `platform.staff.read` | View EduSentrix Staff | View internal EduSentrix staff accounts, roles, permissions, and access status. | Low |
| `platform.staff.invite` | Invite EduSentrix Staff | Invite new EduSentrix workers to the platform operations console. | High |
| `platform.staff.manageRoles` | Manage Staff Roles & Permissions | Change staff roles, permission presets, and custom permissions. | Critical |
| `platform.staff.suspend` | Suspend EduSentrix Staff | Suspend internal staff access. | Critical |

#### Billing & Subscriptions

| Key | UI Label | Description | Risk |
|---|---|---|---|
| `platform.billing.read` | View Billing | View billing overview, school billing status, revenue summaries, and subscription state. | Low |
| `platform.billing.manage` | Manage Billing | Update billing records, billing settings, cost records, and billing operations. | High |
| `platform.subscriptions.manage` | Manage Subscriptions | Assign, renew, cancel, expire, or adjust school subscription plans. | High |
| `platform.paymentSetup.review` | Review Payment Setup | Review school payment setup, bank details, Paystack readiness, and payout proposals. | High |

#### Audit

| Key | UI Label | Description | Risk |
|---|---|---|---|
| `platform.audit.read` | View Audit Logs | View immutable platform audit trails and sensitive operation history. | High |

#### Support

| Key | UI Label | Description | Risk |
|---|---|---|---|
| `platform.support.read` | View Support Requests | View support tickets, email inbox items, school issues, and support history. | Low |
| `platform.support.respond` | Respond to Support Requests | Reply to support requests, update tickets, and manage support communication. | Medium |
| `platform.support.escalate` | Escalate Support Requests | Escalate support issues to technical or operations teams. | Medium |

#### Applications

| Key | UI Label | Description | Risk |
|---|---|---|---|
| `platform.applications.read` | View Applications | View school applications, demo leads, and signup requests. | Low |
| `platform.applications.approve` | Approve Applications | Approve school applications and create schools from applications. | High |
| `platform.applications.reject` | Reject Applications | Reject school applications with an optional reason. | Medium |

#### System

| Key | UI Label | Description | Risk |
|---|---|---|---|
| `platform.system.featureFlags.read` | View Feature Flags | View platform feature flags and rollout settings. | Medium |
| `platform.system.featureFlags.manage` | Manage Feature Flags | Enable/disable platform feature flags. | Critical |
| `platform.system.settings.read` | View Platform Settings | View platform-wide settings. | Medium |
| `platform.system.settings.manage` | Manage Platform Settings | Update platform-wide settings. | Critical |

---

## 6. Role Presets

Create role presets to avoid manually selecting every permission each time.

Recommended file:

```txt
src/lib/platform/permissions/presets.ts
```

### 6.1 Platform Owner

Full access.

Should normally be limited to founder/super owner.

Permissions:

```txt
All platform permissions
```

### 6.2 Platform Administrator

Broad admin access, excluding some owner-only system controls if desired.

Recommended permissions:

```txt
platform.schools.read
platform.schools.create
platform.schools.update
platform.schools.activate
platform.schools.suspend
platform.implementation.read
platform.implementation.manage
platform.implementation.assignTasks
platform.implementation.executeSetup
platform.implementation.goLiveReview
platform.staff.read
platform.staff.invite
platform.billing.read
platform.billing.manage
platform.subscriptions.manage
platform.paymentSetup.review
platform.audit.read
platform.support.read
platform.support.respond
platform.support.escalate
platform.applications.read
platform.applications.approve
platform.applications.reject
```

### 6.3 Platform Operations Manager

Recommended permissions:

```txt
platform.schools.read
platform.schools.update
platform.implementation.read
platform.implementation.manage
platform.implementation.assignTasks
platform.implementation.goLiveReview
platform.support.read
platform.support.escalate
platform.audit.read
```

### 6.4 Implementation Manager

Recommended permissions:

```txt
platform.schools.read
platform.schools.update
platform.implementation.read
platform.implementation.manage
platform.implementation.assignTasks
platform.implementation.executeSetup
platform.implementation.goLiveReview
platform.support.read
platform.audit.read
```

### 6.5 Implementation Specialist

Recommended permissions:

```txt
platform.schools.read
platform.implementation.read
platform.implementation.executeSetup
platform.support.read
```

This role should usually require active delegation before modifying a school.

### 6.6 Data Migration Specialist

Recommended permissions:

```txt
platform.schools.read
platform.implementation.read
platform.implementation.executeSetup
```

May be limited to import-related tasks through delegation scope.

### 6.7 Academic Setup Specialist

Recommended permissions:

```txt
platform.schools.read
platform.implementation.read
platform.implementation.executeSetup
platform.implementation.manage
```

### 6.8 Support Agent

Recommended permissions:

```txt
platform.schools.read
platform.support.read
platform.support.respond
```

### 6.9 Technical Support Specialist

Recommended permissions:

```txt
platform.schools.read
platform.support.read
platform.support.respond
platform.support.escalate
platform.audit.read
```

### 6.10 Training Coordinator

Recommended permissions:

```txt
platform.schools.read
platform.implementation.read
platform.implementation.manage
platform.support.read
```

### 6.11 Finance Officer

Recommended permissions:

```txt
platform.schools.read
platform.billing.read
platform.billing.manage
platform.subscriptions.manage
platform.paymentSetup.review
platform.audit.read
```

### 6.12 Payment Operations Officer

Recommended permissions:

```txt
platform.schools.read
platform.billing.read
platform.paymentSetup.review
platform.audit.read
```

### 6.13 Applications Officer

Recommended permissions:

```txt
platform.schools.read
platform.applications.read
platform.applications.approve
platform.applications.reject
```

### 6.14 Platform Auditor

Recommended permissions:

```txt
platform.schools.read
platform.billing.read
platform.audit.read
```

### 6.15 Custom Role

Allows the platform owner/admin to manually select permissions.

Must show warnings for high-risk and critical permissions.

---

## 7. Platform Staff Data Model

Do not overload school-side staff or teacher models for EduSentrix internal workers.

Add:

```txt
src/models/PlatformStaffProfile.ts
```

Recommended schema:

```ts
import mongoose, { Schema, Types } from "mongoose";

export type PlatformStaffRolePreset =
  | "platform_owner"
  | "platform_admin"
  | "platform_operations_manager"
  | "implementation_manager"
  | "implementation_specialist"
  | "data_migration_specialist"
  | "academic_setup_specialist"
  | "support_agent"
  | "technical_support_specialist"
  | "training_coordinator"
  | "finance_officer"
  | "payment_operations_officer"
  | "applications_officer"
  | "platform_auditor"
  | "custom";

export type PlatformStaffStatus = "invited" | "active" | "suspended";

export type PlatformStaffProfile = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  clerkUserId?: string;
  email: string;
  fullName: string;
  jobTitle: string;
  rolePreset: PlatformStaffRolePreset;
  permissions: string[];
  status: PlatformStaffStatus;
  accessMode: "all_schools" | "delegated_only";
  invitedByUserId?: Types.ObjectId;
  invitedAt?: Date;
  suspendedByUserId?: Types.ObjectId;
  suspendedAt?: Date;
  suspensionReason?: string;
  createdAt: Date;
  updatedAt: Date;
};
```

Important:

- `User` remains the identity/user account record.
- `PlatformStaffProfile` holds platform-specific role, permissions, and status.
- Existing `User.role === "platform_admin"` should still work temporarily for backward compatibility.
- New code should prefer `PlatformStaffProfile` permissions.

---

## 8. Platform Staff APIs

### 8.1 List Staff

```txt
GET /api/platform/staff
```

Required permission:

```txt
platform.staff.read
```

Response includes:

```ts
{
  staff: Array<{
    id: string;
    userId: string;
    fullName: string;
    email: string;
    jobTitle: string;
    rolePreset: string;
    status: string;
    accessMode: string;
    permissionCount: number;
    lastActiveAt?: string;
  }>;
}
```

### 8.2 Invite Staff

```txt
POST /api/platform/staff/invite
```

Required permission:

```txt
platform.staff.invite
```

Payload:

```ts
{
  fullName: string;
  email: string;
  phone?: string;
  jobTitle: string;
  rolePreset: PlatformStaffRolePreset;
  permissions: string[];
  accessMode: "all_schools" | "delegated_only";
}
```

Behavior:

1. Validate permission keys against registry.
2. Validate current actor can assign selected permissions.
3. Create or update local `User`.
4. Create `PlatformStaffProfile`.
5. Send Clerk invitation.
6. Write immutable audit event.

### 8.3 Read Staff Detail

```txt
GET /api/platform/staff/[id]
```

Required permission:

```txt
platform.staff.read
```

### 8.4 Update Staff Permissions

```txt
PATCH /api/platform/staff/[id]/permissions
```

Required permission:

```txt
platform.staff.manageRoles
```

Payload:

```ts
{
  rolePreset: PlatformStaffRolePreset;
  permissions: string[];
  accessMode: "all_schools" | "delegated_only";
  reason: string;
}
```

Rules:

- Reason is required.
- High-risk permission changes must show frontend warning.
- Critical permission assignment must require confirmation phrase.
- Backend must reject invalid keys.
- Write audit event with before/after permissions.

### 8.5 Suspend Staff

```txt
POST /api/platform/staff/[id]/suspend
```

Required permission:

```txt
platform.staff.suspend
```

Payload:

```ts
{
  reason: string;
}
```

Behavior:

- Set status to `suspended`.
- Revoke/disable platform access.
- Write audit event.

### 8.6 Reactivate Staff

```txt
POST /api/platform/staff/[id]/reactivate
```

Required permission:

```txt
platform.staff.manageRoles
```

---

## 9. Platform Permission Guards

Add reusable guards.

Recommended files:

```txt
src/lib/platform/auth/require-platform-user.ts
src/lib/platform/auth/require-platform-permission.ts
src/lib/platform/auth/has-platform-permission.ts
src/lib/platform/auth/require-platform-delegation.ts
```

### 9.1 Backward Compatibility

Current platform admins with `User.role === "platform_admin"` should continue working.

Temporary rule:

```ts
if (user.role === "platform_admin" && !staffProfile) {
  return allowAsLegacyPlatformAdmin();
}
```

Long-term:

- Migrate platform admins into `PlatformStaffProfile`.
- Keep a `platform_owner` role preset for the main owner.

### 9.2 Permission Check

```ts
await requirePlatformPermission("platform.schools.create");
```

Should:

1. Authenticate Clerk user.
2. Load local `User`.
3. Load `PlatformStaffProfile`.
4. Ensure status is `active`.
5. Ensure permission exists.
6. Return actor context.

---

## 10. Platform Delegations

Keep the existing school-side Delegations module.

Add a separate platform delegation model because platform delegation is cross-school/operations-specific.

Recommended file:

```txt
src/models/PlatformDelegation.ts
```

### 10.1 Platform Delegation Model

```ts
export type PlatformDelegationScope =
  | "school_implementation"
  | "payment_setup_review"
  | "support_case"
  | "billing_follow_up"
  | "training"
  | "data_import"
  | "academic_setup"
  | "technical_investigation";

export type PlatformDelegationStatus = "active" | "expired" | "revoked";

export type PlatformDelegation = {
  _id: Types.ObjectId;
  schoolId?: Types.ObjectId;
  taskId?: Types.ObjectId;
  staffUserId: Types.ObjectId;
  assignedByUserId: Types.ObjectId;
  scope: PlatformDelegationScope;
  permissions: string[];
  startsAt: Date;
  expiresAt?: Date;
  status: PlatformDelegationStatus;
  reason?: string;
  revokedAt?: Date;
  revokedByUserId?: Types.ObjectId;
  revokeReason?: string;
  createdAt: Date;
  updatedAt: Date;
};
```

### 10.2 Delegation Rule

For high-impact school setup actions:

```txt
Permission + Delegation required
```

Example:

```ts
hasPermission("platform.implementation.executeSetup")
&& hasActiveDelegation(staffUserId, schoolId, "school_implementation")
```

Exception:

- `platform_owner`
- `platform_admin`
- explicitly configured `accessMode = all_schools`

### 10.3 Delegation APIs

```txt
GET    /api/platform/delegations
POST   /api/platform/delegations
PATCH  /api/platform/delegations/[id]
POST   /api/platform/delegations/[id]/revoke
```

### 10.4 Delegation UI

Pages:

```txt
/platform/delegations
/platform/schools/[id]/delegations
/platform/staff/[id]/delegations
```

UI should show:

- Staff member.
- School/task scope.
- Delegation type.
- Start/end dates.
- Status.
- Reason.
- Assigned by.

Use custom date picker for start/end dates.
Use premium dropdowns for staff, school, scope, and permission selection.

---

## 11. Platform Tasks

Add a platform task system for assigning work to EduSentrix staff.

Recommended file:

```txt
src/models/PlatformTask.ts
```

### 11.1 Model

```ts
export type PlatformTaskCategory =
  | "school_onboarding"
  | "data_import"
  | "academic_setup"
  | "payment_setup"
  | "subscription"
  | "support"
  | "training"
  | "bug_investigation"
  | "client_follow_up"
  | "custom";

export type PlatformTaskStatus =
  | "todo"
  | "in_progress"
  | "blocked"
  | "in_review"
  | "done"
  | "cancelled";

export type PlatformTask = {
  _id: Types.ObjectId;
  schoolId?: Types.ObjectId | null;
  title: string;
  description?: string;
  category: PlatformTaskCategory;
  priority: "low" | "normal" | "high" | "urgent";
  status: PlatformTaskStatus;
  assignedToUserId?: Types.ObjectId | null;
  assignedByUserId: Types.ObjectId;
  dueAt?: Date | null;
  relatedEntityType?: string | null;
  relatedEntityId?: Types.ObjectId | null;
  checklist?: Array<{
    id: string;
    label: string;
    completed: boolean;
    completedAt?: Date;
    completedByUserId?: Types.ObjectId;
  }>;
  createdAt: Date;
  updatedAt: Date;
};
```

### 11.2 Task Pages

```txt
/platform/tasks
/platform/tasks/[id]
/platform/schools/[id]/tasks
```

### 11.3 Required Actions

- Create task.
- Assign/reassign task.
- Change status.
- Add comments.
- Complete checklist item.
- Mark blocked with reason.
- Mark done.

Every action must write audit event.

---

## 12. Direct School Creation From Platform Admin

Add a direct school creation path.

### 12.1 Page

```txt
/platform/schools/new
```

### 12.2 API

```txt
POST /api/platform/schools
```

Required permission:

```txt
platform.schools.create
```

### 12.3 Form Fields

Use premium form styling.

Sections:

#### School Details

- School name.
- School type.
- Curriculum.
- Address.
- City.
- Region.
- School email.
- School phone.
- Website optional.
- GES code optional.

#### Primary School Admin

- Full name.
- Email.
- Phone.
- Job title.

#### Subscription / Trial

- Trial.
- Pilot.
- Paid plan.
- Enterprise/custom.
- Start date.
- Expected go-live date.

#### Implementation Assignment

- Assigned implementation owner.
- Setup priority.
- Notes.

### 12.4 Shared School Creation Service

Do not duplicate application approval logic.

Extract shared service:

```txt
src/lib/platform/schools/create-school-from-platform.ts
```

It should handle:

- Creating School.
- Creating/updating primary admin User.
- Creating school membership/role if applicable.
- Creating default subscription/trial/pilot.
- Creating implementation project.
- Creating setup task checklist.
- Sending admin invitation.
- Writing audit events.

Update application approval later to use the same service.

---

## 13. School Implementation Workspace

Add:

```txt
/platform/schools/[id]/implementation
```

This is the platform-side workspace for setting up a school.

### 13.1 Main Sections

```txt
Overview
School Profile
Academic Setup
People
Class Structure
Schedules & Timetable
Fees & Invoices
Payments
Curriculum & Scheme
Communication
Review & Go Live
Audit Trail
```

### 13.2 Implementation Project Model

Recommended file:

```txt
src/models/SchoolImplementationProject.ts
```

Model:

```ts
export type SchoolImplementationStatus =
  | "not_started"
  | "in_progress"
  | "blocked"
  | "ready_for_review"
  | "ready_for_go_live"
  | "completed";

export type SchoolImplementationProject = {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  status: SchoolImplementationStatus;
  assignedOwnerUserId?: Types.ObjectId;
  startDate?: Date;
  targetGoLiveDate?: Date;
  completedAt?: Date;
  checklist: Array<{
    key: string;
    label: string;
    status: "pending" | "in_progress" | "done" | "blocked";
    assignedToUserId?: Types.ObjectId;
    completedAt?: Date;
    completedByUserId?: Types.ObjectId;
  }>;
  createdAt: Date;
  updatedAt: Date;
};
```

### 13.3 Default Checklist

When a school is created, generate:

```txt
Confirm school profile
Set subscription/trial/pilot
Create academic year and current term
Create grades
Create class groups
Create subjects
Add school admins
Add teachers
Assign teachers to subjects/class groups
Add students
Link parents/guardians
Create school daily schedule
Create class schedules/timetable basics
Set up fees
Generate invoices if required
Review payment setup
Prepare communication templates
Run go-live checks
Mark school ready for go-live
```

---

## 14. Platform-Assisted Setup Rules

### 14.1 Use Existing Business Logic

Platform setup must not bypass existing validation.

If school admin and platform admin can both create students, they should use the same shared service where possible.

Preferred pattern:

```txt
src/lib/students/create-student.ts
src/lib/teachers/create-teacher.ts
src/lib/fees/create-fee-structure.ts
src/lib/academic-periods/create-academic-period.ts
```

If such services do not exist, create them when building platform-assisted workflows.

### 14.2 Add Actor Metadata

Every platform-assisted creation should record:

```ts
createdByUserId
createdByActorType: "platform_staff"
createdVia: "platform_implementation_workspace"
```

Where model schemas do not support these fields, write audit events.

### 14.3 No Silent Validation Bypass

Platform flows must validate:

- Required fields.
- School scoping.
- Academic period dates.
- Class group/grade relationships.
- Teacher assignment conflicts.
- Fee due dates.
- Invoice generation rules.
- Timetable conflicts.
- Payment setup requirements.

---

## 15. Platform Staff UI Requirements

### 15.1 Staff List Page

Route:

```txt
/platform/staff
```

Must include:

- Search.
- Filter by status.
- Filter by role preset.
- Staff cards/table.
- Permission count.
- Access mode.
- Last active date.
- Invite staff button.

### 15.2 Staff Invite/Create Page

Route:

```txt
/platform/staff/new
```

Form steps:

1. Staff details.
2. Job title / role preset.
3. Permissions.
4. Access scope.
5. Review and invite.

### 15.3 Human-Readable Permission UI

Permissions must be grouped by category.

Use UI like:

```txt
Schools
☑ View Schools
☐ Create Schools
☐ Update School Details
☐ Activate Schools
☐ Suspend Schools    Critical
```

For high-risk/critical permissions:

- Show risk badge.
- Show warning copy.
- Require confirmation phrase for critical permissions.

### 15.4 Access Scope UI

Options:

```txt
All schools
Delegated schools only
Assigned support cases only
```

Default for implementation specialists should be:

```txt
Delegated schools only
```

---

## 16. Platform Sidebar Updates

Update:

```txt
src/components/platform/PlatformSidebar.tsx
```

Add under Operations:

```txt
Staff
Tasks
Delegations
Implementation
```

Or structure as:

```txt
Operations
- Implementation
- Tasks
- Staff
- Delegations
- Email Inbox
- Email Templates
- Webhooks
- Audit Logs
```

Menu items should be hidden if the current staff member lacks required permissions.

---

## 17. Audit Requirements

All platform operations must write append-only audit events.

Use existing audit infrastructure:

```txt
src/models/AuditEvent.ts
src/models/PlatformAuditLog.ts
writeTransactionalAuditEvent
buildPlatformAdminAuditContext
```

### 17.1 Required Audit Actions

#### Staff

```txt
platform.staff.invited
platform.staff.permissions_changed
platform.staff.role_changed
platform.staff.suspended
platform.staff.reactivated
```

#### Delegations

```txt
platform.delegation.created
platform.delegation.updated
platform.delegation.revoked
platform.delegation.expired
```

#### Tasks

```txt
platform.task.created
platform.task.assigned
platform.task.status_changed
platform.task.comment_added
platform.task.checklist_completed
platform.task.completed
```

#### School Setup

```txt
platform.school.created
platform.school.profile_updated
platform.school.academic_period_created
platform.school.grade_created
platform.school.class_group_created
platform.school.subject_created
platform.school.teacher_created
platform.school.student_created
platform.school.parent_created
platform.school.fee_structure_created
platform.school.invoice_generated
platform.school.schedule_created
platform.school.payment_setup_updated
platform.school.go_live_approved
```

### 17.2 Audit Event Must Include

```ts
{
  actorUserId: string;
  actorRole: string;
  actionCode: string;
  domain: "platform";
  entityType: string;
  entityId: string;
  schoolId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
}
```

Audit records must not be updated or deleted.

---

## 18. Security Rules

### 18.1 Least Privilege

Staff should receive the minimum permissions required for their role.

### 18.2 Critical Permission Confirmation

Critical permissions require:

- Explicit UI warning.
- Confirmation phrase.
- Audit event.

Examples:

```txt
platform.schools.suspend
platform.schools.delete
platform.staff.manageRoles
platform.staff.suspend
platform.system.featureFlags.manage
platform.system.settings.manage
```

### 18.3 Delegation Required for Setup Execution

For delegated-only staff:

```txt
platform.implementation.executeSetup + active school delegation required
```

### 18.4 No Hidden Super Admins

Do not grant platform-wide access accidentally by checking only `User.role` forever.

Use `PlatformStaffProfile` and permissions.

### 18.5 Staff Suspension

Suspended staff must lose platform access immediately.

---

## 19. UI/UX Standards

All platform operations UI must match EduSentrix premium platform style.

Use:

- Existing premium cards.
- Premium dropdown/select components.
- Custom date picker for dates.
- Sonner toasts.
- Responsive modal/drawer patterns.
- Confirmation dialogs for destructive actions.
- Skeleton loaders.
- Empty states.
- Status badges.
- Risk badges.

Do not use raw unstyled `<select>`, `<input>`, or plain HTML tables where premium components already exist.

---

## 20. Implementation Phases

### Phase 1: Permission Registry and Guards

Build:

```txt
Platform permission registry
Human-readable labels/descriptions
Role presets
Permission guards
Legacy platform_admin compatibility
```

Verification:

- Platform owner can access all platform pages.
- Staff without permission cannot access protected pages.
- Sidebar hides inaccessible items.

### Phase 2: Platform Staff Profiles

Build:

```txt
PlatformStaffProfile model
Staff list page
Staff invite page
Staff detail page
Staff suspend/reactivate
Staff permission update
```

Verification:

- Staff can be invited.
- Permissions can be assigned from human-readable UI.
- Critical permission changes are audited.
- Suspended staff cannot access platform area.

### Phase 3: Platform Delegations

Build:

```txt
PlatformDelegation model
Delegation list/detail
School-specific delegation view
Delegation enforcement for setup execution
```

Verification:

- Delegated-only staff cannot modify unassigned schools.
- Active delegation allows permitted setup actions.
- Revoked delegation immediately blocks access.

### Phase 4: Platform Tasks

Build:

```txt
PlatformTask model
Task list/detail
School task view
Assignment/status/checklist/comments
```

Verification:

- Tasks can be assigned.
- Staff see assigned tasks.
- Task changes are audited.

### Phase 5: Direct School Creation

Build:

```txt
/platform/schools/new
POST /api/platform/schools
shared create-school service
implementation project auto-creation
default tasks/checklist
```

Verification:

- Platform admin can create school without application.
- School admin invite is created/sent.
- School appears in school portfolio.
- Audit event is written.

### Phase 6: Implementation Workspace

Build:

```txt
/platform/schools/[id]/implementation
Overview
Profile
Academic Setup
People
Class Structure
Schedules
Fees
Payments
Go-Live Review
Audit Trail
```

Verification:

- Workspace shows setup progress.
- Staff can execute only permitted/delegated actions.
- Setup actions use school-scoped validation.
- Go-live checklist prevents incomplete activation.

### Phase 7: Platform Import Center

Build import workflows for:

```txt
Students
Parents
Teachers
Subjects
Fees
```

Verification:

- Upload.
- Map columns.
- Validate.
- Preview.
- Confirm.
- Error report.
- Audit logs.

### Phase 8: Training, Support, and School Health

Build later:

```txt
Training tracker
Support tickets
School health score
Usage/adoption monitoring
```

---

## 21. Completion Verification Checklist

Development is not complete until all of these pass.

### Permissions

- [ ] Platform permission registry exists.
- [ ] Permissions have human-readable labels.
- [ ] Permissions have descriptions.
- [ ] Permissions have categories.
- [ ] Permissions have risk levels.
- [ ] Backend validates permission keys.
- [ ] Sidebar is permission-aware.
- [ ] Routes are permission-protected.

### Staff

- [ ] PlatformStaffProfile model exists.
- [ ] Staff can be invited.
- [ ] Staff can be assigned role preset.
- [ ] Staff can be assigned custom permissions.
- [ ] Staff can be suspended.
- [ ] Suspended staff cannot access platform.
- [ ] Staff permission changes are audited.

### Delegation

- [ ] PlatformDelegation model exists.
- [ ] Delegations can be created.
- [ ] Delegations can expire/revoke.
- [ ] Delegated-only staff are blocked from unassigned schools.
- [ ] Delegation actions are audited.

### Tasks

- [ ] PlatformTask model exists.
- [ ] Tasks can be assigned.
- [ ] Tasks support status and priority.
- [ ] Tasks support checklist.
- [ ] Task changes are audited.

### Direct School Creation

- [ ] Platform can create school directly.
- [ ] Created school gets primary admin.
- [ ] Subscription/trial/pilot can be assigned.
- [ ] Implementation project is created.
- [ ] Audit events are written.

### Implementation Workspace

- [ ] School setup workspace exists.
- [ ] Academic setup can be assisted.
- [ ] People setup can be assisted.
- [ ] Fees setup can be assisted.
- [ ] Schedule setup can be assisted.
- [ ] Payment setup can be reviewed.
- [ ] Go-live checklist exists.
- [ ] Workspace uses premium UI.

### Audit

- [ ] All sensitive actions write audit events.
- [ ] Audit logs are append-only.
- [ ] Audit logs include actor, entity, action, before/after where relevant.

### UI

- [ ] Human-readable permissions shown in staff creation.
- [ ] Permission groups are clearly separated.
- [ ] Risk badges appear for high/critical permissions.
- [ ] Custom date picker is used for dates.
- [ ] Premium dropdowns are used for selects.
- [ ] Raw unstyled controls are avoided.

---

## 22. Final Architecture Summary

The final platform operations architecture should be:

```txt
Platform Staff Profile
→ Role Preset / Job Title
→ Human-readable permissions UI
→ Machine-readable backend permissions
→ Optional school/task delegation
→ Platform tasks
→ School implementation workspace
→ Immutable audit logs
```

This allows EduSentrix to grow from founder-operated admin control into a real internal operations system where staff can safely help onboard and support schools without being given unnecessary super-admin power.

