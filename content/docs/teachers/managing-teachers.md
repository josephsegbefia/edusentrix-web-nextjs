# Managing Teachers

Learn how to add, edit, and manage teachers in EduSentrix using the premium teachers management interface.

## Overview

The Teachers Management page provides a comprehensive, industry-standard interface for managing all teacher-related operations. It features a premium design with multiple view modes, advanced search and filtering, bulk operations, and real-time statistics.

## Page Features

### Quick Stats Dashboard

At the top of the page, you'll see quick statistics cards showing:
- **Total Teachers**: Overall teacher count
- **Active Teachers**: Currently active teaching staff
- **Inactive**: Teachers temporarily unavailable
- **Homeroom**: Number of teachers assigned as homeroom teachers

### View Modes

The teachers page supports two view modes that you can switch between:

#### Card View (Default)
- **Color-coded cards** based on status:
  - 🟢 **Green border**: Active teachers
  - 🟡 **Yellow border**: On leave
  - 🔴 **Red border**: Terminated
  - ⚪ **Gray border**: Inactive
- **Teacher information** at a glance:
  - Photo and name
  - Email and contact
  - Employee ID
  - Status badge
  - Homeroom assignment (if applicable)
  - Department
  - Subject assignments
  - Hire date
- **Quick actions** via dropdown menu:
  - View profile
  - Edit details
  - Manage access
  - Send message

#### Table View
- **Comprehensive data** in a sortable table format
- **Columns**:
  - Selection checkbox
  - Teacher (photo, name, email)
  - Employee ID
  - Department
  - Subjects
  - Homeroom
  - Status (Active/Inactive/On Leave/Terminated)
  - Hire Date
  - Actions menu
- **Sortable columns**: Click column headers to sort by name, hire date, or status
- **Bulk selection**: Select multiple teachers for batch operations

### Tabs

Navigate between different teacher views using tabs:

- **All**: Complete directory of all teachers
- **Active**: Currently active teaching staff
- **Inactive**: Temporarily unavailable teachers
- **On Leave**: Teachers currently on leave
- **Terminated**: Former teachers (archived)
- **Homeroom**: Teachers assigned as homeroom teachers

### Search & Filtering

#### Quick Search
- **Search bar**: Located at the top of the page
- **Search by**:
  - Teacher name (first, last)
  - Email address
  - Employee ID
- **Keyboard shortcut**: Press `/` to quickly focus the search input

#### Advanced Filters
- **Filter by Subject**: Show only teachers teaching a specific subject
- **Filter by Class Group**: Show teachers assigned to a specific class (homeroom)
- **Filter by Department**: Show teachers in a specific department
- **Filter by Status**: Active, Inactive, On Leave, or Terminated

### Sorting

Teachers can be sorted by:
- **Name** (A-Z or Z-A)
- **Hire Date** (newest to oldest)
- **Status** (Active → Inactive → On Leave → Terminated)
- **Created Date** (for recently added teachers)

Click any column header in table view to sort. Click again to reverse the order.

### Bulk Operations

Select multiple teachers using checkboxes to perform batch actions:

- **Bulk Actions Bar**: Appears when teachers are selected
- **Available Actions**:
  - Clear selection
  - Export selected (coming soon)
  - Bulk status change (coming soon)
  - Bulk department assignment (coming soon)

### Command Palette

Access quick actions using the command palette:

- **Keyboard shortcut**: Press `Ctrl+K` (Windows/Linux) or `⌘K` (Mac)
- **Available Commands**:
  - Focus teachers search (`/`)
  - Add a new teacher (`N`)
  - Import teachers from CSV
  - Navigate to different tabs
  - View all/active/homeroom teachers

## Adding a New Teacher

### Step-by-Step Process

1. **Navigate to Teachers Page** → Click **"Add Teacher"** button or use command palette (`Ctrl+K` → "Add a new teacher")

2. **Basic Information**:
   - **First Name** (required)
   - **Last Name** (required)
   - **Email** (required): Used for account access and communication
   - **Phone** (optional): Contact number
   - **Photo** (optional): Upload a teacher photo

3. **Professional Details**:
   - **Employee ID** (optional): Unique identifier for the teacher
   - **Department** (optional): Department or subject area
   - **Hire Date** (optional): Date of employment
   - **Status**:
     - **Active**: Currently teaching
     - **Inactive**: Temporarily unavailable
     - **On Leave**: Currently on leave
     - **Terminated**: No longer employed

4. **Assignments**:
   - **Subject Assignment**: Select subjects this teacher teaches
   - **Homeroom Assignment** (optional): Assign as homeroom teacher for a class group

5. **Click "Create Teacher"** to save

### Teacher Roles

#### Subject Teacher
- Teaches specific subjects
- Can teach multiple subjects
- Assigned to multiple classes if needed
- Appears in subject-specific reports

#### Homeroom Teacher
- Manages a specific class group
- Primary point of contact for that class
- Responsible for class administration
- Only one homeroom teacher per class group
- Appears in class-specific reports

## Teacher Detail Page

Click on any teacher card or row to view their detailed profile. The detail page includes:

### Overview Tab
- **Personal Information**: Name, email, phone, photo
- **Professional Details**: Employee ID, department, hire date, termination date
- **Status Badge**: Visual indicator of current status
- **Subject Assignments**: List of all subjects taught
- **Homeroom Assignment**: Class group (if assigned)
- **Quick Actions**: Shortcuts to common tasks
- **Metadata**: Created and updated timestamps

### Assignments Tab
- **View all assignments**: See all class and subject assignments
- **Create new assignment**: Assign teacher to classes and subjects
- **Manage capacity**: Set maximum classes and students
- **Assignment history**: Track changes over time

### Performance Tab (Coming Soon)
- Academic performance metrics
- Subject-wise performance breakdown
- Student feedback and ratings
- Teaching effectiveness indicators

### Attendance Tab (Coming Soon)
- Daily attendance records
- Leave requests and approvals
- Attendance patterns and trends
- Monthly summaries

### Documents Tab (Coming Soon)
- Upload certifications and credentials
- Store ID documents
- Appointment letters
- Expiry date tracking

### Notes Tab (Coming Soon)
- Internal notes and observations
- Performance reviews
- Meeting notes
- Important reminders

### Activity Log Tab (Coming Soon)
- Complete audit trail
- Assignment changes
- Status updates
- Profile edits
- Who did what and when

## Editing Teacher Information

1. Navigate to **Teachers** page
2. Find the teacher using search or filters
3. Click on the teacher card/row to view details
4. Click **"Edit"** button in the detail page header
5. Modify:
   - Personal information
   - Professional details
   - Subject assignments
   - Homeroom assignment
   - Status
6. Save changes

## Subject Assignment

### Assigning Subjects

1. When creating or editing a teacher, go to **Subject Assignment** section
2. Check the boxes for subjects the teacher teaches
3. A teacher can be assigned to multiple subjects
4. Save changes

### Managing Subject Assignments

- **From Detail Page**: Navigate to teacher detail → Assignments tab
- **Add subjects**: Click "Assign Subjects" button
- **Remove subjects**: Uncheck subjects or use remove action
- **View all**: See all subjects taught by the teacher

### Subject Coverage

- Each subject should have at least one assigned teacher
- Teachers can teach multiple subjects
- Subject assignments can be changed at any time
- Changes are tracked in activity log

## Homeroom Assignment

### Assigning a Homeroom Teacher

1. When creating or editing a teacher, select a **Class Group** from the homeroom dropdown
2. Only one teacher can be the homeroom teacher for a class
3. If you assign a new homeroom teacher, the previous one is automatically replaced
4. The homeroom badge appears on the teacher's card and profile

### Homeroom Teacher Responsibilities

- Class management and administration
- Student attendance monitoring
- Parent communication for the class
- Class reports and updates
- Student behavior tracking

### Filtering by Homeroom

- Use the **"Homeroom"** tab to see only homeroom teachers
- Filter by specific class group in advanced filters
- Homeroom badge appears on teacher cards

## Teacher Status

### Active Teachers
- Can be assigned to classes and subjects
- Appear in class lists and reports
- Can access teacher portal (if enabled)
- Included in active teacher count

### Inactive Teachers
- Temporarily removed from assignments
- Historical data preserved
- Can be reactivated later
- Not included in active assignments

### On Leave
- Temporarily unavailable
- Assignments can be maintained or reassigned
- Leave period can be tracked
- Can return to active status

### Terminated
- No longer employed
- Historical data preserved for records
- Cannot be assigned to new classes
- Appears in terminated tab

## Export & Import

### Export Teachers

- **Export All**: Export all teachers matching current filters
- **Export Selected**: Export only selected teachers
- **Formats**: CSV (Excel-compatible)
- **Includes**: All teacher information, assignments, and status

### Import Teachers (Coming Soon)

- **CSV Import**: Bulk import teachers from spreadsheet
- **Template**: Download CSV template with required fields
- **Validation**: Automatic validation of data before import
- **Error Handling**: Clear error messages for invalid data

## Keyboard Shortcuts

- **`/`**: Focus search input
- **`Ctrl+K` / `⌘K`**: Open command palette
- **`N`**: Add new teacher (from command palette)
- **`Esc`**: Close modals/dialogs

## Best Practices

1. **Complete Profiles**: Fill in all available information for better organization
2. **Subject Expertise**: Assign teachers to subjects they specialize in
3. **Balanced Workload**: Distribute subjects and classes evenly
4. **Homeroom Selection**: Choose experienced teachers for homeroom roles
5. **Regular Updates**: Keep teacher information current
6. **Status Management**: Update status promptly when teachers go on leave or are terminated
7. **Documentation**: Upload important documents (certifications, IDs) for record-keeping
8. **Notes**: Add internal notes for important information or observations

## Troubleshooting

### Teacher Not Appearing in Class List
- Check if teacher status is "Active"
- Verify subject assignments match the class subjects
- Ensure homeroom assignment is correct (if applicable)
- Check if teacher is assigned to the specific class

### Cannot Assign Subject
- Verify the subject exists and is active
- Check if subject is available for assignment
- Ensure teacher status is "Active"
- Check teacher's maximum capacity settings

### Homeroom Assignment Issues
- Only one teacher per class group
- Verify class group exists and is active
- Check teacher status (must be Active)
- Previous homeroom teacher is automatically replaced

### Search Not Finding Teacher
- Check spelling of name
- Try searching by email or employee ID
- Clear filters that might be hiding the teacher
- Verify teacher status (inactive/terminated teachers may be filtered)

### Bulk Operations Not Working
- Ensure at least one teacher is selected
- Check if you have permission for bulk operations
- Verify teacher status allows the operation
- Try refreshing the page

## Related Documentation

- [Managing Class Groups](../class-groups/managing-class-groups.md): Learn about class group management
- [Managing Students](../students/managing-students.md): Understand student management
- [Academic Periods](../academic-periods/managing-periods.md): Set up academic periods
- [Initial Setup](../getting-started/initial-setup.md): Get started with EduSentrix
