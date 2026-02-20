# Lesson Notes Builder - Implementation Plan

**Target Page:** `http://localhost:3000/teacher/lesson-notes`  
**Spec Reference:** `edusentrix-lesson-notes-spec.md`  
**Created:** 2026-02-19

---

## Overview

Transform the existing basic lesson notes page into a full-featured **Lesson Notes Builder** supporting:
- Two template types (NaCCA 3-Phase & Classic JHS)
- Curriculum alignment with Ghana NaCCA standards
- Approval workflows
- PDF/DOCX export
- AI-assisted generation

---

## Current Implementation Analysis

### Existing Files

| File | Purpose | Keep/Modify |
|------|---------|-------------|
| `src/app/(app)/teacher/lesson-notes/page.tsx` | Main page with form + list | **Modify heavily** |
| `src/models/LessonNote.ts` | Mongoose model | **Extend** |
| `src/hooks/teacher/useTeacherLessonNotes.ts` | List query hook | Keep |
| `src/hooks/teacher/useTeacherLessonNoteCreate.ts` | Create mutation | Keep |
| `src/hooks/teacher/useTeacherLessonNoteUpdate.ts` | Update mutation | Keep |
| `src/hooks/teacher/useTeacherLessonNoteDelete.ts` | Delete mutation | Keep |
| `src/app/api/teacher/lesson-notes/route.ts` | API routes | **Extend** |
| `src/app/api/teacher/lesson-notes/[id]/route.ts` | Single note API | **Extend** |

### Current Features ✅
- Basic CRUD operations
- Class/subject selection
- Week-based organization
- Topic, objectives, content (freeform)
- Draft/published status
- Resources (links)
- Tags
- Offline support (queued mutations)
- Permission checks

### Missing Features ❌
- Template selection
- Curriculum alignment
- Structured body (phases/steps)
- TLMs field
- Assessment section
- Reflection section
- Duration & references
- Approval workflow
- Export functionality
- AI generation
- Document upload/parse

---

## Phase 1: Data Model Update (Day 1-2)

### 1.1 Update LessonNote Model

```typescript
// src/models/LessonNote.ts - New fields to add

export type LessonNoteTemplateType = "NACCA_3_PHASE" | "CLASSIC_JHS" | "SIMPLE";
export type LessonNoteStatus = "draft" | "submitted" | "approved" | "rejected" | "published";

// NaCCA 3-Phase body structure
interface NaCCA3PhaseBody {
  starter: {
    activities: string;
    rpkPrompt: string;
    engagementHook: string;
    timeMins: number;
  };
  main: {
    teacherActivities: string;
    learnerActivities: string;
    resourcesUsed: string;
    embeddedAssessment: string;
    differentiation?: string;
    timeMins: number;
  };
  plenary: {
    summaryPoints: string;
    learnerReflection: string;
    teacherReflection: string;
    exitTicket?: string;
    homework?: string;
    timeMins: number;
  };
}

// Classic JHS body structure
interface ClassicJHSBody {
  objectives: {
    general: string;
    specific: string[];
  };
  rpk: string;
  introduction: string;
  presentationSteps: Array<{
    stepTitle: string;
    teacherActivity: string;
    learnerActivity: string;
    boardWork?: string;
    timeMins: number;
  }>;
  corePoints: string[];
  evaluation: {
    questions: string[];
    answers?: string[];
  };
  remarks: string;
}

// Curriculum alignment
interface CurriculumAlignment {
  strand?: string;
  subStrand?: string;
  contentStandard?: string;
  indicators: Array<{
    refNo: string;
    text: string;
  }>;
  learningOutcomes: string[];
}

// Assessment section
interface LessonAssessment {
  inClassChecks: string[];
  exitTicket?: string;
  homework?: string;
  rubricId?: Types.ObjectId;
}

// Full interface additions
interface ILessonNote {
  // ... existing fields ...
  templateType: LessonNoteTemplateType;
  durationMinutes?: number;
  references: string[];
  curriculum?: CurriculumAlignment;
  tlms: string[];
  body?: NaCCA3PhaseBody | ClassicJHSBody | null;
  assessment?: LessonAssessment;
  reflections?: {
    learner?: string;
    teacher?: string;
    nextLessonLink?: string;
  };
  // Approval workflow
  submittedAt?: Date;
  approvedAt?: Date;
  approvedBy?: Types.ObjectId;
  rejectionReason?: string;
  // Export
  exportUrls?: {
    pdf?: string;
    docx?: string;
  };
  // Source
  uploadedSourceUrl?: string;
}
```

### 1.2 Create Migration Script

```bash
# Create migration file
mkdir -p src/scripts
touch src/scripts/migrate-lesson-notes-v2.ts
```

Migration tasks:
1. Set `templateType: "SIMPLE"` for existing notes
2. Move `content` to `body.content` for simple template
3. Add empty `curriculum`, `tlms`, `assessment` fields

### 1.3 Tasks

- [ ] Update `src/models/LessonNote.ts` with new schema
- [ ] Create `src/types/lesson-notes.ts` for TypeScript types
- [ ] Create migration script
- [ ] Run migration on dev database
- [ ] Update API routes to handle new fields

---

## Phase 2: Template Selection & Context (Day 3-4)

### 2.1 UI Components to Create

```
src/components/teacher/lesson-notes/
├── LessonNoteWizard.tsx          # Multi-step wizard container
├── steps/
│   ├── ContextStep.tsx           # Class, subject, date, template
│   ├── CurriculumStep.tsx        # Strand, indicators, outcomes
│   ├── ResourcesStep.tsx         # TLMs, references
│   ├── NaCC3PhaseStep.tsx        # Starter/Main/Plenary editors
│   ├── ClassicJHSStep.tsx        # Objectives/RPK/Steps editors
│   ├── AssessmentStep.tsx        # In-class checks, exit ticket
│   └── ReviewStep.tsx            # Preview before save
├── TemplatePicker.tsx            # Template selection cards
├── CurriculumAlignmentPanel.tsx  # Strand/indicator selectors
├── PhaseEditor.tsx               # Individual phase editor
├── StepEditor.tsx                # Individual step editor
└── LessonNoteCard.tsx            # List item card
```

### 2.2 Wizard Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Context                                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │   Class     │ │   Subject   │ │    Date     │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
│  ┌─────────────┐ ┌─────────────┐                           │
│  │  Duration   │ │  Reference  │                           │
│  └─────────────┘ └─────────────┘                           │
│                                                             │
│  Select Template:                                           │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │  NaCCA 3-Phase  │  │   Classic JHS   │                  │
│  │  (Primary)      │  │   (JHS)         │                  │
│  │  Starter→Main→  │  │  Obj→RPK→Steps  │                  │
│  │  Plenary        │  │  →Eval→Remarks  │                  │
│  └─────────────────┘  └─────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 2: Curriculum Alignment                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Strand: [Select or type...]                        │   │
│  │  Sub-strand: [Select or type...]                    │   │
│  │  Content Standard: [Select or type...]              │   │
│  └─────────────────────────────────────────────────────┘   │
│  Indicators:                                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  + Add indicator  [Ref No] [Description]            │   │
│  └─────────────────────────────────────────────────────┘   │
│  Learning Outcomes:                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  + Auto-suggested from indicators (editable)        │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 3: Teaching & Learning Resources                      │
│  TLMs (Materials):                                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  [Whiteboard] [x]  [Markers] [x]  [Textbook] [x]   │   │
│  │  + Add custom TLM                                   │   │
│  └─────────────────────────────────────────────────────┘   │
│  External Resources:                                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  [Title] [URL] [Type: PDF/Video/Link]              │   │
│  │  + Add resource                                     │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 4: Lesson Body (Template-specific)                    │
│                                                             │
│  [NaCCA 3-Phase]                 [Classic JHS]              │
│  ┌─────────────────┐            ┌─────────────────┐        │
│  │ STARTER (10min) │            │ OBJECTIVES      │        │
│  │ - Activities    │            │ - General       │        │
│  │ - RPK prompt    │            │ - Specific (1-5)│        │
│  │ - Engagement    │            └─────────────────┘        │
│  └─────────────────┘            ┌─────────────────┐        │
│  ┌─────────────────┐            │ RPK             │        │
│  │ MAIN (25min)    │            └─────────────────┘        │
│  │ - Teacher acts  │            ┌─────────────────┐        │
│  │ - Learner acts  │            │ INTRODUCTION    │        │
│  │ - Assessment    │            └─────────────────┘        │
│  └─────────────────┘            ┌─────────────────┐        │
│  ┌─────────────────┐            │ STEPS (1-n)     │        │
│  │ PLENARY (5min)  │            │ - Teacher act   │        │
│  │ - Summary       │            │ - Learner act   │        │
│  │ - Reflection    │            │ - Board work    │        │
│  └─────────────────┘            └─────────────────┘        │
│                                  ┌─────────────────┐        │
│                                  │ CORE POINTS     │        │
│                                  └─────────────────┘        │
│                                  ┌─────────────────┐        │
│                                  │ EVALUATION      │        │
│                                  └─────────────────┘        │
│                                  ┌─────────────────┐        │
│                                  │ REMARKS         │        │
│                                  └─────────────────┘        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 5: Assessment & Reflection                            │
│  In-class Checks:                                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  + Add question/task                                │   │
│  └─────────────────────────────────────────────────────┘   │
│  Exit Ticket:                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Quick question for end of lesson                   │   │
│  └─────────────────────────────────────────────────────┘   │
│  Homework:                                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Assignment or follow-up task                       │   │
│  └─────────────────────────────────────────────────────┘   │
│  Reflections:                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Learner: What did students learn?                  │   │
│  │  Teacher: What worked? What to improve?             │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 6: Review & Save                                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Preview of complete lesson note                    │   │
│  │  (Formatted as it will appear in export)           │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐             │
│  │ Save Draft │ │  Publish   │ │  Submit    │             │
│  └────────────┘ └────────────┘ └────────────┘             │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 Tasks

- [ ] Create `LessonNoteWizard.tsx` with step navigation
- [ ] Create `ContextStep.tsx` with class/subject/date/template
- [ ] Create `TemplatePicker.tsx` with visual template cards
- [ ] Create `CurriculumStep.tsx` with strand/indicator inputs
- [ ] Create `ResourcesStep.tsx` with TLM management
- [ ] Implement wizard state management (React state or form library)
- [ ] Add step validation before proceeding

---

## Phase 3: Template-Specific Editors (Day 5-7)

### 3.1 NaCCA 3-Phase Editor

```tsx
// src/components/teacher/lesson-notes/steps/NaCCA3PhaseStep.tsx
// Three collapsible/expandable phase sections
// Each with time allocation
// Rich text for activities
```

### 3.2 Classic JHS Editor

```tsx
// src/components/teacher/lesson-notes/steps/ClassicJHSStep.tsx
// Sequential sections
// Specific objective list (add/remove)
// Presentation steps (add/remove/reorder)
```

### 3.3 Tasks

- [ ] Create `NaCCA3PhaseStep.tsx` with starter/main/plenary sections
- [ ] Create `ClassicJHSStep.tsx` with objectives/rpk/steps/eval sections
- [ ] Create `PhaseEditor.tsx` reusable component
- [ ] Create `StepEditor.tsx` for presentation steps
- [ ] Add time allocation inputs with validation (sum = duration)
- [ ] Add drag-and-drop reordering for steps

---

## Phase 4: Assessment & Review (Day 8-9)

### 4.1 Assessment Step

- In-class check questions (array)
- Exit ticket (optional)
- Homework assignment (optional)
- Link to existing rubric (optional)

### 4.2 Review Step

- Read-only preview of all fields
- Template-formatted display
- Edit button for each section
- Save options (draft/publish/submit)

### 4.3 Tasks

- [ ] Create `AssessmentStep.tsx`
- [ ] Create `ReviewStep.tsx` with formatted preview
- [ ] Add validation summary (missing required fields)
- [ ] Implement save/publish/submit actions

---

## Phase 5: Update List View & Page (Day 10)

### 5.1 Updated Page Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Lesson Notes                           [+ New Note] [AI ✨]│
│  ─────────────────────────────────────────────────────────  │
│  [Class ▼] [Subject ▼] [Week ▼] [Status ▼] [Search...]     │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 📘 Fractions and Decimals            [NaCCA] [Draft]│   │
│  │ Grade 4 · Mathematics · Week of Feb 17             │   │
│  │ Indicators: B4.2.1.1, B4.2.1.2                     │   │
│  │ 45 min · 3 resources                               │   │
│  │ [Edit] [Duplicate] [Export ▼] [...]                │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 📗 The Water Cycle                   [JHS] [Published]│  │
│  │ JHS 2 · Integrated Science · Week of Feb 10        │   │
│  │ Strand: Diversity of Matter · 5 steps              │   │
│  │ 60 min · 2 resources · Approved ✓                  │   │
│  │ [View] [Duplicate] [Export ▼] [...]                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Tasks

- [ ] Update `page.tsx` to show template badge
- [ ] Update `LessonNoteCard.tsx` with curriculum info
- [ ] Add "New Note" button that opens wizard
- [ ] Keep "Quick Note" option for simple template
- [ ] Add export menu to card actions

---

## Phase 6: Approval Workflow (Day 11-13)

### 6.1 New Routes

```
src/app/api/teacher/lesson-notes/[id]/submit/route.ts    POST
src/app/api/admin/lesson-notes/route.ts                  GET (pending)
src/app/api/admin/lesson-notes/[id]/approve/route.ts     POST
src/app/api/admin/lesson-notes/[id]/reject/route.ts      POST
```

### 6.2 Admin Page

```
src/app/(app)/admin/lesson-notes/
├── page.tsx              # Approval inbox
└── [id]/
    └── page.tsx          # Review single note
```

### 6.3 Tasks

- [ ] Create submit API route
- [ ] Create admin approval routes
- [ ] Create `LessonNoteApproval` model for history
- [ ] Create admin inbox page
- [ ] Create review page with approve/reject actions
- [ ] Add notifications on status change
- [ ] Update teacher view to show approval status

---

## Phase 7: Export (PDF/DOCX) (Day 14-16)

### 7.1 PDF Templates

Using `@react-pdf/renderer`:

```tsx
// src/components/teacher/lesson-notes/export/
├── LessonNotePDF.tsx           # Main PDF document
├── NaCCAPDF.tsx                # NaCCA 3-Phase layout
├── ClassicJHSPDF.tsx           # Classic JHS layout
└── PDFHeader.tsx               # School branding
```

### 7.2 API Route

```typescript
// src/app/api/teacher/lesson-notes/[id]/export/route.ts
// GET ?format=pdf|docx
// Returns file download or URL
```

### 7.3 Tasks

- [ ] Install `@react-pdf/renderer` and `docx`
- [ ] Create PDF template for NaCCA
- [ ] Create PDF template for Classic JHS
- [ ] Add school branding (logo, header, footer)
- [ ] Create export API route
- [ ] Create DOCX export
- [ ] Add print preview modal
- [ ] Add export menu to UI

---

## Phase 8: AI Generation (Day 17-19)

### 8.1 Generation Flow

1. Teacher selects class/subject/topic
2. Teacher clicks "Generate with AI"
3. System sends structured prompt with curriculum context
4. AI returns structured JSON matching template schema
5. Teacher reviews and edits
6. Teacher saves

### 8.2 API Route

```typescript
// src/app/api/ai/lesson-notes/generate/route.ts
// POST { templateType, curriculum, context }
// Returns { body: NaCCA3PhaseBody | ClassicJHSBody }
```

### 8.3 Tasks

- [ ] Create AI generation prompt template
- [ ] Create generation API route
- [ ] Add streaming response handling
- [ ] Add "Generate" button to wizard
- [ ] Show loading state during generation
- [ ] Allow field-by-field regeneration
- [ ] Add guardrails for output validation

---

## Phase 9: Upload & Parse (Day 20-24)

### 9.1 Upload Flow

1. Teacher uploads DOCX/PDF
2. System parses document
3. System attempts to map to fields
4. Show mapping review UI
5. Teacher confirms/edits
6. Save as lesson note

### 9.2 Tasks

- [ ] Install `mammoth` (DOCX) and `pdf-parse` (PDF)
- [ ] Create parse API route
- [ ] Implement field extraction logic
- [ ] Create mapping review modal
- [ ] Show confidence indicators
- [ ] Allow manual field assignment
- [ ] Save extracted note

---

## Dependencies to Install

```bash
# PDF generation
npm install @react-pdf/renderer

# DOCX generation
npm install docx

# Document parsing
npm install mammoth pdf-parse

# Rich text editor (optional, Phase 7+)
npm install @tiptap/react @tiptap/starter-kit
```

---

## File Structure (Final)

```
src/
├── app/(app)/teacher/lesson-notes/
│   ├── page.tsx                    # List view
│   ├── new/
│   │   └── page.tsx                # Wizard page
│   └── [id]/
│       ├── page.tsx                # View/edit page
│       └── export/
│           └── page.tsx            # Print preview
├── app/(app)/admin/lesson-notes/
│   ├── page.tsx                    # Approval inbox
│   └── [id]/
│       └── page.tsx                # Review page
├── app/api/teacher/lesson-notes/
│   ├── route.ts                    # GET list, POST create
│   ├── [id]/
│   │   ├── route.ts                # GET, PATCH, DELETE
│   │   ├── submit/route.ts         # POST submit
│   │   └── export/route.ts         # GET export
│   └── parse-upload/route.ts       # POST upload
├── app/api/admin/lesson-notes/
│   ├── route.ts                    # GET pending
│   └── [id]/
│       ├── approve/route.ts        # POST
│       └── reject/route.ts         # POST
├── app/api/ai/lesson-notes/
│   └── generate/route.ts           # POST
├── components/teacher/lesson-notes/
│   ├── LessonNoteWizard.tsx
│   ├── LessonNoteCard.tsx
│   ├── TemplatePicker.tsx
│   ├── CurriculumAlignmentPanel.tsx
│   ├── steps/
│   │   ├── ContextStep.tsx
│   │   ├── CurriculumStep.tsx
│   │   ├── ResourcesStep.tsx
│   │   ├── NaCCA3PhaseStep.tsx
│   │   ├── ClassicJHSStep.tsx
│   │   ├── AssessmentStep.tsx
│   │   └── ReviewStep.tsx
│   └── export/
│       ├── LessonNotePDF.tsx
│       ├── NaCCAPDF.tsx
│       └── ClassicJHSPDF.tsx
├── models/
│   ├── LessonNote.ts               # Updated model
│   └── LessonNoteApproval.ts       # New model
├── hooks/teacher/
│   ├── useTeacherLessonNotes.ts    # Keep
│   ├── useTeacherLessonNoteCreate.ts
│   ├── useTeacherLessonNoteUpdate.ts
│   ├── useTeacherLessonNoteDelete.ts
│   ├── useTeacherLessonNoteSubmit.ts  # New
│   └── useTeacherLessonNoteExport.ts  # New
└── types/
    └── lesson-notes.ts             # TypeScript types
```

---

## Timeline Summary

| Phase | Days | Effort | Deliverable |
|-------|------|--------|-------------|
| 1. Data Model | 1-2 | 12h | Updated schema + migration |
| 2. Template Selection | 3-4 | 16h | Wizard with context step |
| 3. Template Editors | 5-7 | 20h | NaCCA + Classic editors |
| 4. Assessment & Review | 8-9 | 12h | Assessment step + review |
| 5. List View Update | 10 | 8h | Updated page with templates |
| 6. Approval Workflow | 11-13 | 20h | Submit/approve flow |
| 7. Export | 14-16 | 24h | PDF + DOCX export |
| 8. AI Generation | 17-19 | 20h | AI draft generation |
| 9. Upload & Parse | 20-24 | 32h | Document parsing |

**Total:** ~24 days (~164 hours)

---

## Getting Started (Phase 1)

```bash
# 1. Start with the model update
code src/models/LessonNote.ts

# 2. Create types file
code src/types/lesson-notes.ts

# 3. Create migration script
code src/scripts/migrate-lesson-notes-v2.ts

# 4. Run migration
npx ts-node src/scripts/migrate-lesson-notes-v2.ts

# 5. Update API routes
code src/app/api/teacher/lesson-notes/route.ts
```

---

**Ready to start Phase 1?**
