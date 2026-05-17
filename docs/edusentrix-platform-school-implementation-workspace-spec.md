# EduSentrix Platform Assisted School Admin Access — Product & Technical Spec

## 1. Purpose

EduSentrix needs a safe way for trusted platform operators to help schools complete setup without waiting for the school admin to do every onboarding step themselves.

The new direction replaces the old **School Implementation Workspace** concept with **Platform Assisted School Admin Access**.

Instead of building a separate setup cockpit, platform staff should be able to enter a school tenant with school-admin capability and use the same school-admin workflows the client will eventually use.

This is useful for:

- initial school setup,
- academic structure setup,
- teacher/student/guardian onboarding,
- subject offerings setup,
- fee and invoice setup,
- communication setup,
- troubleshooting school-admin workflows,
- short-term operational support.

The feature must be secure, explicit, audited, time-bound, and visibly marked in the UI.

---

## 2. Product Principle

Platform assisted access is not “login as a user”.

It should mean:

```txt
A trusted platform actor is acting inside one selected school with school-admin privileges for a declared support/setup reason.
```

The system must preserve two identities at all times:

```txt
real actor: platform user performing the work
effective context: selected school + school_admin capability
```

Do not impersonate a named school admin unless a future product decision explicitly requires it.

Preferred wording:

```txt
Assist as School Admin
Acting for Saint Anthony's School
Assisted access active
```

Avoid wording like:

```txt
Logged in as Joseph
Become user
Steal session
```

---

## 3. Scope For This Version

For now, assisted access is limited to **school admin access only**.

Supported:

- platform admin starts assisted access for a school,
- delegated platform staff can start assisted access only when granted access by a platform admin,
- assisted user gets school-admin-level access within the selected school,
- all school-admin routes and APIs resolve to the selected `schoolId`,
- all writes are audited with both the real actor and assisted context,
- assisted access can be ended manually or expires automatically.

Not supported in this version:

- assisted teacher access,
- assisted parent access,
- assisted student access,
- assisted bursar access,
- silent impersonation,
- permanent role changes,
- access across multiple schools in one assisted session,
- WhatsApp/SMS support flows.

---

## 4. Roles And Authorization

### 4.1 Platform Admin

Platform admins may start assisted school-admin access for any school if they have the required permission.

Required permission:

```txt
platform.schools.assistedAccess
```

Recommended additional permission for viewing session history:

```txt
platform.audit.read
```

Platform admins can:

- start assisted access,
- choose duration,
- provide reason,
- end their own session,
- end active sessions started by delegated staff,
- view assisted access audit records.

### 4.2 Delegated Platform Staff

Delegated staff may start assisted access only when all of the following are true:

1. They have been delegated by a platform admin.
2. The delegation includes the selected school.
3. The delegation includes assisted access capability.
4. The delegation is active and not expired.

Suggested delegation scope:

```txt
school_assisted_admin_access
```

Suggested delegated permission:

```txt
platform.schools.assistedAccess.delegated
```

Delegated staff must never get all-school access through assisted access unless explicitly granted by platform admin policy.

### 4.3 School Users

School admins do not grant or manage this feature in the first version.

However, the system should optionally notify the primary school admin when assisted access starts and ends.

---

## 5. Entry Points

### 5.1 Platform School Detail Page

Add an action on the platform school detail page:

```txt
Assist as School Admin
```

Placement:

- school detail header actions, or
- premium more-actions dropdown.

Do not add this to generic task pages.

### 5.2 Platform Schools List

Optional secondary action:

```txt
Assist
```

This should be shown only to authorized users.

### 5.3 No Separate Implementation Workspace

Do not recreate:

```txt
/platform/schools/[schoolId]/implementation
/platform/implementation
```

The school-admin app is now the workspace.

---

## 6. Start Assisted Access Flow

Clicking `Assist as School Admin` opens a confirmation modal.

The modal must show:

- school name,
- school status,
- effective role: `School Admin`,
- allowed duration,
- required reason,
- security notice,
- confirmation button.

Required fields:

```txt
reason: string, min 10 characters
durationMinutes: 15 | 30 | 60 | 120
```

Recommended default:

```txt
30 minutes
```

Example modal copy:

```txt
You are about to enter Saint Anthony's School with school-admin privileges.
Your real platform identity will be recorded on every action.
Use this only for approved setup or support work.
```

Primary action:

```txt
Start assisted access
```

Secondary action:

```txt
Cancel
```

After success, redirect to:

```txt
/admin
```

within the selected school context.

---

## 7. Assisted Session Model

Create a new model instead of overloading user sessions.

Recommended model:

```ts
PlatformAssistedAccessSession {
  _id: ObjectId;

  schoolId: ObjectId;

  actorUserId: ObjectId;          // real platform user
  actorEmail?: string | null;
  actorName?: string | null;

  effectiveRole: "school_admin";

  reason: string;

  status: "active" | "ended" | "expired" | "revoked";

  startedAt: Date;
  expiresAt: Date;
  endedAt?: Date | null;
  endedByUserId?: ObjectId | null;
  endReason?: string | null;

  delegatedGrantId?: ObjectId | null;

  ipAddress?: string | null;
  userAgent?: string | null;

  createdAt: Date;
  updatedAt: Date;
}
```

Indexes:

```ts
{ actorUserId: 1, status: 1, expiresAt: 1 }
{ schoolId: 1, status: 1, expiresAt: 1 }
{ expiresAt: 1 }
```

Rules:

- one active assisted session per actor is recommended,
- starting a new assisted session should end the previous active one,
- expired sessions must not authenticate,
- session status should be updated to `expired` lazily or by a scheduled cleanup.

---

## 8. Session Transport

Use an httpOnly cookie to store a signed assisted session reference.

Suggested cookie:

```txt
edusentrix_assisted_access
```

The cookie should contain only a signed token or session id reference, not full session data.

Security requirements:

- `httpOnly: true`
- `secure: true` in production
- `sameSite: "lax"`
- short max age matching `expiresAt`
- signed/encrypted or validated server-side

Never store this in localStorage.

---

## 9. Auth Context Resolution

The app needs a central resolver that can detect assisted access.

Recommended helper:

```ts
resolveSchoolActorContext()
```

When assisted access is active, it should return:

```ts
{
  mode: "assisted_access";
  schoolId;
  userId: actorUserId;
  realActorUserId: actorUserId;
  effectiveRole: "school_admin";
  role: "school_admin";
  assistedSessionId;
  permissions: schoolAdminPermissions;
}
```

Important:

- `schoolId` must come from the assisted session, not from the platform user's normal user record.
- The actor remains the platform user for audit purposes.
- The effective role is school admin for authorization inside the school tenant.

Existing school-admin auth helpers should be updated carefully so assisted context works where appropriate.

---

## 10. Tenant Isolation

Assisted access must be locked to one school.

Every school-scoped query and mutation must continue to require `schoolId` scoping.

If the assisted actor tries to access a route for another school or a platform-only route through the assisted context, the system must reject it.

Rules:

```txt
assisted access can enter school app routes
assisted access cannot grant platform permissions inside school app
assisted access cannot switch schoolId silently
assisted access cannot bypass tenant scoping
```

---

## 11. UI Requirements

### 11.1 Persistent Assisted Access Banner

Every school-admin page must show a sticky banner while assisted access is active.

Example:

```txt
Assisted access active: You are acting for Saint Anthony's School as School Admin.
Reason: Initial setup support.
Expires in 24 minutes.
[Exit assisted access]
```

Design:

- visible but not disruptive,
- amber/cyan accent,
- fixed or sticky near top of app shell,
- always available exit action.

Do not hide this behind a menu.

### 11.2 Header Identity

The admin header/user menu should show the real actor identity and assisted context.

Example:

```txt
Joseph Elorm
Assisting: Saint Anthony's School
```

### 11.3 Exit Flow

`Exit assisted access` should call an end-session endpoint, clear cookie, and redirect back to:

```txt
/platform/schools/[schoolId]
```

---

## 12. API Routes

Recommended routes:

```txt
POST   /api/platform/schools/[schoolId]/assisted-access/start
POST   /api/platform/assisted-access/end
GET    /api/platform/assisted-access/current
GET    /api/platform/schools/[schoolId]/assisted-access/sessions
```

### 12.1 Start

Requires:

```txt
platform.schools.assistedAccess
```

or an active delegation with assisted access capability.

Payload:

```ts
{
  reason: string;
  durationMinutes: 15 | 30 | 60 | 120;
}
```

Response:

```ts
{
  success: true,
  data: {
    sessionId: string;
    schoolId: string;
    expiresAt: string;
    redirectTo: "/admin";
  }
}
```

### 12.2 End

Ends the current assisted session.

Payload:

```ts
{
  reason?: string | null;
}
```

Response:

```ts
{
  success: true,
  data: {
    redirectTo: "/platform/schools/[schoolId]";
  }
}
```

### 12.3 Current

Returns current assisted session for the banner.

Response when active:

```ts
{
  success: true,
  data: {
    active: true,
    schoolId: string,
    schoolName: string,
    effectiveRole: "school_admin",
    reason: string,
    startedAt: string,
    expiresAt: string,
    actor: {
      id: string,
      name: string | null,
      email: string | null
    }
  }
}
```

Response when inactive:

```ts
{
  success: true,
  data: { active: false }
}
```

---

## 13. Audit Requirements

Every assisted session event must write to `PlatformAuditLog` or an equivalent audit store.

Events:

```txt
platform.assisted_access.started
platform.assisted_access.ended
platform.assisted_access.expired
platform.assisted_access.revoked
```

Every school-side mutation performed during assisted access should include audit metadata where audit exists.

Minimum audit metadata:

```ts
{
  assistedAccessSessionId: string;
  realActorUserId: string;
  effectiveRole: "school_admin";
  schoolId: string;
  reason: string;
}
```

This must be visible to platform audit users.

Future school-admin audit views may also show these events.

---

## 14. Sensitive Action Guardrails

Assisted access should allow platform staff to set up the school, but some actions should be blocked or require extra confirmation.

Block or require higher permission for:

- permanent school deletion,
- school suspension/deactivation,
- subscription cancellation,
- platform billing/payout owner changes,
- changing another user's authentication identity,
- exporting sensitive student data in bulk,
- deleting large datasets,
- changing payment account numbers without platform finance permission.

The exact guardrails can be implemented incrementally, but the architecture must allow checking:

```ts
context.mode === "assisted_access"
```

inside sensitive endpoints.

---

## 15. Delegation Rules

Only platform admins can delegate assisted access to staff.

A delegation should include:

```ts
PlatformDelegation {
  staffUserId;
  schoolId;
  scope: "school_assisted_admin_access";
  permissions: ["platform.schools.assistedAccess.delegated"];
  startsAt;
  expiresAt;
  status;
  createdByUserId;
}
```

Delegation should be visible in the platform delegations console.

Delegated staff can only start assisted access for delegated schools.

---

## 16. Notifications

Recommended:

- notify the primary school admin when assisted access starts,
- notify again when it ends,
- include reason and actor name,
- expose this in an audit/activity feed later.

For first implementation, notification may be deferred, but audit cannot be deferred.

---

## 17. UX Copy

Use clear, trust-preserving copy.

Good:

```txt
Assist as School Admin
Start assisted access
You are acting for this school as School Admin
Your platform identity will be recorded on every action
Exit assisted access
```

Avoid:

```txt
Impersonate user
Become admin
Login as school
Ghost mode
```

Internal code may use `assistedAccess` or `impersonation` where unavoidable, but user-facing language should use “assisted access”.

---

## 18. Implementation Slices

### Slice 1 — Foundation

- Add `PlatformAssistedAccessSession` model.
- Add assisted access permissions.
- Add start/end/current APIs.
- Add secure httpOnly cookie.
- Add platform school detail `Assist as School Admin` action.
- Add audit records for start/end.

### Slice 2 — School App Context

- Update school auth context resolver to support assisted access.
- Allow assisted access into admin layout/routes.
- Add sticky assisted access banner.
- Add exit action.
- Ensure schoolId comes from assisted session.

### Slice 3 — Guardrails And Delegation

- Add delegated staff support.
- Add sensitive action guardrails.
- Add active session list on platform school detail.
- Add optional school-admin notification.
- Add tests for start, expiry, school scoping, delegation, and audit.

---

## 19. Acceptance Criteria

The feature is complete when:

- a platform admin can start assisted school-admin access for one school,
- delegated staff can only assist schools explicitly delegated to them,
- assisted access opens the actual school admin experience,
- a persistent banner is visible on school admin pages,
- exiting assisted access returns to platform school detail,
- session expires automatically,
- every assisted session start/end is audited,
- school-side writes can identify the real platform actor and assisted session,
- the session cannot access another school,
- the session cannot silently perform sensitive platform-only actions.

---

## 20. Deprecated Concept

The old **School Implementation Workspace** is deprecated.

Do not rebuild these routes:

```txt
/platform/implementation
/platform/schools/[schoolId]/implementation
/api/platform/schools/[schoolId]/implementation/*
```

Do not create a separate setup cockpit unless the product direction changes again.

The school-admin app itself is the setup workspace.
