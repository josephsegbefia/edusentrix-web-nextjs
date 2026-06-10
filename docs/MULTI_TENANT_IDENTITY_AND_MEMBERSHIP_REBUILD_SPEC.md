# Multi-Tenant Identity And Membership Rebuild Spec

## Purpose

EduSentrix must support one real person belonging to multiple schools without duplicate app users. A parent can have wards in School A and School B. A teacher can teach in two schools. A platform-created school admin may already have an account from another school.

The current codebase has the right base model in `UserMembership`, but many auth and creation flows still treat `User.schoolId` as the user's single tenant. That creates orphan users and duplicate email records, especially when onboarding, invitations, and platform-created schools happen in different orders.

There are no real live users yet, so this rebuild can be done completely instead of preserving every legacy behavior indefinitely.

## Target Model

`User` is the person identity.

- One Clerk identity maps to one canonical `User`.
- `User.email` identifies/contact-matches a person but is not tenant access by itself.
- `User.schoolId` is legacy/default context only during migration, then deprecated.
- `User.role` is legacy/default display only during migration, then deprecated for tenant access.
- Platform operators remain platform-scoped users and may have no school memberships.

`UserMembership` is the school access source of truth.

- One row per `(userId, schoolId)`.
- Roles live on the membership.
- Membership status controls access: `active`, `invited`, `suspended`.
- All tenant guards must authorize using membership roles, not `User.role`.

Active school context decides which tenant is currently in use.

- If a user has one active school membership, use it automatically.
- If a user has multiple active school memberships, require a selected active school.
- Store active school in a secure app cookie/session, with Clerk metadata as optional convenience only.
- Every school-facing API gets `schoolId` from active membership context.

## Current Findings

Inventory from repo scan:

- About 31 files directly use patterns like `User.findOne({ clerkUserId })`, `user.schoolId`, or membership auto-create.
- About 11 files create or upsert users directly.
- About 741 files reference shared school/role guards, which means fixing the guards first gives broad coverage without editing every route.

Important existing files:

- `src/models/User.ts`
- `src/models/UserMembership.ts`
- `src/lib/auth/get-current-user.ts`
- `src/lib/auth/resolveTenantUserForClerkSession.ts`
- `src/app/api/me/route.ts`
- `src/app/auth/callback/route.ts`
- `src/app/auth/switch/page.tsx`
- `src/lib/auth/requireSchoolAdmin.ts`
- `src/lib/auth/requireTeacher.ts`
- `src/lib/auth/requireParent.ts`
- `src/lib/auth/requireFinanceStaff.ts`
- `src/lib/auth/requireSchoolMember.ts`
- `src/lib/auth/requireSchoolAdminOrTeacherRead.ts`
- `src/lib/auth/resolveSchoolActorContext.ts`
- `src/lib/auth/requirePaymentSetupAccess.ts`
- `src/lib/delegations/requireDelegatedModulePermission.ts`
- `src/lib/platform/schools/create-school-from-platform.ts`
- `src/app/api/webhooks/clerk/route.ts`
- `src/app/api/onboarding/bootstrap/route.ts`
- `src/app/api/platform/schools/[id]/admin-invite/route.ts`
- `src/app/api/admin/teachers/create/route.ts`
- `src/app/api/admin/teachers/bulk-create/route.ts`
- `src/app/api/admin/students/[id]/guardians/route.ts`
- `src/lib/admissions/provisioning-service.ts`
- `src/app/api/platform/staff/invite/route.ts`

## Non-Negotiable Rules

1. Do not create a second `User` for an existing human just because they join another school.
2. Do not use `User.schoolId` as the tenant source of truth after the migration.
3. Do not infer access from email alone at request time.
4. Email can be used to find a candidate person during invite/provisioning, but access must be granted by `UserMembership`.
5. All tenant-owned queries must still include `schoolId`; only the source of that `schoolId` changes.
6. A user with multiple memberships must never leak data across schools.
7. Platform admin auth remains separate from school membership auth.

## Slice 1: Canonical Identity Resolver

Goal: introduce one shared way to resolve the Clerk session into a canonical app user without choosing a tenant.

Create:

- `src/lib/auth/resolveCanonicalUser.ts`
- `src/lib/auth/membership-context.ts` or similar shared types

Responsibilities:

- Read Clerk user ID and primary email.
- Find `User` by `clerkUserId`.
- If missing, find existing canonical `User` by normalized email when safe.
- Attach Clerk ID to the canonical user.
- Create a new `User` only when no existing person is found.
- Never create `schoolId:null` onboarding duplicates when a school-bound or invited user already exists.

Expected output:

```ts
type CanonicalUserContext = {
  userId: Types.ObjectId;
  clerkUserId: string;
  email: string;
  name: string | null;
  isPlatformUser: boolean;
};
```

Files to update in this slice:

- `src/lib/auth/resolveTenantUserForClerkSession.ts`
- `src/lib/auth/get-current-user.ts`
- `src/app/auth/callback/route.ts`
- `src/app/api/webhooks/clerk/route.ts`
- `src/app/api/onboarding/bootstrap/route.ts`

Acceptance checks:

- Same email signing in after invite links to existing `User`.
- Same email invited to a second school creates a second membership, not a second user.
- `schoolId:null` onboarding placeholder is not created when an invitation exists.

## Slice 2: Active School Context

Goal: introduce the tenant selector used by all school-facing guards.

Create:

- `src/lib/auth/active-school-context.ts`
- `src/app/api/auth/active-school/route.ts`

Context API:

```ts
type ActiveSchoolContext = {
  userId: Types.ObjectId;
  schoolId: Types.ObjectId;
  membershipId: Types.ObjectId;
  roles: MembershipRole[];
  subroles: string[];
  membershipStatus: "active" | "invited" | "suspended";
  schoolName: string;
  roleHome: "/admin" | "/teacher" | "/parent" | "/student" | "/bursar" | "/admin/settings/payment-setup";
};
```

Resolution order:

1. Assisted access session, when present.
2. Demo persona session, when demo mode is active.
3. Explicit selected school cookie/session.
4. Clerk metadata school ID, only if it matches an active membership.
5. Single active membership fallback.
6. Multiple memberships with no valid selection: return a `needs_school_selection` result.

Cookie requirements:

- HTTP-only.
- SameSite Lax.
- Stores only selected `schoolId` or signed payload.
- Invalidated when membership is suspended/deleted.

Acceptance checks:

- Single-school user enters automatically.
- Multi-school user is routed to school selection.
- Tampering with selected school cookie fails unless membership exists and is active.

## Slice 3: `/api/me` And `/auth/switch`

Goal: make login routing aware of memberships.

Update:

- `src/app/api/me/route.ts`
- `src/app/auth/switch/page.tsx`
- likely add `src/app/api/auth/memberships/route.ts`

New `/api/me` shape should include:

```ts
{
  ok: true,
  user: { id, email, name, avatarUrl },
  activeSchool: { id, name, roles } | null,
  memberships: Array<{ schoolId, schoolName, roles, status, homePath }>,
  needsSchoolSelection: boolean,
  redirect: string | null
}
```

Routing rules:

- No memberships and platform admin: `/platform`.
- No memberships and school user pending setup: `/launch` only for true onboarding.
- One active membership: set active school and redirect to role home.
- Multiple active memberships: show school selector.
- Suspended memberships do not appear as selectable.

UI requirements for `/auth/switch`:

- Show school cards with role badges.
- Select school button sets active school through API.
- After selection, redirect to role home.
- Keep a compact, operational UI; no marketing page.

Acceptance checks:

- Parent in two schools can switch and lands in the selected tenant.
- Teacher in two schools can switch and sees only selected school data.
- Admin in one school and parent in another sees both with correct home paths.

## Slice 4: Replace Core Guards

Goal: update shared guards so most routes inherit the new model.

Priority files:

- `src/lib/auth/requireSchoolAdmin.ts`
- `src/lib/auth/requireTeacher.ts`
- `src/lib/auth/requireParent.ts`
- `src/lib/auth/requireFinanceStaff.ts`
- `src/lib/auth/requireSchoolMember.ts`
- `src/lib/auth/requireSchoolAdminOrTeacherRead.ts`
- `src/lib/auth/resolveSchoolActorContext.ts`
- `src/lib/auth/requirePaymentSetupAccess.ts`
- `src/lib/delegations/requireDelegatedModulePermission.ts`
- `src/lib/auth/resolveAdminShellAccess.ts`

Guard behavior:

- Call active school context resolver.
- Check roles from `UserMembership.roles`.
- Return `schoolId` from active context.
- Never auto-create a membership in a request guard.
- Never use `User.schoolId` except temporary fallback during migration behind one helper.

Teacher-specific guard additions:

- Resolve `Teacher` by `{ userId, schoolId: activeSchoolId }`.
- If membership has `school_admin`, allow admin-mode access where current guard supports it.

Parent-specific guard additions:

- Resolve parent/guardian access by active `schoolId`.
- Existing guardian checks remain school-scoped.

Finance-specific guard additions:

- Use membership roles `school_admin`, `billing_owner`, `bursar`.
- Payment setup special authority remains in `School.billing.paymentSetup`, but tenant context comes from membership.

Acceptance checks:

- Existing admin/teacher/parent/bursar pages still load for single-school users.
- Multi-school user changing active school changes returned `schoolId`.
- No guard writes `UserMembership.create` on normal GET requests.

## Slice 5: User Creation And Invitation Flows

Goal: all school/user provisioning paths reuse canonical users and add memberships.

Create shared helper:

- `src/lib/auth/ensure-user-membership.ts`

Core functions:

```ts
ensureCanonicalUserForEmail(input)
ensureMembership(input)
activateMembershipForInvite(input)
mergeOrphanUserIntoCanonical(input)
```

Update creation flows:

- `src/lib/platform/schools/create-school-from-platform.ts`
- `src/app/api/platform/schools/[id]/admin-invite/route.ts`
- `src/app/api/admin/invitations/route.ts`
- `src/app/api/admin/invitations/[id]/resend/route.ts`
- `src/app/api/admin/teachers/create/route.ts`
- `src/app/api/admin/teachers/bulk-create/route.ts`
- `src/app/api/admin/students/[id]/guardians/route.ts`
- `src/app/api/admin/students/[id]/guardians/[guardianId]/route.ts`
- `src/lib/admissions/provisioning-service.ts`
- `src/app/api/platform/staff/invite/route.ts`
- `src/app/api/webhooks/clerk/route.ts`
- `src/app/auth/callback/route.ts`

Rules:

- Platform school creation:
  - Find canonical user by email.
  - Create school admin membership for new school.
  - Do not create duplicate `User`.
- Teacher creation:
  - Find canonical user by email.
  - Create or update `Teacher` for this school.
  - Create teacher membership for this school.
- Guardian/parent creation:
  - Find canonical user by email.
  - Create guardian relation for this school/student.
  - Create parent membership for this school.
- Billing owner/delegate:
  - Find canonical user by email.
  - Create membership with relevant role.
  - Bind payment setup authority by `userId`.

Acceptance checks:

- Same email invited as parent in two schools produces one `User` and two memberships.
- Same email added as teacher in a school where they are already a parent keeps one user and adds teacher membership/teacher record.
- Re-sending invites does not create duplicate users or memberships.

## Slice 6: Data Migration And Cleanup

Goal: clean existing development data now, before real users exist.

Create script:

- `scripts/migrations/rebuild-users-as-memberships.ts`

Dry-run first:

- Group users by normalized email.
- Identify canonical user per email:
  - Prefer user with `clerkUserId` and a school-bound active membership.
  - Prefer richer profile fields.
  - Prefer newest successful onboarding only when no better signal exists.
- Detect orphan users:
  - `schoolId: null`
  - `pendingOnboarding: true`
  - no memberships
  - duplicate email with a school-bound user

Migration actions:

- Move `UserMembership` rows from duplicate users to canonical user.
- Move profile fields onto canonical user when canonical field is empty.
- Repoint `Teacher.userId`, `Guardian.userId`, `StoreOrder.parentUserId`, `ParentSupplyPriority.parentUserId`, notifications/preferences/settings where needed.
- Unset or remove duplicate `clerkUserId` from non-canonical users.
- Delete/archive empty orphan users.
- Set `User.schoolId` to default active school only for backward compatibility until final deprecation.

Collections to inspect for `userId` references:

- `UserMembership`
- `Teacher`
- `Guardian`
- `Notification`
- `CommunicationPreference`
- `EmailPreference`
- `TeacherSettings`
- `StoreOrder`
- `ParentSupplyPriority`
- `MeetingParticipant`
- audit collections should generally keep historical actor IDs unless a hard merge is required.

Acceptance checks:

- No duplicate `clerkUserId`.
- For each normalized email intended as one person, one canonical `User` remains active.
- Multi-school access represented through memberships.
- Existing school-bound users can still log in.

## Slice 7: Deprecate `User.schoolId` And `User.role`

Goal: remove dependency on legacy fields after guards and creation flows are migrated.

Steps:

1. Keep fields in schema temporarily.
2. Add comments and TypeScript deprecation markers.
3. Update platform users page to show memberships instead of `User.schoolId`.
4. Update onboarding and settings to use active school context.
5. Add a lint/search checklist for new code:
   - no new `user.schoolId` tenant decisions
   - no new `User.findOne({ clerkUserId })` outside canonical resolver
   - no new `User.create` outside canonical user helper

Final optional schema change:

- Keep `User.schoolId` as `defaultSchoolId` or remove it after all callers are migrated.
- Keep `User.role` only for platform role or remove school roles entirely from `User`.

## Slice 8: Tests And Verification

Add targeted tests or smoke scripts:

- Canonical user resolver:
  - existing user by Clerk ID
  - existing user by email
  - duplicate email with multiple memberships
  - orphan merge candidate
- Active school resolver:
  - one membership auto-select
  - multiple memberships require switch
  - selected inactive membership rejected
- Guards:
  - admin guard uses selected school
  - teacher guard resolves school-specific teacher record
  - parent guard resolves guardian access per school
  - finance guard respects billing owner/bursar membership
- Creation flows:
  - platform school creation reuses user
  - teacher creation reuses user
  - guardian creation reuses user
  - Clerk webhook links existing invite user

Manual UAT:

- Create user as parent in School A.
- Add same email as parent in School B.
- Login once and switch between School A and School B.
- Confirm parent dashboard data changes by selected school.
- Add same email as teacher in School B.
- Confirm role homes and switcher show correct role badges.
- Confirm school admin cannot access School B by changing URL unless membership exists.

## Rollout Order

Recommended execution order:

1. Slice 1: Canonical identity resolver.
2. Slice 2: Active school context.
3. Slice 3: `/api/me` and `/auth/switch`.
4. Slice 4: core guard replacement.
5. Slice 5: user creation and invitation flows.
6. Slice 6: data migration cleanup.
7. Slice 7: deprecate legacy fields.
8. Slice 8: tests and UAT.

This order prevents new duplicates first, then switches request-time authorization, then cleans existing data.

## Known Risks

- Some modules may use role-specific records such as `Teacher` and `Guardian`; those must stay school-scoped.
- Mobile APIs may use bearer auth and must use the same canonical resolver without relying on cookies.
- Assisted access and demo mode must remain explicit exceptions.
- Platform admin users may share an email with school memberships in development; platform access must not be accidentally tenant-scoped.
- Invitation acceptance needs careful handling when the same email has pending invitations for multiple schools.

## Definition Of Done

- No normal auth guard uses `User.schoolId` as the tenant source of truth.
- No normal request guard creates memberships as a side effect.
- User creation flows reuse existing people and create memberships.
- `/auth/switch` supports multiple memberships.
- Parent/teacher/admin/bursar role homes are derived from active membership roles.
- Existing duplicate development users are merged or archived.
- A parent with wards in two schools logs in once and switches schools without duplicate accounts.
- A teacher or admin with memberships in multiple schools sees only the active school's data.
