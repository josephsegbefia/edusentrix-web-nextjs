# Reports & Analytics

The Reports module provides comprehensive analytics and export capabilities across your entire school. Access it from the admin sidebar at `/admin/reports`.

## Overview

The Reports feature offers:
- **Unified Analytics**: Insights across all school operations
- **Interactive Charts**: Visual representations of key metrics
- **Flexible Filtering**: Custom date ranges and academic periods
- **Report Exports**: Generate downloadable reports
- **Multi-Category Coverage**: Fees, Students, Teachers, Attendance, and more

## Report Filters

### Scope Options

1. **Custom Range**: Select any start and end date
2. **Academic Period**: Use a specific term/year

### Date Range Picker

- Select custom start and end dates
- Automatically calculates the range
- Filters all charts and data

### Academic Period Selector

- Choose from available academic periods
- Uses period start and end dates
- Ideal for term-based reporting

## Snapshot Preview

Quick summary cards showing:

| Metric | Description |
|--------|-------------|
| Revenue | Total revenue in the range |
| Collection Rate | Percentage of fees collected |
| Outstanding | Total outstanding invoices |
| Students | Total student count |
| Teachers | Total teacher count |
| Attendance Rate | Present rate percentage |
| Invitations | Total invitations sent |
| Academics | Average score and pass rate |

## Category Insights

### Fees and Billing

#### Revenue Trend
- Area chart showing completed payments over time
- Visualizes revenue velocity
- Helps identify peak collection periods

#### Payment Methods
- Horizontal bar chart of payment channels
- Shows distribution: Cash, Mobile Money, Bank Transfer, Card
- Identifies preferred payment methods

#### Invoice Status
- Pie chart of invoice lifecycle
- Statuses: Draft, Issued, Partially Paid, Paid, Overdue, Cancelled
- Click legend to filter

### Students

#### Enrollment Trend
- Line chart of new enrollments
- Tracks enrollment momentum
- Identifies growth patterns

#### Grade Distribution
- Pie chart showing students per grade
- Visual breakdown of class sizes
- Helps with resource allocation

#### Student Status
- Bar chart of Active, Inactive, Withdrawn
- Monitors student retention
- Highlights status changes

### Teachers

#### Staff Status
- Horizontal bar chart of teacher statuses
- Active, Inactive, On Leave, Terminated
- Workforce health indicator

#### Departments
- Bar chart of department distribution
- Shows staff allocation
- Identifies staffing needs

#### Assignments by Subject
- Bar chart of teaching assignments
- Subject coverage analysis
- Workload distribution

### Attendance

#### Attendance Rate
- Line chart of daily/weekly/monthly rates
- Tracks present rate over time
- Identifies attendance patterns

#### Status Distribution
- Pie chart of attendance statuses
- Present, Absent, Late, Excused
- Absence pattern analysis

### Invitations

#### Invitations Sent
- Line chart of invitation volume
- Tracks onboarding activity
- Measures outreach efforts

#### Invitation Status
- Bar chart of acceptance rates
- Pending, Accepted, Expired, Revoked
- Conversion analysis

#### Invitation Roles
- Pie chart by role type
- Teacher, Admin, Parent roles
- Role distribution insights

### Academics

#### Average by Subject
- Bar chart of subject averages
- Top performing subjects
- Areas needing improvement

#### Pass Rate
- Pie chart of pass/fail distribution
- Overall academic health
- Performance benchmarking

### Activity

#### Activity Volume
- Area chart of system activity
- Tracks usage patterns
- Identifies busy periods

#### Top Activity Types
- Bar chart of event types
- Most common actions
- System usage analysis

## Report Library

### Available Reports

Reports organized by category:

#### Fees Reports
- **Revenue Summary**: Total revenue breakdown
- **Outstanding Invoices**: Unpaid invoice report
- **Payment History**: All payments in range
- **Defaulter List**: Students with overdue invoices

#### Student Reports
- **Enrollment Report**: Student enrollment data
- **Student Directory**: Complete student list
- **Status Changes**: Enrollment status changes

#### Teacher Reports
- **Staff Directory**: Complete teacher list
- **Assignment Report**: Teaching assignments
- **Workload Analysis**: Hours per teacher

#### Attendance Reports
- **Daily Attendance**: Daily attendance records
- **Attendance Summary**: Period attendance summary
- **Absence Report**: Detailed absence records

#### Invitation Reports
- **Invitation History**: All invitations sent
- **Acceptance Report**: Invitation outcomes

#### Academic Reports
- **Term Results**: Academic performance summary
- **Subject Analysis**: Subject-wise performance

#### Activity Reports
- **Audit Log**: System activity log
- **User Actions**: Actions by user

### Generating Reports

1. Navigate to **Report Library** section
2. Find desired report in category
3. Verify report scope matches your filters
4. Click **"Generate Export"**
5. Choose format (CSV)
6. Wait for generation
7. Download the file

### Report Formats

- **CSV**: Comma-separated values (Excel compatible)
- More formats coming soon (PDF, Excel)

## Recent Exports

Track your export history:

- Report name and type
- Date range used
- Generation timestamp
- Status (Completed, Processing, Failed)
- Row count
- Download button

### Downloading Exports

1. Find export in Recent Exports
2. Click **"Download"** button
3. File downloads automatically

## Chart Intervals

Charts automatically adjust intervals based on date range:
- **Daily**: For ranges under 2 weeks
- **Weekly**: For ranges 2 weeks to 2 months
- **Monthly**: For ranges over 2 months

## Exporting Chart Data

While viewing charts:
1. Use the Report Library to generate exports
2. Export includes underlying data
3. Analyze further in spreadsheets

## Best Practices

### For Regular Reporting

1. **Consistent Periods**: Use academic periods for term comparisons
2. **Weekly Reviews**: Generate weekly summaries
3. **Monthly Snapshots**: Create monthly reports for archiving
4. **End-of-Term**: Generate comprehensive term reports

### For Analysis

1. **Compare Periods**: Use date ranges to compare performance
2. **Category Focus**: Drill into specific categories
3. **Trend Analysis**: Look for patterns over time
4. **Benchmark**: Compare against previous periods

### For Data Quality

1. **Regular Exports**: Back up data regularly
2. **Verification**: Cross-check exported data
3. **Documentation**: Note any anomalies
4. **Reconciliation**: Match with source systems

## Troubleshooting

### Charts Not Loading

- Check internet connection
- Verify date range is valid
- Ensure data exists for period
- Try refreshing the page

### Export Failing

- Check required filters are set
- Verify period or range is selected
- Try smaller date range
- Check export permissions

### Data Mismatch

- Verify filter settings
- Check data entry dates
- Review transaction statuses
- Ensure all data is synced

### No Data Showing

- Confirm date range has data
- Check academic period selection
- Verify data has been entered
- Review status filters

## Report Categories Reference

| Category | Reports Available |
|----------|-------------------|
| Fees | Revenue, Outstanding, Payments, Defaulters |
| Students | Enrollment, Directory, Status Changes |
| Teachers | Directory, Assignments, Workload |
| Attendance | Daily, Summary, Absences |
| Invitations | History, Acceptance |
| Academics | Term Results, Subject Analysis |
| Activity | Audit Log, User Actions |

## Related Documentation

- [Fees Dashboard](../fees/fees-dashboard.md): Fee collection details
- [Managing Students](../students/managing-students.md): Student data
- [Managing Teachers](../teachers/managing-teachers.md): Teacher data
- [Financial Center](../finance/financial-center.md): Financial overview
