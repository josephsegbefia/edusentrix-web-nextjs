# Financial Center

The Financial Center provides a unified view of all money movements across your school. Access it from the admin sidebar at `/admin/finance`.

## Overview

The Financial Center is your central financial dashboard for:
- **Money Flow Tracking**: Monitor all inflows and outflows
- **Transaction Management**: View and manage all financial transactions
- **Category Analysis**: Breakdown of income and spending by category
- **Financial Health**: Track net position and pending transactions
- **Quick Access**: Navigate to related financial modules

## Dashboard

### Time Range Selector

Filter the dashboard by time period:
- **Today**: Current day transactions
- **This Week**: Current week
- **This Month**: Current month (default)
- **Last 30 Days**: Rolling 30-day window

### KPI Cards

1. **Total Inflow** (Green)
   - All incoming money for the period
   - Transaction count
   - Percentage change vs. previous period
   - Sources: Fees, Fundraising, Other Income

2. **Total Outflow** (Red)
   - All outgoing money for the period
   - Transaction count
   - Percentage change vs. previous period
   - Destinations: Expenses, Refunds, Adjustments

3. **Net Position** (Blue/Red)
   - Inflow minus Outflow
   - Indicates "Positive" or "Deficit"
   - Overall financial health indicator

4. **Pending** (Amber)
   - Transactions awaiting completion
   - Pending amount total
   - Requires attention

### Failed Transaction Alert

If there are failed transactions, a prominent alert displays:
- Number of failed transactions
- Total failed amount
- Quick link to view and resolve

## Category Breakdowns

### Income by Category

Visual breakdown of money sources:
- **Fees**: Student fee payments
- **Store**: School store sales
- **Fundraising**: Donation campaigns
- **Other Income**: Miscellaneous income

Each category shows:
- Total amount
- Percentage of total income
- Visual progress bar

### Spending by Category

Visual breakdown of money usage:
- **Expenses**: Operational expenses
- **Refunds**: Returned payments
- **Adjustments**: Financial adjustments

## Quick Links

Navigate to related modules:

1. **All Transactions**: View complete transaction ledger
2. **Expenses**: Manage operational expenses
3. **Fees & Payments**: Fee collection and management

## Recent Transactions

Real-time feed of the latest transactions showing:
- Transaction type (inflow/outflow with icons)
- Description or reference
- Category
- Date and time
- Amount (color-coded)

Click any transaction to view full details.

## Recording Transactions

### Manual Transaction Entry

For transactions not automatically captured:

1. Click **"Record Transaction"** button
2. Fill in transaction details:
   - **Direction**: Inflow or Outflow
   - **Category**: Select appropriate category
   - **Amount**: Transaction amount
   - **Description**: Clear description
   - **Date**: When transaction occurred
   - **Reference**: Optional reference number
3. Submit transaction

### Automatic Transactions

The following are automatically recorded:
- **Fee Payments**: From fees module
- **Paid Expenses**: From expenses module
- **Fundraising Donations**: From campaigns
- **Online Payments**: Via payment gateways

## Transaction Ledger

Access the full ledger at `/admin/finance/transactions`.

### Viewing Transactions

Each transaction displays:
- Direction (inflow/outflow)
- Category and description
- Amount
- Status (completed, pending, failed)
- Date/time
- Reference number

### Transaction Filters

- **Direction**: All, Inflow, Outflow
- **Category**: Filter by specific category
- **Status**: Completed, Pending, Failed
- **Date Range**: Custom date filtering

### Transaction Detail Page

Click any transaction to view:
- Full transaction information
- Related entity (invoice, expense, campaign)
- Timeline and history
- Approval status (if applicable)

## Transaction Statuses

| Status | Description |
|--------|-------------|
| Completed | Transaction successfully processed |
| Pending | Awaiting completion or approval |
| Failed | Transaction failed (needs attention) |

## Budgets

### Budget Management

Access budgets at `/admin/finance/budgets`.

#### Creating a Budget

1. Navigate to **Financial Center** → **Budgets**
2. Click **"Create Budget"**
3. Fill in budget details:
   - **Name**: Budget title
   - **Category**: What it's budgeting for
   - **Amount**: Budgeted amount
   - **Period**: Budget duration
   - **Description**: Purpose and notes
4. Save budget

#### Tracking Budgets

Monitor budget utilization:
- Allocated amount
- Spent amount
- Remaining balance
- Utilization percentage

## Exporting Data

### Export Transactions

1. Navigate to transactions page
2. Apply desired filters
3. Click **"Export"** button
4. Choose format (CSV)
5. Download file

### Export Includes

- Transaction ID
- Date and time
- Direction
- Category
- Amount
- Description
- Reference
- Status

## Financial Reports

Generate financial reports from the Reports module:
- Revenue trends over time
- Expense breakdowns
- Cash flow analysis
- Category comparisons
- Period-over-period comparisons

## Integration Points

### Fees Module
- Fee payments create inflow transactions
- Revenue tracked in real-time
- Collection rates calculated

### Expenses Module
- Paid expenses create outflow transactions
- Spending tracked by category
- Vendor payments recorded

### Fundraising
- Donations create inflow transactions
- Campaign progress updated
- Donor records maintained

### Payment Gateways
- Paystack payments auto-recorded
- Mobile Money transactions tracked
- Bank transfers logged

## Best Practices

1. **Daily Review**: Check Financial Center daily
2. **Reconciliation**: Regularly reconcile with bank statements
3. **Categorization**: Use consistent categories
4. **Documentation**: Add clear descriptions
5. **Monitor Pending**: Address pending transactions promptly
6. **Review Failed**: Investigate and resolve failed transactions
7. **Budget Tracking**: Monitor budget utilization

## Troubleshooting

### Transaction Not Appearing

- Check the time range filter
- Verify transaction status
- Ensure transaction was completed
- Check category filters

### Incorrect Totals

- Verify time range selection
- Check for pending transactions
- Ensure all transactions are categorized
- Review for duplicates

### Export Failing

- Check internet connection
- Try smaller date range
- Verify export permissions
- Clear browser cache

## Related Documentation

- [Fees Dashboard](../fees/fees-dashboard.md): Fee collection management
- [Managing Expenses](../expenses/managing-expenses.md): Expense tracking
- [Community Hub](../community/community-hub.md): Fundraising campaigns
- [Reports](../reports/reports-analytics.md): Financial reporting
