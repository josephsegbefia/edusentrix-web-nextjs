# Fees Dashboard

The Fees & Payments dashboard provides a comprehensive overview of your school's financial operations, revenue tracking, and collection management. Access it from the admin sidebar at `/admin/fees`.

## Overview

The fees dashboard is your central hub for:
- **Revenue Tracking**: Monitor total revenue, monthly revenue, and collection rates
- **Invoice Management**: Track invoice statuses and outstanding balances
- **Payment Monitoring**: View recent payments and upcoming due dates
- **Collection Health**: Identify defaulters and at-risk accounts
- **Quick Actions**: Create invoices, record payments, and manage fee structures

## Dashboard Sections

### Quick Stats Cards

At the top of the dashboard, you'll find four key metric cards:

1. **Total Revenue**
   - Shows cumulative revenue from all paid invoices
   - Includes all payment methods and periods
   - Updates in real-time via Server-Sent Events (SSE)

2. **Monthly Revenue**
   - Displays revenue for the current month
   - Helps track monthly collection trends
   - Useful for budgeting and forecasting

3. **Outstanding**
   - Total amount owed across all unpaid and partially paid invoices
   - Critical metric for collection management
   - Click to view detailed breakdown

4. **Collection Rate**
   - Percentage of issued invoices that have been fully paid
   - Calculated as: (Total Paid / Total Issued) × 100
   - Key indicator of collection health

### Invoice Status Overview

A comprehensive breakdown of invoices by status:

- **Draft**: Invoices created but not yet issued
- **Issued**: Invoices sent to parents/students
- **Partially Paid**: Invoices with some payments but balance remaining
- **Paid**: Fully paid invoices
- **Overdue**: Issued invoices past their due date
- **Cancelled**: Voided invoices

Each status card shows:
- Count of invoices in that status
- Color-coded indicators for quick visual reference
- Click to filter invoices by status

### Upcoming Due (Next 14 Days)

This section highlights invoices with due dates in the next two weeks:

- **Student Information**: Name and admission number
- **Invoice Number**: Quick reference for tracking
- **Academic Period**: Term and year
- **Outstanding Amount**: Amount still owed
- **Due Date**: When payment is expected

**Actions**:
- Click any invoice to view full details
- Use this section to prioritize collection efforts
- Send payment reminders proactively

### Top Defaulters

Identifies students with the highest outstanding balances:

- **Student Name**: Full name and admission number
- **Invoice Count**: Number of outstanding invoices
- **Total Outstanding**: Combined amount owed
- **Latest Due Date**: Most recent invoice due date

**Use Cases**:
- Prioritize collection efforts
- Schedule parent meetings
- Identify students needing payment plans
- Track persistent defaulters

### Recent Payments

A feed of the most recent payment transactions:

- **Student Name**: Who made the payment
- **Invoice Number**: Which invoice was paid
- **Payment Method**: Cash, Mobile Money, Bank Transfer, etc.
- **Amount**: Payment amount
- **Date**: When payment was recorded

**Features**:
- Real-time updates as payments are recorded
- Quick view of payment trends
- Click "View All" to see complete payment history

### Quick Actions

Common tasks accessible directly from the dashboard:

1. **Create Invoice**: Single invoice creation for one student
2. **Bulk Create Invoice**: Create invoices for multiple students at once
3. **Record Payment**: Log a payment transaction
4. **Manage Fee Structures**: Configure fee templates
5. **View All Invoices**: Navigate to invoice management page

## Real-Time Updates

The dashboard uses Server-Sent Events (SSE) to update automatically:

- **Metrics**: Revenue, outstanding, and collection rate update live
- **Status Counts**: Invoice status breakdown refreshes automatically
- **Recent Payments**: New payments appear instantly
- **Upcoming Due**: Changes reflect immediately
- **Top Defaulters**: Updates as payments are recorded

No manual refresh needed - the dashboard stays current automatically.

## Best Practices

1. **Daily Monitoring**: Check the dashboard daily to stay on top of collections
2. **Focus on Overdue**: Prioritize overdue invoices and upcoming dues
3. **Track Collection Rate**: Monitor collection rate trends over time
4. **Use Quick Actions**: Leverage quick action buttons for common tasks
5. **Review Defaulters**: Regularly review top defaulters list
6. **Export Data**: Export reports for external analysis when needed

## Tips

- **Color Coding**: Use status colors to quickly identify invoice states
- **Click Through**: Click any metric or card to drill down into details
- **Filter Views**: Use status filters to focus on specific invoice types
- **Payment Trends**: Monitor recent payments to identify payment patterns
- **Proactive Collection**: Use upcoming dues to send reminders before due dates

## Related Documentation

- [Creating Invoices](./creating-invoices.md)
- [Recording Payments](./recording-payments.md)
- [Managing Fee Structures](./managing-fee-structures.md)
- [Managing Student Credit](./managing-student-credit.md)
