# Community Hub

The Community Hub is your central platform for engaging with the school community through polls and fundraising campaigns. Access it from the admin sidebar at `/admin/community`.

## Overview

The Community Hub provides tools for:
- **Polls**: Create and manage school-wide surveys and voting
- **Fundraising**: Launch and track fundraising campaigns
- **Community Engagement**: Monitor participation and collect feedback
- **Approval Workflows**: Review and approve community content before publishing

## Dashboard

The main Community Hub page displays:

### Quick Stats Cards

1. **Active Polls**
   - Number of live polls currently running
   - Total polls count
   - Click to view all polls

2. **Active Campaigns**
   - Number of live fundraising campaigns
   - Total campaigns count
   - Click to view all campaigns

3. **Total Raised**
   - Cumulative amount raised across all campaigns
   - Total donor count
   - Key metric for fundraising success

4. **Needs Attention**
   - Items pending approval
   - Requires administrator review

### Quick Actions

- **Create Poll**: Start a new poll
- **Create Campaign**: Launch a new fundraising campaign

### Recent Activity

- **Recent Polls**: Latest poll activity with status badges
- **Active Campaigns**: Current fundraising campaigns with progress

## Polls

### What are Polls?

Polls allow you to gather feedback and conduct voting within your school community. They can be used for:
- Parent surveys and feedback
- Student council elections
- Event planning decisions
- School policy feedback
- General community opinions

### Poll Features

- **Multiple Question Types**: Support for various question formats
- **Audience Targeting**: Define who can participate (all, parents, teachers, students)
- **Approval Workflow**: Review and approve polls before publishing
- **Real-time Results**: Track voting as it happens
- **Export Results**: Download poll results for analysis
- **Templates**: Use pre-built poll templates for common use cases

### Poll Statuses

| Status | Description |
|--------|-------------|
| Draft | Poll created but not yet submitted |
| Pending Approval | Awaiting administrator review |
| Approved | Ready to be published |
| Live | Currently active and accepting votes |
| Paused | Temporarily stopped accepting votes |
| Closed | Voting period ended |
| Archived | Historical record only |

### Creating a Poll

1. Navigate to **Community Hub** → **Polls**
2. Click **"Create Poll"** button
3. Fill in poll details:
   - **Title**: Clear, descriptive title
   - **Description**: Explain the purpose of the poll
   - **Questions**: Add one or more questions
   - **Audience**: Select who can vote (scope)
   - **Duration**: Set start and end dates
4. Submit for approval or save as draft
5. Once approved, publish to make it live

### Managing Polls

From the Polls page (`/admin/community/polls`):

- **View Details**: Click any poll to see full details and results
- **Edit**: Modify draft polls
- **Publish**: Make approved polls live
- **Pause/Resume**: Temporarily stop or restart voting
- **Close**: End voting and finalize results
- **Export**: Download results as CSV

### Poll Results

View comprehensive results including:
- Vote counts per option
- Percentage breakdowns
- Voter participation rates
- Response timestamps
- Visual charts and graphs

## Fundraising Campaigns

### What are Fundraising Campaigns?

Fundraising campaigns allow your school to collect donations for specific causes, projects, or initiatives. Use them for:
- School development projects
- Equipment purchases
- Scholarship funds
- Event sponsorship
- Emergency relief
- Community outreach

### Campaign Features

- **Goal Setting**: Define target amounts
- **Progress Tracking**: Real-time progress bars
- **Donor Management**: Track all contributions
- **Public Sharing**: Shareable donation links
- **Campaign Updates**: Post progress updates
- **Multiple Categories**: Organize by campaign type
- **Payment Integration**: Secure online donations via Paystack

### Campaign Statuses

| Status | Description |
|--------|-------------|
| Draft | Campaign created but not submitted |
| Pending Approval | Awaiting administrator review |
| Approved | Ready to be published |
| Live | Active and accepting donations |
| Paused | Temporarily stopped accepting donations |
| Closed | Campaign ended |
| Reconciled | Funds have been reconciled |
| Archived | Historical record only |

### Campaign Categories

- Infrastructure
- Equipment
- Scholarships
- Events
- Sports
- Arts & Culture
- Technology
- Emergency
- Other

### Creating a Campaign

1. Navigate to **Community Hub** → **Fundraising**
2. Click **"Create Campaign"** button
3. Fill in campaign details:
   - **Title**: Campaign name
   - **Description**: Explain the cause and goals
   - **Category**: Select appropriate category
   - **Goal Amount**: Set fundraising target
   - **Currency**: GHS (Ghana Cedis)
   - **Start/End Dates**: Campaign duration
   - **Images**: Add campaign photos (optional)
4. Submit for approval or save as draft
5. Once approved, publish to make it live

### Managing Campaigns

From the Fundraising page (`/admin/community/fundraising`):

- **View Details**: See full campaign information and donations
- **Edit**: Modify draft campaigns
- **Publish**: Make approved campaigns live
- **Pause/Resume**: Temporarily stop or restart donations
- **Close**: End the campaign
- **Post Updates**: Share progress with donors
- **Export Donations**: Download donor list as CSV

### Campaign Detail Page

Each campaign detail page includes:

- **Overview**: Campaign information and progress
- **Donations List**: All contributions with donor details
- **Updates Feed**: Posted campaign updates
- **Share Options**: Social sharing and link copying
- **Analytics**: Donation trends and patterns

### Donations

#### Viewing Donations

From a campaign detail page:
1. Navigate to the **Donations** tab
2. View all donations with:
   - Donor name
   - Amount contributed
   - Payment method
   - Date and time
   - Transaction status

#### Recording Manual Donations

For offline donations (cash, cheque):
1. Go to campaign detail page
2. Click **"Record Donation"**
3. Enter donor information
4. Specify amount and payment method
5. Save the donation

#### Online Donations

Public donation pages allow:
- Anonymous donations
- Secure payment via Paystack
- Automatic receipt generation
- Real-time campaign updates

### Campaign Updates

Keep donors informed with progress updates:

1. Go to campaign detail page
2. Click **"Post Update"**
3. Write your update message
4. Optionally attach images
5. Publish the update

Updates appear on the public campaign page and can be shared.

## Approval Workflow

### Why Approvals?

The approval workflow ensures:
- Quality control of community content
- Appropriate messaging and branding
- Compliance with school policies
- Review before public visibility

### Approval Process

1. **Submit**: Creator submits poll or campaign for approval
2. **Review**: Administrator reviews the submission
3. **Decision**:
   - **Approve**: Content is ready to publish
   - **Reject**: Content needs revision (with feedback)
4. **Publish**: Once approved, content can go live

### Managing Approvals

The "Needs Attention" card on the Community Hub dashboard shows pending approvals.

To review:
1. Click the pending item
2. Review all details
3. Choose **Approve** or **Reject**
4. If rejecting, provide feedback for the creator

## Best Practices

### For Polls

1. **Clear Questions**: Write unambiguous questions
2. **Limited Options**: Keep response options focused
3. **Appropriate Duration**: Allow adequate voting time
4. **Target Audience**: Ensure the right people can vote
5. **Communicate Purpose**: Explain why the poll matters
6. **Share Results**: Publish outcomes to build trust

### For Fundraising

1. **Compelling Story**: Explain why donations matter
2. **Realistic Goals**: Set achievable targets
3. **Regular Updates**: Keep donors informed of progress
4. **Thank Donors**: Acknowledge contributions
5. **Visual Content**: Use photos and videos
6. **Clear Timeline**: Communicate campaign duration
7. **Multiple Channels**: Promote across platforms

## Troubleshooting

### Poll Not Appearing

- Check poll status (must be "Live")
- Verify audience targeting
- Ensure start date has passed
- Confirm approval status

### Campaign Not Accepting Donations

- Verify campaign is "Live" status
- Check end date hasn't passed
- Ensure payment integration is configured
- Confirm approval status

### Export Not Working

- Check your internet connection
- Ensure you have permission to export
- Try a smaller date range
- Contact support if issues persist

## Related Documentation

- [Fees Dashboard](../fees/fees-dashboard.md): Managing fee payments
- [Reports](../reports/reports-analytics.md): Generate reports on community activity
