# Managing Class Groups

Learn how to create and manage class groups in EduSentrix.

## Creating Class Groups

### Overview

Class groups organize students into manageable classes within each grade. You can create multiple class groups per grade with flexible naming options.

### Step-by-Step Process

1. **Navigate to Dashboard** → Click **"Create Class"** in Quick Actions

2. **Select Grades**:
   - Check the boxes for grades you want to create classes for
   - You can select multiple grades at once

3. **Default Settings** (Optional):
   - Set a default pattern (Letters, Numbers, or Custom)
   - Set default number of classes
   - Click **"Apply to All"** to use these settings for all selected grades

4. **Configure Each Grade**:
   - **Count**: Number of class groups to create for this grade
   - **Pattern**:
     - **Letters**: A, B, C, D... (up to 26 classes)
     - **Numbers**: 1, 2, 3, 4...
     - **Custom**: Enter custom names separated by commas
   - **Preview**: See how class names will appear

5. **Default Subjects** (Optional):
   - Select subjects to assign to all created class groups
   - These can be customized per class later

6. **Capacity** (Optional):
   - Set maximum number of students per class
   - Leave blank for unlimited capacity

7. Click **"Create Class Groups"**

### Naming Examples

#### Letters Pattern
- **Grade**: JHS1, **Count**: 3
- **Result**: JHS1 A, JHS1 B, JHS1 C

#### Numbers Pattern
- **Grade**: Primary 5, **Count**: 2
- **Result**: Primary 5 1, Primary 5 2

#### Custom Pattern
- **Grade**: JHS2, **Custom Names**: Rose, Sunflower, Tulip
- **Result**: JHS2 Rose, JHS2 Sunflower, JHS2 Tulip

## Flexible Configuration

### Different Class Counts Per Grade

You can create different numbers of classes for different grades:

- **Primary 1**: 2 classes (Primary 1 A, Primary 1 B)
- **Primary 2**: 3 classes (Primary 2 A, Primary 2 B, Primary 2 C)
- **JHS1**: 1 class (JHS1 A)
- **JHS2**: 4 classes (JHS2 Rose, JHS2 Sunflower, JHS2 Tulip, JHS2 Daisy)

### Per-Grade Configuration

Each grade can have:
- Different number of classes
- Different naming patterns
- Different subject assignments
- Different capacity limits

## Editing Class Groups

1. Navigate to **Classes** page
2. Find the class group
3. Click to view details
4. Click **"Edit"** to modify:
   - Class name
   - Subject assignments
   - Capacity
   - Status (Active/Inactive)

**Note**: Homeroom teacher assignment is managed through the Teachers page. See [Managing Teachers](../teachers/managing-teachers.md) for details.

## Subject Assignment

### Default Subjects

When creating class groups, you can assign default subjects that apply to all students in those classes.

### Per-Class Subject Customization

After creation, you can:
- Add subjects to specific classes
- Remove subjects from specific classes
- Override default subjects for individual students

## Homeroom Teacher Assignment

### Assigning a Homeroom Teacher

Homeroom teachers are assigned through the **Teachers** management page:

**Option 1: When Creating a Teacher**
1. Navigate to **Teachers** → Click **"Add Teacher"**
2. Fill in teacher information
3. In the **Homeroom Assignment** section, select the class group
4. Save the teacher

**Option 2: From Teacher Detail Page**
1. Navigate to **Teachers** (`/admin/teachers`)
2. Click on the teacher you want to assign
3. Go to the **Overview** tab
4. Click **"Edit"** (coming soon) or use the assignment management features
5. Assign or change homeroom class

**Option 3: Using Assignments Tab**
1. Navigate to teacher's detail page
2. Go to the **Assignments** tab
3. Create a new assignment or manage existing ones
4. Assign homeroom through the assignment system

### Homeroom Teacher Role

- **One per Class**: Only one teacher can be the homeroom teacher for each class group
- **Class Management**: Manages the class and monitors student progress
- **Attendance**: Monitors and records student attendance
- **Parent Communication**: Primary point of contact for parents of students in the class
- **Class Reports**: Generates class reports and updates
- **Student Support**: Provides pastoral care and support to students

### Viewing Homeroom Teachers

- **From Teachers Page**: Filter by "Homeroom" tab to see all homeroom teachers
- **From Class Groups**: View which teacher is assigned as homeroom (coming soon)
- **From Teacher Cards**: Homeroom badge appears on teacher cards showing the class name

For more details, see [Managing Teachers](../teachers/managing-teachers.md) and [Teacher Assignments](../teachers/teacher-assignments.md).

## Class Capacity

### Setting Capacity Limits

- Set maximum number of students per class
- Helps manage class sizes
- Prevents over-enrollment
- Can be adjusted as needed

### Unlimited Capacity

- Leave capacity blank for unlimited enrollment
- Useful for schools without size restrictions

## Best Practices

1. **Consistent Naming**: Use consistent patterns across grades
2. **Balanced Sizes**: Create appropriate number of classes based on enrollment
3. **Subject Planning**: Assign subjects during creation for efficiency
4. **Capacity Planning**: Set realistic capacity limits
5. **Regular Review**: Review and adjust classes at the start of each term

## Troubleshooting

### Cannot Create Class Groups
- Ensure academic period is created first
- Verify grades exist and are active
- Check if subjects exist (if assigning default subjects)

### Class Names Not Appearing Correctly
- Review naming pattern settings
- Check for typos in custom names
- Verify grade names are correct

### Students Cannot Be Assigned
- Verify class group is active
- Check capacity limits
- Ensure class group belongs to correct grade
