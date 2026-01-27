# Deferred Tasks Tracker

> Tasks that have been deferred because they require other work to be completed first.

---

## 🚧 Blocked Features

### 1. Attendance & Coverage System

**Status:** 🔴 Deferred
**Priority:** High
**Category:** Core Features

**Description:**
Build attendance tracking system with daily tracking, teacher coverage, and substitution management.

**Requirements:**
- Attendance model
- Daily tracking system
- Teacher coverage/substitution system

**Blocked By:**
- Teacher portal for marking attendance
- Attendance data model

**Current Status:**
- Placeholder cards on dashboard
- UI mockup exists but no backend

**Dependencies:**
- `teacher-portal` - Teachers need a portal to mark attendance
- `attendance-model` - Database model for attendance records

---

### 2. Reports & Analytics

**Status:** 🔴 Deferred
**Priority:** High
**Category:** Core Features

**Description:**
Generate comprehensive reports on attendance, grades, fees, and student performance.

**Requirements:**
- Report generation system
- Data aggregation logic
- Export functionality (PDF, Excel)

**Blocked By:**
- Attendance system (for attendance reports)
- Grades/assessments system (for academic reports)
- Fees/payments system (for financial reports)

**Current Status:**
- Placeholder page exists
- No data sources available yet

**Dependencies:**
- `attendance` - Attendance tracking system
- `grades` - Grades/assessments system
- `fees` - Fees & payments system

---

### 3. Fees & Payments Management

**Status:** 🟡 Deferred
**Priority:** Medium
**Category:** Financial Features

**Description:**
Complete fee structure management and payment processing system.

**Requirements:**
- Fee structure model
- Payment model
- Payment gateway integration
- Receipt generation

**Blocked By:**
- Fee structure model doesn't exist
- Payment model doesn't exist
- Payment gateway integration needed

**Current Status:**
- Placeholder page exists
- No models or backend logic

**Dependencies:**
- `fee-model` - Database model for fee structures
- `payment-model` - Database model for payments
- `payment-gateway` - Integration with payment provider

---

### 4. Events & Calendar System

**Status:** 🟡 Deferred
**Priority:** Medium
**Category:** Features

**Description:**
School events management with calendar integration.

**Requirements:**
- Event model
- Calendar system
- Event notifications
- Recurring events support

**Blocked By:**
- Event model doesn't exist
- Calendar UI components needed

**Current Status:**
- Placeholder on dashboard
- No backend or models

**Dependencies:**
- `event-model` - Database model for events
- `calendar-ui` - Calendar component library

---

### 5. Document Management

**Status:** 🟢 Deferred
**Priority:** Low
**Category:** Features

**Description:**
File storage and document management system.

**Requirements:**
- File storage infrastructure
- Upload/management capabilities
- Document categorization
- Version control

**Blocked By:**
- File storage infrastructure needed
- Cloud storage integration (S3, etc.)

**Current Status:**
- Placeholder page exists
- No file handling implemented

**Dependencies:**
- `file-storage` - Cloud storage integration
- `upload-system` - File upload handling

---

## 🚀 Active Development

### Students Management Page (`/admin/students`)

**Status:** 🟡 In Progress
**Priority:** High
**Category:** Core Features

**Description:**
Premium, industry-standard students management page with card/table views, advanced filtering, search, and comprehensive student information display.

**Page Structure:**
- **Route:** `/admin/students`
- **Tabs:** All Students | By Class | Fee Defaulters | Top Performers | Recently Added
- **Default View:** Student cards (grid layout)
- **Alternative View:** Table view (sortable, exportable)

**Features:**

#### 1. Quick Stats Dashboard
- Total students count
- Students owing fees (with total amount)
- Top performers count
- New students this month
- Class distribution visualization

#### 2. Navigation & Filtering
- **Tab Navigation:**
  - All Students (default)
  - By Class (dropdown selector for class groups)
  - Fee Defaulters (students with outstanding fees)
  - Top Performers (academic excellence badge holders)
  - Recently Added (new enrollments)
- **Search Bar:** Global search (name, student ID, admission number, parent name)
- **Advanced Filters Panel:**
  - Class group selector
  - Grade selector
  - Fee status (paid/owing/partial/none)
  - Academic performance tier
  - Enrollment date range
  - Status (active/inactive/withdrawn)
  - Gender
  - Age range
- **Quick Filter Chips:** "Owing Fees", "Top Performers", "New This Month"
- **Sort Options:** Name, Class, Fee Status, Academic Performance, Enrollment Date, Amount Owed

#### 3. Student Card Design
- **Visual Elements:**
  - Student photo (circular, 60-80px, with initials fallback)
  - Full name (bold, 16-18px)
  - Class badge (e.g., "Grade 7A", color-coded by grade)
  - Admission number
  - **Color-coded border/left accent:**
    - Green: All fees paid, good standing
    - Red: Outstanding fees (with amount badge)
    - Yellow/Orange: Partial payment or warning
    - Blue: New student (recently enrolled)
    - Gray: Inactive/graduated
  - **Academic badge** (if top performer): "Top 10%", "A+ Student", etc.
  - **Fee status badge:** Shows amount owed if applicable
  - **Quick actions menu:** View, Edit, Assign Class, Send Message, etc.
- **Layout:** Responsive grid (2-4 columns based on screen size)
- **Hover effects:** Smooth elevation, quick actions reveal

#### 4. Table View
- **Columns:**
  - Photo + Name
  - Admission No
  - Class
  - Fee Status (with amount)
  - Academic Badge
  - Status
  - Enrollment Date
  - Actions (dropdown menu)
- **Features:**
  - Sortable columns
  - Selectable rows (for bulk actions)
  - Export to CSV/Excel
  - Virtual scrolling (for 1000+ students)

#### 5. Bulk Actions
- Select multiple students
- Bulk operations:
  - Assign to class
  - Send message/notification
  - Export selected
  - Mark fees paid (when fees system exists)
  - Change status (activate/deactivate)
  - Generate reports

#### 6. Data Loading
- **Pagination:** 25/50/100 per page (not infinite scroll)
- **Server-side filtering:** All filters applied on backend
- **Optimistic updates:** Immediate UI feedback
- **Skeleton loaders:** While data loads

#### 7. Additional Features
- **Export:** CSV/Excel with current filters applied
- **Keyboard shortcuts:** `/` to focus search, `Cmd/Ctrl + K` for command palette
- **Empty states:** Helpful messages when no students match filters
- **Responsive design:** Mobile-friendly cards, collapsible filters
- **Smooth transitions:** Fade-in animations, view switching

**APIs Needed:**

1. **GET `/api/admin/students`** - List students with filters
   - Query params: `page`, `limit`, `search`, `classGroupId`, `gradeId`, `status`, `feeStatus`, `sortBy`, `sortOrder`, `tab`
   - Returns: `{ students: [], total: number, page: number, totalPages: number }`
   - Includes: student data, class group info, grade info, fee status (placeholder)

2. **GET `/api/admin/students/stats`** - Quick stats
   - Returns: `{ total: number, owing: number, owingAmount: number, topPerformers: number, newThisMonth: number, classDistribution: [] }`

3. **GET `/api/admin/students/[id]`** - Single student details
   - Returns: Full student data with populated relations

4. **PUT `/api/admin/students/[id]`** - Update student
   - Body: Student update fields

5. **DELETE `/api/admin/students/[id]`** - Delete/deactivate student
   - Soft delete (status change) or hard delete

6. **POST `/api/admin/students/bulk`** - Bulk operations
   - Body: `{ action: string, studentIds: string[], data?: object }`

7. **GET `/api/admin/students/export`** - Export students
   - Query params: Same filters as list endpoint
   - Returns: CSV/Excel file

**Task Breakdown:**

#### Phase 1: Foundation & APIs ✅ Completed
- [x] Create `GET /api/admin/students` endpoint with filtering, pagination, search
- [x] Create `GET /api/admin/students/stats` endpoint for quick stats
- [x] Create `GET /api/admin/students/[id]` endpoint for single student
- [x] Create React Query hooks (`useStudents`, `useStudentStats`, `useStudentListData`)
- [x] Add fee status calculation logic (placeholder until fees system exists)

#### Phase 2: Page Structure & Navigation ✅ Completed
- [x] Create `/admin/students` page route
- [x] Build tab navigation component (All | By Class | Fee Defaulters | Top | New)
- [x] Implement tab state management and URL params
- [x] Add "By Class" dropdown selector for class groups
- [x] Create page header with title and "Add Student" button

#### Phase 3: Quick Stats Dashboard ✅ Completed
- [x] Design and build stats cards component (`MetricsStatCard`, `StudentsQuickStatsSection`)
- [x] Integrate stats API and display metrics
- [x] Add class distribution visualization (`ClassDistributionList`)
- [x] Add loading states and error handling
- [x] Premium design styling with gradient cards

#### Phase 4: Search & Filters 🟡 Partially Completed
- [x] Build global search bar with debounce (`StudentsToolbar`)
- [x] Implement filter state management
- [x] Add view toggle component (cards ↔ table)
- [ ] Create advanced filters panel (collapsible) - **TODO**
- [ ] Add quick filter chips component - **TODO**
- [ ] Add sort dropdown component - **TODO**
- [x] Connect filters to API calls

#### Phase 5: Student Cards View ✅ Completed
- [x] Design student card component with all visual elements (`StudentCard`)
- [x] Implement color-coded borders based on fee status (`FeeStatusBadge`)
- [x] Add academic badge component (`AcademicBadgePill`)
- [x] Build quick actions dropdown menu
- [x] Create responsive grid layout (`StudentsCardGrid`)
- [x] Add hover effects and animations
- [x] Implement photo display with initials fallback (`StudentAvatarStatus`)
- [x] Premium design styling with gradient overlays

#### Phase 6: Table View 🔴 Not Started
- [ ] Design table component with all columns
- [ ] Implement sortable columns
- [ ] Add row selection for bulk actions
- [ ] Create actions dropdown per row
- [ ] Add virtual scrolling (if needed for performance)
- [x] Implement view toggle (cards ↔ table) - UI ready, table component pending

#### Phase 7: Pagination & Data Loading 🟡 Partially Completed
- [ ] Build pagination component - **TODO**
- [ ] Add page size selector (25/50/100) - **TODO**
- [x] Implement server-side pagination logic (API ready)
- [x] Add skeleton loaders
- [x] Handle empty states

#### Phase 8: Bulk Actions 🔴 Not Started
- [ ] Add checkbox selection to cards/table
- [ ] Build bulk actions toolbar
- [ ] Create bulk operations API integration
- [ ] Implement bulk assign class
- [ ] Add bulk status change
- [ ] Add bulk export functionality

#### Phase 9: Export & Additional Features 🔴 Not Started
- [ ] Implement CSV export with filters
- [ ] Add Excel export option
- [ ] Implement keyboard shortcuts
- [x] Add empty state components
- [x] Ensure responsive design
- [x] Add smooth transitions and animations

#### Phase 10: Student Detail & Edit 🔴 Not Started
- [ ] Create student detail modal/page
- [ ] Build edit student form (reuse CreateStudentModal logic)
- [ ] Implement update API integration
- [ ] Add delete/deactivate functionality
- [ ] Add activity logging for changes

**Dependencies:**
- Student model exists ✅
- ClassGroup model exists ✅
- Grade model exists ✅
- Fees system (deferred) - Will use placeholder logic for fee status

**Current Status:**
- ✅ Foundation APIs completed (list, stats, single student)
- ✅ Page structure and navigation implemented
- ✅ Quick stats dashboard with premium design
- ✅ Student cards view with all visual elements
- ✅ Search functionality with debounce
- ✅ View toggle (cards/table) - table component pending
- 🟡 Advanced filters panel pending
- 🔴 Table view component pending
- 🔴 Pagination component pending
- 🔴 Bulk actions pending
- 🔴 Export functionality pending
- 🔴 Student detail/edit modal pending

**Progress:** ~60% complete (Phases 1-5 done, Phase 4 partially done)

---

## ✅ Completed Features

### Invitation Management System (`/admin/invitations`)

**Status:** ✅ Completed
**Priority:** High
**Category:** Core Features

**Description:**
Comprehensive invitation tracking and management system for teachers and school admins.

**Features Implemented:**
- ✅ Full invitation CRUD operations
- ✅ Status tracking (pending, accepted, expired, revoked, failed)
- ✅ Resend invitation functionality
- ✅ Revoke invitation functionality
- ✅ Delete invitation functionality
- ✅ CSV export functionality
- ✅ Search and filter capabilities
- ✅ Activity logging for all invitation actions
- ✅ Integration with Clerk for email invitations
- ✅ Premium UI design matching admin dashboard

**APIs Created:**
- ✅ `GET /api/admin/invitations` - List invitations with filters
- ✅ `GET /api/admin/invitations/stats` - Invitation statistics
- ✅ `GET /api/admin/invitations/[id]` - Single invitation details
- ✅ `POST /api/admin/invitations/[id]/resend` - Resend invitation
- ✅ `POST /api/admin/invitations/[id]/revoke` - Revoke invitation
- ✅ `DELETE /api/admin/invitations/[id]` - Delete invitation
- ✅ `GET /api/admin/invitations/export` - Export to CSV

**Models Created:**
- ✅ `Invitation` model with comprehensive tracking fields

**Components Created:**
- ✅ Invitations management page (`/admin/invitations`)
- ✅ React Query hooks (`useInvitations`, `useInvitationStats`, `useResendInvitation`, `useRevokeInvitation`, `useDeleteInvitation`)

---

### Activity Feed & Audit Logging

**Status:** ✅ Completed
**Priority:** Medium
**Category:** Features

**Description:**
System-wide activity tracking and audit logging with real-time updates.

**Features Implemented:**
- ✅ Activity feed component on admin dashboard
- ✅ Activity logging for all major actions
- ✅ Filterable by activity type and date range
- ✅ Real-time updates via Server-Sent Events (SSE)
- ✅ Premium UI design

**APIs Created:**
- ✅ `GET /api/admin/activity` - List activities with filters

**Models Updated:**
- ✅ `Activity` model with comprehensive activity types

**Components Created:**
- ✅ `ActivityFeed` component for dashboard
- ✅ React Query hook (`useActivity`)

---

### Network Health Monitoring

**Status:** ✅ Completed
**Priority:** Low
**Category:** System Features

**Description:**
Real-time network status monitoring with visual indicators and smart notifications.

**Features Implemented:**
- ✅ Network health watcher component
- ✅ Visual network indicator in top bar
- ✅ Smart toast notifications (only for critical transitions)
- ✅ Connection quality tracking (good, degraded, poor, offline)
- ✅ Hydration-safe implementation

**Components Created:**
- ✅ `NetworkHealthWatcher` component
- ✅ `NetworkIndicator` component
- ✅ React hook (`useNetworkHealth`)

---

### Task Tracker Page (`/admin/tasks`)

**Status:** ✅ Completed
**Priority:** Low
**Category:** Developer Tools

**Description:**
Markdown-based task tracking system for managing deferred tasks.

**Features Implemented:**
- ✅ Task tracker page (`/admin/tasks`)
- ✅ Markdown rendering from `content/tasks/deferred-tasks.md`
- ✅ Easy to read, update, and categorize
- ✅ Premium UI design

**APIs Created:**
- ✅ Updated `/api/docs/[...path]` to serve markdown from `content/tasks`

---

### Teacher Creation & Invitation Flow

**Status:** ✅ Completed
**Priority:** High
**Category:** Core Features

**Description:**
Multi-step teacher creation with invitation email system.

**Features Implemented:**
- ✅ Multi-step form (`CreateTeacherModal`)
- ✅ Subject and homeroom class assignments
- ✅ Dynamic search for class groups and subjects
- ✅ Image upload with Cloudinary integration
- ✅ Automatic invitation email via Clerk
- ✅ Activity logging for teacher creation
- ✅ Premium UI matching student creation modal

**APIs Created:**
- ✅ `POST /api/admin/teachers/create` - Create teacher with invitation
- ✅ `GET /api/admin/class-groups/search` - Search class groups
- ✅ `GET /api/admin/subjects/search` - Search subjects

---

## 🚀 Next Steps (Future)

#### Complete Students Management Page
- [ ] Phase 6: Table view component
- [ ] Phase 7: Pagination component
- [ ] Phase 8: Bulk actions
- [ ] Phase 9: Export functionality (CSV/Excel)
- [ ] Phase 10: Student detail/edit modal

#### Teachers Management Page (`/admin/teachers`)
- [ ] List view with search/filter
- [ ] Teacher detail view
- [ ] Edit teacher modal/form
- [ ] View assignments (subjects, homeroom)
- [ ] Delete/deactivate functionality

**Alternative: Academic Periods Management**
- Model exists
- First step in onboarding
- Simpler scope
- But less urgent since creation works via modal

---

## 📝 Notes

- Tasks are automatically loaded from this markdown file
- Mark tasks as complete by updating the status to `✅ Completed`
- Add new tasks by following the format above
- Update dependencies as blockers are resolved
