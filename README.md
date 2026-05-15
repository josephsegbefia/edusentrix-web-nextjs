# EduSentrix

> Modern school management system for Ghana & Africa — Collect fees, run operations, and delight parents on one unified platform.

[![Next.js](https://img.shields.io/badge/Next.js-16.0.10-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Mongoose](https://img.shields.io/badge/Mongoose-8.19-green)](https://mongoosejs.com/)
[![License](https://img.shields.io/badge/license-Private-red)](LICENSE)

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Development](#development)
- [Scripts](#scripts)
- [Database](#database)
- [Authentication](#authentication)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [Support](#support)

## Overview

EduSentrix is a comprehensive school management platform designed specifically for schools in Ghana and Africa. It provides a unified solution for fee collection, student records management, academic period tracking, class management, teacher studio, lesson planning, curriculum and scheme-of-work management, examinations and question banks, school library operations, admissions, promotions, video meetings, supply programs, a school store, and parent communication. The platform supports multiple user roles and integrates with payment providers like Paystack and Mobile Money services.

### Key Highlights

- **Multi-tenant Architecture**: Supports multiple schools with role-based access control and granular permissions
- **Payment Integration**: Seamless integration with Paystack and Mobile Money providers
- **Real-time Updates**: Server-Sent Events (SSE) for live dashboard updates
- **Modern UI/UX**: Built with Tailwind CSS v4, shadcn/ui components, and Framer Motion animations
- **Type-safe**: Full TypeScript implementation with Zod v4 validation
- **Scalable**: Built on Next.js 16 with App Router and React 19 (with React Compiler)
- **Teacher Studio**: Full-featured assignment, quiz, and resource management for teachers
- **Lesson Notes Builder**: Multi-template lesson planning with AI assistance, quality checks, and print/export
- **Lessons Module**: Full lesson lifecycle from authoring to teaching mode, student viewing, flashcards, and analytics
- **Schemes of Work**: Import, AI-assisted planning, review desk, and curriculum coverage tracking
- **Examinations & Question Bank**: Exam paper authoring with sections, question reuse, review workflows, and PDF export
- **Library System**: Book catalog, copy tracking, loans, reservations, fines, overdue management, and reports
- **Admissions**: Full admissions cycle management with public application portals and delegate access
- **Video Meetings**: LiveKit-powered video meetings for parent-teacher conferences
- **Offline Support**: Offline queue and draft persistence for resilient usage
- **AI-Powered (Leo)**: OpenAI integration for lesson generation, student insights, exam drafting, and more
- **Platform Operations**: Multi-school billing, subscription entitlements, staff delegation, and feature flags
- **Demo Platform**: Self-service demo sandbox with persona-based walkthroughs
- **In-app help**: `/docs` — Documentation & Help with searchable guides (markdown), sidebar navigation, and a glass-styled reader aligned with the admin UI

## Features

### School Admin Portal (`/admin`) — 93 pages

- **Student Management**

  - Student enrollment and profile management
  - Premium students management page with card/table views
  - Advanced search, filtering, and sorting
  - Class and grade assignments
  - Comprehensive student detail pages with multiple tabs:
    - Overview: Personal info, stats, and quick actions
    - Academics: Complete gradebook with analytics, charts, AI insights, and performance tracking
    - Fees: Payment history and outstanding balances
    - Behaviour: Incident tracking and positive notes
    - Relationships: Guardian management and class assignments
    - Activity: Complete audit log of student-related actions
  - Guardian/parent management with real-time updates
  - Academic performance badges (Top 1%, Top 5%, Top 10%, Honours)
  - Bulk actions and export functionality

- **Fee Management & Payments**

  - **Fees Dashboard** (`/admin/fees`): Real-time metrics with SSE updates
  - **Invoice Management**: Single and bulk invoice creation with installment support
  - **Payment Recording**: Flexible allocation to invoice line items
  - **Fee Structures**: Reusable fee templates
  - **Student Credit**: Overpayment handling with formal credit ledger
  - **Adjustments**: Waivers, scholarships, penalties, corrections
  - **Bulk Operations**: Issue, cancel, export invoices
  - **Financial-grade accuracy**: Money stored as integers in minor units (pesewas)
  - **Audit Trail**: Complete invoice event timeline
  - **Overdue Reports** (`/admin/overdue-report`): PDF overdue reports and reminder workflows

- **Financial Center** (`/admin/finance`)

  - Unified dashboard for all money movements (inflows, outflows, net position)
  - Transaction ledger with full history
  - Budget creation and tracking
  - Reconciliation tools with AI-assisted matching (`/admin/finance/reconciliation`)
  - Session-based reconciliation with lock/reopen/report workflows
  - Cash closure management
  - Disbursement tracking and approval
  - Manual transaction recording
  - Financial meetings with notes
  - Report commentary and Leo AI briefs

- **Expense Management** (`/admin/expenses`)

  - Record and categorize operational expenses
  - Vendor management
  - Approval workflows
  - Receipt/attachment uploads
  - Integration with Financial Center

- **Teacher Management**

  - Teacher creation with multi-step onboarding
  - Subject and homeroom class assignments
  - Teacher invitation system with email notifications
  - Comprehensive teacher detail pages (Overview, Assignments, Performance, Attendance, Documents, Notes, Activity)
  - Leave request management
  - Bulk operations (assign classes, subjects, change status)
  - Teacher reports and analytics (`/admin/teachers/reports`)
  - Image upload with UploadThing

- **Class & Subject Management**

  - Automatic grade seeding based on school type (Basic: Creche → JHS3, SHS: SHS1-3)
  - Automatic subject creation for Basic schools (Ghana curriculum)
  - Class group creation with flexible naming strategies
  - **Subject offerings** (`/admin/subjects`): Curriculum-aware offerings (display name, code, stage, grade band, lesson-note templates); setup from curriculum; custom offerings; assign offerings to class groups; teacher assignments tied to offerings where configured
  - **Grades & bulk class assignment**: From a grade’s overview, assign subject offerings to all classes in that grade — the picker lists only offerings for that grade’s **band** (e.g. JHS for JHS 1–3); you can create a custom offering with full metadata from the same modal when nothing is curated yet
  - Subject configuration and legacy `Subject` records
  - Teacher assignments to class groups (homeroom and subject-offering flows)
  - Class roles and student roles management

- **Schemes of Work** (`/admin/schemes`)

  - Review desk for imported or teacher-submitted schemes
  - GES PDF, CSV, and Excel import for NaCCA schools
  - Approve, reject, and request revision workflows
  - Activate schemes per grade/class/subject/period
  - Coverage tracking for lesson notes

- **Curricula Management** (`/admin/curricula`)

  - Curriculum CRUD and curriculum-subject mapping
  - Curriculum node hierarchy management
  - Support for multiple curriculum frameworks (NaCCA, Cambridge, IB, etc.)

- **Examinations & Question Bank** (`/admin/examinations`, `/admin/question-bank`)

  - Exam paper creation with sections and question ordering
  - Question bank with cross-role reuse and bulk import from papers
  - Review and approval workflows
  - PDF export for exam papers
  - Exam type configuration

- **Library System** (`/admin/library`)

  - Book catalog with ISBN lookup and cover images
  - Copy management with barcode generation
  - Loan tracking (checkout, return, renew, mark lost/damaged)
  - Reservation management with fulfillment
  - Overdue management with automated reminders
  - Fine assessment and waiver
  - Import tools for bulk book entry
  - Notices, reports, and usage analytics
  - Circulation desk and barcode scanning
  - Library settings and configuration

- **Lesson Notes Review** (`/admin/lesson-notes`)

  - Review inbox with filtering by teacher, class, subject, status
  - Section-by-section review with contextual comments
  - Approval workflow (submitted → approved → published)
  - Dedicated review page for pending submissions

- **Lessons** (`/admin/lessons`)

  - Lesson analytics dashboard
  - Audit log for lesson activity

- **Academic Calendar** (`/admin/academic-calendar`)

  - School-wide event management with recurring events
  - Audience targeting (all, teachers, students, parents)
  - Calendar editor delegation
  - Reminder notifications
  - Period-aware filtering with Leo carryover suggestions

- **Academic Periods** (`/admin/periods`)

  - Term and year management
  - Current period designation
  - Period dashboards with reports and summaries

- **Admissions** (`/admin/admissions`)

  - Admission cycle management with public application portals
  - Application review and bulk processing
  - Template-driven admission forms
  - Delegate access for admissions staff
  - Export and audit capabilities

- **Promotions** (`/admin/promotions`)

  - Promotion cycle creation with policies
  - Auto-assign and manual placement options
  - Approval, finalization, and rollback
  - Evidence-based promotion decisions

- **Meetings** (`/admin/meetings`)

  - Video meeting scheduling with LiveKit integration
  - Participant management and provider events

- **Delegations** (`/admin/delegations`)

  - Staff delegation with module-level access control
  - Activity logging and expiry management

- **Email System** (`/admin/email`)

  - Compose and send emails to parents, teachers, staff
  - Bulk email campaigns
  - Email threading and inbox
  - Preference management

- **Community Hub** (`/admin/community`)

  - **Polls & Surveys**: Create school-wide polls with templates, approval workflow, and result analytics
  - **Fundraising Campaigns**: Launch campaigns with goal tracking, public donation pages, and Paystack integration

- **Supply Programs** (`/admin/supplies`)

  - Supply program creation with line items
  - Audience targeting and eligibility rules
  - Progress tracking per student

- **School Store** (`/admin/store`)

  - Product catalog management
  - Order tracking and fulfillment

- **Documents** (`/admin/documents`)

  - School-wide document management

- **Billing** (`/admin/billing`)

  - Subscription and entitlement overview

- **Reports & Analytics** (`/admin/reports`)

  - Multi-category reports (Fees, Students, Teachers, Attendance, Academics, Activity)
  - Interactive charts with Recharts
  - Flexible filtering (date range, academic period)
  - Report templates and verification
  - Curriculum snapshot export
  - Export to CSV
  - Report library and recent exports tracking

- **Roles & Duties** (`/admin/roles-duties`)

  - Define and assign teacher duties
  - School-wide role definitions
  - Class role management

- **Staff Attendance** (`/admin/staff-attendance`)

  - Track teacher attendance
  - Leave request management

- **School Settings** (`/admin/settings`)

  - School configuration (timetable, attendance rules, features)
  - Teacher Studio feature toggles
  - Notification channel settings (WhatsApp, SMS, Email)
  - Curriculum settings
  - Email configuration
  - Payment setup with owner provisioning and platform payout decisions

- **Invitations** (`/admin/invitations`)

  - Invite teachers, school admins, and parents via email
  - Track status (pending, accepted, expired, revoked, failed)
  - Resend, revoke, and export

- **Activity & Audit Logging**

  - Comprehensive activity feed on dashboard
  - Filterable by type and date range
  - Real-time updates via SSE

### Teacher Portal (`/teacher`) — 58 pages

- **Teacher Dashboard**

  - Overview with class count, student count, pending marking, and attendance status
  - Quick actions and recent activity

- **Lesson Notes Builder** (`/teacher/lesson-notes`)

  - Multi-step wizard for creating professional lesson notes
  - **Multiple Templates**: NaCCA 3-Phase, Classic JHS, Cambridge 3-Part, British 3-Part, American Standards, IB PYP/MYP Unit Planners, Quick Note
  - Rich text editing with Tiptap
  - Curriculum alignment (NaCCA strands, sub-strands, indicators, learning outcomes)
  - Teaching & Learning Materials (TLMs) management
  - External resource uploads via UploadThing
  - Quality score calculation with real-time checklist
  - Print preview and PDF export
  - Approval workflow (Submit for Review → Admin Approval)
  - AI-assisted generation (full lesson, expand section, suggest activities, generate assessment)
  - Offline draft persistence with localStorage auto-save
  - Scheme-linked lesson notes with automatic curriculum context

- **Lessons Module** (`/teacher/lessons`)

  - Full lesson management from authoring to publication
  - Teaching mode with live delivery view
  - Lesson bank for reusable content
  - Collaboration comments for co-planning
  - Flashcard deck creation per lesson
  - Student content publishing and progress tracking
  - Lesson analytics and audit logs
  - Resource attachment management

- **Schemes of Work** (`/teacher/schemes`)

  - View and manage assigned schemes
  - Import schemes from PDF/CSV/Excel
  - AI-assisted scheme planning (Leo)
  - Submit schemes for admin review
  - Curriculum coverage tracking

- **Examinations** (`/teacher/examinations`)

  - Exam paper authoring with section-based question management
  - Question reorder via drag-and-drop
  - Submit and complete workflows
  - PDF export for printing

- **Question Bank** (`/teacher/question-bank`)

  - Browse and reuse questions across exam papers
  - Bulk add from existing papers

- **Curriculum Coverage** (`/teacher/coverage`)

  - Track coverage against scheme of work
  - Summary reports per subject

- **Teacher Studio** (`/teacher/studio`)

  - **Assignments**: Create, manage, and grade assignments with rubrics
  - **Quizzes**: Create and manage quiz-based assessments
  - **Resources**: Upload and share teaching resources
  - **Rubrics**: Create reusable grading rubrics
  - **Submissions**: View and grade student submissions
  - **Projects**: Manage student projects

- **Gradebook** (`/teacher/gradebook`)

  - Record grades by class and subject
  - Assessment management
  - Export and publish

- **Attendance** (`/teacher/attendance`)

  - Homeroom attendance tracking
  - Period-based attendance
  - Attendance history and stats

- **Analytics** (`/teacher/analytics`)

  - Class performance analytics
  - At-risk student identification
  - Attendance and completion metrics

- **Library** (`/teacher/library`)

  - Browse and search the book catalog
  - View personal loans
  - Make and manage reservations
  - Receive book recommendations

- **Admissions** (`/teacher/admissions`)

  - Delegated admissions cycle access
  - Application review

- **Meetings** (`/teacher/meetings`)

  - Video meetings with parents via LiveKit

- **Communication**

  - **Messages** (`/teacher/communication/messages`): Thread-based messaging
  - **Notices** (`/teacher/communication/notices`): Create and send notices
  - **Escalations** (`/teacher/communication/escalations`): Escalate student issues

- **Calendar** (`/teacher/calendar`): Academic calendar view
- **Journal** (`/teacher/journal`): Class journal entries per class group
- **Homeroom Timetable** (`/teacher/homeroom/timetable`): View homeroom class schedule
- **Notifications** (`/teacher/notifications`): Notification center
- **Student Profiles** (`/teacher/students`): View assigned students with detail pages
- **Supplies** (`/teacher/supplies`): Supply program access by subject and homeroom
- **Settings** (`/teacher/settings`): WhatsApp integration and preferences

### Parent Portal (`/parent`) — 19 pages

- Dashboard with ward overview
- Ward details with academic progress
- **Ward Lessons**: View published lessons per ward
- Academics view (grades, performance)
- Attendance tracking
- Fee viewing and payment history
- **Library**: Browse catalog, see notices, make reservations
- **Meetings**: Video meetings with teachers
- **Supply Programs**: View and track supply programs
- **School Store**: Browse products and place orders
- Calendar access
- Messaging with teachers
- Notifications
- Reports (download report cards)
- Polls: Respond to community polls

### Student Portal (`/student`) — 12 pages

- Dashboard with academic overview
- Assignment viewing and submission
- **Lessons**: View published lessons with flashcard study
- **Library**: Browse catalog, manage loans and reservations
- **Timetable**: Weekly timetable view
- Academic calendar
- School notices
- Academic results
- Profile management

### Platform Admin Portal (`/platform`) — 28 pages

- **Dashboard**: Platform-wide overview
- **Schools**: School management with detail pages (subscription, usage, onboarding)
- **Applications**: School application review
- **Users**: Platform user management
- **Staff**: Platform staff management with delegation
- **Billing**: Subscription tiers, revenue, costs, usage tracking, sync, events
- **Reconciliation**: Platform-level reconciliation
- **Audit**: Platform audit log
- **Email**: Platform email management
- **Webhooks**: Webhook configuration
- **Settings**: Platform settings and feature flags
- **Leo**: AI assistant configuration
- **Demo Leads**: Demo lead tracking
- **Pilot**: Pilot program management
- **Feature Flags** (`/platform/flags`): Feature flag management

### User Roles & Permissions

- **Platform Admin**: Manage school applications, subscriptions, and platform settings
- **Platform Staff**: Delegated platform operations with module-level access
- **School Admin**: Full school management capabilities
- **Bursar**: Financial management access
- **Staff**: General staff access
- **Teacher**: Teaching, grading, lesson planning, exams, and communication
- **Parent**: View student information, make payments, attend meetings
- **Student**: Access personal academic information, submit assignments, study lessons

The RBAC system supports granular permissions and subroles via `src/lib/rbac/rbac.ts`.

### Platform Features

- **Command Palette**: Quick actions via ⌘K / Ctrl+K (powered by cmdk)
- **Responsive Design**: Mobile-first approach with adaptive layouts
- **Custom Toast System**: User feedback with busy toast provider
- **Loading States**: Skeleton loaders and busy indicators
- **Error Boundaries**: Graceful error handling
- **Network Health Monitoring**: Real-time network status tracking with visual indicators
- **Offline Support**: Offline mutation queue with automatic retry and draft persistence
- **Real-time Updates**: Server-Sent Events (SSE) for live data synchronization
- **Confirmation Dialogs**: Custom confirmation dialog system for destructive actions
- **Premium UI Design**: Modern design with frosted glass panels, gradient cards, Framer Motion animations
- **Rich Text Editing**: Tiptap v3-based editors with formatting toolbars
- **AI Integration (Leo)**: OpenAI-powered content generation for lessons, exams, insights, and financial summaries
- **Video Meetings**: LiveKit-powered real-time video conferencing
- **Image Processing**: Client-side background removal via @imgly/background-removal
- **Drag and Drop**: @dnd-kit for sortable interfaces (exam question reorder, etc.)
- **Full Calendar**: @fullcalendar for rich calendar rendering
- **Email Engine**: Brevo + IMAP integration for bi-directional email

## Tech Stack

### Frontend

- **Framework**: [Next.js 16.0.10](https://nextjs.org/) (App Router, Turbopack)
- **Language**: [TypeScript 5](https://www.typescriptlang.org/)
- **UI Library**: [React 19](https://react.dev/) with [React Compiler](https://react.dev/learn/react-compiler) (babel-plugin-react-compiler)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/) (Radix UI primitives)
- **State Management**: [TanStack React Query v5](https://tanstack.com/query)
- **Forms**: [React Hook Form](https://react-hook-form.com/) with [Zod v4](https://zod.dev/) validation
- **Rich Text Editor**: [Tiptap v3](https://tiptap.dev/) (with Highlight, Link, TextAlign, Underline, Placeholder)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Charts**: [Recharts](https://recharts.org/)
- **Calendar**: [FullCalendar](https://fullcalendar.io/) for rich calendar views
- **Drag & Drop**: [@dnd-kit](https://dndkit.com/) for sortable interfaces
- **Icons**: [Lucide React](https://lucide.dev/)
- **Date Handling**: [date-fns](https://date-fns.org/)
- **Date Picker**: [react-day-picker](https://react-day-picker.js.org/)
- **Command Palette**: [cmdk](https://cmdk.paco.me/)
- **Markdown**: [react-markdown](https://github.com/remarkjs/react-markdown) + [remark-gfm](https://github.com/remarkjs/remark-gfm)
- **Image Processing**: [@imgly/background-removal](https://img.ly/) (client-side, WebAssembly)

### Backend

- **Runtime**: Node.js (via Next.js API Routes)
- **Database**: [MongoDB](https://www.mongodb.com/) with [Mongoose 8](https://mongoosejs.com/)
- **Authentication**: [Clerk](https://clerk.com/) (MFA, session management, webhooks)
- **File Storage**: [UploadThing](https://uploadthing.com/) (primary) + [Cloudinary](https://cloudinary.com/) (legacy)
- **Email**: [Brevo (Sendinblue)](https://www.brevo.com/) + [Nodemailer](https://nodemailer.com/) + IMAP (via [imapflow](https://imapflow.com/) + [mailparser](https://nodemailer.com/extras/mailparser/))
- **AI**: [OpenAI](https://openai.com/) (lesson generation, exam drafting, student insights, financial briefs)
- **Video**: [LiveKit](https://livekit.io/) (real-time video meetings)
- **PDF Generation**: [pdf-lib](https://pdf-lib.js.org/) + [pdf-parse](https://gitlab.com/nicholasgasior/pdf-parse) (extraction)
- **Validation**: [Zod v4](https://zod.dev/)
- **Webhooks**: [Svix](https://www.svix.com/) (Clerk webhook verification)
- **Supabase**: [Supabase](https://supabase.com/) (supplementary storage/auth)

### Payment Integration

- **Payment Gateway**: [Paystack](https://paystack.com/)
- **Mobile Money**: MTN MoMo, Vodafone Cash, AirtelTigo (via Paystack)

### Development Tools

- **Package Manager**: npm
- **Linting**: ESLint with Next.js config
- **Type Checking**: TypeScript strict mode
- **React Compiler**: Babel React Compiler
- **Dev Server**: Turbopack (Next.js built-in)
- **Script Runner**: [tsx](https://tsx.is/)
- **Testing**: Node.js built-in test runner with [mongodb-memory-server](https://github.com/nodkz/mongodb-memory-server)

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher (or yarn/pnpm)
- **MongoDB**: v6.0 or higher (local or Atlas)
- **Git**: For version control

### Recommended Tools

- **VS Code / Cursor**: With TypeScript and ESLint extensions
- **MongoDB Compass**: For database management
- **Postman/Insomnia**: For API testing

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd edusentrix-web-nextjs
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Create a `.env.local` file in the root directory (see [Environment Variables](#environment-variables) section for details):

```bash
cp .env.example .env.local
```

### 4. Seed Bank Branches (Optional)

If you need to populate bank branch data:

```bash
npm run seed:banks
```

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

### Required Variables

```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017/edusentrix
MONGO_DB_NAME=edusentrix

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# UploadThing (File Uploads)
UPLOADTHING_TOKEN=your_uploadthing_token

# Paystack (Payments)
PAYSTACK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_...

# Brevo (Email)
BREVO_API_KEY=your_brevo_api_key
BREVO_SENDER_EMAIL=noreply@edusentrix.com
BREVO_SENDER_NAME=EduSentrix

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Optional Variables

```env
# Cloudinary (Legacy — only needed if serving existing Cloudinary-hosted files)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# OpenAI (AI features — lesson note generation, exam drafting, student insights)
OPENAI_API_KEY=sk-...

# LiveKit (Video meetings)
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
NEXT_PUBLIC_LIVEKIT_URL=wss://your-livekit-server

# Supabase (supplementary storage)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Node Environment
NODE_ENV=development

# Rate Limiting
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000
```

## Project Structure

```
edusentrix-web-nextjs/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (app)/              # Protected app routes
│   │   │   ├── admin/          # School admin dashboard (93 pages)
│   │   │   │   ├── academic-calendar/  # Calendar management
│   │   │   │   ├── admissions/ # Admissions cycles
│   │   │   │   ├── billing/    # Subscription billing
│   │   │   │   ├── classes/    # Class group management
│   │   │   │   ├── community/  # Polls & fundraising
│   │   │   │   ├── curricula/  # Curriculum management
│   │   │   │   ├── delegations/# Staff delegation
│   │   │   │   ├── documents/  # Document management
│   │   │   │   ├── email/      # Email system
│   │   │   │   ├── examinations/ # Exam papers & review
│   │   │   │   ├── expenses/   # Expense tracking
│   │   │   │   ├── fees/       # Fees, invoices & payments
│   │   │   │   ├── finance/    # Financial center & reconciliation
│   │   │   │   ├── grades/     # Grade management
│   │   │   │   ├── invitations/# Invitation management
│   │   │   │   ├── lesson-notes/ # Lesson note review
│   │   │   │   ├── lessons/    # Lesson analytics & audit
│   │   │   │   ├── library/    # Library system (12 sub-pages)
│   │   │   │   ├── meetings/   # Video meetings
│   │   │   │   ├── periods/    # Academic periods
│   │   │   │   ├── promotions/ # Student promotions
│   │   │   │   ├── question-bank/ # Question bank
│   │   │   │   ├── reports/    # Reports & analytics
│   │   │   │   ├── roles-duties/ # Teacher roles & duties
│   │   │   │   ├── schemes/    # Schemes of work review
│   │   │   │   ├── settings/   # School settings (curriculum, email, payments)
│   │   │   │   ├── staff-attendance/ # Staff attendance
│   │   │   │   ├── store/      # School store
│   │   │   │   ├── students/   # Student management
│   │   │   │   ├── subjects/   # Subject management
│   │   │   │   ├── supplies/   # Supply programs
│   │   │   │   ├── teachers/   # Teacher management
│   │   │   │   └── tasks/      # Task tracker
│   │   │   ├── teacher/        # Teacher portal (58 pages)
│   │   │   │   ├── admissions/ # Delegated admissions
│   │   │   │   ├── analytics/  # Class performance analytics
│   │   │   │   ├── attendance/ # Attendance management
│   │   │   │   ├── calendar/   # Academic calendar
│   │   │   │   ├── classes/    # Assigned classes
│   │   │   │   ├── communication/ # Messages, notices, escalations
│   │   │   │   ├── coverage/   # Curriculum coverage
│   │   │   │   ├── examinations/ # Exam paper authoring
│   │   │   │   ├── gradebook/  # Grade recording
│   │   │   │   ├── journal/    # Class journal
│   │   │   │   ├── lesson-notes/ # Lesson note builder
│   │   │   │   ├── lessons/    # Lesson management & teaching
│   │   │   │   ├── library/    # Library access
│   │   │   │   ├── meetings/   # Video meetings
│   │   │   │   ├── notifications/ # Notification center
│   │   │   │   ├── question-bank/ # Question bank
│   │   │   │   ├── schemes/    # Schemes of work
│   │   │   │   ├── students/   # Student profiles
│   │   │   │   ├── studio/     # Assignments, quizzes, resources, rubrics
│   │   │   │   └── supplies/   # Supply programs
│   │   │   ├── parent/         # Parent portal (19 pages)
│   │   │   │   ├── academics/  # Ward academics
│   │   │   │   ├── attendance/ # Ward attendance
│   │   │   │   ├── calendar/   # Calendar
│   │   │   │   ├── fees/       # Fee viewing
│   │   │   │   ├── library/    # Library browsing
│   │   │   │   ├── meetings/   # Video meetings
│   │   │   │   ├── messages/   # Messaging
│   │   │   │   ├── notifications/ # Notifications
│   │   │   │   ├── payments/   # Payment history
│   │   │   │   ├── reports/    # Reports
│   │   │   │   ├── store/      # School store
│   │   │   │   ├── supplies/   # Supply programs
│   │   │   │   └── wards/      # Ward details & lessons
│   │   │   ├── student/        # Student portal (12 pages)
│   │   │   │   ├── assignments/# View & submit assignments
│   │   │   │   ├── calendar/   # Academic calendar
│   │   │   │   ├── lessons/    # View published lessons
│   │   │   │   ├── library/    # Library access
│   │   │   │   ├── notices/    # School notices
│   │   │   │   ├── results/    # Academic results
│   │   │   │   ├── timetable/  # Weekly timetable
│   │   │   │   └── profile/    # Student profile
│   │   │   ├── platform/       # Platform admin portal (28 pages)
│   │   │   └── docs/           # Documentation viewer
│   │   ├── (public)/           # Public routes
│   │   │   └── authentication/ # Auth pages
│   │   ├── (school)/           # School-specific routes
│   │   │   └── onboarding/     # School onboarding
│   │   ├── api/                # API routes (31 top-level folders)
│   │   │   ├── admin/          # Admin APIs (~250 endpoints)
│   │   │   ├── teacher/        # Teacher APIs (~130 endpoints)
│   │   │   ├── parent/         # Parent APIs (~65 endpoints)
│   │   │   ├── student/        # Student APIs (~27 endpoints)
│   │   │   ├── community/      # Community APIs
│   │   │   ├── academic-calendars/ # Calendar APIs
│   │   │   ├── examinations/   # Exam APIs
│   │   │   ├── question-bank/  # Question bank APIs
│   │   │   ├── meetings/       # Meeting APIs
│   │   │   ├── leo/            # AI assistant APIs
│   │   │   ├── platform/       # Platform ops APIs
│   │   │   ├── subscription/   # Subscription APIs
│   │   │   ├── demo/           # Demo sandbox APIs
│   │   │   ├── cron/           # Scheduled job endpoints
│   │   │   ├── uploadthing/    # UploadThing webhook route
│   │   │   ├── webhooks/       # Clerk & Paystack webhooks
│   │   │   └── ...             # Other API endpoints
│   │   ├── auth/               # Auth callbacks
│   │   └── layout.tsx          # Root layout
│   ├── components/             # React components
│   │   ├── ui/                 # shadcn/ui + custom components
│   │   ├── admin/              # Admin-specific components
│   │   ├── teacher/            # Teacher portal components
│   │   ├── parent/             # Parent portal components
│   │   ├── community/          # Community hub components
│   │   ├── examinations/       # Exam paper components
│   │   ├── schemes/            # Scheme of work components
│   │   ├── lesson-notes/       # Lesson note components
│   │   ├── lessons/            # Lesson components
│   │   ├── academic-calendar/  # Calendar views
│   │   ├── modals/             # Modal components (60+)
│   │   ├── nav/                # Navigation & sidebar components
│   │   ├── upload/             # File upload components
│   │   ├── system/             # Network health, service worker
│   │   ├── docs/               # Documentation viewer
│   │   └── ...                 # Other component categories
│   ├── hooks/                  # Custom React hooks (218 total)
│   │   ├── admin/              # Admin hooks (109)
│   │   ├── teacher/            # Teacher hooks (64)
│   │   ├── parent/             # Parent hooks (12)
│   │   ├── admissions/         # Admissions hooks (7)
│   │   ├── leo/                # Leo AI hooks (6)
│   │   ├── student/            # Student hooks (5)
│   │   └── ...                 # Shared hooks (offline, network, toast, subscription, etc.)
│   ├── lib/                    # Utility libraries (55 modules, 395 files)
│   │   ├── auth/               # Auth utilities & guards
│   │   ├── rbac/               # Role-based access control & permissions
│   │   ├── fees/               # Fee calculation utilities
│   │   ├── finance/            # Ledger utilities
│   │   ├── lesson-notes/       # Quality score, review helpers
│   │   ├── lessons/            # Lesson publishing, snapshots
│   │   ├── schemes/            # Scheme import, PDF AI parsing
│   │   ├── examinations/       # Paper access, question bank logic
│   │   ├── library/            # Library loans, reservations, fines, capabilities (28 files)
│   │   ├── billing/            # Usage events, entitlements, checkout
│   │   ├── platform-billing/   # Subscription pricing, provider sync
│   │   ├── delegations/        # Delegation registry, expiry reminders
│   │   ├── promotions/         # Promotion engine, evidence gathering
│   │   ├── meetings/           # Video meeting serialization
│   │   ├── supply-programs/    # Eligibility, progress, audience
│   │   ├── email/              # Email templates & Brevo + IMAP integration
│   │   ├── demo/               # Demo sandbox, personas, coverage matrix
│   │   ├── leo/                # Leo AI conversation management
│   │   ├── ai/                 # OpenAI integration
│   │   ├── network/            # Offline queue, SSE manager, connection history
│   │   ├── uploadthing/        # UploadThing client & server config
│   │   ├── image/              # Background removal
│   │   ├── audit/              # Audit event logging
│   │   └── ...                 # Other modules (timetable, admissions, curriculum, etc.)
│   ├── models/                 # Mongoose models (180)
│   ├── providers/              # React context providers
│   ├── constants/              # Application constants
│   └── middleware.ts           # Next.js middleware
├── content/                    # Content files
│   ├── docs/                   # User-facing documentation markdown
│   └── tasks/                  # Task tracking markdown files
├── docs/                       # Feature specs & architecture docs (99 files)
├── scripts/                    # Utility scripts (18)
├── public/                     # Static assets
├── components.json             # shadcn/ui configuration
├── next.config.ts              # Next.js configuration
├── tsconfig.json               # TypeScript configuration
├── package.json                # Dependencies and scripts
└── README.md                   # This file
```

## Development

### Development Workflow

1. **Start MongoDB** (if running locally):

   ```bash
   mongod
   ```

2. **Start Development Server**:

   ```bash
   npm run dev
   ```

3. **Run Linter**:
   ```bash
   npm run lint
   ```

### Code Style

- Follow TypeScript best practices
- Use ESLint for code quality
- Follow Next.js App Router conventions
- Use functional components with hooks
- Implement proper error boundaries
- Validate API inputs with Zod schemas

### TypeScript Paths

The project uses path aliases configured in `tsconfig.json`:

- `@/*` → `src/*`

## Scripts

### Development Scripts

```bash
# Start development server (Turbopack)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint

# Run tests
npm test
```

### Database Scripts

```bash
# Seed bank branches
npm run seed:banks

# Seed bank branches (drop existing)
npm run seed:banks:drop

# Seed bank branches (dry run)
npm run seed:banks:dry

# Seed JHS classes and students
npm run seed:jhs

# Seed JHS classes (dry run)
npm run seed:jhs:dry

# Seed academic data (grades, assessments, term results)
npm run seed:academics

# Seed academic data (dry run)
npm run seed:academics:dry

# Seed AI insights demo data
npm run seed:insights

# Seed AI insights demo data (dry run)
npm run seed:insights:dry
```

Admin **Payment setup** bank search reads from the `bankbranches` collection. **Run `npm run seed:banks` once per deployment** with `MONGODB_URI` (and optional `MONGO_DB_NAME`) pointing at that environment's database; if you skip this in staging or production, bank search will return no matches.

### Timetable Scripts

```bash
# Backfill timetable from teacher assignments
npm run timetable:backfill

# Check timetable-assignment parity
npm run timetable:parity
```

### Library Scripts

```bash
# Sync library indexes
npm run library:sync-indexes

# Backfill reservation expiry dates
npm run library:backfill-reservation-expires
```

### Audit Scripts

```bash
# Run audit reconciliation
npm run audit:reconcile
```

### Admin Scripts

```bash
# Create platform admin user
npm run admin:create
```

## Database

### MongoDB Models

The application uses 180 Mongoose models located in `src/models/`, including:

**Core**
- **User** / **UserMembership**: User accounts and school associations
- **School** / **SchoolSettings**: School information and configuration

**Students & Academics**
- **Student** / **Guardian**: Student records and guardian relationships
- **Grade** / **ClassGroup** / **Subject** / **SubjectOffering**: Academic structure and curriculum-scoped offerings (linked to classes via `subjectOfferingIds`)
- **AcademicPeriod**: Term and year configuration
- **SubjectGrade** / **TermResult** / **Assessment**: Academic performance
- **TeacherComment** / **GradingScale**: Grading support
- **StudentAttendance** / **StudentClassRole**: Attendance and roles

**Teachers**
- **Teacher** / **TeacherAssignment**: Teacher records and assignments
- **TeacherAttendance** / **TeacherDocument** / **TeacherNote**: Teacher management
- **TeacherPerformance** / **TeacherActivity**: Tracking and analytics
- **TeacherPermission** / **TeacherDutyAssignment**: RBAC and duties
- **TeacherResource** / **TeacherSettings**: Shared resources and preferences

**Lesson Notes & Lessons**
- **LessonNote** / **LessonNoteApproval** / **LessonNoteReviewComment**: Lesson notes with review workflow
- **Lesson** / **LessonResource** / **LessonReflection**: Full lesson lifecycle
- **LessonAuditLog** / **LessonCollaborationComment**: Collaboration and audit
- **LessonFlashcardDeck** / **StudentLessonProgress** / **StudentFlashcardProgress**: Student engagement

**Schemes of Work**
- **SchemeOfWork** / **SchemeItem**: Scheme records and rows
- **SchemeImportJob** / **SchemeReview**: Import and review workflows

**Curricula**
- **Curriculum** / **CurriculumNode** / **CurriculumSubject**: Curriculum framework management

**Examinations**
- **ExamPaper** / **ExamPaperSection** / **ExamPaperReview**: Exam lifecycle
- **ExamQuestion** / **QuestionBankItem** / **ExamType**: Question management

**Library**
- **LibraryBook** / **LibraryBookCopy**: Book catalog and copies
- **LibraryLoan** / **LibraryReservation**: Circulation
- **LibraryImportJob** / **LibraryNotice** / **LibrarySettings**: Operations

**Teacher Studio**
- **Homework** / **Rubric** / **Submission**: Assignments and grading

**Communication & Email**
- **Message** / **MessageThread**: Thread-based messaging
- **Notice** / **Notification**: Notices and notifications
- **Escalation**: Issue escalation tracking
- **EmailMessage** / **EmailThread** / **EmailBatch** / **EmailEvent**: Full email system
- **EmailDispatchJob** / **EmailPreference** / **EmailRateWindow** / **EmailSuppression**: Email operations

**Fees & Finance**
- **FeeStructure** / **Invoice** / **InvoiceLineItem**: Fee management
- **Payment** / **PaymentIntent** / **PaymentAllocation**: Payment tracking
- **InstallmentSchedule** / **InvoiceEvent**: Installment and audit
- **StudentCreditBalance**: Credit/wallet system
- **SchoolExpense** / **ExpenseCategory** / **Vendor**: Expense management
- **FinancialTransaction** / **Budget** / **SchoolDisbursement**: Financial center
- **ReconciliationSession** / **ReconciliationRun** / **ReconciliationIngestion** / **ReconciliationAlert** / **CashClosure**: Reconciliation

**Admissions**
- **AdmissionCycle** / **AdmissionForm** / **AdmissionEvent** / **AdmissionInviteLink**: Admissions lifecycle

**Promotions**
- **PromotionCycle** / **PromotionPolicy** / **PromotionDecision** / **PromotionExecutionLog**: Student promotions

**Community**
- **CommunityPoll** / **CommunityPollVote** / **CommunityPollComment** / **PollTemplate**: Polls
- **FundraisingCampaign** / **FundraisingDonation** / **FundraisingPayout** / **FundraisingCampaignUpdate**: Fundraising

**Meetings**
- **Meeting** / **MeetingParticipant** / **MeetingProviderEvent**: Video meetings

**Platform & Subscriptions**
- **SubscriptionTier** / **SchoolSubscription** / **SubscriptionEvent**: Billing
- **SubscriptionCheckoutIntent** / **UsageEvent** / **UsageMetric**: Usage tracking
- **PlatformStaffProfile** / **PlatformFeatureFlag** / **PlatformAuditLog**: Platform ops
- **Delegation**: Staff delegation
- **DemoSandbox** / **DemoSession** / **DemoEvent** / **DemoLead**: Demo platform

**Calendar & System**
- **AcademicCalendar** / **AcademicCalendarEvent** / **CalendarReminderLog**: Calendar
- **Activity** / **AuditEvent** / **AuditStreamHead**: Activity and audit logging
- **Application** / **ApplicationAudit**: School applications
- **Invitation** / **BankBranch** / **ProvisioningJob**: System utilities
- **ClassRoleDefinition** / **SchoolStudentRole**: Role definitions
- **JournalEntry**: Teacher journal
- **ReportTemplate** / **ReportExport** / **ReportVerification**: Report system
- **StoreProduct** / **StoreOrder**: School store
- **SupplyProgram** / **SupplyLine**: Supply programs
- **LeoConversation** / **LeoMessage** / **LeoActionRun** / **LeoResponseCache**: AI assistant

### Database Connection

The database connection is handled in `src/db/connectToDatabase.ts` with connection pooling and error handling.

## Authentication

### Clerk Integration

EduSentrix uses [Clerk](https://clerk.com/) for authentication:

- **Multi-factor Authentication**: Supported via Clerk
- **Password Management**: Enforced password creation for new users
- **Session Management**: Handled by Clerk middleware
- **User Roles**: Stored in MongoDB, validated via middleware
- **Webhooks**: Clerk webhook integration for user sync

### Role-Based Access Control

Roles are defined in `src/lib/roles.ts`:

- `platform_admin`: Platform management
- `school_admin`: School administration
- `bursar`: Financial management
- `staff`: General staff access
- `teacher`: Teaching and classroom management
- `parent`: Parent/guardian access
- `student`: Student access

Granular permissions are managed via `src/lib/rbac/rbac.ts` with subrole support. The delegation system (`src/lib/delegations/`) allows platform staff and school admins to delegate module-level access to other staff members.

### Protected Routes

Routes are protected via middleware (`src/middleware.ts`):

- Public routes: Landing, enrollment, auth pages, public admissions portals
- Protected routes: All app routes require authentication
- Role-based routing: Redirects based on user role

## Deployment

### Build for Production

```bash
npm run build
```

### Environment Setup

Ensure all environment variables are set in your production environment:

- MongoDB connection string (Atlas recommended)
- Clerk production keys
- UploadThing production token
- Paystack production keys
- Brevo production API key
- OpenAI API key (for AI features)
- LiveKit credentials (for video meetings)

### Recommended Platforms

- **Vercel**: Optimized for Next.js deployments
- **Self-hosted**: Docker containerization recommended

### Deployment Checklist

- [ ] Set all production environment variables
- [ ] Configure MongoDB Atlas (if using cloud)
- [ ] Set up Clerk production instance
- [ ] Configure UploadThing production account
- [ ] Set up Paystack production account
- [ ] Configure OpenAI API key (optional, for AI features)
- [ ] Configure LiveKit server (optional, for video meetings)
- [ ] Run `npm run seed:banks` against production database
- [ ] Run `npm run library:sync-indexes` for library search
- [ ] Configure domain and SSL certificates
- [ ] Set up monitoring and error tracking
- [ ] Configure backup strategy for MongoDB

## Contributing

### Development Setup

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run linter: `npm run lint`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Code Review Process

- All code changes require review
- Ensure linting passes
- Update documentation as needed
- Follow existing code style

## Additional Documentation

- **In-app Docs** (`/docs`): User-facing help — **43** articles across **31** sidebar categories (Getting Started, Subjects & offerings, Fees, Timetable, Library, Admissions, Leo, and more). Open **Documentation & Help** from the app top bar; content lives in `content/docs/` and is rendered by `DocsViewer` with search and an on-page heading index
- **Feature Specs** (`docs/`): 99 specification documents covering architecture and feature design
- **Fees System Strategy**: See `FEES_SYSTEM_STRATEGY.md` for the fees & payments architecture
- **Lesson Notes Spec**: See `edusentrix-lesson-notes-spec.md` for the lesson notes builder specification
- **Lessons Module Spec**: See `docs/edusentrix-lessons-module-technical-spec.md` for the full lessons system
- **Schemes of Work Spec**: See `docs/edusentrix-curriculum-scheme-of-work-development-spec.md`
- **Examinations Spec**: See `docs/edusentrix-examinations-question-bank-module-spec.md`
- **Library Spec**: See `docs/edusentrix-library-module-v1-v2-technical-spec.md`
- **Subscription & Entitlements**: See `docs/edusentrix-subscription-entitlements-final-spec.md`
- **Platform Operations**: See `docs/edusentrix-platform-operations-staff-delegation-spec.md`
- **Leo Copilot Spec**: See `docs/LEO_COPILOT_DEVELOPMENT_SPEC.md`
- **Demo Platform Spec**: See `docs/EDUSENTRIX_DEMO_PLATFORM_SPEC.md`

## Support

For support and inquiries:

- **Email**: support@edusentrix.com
- **Documentation**: Open **Documentation & Help** (`/docs`) — searchable articles, subject offerings, fees, timetable, library, and more
- **Issues**: Use GitHub Issues for bug reports

## License

This project is proprietary and confidential. All rights reserved.

---

**Built with care by Appsentrix for schools in Ghana & Africa**
