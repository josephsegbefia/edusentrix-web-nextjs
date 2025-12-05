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

#### Phase 1: Foundation & APIs
- [ ] Create `GET /api/admin/students` endpoint with filtering, pagination, search
- [ ] Create `GET /api/admin/students/stats` endpoint for quick stats
- [ ] Create `GET /api/admin/students/[id]` endpoint for single student
- [ ] Create React Query hooks (`useStudents`, `useStudentStats`, `useStudent`)
- [ ] Add fee status calculation logic (placeholder until fees system exists)

#### Phase 2: Page Structure & Navigation
- [ ] Create `/admin/students` page route
- [ ] Build tab navigation component (All | By Class | Fee Defaulters | Top | New)
- [ ] Implement tab state management and URL params
- [ ] Add "By Class" dropdown selector for class groups
- [ ] Create page header with title and "Add Student" button

#### Phase 3: Quick Stats Dashboard
- [ ] Design and build stats cards component
- [ ] Integrate stats API and display metrics
- [ ] Add class distribution visualization (chart or list)
- [ ] Add loading states and error handling

#### Phase 4: Search & Filters
- [ ] Build global search bar with debounce
- [ ] Create advanced filters panel (collapsible)
- [ ] Implement filter state management
- [ ] Add quick filter chips component
- [ ] Add sort dropdown component
- [ ] Connect filters to API calls

#### Phase 5: Student Cards View
- [ ] Design student card component with all visual elements
- [ ] Implement color-coded borders based on fee status
- [ ] Add academic badge component
- [ ] Build quick actions dropdown menu
- [ ] Create responsive grid layout
- [ ] Add hover effects and animations
- [ ] Implement photo display with initials fallback

#### Phase 6: Table View
- [ ] Design table component with all columns
- [ ] Implement sortable columns
- [ ] Add row selection for bulk actions
- [ ] Create actions dropdown per row
- [ ] Add virtual scrolling (if needed for performance)
- [ ] Implement view toggle (cards ↔ table)

#### Phase 7: Pagination & Data Loading
- [ ] Build pagination component
- [ ] Add page size selector (25/50/100)
- [ ] Implement server-side pagination logic
- [ ] Add skeleton loaders
- [ ] Handle empty states

#### Phase 8: Bulk Actions
- [ ] Add checkbox selection to cards/table
- [ ] Build bulk actions toolbar
- [ ] Create bulk operations API integration
- [ ] Implement bulk assign class
- [ ] Add bulk status change
- [ ] Add bulk export functionality

#### Phase 9: Export & Additional Features
- [ ] Implement CSV export with filters
- [ ] Add Excel export option
- [ ] Implement keyboard shortcuts
- [ ] Add empty state components
- [ ] Ensure responsive design
- [ ] Add smooth transitions and animations

#### Phase 10: Student Detail & Edit
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
- Planning phase complete
- Ready to begin implementation

---

## ✅ Next Steps (Future)

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
