# Background Work Engine — AI Migration (Prompt 3)

Source-backed inventory of AI / generation flows, then the Prompt 3 architecture for the flows that actually run in this repo.

Scan date: 2026-10-05  
Branch: `feature/background-work-engine-v1`

Classification key:

- `MIGRATE_TO_BACKGROUND` — long-running or persisted generation; user should be able to leave
- `KEEP_SYNCHRONOUS_INTERACTIVE` — conversational / inline wait is the UX
- `KEEP_PROVIDER_WEBHOOK` — provider callback must stay in the HTTP request
- `NEEDS_REVIEW` — leftover, unwired, or Prompt 4/5

---

## Architecture after Prompt 3

```
Authenticated generate request
  → validate user / school / entitlement / target
  → persist domain request (LessonAiGenerationRequest | ExploreGenerationJob | LessonIllustrationRequest)
  → enqueueBackgroundJob (IDs only in the Inngest event)
  → HTTP 202 { jobId, domainRequestId, status }
  → user may navigate away
  → Inngest worker reloads Mongo context
  → provider call (or reuse checkpoint)
  → validate / persist DRAFT
  → one terminal in-app notification (user-visible jobs only)
```

Invariants:

- Inngest events contain only `jobId`, `kind`, optional `schoolId`, `initiatedByUserId`, `correlationId`.
- BackgroundJob input/result stay under 16KB and hold references, not prompts/PDFs/bytes.
- AI-generated authoring stays draft / ready-for-review. No auto-publish.
- Provider usage is recorded only when a real provider call succeeds and the checkpoint is first written.
- Conversational Leo stays request-bound.

---

## Inventory

### P0 — migrated in Prompt 3

| Flow | Feature | Route / function | Provider | Request pattern | Persistence | Retry | Progress | Cancel | Cost | Notify | Duration | Stay on page (before) | Class | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Session lesson content | Lessons / Leo | `POST /api/leo/lessons/generate-session-content` when `sessionId` present; `TeacherLessonSessionDetail` | OpenAI `gpt-4o-mini` via `runLessonsLeoCompletion` (8k–11k tokens) | Was request-bound | JSON only, then client PATCH `LessonSession.contentBlocks` | Manual regenerate | Toast only | None | `trackUsage` (currently no-op) | None | 30–90s+ | Yes | `MIGRATE_TO_BACKGROUND` | P0 |
| Week-create generate-all / single slot | Lessons / Leo | Same POST; `TeacherLessonWeekCreateWizard` sequential loop | Same | Was request-bound, N sequential HTTP calls | Client `slotDrafts` until week save | Manual | Toast | None | Same | None | Minutes for a full week | Yes | `MIGRATE_TO_BACKGROUND` | P0 |
| Explore feed kickoff | Learn Explore | `GET /api/learn/mobile/explore/adventures` → `kickoffLazyExploreFeedGeneration` + `after()` | OpenAI `gpt-4o-mini` or template fallback | `after()` | `ExploreGenerationJob`, `ExploreAdventure`, `ExploreContentSnapshot` | Stale lock 2m, maxAttempts 2 | Mobile poll | None | None | None | 30–120s | No (weak) | `MIGRATE_TO_BACKGROUND` | P0 |
| Explore on-demand student generate | Learn Explore | `POST /api/learn/mobile/explore/generate` → `lazyGenerateOrGetExploreAdventure` | Same pipeline | Request-bound pipeline | Same + `StudentExploreRecord` | Domain lock | Poll `generation-status` | None | None | None | 30–120s | Often | `MIGRATE_TO_BACKGROUND` | P0 |
| Daily quest Explore unlock | Learn Explore | `POST /api/learn/mobile/quests/items/[itemId]/explore` | Same | Request-bound | Same | Same | Poll | None | None | None | 30–120s | Often | `MIGRATE_TO_BACKGROUND` | P0 |
| Teacher session Explore | Lessons / Learn | `POST /api/teacher/lesson-sessions/[id]/explore` → `generateTeacherSessionExplore` | Same | Request-bound `runExploreGenerationForClaimedJob` | Adventure `createdBy: teacher`; publish is a later PATCH | Same | Status GET | None | None | None | 30–120s | Yes | `MIGRATE_TO_BACKGROUND` | P0 |
| Explore generation-status poll | Learn Explore | `GET .../explore/generation-status` | Same | Could run pipeline in the poll | Job update | Same | Poll | None | None | None | Same | n/a | `MIGRATE_TO_BACKGROUND` | P1 (fixed with P0) |
| Admin/teacher Explore regenerate | Learn QA | `POST .../explore-content/[adventureId]/regenerate` → `adminRegenerateExploreAdventure` | Same | Request-bound | New snapshot on existing adventure | maxAttempts 3 | Response | None | None | None | 30–120s | Yes | `MIGRATE_TO_BACKGROUND` | P1 |

### P1 — migrated in Prompt 3

| Flow | Feature | Route / function | Provider | Request pattern | Persistence | Class | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Lesson illustration draft | Lessons / Leo | `POST /api/leo/lessons/generate-illustration-draft`; `generateLessonIllustrationDraft` | Chat planner + `images.generate` + R2 upload | Request-bound | Returns URL/key; teacher attaches later | `MIGRATE_TO_BACKGROUND` | P1 |

### KEEP_SYNCHRONOUS_INTERACTIVE

| Flow | Route / function | Why it stays sync |
| --- | --- | --- |
| Lesson-note AI wizard | `POST /api/teacher/lesson-notes/ai/generate` (`refine_context`, `generate_body`, …) | Interactive wizard; teacher applies JSON in-form. Deep body can be slow but UX is conversational apply. |
| Propose week split | `POST /api/leo/lessons/propose-week-split` | Short structured proposal in the wizard. |
| Session flashcards / fact cards / board notes / assessment / practice | `POST /api/leo/lessons/generate-session-*` | Teacher reviews JSON then saves. |
| Legacy Leo draft helpers | `POST /api/leo/lessons/generate-summary`, `generate-flashcards`, `simplify-for-learners`, … | JSON-only; little/no UI. |
| Teaching deck rebuild | `POST /api/leo/lessons/generate-teaching-deck` | Deterministic mapping, not LLM. |
| Mobile Leo tutor / hint / explain / quiz | `src/lib/learn/mobile-tutor.ts` and `/api/learn/mobile/{tutor,leo}/*` | Conversational wait is the UX. Daily cap 40. |
| Ghanaian language help | `mobile-ghanaian-languages.ts` | Short completion. |
| School Leo copilot chat / tools | `src/lib/leo/orchestrator.ts` | Deterministic tools, no OpenAI. |
| Exam Leo drafts | `/api/leo/examinations/*` | Teacher applies draft JSON. |
| Exam scheduling Leo | `/api/admin/exams/sessions/[id]/leo/*` | Short advisory. |
| Scheme Leo planner | `POST /api/teacher/schemes/[id]/leo-plan` | Single completion. |
| Admin academic / staff / roles insights | `.../ai-insights`, `.../insights/generate`, `.../insights/ask` | Cached interactive generate. |
| Fees AI brief / reminder / suggest | `/api/admin/fees/ai/*` | Short; only live `AIFeatureUsageEvent` budget. |
| Student ID Leo pattern | `POST /api/admin/students/generate-id` | Instant suggestion. |
| Proposal single section | `POST /api/platform/proposals/[id]/leo-section` | Operator edits one section. |

### Documented, not migrated (Prompt 4 / later)

| Flow | Class | Priority | Reason |
| --- | --- | --- | --- |
| Scheme PDF OpenAI / Gemini parse | `NEEDS_REVIEW` | P1 | Import-bound inside `SchemeImportJob`. Prompt 4. |
| Platform proposal `leo-all` | `NEEDS_REVIEW` | P1 | Long sequential POST; platform authoring, not school lesson generation. |
| Student Leo flashcards on quest/revision | `NEEDS_REVIEW` | P2 | Sync surprise latency; persist student deck. |
| Admin period report Leo narrative | `NEEDS_REVIEW` | P1 | Report generation kind, not AI class. |
| Legacy `USE_LAZY_EXPLORE=0` per-student adventures | `NEEDS_REVIEW` | P2 | Flag-off leftover. |
| `scheduleExploreGenerationForDeliveredSession` | `NEEDS_REVIEW` | P2 | No callers. |
| Curriculum Studio / course-module AI / standalone document analysis | n/a | — | Not implemented. Do not invent. |

---

## Job kinds

| Kind | Worker in Prompt 3 | Notes |
| --- | --- | --- |
| `AI_LESSON_GENERATION` | Yes | Session + week-batch content drafts |
| `EXPLORE_GENERATION` | Yes | Orchestration only; domain job remains |
| `AI_LESSON_ILLUSTRATION` | Yes | **Added** — image + R2 |
| `AI_CONTENT_GENERATION` | No | Placeholder |
| `AI_DOCUMENT_ANALYSIS` | No | Placeholder; scheme PDF stays Prompt 4 |
| `SCHEME_IMPORT` | No | Prompt 4 |

All implemented AI kinds: `workloadClass: AI`, `userVisible: true`, `cancellable: true`, `schoolScoped: true`, notify success/failure default true. Explore student/system enqueue overrides notify to false.

---

## Lesson generation

**Domain model:** `LessonAiGenerationRequest` (new). BackgroundJob is orchestration.

**Snapshot:** request-time slot/session params (title, duration, section keys, prior handoff summaries, note `updatedAt`). Execution-time lesson note reload from Mongo.

**Week generate-all:** one BackgroundJob, sequential slots (later prompts need prior handoffs). Per-slot Mongo checkpoints so retries do not regenerate completed slots.

**Idempotency:**

- session: `ai-lesson:session:{schoolId}:{sessionId}:{revision}`
- week: `ai-lesson:week:{schoolId}:{teacherUserId}:{noteId}:{classGroupId}:{weekStart}:{revision}`
- week slot: `ai-lesson:week-slot:{schoolId}:{teacherUserId}:{noteId}:{slotDraftId}:{revision}`

Explicit regenerate increments `revision`.

**No auto-publish:** drafts go on the request and `LessonSession.pendingAiContentBlocks`. Saved `contentBlocks` and `studentVisibility` are untouched.

**Deep links:**

- Session: `/teacher/lessons/sessions/{sessionId}`
- Week draft: `/teacher/lessons/create?noteId=...&classGroupId=...&generationRequestId=...`

**Progress stages:** `preparing_context` 5% → `generating` 20–70% → `validating` 75% → `saving_draft` 85% → `complete` 100%. Week batch uses `generating_slot_N_of_M`.

---

## Explore generation

**Domain model:** `ExploreGenerationJob` stays. Unique `generationKey`, safety statuses, adventure/snapshot refs.

**Orchestration:** `BackgroundJob` kind `EXPLORE_GENERATION`. Input `{ exploreGenerationJobId, trigger }`. Idempotency `explore-generation:{generationKey}` (retry suffix after terminal failure).

**Authoritative execution status:** BackgroundJob. Domain status still updated for mobile poll compatibility.

**Lock/stale retry** is no longer the execution engine. Inngest owns transient retries.

**Notifications:** teacher/admin initiated only. Student on-demand and feed kickoff set `notifyOnSuccess/Failure: false`.

**No auto-publish:** generate never sets `teacher_approved`.

**Deep links (teacher):** `/teacher/lessons/sessions/{sessionId}` (Explore panel). Admin QA pages when the adventure id is known.

---

## Illustration

**Domain model:** `LessonIllustrationRequest`. Checkpoint stores `{ imageUrl, storageKey, generationPrompt }` after the first successful upload so retries do not create orphan images.

**Idempotency:** `ai-illustration:{schoolId}:{teacherUserId}:{requestHash}:{revision}`.

---

## Provider / cost / concurrency

- Transient: timeout, connection, 429, provider 5xx → retry (AI policy, 3 attempts).
- Permanent: invalid model/request, policy rejection, malformed source, missing prerequisite.
- Timeouts: OpenAI client `timeout` 90s (text) / 120s (image).
- Retry semantics preserve the existing usage-accounting behavior, but the current `trackUsage` implementation is a no-op and must be wired to the billing/usage ledger in a later hardening pass. Replay after a checkpoint still does not call the provider or increment usage.
- Concurrency (Inngest v4): global AI function limit 6 + per-`event.data.schoolId` limit 2. Explore same-subject serialization via `generationKey` uniqueness.
- Entitlements re-checked at enqueue and execution. Lesson Leo still uses `requireLessonsLeoTeacherContext` / `ai_lesson_notes`.

---

## Cancellation

Cooperative via Prompt 1 helpers. Check before provider call and between slots. If a valid draft was already persisted, completion wins over a late cancel request (do not delete the draft).

---

## Production indexes

Prompt 3 unique idempotency indexes are declared on the schemas but production uses `autoIndex: false`. Create them explicitly with:

```
npx tsx scripts/ensure-ai-generation-indexes.ts
npx tsx scripts/ensure-ai-generation-indexes.ts --apply
```

Dry-run is the default. `--apply` creates only:

- `unique_lesson_ai_generation_idempotency` on `LessonAiGenerationRequest` `{ schoolId: 1, idempotencyKey: 1 }`
- `unique_lesson_illustration_idempotency` on `LessonIllustrationRequest` `{ schoolId: 1, idempotencyKey: 1 }`

`--apply` refuses if duplicate `{ schoolId, idempotencyKey }` groups or conflicting same-key indexes exist. It never drops indexes or mutates documents. This pass does not run `--apply` against production.

## Remaining Prompt 4 / 5

- Scheme import, library import `after()`, provisioning, communication outbox, remaining crons
- Task Center UI
- Production `--apply` of the AI generation index script / Inngest Cloud
