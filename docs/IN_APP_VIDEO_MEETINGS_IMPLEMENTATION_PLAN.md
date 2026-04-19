# In-App Video Meetings Implementation Plan

> **Version**: 1.0  
> **Date**: April 18, 2026  
> **Audience**: Engineering, product, QA  
> **Source spec**: `docs/IN_APP_VIDEO_MEETINGS_SPEC.md`

---

## 1. Delivery Strategy

1. Treat this as a staged rollout, not one feature drop.
2. Run the LiveKit spike before locking milestone estimates.
3. Ship the first pilot slice narrowly:
   - school-admin scheduling only
   - one-to-one and manual small-group parent meetings
   - web scheduling
   - web join
   - mobile join
4. Add teacher and bursar scheduling only after the privacy and authorization matrix is proven.
5. Add broad audience meetings only after participant-resolution performance and reminder delivery are stable.

---

## 2. Ticket Conventions

1. Prefixes:
   - `MEET-SPIKE-*` technical spike
   - `MEET-BE-*` backend and domain
   - `MEET-FE-*` web frontend
   - `MEET-MOB-*` mobile
   - `MEET-QA-*` quality, release, and hardening
2. Each ticket includes:
   - Scope
   - Suggested files
   - Dependencies
   - Deliverables
   - Acceptance criteria

---

## 3. Short LiveKit Spike Checklist

### MEET-SPIKE-001: LiveKit Feasibility Spike

1. Scope:
   - Validate the chosen provider path before full implementation.
2. Checklist:
   - Add temporary envs for LiveKit URL, API key, and secret.
   - Generate one server-issued token for a known authenticated user.
   - Join one room from a web client.
   - Join the same room from the mobile app or Expo test client.
   - Confirm mic/camera permission flow on mobile.
   - Confirm reconnect behavior after backgrounding the mobile app.
   - Receive and verify at least one webhook event.
   - Confirm deterministic room naming and participant identity format.
   - Confirm host permissions vs parent participant permissions.
   - Record spike findings: blockers, SDK caveats, recommended Phase 1 cuts.
3. Expected output:
   - one working token issuance path
   - one working web join
   - one working mobile join
   - one verified webhook
   - a short findings note appended to the implementation plan or spec
4. Acceptance criteria:
   - engineering can prove LiveKit works for both web and mobile join
   - no critical blocker remains unclassified
   - Phase 1 estimates are revised using spike learnings

---

## 4. Backend Tickets

### MEET-BE-001: Core Models and Indexes

1. Scope:
   - Add `Meeting`, `MeetingParticipant`, and `MeetingProviderEvent` models.
   - Add required indexes for school, host, participant, and provider event lookup.
2. Suggested files:
   - `src/models/Meeting.ts`
   - `src/models/MeetingParticipant.ts`
   - `src/models/MeetingProviderEvent.ts`
3. Dependencies: `MEET-SPIKE-001`
4. Deliverables:
   - schemas compile cleanly
   - indexes reflect spec requirements
   - no changes to existing working models
5. Acceptance criteria:
   - models build without type errors
   - indexes exist for primary query paths
   - no existing route or build regression

### MEET-BE-002: Calendar Audience Extension for Private Meetings

1. Scope:
   - Extend academic calendar audience support to `specific_users`.
   - Update audience helpers and calendar APIs so private meetings do not leak.
2. Suggested files:
   - `src/models/AcademicCalendarEvent.ts`
   - `src/lib/academic-calendar/types.ts`
   - `src/lib/academic-calendar/audience.ts`
   - `src/lib/academic-calendar/recipients.ts`
   - `src/app/api/teacher/calendar/route.ts`
   - `src/app/api/parent/calendar/route.ts`
   - any admin/student calendar routes using shared audience logic
3. Dependencies: `MEET-BE-001`
4. Deliverables:
   - `specific_users` audience shape
   - calendar filtering updated for private visibility
   - optional meeting metadata in calendar payloads
5. Acceptance criteria:
   - private events are visible only to invited users
   - unrelated parents and teachers do not see private meeting events
   - broad calendar behavior remains unchanged

### MEET-BE-003: Shared Meetings Domain and Provider Adapter

1. Scope:
   - Create shared meetings service layer and provider abstraction.
   - Implement LiveKit adapter for room readiness, token issuance, webhook verification, and room end.
2. Suggested files:
   - `src/lib/meetings/createMeeting.ts`
   - `src/lib/meetings/updateMeeting.ts`
   - `src/lib/meetings/cancelMeeting.ts`
   - `src/lib/meetings/resolveParticipants.ts`
   - `src/lib/meetings/authorizeMeetingAccess.ts`
   - `src/lib/meetings/issueJoinToken.ts`
   - `src/lib/meetings/handleProviderWebhook.ts`
   - `src/lib/meetings/syncMeetingState.ts`
   - `src/lib/meetings/meetingAudit.ts`
   - `src/lib/meetings/meetingNotifications.ts`
   - `src/lib/meetings/providers/livekit.ts`
3. Dependencies: `MEET-BE-001`, `MEET-SPIKE-001`
4. Deliverables:
   - provider adapter contract
   - deterministic room naming
   - participant identity format
   - short-lived join-token service
5. Acceptance criteria:
   - join token is server-issued only
   - invite-only authorization is enforced
   - provider-specific logic is isolated behind adapter code

### MEET-BE-004: Admin Scheduling APIs for Narrow Pilot Slice

1. Scope:
   - Build school-admin meetings APIs for create, list, detail, update, cancel, start, and end.
   - Limit Phase 1 audience support to one-to-one and manual small-group meetings.
2. Suggested files:
   - `src/app/api/admin/meetings/route.ts`
   - `src/app/api/admin/meetings/[meetingId]/route.ts`
   - `src/app/api/admin/meetings/[meetingId]/cancel/route.ts`
   - `src/app/api/admin/meetings/[meetingId]/start/route.ts`
   - `src/app/api/admin/meetings/[meetingId]/end/route.ts`
3. Dependencies: `MEET-BE-002`, `MEET-BE-003`
4. Deliverables:
   - validated create/update payloads
   - linked calendar-event creation
   - draft/scheduled/live/ended/cancelled lifecycle
5. Acceptance criteria:
   - school admin can create and manage narrow-scope meetings
   - linked private calendar event is created correctly
   - invalid invitees or unauthorized audiences are rejected

### MEET-BE-005: Parent Read, Response, and Shared Join APIs

1. Scope:
   - Build parent list/detail/respond flows and shared join-token route.
   - Support confirm, decline, and join for invited parents.
2. Suggested files:
   - `src/app/api/parent/meetings/route.ts`
   - `src/app/api/parent/meetings/[meetingId]/route.ts`
   - `src/app/api/parent/meetings/[meetingId]/respond/route.ts`
   - `src/app/api/meetings/[meetingId]/route.ts`
   - `src/app/api/meetings/[meetingId]/join-token/route.ts`
3. Dependencies: `MEET-BE-004`
4. Deliverables:
   - participant-scoped meeting read APIs
   - response status updates
   - join-token issuance gate checks
5. Acceptance criteria:
   - invited parents can see only their meetings
   - non-invited users receive forbidden responses
   - removed or cancelled participants cannot receive valid join tokens

### MEET-BE-006: Notifications and Reminder Dispatch

1. Scope:
   - Create meeting notifications and reminder dispatch for in-app and email.
   - Keep meeting reminders in the meetings domain, not the calendar reminder model.
2. Suggested files:
   - `src/lib/meetings/meetingNotifications.ts`
   - `src/app/api/internal/meetings/reminders/route.ts` or internal job equivalent
   - any additive notification/email adapters needed
3. Dependencies: `MEET-BE-004`, `MEET-BE-005`
4. Deliverables:
   - invite notifications
   - reminder notifications
   - cancel/reschedule notifications
5. Acceptance criteria:
   - reminder failures do not block meeting access
   - invite and reminder copy includes meeting context
   - duplicate reminder sends are prevented or safely idempotent

### MEET-BE-007: Webhooks, Lifecycle Sync, and Recovery

1. Scope:
   - Persist and process provider events.
   - Reconcile app meeting state with provider events.
   - Add force-end and lifecycle recovery support.
2. Suggested files:
   - `src/app/api/webhooks/meetings/livekit/route.ts`
   - `src/lib/meetings/handleProviderWebhook.ts`
   - `src/lib/meetings/syncMeetingState.ts`
   - internal ops route or utility for force-end if approved
3. Dependencies: `MEET-BE-003`, `MEET-BE-004`
4. Deliverables:
   - verified webhook ingestion
   - `live` -> `ended` recovery
   - queryable provider-event history
5. Acceptance criteria:
   - webhook signatures are verified
   - meetings stuck in `live` can be recovered
   - provider drift does not leave meetings permanently inconsistent

### MEET-BE-008: Teacher Scheduling APIs

1. Scope:
   - Add teacher create/list/detail/update/cancel/start/end APIs.
   - Enforce homeroom and assignment-based parent access rules.
2. Suggested files:
   - `src/app/api/teacher/meetings/route.ts`
   - `src/app/api/teacher/meetings/[meetingId]/route.ts`
   - `src/app/api/teacher/meetings/[meetingId]/cancel/route.ts`
   - `src/app/api/teacher/meetings/[meetingId]/start/route.ts`
   - `src/app/api/teacher/meetings/[meetingId]/end/route.ts`
3. Dependencies: `MEET-BE-004`, `MEET-BE-005`
4. Deliverables:
   - teacher-scoped scheduling APIs
   - guardrails for allowed students and guardians
5. Acceptance criteria:
   - teachers cannot schedule meetings with unrelated parents
   - homeroom and assignment checks match existing messaging constraints

### MEET-BE-009: Bursar Scheduling APIs

1. Scope:
   - Add bursar scheduling through shared admin meetings surface.
   - Constrain bursar meetings to finance-safe contexts.
2. Suggested files:
   - additive logic in `src/app/api/admin/meetings/**`
   - `src/lib/meetings/authorizeMeetingAccess.ts`
   - `src/components/auth/admin-role-path-guard.tsx` if route access changes are needed
3. Dependencies: `MEET-BE-004`, `MEET-BE-005`
4. Deliverables:
   - bursar create/list/detail/update/cancel/start/end support
   - finance-safe access checks
5. Acceptance criteria:
   - bursars can schedule finance meetings with parents
   - bursars cannot access unrelated academic private meeting contexts
   - route guard changes do not weaken existing bursar restrictions unintentionally

### MEET-BE-010: Broad Audience Resolution and Background Processing

1. Scope:
   - Support class-wide, grade-wide, school-wide, and PTA meetings.
   - Add staged participant resolution for large audiences.
2. Suggested files:
   - `src/lib/meetings/resolveParticipants.ts`
   - optional internal draft-resolution route or job runner
   - additive admin meetings API logic
3. Dependencies: `MEET-BE-008`, `MEET-BE-009`
4. Deliverables:
   - class/grade/school parent resolution
   - aggregate count-first resolution behavior
   - background draft resolution for very large audiences
5. Acceptance criteria:
   - large meetings do not freeze the composer flow
   - participant summaries appear quickly even when full row rendering is deferred

---

## 5. Web Frontend Tickets

### MEET-FE-001: Navigation and Entry Points

1. Scope:
   - Add meetings navigation items for school admin, teacher, parent, and bursar.
   - Add contextual entry points from student, calendar, teacher, and finance surfaces.
2. Suggested files:
   - `src/components/nav/sidebars/school-admin-sidebar.tsx`
   - `src/components/nav/sidebars/teacher-sidebar.tsx`
   - `src/components/nav/sidebars/parent-sidebar.tsx`
   - `src/components/nav/sidebars/bursar-sidebar.tsx`
   - contextual student/teacher/finance pages as needed
3. Dependencies: `MEET-BE-004`
4. Deliverables:
   - sidebar links
   - CTA entry points like `Schedule Meeting`
5. Acceptance criteria:
   - navigation works on desktop and mobile shells
   - bursar routes remain valid under the current path-guard model

### MEET-FE-002: Admin Meetings List and Detail

1. Scope:
   - Build `/admin/meetings` and `/admin/meetings/[meetingId]`.
   - Include filters, status badges, participant summaries, and lifecycle actions.
2. Suggested files:
   - `src/app/(app)/admin/meetings/page.tsx`
   - `src/app/(app)/admin/meetings/[meetingId]/page.tsx`
   - `src/components/admin/meetings/**`
   - `src/hooks/admin/useAdminMeetings.ts`
3. Dependencies: `MEET-FE-001`, `MEET-BE-004`
4. Deliverables:
   - list page
   - detail page
   - empty/loading/error states
5. Acceptance criteria:
   - school admin can review and manage meetings without leaving the admin shell
   - UI follows current premium admin patterns

### MEET-FE-003: Admin Scheduling Composer

1. Scope:
   - Build the 3-step scheduler flow for school admin.
   - Support one-to-one and manual small-group meetings first.
2. Suggested files:
   - `src/components/admin/meetings/MeetingComposer.tsx`
   - `src/components/admin/meetings/MeetingAudienceStep.tsx`
   - `src/components/admin/meetings/MeetingScheduleStep.tsx`
   - `src/components/admin/meetings/MeetingReviewStep.tsx`
3. Dependencies: `MEET-BE-004`, `MEET-BE-005`
4. Deliverables:
   - staged composer
   - resolved participant preview
   - create/edit flows
5. Acceptance criteria:
   - admin can schedule a private parent meeting in a guided flow
   - unresolved guardians without app access are surfaced cleanly

### MEET-FE-004: Parent Meetings Pages

1. Scope:
   - Build parent meetings list and detail pages with confirm/decline and join states.
2. Suggested files:
   - `src/app/(app)/parent/meetings/page.tsx`
   - `src/app/(app)/parent/meetings/[meetingId]/page.tsx`
   - `src/components/parent/meetings/**`
   - `src/hooks/parent/useParentMeetings.ts`
3. Dependencies: `MEET-BE-005`
4. Deliverables:
   - meetings list
   - detail page
   - response controls
5. Acceptance criteria:
   - parent sees only invited meetings
   - parent UX is simpler than staff UX and consistent with existing parent pages

### MEET-FE-005: Shared Join and Preflight Web Flow

1. Scope:
   - Build `/meetings/[meetingId]/join`.
   - Include preflight, permission messaging, and handoff into the provider room.
2. Suggested files:
   - `src/app/(app)/meetings/[meetingId]/join/page.tsx` or equivalent app route
   - `src/components/meetings/join/**`
3. Dependencies: `MEET-BE-005`, `MEET-BE-007`
4. Deliverables:
   - join preflight page
   - token fetch path
   - provider room shell
5. Acceptance criteria:
   - invited users can join from a single authenticated entry path
   - blocked users fail gracefully with clear copy

### MEET-FE-006: Teacher Meetings UI

1. Scope:
   - Add teacher list/detail/scheduler flows under teacher communication.
2. Suggested files:
   - `src/app/(app)/teacher/communication/meetings/page.tsx`
   - `src/app/(app)/teacher/communication/meetings/[meetingId]/page.tsx`
   - `src/components/teacher/meetings/**`
   - `src/hooks/teacher/useTeacherMeetings.ts`
3. Dependencies: `MEET-BE-008`
4. Deliverables:
   - teacher meeting list
   - detail
   - scheduler entry points from teacher surfaces
5. Acceptance criteria:
   - teacher can schedule only with allowed guardians
   - teacher meeting UI matches existing teacher shell and communication styling

### MEET-FE-007: Bursar Meetings UI

1. Scope:
   - Expose finance-focused meetings inside the bursar/admin finance shell.
2. Suggested files:
   - additive admin meetings UI filters or finance-context entry points
   - `src/components/admin/meetings/**` or `src/components/bursar/meetings/**`
3. Dependencies: `MEET-BE-009`
4. Deliverables:
   - finance-context meetings list filter
   - bursar scheduling entry points
5. Acceptance criteria:
   - bursars can schedule and manage finance meetings without breaking the current finance UX

### MEET-FE-008: Broad Audience Admin UX

1. Scope:
   - Extend admin composer and list/detail pages for class, grade, school-wide, and PTA meetings.
   - Add count-first participant-resolution UI behavior.
2. Suggested files:
   - additive `src/components/admin/meetings/**`
3. Dependencies: `MEET-BE-010`
4. Deliverables:
   - broad-audience audience selectors
   - staged large-group resolution UX
5. Acceptance criteria:
   - class/grade/PTA scheduling is understandable and does not lock the UI on large groups

---

## 6. Mobile Tickets

### MEET-MOB-001: Shared Mobile Meetings Contract

1. Scope:
   - Define or update mobile API contracts for meetings list/detail/respond/join.
   - Align payloads with existing mobile patterns and auth flow.
2. Suggested files:
   - `docs/MOBILE_API_CONTRACT_CHECKLIST.md`
   - additive mobile contract docs as needed
3. Dependencies: `MEET-BE-005`
4. Deliverables:
   - agreed payload shapes for mobile consumers
   - deep-link contract for meeting detail and join
5. Acceptance criteria:
   - mobile team has a stable contract before screen implementation starts

### MEET-MOB-002: Mobile Join, Preflight, and In-Call Shell

1. Scope:
   - Build mobile meeting detail -> preflight -> join flow.
   - Support permission prompts, reconnect, and leave behavior.
2. Suggested files:
   - mobile app screens/components under the mobile repo
3. Dependencies: `MEET-SPIKE-001`, `MEET-BE-005`, `MEET-BE-007`
4. Deliverables:
   - meeting detail screen
   - preflight screen
   - LiveKit join shell
5. Acceptance criteria:
   - invited parent and staff user can join from mobile
   - background/foreground reconnect behavior is acceptable for pilot use

### MEET-MOB-003: Mobile Parent Meetings List and Response

1. Scope:
   - Build parent meetings list, detail, confirm/decline, and join CTA.
2. Suggested files:
   - mobile app parent meetings screens/components
3. Dependencies: `MEET-MOB-001`, `MEET-BE-005`
4. Deliverables:
   - meetings list
   - detail and response states
5. Acceptance criteria:
   - parent can review, respond to, and join invited meetings from mobile

### MEET-MOB-004: Mobile Staff Scheduling

1. Scope:
   - Build mobile meeting creation for school admin first, then teacher and bursar.
   - Use bottom sheets and staged forms matching mobile UI guidance.
2. Suggested files:
   - mobile app admin/teacher/bursar meetings create screens/components
3. Dependencies: `MEET-BE-008`, `MEET-BE-009`, `MEET-MOB-001`
4. Deliverables:
   - mobile scheduling flow
   - mobile audience selector
   - mobile review/publish step
5. Acceptance criteria:
   - scheduling flow is touch-friendly and consistent with mobile design rules
   - if this ticket slips, Phase 1 pilot can still proceed with mobile join only

---

## 7. QA and Release Tickets

### MEET-QA-001: Access Matrix and Privacy Test Coverage

1. Scope:
   - Build automated and manual coverage for the roles enabled in the current release slice.
   - Start with school-admin and parent private-meeting visibility for the narrow pilot slice, then expand when teacher and bursar scheduling ship.
2. Dependencies: `MEET-BE-005`, `MEET-FE-005`
3. Deliverables:
   - test matrix for school admin and parent in the pilot slice
   - private visibility scenarios
4. Acceptance criteria:
   - private meetings do not leak through list pages, detail pages, or calendar APIs
   - non-invited users cannot join

### MEET-QA-002: Notification and Reminder Reliability Testing

1. Scope:
   - Validate invite, reminder, cancel, and reschedule notifications.
2. Dependencies: `MEET-BE-006`
3. Deliverables:
   - test checklist for in-app and email reminders
   - degraded-state checks for failed deliveries
4. Acceptance criteria:
   - reminder failures are visible in logs and do not block join access

### MEET-QA-003: Pilot Ops and Recovery Readiness

1. Scope:
   - Validate runbook actions and lifecycle recovery before pilot use.
2. Dependencies: `MEET-BE-007`
3. Deliverables:
   - checklist for stuck `live` meeting recovery
   - force-end validation
   - webhook verification failure scenario
4. Acceptance criteria:
   - operations can recover common failure modes without ad hoc DB edits

### MEET-QA-004: Broad Audience Performance and Rollout Gate

1. Scope:
   - Validate large-group participant resolution and rollout readiness for class/grade/PTA meetings.
2. Dependencies: `MEET-BE-010`, `MEET-FE-008`
3. Deliverables:
   - performance test notes
   - rollout gate recommendation for broad meetings
4. Acceptance criteria:
   - broad audience meetings do not regress the scheduler into unusable latency
   - rollout gate is explicit before class/grade/PTA meetings are enabled

---

## 8. Recommended Execution Order

1. `MEET-SPIKE-001`
2. `MEET-BE-001`
3. `MEET-BE-002`
4. `MEET-BE-003`
5. `MEET-BE-004`
6. `MEET-BE-005`
7. `MEET-BE-006`
8. `MEET-BE-007`
9. `MEET-FE-001`
10. `MEET-FE-002`
11. `MEET-FE-003`
12. `MEET-FE-004`
13. `MEET-FE-005`
14. `MEET-MOB-001`
15. `MEET-MOB-002`
16. `MEET-QA-001`
17. `MEET-QA-002`

This completes the narrow pilot slice.

Then:

18. `MEET-BE-008`
19. `MEET-BE-009`
20. `MEET-FE-006`
21. `MEET-FE-007`
22. `MEET-MOB-003`
23. `MEET-MOB-004`
24. `MEET-QA-003`

Then broad audience expansion:

25. `MEET-BE-010`
26. `MEET-FE-008`
27. `MEET-QA-004`

---

## 9. Pilot Slice Definition

The first pilot-ready slice should include only:

- school-admin scheduling
- one-to-one parent meetings
- manually selected small-group parent meetings
- private `specific_users` calendar visibility
- parent list/detail/respond
- web join
- mobile join
- invite and reminder notifications
- webhook verification
- core audit events

The first pilot-ready slice should exclude:

- teacher scheduling
- bursar scheduling
- class-wide meetings
- grade-wide meetings
- school-wide parent meetings
- PTA meetings
- recording
- transcription
- recurring meetings
- mobile staff scheduling if that slips behind safe pilot timing

---

## 10. Notes for Estimation

1. The highest risk tickets are:
   - `MEET-SPIKE-001`
   - `MEET-BE-002`
   - `MEET-BE-003`
   - `MEET-MOB-002`
2. The broadest privacy-risk tickets are:
   - `MEET-BE-002`
   - `MEET-BE-008`
   - `MEET-BE-009`
   - `MEET-QA-001`
3. The main performance-risk ticket is:
   - `MEET-BE-010`

This plan is meant to turn the meetings spec into executable work, not to replace the spec itself.
