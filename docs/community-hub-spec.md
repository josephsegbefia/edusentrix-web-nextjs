# Community Hub (Polls + Fundraising) Implementation Spec

This document is for an AI engineer with no access to the codebase. It defines the complete structure, conventions, and UX expectations to build a world-class Polls + Fundraising feature inside the Edusentrix admin. Sidebar development is explicitly out of scope.

---

## 1) Product Naming and IA

Primary umbrella name: **Community Hub**  
Sub-pages: **Polls** and **Fundraising**

Notes:
- The umbrella name must feel institutional and premium. "Community Hub" matches the existing "Reports" and "Academic Periods" positioning.
- Sidebar integration is **not included** in this spec.

---

## 2) Goals and Non-Goals

### Goals
- Provide a premium, governance-grade workflow for school-wide polls and fundraising campaigns.
- Admins can create and manage school-wide campaigns end-to-end.
- Class-limited polls and fundraisers can be created by non-admins but must be admin-approved.
- Participation flows (vote/donate) should be mobile-first and low-friction.
- All actions are auditable and exportable.

### Non-Goals
- Sidebar/nav development (explicitly excluded).
- Parent/student portal UI (can be represented as shareable public routes or future work).

---

## 3) Conventions to Follow (Codebase Context)

- **App Router**: `src/app/(app)/admin/...` for admin pages, `src/app/api/admin/...` for admin APIs.
- **Mongoose Models**: `src/models/*.ts` with `interface` + schema + indexes + `timestamps`.
- **Auth**: Admin endpoints use `requireSchoolAdmin` (`src/lib/auth/requireSchoolAdmin.ts`).  
  Add `requireSchoolMember` for parent/teacher/student voting/donations (see section 6).
- **React Query**: Query hooks in `src/hooks/admin/*` with `useQuery` / `useMutation`.
- **Toasts**: Use `useBusyToast` (`src/hooks/useBusyToast.ts`) for all async actions.
- **Date inputs**: Use `CustomDatePicker` / `DateRangePicker` (`src/components/ui/custom-date-picker.tsx`).
- **Premium UI**: Cards, gradients, and modals follow the patterns used in:
  - `src/app/(app)/admin/reports/page.tsx`
  - `src/app/(app)/admin/periods/page.tsx`
  - `src/components/modals/CreateAcademicPeriodModal.tsx`

---

## 4) Role and Permission Matrix

Roles (via `UserMembership.roles`): `school_admin`, `bursar`, `teacher`, `parent`, `student`.

### Polls
- **school_admin**: create, edit, approve, publish, close, export, delete.
- **teacher/staff**: create class-limited polls (pending admin approval), view results for their scope.
- **parent/student**: vote (if included in audience), view results if allowed.

### Fundraising
- **school_admin**: create, edit, approve, publish, close, export, delete.
- **bursar**: approve payouts, see reconciliation details.
- **teacher/staff**: propose class-limited campaigns (pending admin approval).
- **parent**: donate (if included in audience).
- **student**: view campaigns, share links; donation optional based on policy.

---

## 5) Data Models (Mongoose)

### 5.1 CommunityPoll
**File**: `src/models/CommunityPoll.ts`

Fields:
- `schoolId: ObjectId`
- `title: string`
- `description?: string`
- `status: "draft" | "pending_approval" | "approved" | "live" | "closed" | "archived"`
- `approvalStatus: "not_required" | "pending" | "approved" | "rejected"`
- `approvalNotes?: string`
- `approvedBy?: ObjectId`
- `approvedAt?: Date`
- `createdBy: ObjectId`
- `createdByRole: "school_admin" | "teacher" | "staff"`
- `schedule: { startDate?: Date | null; endDate?: Date | null; timezone?: string }`
- `audience: { scope: "school" | "grade" | "class" | "staff" | "parents" | "students"; gradeIds?: ObjectId[]; classGroupIds?: ObjectId[]; roles?: string[] }`
- `questions: PollQuestion[]` (embedded subdocs, see below)
- `allowAnonymous: boolean`
- `allowComments: boolean`
- `revealResults: "live" | "after_close" | "admin_only"`
- `coverImageUrl?: string | null`
- `tags?: string[]`
- `totalVotes?: number`
- `eligibleCount?: number`
- `participationRate?: number`
- `createdAt`, `updatedAt`

Indexes:
- `{ schoolId: 1, status: 1 }`
- `{ schoolId: 1, createdAt: -1 }`
- `{ schoolId: 1, "audience.scope": 1 }`

### PollQuestion (embedded)
Fields:
- `_id: ObjectId`
- `prompt: string`
- `type: "single_choice" | "multi_choice" | "ranked_choice" | "likert" | "yes_no" | "comment"`
- `options?: PollOption[]`
- `required?: boolean`
- `allowOther?: boolean`
- `order: number`

### PollOption (embedded)
Fields:
- `_id: ObjectId`
- `label: string`
- `imageUrl?: string | null`
- `order: number`

### 5.2 CommunityPollVote
**File**: `src/models/CommunityPollVote.ts`

Fields:
- `pollId: ObjectId`
- `schoolId: ObjectId`
- `questionId: ObjectId`
- `optionIds: ObjectId[]` (or `optionId` for single)
- `comment?: string`
- `userId?: ObjectId | null`
- `role?: "parent" | "student" | "teacher" | "staff"`
- `householdId?: ObjectId | null` (use Guardian->user mapping for one-per-household)
- `voterHash?: string` (hash of userId or householdId)
- `ipHash?: string`
- `deviceFingerprint?: string`
- `createdAt`

Indexes:
- `{ pollId: 1, questionId: 1 }`
- Unique `{ pollId: 1, voterHash: 1 }` for one-per-person/household.

### 5.3 CommunityPollComment (optional)
**File**: `src/models/CommunityPollComment.ts`

Fields:
- `pollId`, `schoolId`, `userId?`, `isAnonymous`, `message`, `status: "pending" | "approved" | "rejected"`, timestamps.

### 5.4 FundraisingCampaign
**File**: `src/models/FundraisingCampaign.ts`

Fields:
- `schoolId: ObjectId`
- `title: string`
- `summary?: string`
- `description?: string`
- `category: "school_project" | "emergency" | "pta_drive" | "student_cause" | "other"`
- `status: "draft" | "pending_approval" | "approved" | "live" | "paused" | "closed" | "reconciled" | "archived"`
- `approvalStatus: "not_required" | "pending" | "approved" | "rejected"`
- `approvedBy?: ObjectId`
- `approvedAt?: Date`
- `createdBy: ObjectId`
- `createdByRole: "school_admin" | "teacher" | "staff"`
- `audience: { scope: "school" | "grade" | "class" | "parents" | "staff"; gradeIds?: ObjectId[]; classGroupIds?: ObjectId[] }`
- `goalAmountMinor: number`
- `currency: "GHS" | "USD" | "NGN" | ...`
- `raisedAmountMinor?: number`
- `donorCount?: number`
- `schedule: { startDate?: Date | null; endDate?: Date | null; timezone?: string }`
- `coverImageUrl?: string | null`
- `galleryUrls?: string[]`
- `documents?: string[]` (quotes, invoices, proof)
- `milestones?: Array<{ label: string; amountMinor: number; reachedAt?: Date | null }>`
- `matchingRules?: Array<{ matcherName: string; matchPercent: number; capMinor?: number }>`
- `isRecurringEnabled?: boolean`
- `tags?: string[]`
- `createdAt`, `updatedAt`

Indexes:
- `{ schoolId: 1, status: 1 }`
- `{ schoolId: 1, createdAt: -1 }`

### 5.5 FundraisingDonation
**File**: `src/models/FundraisingDonation.ts`

Fields:
- `campaignId: ObjectId`
- `schoolId: ObjectId`
- `amountMinor: number`
- `currency: string`
- `status: "pending" | "completed" | "failed" | "refunded"`
- `donorUserId?: ObjectId | null`
- `donorName?: string | null`
- `donorEmail?: string | null`
- `donorPhone?: string | null`
- `isAnonymous?: boolean`
- `message?: string`
- `paymentMethod: "cash" | "bank_transfer" | "mobile_money" | "paystack" | "cheque" | "other"`
- `gatewayReference?: string | null`
- `gatewayTransactionId?: string | null`
- `gatewayResponse?: object | null`
- `receiptNumber?: string | null`
- `refundedAt?: Date | null`
- `createdAt`, `updatedAt`

Indexes:
- `{ schoolId: 1, campaignId: 1 }`
- `{ schoolId: 1, status: 1 }`
- Unique `{ gatewayReference: 1 }` (sparse).

### 5.6 FundraisingCampaignUpdate
**File**: `src/models/FundraisingCampaignUpdate.ts`

Fields:
- `campaignId`, `schoolId`, `createdBy`, `title`, `body`, `attachments[]`, `createdAt`.

### 5.7 FundraisingPayout (optional but recommended)
**File**: `src/models/FundraisingPayout.ts`

Fields:
- `campaignId`, `schoolId`, `amountMinor`, `status: "pending" | "approved" | "rejected" | "paid"`
- `requestedBy`, `approvedBy`, `approvedAt`, `notes`, timestamps.

---

## 6) Auth and Access Helpers

Create `src/lib/auth/requireSchoolMember.ts`:
- Accepts `roles` array and returns `{ userId, schoolId, roles }`.
- Uses `UserMembership` with `status === "active"`.
- For public links (no auth), allow `token` access for polls/campaigns that are configured as public.

---

## 7) API Routes (Admin + Participation)

### Admin: Polls
`src/app/api/admin/community/polls/route.ts`
- `GET`: list polls with filters (status, scope, date range, createdBy).
- `POST`: create poll (admin only for school-wide; teachers/staff create class-only -> `approvalStatus: "pending"`).

`src/app/api/admin/community/polls/[id]/route.ts`
- `GET`: poll detail
- `PATCH`: edit (blocked if closed/hard-locked)

`src/app/api/admin/community/polls/[id]/publish/route.ts`
- `POST`: publish poll (requires approval if not admin)

`src/app/api/admin/community/polls/[id]/close/route.ts`
- `POST`: close poll

`src/app/api/admin/community/polls/[id]/approve/route.ts`
- `POST`: approve poll (admin only)

`src/app/api/admin/community/polls/[id]/reject/route.ts`
- `POST`: reject poll (admin only, include reason)

`src/app/api/admin/community/polls/[id]/results/route.ts`
- `GET`: aggregated results

`src/app/api/admin/community/polls/[id]/export/route.ts`
- `POST`: enqueue export (CSV/PDF) using `ReportExport` pattern.

### Admin: Fundraising
`src/app/api/admin/community/fundraising/route.ts`
- `GET`: list campaigns
- `POST`: create campaign (admin only for school-wide; class-limited requires approval)

`src/app/api/admin/community/fundraising/[id]/route.ts`
- `GET`: campaign detail
- `PATCH`: edit

`src/app/api/admin/community/fundraising/[id]/publish/route.ts`
- `POST`: publish

`src/app/api/admin/community/fundraising/[id]/close/route.ts`
- `POST`: close (sets `endDate` to now if needed)

`src/app/api/admin/community/fundraising/[id]/approve/route.ts`
- `POST`: approve campaign

`src/app/api/admin/community/fundraising/[id]/reject/route.ts`
- `POST`: reject campaign

`src/app/api/admin/community/fundraising/[id]/donations/route.ts`
- `GET`: list donations (filter by status, date)

`src/app/api/admin/community/fundraising/[id]/export/route.ts`
- `POST`: export donations/summary

### Participation (Parent/Staff)
`src/app/api/community/polls/[id]/route.ts`
- `GET`: poll details for voting (guarded by membership or token)

`src/app/api/community/polls/[id]/vote/route.ts`
- `POST`: submit vote (enforce unique vote)

`src/app/api/community/fundraising/[id]/route.ts`
- `GET`: campaign details (public/guarded)

`src/app/api/community/fundraising/[id]/donate/route.ts`
- `POST`: create donation intent + return payment URL (Paystack) or record cash/offline if admin.

---

## 8) Hooks (React Query)

Pattern: `src/hooks/admin/useCommunityPolls.ts`, `useFundraisingCampaigns.ts`, etc.

Suggested hooks:
- `useCommunityPolls`, `useCommunityPoll`, `useCreatePoll`, `useUpdatePoll`, `useApprovePoll`, `usePublishPoll`, `useClosePoll`, `usePollResults`, `usePollComments`.
- `useFundraisingCampaigns`, `useFundraisingCampaign`, `useCreateCampaign`, `useUpdateCampaign`, `useApproveCampaign`, `usePublishCampaign`, `useCloseCampaign`, `useCampaignDonations`, `useCreateDonation`.

Conventions:
- Use `useQuery` with `cache: "no-store"`.
- Use `useBusyToast` to wrap mutations with pending overlays.
- Invalidate queries by key on success (see `useAcademicPeriods` and `useReports` patterns).

---

## 9) Admin UI Pages and Components

### Pages (admin)
- `src/app/(app)/admin/community/page.tsx`  
  "Community Hub" dashboard: active polls, active campaigns, approvals needed, quick actions, recent exports.

- `src/app/(app)/admin/community/polls/page.tsx`  
  Polls list, filters, create button.

- `src/app/(app)/admin/community/polls/[id]/page.tsx`  
  Poll detail: participation stats, results charts, comments moderation, timeline.

- `src/app/(app)/admin/community/fundraising/page.tsx`  
  Campaign list, goal progress, status filter.

- `src/app/(app)/admin/community/fundraising/[id]/page.tsx`  
  Campaign detail: goal progress, donations table, updates, payout status.

### Component Library (suggested)
`src/components/community/...`

- `CommunityHubStatsCard`
- `CommunityNeedsAttentionPanel`
- `PollCard`
- `CampaignCard`
- `PollResultsChart` (Recharts or SimpleBarChart pattern)
- `DonationProgressRing`
- `PollAudiencePill`
- `CampaignMilestones`
- `CampaignDonationsTable`
- `PollCommentsModerationPanel`
- `RecentExportsPanel` (reuse `ReportExport` pattern from Reports page)

### Modal Components (premium style)
Follow `CreateAcademicPeriodModal` styling:
- `CreatePollModal`, `EditPollModal`
- `ApprovePollModal`, `RejectPollModal`
- `ClosePollModal`, `PublishPollModal`
- `CreateCampaignModal`, `EditCampaignModal`
- `ApproveCampaignModal`, `RejectCampaignModal`
- `CloseCampaignModal`, `RecordOfflineDonationModal`

Use `CustomDatePicker` for start/end date scheduling and `Select` with `premiumSelectContent`.

---

## 10) UI/UX Expectations (Premium)

- Cards should use gradient overlays (`bg-linear-to-br from-white/5 to-transparent`) and soft glow accent like `reports` and `periods` pages.
- Status badges should follow the chip style in `reports` and `periods`.
- Page layout: hero header, KPI row, chart row, list row.
- Use `Skeleton` components for loading states.
- Use `useBusyToast` for all async actions.
- All modals use the existing premium modal pattern with `framer-motion` and dark overlay.

---

## 11) Analytics and Reporting

### Polls
Track and render:
- participation rate by grade/class/role
- vote distribution by question
- drop-off (opened poll but did not submit) if tracking view events

### Fundraising
Track and render:
- total raised vs goal
- donor count, average donation
- conversion: visits -> donations (if tracking views)
- payout pipeline status

### Exports
Reuse `ReportExport` for CSV/PDF:
- `reportKey` values: `community.polls.results`, `community.fundraising.donations`.
- Recent exports panel shows status and download link (match Reports page pattern).

---

## 12) Audit and Activity Logging

Extend `ActivityType` (`src/models/Activity.ts`) with:
- `poll.created`, `poll.published`, `poll.closed`, `poll.approved`, `poll.rejected`
- `campaign.created`, `campaign.published`, `campaign.closed`, `campaign.approved`, `campaign.rejected`
- `donation.received`, `donation.refunded`, `payout.approved`

Use `recordActivity` (`src/lib/audit/recordActivity.ts`) in API routes.

---

## 13) Metrics Integration (Dashboard-ready)

Extend:
- `src/app/api/admin/metrics/route.ts` with `community` counts:
  - `pollsActive`, `pollsPendingApproval`, `campaignsActive`, `donationsTotalMinor`.
- `src/app/api/admin/metrics/stream/route.ts` to emit `community.updated` when polls/campaigns/donations change.

Do **not** implement sidebar changes in this build.

---

## 14) Validation Rules (Zod)

Follow existing Zod patterns:
- Trim strings, validate required fields, ensure `endDate >= startDate`.
- Poll question types enforce correct option counts (e.g., ranked choice needs >= 3 options).
- Campaign goal amount must be positive.
- Campaign schedule cannot end before start.

---

## 15) Participation Rules (Anti-abuse)

Minimum v1:
- One vote per user or per household (configurable).
- Store `voterHash` and enforce unique index.
- Rate limit votes and donations by IP (basic in API).

Recommended:
- Device fingerprint + suspicious pattern warnings in admin.
- Quorum rules for polls (optional field on poll).

---

## 16) Payment Integration Notes (Fundraising)

Use `lib/paystack.ts` conventions and school Paystack subaccount:
- Create donation intent, return Paystack authorization URL.
- Webhook handler (future): update `FundraisingDonation.status` and increment campaign totals.
- Provide receipt number generation (similar to fees payments).

---

## 17) Suggested File Map (Summary)

Models:
- `src/models/CommunityPoll.ts`
- `src/models/CommunityPollVote.ts`
- `src/models/CommunityPollComment.ts` (optional)
- `src/models/FundraisingCampaign.ts`
- `src/models/FundraisingDonation.ts`
- `src/models/FundraisingCampaignUpdate.ts`
- `src/models/FundraisingPayout.ts` (optional)

API:
- `src/app/api/admin/community/polls/*`
- `src/app/api/admin/community/fundraising/*`
- `src/app/api/community/polls/*`
- `src/app/api/community/fundraising/*`

Hooks:
- `src/hooks/admin/useCommunityPolls.ts`
- `src/hooks/admin/useFundraisingCampaigns.ts`

Pages:
- `src/app/(app)/admin/community/page.tsx`
- `src/app/(app)/admin/community/polls/page.tsx`
- `src/app/(app)/admin/community/polls/[id]/page.tsx`
- `src/app/(app)/admin/community/fundraising/page.tsx`
- `src/app/(app)/admin/community/fundraising/[id]/page.tsx`

Components:
- `src/components/community/*`
- `src/components/modals/*` (poll/campaign modals)

---

## 18) Implementation Notes

- Keep all UI consistent with the premium patterns already used in `reports` and `periods`.
- Use `CustomDatePicker` and `Select` for all date and scope inputs.
- Use `useBusyToast` for async actions.
- Ensure "admin-only for school-wide" and "admin approval for class-limited" are enforced at API level.
- Sidebar development is explicitly excluded.

