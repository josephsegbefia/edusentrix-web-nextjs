# Master Timetable

The Master Timetable provides a school-wide schedule overview for all classes. Access it from the admin sidebar at `/admin/timetable`.

## Overview

The Master Timetable feature allows you to:
- **View All Schedules**: See the entire school schedule at a glance
- **Filter by Day/Class**: Focus on specific days or classes
- **Detect Conflicts**: Identify scheduling conflicts automatically
- **Edit Schedules**: Modify class schedules as needed
- **Track Sessions**: Monitor teaching sessions and coverage

## Dashboard Stats

### Quick Statistics

1. **Total Sessions**
   - Number of scheduled teaching sessions
   - All classes across all days

2. **Classes Scheduled**
   - Unique classes with scheduled sessions
   - Coverage indicator

3. **Subjects**
   - Number of subjects scheduled
   - Subject variety tracking

4. **Conflicts**
   - Number of scheduling conflicts
   - Requires attention

## Viewing the Timetable

### Weekly View (Default)

When no day is selected, see all weekday schedules:
- Monday through Friday displayed
- Sessions grouped by day
- Sorted by start time within each day

### Single Day View

Click a specific day to filter:
- Shows only that day's sessions
- Detailed view for planning
- Easier conflict resolution

### Session Information

Each scheduled session displays:
- **Time**: Start time badge
- **Class & Subject**: Combined identifier
- **Subject Code**: If assigned
- **Teacher**: Name and photo
- **Duration**: Length in hours
- **Location**: Room/location if assigned
- **Grade**: Grade level

## Filtering Options

### Search

Search across:
- Class names
- Subject names
- Teacher names
- Grade names

### Grade Filter

Select specific grade to filter:
- All Grades (default)
- Individual grade selection
- Narrows to grade-specific schedules

### Class Filter

Select specific class:
- All Classes (default)
- Individual class selection
- Shows only that class's schedule

### Day Filter

Quick day selection:
- **All Days**: Full weekly view
- **Mon-Fri**: Individual day buttons
- Click to filter instantly

## Conflict Detection

### What are Conflicts?

Conflicts occur when:
- Same teacher is scheduled at overlapping times
- Double-booking of resources
- Impossible schedule scenarios

### Conflict Indicators

- **Warning Banner**: Displays total conflict count
- **Entry Badges**: Conflicting entries marked with "Conflict" badge
- **Color Coding**: Conflict entries highlighted in rose/red

### Resolving Conflicts

1. Identify conflicting entries (marked in red)
2. Click the calendar icon on the entry
3. Modify schedule in the modal
4. Save changes
5. Conflicts update automatically

## Schedule Entry Details

Each entry shows:

| Field | Description |
|-------|-------------|
| Start Time | When the session begins |
| End Time | When the session ends |
| Class Name | Which class group |
| Subject Name | Subject being taught |
| Subject Code | Short identifier (if set) |
| Teacher Name | Assigned teacher |
| Teacher Photo | Teacher avatar |
| Duration | Length in hours |
| Location | Room/venue (optional) |
| Grade | Grade level |

## Editing Schedules

### Opening the Editor

1. Find the schedule entry
2. Click the **Calendar** icon button
3. Schedule modal opens

### Edit Options

In the schedule modal:
- **Day of Week**: Change the day
- **Start Time**: Adjust start time
- **End Time**: Adjust end time
- **Location**: Set or change room/venue
- **Contact Hours**: Weekly hours allocation

### Saving Changes

1. Make desired changes
2. Click **"Save"** or **"Update"**
3. Modal closes
4. Timetable refreshes
5. Conflicts recalculated

## Adding Schedules

### From Teacher Assignments

Schedules are created when:
1. Teacher is assigned to a subject in a class
2. Schedule details are set during assignment
3. Appears automatically in timetable

### Assignment Process

1. Navigate to teacher or class
2. Create/edit assignment
3. Set schedule details:
   - Day of week
   - Start and end times
   - Location (optional)
4. Save assignment
5. Appears in master timetable

## Day Display Format

### Time Format

Times displayed in 12-hour format:
- Example: "9:00 AM", "2:30 PM"

### Day Names

Full names in headers:
- Monday, Tuesday, Wednesday, Thursday, Friday

Short names in filters:
- Mon, Tue, Wed, Thu, Fri

## Understanding the Layout

### Grouped by Day

When viewing all days:
- Each day has its own card
- Sessions listed chronologically
- Empty days are hidden

### Session Rows

Each session row contains:
- Time badge (left)
- Class and subject info (center)
- Teacher and duration (center-left)
- Edit button (right)

### Empty States

If no schedules for a filter:
- Calendar icon displayed
- "No schedules for this day" message
- Indicates need for scheduling

## Best Practices

### For Scheduling

1. **Avoid Conflicts**: Check for conflicts after changes
2. **Balanced Days**: Distribute sessions evenly
3. **Teacher Workload**: Monitor teacher hours
4. **Break Times**: Allow time between sessions
5. **Room Availability**: Verify location capacity

### For Monitoring

1. **Daily Checks**: Review daily schedule
2. **Conflict Resolution**: Address conflicts promptly
3. **Coverage Verification**: Ensure all subjects scheduled
4. **Teacher Assignments**: Confirm all teachers assigned

### For Communication

1. **Share Timetables**: Distribute to teachers
2. **Update Promptly**: Communicate changes
3. **Parent Information**: Provide class schedules
4. **Notice Period**: Give advance notice of changes

## Troubleshooting

### Schedules Not Appearing

- Verify teacher assignments exist
- Check schedule was saved in assignment
- Ensure correct academic period
- Refresh the page

### Conflicts Not Resolving

- Verify both entries were updated
- Check for additional overlapping entries
- Ensure times don't overlap
- Refresh and check again

### Filter Not Working

- Clear search field
- Reset to "All" options
- Refresh the page
- Check data exists for filter

### Edit Modal Not Opening

- Click the calendar icon (not the row)
- Check you have edit permissions
- Try refreshing the page
- Clear browser cache

## Integration Points

### Teacher Assignments

Schedules linked to:
- Teacher assignment records
- Subject-class combinations
- Academic periods

### Class Management

Connected to:
- Class group information
- Grade levels
- Subject assignments

### Academic Periods

Schedules are period-specific:
- Change with academic period
- Historical schedules preserved
- New terms need new schedules

## Related Documentation

- [Teacher Assignments](../teachers/teacher-assignments.md): Creating assignments
- [Managing Teachers](../teachers/managing-teachers.md): Teacher management
- [Managing Class Groups](../class-groups/managing-class-groups.md): Class organization
