# Lesson Notes Admin Approval Workflow Plan

## Overview

This document outlines the implementation plan for a world-class lesson note approval workflow where:
1. Teachers submit lesson notes for review
2. School admins review, comment, and approve/request changes
3. Teachers make corrections and resubmit
4. Notes remain usable and editable throughout the process

---

## 1. Workflow States

```
┌─────────┐     Publish      ┌───────────┐     Approve      ┌──────────┐
│  Draft  │ ──────────────▶ │ In Review │ ──────────────▶  │ Approved │
└─────────┘                  └───────────┘                   └──────────┘
     ▲                            │                               │
     │                            │ Request Changes               │
     │                            ▼                               │
     │                      ┌───────────┐                         │
     └───────────────────── │ Revision  │ ◀───────────────────────┘
                            │ Requested │     (Optional resubmit)
                            └───────────┘
```

### Status Definitions

| Status | Description | Editable by Teacher | Visible to Admin |
|--------|-------------|---------------------|------------------|
| `draft` | Work in progress | ✅ Full edit | ❌ Not visible |
| `in_review` | Submitted for admin review | ✅ Limited edit* | ✅ Visible |
| `revision_requested` | Admin requested changes | ✅ Full edit | ✅ Visible |
| `approved` | Admin approved | ❌ View only | ✅ Visible |
| `published` | Final state (visible to parents/students if configured) | ❌ View only | ✅ Visible |

*Limited edit: Teachers can make minor edits while in review, but major changes reset to draft.

---

## 2. Data Model Updates

### 2.1 Update LessonNote Schema

```typescript
// Add to LessonNote model
{
  // ... existing fields ...
  
  // Approval workflow
  status: {
    type: String,
    enum: ["draft", "in_review", "revision_requested", "approved", "published"],
    default: "draft",
    index: true,
  },
  submittedAt: { type: Date },
  submittedBy: { type: Schema.Types.ObjectId, ref: "User" },
  
  // Review tracking
  reviewedAt: { type: Date },
  reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
  reviewerName: { type: String },
  
  // Approval
  approvedAt: { type: Date },
  approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
  approverName: { type: String },
  
  // Version tracking
  version: { type: Number, default: 1 },
  previousVersionId: { type: Schema.Types.ObjectId, ref: "LessonNote" },
}
```

### 2.2 New LessonNoteComment Model

```typescript
// src/models/LessonNoteComment.ts
const LessonNoteCommentSchema = new Schema({
  lessonNoteId: { type: Schema.Types.ObjectId, ref: "LessonNote", required: true, index: true },
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
  
  // Author
  authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  authorName: { type: String, required: true },
  authorRole: { type: String, enum: ["teacher", "admin", "head_of_department"], required: true },
  authorAvatarUrl: { type: String },
  
  // Comment content
  content: { type: String, required: true, maxlength: 2000 },
  
  // Target (for inline comments on specific sections)
  targetSection: { type: String }, // e.g., "body.main.teacherActivities", "curriculum.strand"
  targetText: { type: String, maxlength: 500 }, // Highlighted text if applicable
  
  // Threading
  parentCommentId: { type: Schema.Types.ObjectId, ref: "LessonNoteComment" },
  
  // Status
  resolved: { type: Boolean, default: false },
  resolvedAt: { type: Date },
  resolvedBy: { type: Schema.Types.ObjectId, ref: "User" },
  
  // Type
  type: { type: String, enum: ["comment", "suggestion", "correction", "praise"], default: "comment" },
}, { timestamps: true });

// Indexes
LessonNoteCommentSchema.index({ lessonNoteId: 1, createdAt: -1 });
LessonNoteCommentSchema.index({ lessonNoteId: 1, resolved: 1 });
```

### 2.3 New LessonNoteActivity Model (Audit Trail)

```typescript
// src/models/LessonNoteActivity.ts
const LessonNoteActivitySchema = new Schema({
  lessonNoteId: { type: Schema.Types.ObjectId, ref: "LessonNote", required: true, index: true },
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
  
  // Actor
  actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  actorName: { type: String, required: true },
  actorRole: { type: String },
  
  // Action
  action: { 
    type: String, 
    enum: [
      "created", 
      "updated", 
      "submitted_for_review", 
      "comment_added",
      "revision_requested",
      "approved",
      "published",
      "returned_to_draft"
    ],
    required: true 
  },
  
  // Details
  details: { type: Schema.Types.Mixed },
  
  // Previous state (for undo/audit)
  previousStatus: { type: String },
  newStatus: { type: String },
}, { timestamps: true });

// Index for timeline queries
LessonNoteActivitySchema.index({ lessonNoteId: 1, createdAt: -1 });
```

---

## 3. API Endpoints

### 3.1 Teacher Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/teacher/lesson-notes/:id/submit` | Submit for review |
| POST | `/api/teacher/lesson-notes/:id/return-to-draft` | Return to draft (if in_review) |
| GET | `/api/teacher/lesson-notes/:id/comments` | Get comments on note |
| POST | `/api/teacher/lesson-notes/:id/comments` | Reply to a comment |
| GET | `/api/teacher/lesson-notes/:id/activity` | Get activity timeline |

### 3.2 Admin Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/lesson-notes/pending` | List all notes pending review |
| GET | `/api/admin/lesson-notes/stats` | Dashboard stats (pending, approved today, etc.) |
| GET | `/api/admin/lesson-notes/:id` | Get full lesson note for review |
| POST | `/api/admin/lesson-notes/:id/approve` | Approve lesson note |
| POST | `/api/admin/lesson-notes/:id/request-revision` | Request changes |
| POST | `/api/admin/lesson-notes/:id/comments` | Add comment |
| PATCH | `/api/admin/lesson-notes/:id/comments/:commentId` | Update comment |
| DELETE | `/api/admin/lesson-notes/:id/comments/:commentId` | Delete comment |
| POST | `/api/admin/lesson-notes/:id/comments/:commentId/resolve` | Mark resolved |

---

## 4. Admin UI Components

### 4.1 Admin Lesson Notes Dashboard
**Path:** `/admin/lesson-notes`

```
┌──────────────────────────────────────────────────────────────────┐
│ Lesson Notes Review                                    [Filters] │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │    12    │  │    8     │  │    45    │  │    3     │         │
│  │ Pending  │  │ Revision │  │ Approved │  │ This Week│         │
│  │ Review   │  │ Requested│  │ Today    │  │ Published│         │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘         │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Pending Review                                    [Sort ▼] │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │ ┌────────────────────────────────────────────────────────┐ │ │
│  │ │ 📚 Introduction to Fractions                          │ │ │
│  │ │ Teacher: Mrs. Adjei  •  Class: Grade 4A  •  Math      │ │ │
│  │ │ Submitted: 2 hours ago                     [Review →] │ │ │
│  │ └────────────────────────────────────────────────────────┘ │ │
│  │                                                            │ │
│  │ ┌────────────────────────────────────────────────────────┐ │ │
│  │ │ 📖 The Water Cycle                                     │ │ │
│  │ │ Teacher: Mr. Owusu  •  Class: Grade 5B  •  Science    │ │ │
│  │ │ Submitted: 5 hours ago                     [Review →] │ │ │
│  │ └────────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 Lesson Note Review View
**Path:** `/admin/lesson-notes/:id/review`

A modern split-panel view:
- **Left Panel (60%):** Full lesson note content with:
  - Collapsible sections (Context, Curriculum, Body, Assessment)
  - Inline comment indicators
  - Highlighted sections with pending comments
  
- **Right Panel (40%):** Review sidebar with:
  - Teacher info & submission details
  - Quality score indicator
  - Comment thread
  - Quick action buttons (Approve, Request Revision, Add Comment)
  - Activity timeline

### 4.3 Inline Commenting System

```
┌─────────────────────────────────────────────────────────────────┐
│ Main Activity                                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Teacher Activities                                              │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ The teacher will demonstrate adding fractions with the     │ │
│ │ same denominator using visual aids. Students will be       │ │
│ │ guided through 3 examples on the board.                    │ │
│ │                                                 💬 [1 comment]│
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 💬 Comment by Head Teacher                         2h ago  │ │
│ │ ──────────────────────────────────────────────────────────  │ │
│ │ Consider adding differentiation strategies for students    │ │
│ │ who already understand this concept.                        │ │
│ │                                                             │ │
│ │ Type: 💡 Suggestion                      [Resolve] [Reply] │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.4 Quick Review Actions

```
┌─────────────────────────────────────────────────────┐
│ Review Actions                                       │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ ✅ Approve & Publish                        │   │
│  │ This lesson note meets all quality standards│   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ 📝 Request Revision                         │   │
│  │ Send back with comments for improvement     │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ 💬 Add General Comment                      │   │
│  │ Leave feedback without changing status      │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ 🖨️ Print Preview                           │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 5. Teacher UI Updates

### 5.1 Status Badge in List View

Show clear status indicators with actions:

```
┌─────────────────────────────────────────────────────────────────┐
│ 📚 Introduction to Fractions                                    │
│ Grade 4A  •  Mathematics  •  Week of Jan 15                     │
│                                                                 │
│ ┌────────────────┐  ┌─────────────────────────────────────────┐ │
│ │ 🔄 In Review   │  │ 💬 2 comments from Head Teacher         │ │
│ └────────────────┘  └─────────────────────────────────────────┘ │
│                                                                 │
│                                    [View Comments] [Edit] [...] │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Revision Requested View

```
┌─────────────────────────────────────────────────────────────────┐
│ ⚠️ Revision Requested                                           │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│ The Head Teacher has requested changes to this lesson note.    │
│                                                                 │
│ Comments to address:                                            │
│ • Add differentiation strategies (Main Activity)               │
│ • Include more specific learning outcomes (Curriculum)         │
│                                                                 │
│                            [View All Comments] [Make Edits →]   │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Comment Thread in Teacher View

Teachers can:
- View all comments from admin
- Reply to comments
- Mark comments as "Addressed" (pending admin verification)

---

## 6. Notifications

### 6.1 In-App Notifications

| Event | Recipient | Message |
|-------|-----------|---------|
| Note submitted | Admin | "Mrs. Adjei submitted 'Introduction to Fractions' for review" |
| Note approved | Teacher | "Your lesson note 'Introduction to Fractions' was approved" |
| Revision requested | Teacher | "Head Teacher requested revisions on 'Introduction to Fractions'" |
| New comment | Teacher/Admin | "New comment on 'Introduction to Fractions'" |
| Comment resolved | Admin | "Mrs. Adjei addressed your comment on 'Introduction to Fractions'" |

### 6.2 Email Notifications (Optional)

- Daily digest of pending reviews for admins
- Immediate notification for revision requests
- Weekly summary of approved/published notes

---

## 7. Implementation Phases

### Phase 1: Data Model & API (2-3 days)
1. Update `LessonNote` schema with new status values
2. Create `LessonNoteComment` model
3. Create `LessonNoteActivity` model
4. Implement teacher API endpoints
5. Implement admin API endpoints

### Phase 2: Teacher UI Updates (2 days)
1. Update status workflow in wizard
2. Add "Submit for Review" action
3. Show status badges and comment indicators
4. Add comment viewing/reply UI
5. Handle "Revision Requested" state

### Phase 3: Admin Dashboard (3-4 days)
1. Create `/admin/lesson-notes` page
2. Build dashboard stats cards
3. Create pending review list with filters
4. Implement review detail view

### Phase 4: Inline Commenting System (2-3 days)
1. Build comment thread component
2. Implement inline comment targeting
3. Add comment resolution workflow
4. Build comment notification indicators

### Phase 5: Polish & Notifications (1-2 days)
1. Add activity timeline component
2. Implement in-app notifications
3. Add loading states and error handling
4. Test complete workflow

---

## 8. File Structure

```
src/
├── app/
│   ├── (app)/
│   │   ├── admin/
│   │   │   └── lesson-notes/
│   │   │       ├── page.tsx                    # Admin dashboard
│   │   │       └── [id]/
│   │   │           └── review/
│   │   │               └── page.tsx            # Review detail view
│   │   └── teacher/
│   │       └── lesson-notes/
│   │           └── page.tsx                    # (existing, updated)
│   └── api/
│       ├── admin/
│       │   └── lesson-notes/
│       │       ├── route.ts                    # List pending
│       │       ├── stats/
│       │       │   └── route.ts                # Dashboard stats
│       │       └── [id]/
│       │           ├── route.ts                # Get/update
│       │           ├── approve/
│       │           │   └── route.ts            # Approve action
│       │           ├── request-revision/
│       │           │   └── route.ts            # Request revision
│       │           └── comments/
│       │               ├── route.ts            # List/add comments
│       │               └── [commentId]/
│       │                   └── route.ts        # Update/delete/resolve
│       └── teacher/
│           └── lesson-notes/
│               └── [id]/
│                   ├── submit/
│                   │   └── route.ts            # Submit for review
│                   ├── comments/
│                   │   └── route.ts            # View/reply
│                   └── activity/
│                       └── route.ts            # Activity timeline
├── components/
│   ├── admin/
│   │   └── lesson-notes/
│   │       ├── LessonNoteReviewCard.tsx
│   │       ├── LessonNoteReviewPanel.tsx
│   │       ├── ReviewActionsPanel.tsx
│   │       ├── CommentThread.tsx
│   │       └── InlineCommentIndicator.tsx
│   └── teacher/
│       └── lesson-notes/
│           ├── (existing components)
│           ├── StatusBadge.tsx
│           ├── CommentsIndicator.tsx
│           └── RevisionRequestedAlert.tsx
├── hooks/
│   ├── admin/
│   │   ├── usePendingLessonNotes.ts
│   │   ├── useLessonNoteReview.ts
│   │   └── useLessonNoteComments.ts
│   └── teacher/
│       └── useLessonNoteComments.ts
└── models/
    ├── LessonNote.ts                           # (updated)
    ├── LessonNoteComment.ts                    # (new)
    └── LessonNoteActivity.ts                   # (new)
```

---

## 9. Permissions

### New Permissions Required

```typescript
// Add to PERMISSIONS
lessonNotesReview: "lesson_notes:review",     // Can view pending notes
lessonNotesApprove: "lesson_notes:approve",   // Can approve/reject
lessonNotesComment: "lesson_notes:comment",   // Can add comments

// Base role permissions
school_admin: [
  PERMISSIONS.lessonNotesReview,
  PERMISSIONS.lessonNotesApprove,
  PERMISSIONS.lessonNotesComment,
],
head_of_department: [
  PERMISSIONS.lessonNotesReview,
  PERMISSIONS.lessonNotesComment,
],
```

---

## 10. Success Metrics

- **Review turnaround time:** Average time from submission to approval
- **Comments per note:** Average number of constructive comments
- **Revision rate:** Percentage of notes needing revision
- **Teacher response time:** Time to address revision requests
- **Quality improvement:** Compare scores before/after approval workflow

---

## Next Steps

1. Review and approve this plan
2. Start with Phase 1: Data Model & API
3. Implement incrementally, testing each phase
4. Gather teacher/admin feedback during development
