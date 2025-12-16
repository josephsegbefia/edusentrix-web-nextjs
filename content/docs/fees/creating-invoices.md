# Creating Invoices

Invoices are the foundation of the fee collection system. Each invoice represents fees owed by a student for a specific academic period.

## Understanding Invoices

An invoice contains:
- **Student**: The student being invoiced
- **Academic Period**: The term/year the invoice covers
- **Line Items**: Individual fees (Tuition, Library, Sports, etc.)
- **Due Date**: When payment is expected
- **Status**: Draft, Issued, Partially Paid, Paid, Overdue, or Cancelled

## Creating a Single Invoice

### Step 1: Access Invoice Creation

From the Fees Dashboard:
1. Click **"Create Invoice"** button
2. Or navigate to `/admin/fees/invoices` and click **"Create Invoice"**

### Step 2: Select Student

- Use the **search bar** to find a student
- Search by name or admission number
- Results show student photo, name, and admission number
- Click a student card to select

**Features**:
- Debounced search (waits for you to stop typing)
- Visual student cards with photos
- Real-time search results

### Step 3: Select Academic Period

**Current Period**:
- Shows the current academic period as a selectable card
- Click to select automatically

**Past Periods**:
- Use the dropdown to select a past period
- Useful for creating invoices for previous terms

**Note**: Selecting one removes the other - you can only select current OR past period.

### Step 4: Configure Line Items

Add fees to the invoice:

1. **Add Line Item**: Click **"Add Line Item"**
2. **Select Fee Structure** (optional):
   - Choose from existing fee structures
   - Automatically fills name and amount
   - Can be customized after selection
3. **Enter Details**:
   - **Name**: Fee name (e.g., "Tuition", "Library Fee")
   - **Amount**: Fee amount in GHS
   - **Description**: Optional details
4. **Configure Installments** (if applicable):
   - Toggle **"Allows Installments"**
   - Set **Number of Installments**
   - **Custom Schedule**: Define specific due dates and amounts for each installment
   - **Auto-Generate**: Let the system evenly distribute installments

### Step 5: Set Due Date

- Choose when payment is expected
- Defaults to end of academic period
- Can be customized per invoice

### Step 6: Review & Create

Review the invoice summary:
- Student information
- Academic period
- Total amount
- Number of line items
- Installment details (if applicable)

Click **"Create Invoice"** to save as draft.

## Bulk Invoice Creation

Create invoices for multiple students at once:

### Step 1: Access Bulk Creation

From the Fees Dashboard:
1. Click **"Bulk Create Invoice"** button

### Step 2: Select Students

**Option A: Search & Select Individual Students**
- Use search bar to find students
- Click student cards to add to selection
- Students appear in selected list

**Option B: Select by Grade**
- Search for a grade (e.g., "JHS 1")
- Click grade chip to select
- Shows class groups for that grade
- Click class group chip to select all students in that group

**Option C: Select by Class Group**
- Search for a class group (e.g., "JHS 1 A")
- Click class group chip to select
- All students in that group are added

**Excluding Students from Class Groups**:
- Click the class group chip to open exclusion modal
- Toggle students to exclude them
- Excluded students won't receive invoices

### Step 3: Configure Invoice Details

Same as single invoice creation:
- Select academic period
- Configure line items
- Set due date
- Configure installments

**Note**: All selected students receive invoices with the same configuration.

### Step 4: Review & Create

Review summary:
- Number of students selected
- Total invoices to be created
- Total amount across all invoices
- Line items breakdown

Click **"Bulk Create Invoices"** to create all invoices.

## Invoice Statuses

### Draft
- Invoice created but not yet issued
- Can be edited or deleted
- Not visible to parents/students

### Issued
- Invoice sent to parents/students
- Cannot be edited (only adjusted)
- Can receive payments
- Visible to parents/students

### Partially Paid
- Some payments received
- Balance still outstanding
- Can receive more payments

### Paid
- Fully paid
- All line items paid
- No outstanding balance

### Overdue
- Past due date
- Still has outstanding balance
- Requires attention

### Cancelled
- Invoice voided
- Cannot be paid
- Historical record only

## Issuing an Invoice

After creating a draft invoice:

1. Go to the invoice detail page
2. Click **"Issue Invoice"** button
3. Confirm issuance
4. Invoice status changes to "Issued"
5. Parents/students can now view and pay

**Bulk Issue**:
- From invoice list page
- Select multiple draft invoices
- Click **"Issue Selected"**
- All selected invoices are issued at once

## Adding Adjustments

For issued invoices, you can add adjustments:

1. Go to invoice detail page
2. Click **"Add Adjustment"** button
3. Select adjustment type:
   - **Waiver**: Fee reduction/forgiveness
   - **Scholarship**: Scholarship discount
   - **Correction**: Error correction
   - **Penalty**: Late payment penalty
   - **Other**: Other adjustments
4. Enter amount and reason
5. Save adjustment

**Note**: Adjustments are added as line items and recalculate invoice totals automatically.

## Best Practices

1. **Create Before Issue**: Create invoices in draft, review, then issue
2. **Use Fee Structures**: Leverage fee structures for consistency
3. **Set Realistic Due Dates**: Allow adequate time for payment
4. **Configure Installments**: Set up installments for large fees
5. **Review Before Issue**: Always review before issuing
6. **Bulk Operations**: Use bulk creation for efficiency
7. **Document Adjustments**: Always provide clear reasons for adjustments

## Tips

- **Templates**: Create common invoice templates using fee structures
- **Due Dates**: Set due dates strategically (e.g., end of month)
- **Installments**: Use installments for high-value fees to improve collection
- **Bulk Create**: Use bulk creation for class-wide fees
- **Review**: Review invoices before issuing to avoid errors
- **Adjustments**: Document all adjustments clearly for audit purposes

## Related Documentation

- [Fees Dashboard](./fees-dashboard.md)
- [Recording Payments](./recording-payments.md)
- [Managing Fee Structures](./managing-fee-structures.md)
- [Managing Student Credit](./managing-student-credit.md)
