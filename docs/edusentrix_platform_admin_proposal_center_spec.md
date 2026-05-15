# EduSentrix Platform Admin Proposal Center — Product & Technical Specification

## 1. Purpose

EduSentrix needs a professional in-app proposal system inside the Platform Admin dashboard. Schools are asking for formal proposals after visits, so the platform should allow EduSentrix staff to create, brand, preview, export, email, and track proposals directly from the admin system.

This feature should make EduSentrix look serious, organized, and enterprise-ready. It should not be a simple PDF upload feature. It should become the first part of an internal Growth Center that supports school acquisition, demos, pilots, and onboarding.

## 2. Product Vision

The long-term vision is:

```txt
Lead captured → School visited → Proposal generated → Proposal sent → Follow-up tracked → Demo scheduled → Pilot started → School converted → Onboarding begins
```

The Proposal Center should help EduSentrix present itself as a complete digital school operating system, not just a basic school management app.

Every proposal should clearly communicate that EduSentrix includes:

- Web platform for school administrators, bursars, and staff
- Companion mobile app for teachers, parents, students, and administrators
- Student records and parent/guardian management
- Fees, invoices, payments, balances, and bursar workflows
- Teachers, subjects, grades, and class group management
- Timetables and scheduling with conflict prevention
- Attendance tracking
- Lesson notes and academic planning
- Notices and announcements
- Reports and analytics
- AI-powered school assistant
- In-app video meetings
- Role-based access and security
- Support, training, and pilot onboarding

## 3. Business Goals

The feature should:

1. Help EduSentrix send polished proposals quickly.
2. Reduce manual proposal writing and formatting work.
3. Keep proposal structure, branding, and language consistent.
4. Allow school-specific customization.
5. Track which schools have received proposals.
6. Support follow-up and demo conversion.
7. Prepare the foundation for AI-assisted proposal generation.
8. Make the Platform Admin useful for sales and onboarding, not only technical administration.

## 3.1 Tightened Product Decisions

The Proposal Center must be built as the first usable surface of a Growth Center, not as a detached document generator.

1. Proposals may be manually created or linked to existing records: `schoolId`, `leadId`, `applicationId`, and `source`.
2. Proposal sending must reuse the existing EduSentrix email stack, `EmailMessage` records, and provider tracking.
3. The proposal detail page is the operational center: status, recipient, pricing, PDF freshness, follow-up state, send logs, and activity.
4. Structured pricing is part of V1: currency, setup fee, recurring fee, cadence, student range, discount note, and payment terms.
5. Version and stale-PDF tracking are part of V1: `version`, `contentHash`, `lastGeneratedAt`, `lastGeneratedVersion`, and `lastSentVersion`.
6. Public links must be controllable with expiry, revocation, view count, and last viewed time.
7. Ownership and collaboration are modeled early: owner, assignee, collaborators, and visibility.
8. The editor should use a section navigator, central editor, and collapsible preview/inspector instead of a cramped permanent three-column layout.

## 4. Core Users

Primary users:

- Platform Super Admin
- Platform Admin
- Founder/CEO
- Growth/Sales Admin
- Implementation/Admin Staff

Suggested permissions:

```txt
platform.proposals.read
platform.proposals.create
platform.proposals.update
platform.proposals.archive
platform.proposals.generatePdf
platform.proposals.send
platform.proposals.manageTemplates
platform.proposals.manageBranding
platform.proposals.manageFollowUps
```

## 5. Navigation

Recommended Platform Admin navigation:

```txt
Platform Admin
  └── Growth Center
        ├── Leads
        ├── Schools
        ├── Proposals
        ├── Demos
        ├── Follow-ups
        └── Pilot Onboarding
```

MVP navigation:

```txt
Platform Admin
  └── Proposals
        ├── All Proposals
        ├── New Proposal
        ├── Templates
        └── Branding Settings
```

Recommended routes:

```txt
/platform/proposals
/platform/proposals/new
/platform/proposals/[proposalId]
/platform/proposals/[proposalId]/edit
/platform/proposals/[proposalId]/preview
/platform/proposals/templates
/platform/proposals/templates/[templateId]/edit
/platform/proposals/branding
```

Optional public route:

```txt
/proposals/view/[publicToken]
```

## 6. Feature Scope

### Version 1 Scope

Version 1 should include:

- Proposal list
- Create proposal
- Proposal templates
- Proposal section editor
- EduSentrix branded proposal preview
- PDF generation
- PDF download
- Send proposal by email
- Email send logs
- Proposal status tracking
- Basic follow-up tracking
- Branding settings
- Default full school proposal template

### Version 2 Scope

Version 2 can include:

- AI proposal generation
- AI section rewrite
- AI-generated email body
- AI-generated follow-up WhatsApp message
- Proposal open tracking
- Lead management
- Demo scheduling
- Pricing table builder
- Proposal version history
- Multiple branded themes
- Attach flyers/brochures

## 7. Proposal List Page

Route:

```txt
/platform/proposals
```

The proposal list should show all proposals in a searchable, filterable table.

Columns:

- School name
- Recipient name/title
- Recipient email
- Proposal type
- Status
- Prepared by
- Created date
- Last updated
- Sent date
- Next follow-up date
- Actions

Filters:

- Status
- Proposal type
- Sent/unsent
- Date range
- Prepared by

Actions:

- View
- Edit
- Preview
- Generate PDF
- Download PDF
- Send
- Duplicate
- Archive

Empty state:

```txt
No proposals yet.
Create your first branded EduSentrix proposal for a school.
```

## 8. Create Proposal Flow

Route:

```txt
/platform/proposals/new
```

Fields:

```ts
schoolName: string;
schoolLocation?: string;
recipientName?: string;
recipientTitle?: string;
recipientEmail?: string;
recipientPhone?: string;
proposalType: "general" | "pilot" | "full_implementation" | "pricing" | "demo_follow_up";
templateId: string;
selectedModules: string[];
pilotDuration?: string;
preparedBy: string;
internalNotes?: string;
```

Proposal types:

```txt
General School Proposal
Pilot Proposal
Full Implementation Proposal
Pricing Proposal
Demo Follow-up Proposal
```

Selectable modules to emphasize:

```txt
Web Admin Dashboard
Companion Mobile App
Student Records
Parent & Guardian Management
Fees, Invoices & Payments
Bursar Workflows
Teacher Management
Subjects, Grades & Class Groups
Smart Timetables & Scheduling
Attendance
Lesson Notes & Academic Planning
Notices & Communication
Reports & Analytics
AI Assistant
In-App Video Meetings
Role-Based Access
Security & Data Protection
Support & Training
```

After submission:

1. Load selected template.
2. Replace placeholders with school details.
3. Enable or prioritize relevant sections based on selected modules.
4. Create proposal as draft.
5. Redirect to editor.

## 9. Proposal Editor

Route:

```txt
/platform/proposals/[proposalId]/edit
```

Recommended layout:

```txt
------------------------------------------------------
| Section List | Section Editor | Live Preview       |
------------------------------------------------------
```

Each proposal should be built from ordered sections.

Section fields:

```ts
key: string;
title: string;
subtitle?: string;
content: string;
order: number;
enabled: boolean;
displayStyle?: "standard" | "highlight" | "cards" | "table" | "callout";
pageBreakBefore?: boolean;
pageBreakAfter?: boolean;
```

Editor actions:

- Edit section title
- Edit section content
- Enable/disable section
- Reorder sections
- Add section
- Duplicate section
- Delete section
- Save draft
- Preview proposal
- Generate PDF
- Send proposal

Editor requirements:

- Autosave changes every 10–20 seconds.
- Show save state: Saving, Saved, Unsaved Changes, Error.
- Use a rich text editor or structured Markdown editor.
- Prevent raw unsafe scripts in content.

## 10. Proposal Preview

Route:

```txt
/platform/proposals/[proposalId]/preview
```

The preview must look close to the final PDF.

It should include:

- Cover page
- EduSentrix letterhead
- School name
- Prepared by
- Date
- Section headings
- Cards/callouts where appropriate
- Footer
- Contact page
- Page breaks

Buttons:

```txt
Back to Edit
Generate PDF
Download PDF
Send Proposal
```

## 11. Proposal Branding

Route:

```txt
/platform/proposals/branding
```

Brand settings:

```ts
brandName: string;
tagline: string;
logoUrl: string;
letterheadLogoUrl?: string;
primaryColor: string;
secondaryColor: string;
accentColor?: string;
website: string;
contactEmail: string;
whatsapp: string;
address?: string;
footerText: string;
letterheadEnabled: boolean;
watermarkEnabled?: boolean;
```

Default values:

```txt
Brand: EduSentrix
Tagline: Modern School Management Platform
Website: https://www.tryedusentrix.app
Email: joseph.segbefia@tryedusentrix.app
WhatsApp: 0504211501
Footer: EduSentrix — School management made simpler, clearer and smarter.
Primary Color: #6D28D9
Secondary Color: #06B6D4
Accent Color: #0EA5E9
```

Proposal visual style:

- A4 portrait PDF
- Clean white background
- Deep navy text
- Purple/cyan brand accents
- Professional cover page
- Large EduSentrix logo
- Section dividers
- Premium cards and callouts
- Footer with website and contact
- Page numbers where possible

## 12. Default Proposal Template

Create one default template called:

```txt
EduSentrix Full School Proposal
```

Default sections:

1. Cover Page
2. Executive Summary
3. The Challenge Schools Face
4. Proposed Solution
5. EduSentrix Web Platform
6. Companion Mobile App
7. Student Records
8. Parent & Guardian Management
9. Fees, Invoices & Payments
10. Teachers, Subjects & Class Groups
11. Smart Timetables & Scheduling
12. Attendance Management
13. Lesson Notes & Academic Planning
14. Notices & Communication
15. Reports & Analytics
16. AI-Powered School Assistant
17. In-App Video Meetings
18. Role-Based Access & Security
19. Benefits to the School
20. Implementation Approach
21. Pilot Arrangement
22. Support & Training
23. Pricing Note
24. Why EduSentrix Is Different
25. Recommended Next Step
26. Contact Page

## 13. Placeholder System

Templates should support placeholders.

Supported placeholders:

```txt
{{schoolName}}
{{schoolLocation}}
{{recipientName}}
{{recipientTitle}}
{{recipientEmail}}
{{proposalDate}}
{{preparedBy}}
{{website}}
{{email}}
{{whatsapp}}
{{pilotDuration}}
{{selectedModules}}
```

Example:

```txt
This proposal is submitted to introduce EduSentrix to {{schoolName}} and request an opportunity to demonstrate how the platform can support the school’s operations.
```

Function:

```ts
export function replaceProposalPlaceholders(
  content: string,
  variables: Record<string, string>
): string {
  return content.replace(/\{\{(.*?)\}\}/g, (_, key) => {
    const normalizedKey = String(key).trim();
    return variables[normalizedKey] ?? "";
  });
}
```

## 14. PDF Generation

Recommended approach:

```txt
HTML proposal renderer → Playwright → PDF
```

Reason: HTML/CSS gives the best control over letterhead, styling, cards, gradients, spacing, and page breaks.

PDF generation flow:

1. Fetch proposal.
2. Fetch brand settings.
3. Render proposal as full HTML.
4. Generate PDF with Playwright.
5. Store generated PDF.
6. Save `pdfUrl` and `pdfStorageKey` on proposal.
7. Mark proposal as `ready` if it was still draft.
8. Log `pdf_generated` activity.

PDF requirements:

- A4 portrait
- Print background enabled
- Cover page
- Branded footer
- Clear spacing
- Proper section headings
- Professional typography
- Contact page

Example function:

```ts
import { chromium } from "playwright";

export async function generateProposalPdfFromHtml(html: string) {
  const browser = await chromium.launch({ headless: true });

  const page = await browser.newPage({
    viewport: { width: 1240, height: 1754 },
  });

  await page.setContent(html, { waitUntil: "networkidle" });

  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: {
      top: "16mm",
      right: "14mm",
      bottom: "16mm",
      left: "14mm",
    },
  });

  await browser.close();
  return pdfBuffer;
}
```

Deployment note:

Playwright may be heavy on serverless hosting. For production reliability, consider a separate PDF worker on Render/Fly or a hosted browser service.

## 15. Email Sending

The admin should send proposals directly from the Platform Admin.

Send modal fields:

```ts
to: string;
cc?: string[];
bcc?: string[];
subject: string;
bodyHtml: string;
attachPdf: boolean;
includePublicLink: boolean;
```

Default subject:

```txt
Proposal for the Introduction of EduSentrix to {{schoolName}}
```

Default email body:

```txt
Dear {{recipientTitleOrName}},

Please find attached a proposal introducing EduSentrix, a modern school management platform designed to help {{schoolName}} manage student records, fees, timetables, attendance, communication, reports, AI-assisted administration, mobile access, and in-app video meetings.

We would be grateful for the opportunity to schedule a short demo at your convenience.

Kind regards,
Joseph Segbefia
EduSentrix
Website: https://www.tryedusentrix.app
WhatsApp: 0504211501
Email: joseph.segbefia@tryedusentrix.app
```

Email behavior:

1. Validate recipient email.
2. Ensure a PDF exists.
3. Regenerate PDF if proposal has changed since last generation.
4. Send email with PDF attachment.
5. Include public link if enabled.
6. Save send log.
7. Update proposal status to `sent`.
8. Save `sentAt` and `sentBy`.
9. Add proposal activity entry.

Recommended email providers:

- Resend
- Brevo
- Postmark
- SendGrid

Use a provider-agnostic wrapper:

```ts
type SendEmailInput = {
  to: string;
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  attachments?: {
    filename: string;
    content?: Buffer;
    path?: string;
    contentType?: string;
  }[];
};
```

## 16. Proposal Status Pipeline

Statuses:

```ts
type ProposalStatus =
  | "draft"
  | "ready"
  | "sent"
  | "followed_up"
  | "demo_scheduled"
  | "pilot_started"
  | "accepted"
  | "rejected"
  | "archived";
```

Pipeline:

```txt
Draft → Ready → Sent → Followed Up → Demo Scheduled → Pilot Started → Accepted
                                               └──────────────→ Rejected
```

Rules:

- New proposals start as `draft`.
- After PDF generation, proposal can become `ready`.
- After sending, proposal becomes `sent`.
- Admin can manually update follow-up/demo/pilot statuses.
- Accepted/rejected proposals should be locked from accidental edits unless duplicated.

## 17. Follow-Up Tracking

Fields:

```ts
nextFollowUpDate?: Date;
followUpNotes?: string;
lastFollowedUpAt?: Date;
```

Actions:

- Add follow-up note
- Set next follow-up date
- Mark as followed up
- Mark demo scheduled
- Mark pilot started
- Mark accepted
- Mark rejected

Later, Platform Admin dashboard should show:

- proposals needing follow-up today,
- proposals sent but not followed up,
- proposals with demos scheduled,
- proposals that have converted to pilots.

## 18. Data Models

### 18.1 BrandSettings

```ts
type BrandSettings = {
  _id: string;
  brandName: string;
  tagline?: string;
  logoUrl: string;
  letterheadLogoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor?: string;
  website: string;
  contactEmail: string;
  whatsapp: string;
  address?: string;
  footerText?: string;
  letterheadEnabled: boolean;
  watermarkEnabled?: boolean;
  createdAt: Date;
  updatedAt: Date;
};
```

### 18.2 ProposalTemplate

```ts
type ProposalTemplate = {
  _id: string;
  name: string;
  type: "general" | "pilot" | "full_implementation" | "pricing" | "demo_follow_up";
  description?: string;
  sections: ProposalTemplateSection[];
  isDefault: boolean;
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
};

type ProposalTemplateSection = {
  key: string;
  title: string;
  subtitle?: string;
  content: string;
  order: number;
  enabled: boolean;
  displayStyle?: "standard" | "highlight" | "cards" | "table" | "callout";
};
```

### 18.3 Proposal

```ts
type Proposal = {
  _id: string;
  schoolName: string;
  schoolLocation?: string;

  recipientName?: string;
  recipientTitle?: string;
  recipientEmail?: string;
  recipientPhone?: string;

  templateId?: string;
  title: string;
  proposalType: "general" | "pilot" | "full_implementation" | "pricing" | "demo_follow_up";

  selectedModules: string[];
  sections: ProposalSection[];

  status: ProposalStatus;

  pdfUrl?: string;
  pdfStorageKey?: string;
  publicToken?: string;
  publicViewEnabled: boolean;
  publicViewUrl?: string;

  preparedByName: string;
  preparedByUserId?: string;

  sentAt?: Date;
  sentBy?: string;

  nextFollowUpDate?: Date;
  followUpNotes?: string;
  lastFollowedUpAt?: Date;
  internalNotes?: string;

  createdAt: Date;
  updatedAt: Date;
};
```

### 18.4 ProposalSendLog

```ts
type ProposalSendLog = {
  _id: string;
  proposalId: string;
  recipientEmail: string;
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyHtml: string;
  attachmentUrl?: string;
  publicViewUrl?: string;
  status: "queued" | "sent" | "failed";
  providerMessageId?: string;
  errorMessage?: string;
  sentBy: string;
  sentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};
```

### 18.5 ProposalActivity

```ts
type ProposalActivity = {
  _id: string;
  proposalId: string;
  action:
    | "created"
    | "updated"
    | "pdf_generated"
    | "sent"
    | "status_changed"
    | "follow_up_added"
    | "archived"
    | "duplicated";
  message: string;
  metadata?: Record<string, unknown>;
  actorId?: string;
  createdAt: Date;
};
```

## 19. API Routes

Proposal routes:

```txt
GET    /api/platform/proposals
POST   /api/platform/proposals
GET    /api/platform/proposals/[proposalId]
PATCH  /api/platform/proposals/[proposalId]
DELETE /api/platform/proposals/[proposalId]
POST   /api/platform/proposals/[proposalId]/duplicate
POST   /api/platform/proposals/[proposalId]/generate-pdf
POST   /api/platform/proposals/[proposalId]/send
POST   /api/platform/proposals/[proposalId]/send-test
POST   /api/platform/proposals/[proposalId]/status
POST   /api/platform/proposals/[proposalId]/follow-up
GET    /api/platform/proposals/[proposalId]/activity
```

Template routes:

```txt
GET    /api/platform/proposal-templates
POST   /api/platform/proposal-templates
GET    /api/platform/proposal-templates/[templateId]
PATCH  /api/platform/proposal-templates/[templateId]
DELETE /api/platform/proposal-templates/[templateId]
POST   /api/platform/proposal-templates/[templateId]/duplicate
POST   /api/platform/proposal-templates/[templateId]/set-default
```

Branding routes:

```txt
GET   /api/platform/proposal-branding
PATCH /api/platform/proposal-branding
```

Public proposal route:

```txt
GET /api/public/proposals/[publicToken]
```

## 20. Suggested Folder Structure

```txt
src/
  app/
    platform/
      proposals/
        page.tsx
        new/page.tsx
        [proposalId]/page.tsx
        [proposalId]/edit/page.tsx
        [proposalId]/preview/page.tsx
      proposal-templates/
      proposal-branding/
    api/
      platform/
        proposals/
        proposal-templates/
        proposal-branding/
  components/
    platform/
      proposals/
        ProposalListTable.tsx
        ProposalCreateForm.tsx
        ProposalEditor.tsx
        ProposalPreview.tsx
        ProposalSectionEditor.tsx
        ProposalSendModal.tsx
        ProposalStatusBadge.tsx
        ProposalActivityTimeline.tsx
        ProposalTemplateSelector.tsx
  lib/
    proposals/
      renderProposalHtml.ts
      replaceProposalPlaceholders.ts
      generateProposalPdf.ts
      sendProposalEmail.ts
      proposalDefaults.ts
      proposalPermissions.ts
      proposalStatus.ts
      proposalValidators.ts
  models/
    Proposal.ts
    ProposalTemplate.ts
    ProposalSendLog.ts
    ProposalActivity.ts
    BrandSettings.ts
```

## 21. Validation

Use Zod for validation.

Create proposal schema:

```ts
import { z } from "zod";

export const createProposalSchema = z.object({
  schoolName: z.string().min(2),
  schoolLocation: z.string().optional(),
  recipientName: z.string().optional(),
  recipientTitle: z.string().optional(),
  recipientEmail: z.string().email().optional(),
  recipientPhone: z.string().optional(),
  proposalType: z.enum([
    "general",
    "pilot",
    "full_implementation",
    "pricing",
    "demo_follow_up",
  ]),
  templateId: z.string().optional(),
  selectedModules: z.array(z.string()).default([]),
  pilotDuration: z.string().optional(),
  notes: z.string().optional(),
});
```

Send proposal schema:

```ts
export const sendProposalSchema = z.object({
  to: z.string().email(),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  subject: z.string().min(3),
  bodyHtml: z.string().min(10),
  attachPdf: z.boolean().default(true),
  includePublicLink: z.boolean().default(false),
});
```

## 22. Security Requirements

1. All proposal admin routes must require platform authentication.
2. Every write/send/PDF action must check permissions.
3. Public proposal links must use unguessable tokens.
4. Public proposal pages must not expose internal notes, logs, or user IDs.
5. Proposal HTML must be sanitized.
6. Email recipients must be validated.
7. All sends must be logged.
8. Proposal deletion should be restricted or replaced with archive.
9. Accepted/rejected proposals should not be accidentally edited.
10. Audit/activity logs must be maintained.

## 23. Environment Variables

```env
EMAIL_PROVIDER=resend
EMAIL_FROM="EduSentrix <proposals@tryedusentrix.app>"
RESEND_API_KEY=

PROPOSAL_PUBLIC_BASE_URL=https://www.tryedusentrix.app
PROPOSAL_STORAGE_PROVIDER=local
PROPOSAL_PDF_WORKER_URL=
ENABLE_PUBLIC_PROPOSAL_LINKS=true
```

If using Brevo:

```env
EMAIL_PROVIDER=brevo
BREVO_API_KEY=
EMAIL_FROM="EduSentrix <proposals@tryedusentrix.app>"
```

## 24. AI Proposal Assistant — Future Phase

AI actions:

```txt
Generate Proposal
Rewrite Section
Make More Professional
Shorten Section
Emphasize Fees
Emphasize Mobile App
Emphasize AI Features
Emphasize Video Meetings
Generate Email Body
Generate Follow-Up WhatsApp Message
Generate Demo Agenda
```

AI input:

```ts
{
  schoolName: string;
  schoolType?: string;
  schoolLocation?: string;
  modulesToEmphasize: string[];
  tone: "formal" | "warm" | "executive" | "simple";
  proposalType: string;
  notesFromVisit?: string;
}
```

AI content must be inserted as an editable draft, not sent automatically.

Show warning:

```txt
AI-generated draft. Please review before sending.
```

## 25. Implementation Phases

### Phase 1 — Foundation

Deliver:

- Proposal model
- ProposalTemplate model
- BrandSettings model
- ProposalSendLog model
- ProposalActivity model
- Default template seed
- Placeholder replacement utility

Acceptance:

- Admin can create a proposal from a default template.
- Proposal sections are stored correctly.
- Placeholders are replaced correctly.

### Phase 2 — Proposal UI

Deliver:

- Proposal list page
- Create proposal page
- Proposal editor
- Section reorder
- Enable/disable sections
- Autosave
- Status badges

Acceptance:

- Admin can create, edit, and save a school-specific proposal.

### Phase 3 — Branded Preview and PDF

Deliver:

- HTML proposal renderer
- Cover page
- Letterhead/footer
- Preview page
- PDF generation endpoint
- PDF download

Acceptance:

- PDF looks professional and matches preview closely.

### Phase 4 — Email Sending

Deliver:

- Send proposal modal
- Email provider wrapper
- PDF attachment support
- Test email
- Send logs
- Status update to sent
- Activity log

Acceptance:

- Admin can email a proposal with attached PDF.
- Send log is created.
- Proposal status updates correctly.

### Phase 5 — Follow-Up Pipeline

Deliver:

- Follow-up date
- Follow-up notes
- Status transition actions
- Activity timeline

Acceptance:

- Admin can track proposal progress from draft to sent to demo/pilot/accepted/rejected.

### Phase 6 — AI Assistant

Deliver:

- AI proposal generation
- AI section rewrite
- AI email generation
- AI follow-up message generation

Acceptance:

- AI content is generated into editable sections and reviewed before sending.

## 26. Testing Requirements

Unit tests:

- Placeholder replacement
- Section ordering
- Status transitions
- Email validation
- Template cloning
- Permission helpers

API tests:

- Create proposal
- Update proposal
- Generate PDF
- Send proposal
- Duplicate proposal
- Archive proposal
- Permission checks

UI tests:

- Create proposal flow
- Edit sections
- Preview proposal
- Send proposal
- Update status
- Empty states

Security tests:

- Unauthorized users cannot access proposal routes
- Users without send permission cannot send proposals
- Public links do not expose internal notes
- Invalid emails are rejected
- Script injection is sanitized

## 27. Acceptance Criteria

The Proposal Center is complete when:

1. Platform admin can create a school-specific proposal.
2. Proposal uses EduSentrix branding and letterhead.
3. Proposal is properly styled and formatted.
4. Proposal includes web platform, mobile app, AI assistant, video meetings, fees, timetables, attendance, reports, and role-based access.
5. Admin can edit sections before sending.
6. Admin can preview the proposal.
7. Admin can generate and download a PDF.
8. Admin can email the PDF from the platform.
9. Send history is stored.
10. Proposal status updates after sending.
11. Follow-up status can be tracked.
12. Unauthorized users cannot access or send proposals.
13. Generated PDFs are professional enough to send to school owners, headteachers, administrators, and boards.

## 28. MVP Build Order

Build in three slices:

1. **Foundation and API**
   Models, tightened permissions, default template seed, branding defaults, placeholder replacement, content hashing, create/list/detail/update APIs, activity logging.

2. **Proposal Workspace**
   Platform navigation, proposal list, create flow, detail page, section editor with save state, status cards, pricing summary, activity timeline, follow-up controls.

3. **Preview, PDF, Send, and Follow-Up**
   Branded HTML renderer, preview page, PDF generation/download, stale PDF detection, send modal using the existing email service, send logs, status transitions, public-link controls.

## 29. Final Recommendation

Do not build this as only a “send PDF” feature.

Build it as the beginning of the EduSentrix Growth Center.

Start with the Proposal Center, then expand into:

- leads,
- school visits,
- proposals,
- demos,
- follow-ups,
- pilot onboarding,
- conversion tracking.

This will make EduSentrix’s internal operations as professional as the product being sold to schools.
