# EduSentrix — Lesson Notes Builder (Ghana / NaCCA) Spec

**Version:** 1.1  
**Last Updated:** 2026-02-19  
**Status:** In Development

---

**Goal:** Help Primary + JHS teachers in Ghana generate *professional lesson notes* that match common school expectations and align with NaCCA curriculum structures.

This spec supports **two templates**:
1. **NaCCA 3‑Phase Template** (Primary-focused): *Starter → Main → Plenary/Reflection*
2. **Classic JHS Template** (widely used): *Objectives/RPK/TLMs/Steps/Core Points/Evaluation/Remarks*

---

## Current State vs Target State

### What Exists Today
The current implementation (`/teacher/lesson-notes`) is a **basic lesson note system** with:
- ✅ Class/Subject selection
- ✅ Weekly-based notes (weekOf date)
- ✅ Topic, objectives, content (freeform text)
- ✅ Draft/Published status
- ✅ Resource links (title, URL, type)
- ✅ Tags
- ✅ Offline support (queued mutations)
- ✅ CRUD operations with React Query
- ✅ Permission-based access (journalView/journalWrite)

### What's Missing (Gap Analysis)
| Feature | Spec | Current | Priority |
|---------|------|---------|----------|
| Template selection (NaCCA/Classic) | ✅ | ❌ | P0 |
| Curriculum alignment (strand/indicator) | ✅ | ❌ | P0 |
| Structured body (phases/steps) | ✅ | ❌ | P0 |
| TLMs as dedicated field | ✅ | ❌ | P1 |
| Assessment section | ✅ | ❌ | P1 |
| Reflection section | ✅ | ❌ | P1 |
| Duration field | ✅ | ❌ | P1 |
| Reference field | ✅ | ❌ | P1 |
| Submit/Approve workflow | ✅ | ❌ | P2 |
| Export (PDF/DOCX) | ✅ | ❌ | P2 |
| AI generation | ✅ | ❌ | P3 |
| Upload & parse documents | ✅ | ❌ | P3 |
| Rich text editor | ❌ (new) | ❌ | P2 |
| Version history | ❌ (new) | ❌ | P3 |
| Print preview | ❌ (new) | ❌ | P2 |

---

## 1) Product Scope

### 1.1 What we’re building
A **Lesson Notes Builder** that lets teachers:
- Create lesson notes from scratch using guided steps.
- Generate lesson notes from:
  - **Scheme of Learning (SoL) entries**
  - **Topic + indicators**
  - **Uploaded lesson plan document** (optional feature; see section 2)
- Export/share lesson notes as:
  - PDF
  - DOCX
  - Print-friendly HTML

### 1.2 Primary users
- Teachers (Primary & JHS)
- Heads / Admins (review & approval)
- Curriculum coordinators (optional)

### 1.3 Non-goals (v1)
- Full curriculum ingestion for all NaCCA subjects (can be phased)
- Auto-grading of student work (separate module)

---

## 2) Key Decision: Allow teachers to upload a lesson plan?

### 2.1 Recommendation
**Yes — allow uploads, but as an *assistive* pathway, not the only pathway.**

Why:
- Many teachers already have templates in Word/PDF shared by heads/schools.
- Uploads reduce friction: teacher brings what they already have → EduSentrix converts + standardizes to NaCCA or Classic JHS.
- But uploads can be messy (different formats). So we keep a guided form as the canonical structured source.

### 2.2 How upload works (high level)
Teacher uploads a file (PDF/DOCX) → system extracts structure → maps to fields → teacher reviews → generates standardized lesson note.

**Important:** We do not “blindly” accept extracted content. Always show a review screen with highlighted mapped fields and “Unmapped” content.

### 2.3 Supported upload formats (v1)
- DOCX (best)
- PDF (acceptable, but may require better parsing)
- Plain text (optional)

### 2.4 Limitations to communicate
- If layout is heavily tabular/scanned images, parsing may be partial.
- Teacher must confirm or edit extracted fields before save/export.

---

## 3) User Experience (Teacher)

### 3.1 Entry points
- **Teacher Dashboard → Lesson Notes**
- **Class Group → Subject → Lesson Notes**
- **Scheme of Learning → “Create Lesson Note”** from a week/topic row
- **Timetable Period → “Plan Lesson”** (optional)

### 3.2 Create flow (wizard)
**Step A — Context**
- Academic year/term
- Class (e.g., P4, JHS2)
- Subject
- Duration (time)
- Date
- Topic
- Reference (textbook/curriculum page)
- Template selection: *(NaCCA 3‑Phase)* or *(Classic JHS)*

**Step B — Curriculum Alignment (structured)**
- Strand
- Sub-strand
- Content standard
- Indicator(s) / Learning indicator reference number(s)
- Learning outcomes (auto-suggest from indicators, editable)

**Step C — Teaching & Learning Resources**
- TLMs (materials)
- Key vocabulary / concepts
- Differentiation notes (optional)

**Step D — Lesson Body**
- If NaCCA: Starter / Main / Plenary (see section 4)
- If Classic JHS: Objectives / RPK / Steps / Core Points etc. (see section 5)

**Step E — Assessment**
- In-class checks (questions/tasks)
- Exit ticket / short quiz
- Rubric (optional)
- Homework / follow-up

**Step F — Reflection**
- Learner reflection notes
- Teacher reflection notes
- Next lesson link (optional)

**Step G — Save / Submit / Export**
- Save draft
- Submit for approval (if school policy)
- Export (PDF/DOCX)
- Share link

### 3.3 Upload-assisted flow
Teacher chooses **“Upload lesson plan”**:
1. Upload → parse → show “Extracted Fields”
2. Teacher selects template (NaCCA/Classic) if not detected
3. Review mapping screen
4. Generate structured lesson note
5. Edit + Save + Export

---

## 4) NaCCA 3‑Phase Lesson Note Template (Primary)
This is the canonical output structure for Primary.

### 4.1 Header
- School, Teacher name
- Date, Week/Term
- Class, Subject
- Duration
- Strand/Sub-strand
- Content Standard
- Indicators (+ ref numbers)
- Learning outcomes
- Reference(s)
- TLMs

### 4.2 Phase 1 — Starter (5–10 mins)
Required fields:
- **Starter activity description**
- **Review of previous knowledge** (RPK-style prompt)
- **Engagement hook** (question, story, quick game)

### 4.3 Phase 2 — Main (core teaching + assessment)
Required fields:
- **Teacher activities** (clear steps)
- **Learner activities** (pairs/groups/individual)
- **Resources used** (TLMs)
- **Embedded assessment** (questions/tasks)
Optional:
- Differentiation (support vs stretch)
- Grouping strategy

### 4.4 Phase 3 — Plenary/Reflection (wrap-up)
Required fields:
- Summary points / consolidation
- Learner reflection prompt
- Teacher reflection note (what worked, what to improve)
Optional:
- Exit ticket
- Homework / extension

---

## 5) Classic JHS Lesson Note Template (Common in Ghana)
This is the canonical output structure for many JHS teachers/schools.

### 5.1 Header
- School, Teacher
- Date, Class, Subject
- Duration
- Topic
- Reference(s)

### 5.2 Objectives
- General objective
- Specific objectives (measurable, 2–5)

### 5.3 RPK (Relevant Previous Knowledge)
- Short prompt to connect last lesson → current

### 5.4 TLMs
- Teaching and learning materials

### 5.5 Introduction
- Hook + statement of lesson purpose

### 5.6 Presentation / Steps (Teacher–Learner Activities)
- Step-by-step breakdown
- Key questions
- Learner tasks
- Board work prompts

### 5.7 Core Points / Summary (Board Summary)
- Bullet points of key learning

### 5.8 Evaluation
- Questions/tasks to check understanding (quick + written)
- Marking notes (optional)

### 5.9 Remarks
- Teacher remarks + follow-up

---

## 6) Data Model (MongoDB / Mongoose)
> Keep a single LessonNote model with a **templateType** and store body in a structured shape.

### 6.1 LessonNote (core)
- _id
- schoolId
- teacherId
- classGroupId (optional)
- subjectId (optional)
- templateType: `"NACCA_3_PHASE" | "CLASSIC_JHS"`
- status: `"draft" | "submitted" | "approved" | "rejected"`
- date, durationMinutes
- topic
- references: string[]
- curriculum:
  - strand, subStrand
  - contentStandard
  - indicators: [{ refNo, text }]
  - learningOutcomes: string[]
- tlms: string[]
- assessment:
  - inClass: string[]
  - exitTicket: string | null
  - homework: string | null
- reflections:
  - learner: string | null
  - teacher: string | null
- body:
  - if NaCCA:
    - starter: { teacherActivities, learnerActivities, rpkPrompt, timeMins }
    - main: { steps: [{ teacher, learner, checks }], differentiation, timeMins }
    - plenary: { summary, learnerReflection, teacherReflection, timeMins }
  - if Classic:
    - objectives: { general, specific: string[] }
    - rpk: string
    - introduction: string
    - presentationSteps: [{ stepTitle, teacher, learner, boardWork, timeMins }]
    - corePoints: string[]
    - evaluation: { questions: string[], answers?: string[] }
    - remarks: string
- attachments:
  - uploadedSourceUrl (optional)
  - exportUrls (pdf/docx)
- audit:
  - createdAt, updatedAt
  - submittedAt, approvedAt
  - approvedBy (adminId)

### 6.2 LessonNoteApproval (optional table)
If approvals require comments history:
- lessonNoteId
- action: submit/approve/reject
- actorId
- comment
- timestamp

---

## 7) AI/Generation Design

### 7.1 Inputs to AI (structured prompt contract)
- Teacher context: class level, subject, topic, duration
- Curriculum fields: strand/sub-strand/content standard/indicators
- Preferred template type
- Teaching style constraints:
  - class size (optional)
  - available materials (optional)
  - differentiation needs (optional)

### 7.2 Outputs (must be structured JSON)
AI must return:
- Curriculum alignment (may refine learning outcomes)
- TLM suggestions
- Phase/sections content in the correct schema
- Embedded assessment questions

### 7.3 Guardrails
- Do not generate content that conflicts with selected class level
- Keep time allocations realistic
- Keep language teacher-friendly, Ghana classroom context
- Always include assessment components

### 7.4 “Smart Suggestions” (non-AI or light AI)
- Topic → common TLM suggestions
- Indicator → likely learning outcomes
- Subject → common starter activities

---

## 8) Review + Quality Checks (Built-in)
Before teachers can export/submit:
- Required fields validation by template type
- Time allocation check (sum of phase times ~= duration)
- Curriculum alignment check (indicator present)
- “Too long” detector (suggest shorten)

---

## 9) Permissions + Workflow
- Teacher: create/edit own drafts, submit
- Head/Admin: approve/reject, add comments, view all
- Optional: school setting
  - approvalsRequired: true/false
  - allowedTemplates: both / one
  - export branding (school header/footer)

---

## 10) API Endpoints (Next.js App Router)
> Names are examples; align with your existing pattern (requireSchoolMember / role guards).

### 10.1 Lesson notes CRUD
- GET /api/teacher/lesson-notes?status=&termId=&classGroupId=&subjectId=
- POST /api/teacher/lesson-notes
- GET /api/teacher/lesson-notes/:id
- PATCH /api/teacher/lesson-notes/:id
- POST /api/teacher/lesson-notes/:id/submit

### 10.2 Approvals
- GET /api/admin/lesson-notes?status=submitted
- POST /api/admin/lesson-notes/:id/approve
- POST /api/admin/lesson-notes/:id/reject

### 10.3 Generation
- POST /api/ai/lesson-notes/generate
  - body: { templateType, curriculum, context, preferences }
  - returns: structured lessonNoteBody JSON

### 10.4 Upload parse
- POST /api/teacher/lesson-notes/parse-upload
  - body: { fileUrl }
  - returns: { extractedFields, confidence, unmappedText }

### 10.5 Export
- POST /api/teacher/lesson-notes/:id/export?format=pdf|docx
  - returns: exportUrl

---

## 11) UI Components (Web)
- LessonNotesList (filters: class, subject, term, status)
- LessonNoteWizard (stepper)
- TemplatePicker
- CurriculumAlignmentPanel
- PhaseEditor (NaCCA)
- ClassicEditor (JHS)
- AssessmentBuilder
- UploadAndMapModal
- ReviewScreen (diff: extracted vs final)
- ApprovalInbox (admins)
- ExportMenu

---

## 12) Phased Delivery Plan

### Phase 1 (MVP — 2–3 weeks)
- Manual creation via wizard (both templates)
- Save drafts + export PDF
- Optional submit/approve workflow

### Phase 2 (AI assist — 1–2 weeks)
- “Generate draft” button using structured prompt
- Quality checks + review

### Phase 3 (Upload-assisted — 2–4 weeks)
- DOCX parse + mapping UI
- PDF parse (best-effort)
- Teacher review + finalize

### Phase 4 (Curriculum enrichment)
- SoL builder integration
- Reuse lesson notes across terms/schools
- Analytics: teacher compliance + submission tracking

---

## 13) Success Metrics
- Lesson note creation time reduced (target: < 10 minutes with AI assist)
- % teachers creating notes weekly
- Approval turnaround time
- Export usage rate

---

## 14) Open Questions (can be decided later)
- Do we store SoL as a separate module now or later?
- Should lesson notes be tied to timetable periods automatically?
- Should we support offline mode (mobile) for teachers? → **Partially implemented (queued mutations)**

---

## 15) Suggested Improvements (v1.1 Additions)

Based on EdTech best practices and competitor analysis (Planboard, Chalk, Google Classroom, Canvas):

### 15.1 Rich Text Editor
Replace plain `<Textarea>` with a lightweight rich text editor for:
- Bullet/numbered lists
- Bold/italic/underline
- Headers (H3, H4)
- Simple tables (for lesson steps)

**Recommendation:** Use Tiptap or Plate.js (both headless, Next.js compatible)

### 15.2 Indicator Database (Pre-loaded NaCCA)
Instead of free-text indicators, provide:
- Searchable dropdown of NaCCA indicators by subject/strand
- Auto-populate content standard when indicator selected
- Store indicators in a `CurriculumIndicator` collection

**Data source:** NaCCA curriculum documents (can be manually entered or scraped)

### 15.3 Print Preview & PDF Generation
Before export, show a pixel-perfect preview of:
- School header/logo
- Lesson note in selected template format
- Page breaks for multi-page notes

**Recommendation:** Use `@react-pdf/renderer` for PDF generation

### 15.4 Version History
- Auto-save versions on significant changes
- "View history" to see previous versions
- Restore previous version
- Store in `LessonNoteVersion` collection or as embedded array

### 15.5 Collaborative Comments
- Heads/admins can leave inline comments during review
- Teacher sees comments and resolves them
- Useful for the approval workflow

### 15.6 Quick Actions
- "Copy to next week" (already implemented ✅)
- "Use as template" - save as reusable template
- "Share with colleague" - copy to another teacher

### 15.7 Calendar Integration
- Show lesson notes on the teacher's calendar view
- Link lesson notes to specific timetable periods
- See which periods have/don't have notes prepared

### 15.8 Assessment Integration
- Link lesson notes to quizzes/assignments in Teacher Studio
- When creating a lesson note, suggest related assessments
- After teaching, quickly create a linked quiz

### 15.9 Mobile-Optimized Entry
Many teachers create notes on phones:
- Voice-to-text for content entry
- Camera to capture handwritten notes → OCR
- Simplified mobile wizard

### 15.10 AI Enhancements
Beyond basic generation:
- **Auto-suggest TLMs** based on topic
- **Generate exit ticket questions** from content
- **Differentiation suggestions** for mixed-ability classes
- **Language simplification** for lower grade levels

---

## 16) Execution Plan

### Phase 1: Foundation (1 week)
**Goal:** Upgrade data model and basic UI to support templates

| Task | Files | Effort |
|------|-------|--------|
| Update `LessonNote` model with new fields | `src/models/LessonNote.ts` | 2h |
| Add `templateType` enum (NACCA_3_PHASE, CLASSIC_JHS) | Model + types | 1h |
| Add structured `body` field (discriminated union) | Model | 2h |
| Add curriculum fields (strand, subStrand, etc.) | Model | 1h |
| Add TLMs, assessment, reflection, duration, references | Model | 2h |
| Create migration script for existing notes | `scripts/` | 2h |
| Update API routes for new fields | `src/app/api/teacher/lesson-notes/` | 3h |

### Phase 2: UI - Template Selection & Wizard (1.5 weeks)
**Goal:** Replace single form with multi-step wizard

| Task | Files | Effort |
|------|-------|--------|
| Create `LessonNoteWizard` component | `src/components/teacher/lesson-notes/` | 4h |
| Step 1: Context (class, subject, date, template) | Component | 3h |
| Step 2: Curriculum alignment (strand, indicators) | Component | 4h |
| Step 3: TLMs & Resources | Component | 2h |
| Step 4A: NaCCA phases editor | Component | 4h |
| Step 4B: Classic JHS editor | Component | 4h |
| Step 5: Assessment & Reflection | Component | 3h |
| Step 6: Review & Save | Component | 2h |
| Update list view to show template badge | Page | 1h |

### Phase 3: Approval Workflow (1 week)
**Goal:** Add submit/approve/reject flow for heads

| Task | Files | Effort |
|------|-------|--------|
| Add `status` values: submitted, approved, rejected | Model | 1h |
| Add `LessonNoteApproval` model | `src/models/` | 2h |
| Create approval API routes | `src/app/api/admin/lesson-notes/` | 3h |
| Add "Submit for approval" action | UI | 2h |
| Create admin inbox for pending approvals | `src/app/(app)/admin/lesson-notes/` | 4h |
| Add approval/rejection with comments | UI + API | 3h |
| Email/notification on status change | Service | 2h |

### Phase 4: Export (PDF/DOCX) (1 week)
**Goal:** Generate professional exports

| Task | Files | Effort |
|------|-------|--------|
| Install `@react-pdf/renderer` | Package | 0.5h |
| Create PDF template for NaCCA 3-Phase | Component | 4h |
| Create PDF template for Classic JHS | Component | 4h |
| Add school branding (logo, header, footer) | Template | 2h |
| Create export API route | `src/app/api/teacher/lesson-notes/[id]/export/` | 3h |
| Add DOCX export using `docx` package | API | 4h |
| Add "Export" menu to UI | Component | 1h |
| Add print preview modal | Component | 3h |

### Phase 5: AI Generation (1 week)
**Goal:** Generate draft lesson notes from prompts

| Task | Files | Effort |
|------|-------|--------|
| Create structured prompt template | `src/lib/ai/` | 3h |
| Create AI generation API route | `src/app/api/ai/lesson-notes/` | 4h |
| Add "Generate with AI" button to wizard | UI | 2h |
| Stream response with loading states | UI | 3h |
| Add AI suggestion chips (TLMs, questions) | UI | 3h |
| Guardrails: validate output, allow teacher edits | Logic | 2h |

### Phase 6: Upload & Parse (2 weeks)
**Goal:** Extract structure from uploaded documents

| Task | Files | Effort |
|------|-------|--------|
| Create upload endpoint for lesson docs | `src/app/api/teacher/lesson-notes/parse-upload/` | 2h |
| DOCX parsing with `mammoth.js` | Service | 4h |
| PDF parsing with `pdf-parse` | Service | 4h |
| Field mapping logic | Service | 6h |
| Review/mapping UI modal | Component | 6h |
| Confidence indicators for extracted fields | UI | 2h |
| "Accept all" vs manual mapping flow | UI | 3h |

### Phase 7: Enhancements (Ongoing)
- Rich text editor integration
- Indicator database & autocomplete
- Version history
- Mobile optimizations
- Calendar integration

---

## 17) Technical Decisions

### 17.1 Rich Text Editor Choice
| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| Tiptap | Headless, highly customizable, great docs | Slightly larger bundle | ✅ **Recommended** |
| Plate.js | Plugin architecture, shadcn compatible | Steeper learning curve | Alternative |
| React Quill | Simple, common | Less customizable, older | Not recommended |

### 17.2 PDF Generation
| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| @react-pdf/renderer | React components, client-side | Complex layouts tricky | ✅ **Recommended** |
| Puppeteer (server) | HTML to PDF, accurate | Needs headless Chrome | For complex layouts |
| html2pdf.js | Simple | Less control | Not recommended |

### 17.3 Body Structure (Discriminated Union)
```typescript
type LessonNoteBody = 
  | {
      templateType: "NACCA_3_PHASE";
      starter: { activities: string; rpkPrompt: string; hook: string; timeMins: number };
      main: { teacherActivities: string; learnerActivities: string; resources: string; assessment: string; timeMins: number };
      plenary: { summary: string; learnerReflection: string; teacherReflection: string; timeMins: number };
    }
  | {
      templateType: "CLASSIC_JHS";
      objectives: { general: string; specific: string[] };
      rpk: string;
      introduction: string;
      steps: Array<{ title: string; teacher: string; learner: string; timeMins: number }>;
      corePoints: string[];
      evaluation: { questions: string[]; answers?: string[] };
      remarks: string;
    };
```

---

## 18) Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Existing notes incompatible with new schema | Migration script + backward compatibility (treat as "legacy" template) |
| Teachers confused by wizard | Offer "Quick note" mode (current simple form) alongside wizard |
| PDF generation too slow | Generate async, show progress, cache exports |
| AI generation produces low quality | Always show draft, require teacher review before save |
| Upload parsing unreliable | Set clear expectations, always show review step |

---

## 19) Success Metrics (Updated)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Lesson note creation time | < 10 min with AI | Time tracking |
| Template adoption | > 60% use structured templates | Analytics |
| Approval turnaround | < 24 hours | Time between submit and approve |
| Export usage | > 30% notes exported | API calls |
| Weekly active teachers | > 80% with notes | Dashboard |
| Mobile usage | > 40% of note entries | User agent |

---

**End of Spec**
