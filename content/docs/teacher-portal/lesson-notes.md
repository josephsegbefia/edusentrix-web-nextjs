# Lesson Notes Builder

The Lesson Notes Builder is a comprehensive tool for creating professional, curriculum-aligned lesson notes. Access it from the teacher sidebar at `/teacher/lesson-notes`.

## Overview

The Lesson Notes Builder provides:
- **Multi-Template Support**: Choose from NaCCA 3-Phase, Classic JHS, or Quick Note templates
- **Rich Text Editing**: Format content with bold, italic, lists, headings, and more
- **Curriculum Alignment**: Link lessons to NaCCA strands, sub-strands, and indicators
- **Quality Checks**: Real-time quality score with actionable checklist items
- **AI Assistance**: Generate lesson content, expand sections, and suggest activities
- **Print & Export**: Print preview and PDF export
- **Approval Workflow**: Submit notes for admin review and approval
- **Offline Drafts**: Auto-save to localStorage so you never lose work

## Templates

### NaCCA 3-Phase

The recommended template for Ghana's National Council for Curriculum and Assessment framework:

- **Starter Phase**: Hook activity, review of prior knowledge (RPK), and introduction
- **Main Activity**: Teacher activities, learner activities, differentiation strategies, and resources used
- **Plenary**: Summary points, reflection questions, and assessment of learning

Each phase includes a configurable time allocation.

### Classic JHS

A traditional lesson plan structure commonly used in Junior High Schools:

- **General Objectives**: Overall learning goals
- **Specific Objectives**: Measurable outcomes
- **Review of Prior Knowledge (RPK)**: Connect to previous learning
- **Introduction**: Lesson opening strategy
- **Presentation Steps**: Numbered steps with teacher/learner activities and core points
- **Evaluation**: Assessment questions and activities
- **Remarks**: Post-lesson notes

### Quick Note (Simple)

A streamlined format for quick lesson planning:

- **Objectives**: What students should learn
- **Content**: Full lesson body (with rich text editor)

## Creating a Lesson Note

### Step 1: Context

1. Select a **Class** from your assigned classes
2. Choose the **Subject**
3. Enter the lesson **Topic**
4. Set the **Week of** date
5. Optionally set the lesson **Date** and **Duration**
6. Choose a **Template** (NaCCA 3-Phase, Classic JHS, or Quick Note)
7. Add **References** (textbook names, page numbers)

### Step 2: Curriculum

1. Enter the **Strand** (e.g., "Number")
2. Enter the **Sub-strand** (e.g., "Fractions")
3. Add the **Content Standard** (rich text supported)
4. Add **Indicators** with reference numbers and descriptions
5. List **Learning Outcomes** (what students will be able to do)

### Step 3: Lesson Body

Content varies by template:

- **NaCCA 3-Phase**: Fill in Starter, Main Activity, and Plenary sections with time allocations
- **Classic JHS**: Define objectives, RPK, introduction, presentation steps, and evaluation
- **Quick Note**: Write objectives and lesson content

All text fields support rich formatting (bold, italic, bullet lists, numbered lists, headings).

### Step 4: Resources

1. Add **TLMs** (Teaching & Learning Materials) — enter as comma-separated list
2. Add **External Resources** — links, PDFs, images, documents, videos, or slides
3. File resources can be uploaded directly via the file uploader

### Step 5: Assessment

1. Add **In-class Checks** — questions or activities to check understanding during the lesson
2. Write an **Exit Ticket** — a quick assessment at the end
3. Assign **Homework** — take-home tasks

### Step 6: Review

The final step shows a complete summary of your lesson note with:
- All sections at a glance
- Quality score with detailed checklist
- Click any section's "Edit" button to jump back
- Click quality check items to navigate to the relevant step

## Quality Score

The quality indicator appears in the wizard header and on the Review step. It evaluates:

| Category | Examples |
|----------|----------|
| Required | Topic filled, class selected, week set |
| Recommended | Curriculum strand, teacher activities, assessment |
| Optional | TLMs, resources, exit ticket, homework |

Quality levels:
- **Excellent** (90–100%): Green badge
- **Good** (70–89%): Blue badge
- **Fair** (50–69%): Amber badge
- **Needs Work** (below 50%): Red badge

## AI Assistance

Available AI features (requires OpenAI API key):
- **Generate Full Lesson**: Create a complete lesson from the topic and context
- **Expand Section**: Elaborate on a specific section
- **Suggest Activities**: Get activity ideas for any phase
- **Generate Assessment**: Auto-create assessment questions
- **Generate Objectives**: Create learning objectives from the topic
- **Improve Content**: Enhance existing text

## Approval Workflow

1. **Save as Draft**: Work in progress, only you can see it
2. **Submit for Review**: Sends to school admin for approval
3. **Admin Review**: Admin can approve or request revisions
4. **Return to Draft**: If revisions needed, edit and resubmit
5. **Approved**: Admin has signed off

## Print & Export

- Click **Print** to open a print preview modal with A4 formatting
- Click **Export PDF** to save as PDF (uses browser print-to-PDF)
- The print layout includes all sections formatted for paper

## Offline Drafts

Lesson notes auto-save to your browser's localStorage every few seconds. If you close the browser or lose connection:
- Draft is preserved locally
- On return, you'll be prompted to recover the draft
- Drafts are cleared once successfully saved to the server

## Tips

1. **Start with Context**: Fill in class, subject, and topic first — the quality score tracks completeness
2. **Use Rich Text**: Format your activities with bullet points and headings for clarity
3. **Align to Curriculum**: Adding strand and indicators improves your quality score
4. **Add TLMs**: List all materials you'll need for the lesson
5. **Review Before Submitting**: Use the Review step to catch anything missing
6. **Use AI Sparingly**: AI-generated content should be reviewed and customized

## Related Documentation

- [Teacher Studio](./teacher-studio.md): Assignments and quizzes
- [Gradebook & Attendance](./gradebook-attendance.md): Recording grades
- [Managing Teachers](../teachers/managing-teachers.md): Admin teacher management
