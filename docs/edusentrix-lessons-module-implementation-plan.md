# Lessons Module — Implementation Plan (Buildable Slices)

**Companion document:** [edusentrix-lessons-module-technical-spec.md](./edusentrix-lessons-module-technical-spec.md)  
**Use this file** to sequence work, define MVP vs later, and enforce UI consistency. The technical spec remains the source of truth for product rules and edge cases.

### Progress tracking and session rhythm

- **Live status:** [`docs/lessons/PROGRESS.md`](./lessons/PROGRESS.md) — slice checklist, **current stage**, and a **session log** (what was intended vs what shipped each run).
- **Before every implementation run:** State clearly *(a)* which slice/stage we are at and *(b)* exactly what is about to be built or changed.
- **After every run:** Update `PROGRESS.md` (slice statuses, current stage, new session-log row with before/after) and give a short summary of what was built.

---

## 1. UI / UX guardrails (non-negotiable)

Implementation must match existing admin and teacher surfaces (grades, fees, delegations, lesson-notes shells—not the lesson note wizard internals).

| Pattern | Use for Lessons module | Import / reference |
|--------|-------------------------|---------------------|
| **Premium menus** | Section actions, status filters, “more” menus on lesson rows | `@/components/ui/premium-dropdown-menu` (`PremiumDropdownMenu`, `PremiumDropdownMenuTrigger`, `PremiumDropdownMenuContent`, `PremiumDropdownMenuItem`) — see e.g. `src/components/admin/students/detail/PaymentHistory.tsx` |
| **Dates** | Scheduled lesson date, date ranges on analytics later | `CustomDatePicker` or `DateRangePicker` from `@/components/ui/custom-date-picker` |
| **Destructive / irreversible actions** | Publish, unpublish, delete lesson, bulk actions | `useConfirmationDialog` from `@/hooks/useConfirmationDialog`; render `confirmationDialog` in the page — pattern in `src/app/(app)/admin/grades/[gradeId]/page.tsx` |
| **Modals / drawers** | Create lesson from note, editors that don’t belong inline | `ResponsiveModal` from `@/components/modals/ResponsiveModal` |
| **Layout** | Same card rhythm, spacing, typography, borders as other admin list/detail pages | Mirror `admin/grades`, `admin/schools/[id]`, not the lesson note wizard step UI |

**Do not** change the Lesson Note wizard look and feel (spec §2–3). Lessons are a **downstream** layer (CTA from note detail, separate routes).

---

## 2. Product edges to bake in early

Document decisions in verification output (Slice 0) and types:

1. **One Lesson Note → many Lessons** (reteach, split cohorts, reschedule). Schema: `lesson.lessonNoteId` required; unique constraints must **not** assume 1:1 at DB level unless product explicitly wants that later.
2. **Flashcard progress scale** — prefer normalized model early (e.g. `FlashcardProgress`: `studentId`, `flashcardId` or `deckId` + card key, `ease`, `dueAt`) so V1 doesn’t paint us into a JSON blob corner.
3. **Template / NaCCA work** — if Phase 1 in the spec mixes template resolver work with Lessons, **sequence**: Slice 0 proves what fields exist today; Slice 1–3 ship **Lesson** shell + schedule + publish using **existing** resolved note payload, not a blocked dependency on full template v2.

---

## 3. Buildable slices (order of execution)

Each slice should be a PR-sized unit: shippable, testable, behind feature flag if needed.

### Slice 0 — Pre-implementation verification (spec §4)

**Goal:** Single written artifact (can live at `docs/lessons/phase-0-lesson-notes-verification.md` or as an appendix here) listing:

- Actual Mongoose/TS models + paths for lesson notes, approval, comments.
- API routes: `admin` vs `teacher`, auth patterns.
- Wizard entry points and payload shape after save (what can be copied into `Lesson` snapshot vs referenced).
- Gaps vs spec §3 (primary/JHS/preschool variants — mark N/A for V1).

**Exit:** Team agrees “we know how to create a Lesson row + link `lessonNoteId` + default class context from note.”

---

### Slice 1 — Lesson domain model + admin/teacher APIs (read/list first)

**Goal:** `Lesson` entity: `lessonNoteId`, school/class context, `status` (`draft` | `published` | `archived`), `scheduledAt` (optional), `title` / display name, audit fields, `publishedAt`.

**Deliverables:**

- Schema + indexes (`lessonNoteId`, `classGroupId` or equivalent, `schoolId`, `status`).
- Validators + types shared with frontend.
- `GET` list/detail; `POST` create from `{ lessonNoteId, ... }` (server validates note exists and caller access).

**Out of scope:** Student portal, flashcards, resources.

---

### Slice 2 — Teacher UI: “Create lesson from note” + lesson list

**Goal:** From **teacher** (and admin if product requires) lesson note detail page only: CTA opens modal/`ResponsiveModal` — **no wizard fork**.

Form fields:

- Title (default from note title/subject).
- `CustomDatePicker` for schedule date if product requires it in MVP.
- Any class/group override only if spec demands; else inherit from note.

List page: teacher “My lessons” or tab on note — use premium table/card patterns, `PremiumDropdownMenu` for row actions (edit draft, open note).

---

### Slice 3 — Publish flow + confirmation + student read-only view

**Goal:**

- Transition `draft` → `published` with `useConfirmationDialog` copy that states visibility impact.
- **Student** route: published lesson only, read-only body/resources stub (structure only OK).

**Out of scope:** interactive flashcards, assignments.

---

### Slice 4 — Flashcards MVP

**Goal:** One deck per lesson (or per note — lock decision in Slice 0 doc); teacher creates cards; student views + minimal interaction; progress persisted with scalable progress model (see §2).

**UI:** Same cards/menus; no new visual language.

---

### Slice 5 — Resources & library wiring

**Goal:** Attachments / library items per spec §7-pattern work; reuse library hooks/components where they exist.

---

### Slice 6 — Teaching Mode

**Goal:** Teacher presentation/summary mode per spec; full-screen or dedicated route; guard published state.

---

### Slice 7 — Reflections & outcomes

**Goal:** Post-lesson reflection capture; link to lesson instance.

---

### Slice 8 — Analytics & dashboards

**Goal:** Aggregates (views, completion, flashcard stats); `DateRangePicker` on filters — align with `admin/reports` patterns.

---

### Slice 9 — Notifications

**Goal:** Event-driven emails/pushes per spec; reuse existing notification infra.

---

### Slice 10 — Leo / AI (V2)

**Goal:** Spec’s Leo features; always teacher review before publish (spec §2).

---

## 4. Suggested MVP boundary (first production value)

Ship **Slices 0 → 3** as **Lessons MVP 1**: verified mapping, CRUD, create-from-note, publish with confirmation, student read-only.

Treat **Slice 4+** as **MVP 2 / iterations** so the spec §9.1 checklist doesn’t block a thin vertical slice.

---

## 5. Dependency sketch

```txt
Slice 0 (verification)
    → Slice 1 (model/API)
        → Slice 2 (teacher UI)
            → Slice 3 (publish + student)
                → Slice 4 (flashcards)
                    → Slice 5 (resources)
                        → Slice 6 (teaching mode)
                            → Slice 7 (reflections)
                                → Slice 8 (analytics)
                                    → Slice 9 (notifications)
                                        → Slice 10 (Leo)
```

Parallelism possible only where noted (e.g. analytics mock vs real data) — prefer completing 1–3 first.

---

## 6. Traceability to main spec

| This plan | Spec sections |
|-----------|----------------|
| Slice 0 | §3–4, §9.3 assumptions |
| Slices 1–3 | §5–6 delivery model, §8 lifecycle |
| Slice 4 | §7 flashcards |
| Slice 5 | §7 resources / library |
| Slice 6 | Teaching Mode sections |
| Slice 7 | Reflections |
| Slice 8 | Analytics |
| Slice 9 | Notifications |
| Slice 10 | Leo / AI |

---

## 7. Next action for implementer

1. Run **Slice 0** and commit the verification doc.  
2. Implement **Slice 1** following existing API layout in repo (`/api/admin/...`, `/api/teacher/...` as per lesson-notes).  
3. Build **Slice 2–3** UI strictly with components in §1.

When this plan and the spec disagree on detail, **spec wins** for product rules; **this plan wins** for sequencing and MVP cut lines unless stakeholders override.
