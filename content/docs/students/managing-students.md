# Managing Students

Learn how to add, edit, and manage students in EduSentrix using the premium students management interface.

## Overview

The Students Management page provides a comprehensive, industry-standard interface for managing all student-related operations. It features a premium design with multiple view modes, advanced search and filtering, bulk operations, and real-time statistics.

## Page Features

### Quick Stats Dashboard

At the top of the page, you'll see quick statistics cards showing:
- **Total Students**: Overall student count with new enrollments this month
- **Fee Defaulters**: Number of students with outstanding balances and total amount owed
- **Top Performers**: Students achieving academic excellence
- **New This Month**: Recent enrollments
- **Class Distribution**: Visual breakdown of students across classes

### View Modes

The students page supports two view modes that you can switch between:

#### Card View (Default)
- **Color-coded cards** based on fee status:
  - 🟢 **Green border**: Fees cleared
  - 🔴 **Red border**: Outstanding fees
  - 🟡 **Yellow border**: Partial payment
  - 🔵 **Blue border**: New students (no fee data yet)
- **Student information** at a glance:
  - Photo and name
  - Class assignment
  - Admission number
  - Fee status badge
  - Academic performance badge
  - Latest average (if available)
- **Quick actions** via dropdown menu:
  - View profile
  - Edit details
  - Assign/change class
  - Record payment
  - Message parent

#### Table View
- **Comprehensive data** in a sortable table format
- **Columns**:
  - Selection checkbox
  - Student (photo, name, class)
  - Admission Number
  - Class
  - Fee Status
  - Academic Performance
  - Status (Active/Inactive/Withdrawn)
  - Enrollment Date
  - Actions menu
- **Sortable columns**: Click column headers to sort by name, class, fee status, academic performance, or enrollment date
- **Bulk selection**: Select multiple students for batch operations

### Tabs

Navigate between different student views using tabs:

- **All Students**: Complete directory of all enrolled students
- **By Class**: Browse students grouped by class
- **Fee Defaulters**: Students with outstanding balances
- **Top Performers**: High-achieving students academically
- **Recently Added**: Students enrolled or added this month

### Search & Filtering

#### Quick Search
- **Search bar**: Located at the top of the page
- **Search by**:
  - Student name (first, middle, last)
  - Admission number
  - Parent/guardian name
- **Keyboard shortcut**: Press `/` to quickly focus the search input

#### Advanced Filters (Coming Soon)
- Filter by grade
- Filter by class group
- Filter by fee status
- Filter by student status
- Filter by academic performance tier
- Filter by gender
- Filter by enrollment date range

### Sorting

Students can be sorted by:
- **Name** (A-Z or Z-A)
- **Class** (alphabetical)
- **Fee Status** (cleared → owing)
- **Academic Performance** (highest to lowest)
- **Enrollment Date** (newest to oldest)
- **Created Date** (for recently added students)

Click any column header in table view to sort. Click again to reverse the order.

### Bulk Operations

When you select one or more students (using checkboxes), a bulk actions bar appears at the bottom of the screen with options to:

- **Assign Class**: Assign selected students to a class group
- **Message Parents**: Send messages to parents of selected students
- **Mark Fees Cleared**: Update fee status for multiple students
- **Export Selected**: Export selected students to CSV
- **Change Status**: Update student status (active/inactive/withdrawn)
- **More Actions**: Additional bulk operations via dropdown

### Command Palette

Access quick actions via the command palette:

- **Keyboard shortcut**: Press `⌘K` (Mac) or `Ctrl+K` (Windows/Linux)
- **Available actions**:
  - Focus search (`/`)
  - Add new student (`N`)
  - Import students (`I`)
  - Navigate to tabs (All, By Class, Fee Defaulters, Top Performers, Recent)
- **Fuzzy search**: Type to filter available commands

### Export Functionality

Export student data to CSV:

- **Export All**: Click "Export list" button in the toolbar to export all visible students
- **Export Selected**: Select specific students and use "Export selected" from bulk actions
- **Export includes**:
  - Student name and details
  - Admission number
  - Class assignment
  - Fee status and amounts
  - Academic performance
  - Enrollment date
  - Contact information

### Pagination

Navigate through large student lists:

- **Page size options**: 25, 50, or 100 students per page
- **Page navigation**: Previous/Next buttons
- **Page indicator**: Shows current page and total pages
- **Results summary**: Displays range of students shown (e.g., "Showing 1-25 of 150")

## Adding a New Student

### Step-by-Step Process

1. **Navigate to Students Page** → Click **"Add Student"** button in the header

2. **Basic Information**:
   - **First Name** (required)
   - **Middle Name** (optional)
   - **Last Name** (required)
   - **Admission Number**: Unique identifier for the student (optional but recommended)
   - **Sex**: Male or Female
   - **Date of Birth**: Used for age calculations
   - **Enrollment Date**: When the student joined the school

3. **Photo & Status**:
   - Upload a student photo (supports JPG, PNG)
   - Set status:
     - **Active**: Currently enrolled
     - **Inactive**: Temporarily inactive
     - **Withdrawn**: No longer enrolled

4. **Grade & Class Assignment**:
   - Select the **Grade** (e.g., JHS1, Primary 5)
   - Select the **Class Group** (filtered by grade)
   - Students must belong to both a grade and a class group

5. **Subject Overrides** (optional):
   - **Add Subjects**: Assign additional subjects not in the class default
   - **Remove Subjects**: Exclude subjects from the class default

### Tips

- **Admission Numbers**: Use a consistent format (e.g., "2024-001", "JHS1-045")
- **Photos**: High-quality photos help with identification and reports
- **Subject Overrides**: Useful for students with special arrangements

## Editing Student Information

1. Navigate to **Students** page
2. Find the student using search or filters
3. Click on the student card or row to view details
4. Click **"Edit"** from the actions menu
5. Modify information
6. Save changes

**Keyboard shortcut**: You can also use the command palette (`⌘K` / `Ctrl+K`) and search for the student by name.

## Student Detail Page

Clicking on any student opens a comprehensive detail page with multiple tabs for managing all aspects of the student's record.

### Overview Tab

The default tab showing:
- **Student Header**: Photo, name, admission number, class, and status badges
- **Quick Stats Cards**:
  - Overall Average (academic performance)
  - Attendance percentage
  - Fee status summary
  - Recent activity count
- **Personal Information**: Date of birth, age, enrollment date
- **Class Information**: Current grade and class group assignment

### Academics Tab

A comprehensive gradebook and analytics dashboard for tracking student academic performance:

#### Summary Cards
Four key metrics displayed at the top:
- **Overall Average**: Current term average with trend indicator (up/down/stable)
- **Class Position**: Student's rank in class with total student count
- **Performance Tier**: Auto-calculated tier (top, above_average, average, at_risk)
- **Risk Level**: Risk assessment (low/medium/high) with strongest and weakest subjects

#### Subject Performance Overview
Visual card-based display showing:
- **Top 3 Performers**: Best-performing subjects with scores and grade letters
- **Areas for Improvement**: Bottom 3 subjects needing attention
- Color-coded cards (green for strengths, amber/red for weaknesses)
- Rank indicators and clear subject identification

#### Overall Performance Trend
Interactive line chart displaying:
- **Student Performance**: Blue solid line showing performance over time
- **Class Average**: Gray dashed line for comparison
- **Academic Year Labels**: Clear term labels with year (e.g., "2024 Term 1")
- **Year Filter**: Dropdown to filter by specific academic year
- **Multi-term History**: View performance across multiple terms and years
- **Hover Tooltips**: Detailed information on hover showing both student and class averages

#### Subject Performance Over Time
Deep-dive analysis for individual subjects:
- **Subject Selector**: Choose any subject to analyze
- **Year Filter**: Filter by academic year
- **Trend Visualization**: Line chart showing subject performance across terms
- **Pass Reference Line**: Visual indicator at 50% pass mark
- **Current Score Display**: Summary card showing current term performance
- **Term Labels**: Full academic period labels (e.g., "2024 Term 1")

#### Academic Performance Table
Comprehensive gradebook table with:
- **Subject Breakdown**: All subjects with CA, Exam, and Total scores
- **Grade Letters**: Letter grades based on grading scale
- **Teacher Names**: Subject teacher information
- **View Breakdown Button**: Click to see detailed assessment breakdown

#### Assessment Breakdown Modal
Detailed view of individual assessments:
- **CA Summary**: Total CA scores and maximum possible
- **Exam Summary**: Exam scores and maximum possible
- **Individual Assessments**: List of all assessments with:
  - Assessment type (CA, Exam, etc.)
  - Title and date graded
  - Score and percentage
  - Weight/contribution
  - Teacher remarks
- **Color Coding**: Visual indicators for performance levels

#### Teacher Comments Section
- Subject-specific comments
- General comments
- Promotion recommendations
- Behavior notes
- Public/private comment visibility

#### Features
- **Term Selector**: Switch between different academic terms
- **URL Synchronization**: Term selection persists in URL for sharing
- **No Auto-refresh**: Page doesn't reload when switching tabs/windows
- **Smart Caching**: Data cached for optimal performance
- **Responsive Design**: Works seamlessly on all screen sizes
- **Premium Visualizations**: Professional charts with smooth animations

### Fees Tab

Financial information:
- Current term fee summary
- Total billed, paid, and outstanding amounts
- Payment timeline with history
- Fee status indicators
- Payment method tracking

### Behaviour Tab

Behavioral records:
- Incident tracking (low, medium, high severity)
- Positive notes and achievements
- Behavior summary statistics
- Date-stamped records with details

### Relationships Tab

Student connections:
- **Guardians/Parents**:
  - List of all linked guardians with photos
  - Primary contact designation
  - Contact information (phone, email, occupation)
  - Manage guardians button for adding/editing
- **Class & Enrollment**: Current grade and class group
- **Documents**: Uploaded files and documents

### Activity Tab

Complete audit log:
- All actions related to the student
- User who performed each action
- Timestamps for all activities
- Filterable by activity type

### Real-time Updates

The student detail page features real-time updates via Server-Sent Events (SSE):
- Guardian lists update automatically when guardians are added/removed
- No page refresh needed to see changes
- Changes sync across all open tabs/windows

## Student Status Management

### Active Students
- Can be assigned to classes
- Appear in attendance records
- Included in fee collection
- Show in all student lists

### Inactive Students
- Temporarily removed from active operations
- Can be reactivated later
- Historical data preserved
- Filtered out of default views (use filters to view)

### Withdrawn Students
- Permanently removed from active enrollment
- Historical records maintained
- Cannot be reactivated (requires new enrollment)
- Shown separately in reports

## Fee Status Indicators

Student cards are color-coded based on fee status:

- **🟢 Cleared**: All fees paid in full
- **🔴 Owing**: Outstanding balance
- **🟡 Partial**: Partial payment received
- **🔵 New/Unknown**: New student or fee status not yet determined
- **⚪ Muted**: Inactive or withdrawn students

Fee status badges show:
- Current status
- Amount owed (if applicable)
- Quick access to payment recording

## Academic Performance Badges

Students with academic records display performance badges:

- **🏆 Top 1%**: Exceptional performance
- **⭐ Top 5%**: Excellent performance
- **✨ Top 10%**: Very good performance
- **🎖️ Honours**: Honours-level performance
- **📊 Average**: Shows latest average percentage

Badges appear on student cards and in the table view.

## Bulk Operations

### Selecting Students

- **Single selection**: Click checkbox next to student
- **Select all visible**: Click header checkbox in table view
- **Multi-select**: Click multiple checkboxes
- **Clear selection**: Click "Clear" in bulk actions bar

### Available Bulk Actions

1. **Assign Class**: Move multiple students to a new class
2. **Message Parents**: Send bulk messages to parents
3. **Mark Fees Cleared**: Update fee status for multiple students
4. **Export Selected**: Download selected students as CSV
5. **Change Status**: Update status for multiple students

## Importing Students via CSV

1. Navigate to **Students** page
2. Click **"Import Students"** button in the header
3. Download the template file
4. Fill in student information:
   - Required: First Name, Last Name, Grade, Class Group
   - Optional: Middle Name, Admission No, Date of Birth, etc.
5. Upload the completed CSV file
6. Review the preview
7. Confirm import

### CSV Format

```csv
firstName,lastName,middleName,admissionNo,gradeId,classGroupId,sex,dateOfBirth
John,Doe,Michael,2024-001,GRADE_ID,CLASS_ID,male,2010-05-15
Jane,Smith,,2024-002,GRADE_ID,CLASS_ID,female,2010-08-20
```

## Keyboard Shortcuts

- **`/`**: Focus search input
- **`⌘K` / `Ctrl+K`**: Open command palette
- **`N`**: Add new student (from command palette)
- **`I`**: Import students (from command palette)
- **Arrow keys**: Navigate command palette options
- **Enter**: Execute selected command

## Best Practices

1. **Consistent Data Entry**: Use standardized formats for names and admission numbers
2. **Regular Updates**: Keep student information current
3. **Photo Quality**: Use clear, recent photos
4. **Status Management**: Update student status promptly when they leave or return
5. **Subject Assignments**: Review subject assignments at the start of each term
6. **Bulk Operations**: Use bulk actions for efficiency when managing multiple students
7. **Search First**: Use search before manually scrolling through lists
8. **Export Regularly**: Export student data for backup purposes

## Troubleshooting

### Student Not Appearing in Class List
- Check if student status is "Active"
- Verify grade and class group assignment
- Ensure class group is active
- Try refreshing the page

### Cannot Assign Student to Class
- Verify the class group belongs to the selected grade
- Check if class group is active
- Ensure student status is "Active"

### Subject Not Showing
- Check if subject is assigned to the class group
- Verify subject is active
- Check for subject overrides

### Search Not Working
- Clear search and try again
- Check for typos in search query
- Try searching by admission number instead
- Use filters if available

### Export Failing
- Check your internet connection
- Ensure you have selected students (for export selected)
- Try exporting a smaller batch
- Check browser console for errors

## Tips for Efficient Management

1. **Use Tabs**: Switch between tabs to quickly access different student groups
2. **Leverage Search**: Use search instead of scrolling for large lists
3. **Bulk Actions**: Select multiple students for batch operations
4. **Keyboard Shortcuts**: Learn shortcuts for faster navigation
5. **Export Data**: Regularly export data for backup and reporting
6. **Monitor Stats**: Check quick stats dashboard for insights
7. **Color Coding**: Use color-coded cards to quickly identify fee status
8. **Sort Strategically**: Sort by fee status to prioritize fee collection
