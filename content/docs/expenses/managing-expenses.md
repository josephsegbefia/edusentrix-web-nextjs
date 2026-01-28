# Managing Expenses

The Expenses module allows you to track and manage all school operational expenses. Access it from the admin sidebar at `/admin/expenses`.

## Overview

The Expenses feature provides comprehensive expense management for:
- **Expense Tracking**: Record and categorize all school expenses
- **Approval Workflow**: Multi-step approval process for expenses
- **Vendor Management**: Track payments to vendors and suppliers
- **Category Organization**: Organize expenses by category
- **Reporting**: Generate expense reports and analytics

## Dashboard

The Expenses page displays:

### KPI Cards

1. **Total Expenses**
   - All-time expense count
   - Overview of expense volume

2. **Pending Approval**
   - Expenses awaiting review
   - Submitted and waiting for approval

3. **Approved**
   - Expenses approved and ready to pay
   - Cleared for payment processing

4. **Paid This View**
   - Total amount paid in current view
   - Number of paid expenses

### Filter Options

- **Search**: Find expenses by title, expense number, or description
- **Status Filter**: Filter by Draft, Submitted, Approved, Rejected, Paid, Cancelled
- **Category Filter**: Filter by expense category

## Expense Statuses

| Status | Description |
|--------|-------------|
| Draft | Expense created but not submitted |
| Submitted | Pending approval review |
| Approved | Approved, ready for payment |
| Rejected | Rejected with feedback |
| Paid | Payment has been made |
| Cancelled | Expense voided |

## Creating an Expense

### Step 1: Open Create Modal

Click **"New Expense"** button in the header.

### Step 2: Fill in Expense Details

1. **Basic Information**:
   - **Title** (required): Descriptive name for the expense
   - **Expense Date**: Date the expense occurred
   - **Amount**: Expense amount in GHS

2. **Category Selection**:
   - Choose from predefined categories
   - Categories auto-seed on first use

3. **Vendor Selection** (optional):
   - Select existing vendor
   - Or create new vendor

4. **Additional Details**:
   - **Description**: Detailed explanation
   - **Invoice/Receipt Number**: Reference number
   - **Attachments**: Upload supporting documents

### Step 3: Save Expense

- **Save as Draft**: Save for later editing
- **Submit for Approval**: Send for review

## Expense Categories

Default categories include:
- Office Supplies
- Utilities
- Maintenance & Repairs
- Transportation
- Food & Catering
- Equipment
- Professional Services
- Communications
- Insurance
- Miscellaneous

### Managing Categories

Categories can be:
- Added by administrators
- Edited for naming changes
- Archived when no longer needed
- Used for expense organization and reporting

## Vendor Management

### Adding Vendors

1. Navigate to expense creation or vendor management
2. Click **"Add Vendor"**
3. Fill in vendor details:
   - **Name** (required)
   - **Contact Person**
   - **Email**
   - **Phone**
   - **Address**
   - **Tax ID** (if applicable)
4. Save vendor

### Using Vendors

When creating expenses:
- Select from existing vendors
- Create new vendors on-the-fly
- Track all payments per vendor

## Approval Workflow

### Submitting for Approval

1. Create expense in draft mode
2. Review all details
3. Click **"Submit for Approval"**
4. Expense status changes to "Submitted"

### Approving Expenses

For administrators with approval permissions:

1. View submitted expenses
2. Review expense details and attachments
3. Choose action:
   - **Approve**: Expense is approved for payment
   - **Reject**: Expense needs revision (provide reason)

### Approval Rules

- Only submitted expenses can be approved/rejected
- Rejected expenses return to draft for editing
- Approved expenses can proceed to payment

## Payment Processing

### Marking as Paid

1. Navigate to approved expense
2. Click **"Mark as Paid"**
3. Enter payment details:
   - **Payment Date**
   - **Payment Method**
   - **Reference Number**
4. Confirm payment

### Payment Methods

- Cash
- Bank Transfer
- Cheque
- Mobile Money
- Card

## Expense Detail Page

Each expense has a detail page showing:

### Overview Section
- Expense number
- Title and description
- Amount and currency
- Category and vendor
- Status badge

### Timeline
- Creation date
- Submission date
- Approval/Rejection date
- Payment date

### Actions
- Edit (draft only)
- Submit for approval
- Approve/Reject (admins)
- Mark as Paid (approved only)
- Cancel

### Attachments
- View uploaded documents
- Download receipts/invoices
- Add additional attachments

## Editing Expenses

### Editable Statuses

Expenses can only be edited when in:
- **Draft**: Full editing capabilities
- **Rejected**: Edit and resubmit

### Non-Editable Statuses

Once submitted, approved, or paid:
- Only cancel option available
- Historical record maintained

## Cancelling Expenses

1. Navigate to expense detail
2. Click **"Cancel Expense"**
3. Provide cancellation reason
4. Confirm cancellation

**Note**: Cancelled expenses cannot be restored but remain in records.

## Bulk Operations

### Available Actions (Coming Soon)
- Bulk approve submitted expenses
- Bulk export expenses
- Bulk category assignment

## Reporting

### Expense Reports

Generate reports for:
- Expenses by category
- Expenses by vendor
- Expenses by date range
- Expenses by status

### Exporting Data

Export expense data as:
- CSV for spreadsheet analysis
- Integration with Financial Center

## Integration with Financial Center

Paid expenses automatically:
- Create outflow transactions
- Update financial ledger
- Reflect in cash flow reports
- Appear in spending analytics

## Best Practices

1. **Timely Recording**: Enter expenses promptly
2. **Attach Documents**: Always upload receipts/invoices
3. **Accurate Categories**: Use appropriate categories
4. **Clear Descriptions**: Write detailed descriptions
5. **Vendor Records**: Maintain accurate vendor information
6. **Regular Review**: Approve pending expenses regularly
7. **Budget Tracking**: Monitor against budgets

## Troubleshooting

### Expense Not Submitting

- Ensure all required fields are filled
- Check category is selected
- Verify amount is valid
- Try saving as draft first

### Cannot Approve Expense

- Verify you have approval permissions
- Ensure expense is in "Submitted" status
- Check for any validation errors

### Attachment Upload Failing

- Check file size limits
- Verify file format is supported
- Ensure stable internet connection

## Related Documentation

- [Financial Center](../finance/financial-center.md): Unified financial overview
- [Reports](../reports/reports-analytics.md): Generate expense reports
