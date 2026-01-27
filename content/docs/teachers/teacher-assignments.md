# Teacher Assignments

Learn how to manage teacher assignments to classes and subjects in EduSentrix.

## Overview

Teacher assignments connect teachers to specific classes and subjects, allowing you to track who teaches what and manage teaching workloads. Assignments are period-based, meaning they're tied to specific academic periods.

## Understanding Assignments

### What is a Teacher Assignment?

A teacher assignment links a teacher to:
- **One or more subjects** they teach
- **One or more class groups** where they teach those subjects
- **An academic period** (term/year) when the assignment is active

### Assignment Types

1. **Subject Assignment**: Teacher teaches a subject (can be across multiple classes)
2. **Class Assignment**: Teacher teaches a specific subject in a specific class
3. **Homeroom Assignment**: Teacher is the primary class teacher (one per class)

## Viewing Assignments

### From Teacher Detail Page

1. Navigate to **Teachers** (`/admin/teachers`)
2. Click on a teacher card or row
3. Go to the **Assignments** tab
4. View all current and past assignments

### Assignment Information Displayed

- **Subject**: Which subject is being taught
- **Class Group**: Which class the teacher teaches
- **Academic Period**: Term and year
- **Status**: Active, Completed, or Cancelled
- **Schedule**: Days and times (if configured)
- **Student Count**: Number of students in the class
- **Created Date**: When the assignment was created

## Creating Assignments

### Step-by-Step Process

1. Navigate to a teacher's detail page
2. Go to the **Assignments** tab
3. Click **"Create Assignment"** button
4. Fill in the assignment details:
   - **Academic Period**: Select the term/year
   - **Subject**: Choose the subject to teach
   - **Class Group**: Select the class (can select multiple)
   - **Schedule** (optional): Set days and times
5. Review for conflicts or capacity issues
6. Click **"Create Assignment"**

### Assignment Rules

- **One Subject Per Assignment**: Each assignment is for one subject
- **Multiple Classes**: You can assign the same subject to multiple classes in one assignment
- **Period-Based**: Assignments are tied to academic periods
- **Conflict Detection**: System prevents duplicate assignments
- **Capacity Checking**: Warns if teacher exceeds maximum classes/students

## Managing Assignments

### Editing Assignments

1. Go to teacher's **Assignments** tab
2. Find the assignment you want to edit
3. Click the **"Edit"** button (coming soon)
4. Modify subject, class, or schedule
5. Save changes

### Deleting Assignments

1. Go to teacher's **Assignments** tab
2. Find the assignment you want to remove
3. Click the **"Delete"** button
4. Confirm deletion

**Note**: Deleting an assignment removes it from the current period but preserves historical records.

## Assignment Status

### Active Assignments
- Currently in effect for the current academic period
- Teacher is actively teaching these classes/subjects
- Appears in class lists and reports

### Completed Assignments
- Assignment ended when the academic period ended
- Historical record preserved
- Can be viewed but not edited

### Cancelled Assignments
- Assignment was cancelled before completion
- Historical record preserved
- Shows reason for cancellation (if provided)

## Best Practices

1. **Create Assignments Early**: Set up assignments before the term starts
2. **Review Workloads**: Check teacher capacity before assigning
3. **Avoid Conflicts**: Ensure teachers aren't double-booked
4. **Update Promptly**: Update assignments when teachers change
5. **Use Periods**: Always assign to the correct academic period
6. **Document Changes**: Add notes when making assignment changes

## Troubleshooting

### Cannot Create Assignment

**Possible Causes:**
- Teacher is not active
- Subject doesn't exist or is inactive
- Class group doesn't exist or is inactive
- Academic period is not set up
- Assignment would exceed teacher's capacity
- Duplicate assignment already exists

**Solutions:**
- Check teacher status (must be Active)
- Verify subject and class group exist
- Ensure academic period is created
- Review teacher's current assignments
- Check for existing assignments

### Assignment Not Appearing

- Verify assignment is for the current academic period
- Check assignment status (should be Active)
- Ensure teacher status is Active
- Refresh the page

### Workload Warnings

If you see workload warnings:
- Review teacher's current assignments
- Check teacher's maximum capacity settings
- Consider redistributing assignments
- Contact administrator if adjustments are needed

## Related Documentation

- [Managing Teachers](./managing-teachers.md): Complete guide to teacher management
- [Managing Class Groups](../class-groups/managing-class-groups.md): Learn about class groups
- [Academic Periods](../academic-periods/managing-periods.md): Understand academic periods
