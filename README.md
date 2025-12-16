# EduSentrix

> Modern school management system for Ghana & Africa — Collect fees, run operations, and delight parents on one unified platform.

[![Next.js](https://img.shields.io/badge/Next.js-16.0-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-8.19-green)](https://www.mongodb.com/)
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

EduSentrix is a comprehensive school management platform designed specifically for schools in Ghana and Africa. It provides a unified solution for fee collection, student records management, academic period tracking, class management, and parent communication. The platform supports multiple user roles and integrates with payment providers like Paystack and Mobile Money services.

### Key Highlights

- **Multi-tenant Architecture**: Supports multiple schools with role-based access control
- **Payment Integration**: Seamless integration with Paystack and Mobile Money providers
- **Real-time Updates**: Server-Sent Events (SSE) for live dashboard updates
- **Modern UI/UX**: Built with Tailwind CSS v4 and shadcn/ui components
- **Type-safe**: Full TypeScript implementation with strict type checking
- **Scalable**: Built on Next.js 16 with App Router for optimal performance

## ✨ Features

### Core Functionality

- **Student Management**
  - Student enrollment and profile management
  - Premium students management page with card/table views
  - Advanced search, filtering, and sorting
  - Class and grade assignments
  - Comprehensive student detail pages with multiple tabs:
    - Overview: Personal info, stats, and quick actions
    - Academics: Complete gradebook with analytics, charts, and performance tracking
    - Fees: Payment history and outstanding balances
    - Behaviour: Incident tracking and positive notes
    - Relationships: Guardian management and class assignments
    - Activity: Complete audit log of student-related actions
  - Guardian/parent management with real-time updates:
    - Add, edit, and remove guardians
    - Primary guardian designation (one per student)
    - Parent account creation with Clerk invitations
    - Occupation and contact information tracking
    - Photo uploads via Cloudinary
    - Real-time updates via Server-Sent Events (SSE)
  - Academic records tracking
  - Fee status tracking and color-coded student cards
  - Academic performance badges (Top 1%, Top 5%, Top 10%, Honours)
  - Bulk actions and export functionality

- **Fee Management & Payments**
  - Invoice-based fee system (one invoice per student per term)
  - Flexible line-item payment allocation (parents choose what to pay first)
  - Per-line-item installment support with flexible payment order
  - Student credit/wallet system for overpayments
  - Append-only invoice model with adjustments (no mutations after issue)
  - Full reconciliation system (Internal Ledger ↔ Gateway ↔ Bank Statements)
  - Payment intent tracking (gateway-safe architecture)
  - Financial-grade accuracy (money stored as integers in minor units)
  - Comprehensive audit trail with invoice event timeline
  - Automated reminders for installments and overdue payments
  - Outstanding balance management with reconciliation status
  - Bank statement import and matching
  - Paystack integration with webhook deduplication

- **Academic Period Management**
  - Term and academic year configuration
  - Period progress tracking
  - Date range management

- **Academic Performance & Gradebook**
  - Comprehensive student analytics dashboard
  - Subject performance overview (top/bottom performers)
  - Overall performance trend charts with class comparison
  - Subject-specific performance tracking over time
  - Assessment breakdown with detailed CA and exam scores
  - Risk level calculation (low/medium/high)
  - Multi-term historical data visualization
  - Class average comparisons
  - Teacher comments and notes
  - Interactive charts with filters (year, subject, term)
  - Premium visualizations using Recharts

- **Teacher Management**
  - Teacher creation with multi-step onboarding
  - Subject and homeroom class assignments
  - Teacher invitation system with email notifications
  - Search and filter capabilities
  - Image upload with Cloudinary integration

- **Class & Subject Management**
  - Automatic grade seeding based on school type (Basic: Creche → JHS3, SHS: SHS1-3)
  - Automatic subject creation for Basic schools (Ghana curriculum)
  - Class group creation with flexible naming strategies (letters, numbers, custom names)
  - Subject configuration and assignment
  - Teacher assignments to class groups
  - Dynamic search for class groups and subjects

- **User Roles & Permissions**
  - Platform Admin: Manage school applications and platform settings
  - School Admin: Full school management capabilities
  - Teacher: Class and student management
  - Parent: View student information and make payments
  - Student: Access personal academic information

- **School Onboarding**
  - Application submission workflow
  - School provisioning with Paystack subaccount creation
  - Guided onboarding process

- **Invitation Management**
  - Comprehensive invitation tracking system
  - Invite teachers and school admins via email
  - Track invitation status (pending, accepted, expired, revoked, failed)
  - Resend and revoke invitations
  - Export invitation data to CSV
  - Activity logging for all invitation actions

- **Activity & Audit Logging**
  - Comprehensive activity feed on admin dashboard
  - Track all system actions (student/teacher creation, invitations, guardian management, etc.)
  - Filterable by activity type and date range
  - Real-time updates via Server-Sent Events (SSE)
  - Student-specific activity logs on detail pages

- **Guardian & Parent Management**
  - Multi-step guardian creation form with photo upload
  - Relationship selection (Mother, Father, Guardian, etc.)
  - Primary contact designation (one per student)
  - Parent account creation with Clerk invitation system
  - Occupation and contact information tracking
  - Real-time guardian list updates via SSE
  - Support for parents linked to multiple students
  - Automatic cleanup when parent has no remaining student links

- **Analytics & Reporting**
  - Real-time dashboard metrics
  - Revenue tracking
  - Collection rate analysis
  - Student and teacher statistics
  - Quick stats cards with trend indicators
  - Class distribution visualization

- **Document Management**
  - File uploads with Cloudinary integration
  - Document organization and access control

### Platform Features

- **Command Palette**: Quick actions via ⌘K / Ctrl+K
- **Responsive Design**: Mobile-first approach with adaptive layouts
- **Custom Toast System**: User feedback with custom toast provider
- **Loading States**: Skeleton loaders and busy indicators
- **Error Boundaries**: Graceful error handling
- **Network Health Monitoring**: Real-time network status tracking with visual indicators
- **Task Tracker**: Markdown-based deferred tasks tracking system
- **Premium UI Design**: Modern, industry-standard design with gradient cards and animations
- **Real-time Updates**: Server-Sent Events (SSE) for live data synchronization:
  - Student counts on dashboard
  - Teacher counts on dashboard
  - Subject counts on dashboard
  - Guardian lists on student detail pages
  - Academic period updates
- **Fixed Navigation**: AppTopbar stays fixed at top for better navigation experience
- **Optimized Data Fetching**: React Query with smart caching and no automatic refetching on window focus for better performance

## 🛠 Tech Stack

### Frontend

- **Framework**: [Next.js 16.0.1](https://nextjs.org/) (App Router)
- **Language**: [TypeScript 5](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/) (Radix UI primitives)
- **State Management**: [TanStack Query (React Query)](https://tanstack.com/query)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Date Handling**: [date-fns](https://date-fns.org/)

### Backend

- **Runtime**: Node.js (via Next.js API Routes)
- **Database**: [MongoDB](https://www.mongodb.com/) with [Mongoose](https://mongoosejs.com/)
- **Authentication**: [Clerk](https://clerk.com/)
- **File Storage**: [Cloudinary](https://cloudinary.com/)
- **Email**: [Brevo (Sendinblue)](https://www.brevo.com/)

### Payment Integration

- **Payment Gateway**: [Paystack](https://paystack.com/)
- **Mobile Money**: MTN MoMo, Vodafone Cash, AirtelTigo (via Paystack)

### Development Tools

- **Package Manager**: npm
- **Linting**: ESLint with Next.js config
- **Type Checking**: TypeScript strict mode
- **React Compiler**: Babel React Compiler (experimental)

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher (or yarn/pnpm)
- **MongoDB**: v6.0 or higher (local or Atlas)
- **Git**: For version control

### Recommended Tools

- **VS Code**: With TypeScript and ESLint extensions
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

# Cloudinary
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Paystack
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
│   │   │   │   ├── students/   # Students management page
│   │   │   │   ├── teachers/   # Teachers management page
│   │   │   │   ├── invitations/# Invitation management page
│   │   │   │   ├── tasks/      # Task tracker page
│   │   │   │   └── ...         # Other admin pages
│   │   │   ├── teacher/        # Teacher portal
│   │   │   ├── parent/         # Parent portal
│   │   │   ├── student/        # Student portal
│   │   │   └── platform/       # Platform admin portal
│   │   ├── (public)/           # Public routes
│   │   │   └── authentication/ # Auth pages
│   │   ├── (school)/           # School-specific routes
│   │   │   └── onboarding/     # School onboarding
│   │   ├── api/                # API routes
│   │   │   ├── admin/          # Admin APIs
│   │   │   │   ├── students/   # Student management APIs
│   │   │   │   ├── teachers/   # Teacher management APIs
│   │   │   │   ├── invitations/# Invitation management APIs
│   │   │   │   └── ...         # Other admin APIs
│   │   │   ├── onboarding/     # Onboarding APIs
│   │   │   ├── periods/        # Academic period APIs
│   │   │   ├── platform/       # Platform APIs
│   │   │   ├── docs/           # Documentation API
│   │   │   └── ...             # Other API endpoints
│   │   ├── auth/               # Auth callbacks
│   │   ├── dashboard/         # Main dashboard
│   │   └── layout.tsx          # Root layout
│   ├── components/             # React components
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── app/                # App-specific components
│   │   ├── auth/               # Auth components
│   │   ├── admin/              # Admin-specific components
│   │   │   ├── students/       # Student management components
│   │   │   └── stats/          # Dashboard stats components
│   │   ├── modals/             # Modal components
│   │   ├── nav/                # Navigation components
│   │   ├── system/             # System components (network health, etc.)
│   │   └── platform/           # Platform-specific components
│   ├── constants/              # Application constants
│   │   ├── grade-templates.ts  # Grade templates (Basic/SHS)
│   │   └── ghana-basic-subjects.ts  # Ghana curriculum subjects
│   ├── db/                     # Database utilities
│   ├── hooks/                  # Custom React hooks
│   ├── lib/                    # Utility libraries
│   │   ├── auth/               # Auth utilities
│   │   ├── banks/              # Bank utilities
│   │   ├── email/              # Email utilities
│   │   └── jobs/               # Background jobs
│   ├── models/                 # Mongoose models
│   ├── providers/              # React context providers
│   └── middleware.ts           # Next.js middleware
├── content/                    # Content files
│   ├── docs/                   # Documentation markdown files
│   └── tasks/                  # Task tracking markdown files
├── data/                       # Seed data files
│   └── bank_sort_codes.csv     # Bank branch data
├── scripts/                    # Utility scripts
│   ├── backfill-user-memberships.ts
│   ├── createPlatformAdmin.ts
│   ├── migrateRolesToRole.ts
│   └── seed-bank-branches.ts
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

### TypeScript Paths

The project uses path aliases configured in `tsconfig.json`:

- `@/*` → `src/*`
- `@/components` → `src/components`
- `@/lib` → `src/lib`
- `@/hooks` → `src/hooks`

## 📜 Scripts

### Development Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
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

### Admin Scripts

```bash
# Create platform admin user
npm run admin:create
```

## 🗄 Database

### MongoDB Models

The application uses Mongoose models located in `src/models/`:

- **User**: User accounts and authentication
- **School**: School information and settings
- **Student**: Student records
- **Grade**: Grade levels (automatically seeded based on school type)
- **ClassGroup**: Class/grade groups
- **Subject**: Subject/course definitions (auto-created for Basic schools)
- **AcademicPeriod**: Term and academic year periods
- **SubjectGrade**: Subject-level grades with CA and exam breakdowns
- **TermResult**: Term-level aggregated results with class position
- **Assessment**: Individual assessment records (CA, exam, etc.)
- **TeacherComment**: Teacher comments and notes per subject/term
- **GradingScale**: Configurable grading scales and grade mappings
- **Application**: School application submissions
- **BankBranch**: Bank branch information
- **Invitation**: Comprehensive invitation tracking (status, expiry, resend count, metadata)
- **Activity**: System-wide activity logging and audit trail
- **Invite**: Legacy user invitation system
- **UserMembership**: User-school associations
- **Guardian**: Student-guardian relationships with primary contact designation
- **FeeStructure**: Fee type templates (Tuition, Library, Sports, etc.)
- **Invoice**: Student invoices per academic period (unique per student per term)
- **InvoiceLineItem**: Individual fees within invoices (ordered by importance)
- **PaymentIntent**: Payment attempt/initiation tracking (gateway-safe)
- **Payment**: Completed payment transactions with allocations
- **PaymentAllocation**: How payments are split across line items
- **InstallmentSchedule**: Explicit installment schedules per line item
- **StudentCreditBalance**: Student credit/wallet for overpayments
- **InvoiceEvent**: Invoice timeline/audit trail
- **GatewayEvent**: Gateway webhook event log (dedupe-safe)
- **GatewaySettlement**: Paystack settlement/payout tracking
- **BankStatementImport**: Imported bank statement files
- **BankStatementLine**: Individual bank statement transactions
- **ReconciliationSession**: Reconciliation workflow sessions
- **ReconciliationMatch**: Matches between bank statements and payments
- **ReconIssue**: Reconciliation issues requiring attention

### Database Connection

The database connection is handled in `src/db/connectToDatabase.ts` with connection pooling and error handling.

### Indexes

Models include appropriate indexes for performance:
- Email lookups
- Status filtering
- School associations
- Timestamp sorting

## 🔒 Authentication

### Clerk Integration

EduSentrix uses [Clerk](https://clerk.com/) for authentication:

- **Multi-factor Authentication**: Supported via Clerk
- **Password Management**: Enforced password creation for new users
- **Session Management**: Handled by Clerk middleware
- **User Roles**: Stored in MongoDB, validated via middleware

### Role-Based Access Control

Roles are defined in `src/lib/roles.ts`:

- `platform_admin`: Platform management
- `school_admin`: School administration
- `teacher`: Teaching staff
- `parent`: Parent/guardian access
- `student`: Student access

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
- Cloudinary production credentials
- Paystack production keys
- Brevo production API key

### Recommended Platforms

- **Vercel**: Optimized for Next.js deployments
- **Netlify**: Alternative platform with good Next.js support
- **Self-hosted**: Docker containerization recommended

### Deployment Checklist

- [ ] Set all production environment variables
- [ ] Configure MongoDB Atlas (if using cloud)
- [ ] Set up Clerk production instance
- [ ] Configure Cloudinary production account
- [ ] Set up Paystack production account
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
- Ensure tests pass (if applicable)
- Update documentation as needed
- Follow existing code style

## 📞 Support

For support and inquiries:

- **Email**: support@edusentrix.com
- **Documentation**: [Coming soon]
- **Issues**: Use GitHub Issues for bug reports

## 📄 License

This project is proprietary and confidential. All rights reserved.

---

**Built with ❤️ by Appsentrix for schools in Ghana & Africa**
