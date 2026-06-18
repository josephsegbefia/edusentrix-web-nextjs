# Lesson content blocks — architecture note

## Current flow (baseline)

1. **Storage** — `LessonSession.contentBlocks` holds an ordered array of `LessonContentBlock` documents (Mongoose subdocuments).
2. **Normalization** — `normalizeContentBlocks()` in `src/lib/lessons/content-blocks.ts` sanitizes HTML, assigns ids/orders, and drops invalid rows on save/API ingest.
3. **Teacher editing** — `TeacherLessonSessionDetail` → `LessonContentBlocksEditor` (local state) → PATCH `src/app/api/teacher/lesson-sessions/[id]/route.ts`.
4. **Rendering** — `LessonContentBlocksRenderer` displays blocks on preview and student pages (`StudentSessionContentView` maps the student payload into renderer blocks with `viewMode="student"`).
5. **AI generation** — `POST /api/leo/lessons/generate-session-content` returns blocks; Leo output is normalized and marked `aiGenerated: true`, `teacherReviewed: false`.
6. **Publish gate** — `assertSessionPublishAllowed()` blocks publish when school settings require AI review and any AI block is unreviewed.
7. **Teach Mode** — `buildTeachingDeckFromSessionInput()` in `build-teaching-deck-shared.ts` maps blocks → `TeachingSlide[]`; `SessionTeachingPresenter` + `TeachingSlideView` render the deck.

## Subject-aware extension (additive)

- Optional metadata on blocks: `subjectMode`, `languageMeta`, `mathMeta`, `assetMeta`, `reviewMeta`, `accessibilityMeta`, `diagramMeta`.
- New block types: language, math, diagram, illustration, audio, asset_plan.
- `resolveLessonSubjectMode()` picks generation/render behaviour from subject name.
- `getLessonSessionReadiness()` adds language, math, asset, and accessibility checks (used by UI strip and publish route).
- Deterministic diagrams render from `diagramMeta` (no AI images for precise math).
- Illustrations: teacher upload via UploadThing `lessonIllustration`, AI draft via Leo → OpenAI → UploadThing (requires approval), or future library.
- `asset_plan` blocks are teacher-facing only; hidden from student payloads by default.

## Regression anchors

- Legacy 9 block types must render and edit unchanged.
- `assertSessionPublishAllowed()` AI review rule must not be weakened.
- Teach Mode must still build title + blocks + wrap-up for old sessions.
- `formatStudentSessionContent()` must not expose teacher-only metadata.
