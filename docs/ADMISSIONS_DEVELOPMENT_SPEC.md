# EduSentrix Admissions — Development Spec

> Owner: Engineering (Admissions squad)
> Last updated: 2026-04-25
> Status: Active spec, Phase 1 in development

This document specifies the **Admissions** feature: a school can publish a public application form, accept applications across configurable channels, review and decide on each one, and on acceptance automatically provision the student + parent/guardian records linked to the right grade and class group.

The companion document is `docs/ADMISSIONS_ROADMAP.md`, which tracks the phased delivery plan.

---

## 1. Goals

1. **Schools can publish admissions in minutes**, with no prior CMS or marketing setup.
2. **Applicants get a clean, mobile-first form**, branded by the school, with sensible defaults that already capture the data the platform needs to provision a student.
3. **Schools can customise the form** by adding/removing optional questions and document requirements, but cannot remove "platform-required" fields.
4. **Admins can track applications end-to-end** — from submission through review, acceptance, payment (where applicable), and onboarding into the student roster.
5. **Acceptance auto-creates** the Student record, the Parent (Guardian) record, links them, places the student in the chosen grade and class group, and emails a branded acceptance letter.
6. **Admissions can be delegated** to a trusted teacher who manages everything from the same workspace, while the school admin retains full visibility.
7. **Distribution is flexible**: a public application page, an embeddable widget for the school's existing site, QR codes, direct invitation links, and a one-tap WhatsApp share.

Out of scope for v1:
- Aptitude/entrance exams, written tests, scheduling of in-person interviews.
- Application fees collection (we will support marking "fee paid" manually; integrated payment in a follow-up phase).
- Parent self-service portal showing application progress (Phase 5 polish).

---

## 2. Personas

| Persona | What they do |
|---|---|
| **School admin** | Owns admissions overall; configures cycles, edits the form, sets distribution, can delegate, sees everything. |
| **Admissions delegate (teacher)** | Same permissions as the admin within the Admissions feature. Reviews and decides. Cannot edit other school settings. |
| **Applicant (parent/guardian)** | Visits a public link, fills the form, uploads documents, submits, receives a tracking link/email. |
| **Co-applicant student (older)** | Sometimes the older student fills part of the form, but ownership of contact stays with the guardian for v1. |
| **System** | Sends emails, builds tracking links, provisions Student + Guardian on acceptance. |

---

## 3. Data model

All collections are scoped by `schoolId`. All `_id`s are MongoDB `ObjectId`.

### 3.1 `AdmissionCycle`
A "season" the school is admitting for. A school can have multiple cycles per year (e.g. mid-year intake) and at most one **published** cycle per intake-grade scope at a time.

| Field | Type | Notes |
|---|---|---|
| `schoolId` | `ObjectId` | Required, indexed. |
| `name` | `string` | E.g. "2026/2027 admissions". |
| `slug` | `string` | URL-friendly, unique per school (`/apply/:schoolId/:slug`). |
| `intakeGradeIds` | `ObjectId[]` | Grades this cycle accepts. Used for capacity warnings + form gradeId picker. |
| `targetAcademicPeriodId` | `ObjectId \| null` | Period the accepted student will be placed into. |
| `applicationFee` | `{ enabled, amountMinor, currency, mode: "manual_record" \| "online_paystack", instructions } \| null` | v1 ships with `manual_record` only. |
| `acceptsApplicationsFrom` | `Date` | Submissions outside the window are rejected. |
| `acceptsApplicationsUntil` | `Date \| null` | Optional. |
| `decisionDueBy` | `Date \| null` | For dashboards / SLA visibility. |
| `status` | `enum` | `draft`, `published`, `paused`, `closed`, `archived`. |
| `formId` | `ObjectId` | Reference to the form schema for this cycle. |
| `capacityByGradeId` | `Record<gradeId, number>` | Soft cap; warn when reached. |
| `waitlistEnabled` | `boolean` | If true, decisions can be `waitlist`. |
| `acceptanceTemplate` | `{ subject, htmlBody, replyToAlias }` | Editable acceptance email body. |
| `rejectionTemplate` | `{ subject, htmlBody }` | Editable rejection email body. |
| `branding` | `{ heroImageUrl?, accentColor?, welcomeMessage? }` | Optional overrides on top of school branding. |
| `delegate` | `{ userId, teacherId, assignedAt, assignedBy } \| null` | The currently delegated teacher, if any. |
| `analytics` | `{ totalSubmissions, byStatus, byChannel }` | Denormalized counters for dashboard. |
| `createdBy`, `updatedBy` | `ObjectId` | Audit. |

Indexes: `(schoolId, slug)` unique, `(schoolId, status)`.

### 3.2 `AdmissionForm`
The schema describing the questions for the cycle. We separate this from the cycle so we can version and track edits.

```ts
type AdmissionFormSection = {
  id: string;             // stable client-generated id (uuid)
  title: string;
  description?: string;
  fields: AdmissionFormField[];
  systemKey?: "applicant" | "guardian" | "academic" | "documents" | "additional";
};

type AdmissionFormField = {
  id: string;
  label: string;
  helpText?: string;
  type:
    | "short_text" | "long_text" | "email" | "phone" | "number"
    | "single_select" | "multi_select" | "boolean" | "date"
    | "address" | "country" | "file_upload" | "grade_picker";
  required: boolean;
  options?: { value: string; label: string }[];     // for selects
  validators?: { min?, max?, pattern?, maxFiles?, mimeTypes? };
  systemFieldKey?: AdmissionSystemFieldKey;          // see 3.3
  isPlatformRequired?: boolean;                      // cannot be removed/disabled
  visible: boolean;                                   // admins can hide non-required ones
  order: number;
};
```

| Form fields | Type | Notes |
|---|---|---|
| `schoolId` | `ObjectId` | |
| `cycleId` | `ObjectId` | |
| `version` | `number` | Bumps on every save; we keep a per-version snapshot to audit historical applications. |
| `sections` | `AdmissionFormSection[]` | |
| `documentRequirements` | `{ id, label, required, mimeTypes, maxSizeMb }[]` | Curated document slots. |
| `localeDefault` | `string` | E.g. "en". |
| `consentText` | `string` | Disclaimer/consent the applicant accepts on submit. |

### 3.3 Platform-required system fields

The platform needs the following data to provision a student + guardian. These fields are seeded by default and **cannot be removed or hidden**:

```
applicant.firstName        (short_text, required)
applicant.lastName         (short_text, required)
applicant.dateOfBirth      (date, required)
applicant.sex              (single_select: male/female, required)
applicant.intendedGradeId  (grade_picker, required)
guardian.firstName         (short_text, required)
guardian.lastName          (short_text, required)
guardian.relationship      (single_select, required)
guardian.email             (email, required)
guardian.phone             (phone, required)
consent.dataProcessing     (boolean, required)
```

Everything else (address, photo, prior school, languages, religion, special needs, etc.) is in the **default seed** but admins can hide or remove them. Admins can also add their own free-form questions.

### 3.4 `Application`

| Field | Type | Notes |
|---|---|---|
| `schoolId` | `ObjectId` | |
| `cycleId` | `ObjectId` | |
| `formVersion` | `number` | Snapshot of which form schema was used. |
| `referenceCode` | `string` | Friendly tracker, e.g. `ADM-7K3MN9`. |
| `submittedAt` | `Date` | Set when submission completes. |
| `channel` | `enum` | `public_link`, `embed`, `qr`, `direct_invite`, `whatsapp`, `internal`. |
| `referrer` | `string \| null` | Optional URL or invite id. |
| `applicant` | `{ firstName, lastName, sex, dateOfBirth, intendedGradeId, photoUrl?, … }` | Resolved required + optional values. |
| `guardian` | `{ firstName, lastName, relationship, email, phone, address?, occupation?, … }` | |
| `additional` | `Record<fieldId, value>` | Custom fields keyed by formField.id. |
| `documents` | `{ requirementId, label, fileUrl, fileName, sizeBytes, mimeType, uploadedAt }[]` | Curated uploads. |
| `status` | `enum` | `submitted`, `under_review`, `interview_scheduled`, `accepted`, `rejected`, `waitlisted`, `withdrawn`, `expired`. |
| `decision` | `{ outcome, decidedBy, decidedAt, targetGradeId, targetClassGroupId, notes }` | Set when a decision is recorded. |
| `provisioned` | `{ studentId, guardianId, parentUserId, provisionedAt } \| null` | Set on acceptance flow completion. |
| `tracker` | `{ token, lastViewedAt, lastViewedIp }` | Used for the public tracking page. |
| `assignedReviewerId` | `ObjectId \| null` | Optional reviewer. |
| `feeStatus` | `enum` | `not_required`, `pending`, `paid`, `waived`. |
| `notesPrivate` | `string` | Admins-only notes (markdown). |

Indexes: `(schoolId, cycleId, status)`, `(schoolId, referenceCode)` unique.

### 3.5 `AdmissionEvent` (audit/timeline)

A simple append-only timeline used in the application drawer.

| Field | Type | Notes |
|---|---|---|
| `applicationId` | `ObjectId` | |
| `cycleId` | `ObjectId` | |
| `schoolId` | `ObjectId` | |
| `actor` | `{ userId?, role, label }` | `applicant` for the public flow. |
| `kind` | `enum` | `submitted`, `viewed`, `note_added`, `status_changed`, `decision_recorded`, `email_sent`, `provisioned`, `delegate_assigned`, `cycle_published`, `cycle_paused`, `form_updated`, etc. |
| `metadata` | `Record<string, unknown>` | Free-form. |
| `at` | `Date` | |

### 3.6 `AdmissionInviteLink`

For "Direct invite" + "QR" channels. Every QR/short link resolves to an invite, allowing us to attribute submissions and show analytics.

| Field | Type | Notes |
|---|---|---|
| `schoolId`, `cycleId` | `ObjectId` | |
| `code` | `string` | Short URL-safe id (8 chars). |
| `label` | `string` | E.g. "Open Day flyer", "Parent A". |
| `channel` | `enum` | `direct_invite`, `qr`, `whatsapp`. |
| `targetEmail` | `string \| null` | When emailed to a specific person. |
| `targetPhone` | `string \| null` | For WhatsApp. |
| `expiresAt` | `Date \| null` | |
| `usageCount` | `number` | Increments on visit. |
| `submissionCount` | `number` | Increments when an application is submitted via this code. |
| `createdBy` | `ObjectId` | |

---

## 4. Permissions and roles

### 4.1 Subrole

We add a new teacher subrole **`admissions_officer`**. It's stored as a string in `UserMembership.subroles` (and mirrored in `Teacher.subroles` for already-running teacher tooling).

A teacher with `admissions_officer`:
- Sees the **Admissions** nav item in their sidebar.
- Has full read/write access to the Admissions feature for their school, **including** the ability to publish/pause/close cycles, edit forms, decide on applications, and trigger acceptance provisioning.
- Cannot edit other school settings, and cannot revoke their own delegation (only the school admin can).

### 4.2 Role gate

`gateAdmissionsManager(roles, subroles)` returns OK if `roles.includes("school_admin")` OR `subroles.includes("admissions_officer")`.

`requireAdmissionsManager(req)` is the API helper used by every Admissions endpoint.

For read-only visibility (the admin should always see what's happening even without delegation), we keep using `requireSchoolAdmin` where the action is clearly an admin-only escalation (e.g. assigning/revoking the delegate).

### 4.3 Audit visibility

The school admin can read every admissions activity. Delegated teachers can only see admissions activity for their own school.

---

## 5. APIs

All routes live under `src/app/api/admin/admissions/*` with `requireAdmissionsManager`. Public-facing routes live under `src/app/api/public/admissions/*` and are added to the middleware allow-list.

### 5.1 Cycles
- `GET   /api/admin/admissions/cycles`
- `POST  /api/admin/admissions/cycles`
- `GET   /api/admin/admissions/cycles/:cycleId`
- `PATCH /api/admin/admissions/cycles/:cycleId`
- `POST  /api/admin/admissions/cycles/:cycleId/publish`
- `POST  /api/admin/admissions/cycles/:cycleId/pause`
- `POST  /api/admin/admissions/cycles/:cycleId/close`
- `POST  /api/admin/admissions/cycles/:cycleId/duplicate`

### 5.2 Form schema
- `GET   /api/admin/admissions/cycles/:cycleId/form`
- `PUT   /api/admin/admissions/cycles/:cycleId/form` (full replace, bumps version)
- `POST  /api/admin/admissions/cycles/:cycleId/form/reset` (reset to platform defaults; preserves required fields)

### 5.3 Applications
- `GET   /api/admin/admissions/cycles/:cycleId/applications` (filter by status, channel, grade, search)
- `GET   /api/admin/admissions/applications/:applicationId`
- `PATCH /api/admin/admissions/applications/:applicationId/status`
- `POST  /api/admin/admissions/applications/:applicationId/notes`
- `POST  /api/admin/admissions/applications/:applicationId/decision` (records decision; on accept, queues provisioning)
- `POST  /api/admin/admissions/applications/:applicationId/provision` (idempotent: creates Student, Guardian, links them, sends acceptance email)
- `POST  /api/admin/admissions/applications/:applicationId/withdraw`
- `POST  /api/admin/admissions/applications/:applicationId/resend-tracker-link`

### 5.4 Distribution
- `GET   /api/admin/admissions/cycles/:cycleId/distribution` (returns public URL, embed snippet, QR code data URL, list of invite links)
- `POST  /api/admin/admissions/cycles/:cycleId/invite-links`
- `DELETE /api/admin/admissions/invite-links/:linkId`

### 5.5 Delegation
- `GET   /api/admin/admissions/delegate` (current delegate)
- `POST  /api/admin/admissions/delegate` (assign a teacher, body: `{ teacherId }`)
- `DELETE /api/admin/admissions/delegate` (revoke)

### 5.6 Public
- `GET  /api/public/admissions/cycles/:schoolId/:slug` — returns the rendered form schema + branding (no PII).
- `POST /api/public/admissions/cycles/:schoolId/:slug/applications` — receive an application. Rate-limited and protected with hCaptcha (or simple honeypot in v1).
- `GET  /api/public/admissions/applications/:referenceCode/track?token=...` — read-only application status for the applicant.
- `POST /api/public/admissions/uploads/:cycleId/sign` — server-issued upload URL (UploadThing wrapper) tied to the cycle, max sizes enforced.
- `GET  /api/public/admissions/invite/:code` — resolves an invite link, returns redirect URL with the channel attribution.

---

## 6. UI

### 6.1 Admin sidebar entry
- New nav item under **People** in the school admin sidebar: **Admissions** (`/admin/admissions`).
- For teachers with `admissions_officer`: a new section **Admissions** appears in their sidebar with a single item linking to `/teacher/admissions`. Both pages render the same React workspace; the layout decides which header to show.

### 6.2 Workspace tabs

`/admin/admissions` (and `/teacher/admissions`) is a tabbed workspace:

1. **Overview** — current open cycle KPIs, stage funnel, recent submissions, Leo guidance card.
2. **Applications** — Kanban board (`Submitted → Under review → Decision pending → Accepted/Rejected/Waitlisted`) **and** a table view, with filters by grade, channel, date.
3. **Form builder** — drag-and-drop sections + fields; required fields are pinned; document slots editor.
4. **Distribution** — show the public link, copy buttons, embed snippet, QR generator, WhatsApp share button, invite-link manager.
5. **Cycles** — create/duplicate/publish/pause/close cycles, set capacity per grade, set window dates, edit acceptance/rejection email templates.
6. **Delegation** (admin only) — pick a teacher, see who's currently delegated, audit trail.
7. **Audit** — chronological feed of all admissions events.

The teacher view hides the **Delegation** tab.

### 6.3 Application drawer

Clicking an application opens a right-side drawer with:
- Applicant + guardian summary.
- Rendered answers grouped by section.
- Documents list (preview + download).
- Decision panel (target grade + class, notes).
- Acceptance email preview before sending.
- Timeline (events).

### 6.4 Public application page

Route: `/apply/[schoolId]/[slug]`.
- Branded with school name + logo + accent color.
- Mobile-first, single-column, sectioned with a progress indicator.
- Saves draft to `localStorage` keyed by `${cycleId}` so a parent can resume from the same device.
- Captures the `channel` and `referrer` from the URL (e.g. `?via=open_day_flyer`).
- On submit: assigns reference code, shows confirmation page with the tracking URL and email confirmation.

### 6.5 Public tracker page

Route: `/track/admissions/[referenceCode]?token=...`.
- Shows the current status, last update, and any next-step instructions (paying the application fee, awaiting interview, etc.).
- Allows uploading missing documents only when the admin requests them.

### 6.6 Embeddable widget

A single `<script>` snippet schools paste in their site:

```html
<script src="https://app.edusentrix.com/embed/admissions.js" data-school="<schoolId>" data-cycle="<slug>"></script>
<div id="edusentrix-admissions"></div>
```

The script renders a button "Apply now" that opens the public form in a modal (iframe). Phase 3 work — out of scope for Phase 1.

---

## 7. Provisioning on acceptance

When an admin records an `accept` decision (with a target grade + class group):

1. We **do not** create the Student immediately; we move the application to `accepted` and require an explicit "Provision now" button (or auto-provision toggle in the cycle settings).
2. On provision:
   1. Create or find a User by guardian email (Clerk invitation if new, with `role: "parent"`).
   2. Create the Student doc with `firstName`, `lastName`, `sex`, `dateOfBirth`, `gradeId`, `classGroupId`, `photoUrl`, `platformApplicationId = applicationId`, `status: "active"`.
   3. Create a Guardian doc linking the Student to the User, `relationship`, `email`, `phone`, `isPrimary: true`.
   4. Increment denormalized counters and set `application.provisioned = { studentId, guardianId, parentUserId, provisionedAt }`.
   5. Send the branded acceptance email (with reply-to alias for the school).
   6. Append `provisioned` and `email_sent` events to the timeline.

Provisioning is idempotent: re-running the endpoint returns the existing IDs.

---

## 8. Distribution channels (v1 scope: A, B, D, E, F)

| Channel | What we ship | Notes |
|---|---|---|
| **A. Public application page** | `/apply/[schoolId]/[slug]` | Live in Phase 1. |
| **B. Embeddable widget** | `/embed/admissions.js` + iframe modal | Phase 3. |
| **D. QR codes** | Server-rendered SVG/PNG download in the Distribution tab | Phase 2. |
| **E. Direct invite link** | Per-recipient short links via `AdmissionInviteLink` | Phase 2. |
| **F. WhatsApp share** | Pre-formatted `wa.me/?text=...` link with the school's apply URL | Phase 2. |

Each channel sets `application.channel` so admins can see where applications come from.

---

## 9. Notifications & email

- **Acceptance** — branded email using the cycle's editable template, with the school logo + name; reply-to is the existing inbound alias.
- **Rejection** — gentle template, no PII beyond the applicant name.
- **Waitlist** — explanatory + expected next-update date.
- **Application received** — auto-confirmation to the guardian, includes the reference code + tracking URL.
- **Document request** — when the admin requests an extra document, the parent is emailed with a link to upload it via the tracker page.
- **Internal weekly digest (Phase 5)** — number of new applications, decisions due, capacity status.

All emails go through `sendTrackedBrevoEmail` and re-use `renderGenericBrandedEmail`.

---

## 10. Leo integration (Phase 4)

- **Public form helper** — small "Need help?" widget on the public page, powered by a constrained Leo prompt that only answers school + admissions questions, with no PII access.
- **Admin decision support** — Leo guidance card on the application drawer: highlights conflicts (DOB vs grade fit, fee unpaid, missing documents, capacity warning). Suggests a "Next action" pill (e.g. "Request birth certificate", "Move to waitlist — Grade 1 capacity reached").
- **Form quality check** — when the admin saves the form builder, Leo flags ambiguous wording, unreachable conditional logic, or duplicate fields.

---

## 11. Security & rate limiting

- Public form endpoints rate-limited per IP and per `cycleId` (e.g. 5 submissions / IP / 10 minutes; 200 / cycle / hour).
- File uploads gated through a server-issued signed UploadThing token tied to the cycle.
- All PII in the application drawer is read-only by default; editing requires an explicit "Correct application" action that is audited.
- Acceptance emails never contain login credentials; they include a Clerk magic link for the parent to set their password.
- The tracker token is opaque and rotates on demand if the admin re-issues the link.

---

## 12. Telemetry

- `admissions.cycle.created`
- `admissions.cycle.published`
- `admissions.application.submitted` (with `channel`)
- `admissions.application.decided` (with `outcome`)
- `admissions.application.provisioned`
- `admissions.delegate.assigned` / `revoked`

These power the Overview KPIs and a future funnel analysis.

---

## 13. Migration notes

- New collections only — no destructive migration.
- Adds a new value to `UserMembership.subroles` and `Teacher.subroles` (both already free-form `string[]`), so no schema change needed.
- Adds the `admissions` feature key to `feature-access.ts`. Default tiers include it; we keep the gating server-side too.
- Re-uses the existing `Activity` collection for cross-cutting school events (e.g. delegate assigned), and the new `AdmissionEvent` collection for the application timeline.

---

## 14. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Schools accidentally publish a cycle with the wrong window dates. | "Publish" requires a confirmation modal that summarises window, capacity, channels, and shows the public URL. |
| Parents abandon long forms. | Mobile-first single column, draft autosave, per-section progress indicator, optional fields collapsed by default. |
| Capacity exceeded. | Soft cap with admin-visible warning; if `waitlistEnabled`, decisions auto-suggest waitlist after cap. |
| Provisioning collisions (parent already exists). | Provisioning service deduplicates by `email + schoolId`, links existing User if found. |
| Spam submissions on the public form. | Honeypot + IP rate limit in v1; hCaptcha when traffic warrants. |
| Delegate teacher leaves the school. | On role removal, the active cycle's `delegate` is cleared and the school admin is notified. |

---

## 15. File layout

```
src/
  models/
    AdmissionCycle.ts
    AdmissionForm.ts
    Application.ts                 (new — different from Platform Application)
    AdmissionEvent.ts
    AdmissionInviteLink.ts
  lib/
    admissions/
      defaults.ts                  (default form schema + required field keys)
      types.ts
      access.ts                    (role gate + delegate helpers)
      service.ts                   (CRUD + provisioning service layer)
      provisioning.ts              (acceptance → Student + Guardian)
      email.ts                     (acceptance/rejection/waitlist senders)
      distribution.ts              (URL builders, QR rendering, invite codes)
  app/
    api/
      admin/admissions/...         (protected admin APIs)
      public/admissions/...        (public form + tracker APIs)
    (app)/
      admin/admissions/page.tsx
      teacher/admissions/page.tsx
    apply/[schoolId]/[slug]/page.tsx
    track/admissions/[referenceCode]/page.tsx
  components/
    admissions/
      AdmissionsWorkspace.tsx
      OverviewTab.tsx
      ApplicationsBoard.tsx
      ApplicationDrawer.tsx
      FormBuilder.tsx
      CyclesTab.tsx
      DistributionTab.tsx
      DelegationTab.tsx
      AuditTab.tsx
      LeoAdmissionsGuide.tsx        (Phase 4)
      public/
        PublicApplicationForm.tsx
        PublicTrackerView.tsx
  hooks/
    admissions/
      useAdmissionCycles.ts
      useAdmissionCycle.ts
      useAdmissionForm.ts
      useApplications.ts
      useAdmissionDelegate.ts
      useAdmissionDistribution.ts
```
