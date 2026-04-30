# EduSentrix

> Modern school management system for Ghana & Africa — Collect fees, run operations, and delight parents on one unified platform.

[![Next.js](https://img.shields.io/badge/Next.js-16.0.10-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Mongoose](https://img.shields.io/badge/Mongoose-8.19-green)](https://mongoosejs.com/)
[![License](https://img.shields.io/badge/license-Private-red)](LICENSE)

## 📋 Table of Contents

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

## 🎯 Overview

EduSentrix is a comprehensive school management platform designed specifically for schools in Ghana and Africa. It provides a unified solution for fee collection, student records management, academic period tracking, class management, teacher studio, lesson planning, and parent communication. The platform supports multiple user roles and integrates with payment providers like Paystack and Mobile Money services.

### Key Highlights

- **Multi-tenant Architecture**: Supports multiple schools with role-based access control and granular permissions
- **Payment Integration**: Seamless integration with Paystack and Mobile Money providers
- **Real-time Updates**: Server-Sent Events (SSE) for live dashboard updates
- **Modern UI/UX**: Built with Tailwind CSS v4, shadcn/ui components, and Framer Motion animations
- **Type-safe**: Full TypeScript implementation with Zod validation
- **Scalable**: Built on Next.js 16 with App Router and React 19
- **Teacher Studio**: Full-featured assignment, quiz, and resource management for teachers
- **Lesson Notes Builder**: Multi-template lesson planning with AI assistance, quality checks, and print/export
- **Offline Support**: Offline queue and draft persistence for resilient usage
- **AI-Powered**: OpenAI integration for lesson generation and student insights

## ✨ Features

### School Admin Portal (`/admin`)

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

- **Financial Center** (`/admin/finance`)

  - Unified dashboard for all money movements (inflows, outflows, net position)
  - Transaction ledger with full history
  - Budget creation and tracking
  - Reconciliation tools
  - Manual transaction recording

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
  - Image upload with UploadThing

- **Class & Subject Management**

  - Automatic grade seeding based on school type (Basic: Creche → JHS3, SHS: SHS1-3)
  - Automatic subject creation for Basic schools (Ghana curriculum)
  - Class group creation with flexible naming strategies
  - Subject configuration and assignment
  - Teacher assignments to class groups
  - Class roles and student roles management

- **Academic Calendar** (`/admin/academic-calendar`)

  - School-wide event management with recurring events
  - Audience targeting (all, teachers, students, parents)
  - Calendar editor permissions
  - Reminder notifications

- **Community Hub** (`/admin/community`)

  - **Polls & Surveys**: Create school-wide polls with templates, approval workflow, and result analytics
  - **Fundraising Campaigns**: Launch campaigns with goal tracking, public donation pages, and Paystack integration

- **Master Timetable** (`/admin/timetable`)

  - School-wide schedule view with conflict detection
  - Day/class filtering

- **Reports & Analytics** (`/admin/reports`)

  - Multi-category reports (Fees, Students, Teachers, Attendance, Academics, Activity)
  - Interactive charts with Recharts
  - Flexible filtering (date range, academic period)
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

- **Invitations** (`/admin/invitations`)

  - Invite teachers, school admins, and parents via email
  - Track status (pending, accepted, expired, revoked, failed)
  - Resend, revoke, and export

- **Activity & Audit Logging**

  - Comprehensive activity feed on dashboard
  - Filterable by type and date range
  - Real-time updates via SSE

### Teacher Portal (`/teacher`)

- **Teacher Dashboard**

  - Overview with class count, student count, pending marking, and attendance status
  - Quick actions and recent activity

- **Lesson Notes Builder** (`/teacher/lesson-notes`)

  - Multi-step wizard for creating professional lesson notes
  - **Three Templates**: NaCCA 3-Phase (Starter → Main → Plenary), Classic JHS (Objectives/RPK/Steps/Evaluation), Quick Note (Simple)
  - Rich text editing with Tiptap
  - Curriculum alignment (NaCCA strands, sub-strands, indicators, learning outcomes)
  - Teaching & Learning Materials (TLMs) management
  - External resource uploads via UploadThing
  - Quality score calculation with real-time checklist
  - Print preview and PDF export
  - Approval workflow (Submit for Review → Admin Approval)
  - AI-assisted generation (full lesson, expand section, suggest activities, generate assessment)
  - Offline draft persistence with localStorage auto-save
  - Confirmation dialog for delete actions

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

- **Attendance** (`/teacher/attendance`)

  - Homeroom attendance tracking
  - Period-based attendance
  - Attendance history

- **Analytics** (`/teacher/analytics`)

  - Class performance analytics
  - At-risk student identification

- **Communication**

  - **Messages** (`/teacher/communication/messages`): Thread-based messaging
  - **Notices** (`/teacher/communication/notices`): Create and send notices
  - **Escalations** (`/teacher/communication/escalations`): Escalate student issues

- **Calendar** (`/teacher/calendar`): Academic calendar view
- **Journal** (`/teacher/journal`): Class journal entries
- **Notifications** (`/teacher/notifications`): Notification center
- **Student Profiles** (`/teacher/students`): View assigned students

### Parent Portal (`/parent`)

- Dashboard with ward overview
- Ward details with academic progress
- Academics view (grades, performance)
- Attendance tracking
- Fee viewing and payment history
- Calendar access
- Messaging with teachers
- Notifications
- Reports

### Student Portal (`/student`)

- Dashboard with academic overview
- Assignment viewing and submission
- Academic calendar
- School notices
- Academic results
- Profile management

### User Roles & Permissions

- **Platform Admin**: Manage school applications and platform settings
- **School Admin**: Full school management capabilities
- **Bursar**: Financial management access
- **Staff**: General staff access
- **Teacher**: Teaching, grading, lesson planning, and communication
- **Parent**: View student information and make payments
- **Student**: Access personal academic information and submit assignments

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
- **Premium UI Design**: Modern design with gradient cards, Framer Motion animations
- **Rich Text Editing**: Tiptap-based editors with formatting toolbars
- **AI Integration**: OpenAI-powered content generation for lesson notes and student insights
- **Image Processing**: Client-side background removal via @imgly/background-removal

## 🛠 Tech Stack

### Frontend

- **Framework**: [Next.js 16.0.10](https://nextjs.org/) (App Router, Turbopack)
- **Language**: [TypeScript 5](https://www.typescriptlang.org/)
- **UI Library**: [React 19](https://react.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/) (Radix UI primitives)
- **State Management**: [TanStack React Query v5](https://tanstack.com/query)
- **Forms**: [React Hook Form](https://react-hook-form.com/) with [Zod v4](https://zod.dev/) validation
- **Rich Text Editor**: [Tiptap v3](https://tiptap.dev/) (with Highlight, Link, TextAlign, Underline, Placeholder)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Charts**: [Recharts](https://recharts.org/)
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
- **Email**: [Brevo (Sendinblue)](https://www.brevo.com/) + [Nodemailer](https://nodemailer.com/)
- **AI**: [OpenAI](https://openai.com/) (lesson note generation, student insights)
- **PDF Generation**: [pdf-lib](https://pdf-lib.js.org/)
- **Validation**: [Zod v4](https://zod.dev/)
- **Webhooks**: [Svix](https://www.svix.com/) (Clerk webhook verification)

### Payment Integration

- **Payment Gateway**: [Paystack](https://paystack.com/)
- **Mobile Money**: MTN MoMo, Vodafone Cash, AirtelTigo (via Paystack)

### Development Tools

- **Package Manager**: npm
- **Linting**: ESLint with Next.js config
- **Type Checking**: TypeScript strict mode
- **React Compiler**: Babel React Compiler (experimental)
- **Dev Server**: Turbopack (Next.js built-in)
- **Script Runner**: [tsx](https://tsx.is/)

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher (or yarn/pnpm)
- **MongoDB**: v6.0 or higher (local or Atlas)
- **Git**: For version control

### Recommended Tools

- **VS Code / Cursor**: With TypeScript and ESLint extensions
- **MongoDB Compass**: For database management
- **Postman/Insomnia**: For API testing

## 🚀 Getting Started

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

## 🔐 Environment Variables

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

# OpenAI (AI features — lesson note generation, student insights)
OPENAI_API_KEY=sk-...

# Node Environment
NODE_ENV=development

# Rate Limiting
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000
```

## 📁 Project Structure

```
edusentrix-web-nextjs/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (app)/              # Protected app routes
│   │   │   ├── admin/          # School admin dashboard
│   │   │   │   ├── academic-calendar/  # Calendar management
│   │   │   │   ├── classes/    # Class group management
│   │   │   │   ├── community/  # Polls & fundraising
│   │   │   │   ├── expenses/   # Expense tracking
│   │   │   │   ├── fees/       # Fees, invoices & payments
│   │   │   │   ├── finance/    # Financial center
│   │   │   │   ├── invitations/# Invitation management
│   │   │   │   ├── reports/    # Reports & analytics
│   │   │   │   ├── roles-duties/ # Teacher roles & duties
│   │   │   │   ├── settings/   # School settings
│   │   │   │   ├── staff-attendance/ # Staff attendance
│   │   │   │   ├── students/   # Student management
│   │   │   │   ├── subjects/   # Subject management
│   │   │   │   ├── teachers/   # Teacher management
│   │   │   │   ├── timetable/  # Master timetable
│   │   │   │   └── tasks/      # Task tracker
│   │   │   ├── teacher/        # Teacher portal
│   │   │   │   ├── analytics/  # Class performance analytics
│   │   │   │   ├── attendance/ # Attendance management
│   │   │   │   ├── calendar/   # Academic calendar
│   │   │   │   ├── classes/    # Assigned classes
│   │   │   │   ├── communication/ # Messages, notices, escalations
│   │   │   │   ├── gradebook/  # Grade recording
│   │   │   │   ├── journal/    # Class journal
│   │   │   │   ├── lesson-notes/ # Lesson note builder
│   │   │   │   ├── notifications/ # Notification center
│   │   │   │   ├── students/   # Student profiles
│   │   │   │   └── studio/     # Assignments, quizzes, resources, rubrics
│   │   │   ├── parent/         # Parent portal
│   │   │   │   ├── academics/  # Ward academics
│   │   │   │   ├── attendance/ # Ward attendance
│   │   │   │   ├── calendar/   # Calendar
│   │   │   │   ├── fees/       # Fee viewing
│   │   │   │   ├── messages/   # Messaging
│   │   │   │   ├── notifications/ # Notifications
│   │   │   │   ├── payments/   # Payment history
│   │   │   │   ├── reports/    # Reports
│   │   │   │   └── wards/      # Ward details
│   │   │   ├── student/        # Student portal
│   │   │   │   ├── assignments/# View & submit assignments
│   │   │   │   ├── calendar/   # Academic calendar
│   │   │   │   ├── notices/    # School notices
│   │   │   │   ├── results/    # Academic results
│   │   │   │   └── profile/    # Student profile
│   │   │   ├── platform/       # Platform admin portal
│   │   │   └── docs/           # Documentation viewer
│   │   ├── (public)/           # Public routes
│   │   │   └── authentication/ # Auth pages
│   │   ├── (school)/           # School-specific routes
│   │   │   └── onboarding/     # School onboarding
│   │   ├── api/                # API routes
│   │   │   ├── admin/          # Admin APIs (students, teachers, fees, etc.)
│   │   │   ├── teacher/        # Teacher APIs (studio, lesson-notes, gradebook, etc.)
│   │   │   ├── parent/         # Parent APIs
│   │   │   ├── student/        # Student APIs
│   │   │   ├── community/      # Community APIs (polls, fundraising)
│   │   │   ├── academic-calendars/ # Calendar APIs
│   │   │   ├── uploadthing/    # UploadThing webhook route
│   │   │   ├── uploads/        # Legacy upload signing
│   │   │   ├── webhooks/       # Clerk & Paystack webhooks
│   │   │   └── ...             # Other API endpoints
│   │   ├── auth/               # Auth callbacks
│   │   └── layout.tsx          # Root layout
│   ├── components/             # React components
│   │   ├── ui/                 # shadcn/ui + custom components (rich-text-editor, html-content, etc.)
│   │   ├── admin/              # Admin-specific components
│   │   ├── teacher/            # Teacher portal components (lesson-notes, studio, etc.)
│   │   ├── parent/             # Parent portal components
│   │   ├── community/          # Community hub components
│   │   ├── modals/             # Modal components (50+)
│   │   ├── nav/                # Navigation & sidebar components
│   │   ├── upload/             # File upload components (ImageUploader, DocumentUploader, FileDropzone)
│   │   ├── system/             # Network health, service worker, etc.
│   │   ├── docs/               # Documentation viewer
│   │   └── ...                 # Other component categories
│   ├── hooks/                  # Custom React hooks
│   │   ├── admin/              # Admin hooks (69 hooks)
│   │   ├── teacher/            # Teacher hooks (43 hooks)
│   │   ├── parent/             # Parent hooks
│   │   └── ...                 # Shared hooks (offline, network, toast, etc.)
│   ├── lib/                    # Utility libraries
│   │   ├── auth/               # Auth utilities & guards
│   │   ├── rbac/               # Role-based access control & permissions
│   │   ├── fees/               # Fee calculation utilities
│   │   ├── finance/            # Ledger utilities
│   │   ├── lesson-notes/       # Quality score calculation
│   │   ├── network/            # Offline queue, SSE manager, connection history
│   │   ├── uploadthing/        # UploadThing client & server config
│   │   ├── image/              # Background removal
│   │   ├── email/              # Email templates & Brevo integration
│   │   └── ...                 # Other utilities
│   ├── models/                 # Mongoose models (60+)
│   ├── providers/              # React context providers
│   ├── constants/              # Application constants
│   └── middleware.ts           # Next.js middleware
├── content/                    # Content files
│   ├── docs/                   # Documentation markdown files
│   └── tasks/                  # Task tracking markdown files
├── scripts/                    # Utility scripts
│   ├── seed-bank-branches.ts
│   ├── seed-jhs-classes.ts
│   ├── seed-academics.ts
│   ├── createPlatformAdmin.ts
│   ├── create-teacher-indexes.ts
│   ├── backfill-user-memberships.ts
│   └── migrateRolesToRole.ts
├── public/                     # Static assets
├── components.json             # shadcn/ui configuration
├── next.config.ts              # Next.js configuration
├── tsconfig.json               # TypeScript configuration
├── package.json                # Dependencies and scripts
└── README.md                   # This file
```

## 💻 Development

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

## 📜 Scripts

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
```

Admin **Payment setup** bank search reads from the `bankbranches` collection. **Run `npm run seed:banks` once per deployment** with `MONGODB_URI` (and optional `MONGO_DB_NAME`) pointing at that environment’s database; if you skip this in staging or production, bank search will return no matches.

### Admin Scripts

```bash
# Create platform admin user
npm run admin:create
```

## 🗄 Database

### MongoDB Models

The application uses 60+ Mongoose models located in `src/models/`, including:

**Core**
- **User** / **UserMembership**: User accounts and school associations
- **School** / **SchoolSettings**: School information and configuration

**Students & Academics**
- **Student** / **Guardian**: Student records and guardian relationships
- **Grade** / **ClassGroup** / **Subject**: Academic structure
- **AcademicPeriod**: Term and year configuration
- **SubjectGrade** / **TermResult** / **Assessment**: Academic performance
- **TeacherComment** / **GradingScale**: Grading support
- **StudentAttendance** / **StudentClassRole**: Attendance and roles

**Teachers**
- **Teacher** / **TeacherAssignment**: Teacher records and assignments
- **TeacherAttendance** / **TeacherDocument** / **TeacherNote**: Teacher management
- **TeacherPerformance** / **TeacherActivity**: Tracking and analytics
- **TeacherPermission** / **TeacherDutyAssignment**: RBAC and duties
- **TeacherResource**: Shared teaching resources

**Lesson Notes**
- **LessonNote**: Lesson note records (NaCCA 3-Phase, Classic JHS, Simple)
- **LessonNoteApproval**: Approval workflow tracking

**Teacher Studio**
- **Homework**: Assignment records
- **Rubric**: Grading rubrics
- **Submission**: Student submissions

**Communication**
- **Message** / **MessageThread**: Thread-based messaging
- **Notice**: School-wide notices
- **Notification**: User notifications
- **Escalation**: Issue escalation tracking

**Fees & Finance**
- **FeeStructure** / **Invoice** / **InvoiceLineItem**: Fee management
- **Payment** / **PaymentIntent** / **PaymentAllocation**: Payment tracking
- **InstallmentSchedule** / **InvoiceEvent**: Installment and audit
- **StudentCreditBalance**: Credit/wallet system
- **SchoolExpense** / **ExpenseCategory** / **Vendor**: Expense management
- **FinancialTransaction** / **Budget**: Financial center

**Community**
- **CommunityPoll** / **CommunityPollVote** / **CommunityPollComment** / **PollTemplate**: Polls
- **FundraisingCampaign** / **FundraisingDonation** / **FundraisingPayout** / **FundraisingCampaignUpdate**: Fundraising

**Calendar & System**
- **AcademicCalendar** / **AcademicCalendarEvent** / **CalendarReminderLog**: Calendar
- **Activity** / **Application** / **ApplicationAudit**: Activity logging
- **Invitation** / **BankBranch** / **ProvisioningJob**: System utilities
- **ClassRoleDefinition** / **SchoolStudentRole**: Role definitions
- **JournalEntry**: Teacher journal
- **ReportExport**: Report export tracking
- **OTPChallenge**: Authentication challenges

### Database Connection

The database connection is handled in `src/db/connectToDatabase.ts` with connection pooling and error handling.

## 🔒 Authentication

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

Granular permissions are managed via `src/lib/rbac/rbac.ts` with subrole support.

### Protected Routes

Routes are protected via middleware (`src/middleware.ts`):

- Public routes: Landing, enrollment, auth pages
- Protected routes: All app routes require authentication
- Role-based routing: Redirects based on user role

## 🚢 Deployment

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
- [ ] Configure domain and SSL certificates
- [ ] Set up monitoring and error tracking
- [ ] Configure backup strategy for MongoDB

## 🤝 Contributing

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

## 📚 Additional Documentation

- **In-app Docs**: Visit `/docs` for user-facing documentation
- **Fees System Strategy**: See `FEES_SYSTEM_STRATEGY.md` for the fees & payments architecture
- **Lesson Notes Spec**: See `edusentrix-lesson-notes-spec.md` for the lesson notes builder specification
- **Lesson Notes Approval Plan**: See `LESSON_NOTES_APPROVAL_WORKFLOW_PLAN.md` for the admin approval workflow

## 📞 Support

For support and inquiries:

- **Email**: support@edusentrix.com
- **Documentation**: Visit `/docs` within the application
- **Issues**: Use GitHub Issues for bug reports

## 📄 License

This project is proprietary and confidential. All rights reserved.

---

**Built with ❤️ by Appsentrix for schools in Ghana & Africa**
