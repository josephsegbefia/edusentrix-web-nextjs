# EduSentrix UI Stability Audit

## Executive Summary

Audit date: 2026-10-03. Stage 1 only: source inspection, no application fixes.

- Repository-wide inventory and pattern searches covered 3,013 files under `src/app`, `src/components`, `src/hooks`, and `src/lib`, including 3,007 JS/TS source files and 306 route pages.
- 116 distinct files received targeted source inspection, including providers and configuration outside those four roots. This is a broad static audit with focused behavioral tracing, not a claim that every file was read line by line.
- **27 grouped findings: 1 Critical, 14 High, 11 Medium, 1 Low.** A finding can cover several instances of the same cause. Pattern-group counts overlap.
- The most consequential findings are cross-conversation draft reuse, a cache-isolation assumption at identity transitions, shared full-screen busy behavior, repeated fetch effects, and forms being rehydrated or unmounted during ongoing work.
- The highest-risk surfaces are communications, lesson/AI review and authoring, admissions form building, payment setup, and shared query/auth providers.
- The existing uncommitted Platform Email repair is a useful local reference. However, its queries remain subject to the shared BusyProvider, so fixing its skeletons alone does not eliminate all possible blocking flashes.

Evidence classifications used below:

- **A:** valid initial-load or intentionally safe behavior; documented in the healthy/false-positive sections.
- **B:** a concrete source-level risk whose visible impact depends on an additional condition that needs runtime validation.
- **C:** the inspected interaction directly reaches the problematic source pattern. This is still static evidence, not a browser recording.

No signed-in browser session, production trace, network-throttled interaction test, or visual layout measurement was performed. Exact flicker duration, request frequency, focus behavior, and account-switch reachability require runtime validation. No backend authorization failure is alleged.

### Coverage Map

| Area | Inspected surfaces and outcome |
| --- | --- |
| Platform | Dashboard, users, schools, billing/settings, subscription lists/catalogs, school subscription editor, applications drawer, audit explorer, proposals, staff invitation workflow, assisted onboarding and provisioning status. Server-rendered listing pages were distinguished from client fetch loops. No standalone platform reports/invitations route was assumed; invitations live in staff workflows and reporting appears in audit/billing/proposal surfaces. |
| School administration | Students, teachers, invitations, admissions, finance/payment setup, cash close, payments drawer, invoices, reports, store, communications, calendars, lesson sessions, class schedules, settings. Parent-facing access and invitation flows were inspected; there is no standalone `admin/parents/page.tsx` in this inventory. |
| Teacher | Dashboard, attendance, class timetable surface, assessments/assignments, quiz creation, grading/mark entry, schemes, lesson-note review, Explore authoring, messages and settings. |
| Parent | Messages, payments, reports/document downloads, attendance, academics, ward detail, calendar, notifications and shared library. |
| Student / bursar | Student layout/dashboard/results and shared library. Bursar home is an authorized redirect to school finance, so finance findings apply there rather than to a separate bursar dashboard. |
| Shared | Root/role layouts, role gate, auth/query/busy providers, school-selection flow, network health, command palette, upload control, navigation/loading boundaries, keys, effects, invalidations and router calls. |

## Severity Definition

### Critical

Interaction could display incorrect tenant/entity data, corrupt state, cause duplicate actions, or create severe unusability.

### High

Visible flicker, full-region remount, destructive state reset, repeated expensive request, or major interaction instability.

### Medium

Noticeable layout shift, unnecessary loading replacement, broad invalidation, excessive refetch, or avoidable remount.

### Low

Minor progress-state inconsistency, cosmetic shift, or maintainability issue contributing to UX instability.

## Findings

Line references are approximate locations in the current working tree. Repairs below are proposals, not changes made.

### F01 - CRITICAL - Reply drafts survive a conversation identity change

**Files / components:** `src/app/(app)/parent/messages/page.tsx:178`, `:187`, `:416` (ThreadView); `src/app/(app)/admin/email/page.tsx:175`, `:189`, `:716` (MessageView); `src/app/(app)/teacher/communication/messages/page.tsx:216`, `:242`, `:628` (ThreadView).

**Pattern / evidence (C):** Each pane stores the draft in local state, receives a changing `threadId`, and is rendered without an entity key or a draft reset tied to that ID. Send uses the current thread/recipient.

**Current behavior / symptom:** On desktop, select thread A, type without sending, then select B directly. React preserves the draft while the query switches to B. The text can then be sent into B. An earlier send completion can also clear state that now belongs to another draft if navigation is allowed.

**Repair:** Bind drafts and async completions to conversation identity. Prefer an identity-scoped draft store or an explicitly keyed composer, with an intentional discard/preserve policy. Keep the outer pane mounted; never carry A's messages or draft into B.

**Repair risk / batch:** Medium, correctness-sensitive. Batch A1, separate from visual loading replacements; test recipient identity and late mutation completion.

### F02 - HIGH - Shared cache isolation depends on identity changes remounting the provider

**Files / functions:** `src/providers/query-provider.tsx:7`; `src/providers/auth-provider.tsx:50`, `:85`; `src/app/auth/switch/page.tsx:58`; `src/hooks/admin/useStudents.ts:45`; `src/hooks/admin/useTeachers.ts:63`; `src/hooks/parent/useParentMessages.ts:49`.

**Pattern / evidence (B):** One root QueryClient persists across client navigation. Several protected keys omit user/school identity. Logout invalidates `me` and `school`, but does not remove other protected data; active-school selection uses client navigation without a visible cache boundary.

**Current behavior / symptom:** If an account or active-school transition preserves this provider, a subsequent observer can reuse another context's cache, especially with refetch-on-mount disabled. This is a conditional client-display risk, not proof that the current Clerk flow preserves the provider or that server isolation fails.

**Repair:** First reproduce the actual transition lifecycle. Then establish a verified identity/membership cache boundary, canceling obsolete reads and removing or partitioning protected cache entries. Do not broadly introduce previous-data retention before this is settled.

**Repair risk / batch:** High. Batch A2 must be separate, with two-account/two-school tests and no changes to authorization rules.

### F03 - HIGH - Shared busy handling blocks and blurs routine interactions

**Files / components:** `src/providers/app-providers.tsx:8`; `src/providers/busy-provider.tsx:30`, `:59`, `:85`; `src/hooks/useBusyToast.ts:26`; `src/app/(app)/teacher/page.tsx:16`; `src/app/(app)/admin/reports/page.tsx:1659`.

**Pattern / evidence (C):** BusyProvider counts uncached query fetches and almost all mutations, then mounts an animated full-screen overlay, locks body scrolling and blurs the active element. BusyToast also enables this for manually wrapped promises, including refreshes.

**Current behavior / symptom:** Selecting an uncached mailbox, record or page can darken/block the entire app despite a local loader. Ordinary mutations and wrapped refetches can lose input focus. Observer placeholder data does not populate the new query's actual cached data, so it does not necessarily avoid this overlay.

**Repair:** Move toward explicit opt-in global blocking, migrating callers incrementally to local pending/progress states. Retain operation-level duplicate-submit guards, keyboard guards and owned scroll-lock cleanup before removing blanket protection. Preserve truly blocking workflows.

**Repair risk / batch:** High, shared blast radius. Batch D; do not globally disable it as an isolated one-line fix.

### F04 - HIGH - Toast-object dependencies can repeatedly fetch and reset authoring state

**Files / components:** `src/hooks/useToast.ts:12`; `src/hooks/useBusyToast.ts:21`, `:62`; `src/components/lessons/TeacherSessionExploreReviewModal.tsx:127`, `:153`; `src/app/(app)/teacher/studio/assignments/new/page.tsx:37`; `src/app/(app)/teacher/studio/quizzes/new/page.tsx:38`.

**Pattern / evidence (C):** The toast hooks return newly created objects/functions. Explore's load callback depends on that object and its effect depends on the callback; the load sets state and replaces editable content. The assignment/quiz seed effects also depend on the object and set loading/seed state.

**Current behavior / symptom:** Rendering while these fetch paths are active can launch additional loads. Responses cause more renders and may reseed an editor, continually restart loading, or overwrite edits. The seed paths are conditional on their URL/seed options.

**Compiler check:** `next.config.ts:5` enables React Compiler. A read-only local Babel/React Compiler transform left the toast hooks unmemoized and retained the seed effect's toast dependency; compiler presence does not establish stable identity here. This was not a production Next build or runtime reproduction.

**Repair:** Give effect-facing callbacks a stable contract, separate notifications from resource identity, cancel/ignore obsolete requests, and initialize editable state only for the intended entity/version.

**Repair risk / batch:** Medium-high. Batch B; test request counts after typing, opening, closing and changing session IDs.

### F05 - HIGH - Assignment refetch replaces an already loaded grid

**File / component:** `src/app/(app)/teacher/studio/assignments/page.tsx:28`, `:56`, `:143` (assignments page).

**Pattern / evidence (C):** `isLoading || isFetching` selects four animated placeholder blocks. Publish, close and archive actions call refetch.

**Current behavior / symptom:** A background read after an action removes every assignment card. Open card UI is unmounted and the grid visibly pulses.

**Repair:** Use initial loading only when no valid data exists for the active scope. Retain same-scope cards during background reads; show action-specific pending state and subtle refresh progress. Keep explicit new-filter loading honest.

**Repair risk / batch:** Low-medium. Batch E1. Coordinate pending action guards in `src/components/teacher/studio/AssignmentCard.tsx:177` before changing global busy behavior.

### F06 - HIGH - Parent payment pagination replaces the whole page

**Files / functions:** `src/app/(app)/parent/payments/page.tsx:237`, `:253`, `:287`, `:468`; `src/hooks/parent/useParentPayments.ts:55`.

**Pattern / evidence (C):** The query key includes offset; the page accumulates rows in `loadedPayments`, but an early `isLoading` return replaces the page when the next offset is uncached.

**Current behavior / symptom:** Load More hides existing payments and controls behind page skeletons even though accumulated rows are available. The page height and scroll position can jump.

**Repair:** Separate initial load from next-page loading, preferably using the established infinite-query pattern if available. Keep only rows for the same ward/year/filter identity, localize next-page errors, and reset accumulated data on identity changes.

**Repair risk / batch:** Medium, financial context. Batch E2; test mixed payment counts, failed next pages, ward/year changes and totals.

### F07 - HIGH - Parent period selection repeats whole-page initial loading

**Files / functions:** `src/app/(app)/parent/attendance/page.tsx:341`, `:366`; `src/app/(app)/parent/academics/page.tsx:418`, `:443`; `src/hooks/parent/useParentAttendance.ts:71`; `src/hooks/parent/useParentAcademics.ts:75`.

**Pattern / evidence (C):** Pages first query with an undefined period, copy the returned default period into state, then request the equivalent explicit-period key. Their initial-loading branches replace the full page again.

**Current behavior / symptom:** First entry can produce two loading cycles. Choosing an uncached period removes the header and selector along with results.

**Repair:** Resolve/canonicalize the initial period without an equivalent second cold fetch, and preserve the header/filter shell. Clear or localize results for a new period; do not label old-period grades or attendance as current.

**Repair risk / batch:** Medium. Batch E2; validate default period, historical periods, URL behavior and no-data periods.

### F08 - HIGH - School and family conversation panes still use large loading replacements

**Files / components:** `src/app/(app)/parent/messages/page.tsx:204`; `src/app/(app)/teacher/communication/messages/page.tsx:280`; `src/app/(app)/admin/email/page.tsx:233`, `:686`.

**Pattern / evidence (C):** Parent/teacher thread loading returns a different skeleton subtree, including a replacement header. School email uses pulse blocks for thread bodies and its inbox list.

**Current behavior / symptom:** Uncached conversation selection blinks large regions; parent/teacher back and compose controls disappear during loading. The school-email archive control also lacks a local loading/pending disable at approximately line 220.

**Repair:** Preserve the header, back control and bounded pane/list dimensions; localize loading to identity-cleared content. Disable identity-dependent actions while loading. Apply F01 before preserving any composer subtree.

**Repair risk / batch:** Low-medium after F01. Batch F; preserve mobile back navigation and thread isolation.

### F09 - HIGH - Proposal search combines list blinking with response races

**File / component:** `src/components/platform/proposals/ProposalListClient.tsx:43`, `:51`, `:158`, `:164`.

**Pattern / evidence (C):** Every load sets the same loading flag, and the table is replaced with pulse rows. Requests have no cancellation/latest-response guard. The query is deferred, not debounced.

**Current behavior / symptom:** Search, status changes, paging, refresh and deletion reload the entire list region. A slow older response can overwrite newer results and pagination.

**Repair:** Tie results to the requested filter/page identity, abort or reject obsolete completions, and separate first load from refreshing. Keep table structure and controls stable; debounce search if appropriate. A transition alone does not prevent response races.

**Repair risk / batch:** Medium. Batch E3; deliberately reverse response order in tests.

### F10 - MEDIUM - Other manual lists can resolve into the wrong active filter

**Files / functions:** `src/components/platform/audit/PlatformAuditExplorer.tsx:46`, `:74`, `:105`; `src/app/(app)/platform/subscriptions/schools/page.tsx:88`, `:194`; `src/app/(app)/admin/communications/page.tsx:254`, `:293`, `:639`.

**Pattern / evidence (C):** List fetches write shared result/loading state without a request-identity guard. Audit search automatically fetches as text changes and also has an Apply action; communications resets pagination in a separate effect.

**Current behavior / symptom:** Overlapping requests can restore an old filter/page, prematurely end loading, or duplicate work. Subscription and communications loading branches also replace results. Audit already preserves its table shell, so it needs request control rather than a wholesale visual rewrite.

**Repair:** Use one authoritative filter/page state, a single trigger policy, and cancellation/latest-request acceptance. Keep result labels consistent with committed filters.

**Repair risk / batch:** Medium. Batch E3, with per-module API/query contracts preserved.

### F11 - HIGH - Successful saves reload and remove the surrounding editor

**Files / functions:** `src/app/(app)/platform/schools/[id]/subscription/page.tsx:179`, `:225`, `:262`; `src/app/(app)/admin/store/page.tsx:143`, `:165`, `:219`.

**Pattern / evidence (C):** Mutation success calls the same load routine used for first entry. That routine sets loading true; an early return replaces the whole page/form with a spinner.

**Current behavior / symptom:** Saving a subscription or adding a store product removes the working surface, loses focus and changes height. Subscription load also rehydrates the editor.

**Repair:** Separate bootstrap from revalidation; preserve the form and action bar during save. Apply acknowledged server values deliberately and keep errors/drafts in place. On a different school, clear the old school's data.

**Repair risk / batch:** Medium. Batch C2; billing calculations and subscription policy stay unchanged.

### F12 - HIGH - Subscription catalog actions lack local pending and failure handling

**Files / functions:** `src/app/(app)/platform/subscriptions/payment-charges/page.tsx:153`, `:161`, `:316`; `src/app/(app)/platform/subscriptions/add-ons/page.tsx:157`, `:166`, `:267`.

**Pattern / evidence (C):** Toggle/delete or inline-price handlers await raw fetch calls without consistently checking success or maintaining action-specific pending state. They then reload the list; some show success or clear editing state regardless of HTTP failure.

**Current behavior / symptom:** Users can repeat an action while its request is pending; failures can look successful, followed by a list skeleton or a reverted value. The claim is repeated request risk, not proven duplicate persisted charges.

**Repair:** Check HTTP/application success, disable the affected control while pending, preserve failed edits and show accurate errors. Update/revalidate the relevant item without replacing the catalog. Keep deletion confirmation.

**Repair risk / batch:** Medium-high, pricing-sensitive. Batch C1, separate from visual-only table changes.

### F13 - HIGH - Finance refreshes overwrite unsaved fields

**Files / components:** `src/app/(app)/admin/settings/payment-setup/page.tsx:320`; `src/hooks/admin/useSchoolPaymentSetup.ts:308`; `src/app/(app)/admin/finance/cash-close/page.tsx:56`, `:106`.

**Pattern / evidence (C):** Payment setup copies all bank/owner/delegate fields from each changed DTO without consulting dirty state. Account reveal changes that cached DTO. Cash close copies returned expected amounts and notes into editable state on data changes.

**Current behavior / symptom:** Revealing payout details, other successful setup actions or an explicit refresh can overwrite concurrent edits. Cash-close refresh can similarly discard a count/note when server data changes.

**Repair:** Initialize by school/date identity; merge only pristine fields or acknowledge explicit save/reset actions. Preserve dirty fields, warn about conflicting server changes, and keep account-reveal authorization/audit requirements intact.

**Repair risk / batch:** Medium-high. Batch C2 with deterministic dirty-form/refetch tests. Identical structurally shared responses alone do not trigger these effects.

### F14 - MEDIUM - Student profile form resets on a changed student object

**Files / functions:** `src/components/modals/EditStudentProfileForm.tsx:66`; `src/hooks/admin/useStudentDetail.ts:168`.

**Pattern / evidence (B):** The form calls reset when the student object changes, without a dirty-field guard.

**Current behavior / symptom:** If detail data changes while the editor is open, a refreshed student object can erase unsaved fields or validation state. The detail hook disables focus/mount/reconnect refetch, so ordinary window focus is not sufficient evidence; an explicit invalidation/update is needed.

**Repair:** Reset on genuine student identity changes or an acknowledged save; preserve dirty values during same-student refresh and handle conflicts explicitly.

**Repair risk / batch:** Medium. Batch C2, only after reproducing a relevant invalidation while the modal is open.

### F15 - HIGH - Admissions tab switching discards the form-builder draft

**Files / components:** `src/components/admissions/cycle/CycleWorkspace.tsx:114`; `src/components/admissions/cycle/FormBuilderTab.tsx:96`, `:99`, `:120`.

**Pattern / evidence (C):** Tabs conditionally mount the form builder. Editable state lives inside it; its dirty state is not used by the parent to guard tab navigation. A returned version change also replaces state.

**Current behavior / symptom:** Editing a form then visiting another cycle tab and returning loses unsaved changes. This is conditional unmounting, not a random-key issue.

**Repair:** Keep an identity-scoped draft outside the disposable tab body or add an explicit unsaved-change workflow. Do not preserve a draft across different cycles. Handle concurrent server version changes instead of silently replacing edits.

**Repair risk / batch:** Medium. Batch C3; test tab changes, cycle changes, save, discard and version conflicts.

### F16 - HIGH - Failed initial requests can leave permanent loading screens

**Files / components:** `src/app/(app)/teacher/settings/page.tsx:77`, `:109`, `:125`; `src/components/admissions/cycle/FormBuilderTab.tsx:99`, `:103`, `:112`.

**Pattern / evidence (C):** `isLoading || !formData/state` is evaluated before the error branch. Initial failure leaves form state null.

**Current behavior / symptom:** After the query finishes with an error, the UI still renders loading forever and never reaches its failure message.

**Repair:** Separate pending, failure, valid empty and successful initialization states. Keep a stable shell with an actionable retry; do not infer network loading from the absence of a local draft.

**Repair risk / batch:** Low-medium. Batch B, with rejected/empty response tests.

### F17 - MEDIUM - Several lists remove table structure and pagination on cold parameter changes

**Files / components:** `src/components/admissions/cycle/ApplicationsInboxTab.tsx:95`, `:274`, `:392`; `src/app/(app)/admin/fees/invoices/page.tsx:141`, `:397`, `:484`; `src/components/admin/lesson-sessions/AdminLessonSessionsOverview.tsx:145`, `:293`, `:420`.

**Pattern / evidence (C):** Uncached filter/page queries replace rows/table content with a smaller loader or fixed skeleton count; pagination is inside the loaded branch or depends on returned pagination.

**Current behavior / symptom:** Filtering or paging makes list height and footer position change; users lose their place while controls disappear or move. Same-key background fetches are not uniformly problematic: the lesson-session overview already has a small background-fetch indicator.

**Repair:** Preserve table headers, filter controls and a bounded results/footer area. Retain same-scope paging data only with truthful pending status; use blank localized loading for different entities. Do not display an empty-state message before a request resolves.

**Repair risk / batch:** Low-medium. Batch E1, with long/short/empty lists at mobile and desktop sizes.

### F18 - MEDIUM - Directory wrappers hide previous-data status from their consumers

**Files / hooks:** `src/hooks/admin/useStudents.ts:88`, `:99`; `src/hooks/admin/useTeachers.ts:84`, `:104`; `src/app/(app)/admin/students/page.tsx:226`; `src/app/(app)/admin/teachers/page.tsx:469`; `src/components/admin/students/StudentsPagination.tsx:7`.

**Pattern / evidence (B):** Queries intentionally use keepPreviousData, but convenience wrappers expose initial loading without the fetching/placeholder flags.

**Current behavior / symptom:** Under a new search/filter/page, old rows can appear without a truthful pending indication. The current global overlay may obscure part of this interval; removing it without fixing these contracts would expose the ambiguity.

**Repair:** Expose pending/placeholder status and committed result identity. Keep same-school paging responsive, but label/disable actions appropriately while new results resolve. Never carry rows across school/account identity.

**Repair risk / batch:** Medium. Batch E1, coordinated with F02/F03; previous data itself is not categorically wrong.

### F19 - MEDIUM - Overlapping invalidation prefixes repeat the same work

**Files / hooks:** `src/hooks/admin/useTeachers.ts:170`; `src/hooks/parent/useParentMessages.ts:98`.

**Pattern / evidence (C):** Teacher mutations invalidate the broad teachers prefix and then matching detail/stats descendants. Parent send invalidates a thread and the broader messages family that includes it.

**Current behavior / symptom:** Active descendant queries can be scheduled or canceled/refetched more than once. The inspected fetch functions do not consistently consume abort signals, so cancellation is not proof that server work stopped.

**Repair:** Define one invalidation plan per mutation, using exact keys where appropriate and preserving dependent aggregates. Do not remove necessary stats/unread updates merely to reduce calls.

**Repair risk / batch:** Low-medium. Batch G1; count actual network requests for each mutation and assert all dependent views update.

### F20 - MEDIUM - Several features duplicate reads through separate owners

**Files / functions:** `src/hooks/parent/useParentMessages.ts:47`, `:144`; `src/components/nav/sidebars/parent-sidebar.tsx:207`; `src/hooks/admin/useEmailInbox.ts:202`; `src/app/(app)/admin/email/page.tsx:205`; `src/hooks/leo/useLeoSchoolSettings.ts:52`; `src/components/admin/settings/SchoolLeoSettingsCard.tsx:69`; `src/hooks/leo/useLeoPlatformSettings.ts`; `src/app/(app)/platform/leo/page.tsx:67`.

**Pattern / evidence (C):** Parent unread count and thread list fetch the same full endpoint under different keys. School email/Leo settings combine mutation-owned invalidation with caller-owned refetch.

**Current behavior / symptom:** Opening messages can duplicate payload work; sends/settings saves can start overlapping refreshes. This increases latency and can amplify existing loading policies. Exact deduplication depends on timing and query state.

**Repair:** Share the parent message query with an observer select for unread count, or use a truly separate count endpoint if warranted later. Choose one refresh owner for each mutation; preserve mark-read side effects and cross-view correctness.

**Repair risk / batch:** Medium. Batch G1; test sidebar counts and settings consistency across mounted observers.

### F21 - MEDIUM - Network health consumers each create a probe loop

**Files / components:** `src/hooks/useNetworkHealth.ts:189`, `:265`, `:315`; `src/components/system/NetworkHealthWatcher.tsx:15`; `src/components/system/NetworkAccessibilityAnnouncer.tsx:10`; `src/components/system/NetworkStatusBanner.tsx:127`; `src/app/layout.tsx:41`; `src/app/(app)/layout.tsx:22`.

**Pattern / evidence (C):** The hook owns per-instance state/probing/timers. Two root consumers use 20-second intervals; the application banner has another instance.

**Current behavior / symptom:** At least three consumers in the app shell can probe independently and disagree transiently about quality. Shared SSE infrastructure does not make these HTTP probe loops shared.

**Repair:** Use one shared health source/provider with subscriptions, visibility-aware scheduling and manual-retry deduplication. Preserve accessibility announcements and offline queue behavior.

**Repair risk / batch:** Medium. Batch G2, separate from query invalidation cleanup; simulate offline, degraded, recovery and hidden-tab transitions.

### F22 - MEDIUM - Local refresh/retry actions perform full document reloads

**Files / functions:** `src/components/platform/proposals/ProposalPreviewClient.tsx:19`; `src/app/(app)/admin/students/page.tsx:680`; `src/app/(app)/admin/teachers/page.tsx:836`.

**Pattern / evidence (C):** Proposal regeneration calls `window.location.reload()`; directory error recovery also reloads the document.

**Current behavior / symptom:** The entire app bootstraps again, discarding non-URL UI state and replacing navigation/content, even though the intended change is a preview or failed list query.

**Repair:** Refresh the preview's data/server-prop boundary deliberately, and use scoped query retry for recoverable directory errors. Keep a full-reload fallback for actual runtime/chunk failures; do not mechanically remove legitimate router refresh calls.

**Repair risk / batch:** Low-medium. Batch H; verify preview freshness, authenticated navigation and retained filters.

### F23 - MEDIUM - Library search reloads unrelated panels and collapses their content

**File / component:** `src/components/library/PatronLibraryHome.tsx:150`, `:168`, `:235`, `:306`, `:338`; used by teacher, parent and student library pages.

**Pattern / evidence (C):** One load routine fetches catalogue plus loans/summary, reservations and recommendations for each search; one loading flag drives multiple panel bodies.

**Current behavior / symptom:** A catalogue search causes unrelated account panels to become small loaders and repeat requests. No latest-search acceptance guard protects catalogue writes.

**Repair:** Separate catalogue parameters from identity-scoped account data, localize pending state, and reject obsolete search responses. Preserve loans/reservations during catalogue search, never across user/role changes.

**Repair risk / batch:** Medium. Batch E3; test all three role wrappers and reservation-driven updates.

### F24 - MEDIUM - Timetable period loading removes the selector and calendar

**File / component:** `src/components/admin/classes/detail/ClassScheduleTab.tsx:66`, `:87`, `:143`.

**Pattern / evidence (C when the feature is enabled):** An early loading return precedes the period selector and published timetable, using a smaller fixed-height placeholder.

**Current behavior / symptom:** Selecting an uncached period removes the control the user just used and contracts the schedule area.

**Repair:** Keep the class/period controls and schedule footprint mounted; clear only the new period's schedule content while fetching. Respect the existing feature flag and class-group identity.

**Repair risk / batch:** Low-medium. Batch E2; verify feature-off behavior, unpublished periods and mobile schedule scrolling.

### F25 - MEDIUM - Payment drawer has an upper height bound but no stable loading footprint

**File / component:** `src/components/admin/fees/payments/PaymentDetailsDrawer.tsx:158`, `:208`, `:234`.

**Pattern / evidence (C):** The header stays mounted, but a compact loading body switches to lengthy payment details inside a max-height-only container.

**Current behavior / symptom:** Opening an uncached payment can visibly resize the drawer body and move action/context regions. Actual pixel movement has not been measured.

**Repair:** Reserve a responsive body footprint and show localized loading. Keep the header stable and preserve the existing payment-ID-based note reset. Never display the previous payment as the newly selected one.

**Repair risk / batch:** Low. Batch F; test short/long receipts and small screens.

### F26 - HIGH - Saving Explore review unmounts its own dialog

**Files / components:** `src/components/lessons/TeacherSessionExplorePanel.tsx:58`, `:157`, `:174`; `src/components/lessons/TeacherSessionExploreReviewModal.tsx:189`.

**Pattern / evidence (C):** The review dialog is rendered inside the panel's non-loading branch. Its onSaved callback calls parent load, which sets loading true and returns a different subtree. The modal also reloads its own detail.

**Current behavior / symptom:** Saving removes the dialog and then mounts a fresh instance when the panel reloads, even though reviewOpen remains true. Focus and local editor state are reconstructed, producing a close/reopen effect.

**Repair:** Keep the dialog outside disposable status content and refresh panel status independently. Use one authoritative detail refresh after save. Preserve deliberate close behavior and resolve F04 first.

**Repair risk / batch:** Medium. Batch C3, separate from general spinner replacement.

### F27 - LOW - Refresh controls have inconsistent size or pending feedback

**Files / components:** `src/components/admin/exams/ExamAnalyticsDashboard.tsx:132`; `src/app/(app)/admin/invitations/page.tsx:377`.

**Pattern / evidence (C):** Exam analytics swaps a text label for only a spinner in an auto-width button. Invitations animates its refresh icon with initial loading rather than background fetching and leaves Refresh enabled.

**Current behavior / symptom:** The analytics action can shrink during work; invitation refresh can look inactive or permit repeated clicks during a cached refetch.

**Repair:** Preserve label/icon slots or minimum dimensions; use the actual action/fetching state for the icon and pending guard.

**Repair risk / batch:** Low. Batch H; keyboard and width checks are sufficient alongside targeted lint.

## Pattern Groups

Counts below are membership counts, not additional findings.

| Group | Count / findings | Representative files | Strategy |
| --- | --- | --- | --- |
| Full-region loading replacements | 12: F03, F05-F09, F11, F16-F17, F23-F24, F26 | BusyProvider, assignments, parent payments, proposal list | Keep structural shells; distinguish initial, identity-change, next-page and background work. |
| Background refetch flicker | 5: F03, F05, F09, F11, F26 | assignments page, subscription editor, Explore panel | Retain valid same-scope content, localize refresh progress. |
| Broad/overlapping query invalidation | 2: F19-F20 | teacher/message/Leo hooks | One explicit dependency-aware invalidation/refetch owner. |
| Router refresh misuse | 1: F22 | ProposalPreviewClient, directory retries | Replace needless document reloads, not legitimate server-boundary refreshes. |
| Form state resets / identity | 5: F01, F04, F13-F15 | message drafts, payment setup, FormBuilderTab | Entity-scoped drafts, dirty guards, explicit acknowledgement/version policy. |
| Unstable component keys/remounts | 2: F15, F26 | CycleWorkspace, TeacherSessionExplorePanel | Preserve state across conditional tab/dialog unmounts; no random-root-key defect confirmed. |
| Dialog/drawer instability | 4: F04, F14, F25-F26 | Explore review, student editor, payment drawer | Stable modal ownership, safe initialization, bounded body dimensions. |
| Table/filter/pagination instability | 6: F06, F09-F10, F17-F18, F23 | parent payments, proposal/audit lists, directories | Request identity plus persistent headers/footers; safe same-scope pagination only. |
| Layout shift | 6: F07-F08, F17, F24-F25, F27 | period views, conversations, schedule, drawers | Reserve responsive geometry and stable action slots. |
| Duplicate network activity | 8: F04, F07, F09-F10, F19-F21, F23 | toast effects, parent periods, probes | Stabilize effects; cancel stale requests; consolidate equivalent reads. |
| Route/loading-boundary issues | 3: F02-F03, F22 | root providers, auth switch, hard reloads | Verify identity lifecycle and avoid duplicate/global fallbacks. |
| Other: truthful mutation/error state | 2: F12, F16 | catalog actions, settings/form builder | Preserve errors/drafts, show pending accurately, never mask failure as loading. |

## Proposed Repair Batches

Each batch below should be separately reviewable and committed only in a later authorized implementation stage. No commit is proposed for this audit turn.

### Batch A - Entity And Cache Correctness

**A1 files:** The three message/email pages in F01. **A2 files:** QueryProvider, AuthProvider, auth school-selection flow and the specific query hooks shown in F02.

**Expected improvement:** Drafts cannot cross threads; identity transitions have a demonstrated cache-isolation contract.

**Risk:** Medium for A1; high for A2. Keep these as separate commits. A2 starts with reproducing the real transition before choosing cache partitioning or lifecycle cleanup.

**Validation:** Type in A, switch to B, send and verify recipient/body; resolve A's pending send after B is active. Test mobile back behavior, logout/login as another person and supported two-school switching with warm caches. Verify no previous entity content appears and existing authorization gates still run.

### Batch B - Fetch Effects And Honest Failure States

**Files:** useToast/useBusyToast, Explore review modal, assignment/quiz creation pages, teacher settings, admissions FormBuilderTab (F04, F16).

**Expected improvement:** No repeated seed/detail loads from render identity; terminal errors stop showing loading.

**Risk:** Medium-high for shared toast contracts; low-medium for branch ordering. Separate those two changes into distinct commits.

**Validation:** Count requests across re-renders and editor typing; test rapid entity changes, close/unmount, delayed/rejected/empty responses and one initial successful fetch. Check both development and production compilation; do not rely on compiler memoization as the correctness contract.

### Batch C - Draft-Preserving Forms And Mutations

**Files:** Catalog pricing/payment charges, school subscription editor, store page, payment setup/cash close, student edit form, admissions CycleWorkspace/FormBuilderTab, Explore panel/modal (F11-F15, F26).

**Expected improvement:** Saves leave forms and dialogs in place; failure preserves edits; dirty data survives same-entity revalidation; local controls guard repeated actions.

**Risk:** Medium-high. Split into C1 catalog mutation truth/pending, C2 form refresh/dirty-state handling, and C3 tab/dialog ownership. Commit each workflow separately, especially financial and admissions behavior.

**Validation:** Double-click/keyboard submission, server rejection, concurrent field edit plus refetch, explicit discard, entity switch, save with delayed response, tab changes and dialog focus restoration. Assert no stale account/payment/cycle values are submitted.

### Batch D - Shared Busy Policy, Incrementally

**Files:** BusyProvider, useBusyToast and each migrated caller/hook (F03). Include pending guards for operations currently relying on the overlay.

**Expected improvement:** Routine local work no longer blocks, darkens or blurs the whole app.

**Risk:** High. First migrate a narrow workflow using the existing suppression mechanism, then broaden only after testing. Do not flip the default for all callers before auditing local duplicate-submit protection.

**Validation:** Pending controls, Enter-key actions, rapid repeat clicks, focus/scroll retention, overlapping queries/mutations, modal scroll locks and accessibility. Recheck the existing Platform Email repair without editing or replacing its current local diff accidentally.

**Commit policy:** Separate shared-policy commit and small per-workflow migrations.

### Batch E - Lists, Periods And Request Identity

**Files:** Assignments, parent payments/attendance/academics, proposal/audit/subscription-school lists, admin communications, admissions applications, invoices, lesson sessions, student/teacher hooks and tables, shared library, ClassScheduleTab (F05-F07, F09-F10, F17-F18, F23-F24).

**Expected improvement:** Stable controls and list geometry; no older response winning after a newer filter; next-page loading stays local.

**Risk:** Low-medium visually, medium for pagination/identity correctness. Split E1 query-backed lists, E2 period/pagination workflows and E3 manual-fetch lists into module-sized commits.

**Validation:** Cold and warm cache, short/long/empty pages, slow reverse-order responses, filter/page changes, failed next-page reads, school/ward/class/period changes, desktop/mobile scrolling. Never use a shared previous-data shortcut across identities.

### Batch F - Conversation And Drawer Loading Geometry

**Files:** Parent/teacher messages, school email, PaymentDetailsDrawer (F08, F25).

**Expected improvement:** Headers, back controls and pane footprints remain stable while new entity content loads.

**Risk:** Low-medium after A1. One communications commit and one drawer commit.

**Validation:** Empty/error/loading/loaded states; narrow screens, archive/send disabled during the relevant operation, long subject/recipient text, no old-thread/payment data, keyboard focus and scroll position.

### Batch G - Network Ownership And Deduplication

**G1 files:** Teacher/message/email/Leo hooks and their direct callers (F19-F20). **G2 files:** useNetworkHealth, watcher, announcer and banner (F21).

**Expected improvement:** Fewer redundant reads without stale counts/aggregates; one coherent network-health state.

**Risk:** Medium. Separate query invalidation cleanup from network-health infrastructure.

**Validation:** Request logs per mutation, all dependent counters/metrics, active/inactive observers, late responses, reconnect, offline queue behavior, background tabs and screen-reader announcements.

### Batch H - Scoped Navigation And Low-Risk Controls

**Files:** ProposalPreviewClient, directory error retries, ExamAnalyticsDashboard, invitations page (F22, F27).

**Expected improvement:** Local retries preserve context; refresh controls stay sized and truthful.

**Risk:** Low-medium. Commit document-refresh changes separately from button polish.

**Validation:** Regenerated preview freshness, retry recovery, URL/history and retained filters, pending button widths and keyboard behavior. Do not change external payment redirects, assisted-access transitions or auth navigation without a separate reason.

For every authorized batch: targeted ESLint on changed TS/TSX, focused tests matching the behavior, then diff checks. Shared provider/query-contract changes also need broader type/build checks. Runtime validation must include signed-in role-appropriate sessions; passing lint alone is not UI proof.

## Shared Primitive Opportunities

1. **Bounded inline loading pane:** F08, F17, F24 and F25 justify a small primitive for status text, optional spinner, accessibility and caller-owned responsive minimum dimensions. It must not decide whether old entity data is safe to show.
2. **Stable pending button slots:** F12 and F27, plus mutation migrations in F03, justify a consistent pending/disabled contract on existing Button primitives. Keep labels and icon slots mounted. Avoid creating another competing button system.
3. **Stable table status/body region:** F09, F17 and F18 justify a wrapper that retains table headers/footers, distinguishes pending/error/empty states and reserves a sensible footprint. Query identity belongs to the caller, not this wrapper.
4. **Stable toast callback contract:** F04 has multiple real consumers. Stabilizing notification APIs is more valuable than scattered dependency suppression. It must not silently preserve a stale entity closure.
5. **Shared network-health source:** F21 directly justifies deduplicating the probe source while preserving separate visual and accessibility consumers.
6. **Dirty-form refresh policy:** F13-F15 share requirements, but their edit models differ. Start with explicit entity/version/dirty rules in each workflow; extract a hook only if the implementations genuinely converge.

A universal initial-load helper, generic previous-data hook or application-wide transition wrapper is not recommended. Those abstractions would obscure the identity rules this audit needs to protect.

## Files That Appear Healthy

These are healthy inspected behaviors, not certifications of every line or shared-provider effect.

- `src/app/(app)/platform/email/page.tsx:300`, `:780`: the existing local diff retains header/pane structure, uses bounded localized spinners, disables archive while loading/pending and resets selectedThreadId on mailbox selection. It was not modified by this audit. F03 remains an independent shared concern.
- `src/app/(app)/teacher/page.tsx:16`: local dashboard rendering distinguishes initial loading from fetching; its manual refresh still inherits BusyToast behavior.
- `src/components/student/results/StudentResultsProfileClient.tsx:141`: header stays outside result loading/error branches; Refresh retains its label and uses isFetching. This does not certify uncached period transitions elsewhere in the body.
- `src/app/(app)/parent/calendar/page.tsx:183`: its fetch path uses AbortController/cleanup to avoid accepting obsolete work.
- `src/app/(app)/admin/communications/page.tsx:301`: recipient search has debouncing and abort cleanup, unlike the separate list-fetch path in F10.
- `src/components/teacher/marks/MarkEntryTab.tsx:80`: same-gradebook refresh merges incoming data while retaining dirty/saving cells. Preserve that behavior; separately validate actual class/subject identity changes before reusing it elsewhere.
- `src/components/upload/DocumentUploader.tsx:141`: the dropzone remains mounted, is disabled while busy and receives progress, rather than swapping the whole upload surface.
- `src/app/(app)/parent/reports/page.tsx:233`: document download uses local downloading state rather than replacing the report page.
- `src/components/platform/staff/PlatformStaffInviteWizard.tsx:125`, `:450`: submission has explicit pending/error handling and a mounted disabled submit control.
- `src/components/admin/students/StudentsCommandPalette.tsx:32`: clearing query on explicit close is intentional state management, not a background-refetch reset.
- Inspected root/role layouts do not use random/time-varying root keys; a persistent navigation shell already exists and should be preserved.

## False Positives / Intentionally Safe Patterns

- Skeletons used only before first data are not defects by themselves. The audit flags repeated interactive transitions, mismatched dimensions or unreachable error branches, not every animate-pulse match.
- Two components using the same TanStack Query key are not automatically duplicate requests. F20 concerns different keys for the same endpoint and competing refresh owners.
- Identical cached responses may preserve object identity through structural sharing. Dirty-form findings require changed data, explicit reset or unmount; they do not imply every background tick overwrites input.
- Same-entity previous data can be useful for pagination. Different school/student/thread/payment/account data must not be presented as the new identity's result.
- Intentional keys such as wizard step IDs animate/replace steps whose draft state is held above them. Stable state IDs generated once when adding a form section are not equivalent to random keys on every render. No Date.now/Math.random JSX root-key defect was confirmed.
- The small nested SectionHeader in `src/components/teacher/lesson-notes/steps/ReviewStep.tsx:63` is stateless in the inspected surface. It is not promoted to a confirmed visible-flicker finding merely because it is locally declared.
- `router.refresh()` after a successful server-backed staff/school creation flow can refresh server-owned props; it is not the same as a document reload. Navigation to a newly created record is intentional.
- External payment checkout, mailto/tel links, onboarding completion and assisted-access start/end can legitimately require navigation or a fresh auth/server context. They are not included in F22.
- `src/app/(app)/teacher/loading.tsx` is an initial route fallback, not automatically a refetch bug. It warrants slow-navigation testing for generic dashboard-shaped fallback geometry before any change.
- No `template.tsx` remount boundary was found in the inspected app inventory. There is no evidence for a blanket root-layout remount repair.
- Query removals for genuinely deleted schemes/admission cycles/conversations are intentional cleanup. No blanket resetQueries call was identified in the provider/hook/auth search.
- Cash close already guards its closing action while relevant data is loading. F13 concerns dirty refresh behavior, not an allegation that this specific loading guard is absent.
- BusyProvider already exempts ordinary background queries with actual cached data. F03 concerns uncached key changes, broad mutation coverage and manually wrapped refreshes, not all background reads.
- `useDeferredValue` in proposal search can improve render scheduling but does not debounce network traffic or establish response ordering. Likewise, useTransition cannot repair wrong-entity cache/draft state.
- No uncontrolled-to-controlled input defect or unsized-image defect was confirmed in the targeted reads. These search categories are not reported as clean across every application component.

## Recommended Corrective Pass Order

1. Review this report and approve a narrowly defined implementation batch. Preserve the current Platform Email and .gitignore changes.
2. A1: protect conversation drafts and async send completion ownership.
3. A2: reproduce and resolve the actual account/school cache-boundary contract before expanding previous-data retention.
4. B: eliminate unstable fetch dependencies and unreachable error states.
5. C1-C3: add truthful local mutation guards, preserve dirty forms, and fix admissions/Explore tab/dialog ownership.
6. D: migrate global busy handling incrementally, beginning with a guarded low-risk workflow.
7. E1-E3: stabilize lists, period controls, pagination and manual request ordering.
8. F: complete localized conversation/drawer geometry improvements.
9. G1-G2: remove redundant refresh ownership and consolidate network probes.
10. H: replace unnecessary document reloads and finish low-risk pending controls.
11. Run signed-in cross-role regression checks with slow/reordered responses, then review measured focus/layout/request behavior before declaring the corrective pass complete.

## Audit Verification

### Searches And Read-Only Checks

Representative commands used, with path roots abbreviated only in the prose above:

~~~sh
git status --short
rg --files src/app src/components src/hooks src/lib
rg -n 'isFetching|isRefetching|fetchStatus|keepPreviousData|placeholderData' src/app src/components src/hooks src/lib
rg -n 'animate-pulse|Skeleton|if \(.*isLoading|if \(.*loading|isLoading \?' src/app src/components src/hooks src/lib
rg -n 'router\.(refresh|replace|push)\(|(window|globalThis)\.location|location\.reload\(' src/app src/components src/hooks src/lib
rg -n 'key=\{' src/app src/components
rg -n 'invalidateQueries|resetQueries|refetchQueries|removeQueries' src/app src/components src/hooks src/lib
rg -n 'useEffect|useLayoutEffect|\.reset\(|reset\(|setLoading\(true\)' src/app src/components src/hooks src/lib
rg --files src/app -g layout.tsx -g template.tsx -g loading.tsx
rg -n 'useSWR|Suspense|useTransition|startTransition|useDeferredValue' src/app src/components src/hooks src/lib
~~~

Additional read-only checks included line-numbered source reads, a TypeScript AST scan of nested JSX component declarations, local React Compiler transforms in memory, and hashing the existing tracked diff before/after. No formatter, dependency installation, build, database action, API mutation or code-fixing command was run.

Raw discovery searches had 906 loading-related matching lines across 293 files and 136 fetching-related matching lines across 52 files. These are candidate counts, not defects. Some guessed route paths did not exist and were corrected against the repository inventory; they do not indicate a build or application error.

### Working Tree Preservation

Pre-existing modified files:

- `.gitignore`
- `src/app/(app)/platform/email/page.tsx`

The audit adds only this report, `docs/UI_STABILITY_AUDIT.md`. Application code changes: **ZERO**. The pre-existing tracked diff was verified byte-identical to the initial audit snapshot using SHA-256: `ea21009d4114db4e91b75bca1574db9500f8e28ecd48c4ec3850c1243efba47b`.

Final `git status --short` showed exactly the two pre-existing modified files above and this untracked report. `git diff --cached --name-only` was empty. The report's 27 finding headings/severity totals and 92 explicit file/line references were checked; every referenced file and numbered line exists. The report has no trailing whitespace. Global `git diff --check` reports only pre-existing trailing whitespace at `.gitignore:52` and `.gitignore:53`; it was left untouched.

No files were staged. No commit or push was performed. ESLint, TypeScript, production build and application tests were not run because this stage changes no application code; browser/runtime validation remains an explicit requirement for the implementation batches.

AUDIT COMPLETE — NO CODE CHANGES MADE
