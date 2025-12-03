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

## ✅ Next Steps

### Most Logical Next Step: Student & Teacher Management Pages

**Why This Makes Sense:**
- ✅ Creation exists but management is missing — modals create records, but no list/edit/view pages
- ✅ Immediate user need — users can create but can't view or manage what they created
- ✅ Enables other features — attendance, reports, and grades depend on student/teacher data
- ✅ Natural progression — creation → management → advanced features
- ✅ No new models needed — Student and Teacher models exist

**What to Build:**

#### Students Management Page (`/admin/students`)
- [ ] List view with search/filter
- [ ] Student detail view
- [ ] Edit student modal/form
- [ ] Delete/deactivate functionality
- [ ] Bulk actions (if needed)

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
