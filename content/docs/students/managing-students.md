# Managing Students

Learn how to add, edit, and manage students in EduSentrix.

## Adding a New Student

### Step-by-Step Process

1. **Navigate to Dashboard** → Click **"Add New Student"** in Quick Actions

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
3. Click on the student to view details
4. Click **"Edit"** to modify information
5. Save changes

## Student Status Management

### Active Students
- Can be assigned to classes
- Appear in attendance records
- Included in fee collection

### Inactive Students
- Temporarily removed from active operations
- Can be reactivated later
- Historical data preserved

### Withdrawn Students
- Permanently removed from active enrollment
- Historical records maintained
- Cannot be reactivated (requires new enrollment)

## Bulk Operations

### Importing Students via CSV

1. Navigate to **Students** page
2. Click **"Import CSV"** or **"Bulk Import"**
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

## Searching and Filtering

### Search Options
- **By Name**: Search first name, last name, or middle name
- **By Admission Number**: Quick lookup by admission number
- **By Grade**: Filter students by grade level
- **By Class**: Filter by class group
- **By Status**: Active, Inactive, or Withdrawn

### Advanced Filters
- Date range (enrollment date, date of birth)
- Subject enrollment
- Fee status
- Academic performance

## Student Records

Each student has a comprehensive record including:
- **Personal Information**: Name, DOB, photo, contact details
- **Academic Information**: Grade, class, subjects
- **Fee Records**: Payment history, outstanding balances
- **Attendance**: Daily attendance records
- **Performance**: Grades, assessments, reports

## Best Practices

1. **Consistent Data Entry**: Use standardized formats for names and admission numbers
2. **Regular Updates**: Keep student information current
3. **Photo Quality**: Use clear, recent photos
4. **Status Management**: Update student status promptly when they leave or return
5. **Subject Assignments**: Review subject assignments at the start of each term

## Troubleshooting

### Student Not Appearing in Class List
- Check if student status is "Active"
- Verify grade and class group assignment
- Ensure class group is active

### Cannot Assign Student to Class
- Verify the class group belongs to the selected grade
- Check if class group is active
- Ensure student status is "Active"

### Subject Not Showing
- Check if subject is assigned to the class group
- Verify subject is active
- Check for subject overrides
