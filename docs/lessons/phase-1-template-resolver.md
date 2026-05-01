# Phase 1 — Lesson note template resolver (scaffold)

This complements **spec §31 Phase 1** (Lesson Note template config) without changing the existing wizard UI.

## What exists now

- **`src/lib/lesson-notes/template-variant-resolver.ts`** — maps a **grade display name** (e.g. from `Grade.name`) to:
  - `LessonNoteLevelVariant` (`creche` … `shs`, `other`)
  - `LessonNoteTemplateBucket` (`early_years` | `primary_jhs` | `other`)

Use this from server-side lesson-note flows when you need Primary/JHS vs Early Years behaviour **without** forking the wizard yet.

## Next steps (when you wire Phase 1 UI)

1. Persist optional `levelVariant` / `templateBucket` on `LessonNote` if product needs stable overrides.
2. Feed `templateBucket` into field presets (labels, hints, optional sections) per spec §5–7.
3. Keep wizard visuals unchanged (spec §2); only swap **config** and validation, not layout.

**Plan reference:** [edusentrix-lessons-module-implementation-plan.md](../edusentrix-lessons-module-implementation-plan.md)
