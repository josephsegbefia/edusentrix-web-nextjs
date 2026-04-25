# Leo Copilot Development Specification v1.0

**Phased build tracker (status / checklists):** [LEO_COPILOT_ROADMAP.md](./LEO_COPILOT_ROADMAP.md)

## 1. Objective

Build `Leo Copilot` as a persistent, context-aware assistant across EduSentrix.

Leo must:

1. Explain what the user is looking at.
2. Explain what is wrong and why.
3. Recommend the next safe action.
4. Execute safe actions with confirmation.
5. Respect school, role, and entity permissions.
6. Be switchable by the platform admin for all schools or selected schools.

This specification is end-to-end and covers product behavior, rollout controls, data model, backend architecture, APIs, frontend surfaces, security, telemetry, testing, and implementation sequencing.

---

## 2. Product Goals

### 2.1 Primary Goals

1. Reduce admin confusion on complex pages like timetable, staffing, reports, fees, and setup.
2. Reduce task completion time for multi-step workflows.
3. Make the system self-explaining for all roles.
4. Centralize existing point-AI features under one assistant surface.
5. Support safe human-in-the-loop operational actions.

### 2.2 Success Outcomes

1. Fewer support-style questions inside the product.
2. Faster resolution of timetable, staffing, and finance blockers.
3. Higher completion of school setup and readiness tasks.
4. Better use of analytics, reports, and communication tools.
5. Lower navigation overhead across modules.

---

## 3. Non-Goals

1. Leo must not execute destructive operations without explicit confirmation.
2. Leo must not reveal data outside the current user’s authorization scope.
3. Leo must not bypass subscription, school, or role access rules.
4. Leo must not invent facts when source data is missing.
5. Leo must not silently mutate timetables, staffing, payments, or messaging state.

---

## 4. Existing Baseline in This Repo

The repo already contains narrow Leo or AI-assisted surfaces that should be reused or folded into the new assistant:

1. `CreateTeacherModal` natural-language teacher assignment suggestions.
2. `CreateClassGroupsModal` Leo-assisted class-group draft generation.
3. Timetable Leo coaching for class timetable gaps.
4. Admin reports Leo executive brief.
5. School setup readiness coaching.
6. Staff attendance AI insights.
7. Roles and duties AI insights.
8. Student ID suggestion with Leo.
9. AI cache and usage patterns in:
   - `AICachedInsight`
   - `AIFeatureCache`
   - `AIFeatureUsageEvent`
10. Runtime feature-flag patterns in:
   - `src/lib/timetable/feature-flags.ts`
11. School-level feature settings already stored in:
   - `SchoolSettings.teacherStudio`
12. Platform diagnostics page already exists:
   - `/platform/flags`

The Leo Copilot build should unify these into one framework instead of creating more one-off AI routes.

---

## 5. Product Definition

Leo Copilot is a `floating assistant pane` available throughout the platform.

It has four operating modes:

1. `Explain`
   - Clarify what a page, alert, conflict, chart, or blocker means.
2. `Investigate`
   - Search and connect data across modules.
3. `Recommend`
   - Suggest prioritized next actions.
4. `Act`
   - Draft or execute approved actions through guarded backend tools.

Leo always operates with a `context envelope` containing:

1. Current role.
2. Current school.
3. Current academic period.
4. Current route and tab.
5. Selected entity such as class, teacher, student, invoice, report, or meeting.
6. Active filters or date window.
7. Effective Leo feature state for the school and role.

---

## 6. Role Coverage

Leo is role-aware. Capability differs by role, but the assistant shell is shared.

### 6.1 School Admin

Leo should support:

1. School setup and readiness explanation.
2. Student management assistance.
3. Teacher creation, assignment, conflict resolution, and workload explanation.
4. Class-group, subject, and grade management.
5. Timetable explanation, conflict diagnosis, and draft support.
6. Academic periods, calendar, and promotions assistance.
7. Fees, finance, reports, store, supplies, documents, and email guidance.
8. Meetings, community, polls, fundraising, and school communication support.

### 6.2 Teacher

Leo should support:

1. Weekly schedule and daily agenda summaries.
2. Class, homeroom, attendance, and gradebook insights.
3. Lesson note and class journal drafting support.
4. Assignment, quiz, rubric, and resource drafting.
5. Student-level support within assigned classes.
6. Notices, messages, escalations, and meeting preparation.

### 6.3 Parent

Leo should support:

1. Ward summaries across attendance, academics, fees, notices, and meetings.
2. Calendar interpretation.
3. Fees and payment explanation.
4. Report summaries in simple language.
5. Message and notification summarization.

### 6.4 Student

Leo should support:

1. Assignment planning.
2. Results explanation.
3. Timetable and daily learning schedule.
4. Notice and calendar summarization.

### 6.5 Bursar / Finance Delegate

Leo should support:

1. Collections and transaction summaries.
2. Fees and overdue analysis.
3. Reconciliation support.
4. Disbursement and expense readiness checks.
5. Store and supply-payment follow-up suggestions.

### 6.6 Billing Owner

Leo should support:

1. Payment-setup explanation.
2. Payout and gateway readiness checks.
3. Billing risk alerts.

### 6.7 Platform Admin

Leo should support:

1. School health overview.
2. Subscription and entitlement analysis.
3. Usage and adoption tracking.
4. Feature rollout control.
5. Email, audit, and integration incident triage.

---

## 7. Admin Feature Catalog

This is the required admin feature scope for the complete Leo product.

### 7.1 Dashboard and Readiness

1. Explain onboarding and readiness blockers.
2. Prioritize next setup steps.
3. Summarize school health for the current term.
4. Link directly to the exact fixing surface.

### 7.2 Students

1. Explain profile completeness.
2. Summarize attendance, results, fees, and guardian readiness.
3. Detect at-risk students.
4. Draft student creation and follow-up actions.
5. Explain promotion blockers.

### 7.3 Teachers

1. Suggest subject and class assignments from natural language.
2. Explain teaching conflicts and homeroom conflicts.
3. Explain workload per week.
4. Summarize weekly teaching and non-teaching obligations.
5. Detect classes and subjects without teachers.
6. Draft communication to teachers.

### 7.4 Roles and Duties

1. Summarize staffing coverage.
2. Explain overlapping or missing duties.
3. Recommend role assignment changes.

### 7.5 Staff Attendance

1. Explain trends and anomalies.
2. Summarize who needs follow-up.
3. Detect repeated lateness and absence patterns.

### 7.6 Grades, Subjects, and Class Groups

1. Explain grade progression and stage structure.
2. Detect subjects not linked to class groups.
3. Detect stage or curriculum mismatches.
4. Draft class-group creation plans.

### 7.7 Timetable

1. Explain why publish is blocked.
2. Explain exact timetable conflicts on the same page.
3. Explain school-hour and period-fit inconsistencies.
4. Detect lessons with missing teachers.
5. Suggest safe staffing or slot changes.
6. Explain draft vs published differences.

### 7.8 Academic Calendar and Periods

1. Explain current academic period state.
2. Detect missing or overlapping periods.
3. Explain event audience reach.
4. Draft notices and reminders from academic events.

### 7.9 Promotions

1. Explain automatic promotion decisions.
2. Explain hold, repeat, and conflict cases.
3. Summarize cycle readiness before finalization.

### 7.10 Fees and Finance

1. Explain overdue risk.
2. Summarize collection performance.
3. Explain invoice gaps and payment application behavior.
4. Draft reminders.
5. Explain reconciliation mismatches and next steps.

### 7.11 Store and Supply Programs

1. Explain what is unpaid, unfulfilled, or missing.
2. Summarize by class, family, and program.
3. Suggest follow-up actions.

### 7.12 Reports

1. Explain charts and tables in plain language.
2. Generate executive summaries.
3. Compare periods.
4. Highlight anomalies worth action.

### 7.13 Email, Documents, Meetings, Community

1. Draft targeted communication.
2. Explain recipient scope.
3. Summarize document readiness.
4. Prepare meeting agendas and follow-up items.
5. Explain poll and fundraising participation patterns.

### 7.14 Settings

1. Explain impact of setting changes before save.
2. Detect inconsistent configuration.
3. Simulate timetable, staffing, or finance impact where applicable.

---

## 8. Access, Entitlement, and Rollout Model

Leo must support `global`, `school`, and optional `role` control.

### 8.1 Runtime Kill Switch

Add runtime env flags:

1. `FEATURE_LEO_COPILOT_RUNTIME_ENABLED`
2. `NEXT_PUBLIC_FEATURE_LEO_COPILOT_RUNTIME_ENABLED`

If runtime is off:

1. Launcher is hidden.
2. Leo routes return `503 feature_disabled`.
3. Existing narrow Leo routes may remain independently usable during migration if explicitly allowed.

### 8.2 Subscription Entitlement

Add a new subscription feature key:

`ai_leo_copilot`

Rules:

1. If the school does not have this entitlement, Leo is off unless platform override explicitly bypasses entitlement.
2. Platform admin may enable pilot access per school.
3. UI should clearly distinguish `disabled by plan` from `disabled by flag`.

### 8.3 Persistent Platform Flag Store

Create a new generic model:

`PlatformFeatureFlag`

Suggested shape:

```ts
type PlatformFeatureFlag = {
  _id: ObjectId;
  key: string; // "leo_copilot"
  label: string;
  description?: string | null;
  defaultState: "enabled" | "disabled";
  forcedMode: "none" | "force_enabled" | "force_disabled";
  allowSchoolOverride: boolean;
  allowSchoolSelfService: boolean;
  entitlementKey?: string | null; // "ai_leo_copilot"
  rolloutNotes?: string | null;
  updatedBy?: ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}
```

Indexes:

1. Unique index on `key`.

Purpose:

1. Persist global feature state.
2. Let platform admin force on or off for all schools.
3. Let platform admin decide whether schools can override locally.

### 8.4 School-Level Leo Settings

Extend `SchoolSettings` with a `leo` object:

```ts
type SchoolLeoSettings = {
  accessOverride: "inherit" | "enabled" | "disabled";
  roleOverrides?: {
    admin?: "inherit" | "enabled" | "disabled";
    teacher?: "inherit" | "enabled" | "disabled";
    parent?: "inherit" | "enabled" | "disabled";
    student?: "inherit" | "enabled" | "disabled";
    bursar?: "inherit" | "enabled" | "disabled";
    billing_owner?: "inherit" | "enabled" | "disabled";
  };
  allowWriteActions: boolean;
  allowBulkActions: boolean;
  allowDrafting: boolean;
  allowMonitors: boolean;
  retentionDays: number;
  defaultModelProfile: "low_cost" | "balanced" | "high_quality";
  privacyMode: "strict" | "balanced";
  ui?: {
    floatingPaneEnabled: boolean;
    homeSummaryCardsEnabled: boolean;
  };
  updatedBy?: ObjectId | null;
}
```

Rules:

1. `accessOverride` is the school-level on/off switch.
2. Platform admin can always patch it.
3. School admin can patch it only if `allowSchoolSelfService` is true on the platform flag.

### 8.5 Effective Access Resolution

Effective Leo availability must be computed in this order:

1. Runtime env kill switch.
2. Platform flag `forcedMode`.
3. School entitlement `ai_leo_copilot`, unless platform school override bypasses entitlement.
4. School `accessOverride`.
5. Role override.
6. User role permissions.

Return these states from a shared resolver:

1. `enabled`
2. `disabled_runtime`
3. `disabled_platform`
4. `disabled_plan`
5. `disabled_school`
6. `disabled_role`

### 8.6 Platform Admin Controls

Platform admin must be able to:

1. Turn Leo on or off globally.
2. Force Leo on or off for all schools.
3. Allow or disallow school self-service.
4. Override Leo for a specific school.
5. Bypass entitlement for pilot schools.
6. Inspect adoption and usage per school.

### 8.7 School Admin Controls

If allowed by platform:

1. School admin can enable or disable Leo for the school.
2. School admin can restrict Leo by role.
3. School admin can disable write or bulk actions.
4. School admin can set privacy and retention policy within allowed limits.

---

## 9. Architecture Overview

### 9.1 Frontend

Core frontend building blocks:

1. `LeoProvider`
2. `LeoLauncher`
3. `LeoPane`
4. `LeoChatThread`
5. `LeoMessageBlockRenderer`
6. `LeoActionCard`
7. `LeoConfirmDrawer`
8. `LeoContextBadgeBar`
9. `LeoQuickPromptStrip`
10. `LeoHistoryPanel`
11. `LeoMonitorPanel`

The assistant is mounted at the app-shell level for each role-specific layout.

### 9.2 Backend

Core backend layers:

1. `LeoAccessResolver`
2. `LeoContextBuilder`
3. `LeoIntentRouter`
4. `LeoToolRegistry`
5. `LeoActionRegistry`
6. `LeoPolicyGuard`
7. `LeoOrchestrator`
8. `LeoAuditWriter`
9. `LeoUsageTracker`

### 9.3 Execution Model

Each Leo response goes through:

1. Resolve effective access.
2. Build page and entity context.
3. Identify intent.
4. Load allowed tools for the current role and page.
5. Run zero or more read tools.
6. Produce response with citations and optional action proposals.
7. If the user confirms an action, run preview then execute.
8. Write audit and usage events.

### 9.4 Existing AI Endpoint Strategy

Current point-AI endpoints should be reclassified as one of:

1. `internal Leo tool`
2. `internal Leo action`
3. `legacy stand-alone AI entry point`

Examples:

1. Teacher assignment suggestion becomes a `teacher_assignment_suggester` tool.
2. Class-group Leo draft becomes a `class_group_plan_generator` tool.
3. Timetable Leo coach becomes a `timetable_gap_coach` tool.
4. Report brief becomes a `report_brief_generator` tool.

---

## 10. Suggested File and Module Layout

```text
src/components/leo/
  LeoLauncher.tsx
  LeoPane.tsx
  LeoChatThread.tsx
  LeoMessageBlockRenderer.tsx
  LeoActionCard.tsx
  LeoConfirmDrawer.tsx
  LeoHistoryPanel.tsx
  LeoMonitorPanel.tsx
  LeoRoleEmptyState.tsx
  LeoDisabledState.tsx

src/providers/
  leo-provider.tsx

src/hooks/leo/
  useLeoBootstrap.ts
  useLeoConversations.ts
  useLeoMessages.ts
  useLeoSendMessage.ts
  useLeoExecuteAction.ts
  useLeoMonitors.ts

src/lib/leo/
  access.ts
  bootstrap.ts
  types.ts
  prompts/
  context/
  tools/
  actions/
  audit.ts
  usage.ts
  response-cache.ts
  prompt-safety.ts
  citations.ts

src/app/api/leo/
  bootstrap/route.ts
  conversations/route.ts
  conversations/[id]/route.ts
  conversations/[id]/messages/route.ts
  actions/preview/route.ts
  actions/execute/route.ts
  monitors/route.ts
  monitors/[id]/route.ts
  feedback/route.ts
  search/route.ts

src/app/api/admin/leo/
  settings/route.ts

src/app/api/platform/leo/
  settings/route.ts
  schools/[schoolId]/route.ts
  usage/route.ts
  audit/route.ts

src/models/
  PlatformFeatureFlag.ts
  LeoConversation.ts
  LeoMessage.ts
  LeoActionRun.ts
  LeoMonitor.ts
  LeoFeedback.ts
  LeoUsageEvent.ts
  LeoResponseCache.ts
```

---

## 11. Data Model

### 11.1 `PlatformFeatureFlag`

Purpose:

1. Persistent global control plane for Leo.
2. Future reusable flag store for other features.

Required indexes:

1. Unique `key`.

### 11.2 `SchoolSettings.leo`

Purpose:

1. School-level override and policy surface.
2. Connect Leo behavior to existing school settings patterns.

### 11.3 `LeoConversation`

Purpose:

1. Store a user’s chat thread.
2. Support reopening and page continuity.

Suggested shape:

```ts
type LeoConversation = {
  _id: ObjectId;
  schoolId?: ObjectId | null;
  userId: ObjectId;
  role: "platform_admin" | "school_admin" | "bursar" | "billing_owner" | "teacher" | "parent" | "student";
  title: string;
  sourceApp: "platform" | "admin" | "teacher" | "parent" | "student";
  sourceRoute?: string | null;
  sourceTab?: string | null;
  pinned: boolean;
  archivedAt?: Date | null;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

Indexes:

1. `{ userId: 1, archivedAt: 1, lastMessageAt: -1 }`
2. `{ schoolId: 1, role: 1, lastMessageAt: -1 }`

### 11.4 `LeoMessage`

Purpose:

1. Persist user and assistant turns.
2. Store structured responses and citations.

Suggested shape:

```ts
type LeoMessage = {
  _id: ObjectId;
  conversationId: ObjectId;
  schoolId?: ObjectId | null;
  userId: ObjectId;
  role: string;
  author: "user" | "assistant" | "system" | "tool";
  contentText: string;
  blocks?: Array<Record<string, unknown>>;
  citations?: Array<{
    type: "route" | "entity" | "report" | "record";
    label: string;
    ref: string;
  }>;
  pageContextSnapshot?: Record<string, unknown> | null;
  toolCalls?: Array<Record<string, unknown>>;
  modelUsed?: string | null;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | null;
  status: "complete" | "error" | "cancelled";
  errorMessage?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

Indexes:

1. `{ conversationId: 1, createdAt: 1 }`

### 11.5 `LeoActionRun`

Purpose:

1. Store previews and executions of Leo actions.
2. Back audit and post-action follow-up UX.

Suggested shape:

```ts
type LeoActionRun = {
  _id: ObjectId;
  schoolId?: ObjectId | null;
  conversationId?: ObjectId | null;
  messageId?: ObjectId | null;
  actorUserId: ObjectId;
  actorRole: string;
  actionKey: string;
  scopeType?: string | null;
  scopeId?: string | null;
  previewInput: Record<string, unknown>;
  previewOutput?: Record<string, unknown> | null;
  executeInput?: Record<string, unknown> | null;
  executeOutput?: Record<string, unknown> | null;
  confirmationState: "not_required" | "pending" | "confirmed" | "cancelled";
  status: "previewed" | "executed" | "failed";
  auditEventId?: ObjectId | null;
  errorMessage?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

Indexes:

1. `{ actorUserId: 1, createdAt: -1 }`
2. `{ schoolId: 1, actionKey: 1, createdAt: -1 }`

### 11.6 `LeoMonitor`

Purpose:

1. Let users subscribe to recurring Leo checks.
2. Power daily briefs and alerts.

Suggested shape:

```ts
type LeoMonitor = {
  _id: ObjectId;
  schoolId?: ObjectId | null;
  userId: ObjectId;
  role: string;
  name: string;
  monitorKey: string;
  config: Record<string, unknown>;
  deliveryChannels: Array<"in_app" | "email">;
  schedule: {
    type: "daily" | "weekly" | "manual";
    dayOfWeek?: number | null;
    hourLocal?: number | null;
    minuteLocal?: number | null;
  };
  active: boolean;
  lastRunAt?: Date | null;
  nextRunAt?: Date | null;
  lastOutcome?: {
    status: "ok" | "warn" | "error";
    summary?: string | null;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}
```

Indexes:

1. `{ userId: 1, active: 1 }`
2. `{ active: 1, nextRunAt: 1 }`

### 11.7 `LeoFeedback`

Purpose:

1. Capture response quality.
2. Support prompt and tool improvement.

Suggested shape:

```ts
type LeoFeedback = {
  _id: ObjectId;
  schoolId?: ObjectId | null;
  conversationId: ObjectId;
  messageId: ObjectId;
  userId: ObjectId;
  role: string;
  rating: "helpful" | "not_helpful";
  reasonCodes?: string[];
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### 11.8 `LeoUsageEvent`

Purpose:

1. Track Leo-specific token usage, tool counts, latency, and action outcomes.
2. Avoid overloading current narrow `AIFeatureUsageEvent` enums.

Suggested shape:

```ts
type LeoUsageEvent = {
  _id: ObjectId;
  schoolId?: ObjectId | null;
  userId: ObjectId;
  role: string;
  conversationId?: ObjectId | null;
  messageId?: ObjectId | null;
  route?: string | null;
  pageType?: string | null;
  intent?: string | null;
  toolsUsed: string[];
  actionsSuggested: string[];
  actionExecuted?: string | null;
  status: "success" | "error" | "blocked";
  modelUsed?: string | null;
  latencyMs?: number | null;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### 11.9 `LeoResponseCache`

Purpose:

1. Cache expensive deterministic context summaries.
2. Reuse current AI cache patterns, but with Leo-specific keys.

Cache examples:

1. school setup summary
2. class timetable blocker summary
3. teacher workload summary
4. report brief
5. overdue risk narrative

---

## 12. Backend Contracts and Services

### 12.1 Shared Types

Define:

1. `LeoBootstrapPayload`
2. `LeoContextEnvelope`
3. `LeoToolResult`
4. `LeoActionDefinition`
5. `LeoActionPreview`
6. `LeoAssistantResponse`

### 12.2 `LeoBootstrapPayload`

Must include:

1. effective Leo access state
2. current role
3. current school
4. current academic period
5. available tool families
6. available action families
7. UI settings
8. model profile
9. conversation starter prompts

### 12.3 `LeoContextEnvelope`

Must include:

1. role metadata
2. route and tab
3. current entity references
4. current date window
5. current academic period
6. page-specific data summary
7. allowed write capabilities

### 12.4 Tool Registry

Tools are read-only data fetchers or analyzers.

Required tool families:

1. `setup_tools`
2. `student_tools`
3. `teacher_tools`
4. `class_tools`
5. `timetable_tools`
6. `calendar_tools`
7. `promotion_tools`
8. `fees_tools`
9. `finance_tools`
10. `report_tools`
11. `communication_tools`
12. `store_tools`
13. `document_tools`
14. `platform_tools`

### 12.5 Action Registry

Actions are guarded mutations or draft outputs.

Action categories:

1. `navigate`
2. `draft`
3. `create`
4. `update`
5. `assign`
6. `publish`
7. `bulk`
8. `notify`
9. `export`

Every action must define:

1. key
2. title
3. description
4. permission guard
5. preview function
6. execute function
7. confirmation requirement
8. audit payload builder

### 12.6 Prompting Rules

System prompts must enforce:

1. cite source entities and pages used
2. distinguish fact from recommendation
3. do not invent missing data
4. do not propose actions user cannot perform
5. do not execute writes without confirmation

### 12.7 Context Builder Rules

Each route should optionally register a page context provider.

Examples:

1. class schedule page provides class, period, draft version, conflict summary
2. teacher detail page provides teacher, assignments, workload, weekly schedule summary
3. settings page provides active tab and relevant settings snapshot

---

## 13. API Contract

### 13.1 Platform Admin APIs

#### `GET /api/platform/leo/settings`

Returns:

1. platform flag state
2. runtime env state
3. entitlement binding
4. override policy
5. adoption metrics summary

#### `PATCH /api/platform/leo/settings`

Allows platform admin to:

1. set `defaultState`
2. set `forcedMode`
3. set `allowSchoolOverride`
4. set `allowSchoolSelfService`
5. bind or unbind entitlement key

#### `GET /api/platform/leo/schools/[schoolId]`

Returns:

1. school effective state
2. school override
3. entitlement state
4. usage summary

#### `PATCH /api/platform/leo/schools/[schoolId]`

Allows platform admin to:

1. enable or disable Leo for a school
2. bypass entitlement for pilot mode
3. patch role overrides
4. patch write and monitor policy

#### `GET /api/platform/leo/usage`

Supports:

1. global usage aggregation
2. per-school adoption
3. per-role usage
4. token cost and action execution counts

#### `GET /api/platform/leo/audit`

Returns:

1. Leo action runs
2. error rates
3. flagged unsafe attempts

### 13.2 School Admin APIs

#### `GET /api/admin/leo/settings`

Returns:

1. effective school Leo settings
2. whether school self-service is allowed

#### `PATCH /api/admin/leo/settings`

Allowed only when platform permits it.

Can update:

1. school `accessOverride`
2. role overrides
3. write and monitor settings
4. UI preferences

### 13.3 Shared Leo APIs

These routes are role-neutral and resolve auth internally.

#### `GET /api/leo/bootstrap`

Returns bootstrap payload for the current role and page.

#### `GET /api/leo/conversations`

List current user conversations.

#### `POST /api/leo/conversations`

Create a conversation.

#### `GET /api/leo/conversations/[id]`

Return one conversation with metadata.

#### `PATCH /api/leo/conversations/[id]`

Update title, pin, or archive state.

#### `DELETE /api/leo/conversations/[id]`

Soft-delete or archive.

#### `GET /api/leo/conversations/[id]/messages`

Return thread messages.

#### `POST /api/leo/conversations/[id]/messages`

Input:

1. user message
2. client route context
3. optional selected entity refs

Output:

1. assistant response blocks
2. citations
3. suggested actions
4. tool traces in dev mode only

#### `GET /api/leo/search`

Cross-module search endpoint for Leo and future command palette use.

#### `POST /api/leo/actions/preview`

Preview a proposed action without mutation.

#### `POST /api/leo/actions/execute`

Execute a confirmed action.

#### `GET /api/leo/monitors`

List current user monitors.

#### `POST /api/leo/monitors`

Create a monitor.

#### `PATCH /api/leo/monitors/[id]`

Update monitor.

#### `DELETE /api/leo/monitors/[id]`

Deactivate monitor.

#### `POST /api/leo/feedback`

Record helpful or not helpful feedback.

### 13.4 Existing AI Routes Migration

During implementation, existing point-AI routes may remain public but should be progressively wrapped behind Leo orchestration.

Goal end state:

1. point-AI routes become internal service functions or private tool routes
2. Leo chat is the main user-facing orchestration surface

---

## 14. Frontend UX Specification

### 14.1 Global Launcher

Desktop:

1. Fixed bottom-right.
2. Shows unread monitor count if any.
3. Supports collapsed, expanded, and hidden states.

Mobile:

1. Floating action button.
2. Opens full-height bottom sheet.

### 14.2 Pane Layout

Tabs:

1. `Chat`
2. `History`
3. `Monitors`
4. `Actions` or `Shortcuts`

Main sections:

1. context header
2. quick prompts
3. thread body
4. action cards
5. composer

### 14.3 Message Block Types

Assistant messages may include:

1. paragraph text
2. bullet summary
3. citation list
4. warning block
5. status block
6. KPI card
7. action card
8. comparison block
9. table block
10. timeline block

### 14.4 Confirmation UX

For write actions:

1. show preview summary
2. show affected entities
3. show irreversible impacts
4. require confirm button
5. show success or partial-failure result

### 14.5 Disabled States

If Leo is off:

1. no launcher if runtime or platform forced off
2. disabled card if school-level or plan-level off and the route has Leo placeholders
3. reason must be explicit

### 14.6 Role-Specific Home Surfaces

Admin:

1. Leo daily brief card on dashboard
2. Ask Leo button on major detail pages

Teacher:

1. Today summary card
2. Ask Leo on class, gradebook, attendance, and lesson-note pages

Parent:

1. Ward summary launcher
2. explain-this-report affordance

Student:

1. plan-my-week prompt
2. explain-my-result prompt

Bursar:

1. finance summary card
2. unresolved reconciliation quick prompt

Platform admin:

1. adoption and feature-control dashboard widgets

---

## 15. Page Integration Requirements

Every major page that Leo supports should expose a `page context adapter`.

Minimum required integration points:

1. `/admin`
2. `/admin/settings`
3. `/admin/students`
4. `/admin/students/[id]`
5. `/admin/teachers`
6. `/admin/teachers/[id]`
7. `/admin/classes`
8. `/admin/classes/[id]`
9. `/admin/classes/[id]?tab=schedule`
10. `/admin/subjects`
11. `/admin/grades`
12. `/admin/timetable`
13. `/admin/academic-calendar`
14. `/admin/periods`
15. `/admin/promotions`
16. `/admin/reports`
17. `/admin/fees`
18. `/admin/finance`
19. `/admin/store`
20. `/admin/supplies`
21. `/admin/documents`
22. `/admin/email`
23. `/teacher`
24. `/teacher/classes`
25. `/teacher/gradebook`
26. `/teacher/attendance`
27. `/teacher/schedule`
28. `/teacher/studio/*`
29. `/teacher/lesson-notes`
30. `/parent`
31. `/parent/academics`
32. `/parent/fees`
33. `/parent/calendar`
34. `/student`
35. `/student/assignments`
36. `/student/results`
37. `/student/timetable`
38. `/platform`
39. `/platform/flags`
40. `/platform/schools/[id]`

---

## 16. Security, Privacy, and Safety

### 16.1 Permission Rules

Leo must only query tools and execute actions the current user is already allowed to access manually.

### 16.2 School Boundary

All Leo reads and writes must be scoped to the authenticated school unless the role is platform admin.

### 16.3 Prompt Safety

Implement:

1. prompt input normalization
2. route and tool allowlists
3. entity ID validation
4. output sanitization before rendering

### 16.4 Sensitive Operations

Always require confirmation for:

1. timetable publish
2. teacher replacement
3. homeroom replacement
4. bulk assignment changes
5. messaging or notices
6. payment or finance state changes
7. promotion finalization

### 16.5 Audit Logging

Every action execution must log:

1. actor
2. school
3. role
4. route context
5. proposed action
6. preview diff
7. final outcome

---

## 17. Observability and Cost Controls

Track:

1. active users by role
2. messages per day
3. tool usage by module
4. action preview to execution conversion
5. error rate
6. latency by tool chain
7. token usage by school and role
8. cache hit rate
9. top cited pages and unresolved intents

Controls:

1. per-school daily token budget
2. model profile selection
3. fallback to low-cost model for summaries
4. cached deterministic summaries where possible

---

## 18. Testing Strategy

### 18.1 Unit Tests

Required for:

1. access resolution
2. role gating
3. context builder
4. tool adapter normalization
5. action preview and execution contracts

### 18.2 Integration Tests

Required for:

1. platform flag plus school override interactions
2. conversation creation and message flow
3. citation generation
4. action preview then execute flow
5. monitor creation and delivery

### 18.3 E2E Tests

Required for:

1. admin asks Leo from timetable page and gets class-specific blockers
2. teacher asks Leo about weekly schedule and gets current-period schedule
3. parent asks Leo about a ward fee balance and gets ward-scoped answer only
4. student asks Leo about this week’s assignments
5. platform admin disables Leo globally and launcher disappears everywhere
6. platform admin enables Leo for one pilot school only

### 18.4 Security Tests

Required for:

1. cross-school access denial
2. role data leakage denial
3. unsafe action execution denial without confirmation
4. prompt injection resistance at the tool layer

---

## 19. Rollout Plan

### Phase 0: Control Plane

1. add runtime env flag
2. add `PlatformFeatureFlag`
3. add `SchoolSettings.leo`
4. add platform and school settings UIs

### Phase 1: Assistant Shell

1. launcher
2. pane
3. bootstrap endpoint
4. conversation and message persistence

### Phase 2: Admin Read-Only Leo

1. setup readiness
2. timetable explanation
3. teacher and class explanation
4. report explanation
5. fee and finance explanation

### Phase 3: Admin Safe Actions

1. draft notices
2. navigate to blockers
3. assign teacher previews
4. school-setting guidance

### Phase 4: Teacher Leo

1. schedule and class support
2. drafting in teacher studio
3. attendance and gradebook summaries

### Phase 5: Parent and Student Leo

1. ward summaries
2. assignment and results explanations
3. timetable and notice summaries

### Phase 6: Finance and Platform Leo

1. bursar workflows
2. billing owner workflows
3. platform admin operational mode

---

## 20. Acceptance Criteria

The feature is complete when:

1. platform admin can enable or disable Leo globally
2. platform admin can enable or disable Leo for a specific school
3. school effective state is visible and auditable
4. launcher respects effective state and role
5. Leo can explain key admin blockers on major pages
6. Leo can suggest and preview guarded actions
7. Leo stores conversations, actions, usage, and feedback
8. Leo respects school, role, and entity permissions
9. existing point-AI features can be invoked through Leo flows
10. E2E tests cover global off, school-specific on, and role-scoped access

---

## 21. Implementation Notes for Developers

1. Do not bind Leo directly to page components with ad hoc fetches. Always go through the shared Leo bootstrap and context system.
2. Do not let assistant text call arbitrary internal routes. All reads and writes must go through registered tools and actions.
3. Keep existing AI routes working during migration, but stop adding new one-off Leo endpoints once the shared architecture exists.
4. Start with a small set of high-confidence tools per module and expand. Do not ship a generic unrestricted data-access layer.
5. Reuse existing audit and permission patterns already used in admin and platform routes.
6. Prefer additive schema changes. Do not break current settings, entitlements, or AI features.
7. Keep the assistant provider-agnostic at the orchestration layer even if OpenAI is the initial default.

---

## 22. Recommended Initial Prompt and Tool Priorities

Start with the highest-value admin tools first:

1. `setup_readiness_summary`
2. `teacher_assignment_conflicts`
3. `class_timetable_status`
4. `class_subject_teacher_links`
5. `teacher_week_summary`
6. `student_risk_summary`
7. `fees_overdue_summary`
8. `report_brief`
9. `settings_change_impact`

First write actions:

1. `navigate_to_fix_surface`
2. `draft_school_notice`
3. `draft_parent_message`
4. `preview_teacher_assignment_change`
5. `preview_homeroom_change`
6. `preview_timetable_publish`

---

## 23. Final Product Standard

Leo should ship as a `core platform capability`, not an experimental widget.

That means:

1. one assistant shell across roles
2. one persistent control plane for platform and schools
3. one audited action system
4. one context system
5. one permission model
6. one telemetry and feedback loop

If developers follow this document, Leo can be built incrementally without creating another disconnected AI subsystem.
