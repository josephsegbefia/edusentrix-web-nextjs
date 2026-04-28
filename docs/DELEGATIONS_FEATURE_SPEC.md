# EduSentrix Delegations Feature Spec

## 1. Purpose

Delegations let a school admin grant selected staff members access to specific admin modules without making them full admins.

The goal is to make delegation simple, safe, and auditable:

- Admins remain the owners of the school workspace.
- Delegates see only the modules and actions granted to them.
- Admins can revoke access at any time.
- Every delegated action is recorded in an audit trail.
- High-risk modules are excluded from delegation for now.

This spec replaces the narrow admissions-only delegation model with a platform-wide delegation system while preserving admissions as one supported module.

## 2. Non-Goals For This Phase

Do not delegate these modules or capabilities yet:

- Payment Setup
- Reconciliation
- Settings
- Disbursements
- Subscription
- Billing ownership
- Delegate management itself
- Role and permission management
- Core finance approval and release controls
- Audit log deletion or modification

These should remain admin-only until the access-control system has matured.

## 3. User Roles

### School Admin

The school admin can:

- Create delegations.
- Edit delegations.
- Revoke delegations.
- View all delegated actions.
- See all module activity, whether performed by an admin or delegate.
- Use the same modules as before with full admin authority.

### Delegate

A delegate is usually a teacher or staff member.

The delegate can:

- See delegated modules in their side nav.
- Access only granted modules.
- Perform only granted actions.
- See a clear indication that they are acting as a delegate.

The delegate cannot:

- Grant access to another user.
- Revoke their own delegation.
- Access excluded modules.
- Escalate their own permissions.
- Hide or delete audit history.

### Eligible staff (delegation targets)

Only **active** school members with these **`MembershipRole`** values may receive a delegation:

- `teacher`
- `staff`

Do **not** offer delegation for `parent`, `student`, `school_admin`, or `billing_owner`. (`school_admin` already has full access; they do not need delegations.)

### Teacher subroles removed (platform-wide)

**Subroles** on `UserMembership` and `Teacher` (e.g. homeroom, exam officer, admissions officer) are **removed from authorization entirely**. No `require*` helper or gate may read `subroles` for access decisions.

- **Admin-adjacent modules** in this spec: access is **`school_admin`** **or** an **active `Delegation`** whose `permissions[]` includes the required action.
- **Capabilities that previously depended only on a subrole** must be **re-homed**: default them into **baseline `teacher` / `staff` behavior** where low-risk, move them behind an appropriate **delegation module + preset**, or keep them **`school_admin` only** until a module exists.
- **Data:** migration may **clear** legacy `subroles` fields or leave them unused; they are **not** part of RBAC going forward.

**Implementation (teacher RBAC):** `resolvePermissions` grants capabilities from **membership roles only**; subroles are not merged into `permissions[]`. Baseline **`teacher`** includes the former low-risk subrole capabilities (homeroom attendance, gradebook publish/lock/export, at-risk analytics, etc.) **except** `admissions.manage`, which stays **`school_admin` or `Delegation` only**. `requireTeacher` may still attach `subroles` to context for UI/diagnostics; they must not drive gates. Admissions **weekly digest** recipients include users with an active **`admissions` delegation** as well as legacy `admissions_officer` membership rows.

## 4. Delegation Levels

Delegation should support module-level presets first, with action-level permissions underneath.

### Level 1: Safe To Delegate Broadly

These modules can be offered early with practical presets:

- Admissions
- Polls
- Fundraising
- Meetings
- Academic Calendar
- Documents
- Supply Programs
- School Store
- Reports, read/export only

### Level 2: Delegate With Scoped Permissions

These modules may be delegated, but only with narrower presets:

- Students
- Grades
- Subjects
- Curriculum
- Timetable Hub
- Academic Periods
- Promotions
- Staff Attendance
- Invitations
- Email
- Fees & Payments, limited actions only
- Expenses, limited actions only

### Level 3: Admin-Only For Now

These modules or actions must not appear in the delegation UI in this phase:

- Payment Setup
- Reconciliation
- Settings
- Disbursements
- Subscription
- Billing ownership
- Delegate management
- Finance final approvals
- Payment reversal approval
- Fee waiver approval
- System email configuration

## 5. Delegatable Modules And Initial Presets

Each module must expose one or more permission presets. Avoid presenting admins with dozens of checkboxes at first.

**Advanced permissions:** Per-action toggles or an “Advanced permissions” disclosure are **out of scope for the initial release**. Only **presets** defined in the registry are valid until a later phase explicitly adds advanced editing (see §26 Acceptance Criteria).

### Admissions

Presets:

- Viewer: view cycles, applications, documents, and timelines.
- Reviewer: viewer plus notes, status updates, document requests, tracker resend, interview scheduling.
- Manager: reviewer plus form edits and public cycle operations.
- Decision maker: manager plus accept, reject, waitlist, and provision actions.

Actions:

- `admissions.view`
- `admissions.comment`
- `admissions.change_status`
- `admissions.send_email`
- `admissions.request_document`
- `admissions.request_payment`
- `admissions.schedule_interview`
- `admissions.manage_form`
- `admissions.manage_cycle`
- `admissions.decide`
- `admissions.provision_student`
- `admissions.export`

### Polls

Presets:

- Viewer: view polls and results.
- Manager: create, edit, publish, close, export.

Actions:

- `polls.view`
- `polls.create`
- `polls.edit`
- `polls.publish`
- `polls.close`
- `polls.export`

### Fundraising

Presets:

- Viewer: view campaigns and donations.
- Campaign manager: create, edit, publish, post updates, export donations.

Actions:

- `fundraising.view`
- `fundraising.create`
- `fundraising.edit`
- `fundraising.publish`
- `fundraising.close`
- `fundraising.post_update`
- `fundraising.export`

### Meetings

Presets:

- Viewer: view meetings.
- Organizer: create, edit, start, cancel, invite attendees.

Actions:

- `meetings.view`
- `meetings.create`
- `meetings.edit`
- `meetings.start`
- `meetings.cancel`
- `meetings.invite`

### Academic Calendar

Presets:

- Viewer: view calendar.
- Editor: create and edit school events.

Actions:

- `calendar.view`
- `calendar.create`
- `calendar.edit`
- `calendar.delete`
- `calendar.notify`

### Documents

Presets:

- Viewer: view shared documents.
- Manager: upload, categorize, share, archive.

Actions:

- `documents.view`
- `documents.upload`
- `documents.edit`
- `documents.share`
- `documents.archive`
- `documents.export`

### Supply Programs

Presets:

- Viewer: view programs and requests.
- Manager: create programs, review requests, update fulfillment status.

Actions:

- `supplies.view`
- `supplies.create_program`
- `supplies.edit_program`
- `supplies.review_request`
- `supplies.update_fulfillment`
- `supplies.export`

### School Store

Presets:

- Viewer: view products and orders.
- Store operator: manage products and process orders.

Actions:

- `store.view`
- `store.manage_products`
- `store.process_orders`
- `store.update_order_status`
- `store.export`

### Reports

Presets:

- Viewer: view dashboards and reports.
- Exporter: view and export reports.

Actions:

- `reports.view`
- `reports.export`

### Staff Attendance

Presets:

- Viewer: view attendance.
- Recorder: mark attendance and add notes.

Actions:

- `staff_attendance.view`
- `staff_attendance.record`
- `staff_attendance.edit`
- `staff_attendance.export`

### Invitations

Presets:

- Viewer: view invitations.
- Sender: send and resend invitations (cannot revoke).
- Coordinator: viewer plus **revoke** invitations (higher impact; use sparingly).

Actions:

- `invitations.view`
- `invitations.send`
- `invitations.resend`
- `invitations.revoke` (included only in **Coordinator** preset, not **Sender**)

### Fees & Payments

Presets:

- Viewer: view fee records and invoices.
- Assistant: send reminders, record offline payments, export.

Excluded in this phase:

- payment setup
- waivers
- reversals
- final approvals
- payout or settlement controls

Actions:

- `fees.view`
- `fees.send_reminder`
- `fees.record_payment`
- `fees.export`

### Expenses

Presets:

- Viewer: view expenses.
- Recorder: create expense records and upload receipts.

Excluded in this phase:

- approve expense
- mark paid
- reject expense
- disbursement release

Actions:

- `expenses.view`
- `expenses.create`
- `expenses.upload_receipt`
- `expenses.export`

## 6. Routing and delegate URLs

Delegates must never guess URLs. The **delegation registry** is the single source of truth for:

- **`href`** (or `adminHref` / `delegateHref` if the product intentionally uses two entry points)

**Rules:**

1. The **teacher sidebar “Delegated”** section must use the **`href`** (or `delegateHref`) from the registry **only**.
2. If a module today has both an admin route (e.g. `/admin/admissions`) and a staff route (e.g. `/teacher/admissions`), the registry **must** document which path delegates use, and implementation must **not** mix undocumented conventions.
3. Prefer **one canonical surface per module**: either delegates use the **same** `/admin/...` routes with a delegate banner and `requireSchoolAdminOrDelegatedPermission`, **or** a dedicated `/teacher/...` tree—pick per module and record it in the registry’s **routing matrix** (table or fields on each module).
4. Server authorization **always** checks permissions; the URL prefix is a UX concern only.

## 7. Information Architecture

### New Admin Page

Add a dedicated page:

`/admin/delegations`

This page is the source of truth for all delegation management.

It should be added to the admin sidebar under the People or System section. Recommended label:

`Delegations`

### Contextual Module Entry Points

Eligible module pages may show a contextual button:

`Delegate access`

This button must open the same delegation flow with the current module preselected. It must not implement a separate module-specific delegation system.

Examples:

- `/admin/admissions` opens the flow with Admissions selected.
- `/admin/community/polls` opens the flow with Polls selected.
- `/admin/fees` opens the flow with Fees & Payments selected.

Do not show this button on excluded modules.

## 8. UI Design Principles

The delegation flow must feel simple, calm, and non-intimidating.

Use the existing app visual language:

- Dark platform/admin surface.
- Opaque cards and panels, not transparent panels.
- 8px or modest border radius unless matching an existing component.
- Clear section labels.
- Short explanations.
- No wall of permission checkboxes on first view.
- Use icons where they clarify module types or actions.
- Keep destructive actions visually distinct.

### Required Components

Use:

- `PremiumSelect`, `PremiumSelectTrigger`, `PremiumSelectContent`, `PremiumSelectItem`, and `PremiumSelectValue` for dropdowns.
- `CustomDatePicker` for expiry dates and any future date inputs.
- Existing `Button`, `Badge`, `Input`, `Textarea`, `Dialog`, `Sheet`, and table/list components.

Do not use native `<select>` for the delegation flow.

Do not use native date inputs.

## 9. Delegations Page UI

### Page Header

Header content:

- Title: `Delegations`
- Subtitle: `Give trusted staff access to specific work areas without making them admins.`
- Primary action: `Add delegation`

Header should include a compact summary row:

- Active delegations
- Expiring soon
- Revoked this month
- Recent delegated actions

### Main Layout

Use a two-column layout on desktop:

- Left/main: active delegations list.
- Right: recent delegated activity.

On mobile, stack these sections vertically.

### Active Delegations List

Each delegation row/card should show:

- Staff avatar or initials.
- Staff name.
- Staff role, usually Teacher or Staff.
- Module name.
- Permission preset.
- Status badge: Active, Expiring soon, Expired, Revoked.
- Expiry date if set.
- Granted by.
- Last activity timestamp.
- Actions menu: View, Edit, Revoke.

Avoid dense permission text in the row. Show the preset first. Full action permissions live in the detail panel.

### Filters

Use `PremiumSelect` for:

- Module filter.
- Status filter.
- Staff filter if needed.

Use search input for staff name/email.

Use `CustomDatePicker` if adding date-based filtering.

### Empty State

Text:

`No delegations yet`

Supporting text:

`Start by giving a trusted staff member access to one work area, such as Admissions or Polls.`

Primary action:

`Add delegation`

## 10. Add Delegation Flow

Use a modal or side sheet. Recommended: modal for first version because it is short and focused.

The flow should be one screen with progressive sections, not a long wizard.

### Step 1: Choose Staff Member

Fields:

- Staff member: `PremiumSelect`

Options should show:

- Name
- Email
- Role

Only eligible active staff should appear. Inactive users should not be selectable.

### Step 2: Choose Module

Field:

- Module: `PremiumSelect`

Only delegatable modules should appear.

If opened from a module page, preselect that module.

Show a short plain-language hint under the selected module:

`This gives access only to Admissions. It does not make the user a school admin.`

### Step 3: Choose Access Level

Field:

- Access level: `PremiumSelect`

Options are module presets, for example:

- Viewer
- Reviewer
- Manager
- Decision maker

Below the dropdown, show a compact preview:

`Can view applications, add notes, update review status, request documents, and send applicant emails.`

### Step 4: Optional Expiry

Fields:

- Expires: toggle or checkbox, default off.
- Expiry date: `CustomDatePicker`, visible only when expiry is enabled.

If expiry is enabled, the date is required.

Expiry date cannot be in the past.

### Step 5: Optional Note

Field:

- Admin note: `Textarea`

Placeholder:

`Why is this access being granted?`

This note is stored in the audit trail.

### Confirmation

Primary action:

`Grant access`

Secondary action:

`Cancel`

Before submit, show a concise confirmation sentence:

`Ama Mensah will get Reviewer access to Admissions until May 31, 2026.`

If no expiry:

`Ama Mensah will get Reviewer access to Admissions until you revoke it.`

## 11. Edit Delegation Flow

Editing should use the same modal, with current values prefilled.

Editable:

- Permission preset.
- Expiry enabled/date.
- Admin note.

Not editable:

- Staff member.
- Module.

If the admin needs a different staff member or module, revoke and create a new delegation.

On save, create an audit event with before and after values.

## 12. Revoke Flow

Use a confirmation dialog.

Title:

`Revoke access?`

Description:

`This removes access immediately. The staff member will no longer see this module in their sidebar. Their past activity remains in the audit trail.`

Fields:

- Optional reason: `Textarea`

Buttons:

- `Cancel`
- `Revoke access`

The revoke button should use destructive styling.

## 13. Delegate Experience

### Teacher Sidebar

Delegated modules should appear in the teacher sidebar in a section named:

`Delegated`

Examples:

- Admissions
- Polls
- Fundraising
- Fees & Payments

Only active, non-expired delegations should appear.

If a delegation expires or is revoked, the nav item disappears after the next session refresh or query refresh.

### Page Banner

On every delegated module page, show a compact banner:

`You are managing this area as a delegate. Your actions are visible to the school admin.`

This should not look alarming. Use a subtle info treatment.

### Permission Boundaries

If a delegate can view a page but not perform an action:

- Hide the action button when possible.
- If the action is visible for context, disable it and show a tooltip: `Your delegated access does not include this action.`

Server-side authorization must still enforce every action.

## 14. Data Model

### New Collection: `Delegation`

Suggested fields:

```ts
type DelegationStatus = "active" | "expired" | "revoked";

type Delegation = {
  _id: ObjectId;
  schoolId: ObjectId;
  staffUserId: ObjectId;
  staffTeacherId?: ObjectId | null;
  module: DelegationModule;
  preset: string;
  permissions: string[];
  status: DelegationStatus;
  startsAt: Date;
  expiresAt?: Date | null;
  revokedAt?: Date | null;
  revokedByUserId?: ObjectId | null;
  revokeReason?: string | null;
  grantedByUserId: ObjectId;
  grantNote?: string | null;
  lastActivityAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
```

Indexes:

- `{ schoolId: 1, staffUserId: 1, module: 1, status: 1 }`
- `{ schoolId: 1, module: 1, status: 1 }`
- `{ schoolId: 1, status: 1, expiresAt: 1 }`

Constraint:

- Only one active delegation per staff member per module.

### Delegation Module Enum

```ts
type DelegationModule =
  | "admissions"
  | "polls"
  | "fundraising"
  | "meetings"
  | "academic_calendar"
  | "documents"
  | "supplies"
  | "store"
  | "reports"
  | "students"
  | "grades"
  | "subjects"
  | "curriculum"
  | "timetable"
  | "academic_periods"
  | "promotions"
  | "staff_attendance"
  | "invitations"
  | "email"
  | "fees"
  | "expenses";
```

Excluded modules should not exist in this enum for this phase.

## 15. Permission Registry

Create a central registry, for example:

`src/lib/delegations/registry.ts`

The registry should define:

- module id
- label
- description
- href
- icon name or icon key
- allowed presets
- permissions included in each preset
- whether the module can show a contextual delegate button

Example:

```ts
export const DELEGATION_MODULES = {
  admissions: {
    label: "Admissions",
    href: "/admin/admissions",
    description: "Review applications, request documents, and manage applicant communication.",
    contextualDelegateButton: true,
    presets: {
      viewer: {
        label: "Viewer",
        permissions: ["admissions.view"],
      },
      reviewer: {
        label: "Reviewer",
        permissions: [
          "admissions.view",
          "admissions.comment",
          "admissions.change_status",
          "admissions.send_email",
          "admissions.request_document",
          "admissions.schedule_interview",
        ],
      },
    },
  },
} as const;
```

Do not hardcode permission lists separately in UI and API routes.

## 16. Authorization Helpers

Add shared helpers:

```ts
requireSchoolAdminOrDelegatedPermission({
  schoolId,
  userId,
  permission: "admissions.change_status",
});
```

Required behavior:

- School admins always pass.
- Delegates pass only if an active delegation grants the permission.
- Expired or revoked delegations fail.
- Excluded modules cannot be granted.
- Every mutation route must check the exact permission needed.

Read helpers:

```ts
getDelegatedModulesForUser({ schoolId, userId });
hasDelegatedPermission({ schoolId, userId, permission });
```

## 17. API Routes

### Admin Delegation Routes

```txt
GET    /api/admin/delegations
POST   /api/admin/delegations
GET    /api/admin/delegations/[delegationId]
PATCH  /api/admin/delegations/[delegationId]
DELETE /api/admin/delegations/[delegationId]
GET    /api/admin/delegations/modules
GET    /api/admin/delegations/activity
```

### Request/Response Requirements

`POST /api/admin/delegations`

Body:

```json
{
  "staffUserId": "string",
  "module": "admissions",
  "preset": "reviewer",
  "expiresAt": "2026-05-31T00:00:00.000Z",
  "note": "Helping with admissions review."
}
```

Server must derive `permissions` from the registry. The client must not be trusted to submit arbitrary permissions.

`PATCH /api/admin/delegations/[delegationId]`

Allowed:

```json
{
  "preset": "manager",
  "expiresAt": null,
  "note": "Expanded after training."
}
```

`DELETE /api/admin/delegations/[delegationId]`

Body:

```json
{
  "reason": "No longer handling admissions."
}
```

### Delegate Bootstrap Route

Add or extend the current user bootstrap response to include delegated modules:

```json
{
  "delegations": [
    {
      "module": "admissions",
      "label": "Admissions",
      "href": "/teacher/admissions",
      "permissions": ["admissions.view", "admissions.change_status"],
      "expiresAt": null
    }
  ]
}
```

The teacher sidebar should consume this data.

## 18. Audit Trail

Every delegation lifecycle event and delegated action must create an audit event.

### Delegation Lifecycle Events

- `delegation.created`
- `delegation.updated`
- `delegation.revoked`
- `delegation.expired`

### Delegated Action Events

Use module-specific event names:

- `admissions.status_changed`
- `admissions.document_requested`
- `admissions.email_sent`
- `polls.created`
- `polls.published`
- `fees.payment_recorded`
- `expenses.created`

### Required Audit Fields

```ts
type DelegationAuditEvent = {
  schoolId: ObjectId;
  actorUserId: ObjectId;
  actorRole: "admin" | "delegate";
  actorDelegationId?: ObjectId | null;
  /** Resolved display name of the acting user when `actorRole === "delegate"` (also stored in `Activity.metadata`). */
  actorDisplayName?: string | null;
  actorEmail?: string | null;
  module: string;
  action: string;
  entityType?: string | null;
  entityId?: ObjectId | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date;
};
```

### Delegate identity in metadata

Persist human-readable names on the existing `Activity` document (`metadata` map) so exports and admin UIs do not need extra joins:

- **`actorDisplayName` / `actorEmail`** — when the actor is a **delegate** (`metadata.actorRole === "delegate"`), the server resolves these from `User` for the acting `userId` before insert.
- **`delegateStaffDisplayName` / `delegateStaffEmail`** — for **delegation lifecycle** events (`delegation.created`, `delegation.updated`, `delegation.revoked`, `delegation.expired`, `delegation.migrated`), the server resolves these from `metadata.staffUserId` (the staff member receiving, holding, or losing delegated access).

Lifecycle audit writes must include `staffUserId` in `metadata` where the affected delegate is known.

**Request context:** when available, API handlers may pass **client** `ipAddress` / `userAgent` into `recordActivity`; these are stored on `Activity.metadata` (best-effort from `x-forwarded-for` / `user-agent`, not a security guarantee).

**Admin / school UI:** activity feeds (dashboard, “view all”, delegations “Recent activity”, student activity log) should render `metadata.actorDisplayName` and the delegate badge via `formatActivityActorPrimary`, and show **Staff:** `delegateStaffDisplayName` when present so reviewers see both the acting account and the affected delegate in one glance.

Audit logs must be append-only.

Do not implement audit deletion.

## 19. Migration From Admissions-Only Delegation

Current admissions delegation should migrate into the new `Delegation` collection.

Migration rules:

- Existing admissions delegate becomes module `admissions`.
- Use preset `manager` or equivalent current behavior.
- Preserve assigned by and assigned at if available.
- Create an audit event `delegation.migrated`.
- Any user who **only** had admissions-related access via legacy **`admissions_officer` (or other) subrole** should receive an equivalent **`Delegation`** row (or lose that access until an admin grants one); subroles must **not** continue to authorize admissions routes.

After migration:

- Admissions UI should use the shared delegation APIs.
- Existing `/teacher/admissions` access should use the shared delegation permission helpers.
- Existing admissions-specific delegation API can be retained temporarily as a compatibility wrapper, then removed.

## 20. Contextual Delegate Button

Eligible module pages should show a compact action:

`Delegate access`

Placement:

- Near the page header actions.
- Do not place inside every card or table row.

Behavior:

- Opens the Add Delegation modal.
- Preselects the current module.
- Hides module dropdown only if there is no reason to switch modules.
- Uses the central `/api/admin/delegations` route.

Do not show the button on:

- Payment Setup
- Reconciliation
- Settings
- Disbursements
- Subscription
- Billing pages

## 21. Validation Rules

Server validation:

- Staff user must belong to the same school.
- Staff user must be active.
- Staff user’s membership must include **`teacher`** or **`staff`** only (see §3 Eligible staff).
- Module must be in the delegation registry.
- Preset must belong to that module.
- Expiry date, if supplied, must be in the future.
- Cannot create duplicate active delegation for the same staff and module.
- Cannot delegate excluded modules.
- Cannot delegate `delegations.manage`.
- Cannot grant permissions not defined by the registry.

Client validation should mirror these rules for fast feedback, but the server remains authoritative.

## 22. Expiry Handling

An expired delegation should stop working immediately after `expiresAt`.

Implementation options:

- Treat expired records as inactive in every authorization query.
- Run a cron job to mark expired delegations as `expired` and write `delegation.expired` audit events.

Both are acceptable, but authorization must not depend only on the cron job.

## 23. Notifications

When access is granted:

- Notify the delegate by email or in-app notification.
- Include module name, access level, and expiry if any.

When access is revoked:

- Notify the delegate.

When access is close to expiry:

- Optional notification 3 days before expiry.

Keep notification language simple:

`You have been given Reviewer access to Admissions for Day Spring School.`

## 24. Security Requirements

- Every server mutation must check permission server-side.
- UI hiding is not security.
- Delegates cannot call admin-only APIs unless the API explicitly accepts delegated permissions.
- Delegation IDs must be school-scoped.
- Audit events must include actor and delegated context.
- Expired delegations must not pass authorization.
- Revoked delegations must not pass authorization.
- Access decisions should be centralized in helpers, not repeated ad hoc in routes.

### Authorization performance

`requireSchoolAdminOrDelegatedPermission` and related read helpers must not issue redundant database round-trips on every handler. Acceptable patterns:

- Resolve **active delegations once per HTTP request** (attach to a small request-scoped context after auth), or
- Use a **short TTL cache** keyed by `(schoolId, userId)`, **invalidated** on delegation create, update, and revoke (and optionally on expiry job).

Authorization must **not** depend solely on caching: if cache is stale, the worst case is an extra read; security checks remain correct.

### School admin continuity

Schools should maintain **at least one** active `school_admin`. **Recovering** access when no admin is reachable (lost account, sole admin left) is **out of scope** for this feature: handle via **platform support** or documented **manual recovery** outside delegations.

## 25. Suggested Implementation Phases

### Phase 1: Foundation

- Add delegation registry.
- Add `Delegation` model.
- Add admin delegation APIs.
- Add authorization helpers.
- Add audit events for create, update, revoke.

### Phase 2: Admin UI

- Add `/admin/delegations`.
- Build active delegations list.
- Build Add/Edit/Revoke flows.
- Use `PremiumSelect` for staff, module, preset, status filters.
- Use `CustomDatePicker` for expiry.

### Phase 3: Teacher Sidebar

- Add delegated module bootstrap.
- Add `Delegated` section to teacher sidebar.
- Wire sidebar links **only** to registry `href` / `delegateHref` values (see §6 Routing and delegate URLs).
- Implement or align **canonical routes** per module so delegates and documented URLs stay consistent.

### Phase 4: Admissions Migration

- Migrate admissions-only delegation.
- Update admissions routes to use shared permission helpers.
- Add contextual `Delegate access` button to admissions.
- Ensure admissions audit records include delegate identity.

### Phase 5: More Modules

Enable module-by-module:

- Polls
- Fundraising
- Meetings
- Documents
- Academic Calendar
- Reports
- Supply Programs
- Store

Only then evaluate limited Fees & Payments and Expenses delegation.

## 26. Acceptance Criteria

- **Presets only** in v1: no per-action “Advanced permissions” UI; only registry presets are grantable.
- Delegation **targets** are limited to active `teacher` and `staff` members (see §3).
- **Teacher subroles** are not used for authorization for modules in this spec; implementation removes or ignores them for those code paths.
- Admin can open `/admin/delegations`.
- Admin can grant a staff member access to an eligible module.
- Delegation form uses `PremiumSelect` dropdowns.
- Expiry date uses `CustomDatePicker`.
- Excluded modules are not shown.
- Teacher sees delegated modules in a `Delegated` sidebar section.
- Teacher cannot see modules they were not delegated.
- Teacher cannot perform actions outside their permissions.
- Admin can edit delegation preset and expiry.
- Admin can revoke access immediately.
- Revoked access disappears from teacher sidebar.
- Every grant, edit, revoke, and delegated mutation writes an audit event.
- Existing admissions delegation continues working after migration.
- Contextual `Delegate access` buttons open the central delegation flow.

## 27. Engineering Notes

- Keep the registry as the single source of truth for module labels, presets, permissions, and **delegate-facing URLs** (§6).
- Prefer server-derived permissions over client-submitted permissions.
- Use existing app shell and sidebar patterns.
- Remove **subrole** reads from auth helpers for delegated modules; use **delegation permissions** and `school_admin` only.
- Do not expose high-risk finance, settings, or payment setup modules in this phase.
