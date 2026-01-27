# Managing Fee Structures

Fee structures are templates that define the types of fees your school charges. They serve as reusable templates when creating invoices, ensuring consistency and efficiency.

## What are Fee Structures?

Fee structures define:
- **Fee Name**: What the fee is for (e.g., "Tuition", "Library Fee", "Sports Fee")
- **Fee Code**: Short identifier for the fee type
- **Default Amount**: Standard amount for this fee
- **Installment Support**: Whether this fee can be paid in installments
- **Maximum Installments**: How many installments are allowed (if applicable)

## Accessing Fee Structures

Navigate to **Fees & Payments** → **Quick Actions** → **Manage Fee Structures**, or go directly to `/admin/fees/structures`.

## Creating a Fee Structure

1. Click the **"Create Fee Structure"** button
2. Fill in the required information:
   - **Name**: Descriptive name (e.g., "Term 1 Tuition")
   - **Code**: Short code (e.g., "TUI-001")
   - **Category**: Optional categorization
   - **Default Amount**: Standard amount in Ghana Cedis (GHS)
   - **Allows Installments**: Toggle if installments are allowed
   - **Max Installments**: If installments allowed, specify maximum number
3. Click **"Create"** to save

## Editing a Fee Structure

1. Find the fee structure in the list
2. Click the **Edit** button (pencil icon)
3. Modify the fields as needed
4. Click **"Save Changes"**

**Note**: Editing a fee structure does not affect existing invoices - only future invoices will use the updated values.

## Deleting a Fee Structure

1. Find the fee structure in the list
2. Click the **Delete** button (trash icon)
3. Confirm deletion

**Warning**: Fee structures cannot be deleted if they are referenced by existing invoices. You must first remove or update those invoices.

## Common Fee Structure Examples

### Tuition Fees
- **Name**: "Term 1 Tuition"
- **Code**: "TUI-001"
- **Default Amount**: Varies by grade
- **Installments**: Usually allowed (3-4 installments)

### Library Fees
- **Name**: "Library Fee"
- **Code**: "LIB-001"
- **Default Amount**: Fixed amount (e.g., 50 GHS)
- **Installments**: Usually not allowed

### Sports Fees
- **Name**: "Sports & Games Fee"
- **Code**: "SPT-001"
- **Default Amount**: Fixed amount
- **Installments**: Optional

### Development Fees
- **Name**: "Development Levy"
- **Code**: "DEV-001"
- **Default Amount**: Fixed amount
- **Installments**: Usually not allowed

## Best Practices

1. **Consistent Naming**: Use clear, consistent naming conventions
2. **Descriptive Codes**: Use codes that are easy to identify
3. **Set Defaults**: Set appropriate default amounts to speed up invoice creation
4. **Installment Policy**: Clearly define which fees allow installments
5. **Regular Review**: Periodically review and update fee structures
6. **Documentation**: Keep notes on fee structure purposes and policies

## Tips

- **Create Templates**: Set up common fee structures at the beginning of each academic year
- **Use Categories**: Categorize fees for better organization
- **Default Amounts**: Set realistic default amounts to reduce manual entry
- **Installment Limits**: Set appropriate installment limits based on your school's policy
- **Archive Old Structures**: Instead of deleting, consider marking as inactive for historical records

## Related Documentation

- [Creating Invoices](./creating-invoices.md)
- [Fees Dashboard](./fees-dashboard.md)
