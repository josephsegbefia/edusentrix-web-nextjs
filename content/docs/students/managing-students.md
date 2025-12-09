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
