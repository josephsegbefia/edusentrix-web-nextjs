# Student Academics & Gradebook

The Academics tab provides a comprehensive gradebook and analytics dashboard for tracking student academic performance. This feature offers detailed insights into student progress, subject performance, and trends over time.

## Overview

The Academics tab transforms academic data into actionable insights through visualizations, detailed breakdowns, and performance analytics. It's designed to help teachers, administrators, and parents understand student performance at a glance while providing deep-dive capabilities for detailed analysis.

## Key Features

### 1. Summary Cards

Four key performance indicators displayed prominently:

- **Overall Average**: Shows the student's average score for the selected term with a trend indicator (📈 up, 📉 down, ➡️ stable)
- **Class Position**: Displays the student's rank in class (e.g., "#5 of 30")
- **Performance Tier**: Automatically calculated tier based on average:
  - **Top**: 80% and above
  - **Above Average**: 65-79%
  - **Average**: 50-64%
  - **At Risk**: Below 50%
- **Risk Level**: Risk assessment with strongest/weakest subjects:
  - **Low**: Good performance, no concerns
  - **Medium**: Some areas need attention
  - **High**: Significant intervention needed

### 2. Subject Performance Overview

A clear, card-based view of subject strengths and weaknesses:

#### Top Performers
- Shows the top 3 subjects by score
- Green color scheme for positive reinforcement
- Displays subject name, score percentage, and grade letter
- Ranked with numbered badges

#### Areas for Improvement
- Shows the bottom 3 subjects needing attention
- Color-coded by severity:
  - **Amber**: Scores 50-59% (needs improvement)
  - **Red**: Scores below 50% (critical)
- Includes trend indicators where available

### 3. Overall Performance Trend

An interactive line chart showing performance over time:

#### Features
- **Dual Lines**:
  - **Blue solid line**: Student's performance
  - **Gray dashed line**: Class average for comparison
- **Academic Year Labels**: X-axis shows terms with year (e.g., "2024 Term 1")
- **Year Filter**: Dropdown to view specific academic years or all years
- **Hover Tooltips**: Detailed information showing:
  - Full term label
  - Student score percentage
  - Class average percentage
- **Visual Distinction**: Clear differentiation between student and class lines

#### Use Cases
- Track improvement or decline over time
- Compare student performance to class average
- Identify trends across multiple terms
- Plan interventions based on performance patterns

### 4. Subject Performance Over Time

Deep-dive analysis for individual subjects:

#### Features
- **Subject Selector**: Choose any subject from a dropdown
- **Year Filter**: Filter by academic year or view all years
- **Trend Line**: Blue line chart showing performance across terms
- **Pass Reference Line**: Visual indicator at 50% pass mark
- **Current Score Card**: Summary showing current term performance
- **Term Labels**: Full academic period labels on X-axis

#### Use Cases
- Identify subjects with consistent improvement
- Spot subjects with declining performance
- Compare performance across different academic years
- Plan targeted interventions for specific subjects

### 5. Academic Performance Table

Comprehensive gradebook table with all subjects:

#### Columns
- **Subject**: Subject name and short code
- **CA**: Continuous Assessment percentage
- **Exam**: Examination percentage
- **Total**: Combined total score percentage
- **Grade**: Letter grade (A, B, C, etc.)
- **Teacher**: Subject teacher name
- **Actions**: "View Breakdown" button for detailed assessment view

#### Features
- Sortable by any column
- Color-coded grade badges:
  - **Green**: Passing grades
  - **Red**: Failing grades
- Quick access to detailed breakdowns

### 6. Assessment Breakdown Modal

Detailed view of all assessments for a subject:

#### Summary Cards
- **CA Total**: Sum of all CA scores and maximum possible
- **Exam Score**: Total exam score and maximum possible
- **Total Score**: Final calculated percentage

#### Assessment List
Each assessment shows:
- **Type**: CA, Exam, or other assessment type
- **Title**: Assessment name/description
- **Score**: Points earned out of maximum
- **Percentage**: Calculated percentage
- **Weight**: Contribution to final grade
- **Date Graded**: When the assessment was graded
- **Remarks**: Teacher comments or notes

#### Color Coding
- **Green**: High performance (75%+)
- **Amber**: Moderate performance (60-74%)
- **Red**: Low performance (<60%)

### 7. Teacher Comments

Comments section displaying:
- **Subject Comments**: Subject-specific feedback
- **General Comments**: Overall performance notes
- **Promotion Recommendations**: Promotion/retention suggestions
- **Behavior Notes**: Academic behavior observations
- **Public/Private**: Visibility indicators

## Navigation & Controls

### Term Selector
- Located in the header of the Academic Performance card
- Dropdown showing all available academic terms
- Displays term label and average score
- URL synchronization for easy sharing

### Filters
- **Year Filter**: Available in Overall Performance Trend and Subject Performance Over Time charts
- **Subject Filter**: Available in Subject Performance Over Time chart
- Filters persist during session

### URL Parameters
- Term selection is stored in URL: `?termId=TERM_ID`
- Shareable links maintain term context
- Browser back/forward navigation supported

## Performance Optimizations

### Smart Caching
- Data cached for optimal performance
- No automatic refetching on window focus
- Background updates only when necessary
- Stale time configured for different data types

### Loading States
- Skeleton loaders during initial fetch
- Smooth transitions between data updates
- Error states with retry options

## Data Requirements

For the Academics tab to display data, the following must be set up:

1. **Academic Periods**: At least one academic period (term) must exist
2. **Subjects**: Subjects must be assigned to the student's class group
3. **Assessments**: Teachers must record assessments (CA and Exam)
4. **Subject Grades**: System calculates subject grades from assessments
5. **Term Results**: System aggregates term results from subject grades

## Best Practices

### For Teachers
1. **Regular Updates**: Record assessments promptly after grading
2. **Accurate Scores**: Ensure scores are entered correctly
3. **Comments**: Add meaningful comments to help students improve
4. **Consistency**: Use consistent assessment types and weights

### For Administrators
1. **Monitor Trends**: Use trend charts to identify at-risk students early
2. **Class Comparison**: Compare individual students to class averages
3. **Intervention Planning**: Use risk levels to prioritize support
4. **Data Quality**: Ensure academic periods and subjects are properly configured

### For Parents
1. **Regular Review**: Check the Academics tab regularly to track progress
2. **Subject Focus**: Use Subject Performance Over Time to identify areas needing attention
3. **Teacher Comments**: Review comments for actionable feedback
4. **Trend Analysis**: Monitor Overall Performance Trend for improvement patterns

## Troubleshooting

### No Data Showing
- **Check Academic Period**: Ensure at least one term is selected
- **Verify Assessments**: Confirm assessments have been recorded
- **Subject Assignment**: Verify subjects are assigned to the student's class
- **Refresh**: Try refreshing the page or selecting a different term

### Charts Not Displaying
- **Data Availability**: Ensure sufficient historical data exists
- **Browser Support**: Use a modern browser (Chrome, Firefox, Safari, Edge)
- **JavaScript**: Ensure JavaScript is enabled

### Incorrect Calculations
- **Grading Scale**: Verify grading scale is configured correctly
- **Assessment Weights**: Check that assessment weights are set properly
- **CA/Exam Split**: Confirm CA and exam percentages are calculated correctly

### Performance Issues
- **Clear Cache**: Clear browser cache if experiencing slow loading
- **Data Volume**: Large datasets may take longer to load
- **Network**: Check internet connection for API calls

## Future Enhancements

The Academics tab is continuously being improved. Planned enhancements include:

- **AI-Powered Insights**: Automated analysis and recommendations
- **Predictive Analytics**: Performance predictions based on trends
- **Comparative Analysis**: Compare students within class or grade
- **Export Functionality**: Export gradebook data to PDF/Excel
- **Print Views**: Optimized print layouts for reports
- **Mobile App**: Native mobile app for on-the-go access

---

**Note**: The Academics tab requires proper setup of academic periods, subjects, and grading scales. Contact your system administrator if you encounter issues with data display or calculations.
