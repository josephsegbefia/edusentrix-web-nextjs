# Welcome to EduSentrix

Welcome to EduSentrix, your comprehensive school management platform designed specifically for schools in Ghana and Africa. This guide will help you get started with setting up and using the platform effectively.

## What is EduSentrix?

EduSentrix is a unified solution for:
- **Student Management**: Track student records, enrollment, and academic progress with a premium, industry-standard interface
- **Teacher Management**: Premium teacher management interface with card/table views, assignments tracking, and comprehensive teacher profiles
- **Fee Collection**: Comprehensive invoice-based fee system with flexible payment allocation, installments, and student credit management
- **Financial Center**: Unified view of all money movements - inflows, outflows, and net position tracking
- **Expense Management**: Track and manage school operational expenses with approval workflows
- **Community Hub**: Engage the school community with polls and fundraising campaigns
- **Academic Tracking**: Monitor academic periods, terms, and progress with detailed gradebooks
- **Master Timetable**: School-wide schedule management with conflict detection
- **Reports & Analytics**: Comprehensive reporting across all modules with export capabilities
- **Parent Communication**: Keep parents informed via email and invitations
- **Activity & Audit Logging**: Comprehensive activity feed tracking all system actions

## Key Features

### Premium User Interface
- **Modern Design**: Industry-standard premium design with gradient cards, smooth animations, and intuitive navigation
- **Responsive Layout**: Works seamlessly on desktop, tablet, and mobile devices
- **Multiple View Modes**: Switch between card and table views for different data presentation needs
- **Command Palette**: Quick actions via keyboard shortcuts (`⌘K` / `Ctrl+K`)
- **Network Health Monitoring**: Real-time network status indicators

### Student Management
- **Card & Table Views**: Choose your preferred way to view student data
- **Advanced Search**: Search by name, admission number, or parent name
- **Smart Filtering**: Filter by class, grade, fee status, academic performance, and more
- **Bulk Operations**: Manage multiple students at once
- **Color-Coded Cards**: Visual indicators for fee status and student status
- **Academic Badges**: Track top performers with performance badges
- **Export Functionality**: Export student data to CSV for reporting

### Teacher Management
- **Premium Card & Table Views**: Industry-standard interface matching students page design
- **Card View (Default)**: Color-coded cards based on teacher status (Active, On Leave, Terminated, Inactive)
- **Advanced Search**: Search by name, email, or employee ID
- **Smart Filtering**: Filter by subject, class group, department, and status
- **Teacher Detail Pages**: Comprehensive profiles with multiple tabs:
  - Overview: Personal info, professional details, subject assignments
  - Assignments: View and manage class and subject assignments
  - Performance: Teaching performance metrics (coming soon)
  - Attendance: Attendance records and leave management (coming soon)
  - Documents: Certification and document storage (coming soon)
  - Notes: Internal notes and observations (coming soon)
  - Activity: Complete audit log of teacher-related actions (coming soon)
- **Command Palette**: Quick actions via keyboard shortcuts (`⌘K` / `Ctrl+K`)
- **Bulk Operations**: Select multiple teachers for batch actions
- **Assignment Management**: Create and manage teacher assignments to classes and subjects
- **Status Management**: Track teacher status (Active, Inactive, On Leave, Terminated)

### Fees & Payments
- **Fees Dashboard**: Comprehensive financial overview with revenue tracking, invoice status, and collection metrics
- **Invoice Management**: Create single or bulk invoices with flexible line items and installment support
- **Payment Recording**: Record payments with flexible allocation to invoice line items
- **Fee Structures**: Manage reusable fee templates for consistent invoicing
- **Student Credit**: Handle overpayments and prepayments with formal credit ledger
- **Real-Time Updates**: Live dashboard updates via Server-Sent Events (SSE)
- **Bulk Operations**: Issue, cancel, and export invoices in bulk
- **Invoice Adjustments**: Add waivers, scholarships, and corrections to issued invoices
- **Payment Methods**: Support for Cash, Mobile Money, Bank Transfer, and Card payments

### Financial Center
- **Unified View**: All money movements in one dashboard
- **Inflow/Outflow Tracking**: Monitor income and expenses
- **Net Position**: Track overall financial health
- **Category Breakdowns**: Visual analysis by category
- **Transaction Ledger**: Complete transaction history
- **Manual Transactions**: Record transactions not auto-captured
- **Budget Management**: Create and track budgets

### Expense Management
- **Expense Tracking**: Record all operational expenses
- **Category Organization**: Organize by expense type
- **Vendor Management**: Track payments to suppliers
- **Approval Workflow**: Multi-step approval process
- **Payment Processing**: Mark expenses as paid
- **Attachment Support**: Upload receipts and invoices

### Community Hub
- **Polls & Surveys**: Create school-wide polls and surveys
- **Fundraising Campaigns**: Launch and track fundraising initiatives
- **Approval Workflow**: Review community content before publishing
- **Progress Tracking**: Real-time donation and voting progress
- **Public Sharing**: Shareable donation links
- **Campaign Updates**: Post progress updates to donors

### Master Timetable
- **School-Wide View**: See all class schedules at a glance
- **Conflict Detection**: Automatic identification of scheduling conflicts
- **Day/Class Filtering**: Focus on specific days or classes
- **Schedule Editing**: Modify schedules directly from timetable
- **Session Tracking**: Monitor teaching sessions and coverage

### Reports & Analytics
- **Multi-Category Reports**: Fees, Students, Teachers, Attendance, Academics
- **Interactive Charts**: Visual data representations
- **Flexible Filtering**: Custom date ranges and academic periods
- **Export Capabilities**: Download reports as CSV
- **Report Library**: Pre-built reports for common needs
- **Snapshot Preview**: Quick summary of key metrics

### Dashboard & Analytics
- **Quick Stats**: Real-time metrics at a glance
- **Activity Feed**: Track all system actions and changes
- **Class Distribution**: Visual breakdown of students across classes
- **Revenue Tracking**: Monitor fee collection and outstanding balances
- **Performance Metrics**: Track student and teacher statistics

### System Features
- **Activity Logging**: Comprehensive audit trail of all actions
- **Invitation Management**: Track and manage teacher, admin, and parent invitations
- **Task Tracker**: Keep track of deferred tasks and project milestones
- **Subject Management**: Create and manage curriculum subjects
- **Custom Toast System**: User-friendly notifications and feedback
- **Loading States**: Skeleton loaders and busy indicators for better UX
- **Error Handling**: Graceful error boundaries and error messages

## Getting Started

Before you can start using EduSentrix, you'll need to complete a few essential setup steps:

1. **Create Academic Period** - Set up your school's term and academic year
2. **Create Class Groups** - Organize students into classes
3. **Add Teachers** - Add your teaching staff and assign subjects
4. **Add Students** - Enroll students and assign them to classes

Don't worry - we'll guide you through each step with helpful prompts and visual indicators!

## Navigation

The main dashboard provides quick access to:
- **Quick Actions**: Common tasks like creating students, teachers, and class groups
- **Academic Period**: View and manage your current term
- **Metrics**: Track students, teachers, subjects, and revenue at a glance
- **Activity Feed**: See recent system actions and changes
- **Reports**: Generate reports and analytics

### Main Sections

- **Dashboard** (`/admin`): Overview of school operations and quick stats
- **Students** (`/admin/students`): Comprehensive student management with card/table views
- **Teachers** (`/admin/teachers`): Teacher management and assignments
- **Classes** (`/admin/classes`): Class group management and student assignments
- **Subjects** (`/admin/subjects`): Curriculum subject management
- **Fees & Payments** (`/admin/fees`): Financial management, invoice creation, and payment tracking
- **Expenses** (`/admin/expenses`): Track and manage operational expenses
- **Financial Center** (`/admin/finance`): Unified view of all money movements
- **Community Hub** (`/admin/community`): Polls and fundraising campaigns
- **Timetable** (`/admin/timetable`): Master schedule management
- **Reports** (`/admin/reports`): Analytics and report exports
- **Invitations** (`/admin/invitations`): Track and manage invitations
- **Tasks** (`/admin/tasks`): View deferred tasks and project milestones
- **Settings** (`/admin/settings`): School configuration options
- **Documentation** (`/docs`): Access help documentation and guides

## Keyboard Shortcuts

Speed up your workflow with keyboard shortcuts:

- **`/`**: Focus search input (on students or teachers page)
- **`⌘K` / `Ctrl+K`**: Open command palette for quick actions
- **`N`**: Add new student/teacher (from command palette)
- **`I`**: Import students/teachers (from command palette)

## Tips for Success

1. **Use Search**: Don't scroll through long lists - use search to find students quickly
2. **Bulk Operations**: Select multiple items to perform batch actions
3. **Monitor Activity**: Check the activity feed to stay informed about system changes
4. **Export Regularly**: Export data for backup and reporting purposes
5. **Use Filters**: Leverage filters to focus on specific student groups
6. **Keyboard Shortcuts**: Learn shortcuts for faster navigation
7. **Check Stats**: Monitor quick stats dashboard for insights

## Need Help?

- **Documentation**: Use the search function to find specific topics
- **Command Palette**: Press `⌘K` / `Ctrl+K` to access quick actions
- **Help Icons**: Look for help icons (?) on pages for contextual guidance
- **Activity Feed**: Review activity feed to see what actions were taken

## Recent Updates

### Community Hub (New!)
- Create and manage school-wide polls
- Launch fundraising campaigns with goal tracking
- Approval workflow for community content
- Real-time progress tracking for campaigns
- Public donation pages with Paystack integration
- Campaign updates and donor management
- Export poll results and donor lists

### Financial Center (New!)
- Unified dashboard for all money movements
- Track total inflows and outflows
- Net position and financial health monitoring
- Category-based income and spending breakdowns
- Transaction ledger with full history
- Budget creation and tracking
- Manual transaction recording
- Integration with Fees and Expenses modules

### Expense Management (New!)
- Record and categorize operational expenses
- Multi-step approval workflow
- Vendor management and tracking
- Attachment support for receipts
- Payment processing and tracking
- Category-based organization
- Integration with Financial Center

### Reports & Analytics (New!)
- Comprehensive report filters (date range and academic period)
- Interactive charts across all categories:
  - Fees: Revenue trends, payment methods, invoice status
  - Students: Enrollment trends, grade distribution, status
  - Teachers: Staff status, departments, assignments
  - Attendance: Rate trends, status distribution
  - Invitations: Sent trends, status, roles
  - Academics: Subject averages, pass rates
  - Activity: Volume trends, top activity types
- Report library with export capabilities
- Recent exports tracking and download

### Master Timetable (New!)
- School-wide schedule overview
- Filter by day, grade, or class
- Automatic conflict detection
- Schedule editing from timetable view
- Session and coverage tracking
- Quick statistics dashboard

### Subject Management (New!)
- Create and manage curriculum subjects
- Assign teachers to subjects
- Link subjects to class groups
- Department organization
- Bulk subject creation

### Fees & Payments System
- Comprehensive fees dashboard with real-time metrics
- Single and bulk invoice creation with student search
- Flexible payment allocation to invoice line items
- Installment schedule support (custom and auto-generated)
- Student credit management with formal ledger
- Invoice adjustments (waivers, scholarships, corrections)
- Bulk operations (issue, cancel, export invoices)
- Invoice event timeline for complete audit trail
- Premium UI matching admin dashboard design
- Real-time updates via Server-Sent Events (SSE)

### Students Management
- Premium card and table view modes
- Advanced search with keyboard shortcuts
- Bulk operations for efficient management
- Color-coded cards based on fee status
- Academic performance badges with detailed gradebook
- Overall performance trends with charts
- Subject performance analysis over time
- Guardian management with real-time updates
- Export functionality
- Command palette integration

### Teachers Management
- Premium card and table view modes
- Status-based color coding (Active, On Leave, Terminated, Inactive)
- Advanced search and filtering (subject, class group, department)
- Teacher detail pages with comprehensive tabs
- Assignment management system for classes and subjects
- Schedule management through assignments
- Command palette with teacher-specific actions
- Quick stats dashboard
- Bulk selection and operations
- Professional information tracking

### Invitation Management
- Track all sent invitations
- Status monitoring (Pending, Accepted, Expired, Revoked)
- Resend and revoke capabilities
- Role-based invitation tracking (Teacher, Admin, Parent)
- Export invitation data
- Integration with Clerk authentication

### Dashboard Enhancements
- Activity feed with real-time updates
- Enhanced quick stats cards
- Class distribution visualization
- Network health monitoring
- Improved loading states

### System Improvements
- Comprehensive activity logging
- Task tracker for deferred tasks
- Custom toast notification system
- Improved error handling

Let's get started!
