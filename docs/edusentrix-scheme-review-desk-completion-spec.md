# EduSentrix Scheme Review Desk — Completion Spec

## 1. Purpose

This spec defines the required changes to bring the **Scheme Review Desk** fully in line with the EduSentrix **Curriculum & Scheme of Work** direction.

The current implementation exists, but it is too basic. It currently behaves like a simple admin table with status actions, rather than a true academic review workflow.

The completed Review Desk must support this workflow:

```txt
Teacher creates Scheme of Work
↓
Teacher adds scheme items / weekly plan
↓
Teacher submits for review
↓
Scheme appears in Admin / Academic Head Review Desk
↓
Reviewer inspects the full scheme content
↓
Reviewer approves, requests revision, or rejects
↓
Approved scheme can be activated
↓
Active scheme becomes available to Lesson Notes as the planning backbone
```

The Review Desk must help academic heads and school admins review the actual educational plan, not just approve a title.

---

## 2. Current State Summary

Current implementation includes:

```txt
src/app/(app)/admin/schemes/page.tsx
src/hooks/admin/useAdminSchemes.ts
src/app/api/admin/schemes/route.ts
src/app/api/admin/schemes/[id]/approve/route.ts
src/app/api/admin/schemes/[id]/activate/route.ts
src/app/api/admin/schemes/[id]/archive/route.ts
src/app/api/teacher/schemes/[id]/submit/route.ts
src/models/SchemeOfWork.ts
src/models/SchemeItem.ts
src/models/SchemeReview.ts
```

Current admin page shows mainly:

```txt
Title
Status
Updated date
Approve / Activate / Archive actions
```

This is not enough for proper academic review.

---

## 3. Main Product Principle

The Scheme Review Desk must not be treated as a simple CRUD admin table.

It should be an **academic quality-control workspace** where admins and academic heads can:

- inspect the full scheme;
- review weekly topics and objectives;
- verify curriculum alignment;
- comment on issues;
- request corrections;
- approve valid schemes;
- activate only one valid scheme per academic context;
- view review history;
- maintain auditability.

---

## 4. Required Final Workflow

### 4.1 Teacher Flow

```txt
Teacher creates scheme draft
↓
Teacher adds/edit scheme items
↓
Teacher submits scheme
↓
Scheme status becomes submitted
↓
Teacher can no longer edit unless revision is requested
```

If revision is requested:

```txt
Scheme status becomes needs_revision
↓
Teacher sees reviewer comments
↓
Teacher edits scheme
↓
Teacher resubmits
↓
Scheme status becomes submitted again
```

### 4.2 Admin / Academic Head Flow

```txt
Reviewer opens Scheme Review Desk
↓
Reviewer sees submitted schemes by default
↓
Reviewer opens scheme detail/review page
↓
Reviewer inspects metadata + scheme items + review history
↓
Reviewer chooses one action:
  - Approve
  - Request Revision
  - Reject
```

If approved:

```txt
Scheme status becomes approved
↓
Reviewer/admin may activate it
↓
System checks for active scheme conflicts
↓
If no conflict, status becomes active
```

---

## 5. Status Model Updates

### 5.1 Required Statuses

Update `SchemeOfWork` status values to support the full review lifecycle.

```ts
export type SchemeOfWorkStatus =
  | "draft"
  | "submitted"
  | "needs_revision"
  | "approved"
  | "active"
  | "archived"
  | "rejected";
```

### 5.2 Migration From Current Statuses

Current status:

```txt
in_review
```

Should be replaced by:

```txt
submitted
```

Migration rule:

```txt
in_review → submitted
```

If renaming immediately is risky, keep database compatibility temporarily but normalize in service logic and UI.

### 5.3 Status Meaning

| Status | Meaning |
|---|---|
| `draft` | Teacher/admin is still preparing the scheme. |
| `submitted` | Scheme has been submitted for review. |
| `needs_revision` | Reviewer has requested changes. Teacher may edit and resubmit. |
| `approved` | Scheme has passed academic review but is not yet the active planning source. |
| `active` | Scheme is currently used by Lesson Notes and coverage tracking. |
| `archived` | Scheme is no longer in use but kept for history. |
| `rejected` | Scheme was rejected and should not be used. |

---

## 6. Review Decision Model

Update or normalize `SchemeReview` decisions.

```ts
export type SchemeReviewDecision =
  | "submitted"
  | "approved"
  | "needs_revision"
  | "rejected"
  | "activated"
  | "archived";
```

If the existing value `changes_requested` exists, map it to `needs_revision`.

### 6.1 SchemeReview Fields

`SchemeReview` should contain:

```ts
type SchemeReview = {
  _id: ObjectId;
  schoolId: ObjectId;
  schemeId: ObjectId;

  actorId: ObjectId;
  actorRole?: string;

  decision: SchemeReviewDecision;
  note?: string;

  createdAt: Date;
};
```

### 6.2 Comments Requirement

| Action | Comment Requirement |
|---|---|
| Submit | Optional |
| Approve | Optional |
| Request revision | Required |
| Reject | Required |
| Activate | Optional |
| Archive | Optional, recommended |

---

## 7. Backend API Requirements

### 7.1 Admin Review Queue

Current:

```txt
GET /api/admin/schemes
```

Keep this endpoint, but improve it.

#### Required query filters

```txt
status
academicYearId
termId
gradeId
classGroupId
subjectId
teacherId
curriculumId
search
page
limit
```

#### Default behavior

If no `status` is provided, default to:

```txt
status=submitted
```

The Review Desk should show submitted schemes first, not all schemes.

#### Required response shape

```ts
type AdminSchemeListResponse = {
  success: true;
  data: Array<{
    id: string;
    title: string;
    status: SchemeOfWorkStatus;

    subject?: { id: string; name: string };
    grade?: { id: string; name: string };
    classGroup?: { id: string; name: string } | null;
    academicYear?: { id: string; name: string };
    term?: { id: string; name: string };

    ownerTeacher?: {
      id: string;
      name: string;
      email?: string;
    } | null;

    itemCount: number;
    submittedAt?: string;
    updatedAt: string;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};
```

---

### 7.2 Admin Scheme Detail / Review Endpoint

Add:

```txt
GET /api/admin/schemes/[id]
```

This endpoint is required for the review detail page.

#### Response should include

```ts
type AdminSchemeDetailResponse = {
  success: true;
  data: {
    scheme: {
      id: string;
      title: string;
      description?: string;
      status: SchemeOfWorkStatus;
      sourceType?: string;
      createdAt: string;
      updatedAt: string;
      submittedAt?: string;
      approvedAt?: string;
      activatedAt?: string;
    };

    academicContext: {
      curriculum?: { id: string; name: string } | null;
      academicYear?: { id: string; name: string } | null;
      term?: { id: string; name: string } | null;
      grade?: { id: string; name: string } | null;
      classGroup?: { id: string; name: string } | null;
      subject?: { id: string; name: string } | null;
    };

    ownerTeacher?: {
      id: string;
      name: string;
      email?: string;
    } | null;

    items: Array<{
      id: string;
      weekNumber: number;
      lessonOrder?: number;
      topic: string;
      subtopic?: string;
      strand?: string;
      subStrand?: string;
      contentStandard?: string;
      indicator?: string;
      learningObjectives: string[];
      coreCompetencies?: string[];
      teachingResources?: string[];
      assessmentIdeas?: string[];
      plannedStartDate?: string;
      plannedEndDate?: string;
      coverageStatus?: string;
      status?: string;
    }>;

    reviews: Array<{
      id: string;
      decision: SchemeReviewDecision;
      note?: string;
      actor?: {
        id: string;
        name: string;
        role?: string;
      };
      createdAt: string;
    }>;
  };
};
```

---

### 7.3 Generic Review Endpoint

Preferred new endpoint:

```txt
POST /api/admin/schemes/[id]/review
```

This should replace or complement individual `approve`, `request-revision`, and `reject` endpoints.

#### Payload

```ts
type ReviewSchemePayload = {
  decision: "approved" | "needs_revision" | "rejected";
  note?: string;
};
```

#### Rules

- Only schemes with status `submitted` can be approved/rejected/requested for revision.
- `needs_revision` requires a non-empty note.
- `rejected` requires a non-empty note.
- `approved` note is optional.
- Create a `SchemeReview` record.
- Update `SchemeOfWork.status` accordingly.
- Add audit log.

---

### 7.4 Keep Existing Approve Endpoint Temporarily

Current:

```txt
POST /api/admin/schemes/[id]/approve
```

This may remain for backward compatibility, but it should internally call the same service as the generic review endpoint.

Do not allow approval from `approved` again.

Allowed transition:

```txt
submitted → approved
```

Disallowed:

```txt
approved → approved
active → approved
archived → approved
rejected → approved
```

---

### 7.5 Request Revision Endpoint

If not using the generic review endpoint, add:

```txt
POST /api/admin/schemes/[id]/request-revision
```

Payload:

```ts
{
  note: string;
}
```

Transition:

```txt
submitted → needs_revision
```

---

### 7.6 Reject Endpoint

If not using the generic review endpoint, add:

```txt
POST /api/admin/schemes/[id]/reject
```

Payload:

```ts
{
  note: string;
}
```

Transition:

```txt
submitted → rejected
```

---

### 7.7 Activate Endpoint

Current:

```txt
POST /api/admin/schemes/[id]/activate
```

Update this endpoint.

#### Allowed transition

```txt
approved → active
```

Optionally allow:

```txt
active → active no-op
```

#### Required conflict prevention

Before activating, check for another active scheme with the same context:

```ts
const existingActive = await SchemeOfWork.findOne({
  schoolId: scheme.schoolId,
  academicYearId: scheme.academicYearId,
  termId: scheme.termId,
  gradeId: scheme.gradeId,
  subjectId: scheme.subjectId,
  classGroupId: scheme.classGroupId ?? null,
  status: "active",
  _id: { $ne: scheme._id },
});
```

If found, return a conflict error:

```ts
{
  success: false,
  code: "ACTIVE_SCHEME_CONFLICT",
  message: "Another active scheme already exists for this academic year, term, grade, class group, and subject.",
  conflict: {
    id: string;
    title: string;
  }
}
```

#### Activation record

On activation:

- update scheme status to `active`;
- set `activatedAt`;
- set `activatedBy`;
- create `SchemeReview` record with `decision: "activated"`;
- create audit log.

---

### 7.8 Archive Endpoint

Current:

```txt
POST /api/admin/schemes/[id]/archive
```

Update to support an optional note:

```ts
{
  note?: string;
}
```

On archive:

- update status to `archived`;
- create `SchemeReview` record with `decision: "archived"`;
- create audit log.

---

### 7.9 Review History Endpoint

If review history is not included in detail endpoint, add:

```txt
GET /api/admin/schemes/[id]/reviews
```

Return ordered timeline:

```txt
oldest → newest
```

---

## 8. Permission Requirements

The current review routes should not rely only on `requireSchoolAdmin()`.

EduSentrix needs permission-based review control so academic heads and department heads can review without being full school admins.

### 8.1 Required Permissions

Add or use these permissions:

```txt
schemeOfWork.read
schemeOfWork.review
schemeOfWork.approve
schemeOfWork.requestRevision
schemeOfWork.reject
schemeOfWork.activate
schemeOfWork.archive
schemeOfWork.viewReviewHistory
```

### 8.2 Role Mapping

| Role | Suggested permissions |
|---|---|
| School Admin | All scheme permissions |
| Academic Head | read, review, approve, requestRevision, reject, activate, viewReviewHistory |
| Department Head | read, review, approve/requestRevision for assigned department/subjects |
| Teacher | read assigned active schemes, create own schemes, submit own schemes |

### 8.3 Route Guards

Replace broad admin-only checks with permission checks where appropriate.

Example:

```ts
await requireSchoolMemberWithPermission(req, PERMISSIONS.schemeOfWorkReview);
```

Activation should require:

```ts
PERMISSIONS.schemeOfWorkActivate
```

Archiving should require:

```ts
PERMISSIONS.schemeOfWorkArchive
```

---

## 9. Frontend Page Requirements

## 9.1 Review Queue Page

Recommended route:

```txt
/admin/academics/schemes
```

If moving routes is too disruptive, current route can remain temporarily:

```txt
/admin/schemes
```

But the long-term product location should be under Academics.

### 9.1.1 Page Purpose

This page should be the review queue and management hub.

It should not be the only place where review happens.

### 9.1.2 Required Tabs

```txt
Submitted
Needs Revision
Approved
Active
Archived
Rejected
All
```

Default tab:

```txt
Submitted
```

### 9.1.3 Required Filters

Use EduSentrix premium dropdown/select components.

Filters:

```txt
Academic Year
Term
Grade
Class Group
Subject
Teacher
Curriculum
Status
Search
```

Do not use raw HTML `<select>` for these filters.

### 9.1.4 Required Table Columns

```txt
Scheme Title
Subject
Grade / Class Group
Academic Year / Term
Teacher / Owner
Items Count
Status
Submitted Date
Last Updated
Actions
```

### 9.1.5 Required Row Actions

Use premium dropdown action menu.

```txt
View / Review
Approve
Request Revision
Reject
Activate
Archive
```

Only show actions that are valid for the current status and current user permissions.

Examples:

- `submitted`: Review, Approve, Request Revision, Reject
- `approved`: View, Activate, Archive
- `active`: View, Archive
- `needs_revision`: View, Archive
- `archived`: View only
- `rejected`: View only

---

## 9.2 Review Detail Page

Add:

```txt
/admin/academics/schemes/[id]/review
```

or, if preserving current route structure:

```txt
/admin/schemes/[id]
```

### 9.2.1 Required Sections

The detail/review page must include:

```txt
1. Header
2. Status badge
3. Scheme metadata summary
4. Teacher/creator information
5. Academic context
6. Scheme items table
7. Review history timeline
8. Reviewer action panel
```

### 9.2.2 Header

Show:

```txt
Scheme title
Status badge
Subject
Grade / Class group
Academic year / term
Teacher owner
```

### 9.2.3 Status Explanation

Include helper text explaining approval vs activation:

```txt
Approved schemes have passed academic review.
Active schemes are used by Lesson Notes and curriculum coverage tracking.
```

### 9.2.4 Scheme Items Table

The reviewer must be able to inspect the actual plan.

Columns:

```txt
Week
Lesson Order
Topic
Subtopic
Strand
Sub-strand
Content Standard
Indicator
Learning Objectives
Resources
Assessment Ideas
Planned Dates
Coverage Status
```

For narrow screens, use expandable rows or cards.

### 9.2.5 Review Timeline

Show review history from `SchemeReview`.

Each timeline item should show:

```txt
Decision
Actor
Role
Note
Date/time
```

Example:

```txt
Submitted by Ama Mensah — 2 May 2026, 09:30
Revision requested by Academic Head — Add assessment ideas for Weeks 4 and 5.
Approved by Academic Head — 3 May 2026, 14:15
Activated by School Admin — 3 May 2026, 14:20
```

### 9.2.6 Action Panel

Actions should be status-aware.

For `submitted`:

```txt
Approve
Request Revision
Reject
```

For `approved`:

```txt
Activate
Archive
```

For `active`:

```txt
Archive
```

For `needs_revision`, `rejected`, `archived`:

```txt
View only or Archive where appropriate
```

---

## 10. Modal Requirements

Use EduSentrix modal/dialog components, not browser prompts.

### 10.1 Approve Modal

Fields:

```txt
Optional reviewer note
Confirm button
Cancel button
```

### 10.2 Request Revision Modal

Fields:

```txt
Required revision comment
Confirm button
Cancel button
```

Validation:

```txt
Comment is required.
```

### 10.3 Reject Modal

Fields:

```txt
Required rejection reason
Confirm button
Cancel button
```

Validation:

```txt
Reason is required.
```

### 10.4 Activate Modal

Fields/sections:

```txt
Activation confirmation
Explanation that active schemes power Lesson Notes
Conflict warning if another active scheme exists
Confirm button
Cancel button
```

If backend returns `ACTIVE_SCHEME_CONFLICT`, show:

```txt
Another active scheme already exists for this subject/class/term. Archive it before activating this scheme.
```

### 10.5 Archive Modal

Fields:

```txt
Optional archive note
Confirm button
Cancel button
```

---

## 11. UI Standards

The Scheme Review Desk must match the premium EduSentrix UI.

### 11.1 Required UI Components

Use existing premium components where available:

```txt
Card
Button
Badge
PremiumSelect
PremiumDropdownMenu
ResponsiveModal / Dialog / Drawer
CustomDatePicker where date fields appear
Skeleton loaders
EmptyState
Sonner toast system
Confirmation dialog
Premium table/list components
```

### 11.2 Avoid

Do not use raw browser-styled elements for final implementation:

```txt
Plain <table> without premium styling
Plain <button>
Plain <select>
window.confirm
window.prompt
unstyled loading text
unstyled error text
```

### 11.3 Visual Feel

The page should feel like the rest of EduSentrix:

```txt
Dark premium background
Glass-like cards
Subtle borders
Clean badges
Clear spacing
Professional empty states
Responsive layout
Consistent typography
```

---

## 12. UX Requirements

### 12.1 Empty State

When no schemes exist in a tab:

```txt
No schemes found
Submitted schemes will appear here when teachers submit schemes of work for review.
```

For `Submitted` tab:

```txt
No schemes awaiting review
You are all caught up. New teacher submissions will appear here.
```

### 12.2 Loading State

Use skeleton cards/table rows.

### 12.3 Error State

Show friendly message and retry action.

### 12.4 Toasts

Use Sonner or existing toast helper for:

```txt
Scheme approved
Revision requested
Scheme rejected
Scheme activated
Scheme archived
Action failed
Conflict detected
```

### 12.5 Status Badges

Create/use `SchemeStatusBadge`.

Suggested labels:

| Status | Label |
|---|---|
| draft | Draft |
| submitted | Submitted |
| needs_revision | Needs Revision |
| approved | Approved |
| active | Active |
| archived | Archived |
| rejected | Rejected |

---

## 13. Data Integrity Requirements

### 13.1 Approval Rules

Only `submitted` schemes can be approved.

### 13.2 Revision Rules

Only `submitted` schemes can be sent back for revision.

### 13.3 Rejection Rules

Only `submitted` schemes can be rejected.

### 13.4 Activation Rules

Only `approved` schemes can be activated.

### 13.5 Conflict Rules

Only one active scheme should exist for the same:

```txt
schoolId
academicYearId
termId
gradeId
classGroupId
subjectId
```

If `classGroupId` is null, treat it as a grade-wide scheme.

### 13.6 Editing Rules After Submission

Teacher cannot edit `submitted`, `approved`, `active`, `archived`, or `rejected` schemes unless explicitly allowed.

Teacher can edit:

```txt
draft
needs_revision
```

Admin may edit if they have appropriate permission, but this should be audited.

---

## 14. Audit Logging Requirements

Every major action must create an audit event.

### 14.1 Required Audit Events

```txt
scheme.submitted
scheme.review.approved
scheme.review.revision_requested
scheme.review.rejected
scheme.activated
scheme.archived
scheme.review.comment_added
```

### 14.2 Audit Metadata

Include:

```ts
{
  schemeId: string;
  previousStatus: string;
  nextStatus: string;
  note?: string;
  academicYearId?: string;
  termId?: string;
  gradeId?: string;
  classGroupId?: string;
  subjectId?: string;
}
```

---

## 15. Service Layer Recommendation

Avoid duplicating review logic across route handlers.

Create a service file:

```txt
src/lib/schemes/scheme-review-service.ts
```

Suggested functions:

```ts
submitSchemeForReview(input)
reviewScheme(input)
approveScheme(input)
requestSchemeRevision(input)
rejectScheme(input)
activateScheme(input)
archiveScheme(input)
getAdminSchemeDetail(input)
listAdminSchemes(input)
assertCanReviewScheme(input)
assertNoActiveSchemeConflict(input)
```

Routes should call service functions.

This keeps transitions, validation, review records, and audit logs consistent.

---

## 16. Suggested File Changes

### 16.1 Backend Models

Update:

```txt
src/models/SchemeOfWork.ts
src/models/SchemeReview.ts
```

Possibly update:

```txt
src/models/SchemeItem.ts
```

if review table needs richer fields from earlier gap report.

### 16.2 Backend Routes

Add/update:

```txt
src/app/api/admin/schemes/route.ts
src/app/api/admin/schemes/[id]/route.ts
src/app/api/admin/schemes/[id]/review/route.ts
src/app/api/admin/schemes/[id]/approve/route.ts
src/app/api/admin/schemes/[id]/request-revision/route.ts
src/app/api/admin/schemes/[id]/reject/route.ts
src/app/api/admin/schemes/[id]/activate/route.ts
src/app/api/admin/schemes/[id]/archive/route.ts
src/app/api/admin/schemes/[id]/reviews/route.ts
```

### 16.3 Frontend Pages

Add/update:

```txt
src/app/(app)/admin/schemes/page.tsx
src/app/(app)/admin/schemes/[id]/page.tsx
```

Long-term preferred route:

```txt
src/app/(app)/admin/academics/schemes/page.tsx
src/app/(app)/admin/academics/schemes/[id]/review/page.tsx
```

### 16.4 Hooks

Update/add:

```txt
src/hooks/admin/useAdminSchemes.ts
src/hooks/admin/useAdminSchemeDetail.ts
src/hooks/admin/useReviewScheme.ts
src/hooks/admin/useActivateScheme.ts
src/hooks/admin/useArchiveScheme.ts
```

### 16.5 Components

Create:

```txt
src/components/admin/schemes/SchemeReviewDeskPage.tsx
src/components/admin/schemes/SchemeReviewFilters.tsx
src/components/admin/schemes/SchemeReviewQueueTable.tsx
src/components/admin/schemes/SchemeStatusBadge.tsx
src/components/admin/schemes/SchemeReviewActionMenu.tsx
src/components/admin/schemes/SchemeReviewDetailHeader.tsx
src/components/admin/schemes/SchemeItemsReviewTable.tsx
src/components/admin/schemes/SchemeReviewTimeline.tsx
src/components/admin/schemes/SchemeReviewDecisionModal.tsx
src/components/admin/schemes/SchemeActivationModal.tsx
```

---

## 17. Implementation Chunks

## Chunk 1 — Status & Review Model Cleanup

Tasks:

- Add `submitted`, `needs_revision`, `rejected` statuses.
- Migrate or map `in_review` to `submitted`.
- Update `SchemeReview` decisions.
- Add helper functions for valid transitions.

Acceptance criteria:

- Teacher submission results in `submitted` status.
- UI never displays raw `in_review`.
- Revision and rejection statuses are supported.

---

## Chunk 2 — Review Service Layer

Tasks:

- Create `scheme-review-service.ts`.
- Centralize submit, review, approve, request revision, reject, activate, archive logic.
- Add audit logging calls.
- Add active scheme conflict prevention.

Acceptance criteria:

- All review/activation routes use shared service logic.
- Invalid transitions are blocked.
- Active scheme conflict returns structured error.

---

## Chunk 3 — Admin Detail API

Tasks:

- Add `GET /api/admin/schemes/[id]`.
- Include scheme metadata, academic context, items, owner teacher, and reviews.
- Add permission check.

Acceptance criteria:

- Review detail page can load all required scheme information in one call.
- Reviewer can inspect the full scheme plan.

---

## Chunk 4 — Review Decision APIs

Tasks:

- Add generic `POST /api/admin/schemes/[id]/review`.
- Add or update request-revision and reject endpoints if separate endpoints are preferred.
- Update approve endpoint to use service logic.

Acceptance criteria:

- Admin/academic head can approve, request revision, and reject.
- Revision/rejection require comments.
- Review records are created.

---

## Chunk 5 — Activation Safeguards

Tasks:

- Update activation route.
- Block activation if another active scheme exists for same academic context.
- Add clear conflict response.
- Add activation review record and audit log.

Acceptance criteria:

- Cannot activate two schemes for the same subject/class/term context.
- UI displays a clear conflict message.

---

## Chunk 6 — Review Queue UI Rebuild

Tasks:

- Rebuild admin scheme page into a proper Review Desk.
- Add tabs.
- Add filters.
- Add premium table/cards.
- Add status badges.
- Add action menu.
- Add empty/loading/error states.

Acceptance criteria:

- Submitted schemes appear by default.
- Filters work.
- UI matches EduSentrix premium design.
- No raw browser-styled final controls remain.

---

## Chunk 7 — Review Detail UI

Tasks:

- Add scheme review detail page.
- Show metadata, teacher, academic context, scheme items, review timeline, and actions.
- Add action modals.

Acceptance criteria:

- Reviewer can inspect all scheme items before approving.
- Reviewer can approve/request revision/reject from detail page.
- Review timeline is visible.

---

## Chunk 8 — Permission Upgrade

Tasks:

- Add scheme review permissions.
- Replace `requireSchoolAdmin()` where appropriate with permission-based guards.
- Allow academic heads to review without full school-admin privileges.

Acceptance criteria:

- School admin can review all schemes.
- Academic head can review with correct permission.
- Unauthorized users cannot review or activate schemes.

---

## Chunk 9 — Polish & QA

Tasks:

- Add toasts.
- Add skeleton loaders.
- Add confirmation modals.
- Add responsive behavior.
- Test all status transitions.
- Test conflict handling.
- Test teacher resubmission after revision request.

Acceptance criteria:

- Full workflow works end-to-end.
- UI feels consistent with the rest of EduSentrix.
- No broken states or unclear actions.

---

## 18. End-to-End Acceptance Tests

### Test 1 — Teacher submits scheme

Given a teacher owns a draft scheme, when they submit it, then:

```txt
status = submitted
SchemeReview record created with decision=submitted
Admin Review Desk shows it under Submitted
```

### Test 2 — Reviewer approves scheme

Given a submitted scheme, when reviewer approves it, then:

```txt
status = approved
SchemeReview record created with decision=approved
Review timeline updates
```

### Test 3 — Reviewer requests revision

Given a submitted scheme, when reviewer requests revision with a note, then:

```txt
status = needs_revision
Teacher can edit it
Teacher sees reviewer note
Teacher can resubmit
```

### Test 4 — Reviewer rejects scheme

Given a submitted scheme, when reviewer rejects it with a reason, then:

```txt
status = rejected
Teacher cannot use it for Lesson Notes
Review timeline shows rejection reason
```

### Test 5 — Activate approved scheme

Given an approved scheme and no conflicting active scheme, when admin activates it, then:

```txt
status = active
Scheme becomes available for Lesson Note suggestions
Activation is logged
```

### Test 6 — Prevent active conflict

Given an active scheme already exists for the same subject/class/term, when admin activates another approved scheme for the same context, then:

```txt
activation is blocked
structured conflict error is returned
UI shows conflict message
```

### Test 7 — Review detail inspection

Given a submitted scheme, when reviewer opens detail page, then they can see:

```txt
metadata
academic context
owner teacher
all scheme items
review timeline
actions
```

### Test 8 — Permission enforcement

Given a user without `schemeOfWork.review`, when they access review endpoint/page, then:

```txt
access is denied
```

---

## 19. Final Expected Outcome

After this completion work, the Scheme Review Desk should support the intended EduSentrix academic planning workflow:

```txt
Teacher-created Scheme of Work
→ Review and quality control
→ Approval / revision / rejection
→ Activation
→ Lesson Note integration
→ Lessons and coverage tracking
```

The final Review Desk should feel like a premium academic operations tool, not a basic admin table.

It must allow school leaders to review what will actually be taught, ensure academic quality, and activate only the correct approved scheme for Lesson Notes and curriculum coverage.
