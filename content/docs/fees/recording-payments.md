# Recording Payments

Recording payments accurately is crucial for maintaining financial records and tracking collection. This guide covers how to record payments and allocate them to invoice line items.

## Understanding Payments

A payment record includes:
- **Invoice**: Which invoice is being paid
- **Amount**: Payment amount
- **Payment Method**: How payment was made (Cash, Mobile Money, Bank Transfer, Card)
- **Allocations**: How the payment is split across invoice line items
- **Date**: When payment was received

## Recording a Payment

### Step 1: Access Payment Recording

From the Fees Dashboard:
1. Click **"Record Payment"** button
2. Or navigate to `/admin/fees/payments/record`

### Step 2: Select Invoice

- Use **search** to find the invoice
- Search by invoice number or student name
- Select the invoice from results
- Invoice details display:
  - Student information
  - Total amount
  - Amount paid
  - Outstanding balance
  - Line items breakdown

### Step 3: Enter Payment Details

1. **Payment Amount**:
   - Enter amount received
   - Cannot exceed outstanding balance
   - System validates amount

2. **Payment Method**:
   - **Cash**: Physical cash payment
   - **Mobile Money**: MTN MoMo, Vodafone Cash, AirtelTigo
   - **Bank Transfer**: Direct bank transfer
   - **Card**: Card payment via Paystack
   - **Other**: Other payment methods

3. **Payment Date**:
   - Defaults to today
   - Can be adjusted for backdated payments

### Step 4: Allocate Payment

**Flexible Allocation**:
- Parents choose which line items to pay first
- Allocate payment across multiple line items
- System shows:
  - Line item name
  - Outstanding amount
  - Amount to allocate

**Allocation Rules**:
- Total allocation must equal payment amount
- Cannot allocate more than line item outstanding
- Can partially pay line items
- System validates allocations automatically

**Installment Payments**:
- If line item has installments, payment applies to installments
- System automatically updates installment status
- Shows which installments are paid/partially paid

### Step 5: Review & Record

Review payment summary:
- Invoice details
- Payment amount
- Payment method
- Allocations breakdown
- Remaining balance

Click **"Record Payment"** to save.

## Payment Allocation Logic

### Automatic Allocation

If you don't manually allocate:
- System allocates to oldest line items first
- Follows line item display order
- Pays installments in order

### Manual Allocation

**Recommended Approach**:
- Let parents choose allocation
- Respects parent preferences
- More flexible and transparent

**Steps**:
1. Enter payment amount
2. Manually distribute across line items
3. System validates totals
4. Save allocation

## Payment Status Updates

After recording payment:

1. **Invoice Status**:
   - Updates to "Partially Paid" or "Paid"
   - Based on remaining balance

2. **Line Item Status**:
   - Updates to "Partially Paid" or "Paid"
   - Based on line item balance

3. **Installment Status**:
   - Updates individual installment statuses
   - Shows payment progress

4. **Student Credit**:
   - If overpayment occurs, creates credit balance
   - Credit can be applied to future invoices

## Handling Overpayments

If payment exceeds outstanding balance:

1. **System Detects Overpayment**
2. **Creates Student Credit**:
   - Credit balance is created
   - Can be viewed on invoice detail page
   - Can be applied to future invoices

3. **Credit Application**:
   - Go to invoice detail page
   - Click "Apply Credit" button
   - Select amount to apply
   - Credit reduces invoice balance

## Payment Methods

### Cash
- Physical cash received
- Requires receipt generation
- Common for school office payments

### Mobile Money
- MTN Mobile Money
- Vodafone Cash
- AirtelTigo Money
- Requires transaction reference

### Bank Transfer
- Direct bank transfer
- Requires bank reference number
- Common for large payments

### Card (Paystack)
- Card payments via Paystack
- Automatic gateway integration
- Real-time payment confirmation

## Best Practices

1. **Record Promptly**: Record payments as soon as received
2. **Verify Amounts**: Double-check payment amounts before recording
3. **Get References**: Always record payment references (receipt numbers, transaction IDs)
4. **Respect Allocations**: Honor parent payment preferences when allocating
5. **Handle Overpayments**: Properly manage student credit from overpayments
6. **Generate Receipts**: Provide receipts for all payments
7. **Reconcile Regularly**: Reconcile payments with bank statements regularly

## Tips

- **Quick Recording**: Use "Record Payment" from dashboard for quick access
- **Search Efficiently**: Use invoice number for fastest search
- **Allocation Flexibility**: Let parents choose allocation for better relationships
- **Credit Management**: Monitor student credit balances regularly
- **Payment History**: Review payment history to identify patterns
- **Receipts**: Generate receipts immediately after recording payment

## Common Scenarios

### Full Payment
- Payment equals outstanding balance
- Invoice status changes to "Paid"
- All line items marked as paid

### Partial Payment
- Payment less than outstanding balance
- Invoice status remains "Partially Paid"
- Selected line items updated

### Multiple Payments
- Record multiple payments for same invoice
- Each payment can be allocated differently
- System tracks cumulative payments

### Installment Payment
- Payment applies to specific installments
- System updates installment status
- Shows progress toward completion

## Related Documentation

- [Fees Dashboard](./fees-dashboard.md)
- [Creating Invoices](./creating-invoices.md)
- [Managing Student Credit](./managing-student-credit.md)
