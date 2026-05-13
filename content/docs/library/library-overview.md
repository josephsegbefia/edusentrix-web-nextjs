# Library System

EduSentrix includes a full-featured library management system so your school can catalogue books, track circulation, manage fines, and give students a modern borrowing experience — all without third-party software.

## Book Catalogue

### Adding Books

1. Navigate to **Library → Catalogue** and click **"Add Book"**.
2. Enter details: **title, author(s), publisher, edition, year, category, and subject area**.
3. Optionally upload a **cover image** or let EduSentrix fetch one automatically.
4. Click **Save** to add the book to your catalogue.

### ISBN Lookup

Have a stack of new arrivals? Type or scan the **ISBN** and EduSentrix will auto-fill title, author, publisher, and cover image from online databases — saving you hours of manual data entry.

> **Tip:** If your school has a barcode scanner, connect it to your computer and scan ISBNs directly into the lookup field for lightning-fast cataloguing.

### Bulk Import

For large collections, use the **Import** tool:

1. Go to **Library → Import**.
2. Upload a CSV or Excel file with your book data.
3. Map columns to EduSentrix fields, review the preview, and confirm.

## Copy Management & Barcodes

A single catalogue entry (e.g., "Mathematics for JHS 2") can have multiple physical copies. Each copy gets:

- A **unique copy number** (e.g., Copy 1 of 5)
- A **condition status** (New, Good, Fair, Damaged, Lost)
- A **barcode** — generated automatically, ready to print on adhesive labels

Use **Library → Print Barcodes** to generate barcode label sheets for your label printer or standard A4 paper.

## Circulation: Checkout, Return & Renew

### Checking Out a Book

1. Go to **Library → Circulation** and click **"Checkout"**.
2. Search for the borrower (student or staff) by name or ID.
3. Scan or enter the book's **barcode / copy number**.
4. Confirm the due date (set by your library policy) and click **Issue**.

### Returning a Book

1. Click **"Return"** in the Circulation panel.
2. Scan or enter the barcode — the system identifies the borrower and loan automatically.
3. Note the book's condition and click **Confirm Return**.

### Renewing a Loan

If a book isn't reserved by someone else, the borrower can request a **renewal**. Librarians can approve renewals from the circulation queue, extending the due date by the configured loan period.

> **Tip:** Set your maximum renewals per book in **Library → Settings** to prevent indefinite borrowing.

## Reservations

When all copies of a book are checked out, students and staff can **place a reservation**. The system will:

- Notify the reserver when a copy becomes available
- Hold the copy for a configurable window (e.g., 48 hours)
- Automatically cancel the reservation if it isn't collected in time

## Overdue Management & Reminders

EduSentrix monitors due dates and handles overdue items automatically:

- **Automated reminders** — Email or in-app notifications sent 1 day before, on the due date, and at intervals you configure after the due date.
- **Overdue list** — A filterable dashboard showing all overdue items, days overdue, and borrower details.
- **Escalation** — After a configurable period, overdue items can be flagged for parent notification or admin follow-up.

## Fine Assessment

If your school charges library fines:

1. Go to **Library → Settings → Fines** and set the **daily rate** and any **grace period**.
2. Fines are calculated automatically when a book is returned late.
3. Outstanding fines appear on the borrower's library profile and can be linked to the school's finance module.

> **Tip:** You can waive fines on a case-by-case basis from the borrower's profile — useful for excused absences or first-time offenders.

## Reports & Analytics

The library dashboard provides at-a-glance metrics:

- **Total books and copies** in the catalogue
- **Active loans** and **overdue count**
- **Most borrowed titles** — see what students are reading
- **Borrower activity** — track reading habits by class or grade
- **Category breakdown** — visualise your collection composition
- **Fine collection summary**

Export any report to **CSV or PDF** for staff meetings or board presentations.

## Settings

Configure your library under **Library → Settings**:

- **Loan period** — Default number of days a book can be borrowed
- **Max renewals** — How many times a loan can be renewed
- **Reservation hold window** — How long a reserved copy is held
- **Fine rates and grace period**
- **Reminder schedule** — When and how often overdue reminders are sent
- **Barcode format** — Customise prefix and numbering

## Best Practices

1. **Barcode everything** — Scanning is far faster than manual entry during busy break-time checkouts.
2. **Run the ISBN lookup** — It populates most fields instantly and reduces data-entry errors.
3. **Review overdue reports weekly** — A short weekly check prevents small issues from snowballing.
4. **Involve students** — Assign library prefects to help with returns and shelving, tracked through their EduSentrix accounts.
5. **Keep conditions updated** — Mark damaged or lost copies promptly so your catalogue stays accurate.

## Related Documentation

- [Managing Students](../students/managing-students.md)
- [Financial Center](../finance/financial-center.md)
- [Reports & Analytics](../reports/reports-analytics.md)
