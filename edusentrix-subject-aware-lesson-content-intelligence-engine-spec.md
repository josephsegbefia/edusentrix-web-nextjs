# EduSentrix Subject-Aware Lesson Content Intelligence Engine Spec

## 1. Purpose

EduSentrix currently supports a lesson flow where lesson notes are created from schemes of learning, and lesson sessions are created from lesson notes. AI then helps generate lesson content, and teachers can use Teach Mode to deliver the lesson.

This works well for normal English-medium subjects. However, EduSentrix must become subject-aware so it can correctly handle:

- Ghanaian language lessons such as Ga, Ewe, Twi, Fante, Dagbani, Dangme, Nzema, and others
- Mathematics lessons with fractions, equations, symbols, tables, graphs, number lines, and worked examples
- Lessons that need diagrams, illustrations, audio, pronunciation support, or visual aids
- AI-generated lesson content that must be reviewed safely before students see it

This spec introduces a subject-aware content intelligence layer that extends the current lesson session content-block system without breaking existing lesson notes, lesson sessions, Teach Mode, or student-facing views.

## 2. Current Architecture Assumption

The current app already has this learning content flow:

```txt
Scheme of Learning
→ Lesson Note
→ Lesson Week Plan
→ Lesson Session
→ LessonSession.contentBlocks
→ Teach Mode / Student Lesson View / Learn resources
```

The correct integration point for this spec is:

```txt
LessonSession.contentBlocks
```

This spec must not replace the current lesson system. It must extend the existing content-block system safely.

## 3. Core Product Principle

EduSentrix should not generate one large lesson body as plain HTML.

Instead, EduSentrix should generate and render lessons as structured content blocks.

Each block should know what kind of teaching content it represents.

Examples:

```txt
explanation
example
activity
discussion
check
teacher_note
bilingual_text
vocabulary
pronunciation
math_expression
worked_example
diagram
illustration
audio
asset_plan
```

This allows EduSentrix to handle English, Ghanaian languages, French, Mathematics, Science, Career Technology, Teach Mode, student lessons, future Learn app payloads, and PDF exports more safely.

## 4. Non-Goals for This Spec

The following ideas are important, but they are intentionally excluded from this spec for now:

- Redesigning the lesson note creation flow
- Making lesson notes themselves subject-aware
- Creating French-specific lesson note workflows
- Creating Ghanaian-language-specific lesson note workflows
- Creating Mathematics-specific lesson note workflows
- Changing how schemes of learning generate lesson notes
- Rebuilding the lesson note editor
- Replacing the existing lesson note model

Those should be handled in a later dedicated spec.

This spec focuses only on:

```txt
LessonSession.contentBlocks
Teach Mode
content rendering
AI generation output
teacher review
publish readiness
student-facing compatibility
```

## 5. Existing System Preservation Rules

AI agents implementing this spec must obey these rules.

- Do not replace the existing lesson module.
- Do not remove existing content block types.
- Do not break existing published lessons.
- Do not bypass existing teacher review and publish checks.
- Do not publish unreviewed AI-generated Ghanaian-language content.
- Do not store mathematical content only as plain HTML.
- Do not use AI-generated images for precise mathematical diagrams such as number lines, fractions, angles, or graphs.
- Do not introduce a parallel lesson system.
- Do not create fake UI controls that are not connected to real state.
- Do not introduce a new design system.
- Do not clutter the lesson session UI.
- Do not change subscription, permission, or role checks unless explicitly required.
- Do not remove current lesson session editing functionality.
- Do not break Teach Mode.

## 6. Current Files to Inspect Before Building

Before implementing any slice, the AI agent must inspect the relevant current files.

Core models and types:

```txt
src/models/LessonNote.ts
src/models/LessonSession.ts
src/models/LessonWeekPlan.ts
src/types/lesson-content-blocks.ts
src/types/teaching-deck.ts
```

Lesson editing and rendering:

```txt
src/components/lessons/LessonContentBlocksEditor.tsx
src/components/lessons/LessonContentBlocksRenderer.tsx
src/components/lessons/TeacherLessonSessionDetail.tsx
src/components/lessons/TeacherLessonWeekCreateWizard.tsx
```

Teach Mode:

```txt
src/components/lessons/SessionTeachingPresenter.tsx
src/components/lessons/TeachingSlideView.tsx
src/lib/lessons/build-teaching-deck.ts
src/lib/lessons/build-teaching-deck-shared.ts
```

Lesson utilities:

```txt
src/lib/lessons/content-blocks.ts
```

AI generation:

```txt
src/app/api/leo/lessons/generate-session-content/route.ts
```

Lesson session API:

```txt
src/app/api/teacher/lesson-sessions/[id]/route.ts
```

Existing Ghanaian-language helper reference:

```txt
src/lib/learn/mobile-ghanaian-languages.ts
```

## 7. High-Level Architecture

The new engine should sit between AI lesson generation and content rendering.

```txt
Lesson Session
→ Subject Mode Resolver
→ Content Block Planner
→ AI Content Generator
→ Subject-Specific Block Validator
→ Teacher Review Workflow
→ Publish Readiness Gate
→ Teach Mode / Student View
```

The engine should introduce the following internal modules:

```txt
1. Subject Mode Resolver
2. Content Block Compatibility Layer
3. Lesson Quality Metadata Layer
4. Ghanaian Language Block Support
5. Mathematics Block Support
6. Diagram and Illustration Asset Planner
7. Advanced Content Block Renderer
8. Teach Mode Block Adapter
9. Publish Readiness Checker
10. Regression and Migration Safety Layer
```

## 8. Subject Modes

Every lesson session should be able to resolve into one primary subject mode.

Initial subject modes:

```ts
type LessonSubjectMode =
  | "general"
  | "ghanaian_language"
  | "mathematics"
  | "science_visual"
  | "visual_heavy";
```

### 8.1 General Mode

Used for normal English-medium subjects.

Examples:

```txt
English
Social Studies
RME
Computing
History
Creative Arts
```

### 8.2 Ghanaian Language Mode

Used for local language subjects.

Examples:

```txt
Ga
Ewe
Asante Twi
Akuapem Twi
Fante
Dagbani
Dangme
Nzema
Gonja
Kasem
Dagaare
```

This mode should support:

```txt
bilingual content
vocabulary blocks
pronunciation blocks
audio blocks
teacher review
dialect metadata
teacher-approved spelling
```

### 8.3 Mathematics Mode

Used for Mathematics and math-heavy content.

This mode should support:

```txt
LaTeX
MathML-ready data
fractions
equations
worked examples
number lines
fraction bars
graphs
geometry diagrams
step-by-step solutions
```

### 8.4 Science Visual Mode

Used for subjects that often require diagrams.

Examples:

```txt
Science
Career Technology
Agriculture
Integrated Science
```

This mode should support:

```txt
labelled diagrams
process illustrations
safe experiment diagrams
equipment illustrations
flow diagrams
```

### 8.5 Visual Heavy Mode

Used when the lesson requires illustrations, diagrams, or media-heavy explanation even if the subject is not Science or Mathematics.

## 9. Extended Lesson Content Block Model

The current lesson content block model should be extended in a backward-compatible way.

Existing blocks must remain valid.

New fields must be optional.

Recommended structure:

```ts
export type LessonContentBlock = {
  id: string;
  type: LessonContentBlockType;
  title?: string | null;
  bodyHtml: string;
  order: number;
  estimatedMinutes?: number | null;
  aiGenerated: boolean;
  teacherReviewed: boolean;
  resourceUrl?: string | null;

  subjectMode?: LessonSubjectMode;
  languageMeta?: LessonLanguageMeta | null;
  mathMeta?: LessonMathMeta | null;
  assetMeta?: LessonAssetMeta | null;
  reviewMeta?: LessonReviewMeta | null;
  accessibilityMeta?: LessonAccessibilityMeta | null;
};
```

## 10. Existing Block Types Must Remain

The existing block types must continue to work:

```txt
explanation
example
activity
discussion
check
resource_embed
exit_ticket
teacher_note
did_you_know
```

These should not be removed or renamed.

## 11. New Block Types

Add the following new block types gradually:

```txt
bilingual_text
vocabulary
pronunciation
math_expression
worked_example
diagram
illustration
audio
asset_plan
```

### 11.1 bilingual_text

Used for Ghanaian-language or future French lessons where student support text is needed.

Example use:

```txt
Primary text: Ghanaian language
Support text: English
Teacher review: required
```

### 11.2 vocabulary

Used for word lists, meanings, pronunciation, examples, and teacher-approved spellings.

### 11.3 pronunciation

Used for pronunciation practice, syllable guidance, audio, and teacher notes.

### 11.4 math_expression

Used for individual mathematical expressions.

### 11.5 worked_example

Used for step-by-step Mathematics explanations.

### 11.6 diagram

Used for deterministic diagrams such as:

```txt
number lines
fraction bars
fraction circles
graphs
angles
shapes
flowcharts
labelled science diagrams
```

### 11.7 illustration

Used for visual teaching images.

This may come from:

```txt
approved illustration library
teacher upload
AI-generated draft image
```

### 11.8 audio

Used for teacher recordings, pronunciation, reading passages, or listening activities.

### 11.9 asset_plan

Used internally to describe required assets before they are created or attached.

Asset plan blocks should not normally appear to students unless explicitly converted into real assets.

## 12. Language Metadata

For Ghanaian-language blocks, support:

```ts
export type LessonLanguageMeta = {
  languageCode?: string;
  languageName?: string;
  dialectOrVariant?: string | null;
  supportLanguageCode?: string | null;
  mediumOfInstruction?:
    | "local_language_only"
    | "english_supported"
    | "bilingual"
    | "vocabulary_focus"
    | "pronunciation_focus";
  teacherApprovedSpelling?: boolean;
  requiresLanguageReview?: boolean;
  languageReviewStatus?:
    | "not_required"
    | "needs_review"
    | "approved"
    | "rejected";
  reviewedBy?: string | null;
  reviewedAt?: string | null;
};
```

## 13. Math Metadata

For Mathematics blocks, support:

```ts
export type LessonMathMeta = {
  format?: "latex" | "mathml" | "plain";
  latex?: string | null;
  mathml?: string | null;
  plainText?: string | null;
  renderMode?: "inline" | "block" | "step";
  mathKind?:
    | "fraction"
    | "equation"
    | "expression"
    | "geometry"
    | "graph"
    | "number_line"
    | "table"
    | "worked_solution";
  validationStatus?: "valid" | "invalid" | "not_checked";
  validationMessage?: string | null;
};
```

Math content should not rely only on `bodyHtml`.

The app should render math through a proper math renderer while keeping a safe fallback for old sessions.

## 14. Asset Metadata

For visual and audio blocks, support:

```ts
export type LessonAssetMeta = {
  assetKind?:
    | "diagram"
    | "illustration"
    | "audio"
    | "video"
    | "teacher_upload"
    | "approved_library"
    | "ai_generated";
  assetStatus?:
    | "planned"
    | "missing"
    | "draft"
    | "needs_review"
    | "approved"
    | "rejected";
  source?: "system" | "teacher" | "ai" | "library";
  altText?: string | null;
  caption?: string | null;
  required?: boolean;
  generationPrompt?: string | null;
};
```

Every illustration and diagram must support alt text.

## 15. Review Metadata

Extend block review beyond the existing `teacherReviewed` boolean.

```ts
export type LessonReviewMeta = {
  aiReviewStatus?: "not_required" | "needs_review" | "approved" | "rejected";
  languageReviewStatus?: "not_required" | "needs_review" | "approved" | "rejected";
  mathReviewStatus?: "not_required" | "needs_review" | "approved" | "rejected";
  assetReviewStatus?: "not_required" | "needs_review" | "approved" | "rejected";
  accessibilityReviewStatus?: "not_required" | "needs_review" | "approved" | "rejected";
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewNotes?: string | null;
};
```

The existing `teacherReviewed` field should remain for backward compatibility.

The new readiness system should treat `teacherReviewed` as the baseline AI review flag.

## 16. Subject Mode Resolver

Create a subject mode resolver.

Suggested file:

```txt
src/lib/lessons/subject-mode-resolver.ts
```

The resolver should inspect available subject/session context and return:

```ts
{
  subjectMode: LessonSubjectMode;
  confidence: "high" | "medium" | "low";
  reasons: string[];
}
```

Initial detection can use safe heuristics from:

```txt
subject name
subject code
subject offering
curriculum family
grade band
known Ghanaian language list
```

The resolver should reuse or align with existing Ghanaian language detection logic from:

```txt
src/lib/learn/mobile-ghanaian-languages.ts
```

The resolver must be conservative.

If unsure, return:

```txt
general
```

## 17. AI Generation Changes

The AI lesson generation endpoint should no longer always generate plain English HTML blocks.

Current endpoint to inspect:

```txt
src/app/api/leo/lessons/generate-session-content/route.ts
```

The generator should first resolve subject mode.

Then it should generate content blocks according to the mode.

### 17.1 General Mode Output

Use existing behaviour.

Allowed block types:

```txt
explanation
example
activity
discussion
check
exit_ticket
teacher_note
did_you_know
```

### 17.2 Ghanaian Language Mode Output

Allowed block types:

```txt
bilingual_text
vocabulary
pronunciation
activity
discussion
check
audio
teacher_note
```

AI-generated Ghanaian-language content should default to:

```txt
requiresLanguageReview: true
languageReviewStatus: needs_review
teacherReviewed: false
```

The AI should be instructed to stay careful and avoid pretending certainty where spelling, dialect, or translation is unclear.

### 17.3 Mathematics Mode Output

Allowed block types:

```txt
explanation
math_expression
worked_example
activity
check
diagram
exit_ticket
teacher_note
```

Math expressions must include structured math metadata.

Fractions, equations, and symbols must not be stored only inside normal text.

### 17.4 Visual-Heavy Output

Allowed block types:

```txt
explanation
diagram
illustration
asset_plan
activity
teacher_note
```

The generator should prefer an `asset_plan` before creating or attaching visual assets.

## 18. Publish Readiness Rules

The existing publish protection must remain.

Add stronger readiness checks.

A lesson session should not be publishable if:

```txt
It contains unreviewed AI-generated content.
It contains Ghanaian-language blocks needing language review.
It contains invalid math blocks.
It contains required missing assets.
It contains AI-generated illustrations that are not approved.
It contains visual blocks without required alt text.
```

Suggested helper functions:

```txt
src/lib/lessons/content-readiness.ts
```

Functions:

```ts
getLessonSessionReadiness(contentBlocks)
assertLessonSessionReadyForPublish(contentBlocks)
getBlockedPublishReasons(contentBlocks)
getLessonQualitySummary(contentBlocks)
```

Example readiness output:

```ts
{
  canPublish: false,
  summary: {
    aiReview: "pending",
    language: "needs_review",
    math: "ready",
    assets: "missing_required_assets",
    accessibility: "needs_alt_text"
  },
  blockingReasons: [
    "2 Ghanaian-language blocks need teacher language review.",
    "1 required illustration is missing.",
    "1 illustration is missing alt text."
  ]
}
```

## 19. Lesson Session UI Changes

Primary UI integration point:

```txt
src/components/lessons/TeacherLessonSessionDetail.tsx
```

Add a compact lesson quality strip near the top of the session detail page.

Do not create a cluttered dashboard.

Recommended cards:

```txt
AI Review
Language
Math
Illustrations
Audio
Publish
```

Each card should have a simple status:

```txt
Ready
Needs review
Missing
Invalid
Optional
Blocked
```

Example:

```txt
AI Review: Pending
Language: Needs review
Math: Ready
Illustrations: 1 Missing
Audio: Optional
Publish: Blocked
```

Clicking a status should scroll to the relevant block or open a lightweight details panel.

## 20. Content Block Editor Changes

Primary file:

```txt
src/components/lessons/LessonContentBlocksEditor.tsx
```

The editor should support new block types gradually.

Do not overwhelm teachers.

Add block-specific controls only when the block type requires them.

### 20.1 Ghanaian Language Block Editing

For `bilingual_text`, `vocabulary`, and `pronunciation` blocks, show:

```txt
Language
Dialect / variant
Primary text
Support text
Vocabulary items
Pronunciation notes
Teacher review status
Approve language button
```

### 20.2 Math Block Editing

For `math_expression` and `worked_example`, show:

```txt
Plain explanation
Math expression field
Rendered preview
Validation status
Step list for worked examples
```

The first version may use direct LaTeX input plus preview.

A visual equation editor can be added later.

### 20.3 Asset Block Editing

For `diagram`, `illustration`, `audio`, and `asset_plan`, show:

```txt
Asset status
Source
Caption
Alt text
Required / optional
Review status
Upload or choose asset action
```

## 21. Content Renderer Changes

Primary file:

```txt
src/components/lessons/LessonContentBlocksRenderer.tsx
```

The renderer should support all new block types safely.

If a new block type is unknown or not fully supported, render a safe fallback rather than crashing.

Fallback:

```txt
Show title
Show bodyHtml if safe
Show “This content block type is not fully supported yet.”
Hide internal asset_plan blocks from student views
```

### 21.1 Ghanaian Language Rendering

Render:

```txt
primary language text
optional English support
vocabulary list
pronunciation notes
audio controls where available
review badges for teacher view only
```

### 21.2 Math Rendering

Render math using a proper math renderer.

The implementation should choose one approved renderer.

Recommended options:

```txt
KaTeX
MathJax
```

The chosen renderer must be used consistently in:

```txt
lesson session detail
student lesson view
Teach Mode
future export paths
```

### 21.3 Diagram Rendering

For deterministic diagrams, render from structured data.

Examples:

```txt
fraction bars
number lines
angle diagrams
simple graphs
flow diagrams
```

AI-generated images must not be used for precise mathematical diagrams.

## 22. Teach Mode Changes

Primary files:

```txt
src/lib/lessons/build-teaching-deck.ts
src/lib/lessons/build-teaching-deck-shared.ts
src/components/lessons/SessionTeachingPresenter.tsx
src/components/lessons/TeachingSlideView.tsx
```

Teach Mode should support new block types.

Mapping:

```txt
bilingual_text → language teaching slide
vocabulary → vocabulary practice slide
pronunciation → pronunciation slide
math_expression → math explanation slide
worked_example → step-by-step math slide
diagram → visual explanation slide
illustration → visual discussion slide
audio → listening/pronunciation slide
asset_plan → hidden unless unresolved and teacher-only
```

Teach Mode must remain usable for existing old blocks.

## 23. Asset Planning

AI generation should be able to create an asset plan.

Example:

```ts
{
  type: "asset_plan",
  title: "Suggested lesson assets",
  bodyHtml: "<p>This lesson needs a fraction bar and one market scene illustration.</p>",
  assetMeta: {
    assetKind: "diagram",
    assetStatus: "planned",
    source: "system",
    required: true
  }
}
```

Asset plan blocks are planning blocks.

They should help teachers understand what visuals or media are needed.

They should not be shown to students by default.

## 24. Deterministic Diagrams

Create a deterministic diagram system for accuracy-sensitive diagrams.

Suggested file area:

```txt
src/components/lessons/diagrams
src/lib/lessons/diagrams
```

Initial diagram types:

```txt
fraction_bar
fraction_circle
number_line
angle
simple_shape
flowchart
labelled_process
```

A diagram block should include structured data.

Example:

```ts
{
  type: "diagram",
  title: "Three quarters",
  bodyHtml: "",
  assetMeta: {
    assetKind: "diagram",
    assetStatus: "approved",
    source: "system",
    altText: "A fraction bar divided into four equal parts with three shaded."
  },
  diagramMeta: {
    diagramType: "fraction_bar",
    data: {
      numerator: 3,
      denominator: 4
    }
  }
}
```

If `diagramMeta` is added, it must be optional to avoid breaking existing blocks.

## 25. Accessibility Rules

All visual content must support:

```txt
caption
alt text
teacher-only note
student-safe rendering
```

A visual block with no alt text should trigger a readiness warning.

Required visual assets with no alt text should block publishing.

Audio blocks should support:

```txt
title
caption
transcript where possible
language metadata where relevant
```

## 26. Data Migration Strategy

No destructive migration should be required at the beginning.

Existing blocks should remain valid because all new fields are optional.

The first migration should only normalize missing fields where necessary.

Example:

```txt
If subjectMode missing, treat as general.
If reviewMeta missing, derive from aiGenerated and teacherReviewed.
If assetMeta missing, do not assume asset is required.
If mathMeta missing, render bodyHtml normally.
```

Do not rewrite all existing lesson sessions in one heavy migration.

## 27. Build Slices

The implementation must be done in small slices.

Each slice must be independently testable.

No slice should attempt to rebuild the whole lesson system.

---

## Slice 0 — Architecture Lock and Regression Audit

### Goal

Protect the current lesson system before adding subject-aware features.

### Files to Inspect

```txt
src/models/LessonSession.ts
src/types/lesson-content-blocks.ts
src/lib/lessons/content-blocks.ts
src/components/lessons/LessonContentBlocksRenderer.tsx
src/components/lessons/LessonContentBlocksEditor.tsx
src/components/lessons/TeacherLessonSessionDetail.tsx
src/lib/lessons/build-teaching-deck-shared.ts
```

### Tasks

- Document the current content block type.
- Confirm existing block types.
- Confirm how publish review currently works.
- Confirm how Teach Mode builds slides.
- Add no major UI changes.
- Add regression tests or simple safety checks where possible.

### Acceptance Criteria

- Existing lessons still render.
- Existing Teach Mode still works.
- Existing AI review gating still works.
- No new feature is introduced yet.

### AI Agent Prompt

```txt
Read the current lesson session, content block, renderer, editor, publish review, and Teach Mode files. Do not change the feature behaviour yet. Create a short architecture note inside the codebase or implementation notes describing how LessonSession.contentBlocks currently flows into the renderer and Teach Mode. Add only safe regression checks if appropriate. Do not refactor the lesson system.
```

### Stop Condition

Stop after confirming that the existing system is understood and protected.

---

## Slice 1 — Backward-Compatible Content Block Type Extension

### Goal

Extend the content block type safely with optional metadata.

### Files to Edit

```txt
src/types/lesson-content-blocks.ts
```

Possible helper file:

```txt
src/lib/lessons/content-block-normalizer.ts
```

### Tasks

- Add `LessonSubjectMode`.
- Add optional metadata types:
  - `LessonLanguageMeta`
  - `LessonMathMeta`
  - `LessonAssetMeta`
  - `LessonReviewMeta`
  - `LessonAccessibilityMeta`
- Extend `LessonContentBlock` with optional metadata fields.
- Ensure existing blocks remain valid.
- Add a normalizer helper that safely fills defaults at runtime.

### Acceptance Criteria

- TypeScript passes.
- Existing content blocks still compile.
- No existing block requires the new fields.
- No UI behaviour changes yet.

### AI Agent Prompt

```txt
Extend the existing LessonContentBlock type in a backward-compatible way. Add optional subjectMode, languageMeta, mathMeta, assetMeta, reviewMeta, and accessibilityMeta fields. Do not require these fields on existing blocks. Add a safe normalizer helper that treats missing subjectMode as "general" and derives basic review state from aiGenerated and teacherReviewed. Do not change the UI yet.
```

### Stop Condition

Stop after type extension and compatibility helper are complete.

---

## Slice 2 — Add New Block Type Names Safely

### Goal

Add advanced block type names without fully implementing their UI yet.

### Files to Edit

```txt
src/types/lesson-content-blocks.ts
src/lib/lessons/content-blocks.ts
src/components/lessons/LessonContentBlocksRenderer.tsx
```

### Tasks

- Add new block types:
  - `bilingual_text`
  - `vocabulary`
  - `pronunciation`
  - `math_expression`
  - `worked_example`
  - `diagram`
  - `illustration`
  - `audio`
  - `asset_plan`
- Add safe renderer fallback.
- Make sure unsupported advanced blocks do not crash the page.
- Hide `asset_plan` from student-facing rendering by default.

### Acceptance Criteria

- Existing blocks render as before.
- New block types can exist without crashing.
- Unknown or advanced blocks show safe fallback.
- `asset_plan` does not show to students by default.

### AI Agent Prompt

```txt
Add the new advanced lesson content block type names to the existing content block type system. Update rendering logic so these block types do not crash even before full specialized UI exists. Preserve all existing block rendering. Add a safe fallback for unsupported advanced blocks. Asset plan blocks should be teacher-facing only by default.
```

### Stop Condition

Stop when new block types are accepted safely by the renderer.

---

## Slice 3 — Subject Mode Resolver

### Goal

Create a conservative subject mode resolver.

### Files to Create

```txt
src/lib/lessons/subject-mode-resolver.ts
```

### Files to Inspect

```txt
src/lib/learn/mobile-ghanaian-languages.ts
```

### Tasks

- Create resolver function.
- Detect Ghanaian languages.
- Detect Mathematics.
- Detect Science visual subjects.
- Return general mode when uncertain.
- Include reasons and confidence.

### Example API

```ts
resolveLessonSubjectMode(input: {
  subjectName?: string | null;
  subjectCode?: string | null;
  curriculum?: string | null;
  gradeName?: string | null;
}): {
  subjectMode: LessonSubjectMode;
  confidence: "high" | "medium" | "low";
  reasons: string[];
}
```

### Acceptance Criteria

- Resolver identifies common Ghanaian language subjects.
- Resolver identifies Mathematics.
- Resolver returns `general` when uncertain.
- Existing lesson flow is not changed yet.

### AI Agent Prompt

```txt
Create a conservative subject mode resolver for lesson sessions. Use safe heuristics to detect Ghanaian language subjects, Mathematics, and Science visual subjects. Reuse or align with the existing Ghanaian language detection concepts in src/lib/learn/mobile-ghanaian-languages.ts. Return general when unsure. Do not wire this into AI generation yet.
```

### Stop Condition

Stop when the resolver exists and has basic tests or examples.

---

## Slice 4 — Lesson Readiness Checker

### Goal

Add a readiness checker that summarizes whether a lesson session is safe to publish.

### Files to Create

```txt
src/lib/lessons/content-readiness.ts
```

### Files to Inspect

```txt
src/lib/lessons/content-blocks.ts
src/app/api/teacher/lesson-sessions/[id]/route.ts
```

### Tasks

- Create readiness summary helper.
- Detect unreviewed AI blocks.
- Detect Ghanaian-language blocks needing review.
- Detect invalid math blocks.
- Detect missing required assets.
- Detect missing alt text for visual assets.
- Do not change publish route yet unless safe.

### Acceptance Criteria

- Function returns `canPublish`.
- Function returns blocking reasons.
- Existing publish rules are not weakened.
- Existing `assertSessionPublishAllowed()` is not bypassed.

### AI Agent Prompt

```txt
Create a content readiness checker for LessonSession.contentBlocks. It should summarize AI review, language review, math validation, asset readiness, accessibility readiness, and publish status. Do not weaken existing publish gates. Do not replace assertSessionPublishAllowed yet. Add this as an additional helper that can later be used by the UI and publish route.
```

### Stop Condition

Stop when readiness helper works independently.

---

## Slice 5 — Lesson Quality Strip UI

### Goal

Show a clean readiness summary inside the lesson session page.

### Files to Edit

```txt
src/components/lessons/TeacherLessonSessionDetail.tsx
```

Possible new component:

```txt
src/components/lessons/LessonQualityStrip.tsx
```

### Tasks

- Add a compact quality strip.
- Show statuses:
  - AI Review
  - Language
  - Math
  - Illustrations
  - Audio
  - Publish
- Use existing EduSentrix UI style.
- Keep it simple and uncluttered.
- Do not block publishing from UI only; actual blocking must remain server-side.

### Acceptance Criteria

- Quality strip appears on lesson session detail page.
- It does not clutter the page.
- Existing editing still works.
- Existing publish button still works.
- Statuses come from content readiness helper.

### AI Agent Prompt

```txt
Add a compact LessonQualityStrip component to the teacher lesson session detail page. It should use the content readiness helper to show AI Review, Language, Math, Illustrations, Audio, and Publish status. Keep the UI clean, premium, and consistent with the current EduSentrix design. Do not change core publishing behaviour in this slice.
```

### Stop Condition

Stop when teachers can see readiness status without workflow disruption.

---

## Slice 6 — Ghanaian Language Block Rendering

### Goal

Render Ghanaian-language-related blocks properly.

### Files to Edit

```txt
src/components/lessons/LessonContentBlocksRenderer.tsx
```

Possible new components:

```txt
src/components/lessons/blocks/BilingualTextBlockView.tsx
src/components/lessons/blocks/VocabularyBlockView.tsx
src/components/lessons/blocks/PronunciationBlockView.tsx
```

### Tasks

- Render `bilingual_text`.
- Render `vocabulary`.
- Render `pronunciation`.
- Show teacher-only review badges where appropriate.
- Support English helper text.
- Support audio placeholder where audio exists.

### Acceptance Criteria

- Ghanaian-language blocks render cleanly.
- Student view does not show teacher-only review metadata.
- Teacher view can see review status.
- Existing normal blocks still render.

### AI Agent Prompt

```txt
Implement rendering for bilingual_text, vocabulary, and pronunciation content blocks. Keep the display simple and readable. Show local-language text, optional English support, vocabulary entries, pronunciation notes, and audio if available. Teacher-only review badges should not appear to students. Preserve existing block rendering.
```

### Stop Condition

Stop when language blocks render correctly.

---

## Slice 7 — Ghanaian Language Block Editing

### Goal

Allow teachers to edit and approve language blocks.

### Files to Edit

```txt
src/components/lessons/LessonContentBlocksEditor.tsx
```

Possible new components:

```txt
src/components/lessons/blocks/BilingualTextBlockEditor.tsx
src/components/lessons/blocks/VocabularyBlockEditor.tsx
src/components/lessons/blocks/PronunciationBlockEditor.tsx
```

### Tasks

- Add editor controls for:
  - language
  - dialect / variant
  - primary text
  - support text
  - pronunciation notes
  - vocabulary items
  - review status
- Add approve language action at block level.
- Keep `teacherReviewed` aligned when appropriate.
- Do not auto-approve AI-generated local-language content.

### Acceptance Criteria

- Teacher can edit Ghanaian-language content.
- Teacher can approve language review.
- AI-generated language content remains blocked until reviewed.
- Existing editor remains usable.

### AI Agent Prompt

```txt
Add editing support for bilingual_text, vocabulary, and pronunciation blocks in the lesson content block editor. Teachers should be able to edit local-language text, English support text, vocabulary, pronunciation notes, and language metadata. Add a clear but simple language approval control. Do not auto-approve AI-generated local-language content.
```

### Stop Condition

Stop when teacher review works for language blocks.

---

## Slice 8 — Math Rendering Foundation

### Goal

Render math blocks safely.

### Files to Edit

```txt
src/components/lessons/LessonContentBlocksRenderer.tsx
```

Possible new components:

```txt
src/components/lessons/blocks/MathExpressionBlockView.tsx
src/components/lessons/blocks/WorkedExampleBlockView.tsx
```

### Tasks

- Choose approved renderer:
  - KaTeX or MathJax
- Render `math_expression`.
- Render `worked_example`.
- Show plain text fallback if rendering fails.
- Add validation status display for teachers.

### Acceptance Criteria

- Fractions and equations render properly.
- Invalid math does not crash the page.
- Teacher can see validation warning.
- Students see clean math, not raw broken syntax.

### AI Agent Prompt

```txt
Implement math rendering for math_expression and worked_example blocks using the approved math renderer. Use mathMeta.latex where available and fall back safely to plainText or bodyHtml if rendering fails. Do not allow invalid math to crash lesson rendering. Keep teacher validation warnings visible only in teacher context.
```

### Stop Condition

Stop when math blocks render safely.

---

## Slice 9 — Math Block Editing

### Goal

Allow teachers to edit math expressions and worked examples.

### Files to Edit

```txt
src/components/lessons/LessonContentBlocksEditor.tsx
```

Possible new components:

```txt
src/components/lessons/blocks/MathExpressionBlockEditor.tsx
src/components/lessons/blocks/WorkedExampleBlockEditor.tsx
```

### Tasks

- Add LaTeX input.
- Add rendered preview.
- Add plain text fallback.
- Add validation result.
- Support step-based worked examples.

### Acceptance Criteria

- Teacher can edit math expressions.
- Teacher sees rendered preview.
- Invalid math is clearly flagged.
- Existing non-math blocks are not affected.

### AI Agent Prompt

```txt
Add editing support for math_expression and worked_example blocks. Teachers should be able to enter a LaTeX expression, see a rendered preview, provide a plain text fallback, and add worked-example steps. Validate math input and show a clear warning if invalid. Do not require teachers to use this for existing normal explanation blocks.
```

### Stop Condition

Stop when math editing is functional and safe.

---

## Slice 10 — Asset Plan and Visual Block Rendering

### Goal

Render asset plans, diagrams, illustrations, and audio blocks safely.

### Files to Edit

```txt
src/components/lessons/LessonContentBlocksRenderer.tsx
```

Possible new components:

```txt
src/components/lessons/blocks/DiagramBlockView.tsx
src/components/lessons/blocks/IllustrationBlockView.tsx
src/components/lessons/blocks/AudioBlockView.tsx
src/components/lessons/blocks/AssetPlanBlockView.tsx
```

### Tasks

- Render `diagram`.
- Render `illustration`.
- Render `audio`.
- Render `asset_plan` only in teacher context.
- Show missing asset warning to teachers.
- Show alt text/caption where appropriate.

### Acceptance Criteria

- Visual blocks render without crashing.
- Missing assets do not break lesson page.
- Student view hides internal asset plans.
- Teacher view shows useful warnings.

### AI Agent Prompt

```txt
Implement safe rendering for diagram, illustration, audio, and asset_plan blocks. Asset plans should be teacher-facing only. Missing assets should show helpful teacher warnings but should not crash the lesson. Captions and alt text should be supported. Keep the UI clean and consistent.
```

### Stop Condition

Stop when visual/audio blocks render safely.

---

## Slice 11 — Deterministic Diagram Components

### Goal

Create accurate system-generated diagrams for common classroom needs.

### Files to Create

```txt
src/components/lessons/diagrams/FractionBarDiagram.tsx
src/components/lessons/diagrams/NumberLineDiagram.tsx
src/components/lessons/diagrams/AngleDiagram.tsx
src/components/lessons/diagrams/SimpleShapeDiagram.tsx
```

Possible helper:

```txt
src/lib/lessons/diagrams.ts
```

### Tasks

- Implement fraction bar.
- Implement number line.
- Implement angle diagram.
- Implement simple shape renderer.
- Use structured data, not AI-generated images.
- Support alt text.

### Acceptance Criteria

- Fraction bar renders accurately.
- Number line renders accurately.
- Angle diagram renders accurately enough for classroom use.
- No AI image is used for precise math diagrams.

### AI Agent Prompt

```txt
Create deterministic diagram components for fraction bars, number lines, angles, and simple shapes. These diagrams must render from structured data and must not use AI-generated images. Wire them into diagram block rendering where diagramMeta.diagramType matches. Include safe fallbacks for missing or invalid diagram data.
```

### Stop Condition

Stop when deterministic diagrams render from structured data.

---

## Slice 12 — Subject-Aware AI Output Planning

### Goal

Update AI lesson generation to produce subject-aware blocks.

### Files to Edit

```txt
src/app/api/leo/lessons/generate-session-content/route.ts
src/lib/lessons/subject-mode-resolver.ts
```

Possible helper:

```txt
src/lib/lessons/ai-content-plan.ts
```

### Tasks

- Resolve subject mode before generating AI content.
- Use different output rules per subject mode.
- General mode should preserve current behaviour.
- Ghanaian Language Mode should produce review-required language blocks.
- Mathematics Mode should produce math-aware blocks.
- Visual-heavy mode should produce asset plans where needed.
- AI output must remain JSON-safe and schema-validated.

### Acceptance Criteria

- General English subjects still generate normal blocks.
- Ghanaian-language subjects generate language-aware blocks.
- Math subjects generate math-aware blocks.
- Generated local-language content requires review.
- Existing AI generation route remains stable.

### AI Agent Prompt

```txt
Update the lesson session AI content generation route to resolve the subject mode before generation. Preserve existing general mode behaviour. For Ghanaian-language subjects, generate bilingual_text, vocabulary, pronunciation, activity, and check blocks with language review required. For Mathematics, generate math_expression and worked_example blocks with mathMeta. For visual-heavy lessons, generate asset_plan blocks where needed. Validate AI JSON output carefully and keep fallback behaviour safe.
```

### Stop Condition

Stop when subject-aware AI generation works for at least general, Ghanaian-language, and Mathematics modes.

---

## Slice 13 — Teach Mode Advanced Block Support

### Goal

Teach Mode should understand advanced content block types.

### Files to Edit

```txt
src/lib/lessons/build-teaching-deck.ts
src/lib/lessons/build-teaching-deck-shared.ts
src/components/lessons/SessionTeachingPresenter.tsx
src/components/lessons/TeachingSlideView.tsx
```

### Tasks

- Map language blocks to language teaching slides.
- Map vocabulary blocks to practice slides.
- Map pronunciation blocks to pronunciation slides.
- Map math blocks to math slides.
- Map worked examples to step slides.
- Map diagrams and illustrations to visual slides.
- Hide asset plans from normal teaching unless teacher-only.

### Acceptance Criteria

- Existing Teach Mode still works.
- Advanced blocks create useful slides.
- Math and language blocks do not render as broken plain HTML.
- Teacher-only planning blocks do not appear as student-facing teaching slides.

### AI Agent Prompt

```txt
Upgrade Teach Mode to support advanced lesson content blocks. Preserve all existing slide generation behaviour for old blocks. Add mappings for bilingual_text, vocabulary, pronunciation, math_expression, worked_example, diagram, illustration, audio, and asset_plan. Asset plans should be hidden or teacher-only. Ensure math and language content render cleanly in TeachingSlideView.
```

### Stop Condition

Stop when Teach Mode supports advanced blocks without breaking existing sessions.

---

## Slice 14 — Server-Side Publish Gate Upgrade

### Goal

Use readiness checks to strengthen server-side publishing.

### Files to Edit

```txt
src/app/api/teacher/lesson-sessions/[id]/route.ts
src/lib/lessons/content-blocks.ts
src/lib/lessons/content-readiness.ts
```

### Tasks

- Keep existing `assertSessionPublishAllowed()` behaviour.
- Add new readiness checks.
- Block publish when advanced content is not ready.
- Return clear blocking reasons to UI.
- Do not weaken existing AI review requirement.

### Acceptance Criteria

- Unreviewed AI content is still blocked.
- Ghanaian-language blocks needing review are blocked.
- Invalid math blocks are blocked.
- Required missing assets are blocked.
- Missing alt text for required visuals is blocked.
- UI receives readable error messages.

### AI Agent Prompt

```txt
Upgrade the server-side lesson session publish gate to use the new content readiness checker while preserving the existing assertSessionPublishAllowed behaviour. Publishing must be blocked for unreviewed AI content, language review issues, invalid math, missing required assets, and required visual assets missing alt text. Return clear blocking reasons to the UI.
```

### Stop Condition

Stop when server-side publishing is safely strengthened.

---

## Slice 15 — Student/Learn Payload Compatibility

### Goal

Ensure advanced blocks can later be consumed by student-facing views and EduSentrix Learn.

### Files to Inspect/Edit

```txt
src/components/lessons/LessonContentBlocksRenderer.tsx
src/types/lesson-content-blocks.ts
src/lib/lessons/content-block-normalizer.ts
```

Possible future integration area:

```txt
src/lib/learn
```

### Tasks

- Ensure blocks serialize cleanly.
- Ensure student views do not expose teacher-only metadata.
- Ensure unsupported mobile/Learn clients can fall back gracefully.
- Hide asset plans from student payloads unless explicitly allowed.
- Preserve old block compatibility.

### Acceptance Criteria

- Advanced blocks can be safely serialized.
- Student views do not leak teacher-only metadata.
- Asset plans remain teacher-facing.
- Old student lesson views still work.

### AI Agent Prompt

```txt
Review advanced lesson content blocks for student-facing and future EduSentrix Learn compatibility. Ensure they serialize safely, do not leak teacher-only metadata, and have graceful fallbacks. Asset plan blocks should not be exposed to students by default. Do not build the full Learn integration in this slice.
```

### Stop Condition

Stop when payload compatibility is confirmed.

---

## Slice 16 — Final Regression and QA

### Goal

Verify the full subject-aware content system works without breaking existing flows.

### Test Scenarios

General English lesson:

```txt
Generate content
Edit blocks
Review AI content
Publish
Open Teach Mode
Open student view
```

Ghanaian-language lesson:

```txt
Generate language-aware blocks
See language review required
Edit local-language content
Approve language content
Publish only after review
Open Teach Mode
```

Mathematics lesson:

```txt
Generate math-aware blocks
Render fractions/equations
Edit math expression
Validate math
Open Teach Mode
Publish only when valid
```

Visual-heavy lesson:

```txt
Generate asset plan
Attach illustration or diagram
Add alt text
Approve asset
Publish only when required assets are ready
```

Legacy lesson:

```txt
Open old lesson session
Render old blocks
Edit old blocks
Teach Mode works
Publish behaviour unchanged
```

### Acceptance Criteria

- No existing lesson flow is broken.
- AI generation works for old and new modes.
- Publish gates are stronger.
- Teach Mode supports advanced blocks.
- UI remains clean and uncluttered.
- No fake controls remain.
- No unsupported advanced block crashes the app.

### AI Agent Prompt

```txt
Run a full regression pass on the lesson session content system. Test general English lessons, Ghanaian-language lessons, Mathematics lessons, visual-heavy lessons, and old legacy lessons. Confirm rendering, editing, AI generation, review, publish gates, and Teach Mode all work. Fix only bugs found during QA. Do not introduce new features in this slice.
```

### Stop Condition

Stop when all acceptance criteria pass.

## 28. UI Design Rules

All new UI must follow the current EduSentrix design direction.

The UI should be:

```txt
clean
premium
calm
teacher-friendly
not cluttered
consistent with current cards, spacing, colors, and layout patterns
```

Avoid:

```txt
large dashboards inside lesson pages
too many buttons
too many badges
technical labels like “metadata”
raw JSON display
developer-facing terminology
```

Use teacher-friendly labels:

```txt
Language Review
Math Check
Illustrations
Audio
Ready to Publish
Needs Review
Missing Asset
Invalid Equation
```

## 29. Teacher Workflow

The teacher workflow should feel simple.

For normal lessons:

```txt
Generate lesson content
Review AI blocks
Publish
Teach
```

For Ghanaian-language lessons:

```txt
Generate language-aware content
Review local-language text
Correct spellings or dialect issues
Approve language review
Publish
Teach
```

For math lessons:

```txt
Generate math-aware content
Check equations and worked examples
Fix invalid notation if needed
Publish
Teach
```

For visual-heavy lessons:

```txt
Generate content and asset plan
Attach or approve visuals
Add alt text
Publish
Teach
```

## 30. Final Implementation Rule

This engine must be additive.

It should upgrade the current system from:

```txt
AI-generated lesson blocks
```

to:

```txt
subject-aware, reviewable, renderable, classroom-safe lesson blocks
```

without breaking:

```txt
lesson notes
lesson sessions
existing content blocks
Teach Mode
student views
AI review gates
published lessons
```

The correct mindset is:

```txt
Extend the current LessonSession.contentBlocks system.
Do not rebuild the lesson module.
```

## 31. Future Follow-Up Spec

A later spec should handle subject-aware lesson notes.

That future spec should cover:

```txt
French lesson note creation
Ghanaian-language lesson note creation
Mathematics lesson note creation
language-specific lesson note templates
math-specific lesson note templates
teacher input tools for symbols and local language text
scheme-to-note subject-aware generation
```

This is intentionally outside the scope of the current spec.
