# Managing Subjects

Learn how to create and manage subjects in EduSentrix. Access subjects from the admin sidebar at `/admin/subjects`.

## Overview

Subjects are the core academic offerings of your school. The Subjects module allows you to:
- **Create Subjects**: Add new subjects to your curriculum
- **Assign Teachers**: Link teachers to subjects they teach
- **Manage Subject Details**: Update subject information
- **Track Assignments**: Monitor subject-class assignments
- **Organize Curriculum**: Structure your academic offerings

## Subject Information

Each subject contains:
- **Name**: Full subject name (e.g., "Mathematics", "English Language")
- **Code**: Short identifier (e.g., "MATH", "ENG")
- **Description**: Subject description and overview
- **Department**: Associated department (optional)
- **Status**: Active or Inactive

## Viewing Subjects

### Subject List

The subjects page displays:
- Subject cards or table view
- Subject name and code
- Assigned teachers count
- Class assignments count
- Status indicator

### Search and Filters

- **Search**: Find by subject name or code
- **Filter by Department**: Group by department
- **Filter by Status**: Active or Inactive

## Creating a Subject

### Step 1: Open Create Form

Click **"Add Subject"** button in the header.

### Step 2: Enter Subject Details

1. **Basic Information**:
   - **Name** (required): Full subject name
   - **Code** (required): Short identifier (unique)
   - **Description**: Subject overview

2. **Organization**:
   - **Department**: Associate with a department (optional)
   - **Status**: Set as Active (default)

### Step 3: Save Subject

Click **"Create Subject"** to save.

## Subject Detail Page

Click any subject to view its detail page:

### Overview Tab

- Subject information
- Basic details and description
- Department association
- Status and dates

### Teachers Tab

- List of teachers teaching this subject
- Add/remove teacher assignments
- View teacher details

### Classes Tab

- Classes where this subject is taught
- Class group assignments
- Student counts per class

## Assigning Teachers to Subjects

### From Subject Page

1. Go to subject detail page
2. Navigate to **Teachers** tab
3. Click **"Assign Teacher"**
4. Select teacher from list
5. Confirm assignment

### From Teacher Page

1. Go to teacher detail page
2. Edit teacher or go to Assignments
3. Select subjects to teach
4. Save changes

### Multiple Teachers

- Subjects can have multiple teachers
- Each teacher can teach multiple subjects
- Useful for large schools or shared teaching

## Assigning Subjects to Classes

### From Subject Page

1. Go to subject detail page
2. Navigate to **Classes** tab
3. Click **"Assign to Class"**
4. Select class group(s)
5. Confirm assignment

### From Class Group

1. Go to class group detail
2. Add subjects to the class
3. Subjects become available for scheduling

### Default Subjects

When creating class groups:
- Select default subjects for all classes
- Can be customized per class later
- Saves time for common subjects

## Bulk Operations

### Bulk Subject Creation

1. Click **"Bulk Create"** button
2. Upload CSV with subject data
3. Review and confirm
4. Subjects created in batch

### Bulk Assignment

Assign subjects to multiple classes:
1. Select subject
2. Choose multiple class groups
3. Confirm bulk assignment

## Subject Codes

### Best Practices

- Use consistent format (e.g., 3-4 uppercase letters)
- Include grade identifiers if needed (e.g., "MATH-JHS")
- Keep codes unique across the school
- Use recognizable abbreviations

### Examples

| Subject | Code |
|---------|------|
| Mathematics | MATH |
| English Language | ENG |
| Integrated Science | SCI |
| Social Studies | SOC |
| Information Technology | ICT |
| French | FRE |
| Physical Education | PE |
| Creative Arts | CA |

## Subject Status

### Active Subjects

- Available for assignments
- Shown in dropdowns and lists
- Can be scheduled in timetable
- Students can be enrolled

### Inactive Subjects

- Hidden from assignment dropdowns
- Historical data preserved
- Can be reactivated
- Used for archived subjects

## Editing Subjects

### Editable Fields

- Subject name
- Subject code (with caution)
- Description
- Department
- Status

### Changing Subject Code

**Note**: Changing subject code may affect:
- Historical records
- Report references
- Integration points

Consider creating a new subject instead for major changes.

## Deleting Subjects

### Soft Delete

- Subject marked as Inactive
- Data preserved
- Can be restored
- Recommended approach

### Hard Delete

Only possible when:
- No teacher assignments
- No class assignments
- No student grades
- No historical data

**Caution**: Hard delete is irreversible.

## Department Organization

### Creating Departments

Organize subjects by department:
- Sciences (Math, Science, ICT)
- Languages (English, French)
- Humanities (Social Studies, History)
- Arts (Creative Arts, Music)
- Physical Education

### Benefits

- Better organization
- Department-based filtering
- Reporting by department
- Teacher grouping

## Integration Points

### Academic Records

Subjects appear in:
- Student gradebooks
- Report cards
- Transcripts
- Academic analytics

### Timetabling

Subjects are scheduled:
- In master timetable
- Through teacher assignments
- Per class group

### Fees

Subject-specific fees:
- Lab fees
- Material fees
- Special subject charges

## Best Practices

1. **Consistent Naming**: Use full, clear names
2. **Unique Codes**: Ensure codes don't conflict
3. **Regular Review**: Update subject list annually
4. **Teacher Coverage**: Ensure all subjects have teachers
5. **Class Assignments**: Verify subjects assigned to classes
6. **Active Status**: Keep only current subjects active
7. **Documentation**: Add descriptions for clarity

## Troubleshooting

### Subject Not Appearing in Dropdowns

- Check subject status (must be Active)
- Verify subject exists
- Refresh the page
- Check filter settings

### Cannot Delete Subject

- Subject has assignments
- Remove teacher assignments first
- Remove class assignments
- Clear student grades

### Subject Not in Gradebook

- Verify subject is assigned to class
- Check student is enrolled in subject
- Confirm academic period settings
- Review subject status

### Duplicate Subject Code Error

- Codes must be unique
- Check existing subjects
- Use a different code
- Consider adding suffixes

## Related Documentation

- [Managing Teachers](../teachers/managing-teachers.md): Teacher assignments
- [Managing Class Groups](../class-groups/managing-class-groups.md): Class organization
- [Teacher Assignments](../teachers/teacher-assignments.md): Assignment management
- [Master Timetable](../timetable/master-timetable.md): Scheduling
