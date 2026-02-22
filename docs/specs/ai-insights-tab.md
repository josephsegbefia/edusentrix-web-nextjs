# AI Insights & Recommendations Tab — Technical Specification

**Version:** 1.0
**Date:** 21 February 2026
**Status:** Approved for implementation

---

## 1. Overview

A dedicated **"AI Insights"** tab on the Student Detail page that provides a holistic, multi-dimensional view of a student's performance, behaviour, attendance, and financial status — powered by a combination of **zero-cost rule-based analysis** and **cached AI-generated narratives**.

### Design Principles

- **Instant value at zero cost** — rule-based Tier 1 insights are always available with no API calls
- **AI as an enhancement, not a dependency** — the tab is fully functional without OpenAI
- **Cache-first architecture** — AI results are generated once and cached per student per term
- **Role-aware** — all users can view insights; only admins can trigger AI generation
- **Ghanaian education context** — prompts and analysis tuned for GES curriculum, BECE, and local norms

---

## 2. Three-Tier Architecture

### Tier 1: Rule-Based Analysis (Zero Cost)

Computed server-side with pure logic. **Always available instantly.**

| Signal | Logic | Source Model |
|--------|-------|--------------|
| Risk level | `avg < 40% → high`, `< 55% → medium`, `else → low` | `TermResult` |
| Trend | Compare current vs previous term `averageScore` | `TermResult` (2 most recent) |
| Strengths | Top 3 subjects by score | `SubjectGrade` |
| Weaknesses | Bottom 3 subjects by score | `SubjectGrade` |
| Attendance rate | `present / total × 100` for current term | `StudentAttendance` |
| Attendance flag | `rate < 80%` → warning | `StudentAttendance` |
| Day-of-week pattern | Most-absent weekday | `StudentAttendance` |
| Fees status | `clear / partial / owing` | `Invoice` |
| Overdue count | Invoices past `dueDate` with outstanding balance | `Invoice` |
| Payment consistency | On-time vs late payment ratio | `Payment` + `Invoice` |
| CA vs Exam gap | Average CA score minus average Exam score | `SubjectGrade` |
| Class rank movement | Current position vs previous term position | `TermResult` |
| Behaviour incidents | Count and severity (when model exists) | Future `BehaviourIncident` |

### Tier 2: Cached AI Insights (~$0.001/student/term)

A single GPT-4o-mini call per student per academic period, stored in MongoDB.

- **Trigger:** Admin clicks "Generate AI Analysis" or triggers batch generation
- **Prompt:** Receives all Tier 1 data + raw subject scores, class averages, attendance records, fee history
- **Output:** Structured JSON with narrative summaries, actionable recommendations, and risk assessment
- **Storage:** `AIInsightCache` model (see Section 5)
- **TTL:** Valid for the entire academic period; manually refreshable

### Tier 3: Ask AI (~$0.003/query)

A conversational follow-up box at the bottom of the tab.

- **Context:** Sends the cached Tier 2 insights + Tier 1 data as system context
- **Input:** Free-text question from the user (e.g. "What specific exercises can help this student improve in English?")
- **Output:** Streaming text response
- **Rate limit:** Max 10 queries per student per day per school
- **Access:** Admin-only (generates new AI content)

---

## 3. Role-Based Access Control

| Capability | `school_admin` / `platform_admin` | `teacher` / other roles |
|---|---|---|
| View Tier 1 (rule-based) insights | Yes | Yes |
| View Tier 2 (cached AI) insights | Yes | Yes (read-only) |
| Trigger "Generate AI Analysis" | Yes | No (button hidden) |
| Trigger batch generation | Yes | No |
| Use "Ask AI" chat box | Yes | No (section hidden) |
| Refresh / regenerate insights | Yes | No |

Teachers and other staff see the full insights tab but with a read-only view. The "Generate" button and "Ask AI" input are not rendered for non-admin roles.

---

## 4. UI Layout

### 4.1 Tab Registration

- **Tab ID:** `"insights"`
- **Tab label:** `"AI Insights"`
- **Icon:** `Sparkles` (from lucide-react)
- **Color scheme:** `primary` / purple tones
- **Position:** After "Activity" tab (last tab)

### 4.2 Tab Content Structure

```
┌──────────────────────────────────────────────────────────────┐
│  ✨ AI Insights & Recommendations                            │
│  ──────────────────────────────────────────────────────────── │
│                                                               │
│  ┌── Health Scorecard (Tier 1, always visible) ────────────┐ │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────┐ │ │
│  │  │ 🟢 Risk    │ │ 📈 Trend   │ │ 📊 Attend  │ │ 💰   │ │ │
│  │  │ LOW        │ │ +4.2 pts   │ │ 92.4%      │ │ Clear│ │ │
│  │  └────────────┘ └────────────┘ └────────────┘ └──────┘ │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌── AI Summary (Tier 2, if generated) ────────────────────┐ │
│  │  "Joseph demonstrates consistent improvement across     │ │
│  │   core subjects. His Mathematics performance remains    │ │
│  │   excellent at 92%, while English requires focused      │ │
│  │   attention with a declining trend..."                  │ │
│  │                                                         │ │
│  │  [🔄 Regenerate]  Generated 3 days ago                  │ │
│  └─────────────────────────────────────────────────────────┘ │
│  (or [✨ Generate AI Analysis] button if not yet generated)   │
│                                                               │
│  ┌── Section Tabs ─────────────────────────────────────────┐ │
│  │  [Academic] [Attendance] [Financial] [Behaviour]        │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌── Active Section Content ───────────────────────────────┐ │
│  │                                                         │ │
│  │  (See Section 4.3 for each section's content)           │ │
│  │                                                         │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌── Recommended Actions ──────────────────────────────────┐ │
│  │  [For Student] [For Parent] [For Teacher]               │ │
│  │                                                         │ │
│  │  • Focus 30 minutes daily on English reading            │ │
│  │  • Practice past BECE questions for Mathematics         │ │
│  │  • Attend all Friday Science practical sessions         │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌── Ask AI (Admin only) ──────────────────────────────────┐ │
│  │  💬 "Ask a follow-up about this student..."    [Send]   │ │
│  │                                                         │ │
│  │  (Chat history for this session shown above input)      │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 4.3 Section Content Details

#### Academic Section (default active)

**Tier 1 (always shown):**
- Strengths table: top 3 subjects with scores, trend arrows, class average comparison
- Weaknesses table: bottom 3 subjects with scores, trend arrows, class average comparison
- CA vs Exam gap indicator
- Class rank badge with movement indicator (↑2, ↓1, →)
- Multi-term sparkline/mini chart (last 3 terms)

**Tier 2 (if AI generated):**
- Narrative analysis of academic patterns
- Subject-specific improvement suggestions
- Learning style observations

#### Attendance Section

**Tier 1 (always shown):**
- Attendance rate (%) with color coding: green ≥ 90%, amber 80-89%, red < 80%
- Total days: present / absent / late / excused
- Day-of-week heatmap (which days are most missed)
- Late arrival count and average late minutes
- Current-term vs previous-term comparison

**Tier 2 (if AI generated):**
- Pattern analysis (e.g. "Tends to miss Mondays after holidays")
- Correlation with academic performance
- Attendance improvement suggestions

#### Financial Section

**Tier 1 (always shown):**
- Total billed vs total paid (current term)
- Outstanding balance with status badge
- Payment timeline (on-time vs late markers)
- Overdue invoice count
- Historical payment consistency score (% on-time)

**Tier 2 (if AI generated):**
- Payment pattern observations
- Risk assessment for future defaults
- Suggested intervention timing

#### Behaviour Section

**Tier 1 (always shown):**
- If behaviour model exists: incident count, severity breakdown, trend
- If no model yet: "Behaviour tracking coming soon" placeholder with description
- Teacher comments summary (from `TeacherComment` model)

**Tier 2 (if AI generated):**
- Behavioural pattern analysis
- Correlation with attendance and academics
- Social-emotional observations

---

## 5. Data Models

### 5.1 New Model: `AIInsightCache`

```typescript
// src/models/AIInsightCache.ts
interface IAIInsightCache {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  studentId: Types.ObjectId;
  academicPeriodId: Types.ObjectId;

  // Tier 1 snapshot (rule-based, computed at generation time)
  ruleBased: {
    riskLevel: "low" | "medium" | "high";
    trend: "up" | "down" | "stable";
    trendDelta: number | null;
    attendanceRate: number | null;
    attendanceFlag: boolean;
    feesStatus: "clear" | "partial" | "owing" | null;
    overdueInvoices: number;
    strengths: Array<{ subject: string; score: number; classAvg: number | null }>;
    weaknesses: Array<{ subject: string; score: number; classAvg: number | null }>;
    caVsExamGap: number | null;
    classPosition: number | null;
    classSize: number | null;
    positionMovement: number | null; // positive = improved
  };

  // Tier 2 content (AI-generated)
  aiGenerated: {
    summary: string;
    riskLevel: "low" | "medium" | "high";
    academic: {
      narrative: string;
      strengths: Array<{ subject: string; reason: string; score: number }>;
      weaknesses: Array<{ subject: string; reason: string; score: number; trend: string }>;
      prioritySubjects: string[];
    };
    attendance: {
      narrative: string;
      patterns: string[];
      correlationWithGrades: string;
    };
    financial: {
      narrative: string;
      riskAssessment: string;
    };
    behaviour: {
      narrative: string;
      observations: string[];
    };
    recommendations: {
      student: string[];
      parent: string[];
      teacher: string[];
    };
    additionalInsights: {
      overallTrend: string;
      examVsCA: string;
      classComparison: string;
      learningStyle: string | null;
    };
  } | null; // null if only Tier 1 is available

  // Metadata
  generatedBy: Types.ObjectId; // User who triggered generation
  generatedAt: Date;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | null;
  modelUsed: string; // e.g. "gpt-4o-mini"

  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes:**
- `{ studentId: 1, academicPeriodId: 1 }` — unique compound (one cache per student per term)
- `{ schoolId: 1, academicPeriodId: 1 }` — for batch queries

### 5.2 Future Model: `BehaviourIncident` (placeholder)

Not created now. The behaviour section will show `TeacherComment` data and a "coming soon" notice for full behaviour tracking. The `AIInsightCache` schema is already designed to accommodate behaviour data when the model is introduced.

---

## 6. API Routes

### 6.1 `GET /api/admin/students/[id]/insights`

**Purpose:** Return combined Tier 1 + cached Tier 2 insights for a student.

**Auth:** Any authenticated school member (admin, teacher, etc.)

**Query params:**
- `periodId` (optional) — specific academic period; defaults to current

**Response:**
```json
{
  "success": true,
  "data": {
    "ruleBased": { ... },          // Always present (Tier 1)
    "aiGenerated": { ... } | null, // Present only if cached (Tier 2)
    "generatedAt": "ISO date" | null,
    "canGenerate": true | false,   // Based on user role
    "currentPeriodId": "...",
    "currentPeriodLabel": "2025/2026 – 2nd Term"
  }
}
```

**Logic:**
1. Compute Tier 1 `ruleBased` object fresh on every request (cheap DB queries)
2. Look up `AIInsightCache` for this student + period
3. If found, include `aiGenerated` + `generatedAt`
4. Set `canGenerate` based on calling user's role

### 6.2 `POST /api/admin/students/[id]/insights/generate`

**Purpose:** Trigger AI insight generation (Tier 2) for a single student.

**Auth:** `school_admin` or `platform_admin` only

**Body:**
```json
{
  "periodId": "optional, defaults to current"
}
```

**Response:**
```json
{
  "success": true,
  "data": { ... },      // Full AIInsightCache document
  "tokenUsage": { ... }
}
```

**Logic:**
1. Verify admin role
2. Compute Tier 1 data
3. Build comprehensive prompt with all data dimensions
4. Call GPT-4o-mini with `response_format: { type: "json_object" }`
5. Parse response, validate structure
6. Upsert into `AIInsightCache` (replace any existing cache for this student + period)
7. Return the full cached document

**Rate limit:** Max 5 regenerations per student per day (counted via `generatedAt` timestamps)

### 6.3 `POST /api/admin/students/[id]/insights/ask`

**Purpose:** Tier 3 follow-up chat.

**Auth:** `school_admin` or `platform_admin` only

**Body:**
```json
{
  "question": "What specific exercises can help improve English?",
  "periodId": "optional"
}
```

**Response:** Streamed text response (using `ReadableStream`)

**Logic:**
1. Verify admin role
2. Load cached `AIInsightCache` for context (or compute Tier 1 if no cache)
3. Build system message with student context + cached insights
4. Send user's question to GPT-4o-mini
5. Stream response back
6. Log token usage

**Rate limit:** Max 10 questions per student per day per school

### 6.4 `POST /api/admin/students/insights/batch-generate`

**Purpose:** Generate AI insights for multiple students at once.

**Auth:** `school_admin` or `platform_admin` only

**Body:**
```json
{
  "studentIds": ["id1", "id2", ...],  // Max 50 per batch
  "periodId": "optional",
  "gradeId": "optional",             // Alternative: generate for all students in a grade
  "classGroupId": "optional"         // Alternative: generate for all students in a class
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 35,
    "generated": 33,
    "failed": 2,
    "skipped": 0,
    "failures": [
      { "studentId": "...", "error": "No academic data" }
    ],
    "estimatedCost": "$0.035"
  }
}
```

**Logic:**
1. Resolve student list (from IDs, or query by grade/classGroup)
2. Cap at 50 students per request
3. Process sequentially with 200ms delay between calls (avoid rate limits)
4. For each student: compute Tier 1 → build prompt → call GPT → upsert cache
5. Track successes/failures
6. Return summary

---

## 7. AI Prompt Design

### System Message

```
You are an experienced Ghanaian education analyst. You provide structured insights
about student performance for school administrators and teachers. You understand the
Ghana Education Service (GES) curriculum, BECE preparation, and the Ghanaian school
system. Always be specific, actionable, and culturally appropriate. Respond with
valid JSON only.
```

### User Prompt Template

```
Analyze this student's holistic performance and provide structured insights.

STUDENT: {firstName} {lastName}
GRADE: {gradeName}
CLASS: {classGroupName}

── ACADEMIC PERFORMANCE ──
Overall Average: {overallAverage}%
Class Position: {classPosition} of {classSize}
Performance Tier: {performanceTier}
Trend: {trend} ({trendDelta} points vs last term)

Subject Scores:
{foreach subject}
- {subjectName}: {totalScore}% (Class avg: {classAvg}%, CA: {caScore}%, Exam: {examScore}%)
{end}

Term History:
{foreach term}
- {termLabel}: Student {avgScore}%, Class {classAvg}%
{end}

── ATTENDANCE (Current Term) ──
Rate: {attendanceRate}% ({presentDays}/{totalDays} days)
Absences: {absentDays} | Late: {lateDays} (avg {avgLateMinutes} min)
Most-missed day: {mostMissedDay}
Previous term rate: {prevAttendanceRate}%

── FINANCIAL STATUS ──
Current term billed: GHS {totalBilled}
Paid: GHS {totalPaid} | Outstanding: GHS {outstanding}
Status: {feesStatus}
Overdue invoices: {overdueCount}
Payment consistency: {onTimePercent}% on-time

── BEHAVIOUR ──
Teacher comments: {commentCount} this term
{foreach recentComment}
- "{commentText}" — {teacherName}, {date}
{end}

Provide your analysis in this exact JSON format:
{
  "summary": "2-3 sentence holistic overview",
  "riskLevel": "low|medium|high",
  "academic": {
    "narrative": "2-3 sentences on academic patterns",
    "strengths": [{ "subject": "...", "reason": "...", "score": N }],
    "weaknesses": [{ "subject": "...", "reason": "...", "score": N, "trend": "improving|declining|stable" }],
    "prioritySubjects": ["..."]
  },
  "attendance": {
    "narrative": "1-2 sentences on attendance patterns",
    "patterns": ["pattern1", "pattern2"],
    "correlationWithGrades": "1 sentence"
  },
  "financial": {
    "narrative": "1-2 sentences on payment patterns",
    "riskAssessment": "1 sentence"
  },
  "behaviour": {
    "narrative": "1-2 sentences",
    "observations": ["observation1"]
  },
  "recommendations": {
    "student": ["action1", "action2", "action3"],
    "parent": ["action1", "action2"],
    "teacher": ["action1", "action2"]
  },
  "additionalInsights": {
    "overallTrend": "1 sentence",
    "examVsCA": "1 sentence comparing CA and exam performance",
    "classComparison": "1 sentence",
    "learningStyle": "1 sentence observation or null"
  }
}
```

### Ask AI System Context (Tier 3)

```
You are helping a school administrator with follow-up questions about a specific student.
Here is the student's data and your previous analysis:

{cached AIInsightCache JSON}

Answer the administrator's question concisely and actionably.
Keep responses under 200 words. Be specific to this student's situation.
```

---

## 8. Cost Analysis

### Per-Student Costs

| Action | Input tokens (est.) | Output tokens (est.) | Cost (GPT-4o-mini) |
|--------|--------------------:|---------------------:|--------------------:|
| Tier 2 generation | ~1,200 | ~800 | ~$0.0003 |
| Tier 3 follow-up | ~1,500 | ~200 | ~$0.0003 |

### Scenario: School with 500 students

| Usage pattern | Monthly cost |
|---|---|
| Generate once per term (3 terms/year) | ~$0.15/month avg |
| + 2 follow-ups per student per term | ~$0.45/month avg |
| + Daily batch regen for at-risk students (50) | ~$0.45/month |
| **Total realistic estimate** | **~$1.05/month** |

### Cost Controls

1. **Cache-first:** Never re-call AI if a valid cache exists (unless admin explicitly regenerates)
2. **Rate limits:** 5 regenerations/student/day, 10 ask queries/student/day
3. **Batch caps:** Max 50 students per batch request
4. **Token tracking:** Every call logs `promptTokens` + `completionTokens` in the cache document
5. **Usage dashboard (future):** Per-school token usage visible to platform admins
6. **Kill switch:** If `OPENAI_API_KEY` is not set, the tab still works with Tier 1 only — zero degradation

---

## 9. Frontend Components

### New Files

| File | Purpose |
|---|---|
| `src/components/admin/students/detail/StudentInsightsTab.tsx` | Main tab component — orchestrates all sections |
| `src/components/admin/students/detail/insights/HealthScorecard.tsx` | Tier 1 metric cards (risk, trend, attendance, fees) |
| `src/components/admin/students/detail/insights/AISummaryCard.tsx` | Tier 2 AI narrative + generate button |
| `src/components/admin/students/detail/insights/AcademicSection.tsx` | Academic strengths/weaknesses/charts |
| `src/components/admin/students/detail/insights/AttendanceSection.tsx` | Attendance stats + day heatmap |
| `src/components/admin/students/detail/insights/FinancialSection.tsx` | Fee status + payment timeline |
| `src/components/admin/students/detail/insights/BehaviourSection.tsx` | Behaviour / teacher comments |
| `src/components/admin/students/detail/insights/RecommendationsCard.tsx` | Tabbed action recommendations |
| `src/components/admin/students/detail/insights/AskAIChat.tsx` | Tier 3 follow-up chat box |

### New Hooks

| File | Purpose |
|---|---|
| `src/hooks/admin/useStudentInsights.ts` | Fetch Tier 1 + cached Tier 2 insights |
| `src/hooks/admin/useGenerateInsights.ts` | Mutation hook for triggering AI generation |
| `src/hooks/admin/useAskAI.ts` | Mutation hook for Tier 3 chat with streaming |

### Modified Files

| File | Change |
|---|---|
| `src/hooks/admin/useStudentDetail.ts` | Add `"insights"` to `StudentDetailTabId` union |
| `src/components/admin/students/detail/StudentDetailTabs.tsx` | Add insights tab config to `TABS` array |
| `src/app/(app)/admin/students/[studentId]/page.tsx` | Add `StudentInsightsTab` rendering case |

---

## 10. Implementation Order

| Phase | Tasks | Estimate |
|---|---|---|
| **Phase 1** | `AIInsightCache` model + `buildStudentInsightsDTO` (Tier 1 rule engine) | Core data |
| **Phase 2** | `GET /insights` API route (serves Tier 1, reads cache for Tier 2) | API |
| **Phase 3** | `POST /insights/generate` API route (single student AI generation) | API |
| **Phase 4** | Frontend tab registration + `StudentInsightsTab` + `HealthScorecard` | UI |
| **Phase 5** | Section components (Academic, Attendance, Financial, Behaviour) | UI |
| **Phase 6** | `AISummaryCard` + `RecommendationsCard` + generate button with RBAC | UI |
| **Phase 7** | `POST /insights/ask` API route + `AskAIChat` component (streaming) | Tier 3 |
| **Phase 8** | `POST /insights/batch-generate` API route | Batch |
| **Phase 9** | Polish, animations, loading states, error boundaries | UX |

---

## 11. Migration Notes

- The existing `AIInsightsPanel.tsx` (inside Academics tab) can be **deprecated** once the new tab is live. It can either be removed or kept as a lightweight summary widget that links to the full Insights tab.
- The existing `useAIInsights.ts` hook and `/academics/ai-insights` API route remain functional and independent — no breaking changes.
- The new `AIInsightCache` model is additive — no existing collections are modified.

---

## 12. Future Enhancements (Out of Scope for V1)

- [ ] PDF export of AI insights (for parent-teacher conferences)
- [ ] Insight comparison across siblings (linked via `Guardian`)
- [ ] Class-wide / grade-wide aggregate insights dashboard
- [ ] Automated weekly digest emails to parents with key insights
- [ ] Behaviour incident model + full behaviour tracking integration
- [ ] Usage quota dashboard for platform admins
- [ ] Multi-language support for insights (Twi, Ewe, Ga, etc.)
