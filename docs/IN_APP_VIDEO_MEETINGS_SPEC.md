# In-App Video Meetings Spec

> **Version**: 1.0  
> **Date**: April 18, 2026  
> **Status**: Ready for implementation planning  
> **Audience**: Product, design, web engineering, mobile engineering, backend engineering  
> **Intent**: Define a secure, mobile-capable in-app video meetings system for EduSentrix, covering teacher-parent, school-admin-parent, bursar-parent, group parent meetings, and PTA meetings, while preserving current app behavior and matching existing UI standards.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Current State In Repo](#2-current-state-in-repo)
3. [Goals and Non-Goals](#3-goals-and-non-goals)
4. [Supported Meeting Scenarios](#4-supported-meeting-scenarios)
5. [Decision Summary](#5-decision-summary)
6. [Information Architecture](#6-information-architecture)
7. [UX Specification](#7-ux-specification)
8. [Permissions and Access Rules](#8-permissions-and-access-rules)
9. [Data Model](#9-data-model)
10. [Calendar and Audience Model Updates](#10-calendar-and-audience-model-updates)
11. [Backend and API Design](#11-backend-and-api-design)
12. [Provider Integration](#12-provider-integration)
13. [Notifications, Deep Links, and Reminders](#13-notifications-deep-links-and-reminders)
14. [Security, Privacy, and Audit](#14-security-privacy-and-audit)
15. [Mobile Requirements](#15-mobile-requirements)
16. [Phased Delivery Plan](#16-phased-delivery-plan)
17. [Acceptance Criteria](#17-acceptance-criteria)
18. [Developer Checklist](#18-developer-checklist)
19. [Open Questions](#19-open-questions)
20. [Official Vendor References](#20-official-vendor-references)

---

## 1. Overview

EduSentrix should support secure in-app video meetings across web and mobile.

This feature must not be limited to PTA meetings.

The product need is broader:

- a teacher should be able to schedule a one-to-one or small-group meeting with a parent or guardian
- a school admin should be able to schedule school-wide, grade-wide, class-wide, or selected-parent meetings
- a bursar should be able to schedule payment or finance follow-up meetings with a parent or group of parents
- parents should be able to receive invites, view meeting details, and join directly inside the app on web and mobile

This is not a "nice-to-have video room" feature. It is a structured school communication feature with:

- scheduling
- invitee resolution
- secure join controls
- auditability
- calendar integration
- parent-safe privacy rules

Inference from the current codebase: this should be built as a meetings domain integrated with calendar, guardians, messaging, and notifications, not as a standalone generic calling tool.

---

## 2. Current State In Repo

### 2.1 Capabilities already present

The repo already has several strong foundations:

- `AcademicCalendarEvent` already supports `eventType: "meeting"`
- admin calendar UI already exposes "Meeting" as an event type
- teacher-parent messaging already exists
- parent recipient discovery already exists
- guardian relationships already exist
- teacher and bursar are already recognized in academic-calendar editor logic
- parent, teacher, admin, and bursar shells already exist
- mobile app strategy and UI standards are already documented

Relevant files:

- `src/models/AcademicCalendarEvent.ts`
- `src/app/(app)/admin/academic-calendar/page.tsx`
- `src/lib/academic-calendar/recipients.ts`
- `src/lib/academic-calendar/audience.ts`
- `src/app/api/teacher/messages/threads/route.ts`
- `src/app/api/parent/messages/recipients/route.ts`
- `src/components/nav/sidebars/teacher-sidebar.tsx`
- `src/components/nav/sidebars/parent-sidebar.tsx`
- `src/components/nav/sidebars/bursar-sidebar.tsx`
- `src/components/auth/admin-role-path-guard.tsx`
- `docs/MOBILE_APP_STRATEGY.md`
- `docs/MOBILE_UI_COMPONENTS.md`

### 2.2 Important limitations in the current repo

There are three important product constraints today:

1. The calendar audience model only supports:
   - `school`
   - `grades`
   - `classes`

2. The current calendar audience model does **not** support private or selected-user meetings.

3. Bursar path access is currently restricted to finance-related prefixes:
   - `/admin/finance`
   - `/admin/fees`
   - `/admin/expenses`
   - `/admin/settings/payment-setup`

This means private meetings cannot safely be represented with the current calendar audience shape, and bursar meeting routing must be planned explicitly.

### 2.3 Existing product clues that support this feature

The repo already hints at this use case:

- teacher-student-parent messaging exists
- parent calendars already include meetings in their API contracts
- admin student surfaces already expose call/email guardian actions
- fee strategy docs explicitly mention "schedule parent meeting" as a smart action

Inference: the user need is already present in the product direction. The missing piece is the actual meetings system.

---

## 3. Goals and Non-Goals

### 3.1 Goals

- Support secure video meetings for school admins, teachers, and bursars with parents.
- Support both one-to-one and group parent meetings.
- Support PTA and broad parent meetings without making the feature PTA-only.
- Support meeting creation and meeting join on both web and mobile.
- Reuse current auth, guardians, calendar, and notification infrastructure where possible.
- Follow existing EduSentrix web and mobile UI standards.
- Preserve privacy so private meetings are visible only to intended participants.
- Avoid breaking current working calendar, messaging, and role-access behavior.

### 3.2 Non-Goals

- This spec does not cover student-to-student video calls.
- This spec does not introduce open public meeting links.
- This spec does not make parent-created meetings part of v1.
- This spec does not make recording or transcription mandatory in v1.
- This spec does not require building raw WebRTC infrastructure from scratch.
- This spec does not replace teacher-parent messaging; it complements it.

---

## 4. Supported Meeting Scenarios

### 4.1 V1 supported scenarios

1. Teacher -> one parent / guardians of one student
2. Teacher -> selected parents from a class or student list
3. School admin -> one parent / guardians of one student
4. School admin -> class-wide parent meeting
5. School admin -> grade-wide parent meeting
6. School admin -> school-wide parent meeting
7. School admin -> PTA meeting
8. Bursar -> one parent / guardians of one student for finance follow-up
9. Bursar -> selected group of parents for payment or billing follow-up

### 4.2 Recommended meeting classifications

Use a first-class `meetingKind` field:

- `teacher_parent_1_1`
- `teacher_parent_group`
- `school_admin_parent_1_1`
- `school_admin_parent_group`
- `bursar_parent_1_1`
- `bursar_parent_group`
- `pta`
- `school_parent_briefing`

### 4.3 V1 invitee source types

The scheduler should be able to create a meeting from:

- one student
- multiple selected students
- one class
- one grade
- manual parent selection
- whole-school parent audience

### 4.4 Invitee account rule

For v1, only parents with active app accounts should be joinable participants.

If a selected guardian does not have a linked active user account:

- show a warning in the composer
- show them as "not yet joinable in app"
- allow the scheduler to proceed with joinable invitees only
- offer a follow-up action to invite or activate missing parent accounts

This keeps the system secure and avoids anonymous links.

---

## 5. Decision Summary

### 5.1 Primary provider recommendation

**Recommended v1 provider: LiveKit Cloud**

Reasoning:

- strong token-based auth model
- good fit for React/Next
- official React Native and Expo paths for mobile join
- webhook support
- path to self-hosting later if needed
- better long-term fit than a web-only embed-first decision

### 5.2 Secondary fallback

**Fallback provider: Daily**

Daily remains a credible fallback if speed to pilot matters more than long-term control, but because EduSentrix must support both web and mobile-native join flows, LiveKit is the better first recommendation.

### 5.3 Do not do this

Do **not** build custom raw WebRTC infrastructure in v1.

That would require:

- signaling
- TURN/STUN
- mobile-specific audio/video edge cases
- reconnection handling
- moderation state
- participant lifecycle events
- scaling and recording design

That is unnecessary product risk.

### 5.4 External services and APIs needed

Required:

- LiveKit Cloud
- LiveKit server SDK for token generation and room control
- LiveKit webhooks

Reused existing services:

- Clerk for auth/session identity
- existing MongoDB models and APIs
- existing email channel for reminders and invites
- existing in-app notifications

Recommended but optional for best mobile experience:

- mobile push notification layer if not already production-ready
- device analytics or meeting telemetry dashboards

Not needed if LiveKit Cloud is used:

- separate TURN/STUN management
- custom signaling servers

---

## 6. Information Architecture

### 6.1 Canonical route decision

Use a first-class meetings domain with dedicated role surfaces and a shared join path.

Recommended web routes:

- `/admin/meetings`
- `/admin/meetings/[meetingId]`
- `/teacher/communication/meetings`
- `/teacher/communication/meetings/[meetingId]`
- `/parent/meetings`
- `/parent/meetings/[meetingId]`
- `/meetings/[meetingId]/join`

### 6.2 Why use a shared join route

A shared join route is the right design for:

- email deep links
- notification deep links
- mobile push deep links
- "starting soon" reminders

The join route should:

- require auth
- detect the current user
- verify meeting access
- fetch a short-lived join token
- open the correct web or mobile meeting shell

### 6.3 Sidebar placement

#### School admin

Add a new `Communication` group to the school-admin sidebar:

- `Meetings`
- `Email`

If nav churn must stay minimal in v1, place `Meetings` under `Operations`, but the better long-term IA is a `Communication` group.

#### Teacher

Add `Meetings` under the existing `Communication` group:

- Notifications
- Meetings
- Notices
- Messages
- Escalations

#### Parent

Add `Meetings` under the existing `Communication` group:

- Notifications
- Meetings
- Messages

Parents already use calendar and messages, so this keeps discovery easy and consistent.

#### Bursar

Add `Parent Meetings` or `Meetings` under `Finance Operations` in the bursar sidebar, linking to the same meetings module with finance-focused defaults.

Recommended link:

- `/admin/meetings?context=finance`

### 6.4 Bursar route-guard update

If bursars must access `/admin/meetings`, then `src/components/auth/admin-role-path-guard.tsx` must be updated to allow:

- `/admin/meetings`

This is required if the meetings surface is shared across school admins and bursars.

### 6.5 Entry points from existing pages

To keep the UI easy to use, meetings must not live only in a dedicated list page.

Add entry points in:

- admin student detail header: `Schedule Meeting`
- admin students bulk actions: `Schedule Parent Meeting`
- admin academic calendar: `Create Video Meeting`
- teacher student detail/profile: `Schedule Guardian Meeting`
- teacher messages or student roster pages: `Start / Schedule Meeting`
- bursar finance/fees/student finance views: `Schedule Payment Meeting`
- parent notifications, meetings list, and calendar event cards: `Join Meeting`

---

## 7. UX Specification

### 7.1 Core product principle

The scheduler experience should be optimized for busy school staff.

The happy path should be possible in under one minute.

### 7.2 Scheduling flow

Use a guided 3-step composer on web and mobile:

1. Audience
2. Schedule
3. Review and publish

#### Step 1: Audience

Allow these selection modes:

- one student -> all joinable guardians
- selected students -> all joinable guardians
- class parents
- grade parents
- school-wide parents
- manual parent selection

Host and co-host controls:

- host defaults to the current user
- school admins can optionally add co-hosts
- teachers can optionally add a school admin as co-host if policy allows
- bursars can optionally add school admin finance staff as co-host

#### Step 2: Schedule

Fields:

- title
- optional description / agenda
- date
- start time
- duration
- timezone display
- meeting kind
- reminder presets
- join window
- optional "host approval required" behavior

Defaults:

- one-to-one meetings default to 30 minutes
- group meetings default to 45 minutes
- title auto-suggests from context

Examples:

- `Parent Conference: Ama Boateng`
- `Fee Follow-Up Meeting: JHS 2 Parents`
- `PTA Briefing: Term 2`

#### Step 3: Review and publish

Show:

- resolved joinable participant count
- unresolved parents without app access
- host and co-hosts
- reminder schedule
- calendar visibility summary
- privacy summary

Primary CTA:

- `Schedule Meeting`

Secondary actions:

- `Save Draft`
- `Cancel`

### 7.3 Meetings index page

Each role should have a meetings index page with:

- header and page summary
- primary CTA for schedulers
- tabs or filters for:
  - Upcoming
  - Starting Soon
  - Live
  - Past
  - Cancelled
- filters for:
  - meeting kind
  - role context
  - date range
  - class / grade
  - host

Card/list row fields:

- title
- host
- related student or audience label
- start time
- duration
- participant count
- response summary
- status badge
- join CTA when applicable

### 7.4 Meeting detail page

The detail page should include:

- title and status
- join CTA
- host and co-hosts
- date/time and timezone
- participant summary
- student context where relevant
- agenda / description
- response state
- activity timeline
- cancel / reschedule controls where allowed

For school staff, also show:

- unresolved invitees
- audit summary
- provider sync state

### 7.5 Parent experience

Parent UX must be simpler than staff UX.

Parent invite detail should show:

- meeting title
- who scheduled it
- which child or audience it relates to
- date/time in device-local timezone
- join CTA
- confirm / decline / request reschedule

Parent list cards should emphasize:

- upcoming time
- child name
- host name and role
- whether the meeting is joinable yet

### 7.6 Join preflight

Before entering the meeting room, both web and mobile should show a preflight screen:

- camera preview
- mic toggle
- speaker / audio route info
- network check
- meeting title and participants
- policy banners such as recording or host approval

Primary CTA:

- `Join Meeting`

### 7.7 In-call UX

For v1, the in-call shell should support:

- mic mute/unmute
- camera on/off
- leave meeting
- participant list
- host remove participant
- host mute participant
- host end meeting

Defer to later phases:

- breakout rooms
- whiteboard
- file sharing
- transcription
- recording UI

### 7.8 UI standards

The feature must follow existing EduSentrix UI standards.

Web:

- use the current premium dark shell
- use existing `Card`, `Badge`, `Button`, `Sheet`, `Dialog`, and sidebar patterns
- use current glassmorphism and gradient accents
- avoid introducing a separate visual language

Mobile:

- follow `docs/MOBILE_UI_COMPONENTS.md`
- follow `docs/MOBILE_APP_STRATEGY.md`
- minimum 44x44 touch targets
- thumb-friendly primary actions
- bottom sheets for selectors
- progressive disclosure instead of dense forms
- safe-area aware layouts

Design rules:

- do not expose raw provider IDs
- keep forms short and staged
- use human-readable audience labels
- keep primary join and schedule actions visually obvious

---

## 8. Permissions and Access Rules

### 8.1 Scheduling permissions

#### School admin

Can schedule:

- one-to-one parent meetings
- selected parent group meetings
- class-wide parent meetings
- grade-wide parent meetings
- school-wide parent meetings
- PTA meetings

#### Teacher

Can schedule only with:

- guardians of their homeroom students
- guardians of students in their active assignments for the current period
- selected parent subsets derived from those students

Teachers must not be able to schedule meetings with unrelated parents.

#### Bursar

Can schedule:

- one-to-one parent finance meetings
- selected parent group finance meetings

Bursar context should default to finance-related meetings but should not leak academic private data.

#### Parent

Parent can:

- view invited meetings
- confirm / decline / request reschedule
- join meetings they are invited to

Parent cannot create meetings in v1.

### 8.2 Join permissions

Join access must be invite-only.

Rules:

- user must be authenticated
- user must belong to the same school as the meeting
- user must be an invited participant or authorized host/co-host
- join token must be short-lived
- access must be denied after cancellation or removal

### 8.3 Private meeting visibility

Private one-to-one or selected-parent meetings must only be visible to:

- host
- co-hosts
- invited parents

They must not leak into:

- school-wide calendars
- unrelated parent lists
- teacher calendars of uninvolved teachers

---

## 9. Data Model

### 9.1 `Meeting`

Recommended new collection: `Meeting`

Core fields:

- `_id`
- `schoolId`
- `calendarEventId`
- `meetingKind`
- `title`
- `description`
- `hostUserId`
- `hostRole`
- `coHostUserIds`
- `provider`
- `providerRoomName`
- `providerRoomId`
- `status`
- `scheduledStartAt`
- `scheduledEndAt`
- `actualStartedAt`
- `actualEndedAt`
- `audienceSource`
- `audienceSourceRef`
- `relatedStudentIds`
- `joinWindowMinutesBefore`
- `allowJoinAfterStartMinutes`
- `responseSummary`
- `participantSummary`
- `policy`
- `createdBy`
- `updatedBy`
- `createdAt`
- `updatedAt`

Recommended enums:

- `provider`: `livekit`
- `status`: `draft | scheduled | live | ended | cancelled`
- `hostRole`: `school_admin | teacher | bursar`

Recommended `audienceSource` values:

- `student`
- `students`
- `class`
- `grade`
- `school_parents`
- `manual_parents`
- `pta`

Recommended `policy` subdocument:

- `hostApprovalRequired`
- `recordingEnabled`
- `recordingMode`
- `chatEnabled`
- `screenShareAllowed`

### 9.2 `MeetingParticipant`

Recommended new collection: `MeetingParticipant`

Reasoning:

- efficient queries by user
- explicit attendance records
- response tracking
- avoids oversized embedded arrays for large meetings

Fields:

- `_id`
- `meetingId`
- `schoolId`
- `userId`
- `scheduledStartAt`
- `scheduledEndAt`
- `role`
- `participantType`
- `relatedStudentIds`
- `responseStatus`
- `responseNote`
- `invitedAt`
- `firstJoinedAt`
- `lastLeftAt`
- `totalDurationSeconds`
- `joinCount`
- `removedAt`
- `providerIdentity`
- `createdAt`
- `updatedAt`

Enums:

- `role`: `school_admin | teacher | bursar | parent`
- `participantType`: `host | co_host | invitee`
- `responseStatus`: `pending | accepted | declined | reschedule_requested`

### 9.3 `MeetingProviderEvent`

Recommended new collection: `MeetingProviderEvent`

Purpose:

- normalized webhook storage
- troubleshooting
- reconciliation between provider state and app state

Fields:

- `_id`
- `meetingId`
- `schoolId`
- `provider`
- `eventType`
- `providerEventId`
- `providerRoomId`
- `providerParticipantIdentity`
- `payload`
- `receivedAt`
- `processedAt`
- `processingStatus`
- `error`

### 9.4 Suggested indexes

`Meeting`

- `{ schoolId: 1, status: 1, scheduledStartAt: 1 }`
- `{ hostUserId: 1, scheduledStartAt: -1 }`
- `{ calendarEventId: 1 }`
- `{ providerRoomName: 1 }`

`MeetingParticipant`

- `{ userId: 1, scheduledStartAt: 1 }` via denormalized field or query join strategy
- `{ meetingId: 1, participantType: 1 }`
- `{ schoolId: 1, userId: 1, responseStatus: 1 }`

`MeetingProviderEvent`

- `{ meetingId: 1, receivedAt: -1 }`
- `{ provider: 1, providerEventId: 1 }`

---

## 10. Calendar and Audience Model Updates

### 10.1 Why a calendar update is required

Current `AcademicCalendarEvent.audience.scope` supports only:

- `school`
- `grades`
- `classes`

That is insufficient for:

- teacher -> one parent
- bursar -> selected parents
- school admin -> manually selected parents

### 10.2 Required audience extension

Extend calendar audience support with:

- `scope: "specific_users"`
- `userIds?: ObjectId[]`

Recommended updated shape:

- `scope: "school" | "grades" | "classes" | "specific_users"`
- `gradeIds?: ObjectId[]`
- `classGroupIds?: ObjectId[]`
- `userIds?: ObjectId[]`
- `roles?: string[]`

### 10.3 How private meetings should map to calendar

#### Broad audience meetings

Examples:

- PTA
- class-wide parent meeting
- grade-wide parent meeting
- school-wide parent briefing

These should create linked calendar events using existing audience patterns.

#### Private and selected-parent meetings

Examples:

- teacher-parent one-to-one
- bursar-parent one-to-one
- selected guardians of selected students

These should create linked calendar events with:

- `scope: "specific_users"`
- invited parent user IDs
- host/co-host user IDs

This lets the calendar remain the visible scheduling layer without leaking access.

### 10.4 Calendar APIs that must be updated

Update:

- `src/lib/academic-calendar/types.ts`
- `src/models/AcademicCalendarEvent.ts`
- `src/lib/academic-calendar/audience.ts`
- `src/lib/academic-calendar/recipients.ts`
- `src/app/api/teacher/calendar/route.ts`
- `src/app/api/parent/calendar/route.ts`
- any admin/student calendar routes using the same audience helpers

### 10.5 Calendar payload enhancements

Calendar event payloads should gain optional meeting metadata:

- `meetingId`
- `meetingStatus`
- `canJoin`
- `responseStatus`
- `host`
- `relatedStudents`

This lets the parent and teacher calendars render richer meeting cards without separate lookups for every event row.

---

## 11. Backend and API Design

### 11.1 API shape strategy

Use role-scoped management APIs plus a shared join API.

Role-scoped management is consistent with current repo patterns.

Shared join handling is better for universal deep links.

### 11.2 Recommended endpoints

#### Shared

- `GET /api/meetings/[meetingId]`
- `POST /api/meetings/[meetingId]/join-token`
- `POST /api/meetings/[meetingId]/presence`
- `POST /api/meetings/[meetingId]/respond`
- `POST /api/webhooks/meetings/livekit`

#### School admin

- `GET /api/admin/meetings`
- `POST /api/admin/meetings`
- `GET /api/admin/meetings/[meetingId]`
- `PATCH /api/admin/meetings/[meetingId]`
- `POST /api/admin/meetings/[meetingId]/cancel`
- `POST /api/admin/meetings/[meetingId]/start`
- `POST /api/admin/meetings/[meetingId]/end`
- `POST /api/admin/meetings/[meetingId]/refresh-participants`

#### Teacher

- `GET /api/teacher/meetings`
- `POST /api/teacher/meetings`
- `GET /api/teacher/meetings/[meetingId]`
- `PATCH /api/teacher/meetings/[meetingId]`
- `POST /api/teacher/meetings/[meetingId]/cancel`
- `POST /api/teacher/meetings/[meetingId]/start`
- `POST /api/teacher/meetings/[meetingId]/end`

#### Parent

- `GET /api/parent/meetings`
- `GET /api/parent/meetings/[meetingId]`
- `POST /api/parent/meetings/[meetingId]/respond`

### 11.3 Recommended service layer

Create a shared domain under `src/lib/meetings/`:

- `createMeeting.ts`
- `updateMeeting.ts`
- `cancelMeeting.ts`
- `resolveParticipants.ts`
- `authorizeMeetingAccess.ts`
- `issueJoinToken.ts`
- `handleProviderWebhook.ts`
- `syncMeetingState.ts`
- `meetingAudit.ts`
- `meetingNotifications.ts`

### 11.4 Participant resolution rules

Build on existing patterns already present in:

- guardian relationships
- teacher assignment checks
- parent recipient discovery
- calendar recipient resolution

Resolution steps:

1. validate the scheduler's role and allowed source context
2. resolve target students or parent users
3. filter to joinable parent accounts
4. build `MeetingParticipant` rows
5. create linked calendar event
6. queue notifications

### 11.4.1 Audience resolution performance rules

The UX goal of "under one minute" only holds if audience resolution is designed carefully.

Rules:

- one-to-one and small-group resolution should be synchronous
- class, grade, and school-wide parent resolution may use staged loading
- the composer should show aggregate counts quickly before rendering every participant row
- unresolved guardians without app accounts must not block the whole composer

Recommended behavior:

- if resolved invitees are under 30, render full participant preview inline
- if resolved invitees are 30 to 150, render summary counts first and lazy-load rows
- if resolved invitees exceed 150, create a draft meeting first, resolve participants in a background job, and show progress state before publish

Recommended backend approach:

- reuse guardian and membership indexes instead of fan-out scans
- cache grade/class -> guardian user resolution for short-lived compose sessions where safe
- store participant resolution summary on the draft meeting so the client does not recompute it on every step

The product goal is not to make every large meeting feel instant.

The product goal is to make large meetings feel reliable and understandable without freezing the UI.

### 11.5 Response contract for join token endpoint

Suggested response:

```ts
{
  success: true,
  data: {
    meetingId: string,
    provider: "livekit",
    token: string,
    serverUrl: string,
    roomName: string,
    participantIdentity: string,
    expiresAt: string,
    permissions: {
      canPublish: boolean,
      canSubscribe: boolean,
      canPublishData: boolean,
      roomAdmin: boolean
    }
  }
}
```

### 11.6 Join-token issuance rules

- generate on server only
- token TTL should be short, for example 10 to 15 minutes
- only issue if:
  - user is invited
  - meeting is not cancelled
  - join window is open
  - user has not been removed

### 11.7 Effective waiting room approach for v1

Do not depend on a provider-specific lobby as the primary control in v1.

Instead:

- hosts can start within the configured start window
- invitees see "waiting for host" until the meeting is started or join window is opened
- join token is withheld until access conditions are satisfied

This is simpler, safer, and more deterministic across web and mobile.

---

## 12. Provider Integration

### 12.1 Provider abstraction

Even though v1 should ship with LiveKit, the app should not hardcode provider logic everywhere.

Create a provider adapter interface:

```ts
interface MeetingProviderAdapter {
  ensureRoom(input: EnsureRoomInput): Promise<EnsureRoomResult>;
  issueParticipantToken(input: IssueParticipantTokenInput): Promise<IssueParticipantTokenResult>;
  endRoom(input: EndRoomInput): Promise<void>;
  handleWebhook(input: ProviderWebhookInput): Promise<ProviderWebhookResult>;
}
```

### 12.2 LiveKit responsibilities

The LiveKit adapter should handle:

- room creation or room readiness
- participant token generation
- host/admin permission differences
- webhook verification
- room end or participant removal operations

### 12.3 Suggested permission mapping

#### Host / co-host

- can publish audio/video
- can subscribe
- can publish data
- room admin permissions

#### Parent invitee

- can publish audio/video
- can subscribe
- cannot moderate the room

### 12.4 Recommended participant identity format

Use a stable, app-generated identity such as:

`school:{schoolId}:meeting:{meetingId}:user:{userId}`

Benefits:

- traceable in provider events
- easy mapping back into MongoDB
- easy audit correlation

### 12.5 Provider cost and lifecycle controls

The provider integration must include explicit cost and lifecycle rules from day one.

Required controls:

- default maximum participant caps by meeting kind
- default room expiration and cleanup windows
- automatic transition from `live` to `ended` when the room is empty and grace window expires
- scheduled job to detect meetings stuck in `live`
- scheduled job to detect meetings stuck in `scheduled` after end time

Recommended defaults:

- one-to-one parent meeting: cap at 6 participants
- class or finance group meeting: cap at 50 participants
- PTA or school-wide meeting: cap set explicitly by school-admin policy and provider budget

Operational safeguards:

- do not create provider rooms far in advance unless the provider requires it
- prefer deterministic room names and lazy readiness over long-lived idle rooms
- expose provider usage metrics to platform operations later if meeting volume grows materially

### 12.6 Forced-end and recovery operations

The system needs a clear recovery path for provider or lifecycle drift.

Required admin actions for v1 or early v2:

- force-end a meeting in app state
- force-end a provider room
- mark a meeting as ended when the provider room is already closed
- resync meeting state from recent provider events

This does not all need to be exposed to school staff.

At minimum, platform or internal operations must have a reliable runbook path for these actions.

---

## 13. Notifications, Deep Links, and Reminders

### 13.1 Notification channels

V1 required channels:

- in-app notification
- email reminder

Recommended if mobile push is available:

- mobile push reminder

### 13.2 Notification lifecycle

When a meeting is scheduled:

- create in-app notifications for all participants
- send transactional email invite where allowed

Before a meeting:

- send reminder based on configured presets

When rescheduled or cancelled:

- send updated notifications

### 13.3 Deep links

Recommended deep link targets:

- `edusentrix://meetings/{meetingId}`
- `edusentrix://meetings/{meetingId}/join`

Email and push should use app-aware links that route to:

- mobile app if installed
- authenticated web fallback otherwise

### 13.4 Parent-friendly reminders

Reminder copy should be simple and action-oriented:

- what the meeting is about
- which child it concerns if applicable
- when it starts in local time
- one-tap join action

### 13.5 Reminder channels in calendar model

Current calendar reminders are `in_app` only.

This spec recommends:

- keep calendar reminders as-is for existing flows
- build meeting-specific reminders in the new meetings domain

Do not overload the academic-calendar reminder model to carry all video-meeting delivery behavior.

---

## 14. Security, Privacy, and Audit

### 14.1 Security baseline

The system must meet this baseline:

- authenticated participants only
- school-scoped access checks
- short-lived join tokens
- no reusable public links
- removed participants cannot rejoin with stale permissions
- private meetings do not leak into other calendars

### 14.2 Privacy rules

Private parent meetings can contain sensitive guardian and student context.

Therefore:

- no public room URLs
- no meeting page visibility for non-invitees
- no broad calendar exposure for private meetings
- bursar views must not expose academic private details beyond what they already legitimately access

### 14.3 Audit events

Emit durable audit events for:

- `meeting.created`
- `meeting.updated`
- `meeting.cancelled`
- `meeting.started`
- `meeting.ended`
- `meeting.join_token_issued`
- `meeting.participant_joined`
- `meeting.participant_left`
- `meeting.participant_removed`
- `meeting.response_updated`
- `meeting.provider_webhook_received`

### 14.4 Recording policy

V1 recommendation:

- recording disabled by default
- no parent meeting recording UI in v1

Reason:

- reduces privacy complexity
- avoids consent and storage policy gaps
- keeps v1 smaller and safer

If recording is later enabled, it must include:

- explicit policy and consent copy
- role restrictions
- retention policy
- secure storage
- audit trail

### 14.5 Failed delivery and degraded states

If email or push reminder delivery fails:

- the meeting must still be joinable in-app
- failure should be logged
- scheduler should see reminder delivery status where feasible

If provider webhook delivery is delayed:

- meeting lifecycle should still work from app-controlled state
- webhooks should enrich and reconcile state, not be the sole source of truth

### 14.6 Compliance and child-safety baseline

Even with recording disabled, this feature operates in a school context involving parents, school staff, and sometimes child-related discussions.

Minimum product and policy assumptions:

- the school is the primary data controller for meeting usage in its workspace
- the video provider operates as a processor or subprocessor under the platform's vendor terms
- the platform must maintain a vendor inventory and DPA path before broad rollout
- the product must avoid default behaviors that increase privacy exposure, especially public links and silent recording

V1 compliance baseline:

- no recording by default
- no transcription by default
- meeting metadata retained only as needed for scheduling, audit, and support
- provider payload storage minimized to what is operationally necessary
- user-facing copy must clearly indicate when camera and microphone are used

For parent and child safety:

- hosts must be authenticated school actors
- participants must be explicitly invited
- removal and room-end actions must be available to hosts
- the product must not market the feature as "classroom-safe recording" or similar until explicit policy work is done

### 14.7 Operational runbook and SLO guidance

The feature should not reach pilot without basic operational targets and recovery steps.

Recommended initial service goals:

- join-token issuance success rate: at least 99.5%
- webhook verification failures: alert on sustained spikes, not isolated events
- meeting join failure spikes: alert when error rate materially exceeds baseline for 5 minutes

Required runbook coverage:

- meeting appears stuck in `live`
- host cannot join because token issuance fails
- provider webhook signature validation fails
- meeting ended in provider but still appears active in app
- reminder delivery failures before a scheduled meeting

Minimum support actions:

- inspect meeting state
- inspect recent provider events
- inspect recent join-token issuance failures
- force-end the meeting
- resend reminders where safe

---

## 15. Mobile Requirements

### 15.1 Mobile is not optional

This feature must be designed as a web-plus-mobile feature from day one.

Meeting creation and meeting join must both work in the mobile app.

However, that is a full-program requirement, not necessarily a first-pilot requirement.

If the technical spike shows that mobile meeting creation would materially delay a safe pilot, the first pilot slice may ship with:

- web scheduling
- mobile join
- mobile meeting detail and response

In that case, mobile meeting creation moves to the next release slice, but remains mandatory before the feature is considered complete.

### 15.2 Mobile creation UX

Schedulers on mobile should be able to:

- start from context screens
- use bottom-sheet selectors for audience
- set date/time with touch-friendly controls
- review resolved invitees before publish

Do not mirror a dense desktop form 1:1 on mobile.

### 15.3 Mobile join UX

Required:

- preflight screen
- permission prompts for camera and mic
- reconnect behavior after app background/foreground
- obvious `Join` and `Leave` controls
- clear host / participant labels

### 15.4 Network and device handling

Design for low-bandwidth and unstable connections:

- adaptive video
- allow audio-only use
- allow camera-off join
- preserve session where possible on reconnect
- handle background interruption gracefully

### 15.5 Screen sharing

Recommended v1 rule:

- screen share on web host only
- mobile participants can view shared screens
- mobile-originated screen share can be deferred to later phase

### 15.6 Mobile notifications

The mobile app should surface:

- upcoming meeting card on home/dashboard where relevant
- reminder notifications
- deep link into meeting detail or join route

### 15.7 Timezone handling

Show meeting times in device-local time with school timezone context when relevant.

Example:

- `3:00 PM local time`
- `School time: GMT`

---

## 16. Phased Delivery Plan

### Phase 0: Technical spike

Before implementation planning is locked, run a short LiveKit spike.

Spike goals:

- issue one join token from the backend
- join one room from web
- join one room from the Expo or React Native mobile app
- receive and validate one webhook
- confirm the chosen room naming and participant identity scheme
- confirm expected mobile permission and reconnect behavior

Expected output:

- working proof of token issuance and join
- confirmed provider SDK shape for web and mobile
- revised implementation estimates
- go / no-go validation for LiveKit as the default provider

### Phase 1: Foundation and narrow pilot slice

This is the first implementation slice that should be allowed near real users.

Ship:

- LiveKit integration
- meeting domain models
- shared join route
- join-token issuance
- webhook verification and storage
- school-admin scheduling only
- one-to-one and manually selected parent meetings only
- parent invite, response, and join
- web join flow
- mobile join flow
- `specific_users` audience support for private meetings
- core audit events

Do not ship in this slice:

- teacher scheduling
- bursar scheduling
- class-wide, grade-wide, or school-wide parent meetings
- mobile meeting creation
- advanced reminder matrix

### Phase 2: Role expansion and privacy matrix hardening

Add:

- teacher scheduling
- bursar scheduling
- role-specific access enforcement and tests
- context entry points from student, teacher, and finance surfaces
- mobile meeting creation
- reschedule and cancel flows polish

The purpose of this phase is not feature count.

The purpose is to prove the privacy and authorization matrix for the three staff roles.

### Phase 3: Broad audience meetings and communication polish

Add:

- class-wide parent meetings
- grade-wide parent meetings
- school-wide parent meetings
- PTA meetings
- richer reminders
- better participant resolution UX for large groups
- delivery-status visibility for schedulers
- no-show and attendance summaries

### Phase 4: Advanced collaboration and optional policy-heavy features

Add only after adoption and policy readiness justify them:

- recording
- transcription
- recurring meetings
- meeting summaries
- follow-up notes
- more advanced moderation
- mobile-originated screen sharing

---

## 17. Acceptance Criteria

The feature is acceptable when all of the following are true:

### 17.1 Scheduling

- school admin can schedule a private meeting with one parent
- school admin can schedule a class-wide or PTA meeting
- teacher can schedule a meeting only with guardians of allowed students
- bursar can schedule a finance meeting with one or more parents

### 17.2 Visibility and privacy

- a private one-to-one meeting appears only to invited users
- non-invited parents do not see that meeting anywhere
- unrelated teachers do not see private meetings
- private meetings do not leak through calendar APIs

### 17.3 Join behavior

- invited parent can join from web
- invited parent can join from mobile
- teacher, school admin, and bursar can join from mobile
- join is blocked for non-invitees
- removed or cancelled participants cannot rejoin

### 17.4 Calendar integration

- broad meetings appear in calendar correctly
- private meetings appear only for specific users
- teacher and parent calendar APIs return meeting metadata needed for join cards

### 17.5 Notifications

- invite notifications are created
- reminder notifications are created
- cancel and reschedule updates notify participants

### 17.6 Operational integrity

- webhook events are validated and stored
- audit events are recorded for critical actions
- failed reminders do not break meeting access

### 17.7 UI quality

- web screens match current EduSentrix premium UI
- mobile screens follow current mobile design guidance
- primary actions are easy to find
- no dense desktop-only form is forced onto mobile

---

## 18. Developer Checklist

- Run a LiveKit technical spike before committing to milestone estimates
- Add `Meeting`, `MeetingParticipant`, and `MeetingProviderEvent` models
- Extend academic-calendar audience to support `specific_users`
- Update parent and teacher calendar APIs to respect the new audience type
- Build shared meetings service layer under `src/lib/meetings`
- Add LiveKit adapter and env configuration
- Add webhook endpoint and verification
- Add role-scoped meetings APIs
- Add shared join-token API
- Add web pages for admin, teacher, parent, and shared join
- Add sidebar links for admin, teacher, parent, and bursar
- Update bursar path guard if `/admin/meetings` is used
- Add notification flows and deep links
- Add audit event coverage
- Add operational dashboards or queryable logs for join-token failures and provider events
- Define force-end and recovery procedures for stuck meetings
- Add tests for access control and private visibility
- Add mobile implementation tasks for create/join flows

---

## 19. Open Questions

1. Should parent-side meeting creation or meeting request flow be added later, or explicitly kept out of scope long-term?
2. Is mobile push already production-ready enough to make meeting reminders first-class, or should v1 rely on in-app + email?
3. Should recordings remain globally disabled for all parent meetings, or become a later school-admin-controlled policy?
4. Should recurring PTA meetings be part of Phase 2 or later?
5. Do we want finance-specific meeting analytics for bursar adoption, such as payment follow-up outcome tracking?

### 19.1 Questions that should be resolved before Phase 1 starts

These should not stay open deep into implementation:

- whether Phase 1 includes mobile meeting creation or only mobile join
- whether push reminders are production-ready enough to be in the first pilot slice
- whether broad audience meetings are allowed in the first pilot slice or only one-to-one and manual small groups
- whether platform operations need an internal force-end tool before pilot, or a runbook is sufficient temporarily

---

## 20. Official Vendor References

LiveKit:

- Token authentication: `https://docs.livekit.io/frontends/authentication/tokens`
- Authentication overview: `https://docs.livekit.io/frontends/authentication/`
- React Native quickstart: `https://docs.livekit.io/transport/sdk-platforms/react-native/`
- Expo quickstart: `https://docs.livekit.io/home/quickstarts/expo/`
- Webhooks: `https://docs.livekit.io/home/server/webhooks`
- Webhooks and events overview: `https://docs.livekit.io/intro/basics/rooms-participants-tracks/webhooks-events/`

Daily fallback references:

- Create room: `https://docs.daily.co/reference/rest-api/rooms/create-room`
- Create meeting token: `https://docs.daily.co/reference/rest-api/meeting-tokens/create-meeting-token`
- Meeting token configuration: `https://docs.daily.co/reference/rest-api/meeting-tokens/config`

---

## Implementation Note

This spec intentionally keeps the meetings domain separate from the existing teacher-parent message threads, while reusing the same role, guardian, and calendar foundations already present in the repo.

That separation is important.

Messaging is asynchronous communication. Meetings are scheduled realtime sessions with stricter access, lifecycle, and privacy rules.
