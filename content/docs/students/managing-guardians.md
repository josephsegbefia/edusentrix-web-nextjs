# Managing Guardians & Parents

Guardians (parents) are an essential part of student management in EduSentrix. This guide covers how to add, edit, and manage guardians for your students.

## Overview

Each student can have multiple guardians linked to their account, but only **one guardian can be designated as the primary contact**. Guardians can be linked to multiple students, making it easy to manage families with multiple children in your school.

## Adding a Guardian

### Step 1: Navigate to Student Detail Page

1. Go to **Students** from the admin dashboard
2. Click on any student card or use the search to find a specific student
3. Navigate to the **Relationships** tab

### Step 2: Open Guardian Management

1. Click the **"Manage Guardians"** button in the Parents & Guardians section
2. Click **"Add Guardian"** in the modal that opens

### Step 3: Fill in Guardian Information

The guardian creation form has three steps:

#### Step 1: Basic Information
- **First Name** (required)
- **Last Name** (required)
- **Email Address** (required) - Used for account creation and invitations
- **Phone Number** (optional)

#### Step 2: Photo & Relationship
- **Guardian Photo** (optional) - Upload via Cloudinary
- **Relationship** (required) - Select from:
  - Mother
  - Father
  - Guardian
  - Step Mother
  - Step Father
  - Grandmother
  - Grandfather
  - Aunt
  - Uncle
  - Other
- **Primary Contact** - Select whether this guardian is the primary contact:
  - **Yes, Primary Contact**: This guardian will be the main point of contact
  - **No, Secondary Contact**: Additional guardian (not primary)

#### Step 3: Additional Details
- **Occupation** (optional) - Enter the guardian's profession or job title

### Step 4: Submit

Click **"Create Guardian"** to complete the process. The system will:
1. Create or update the parent user account
2. Send a Clerk invitation email for account setup
3. Link the guardian to the student
4. Update the guardian list in real-time

## Editing a Guardian

1. Navigate to the student's **Relationships** tab
2. Click **"Manage Guardians"**
3. Click the **Edit** icon (pencil) next to the guardian you want to edit
4. Update the information in the form
5. Click **"Update Guardian"**

**Note**: Email addresses cannot be changed after creation. If you need to change an email, you'll need to remove the guardian and add them again with the new email.

## Setting Primary Guardian

Only one guardian per student can be the primary contact. To change the primary guardian:

1. Navigate to the student's **Relationships** tab
2. Click **"Manage Guardians"**
3. Click the **Star** icon next to the guardian you want to set as primary

The system will automatically:
- Remove primary status from the current primary guardian
- Set the selected guardian as the new primary contact
- Update all displays in real-time

## Removing a Guardian

1. Navigate to the student's **Relationships** tab
2. Click **"Manage Guardians"**
3. Click the **Delete** icon (trash) next to the guardian you want to remove
4. Confirm the deletion

**Important Notes:**
- Removing a guardian unlinks them from the student
- If the parent is linked to other students, their account remains active
- If the parent has no other student links, their account may be automatically cleaned up
- All guardian removals are logged in the activity feed

## Guardian Account Creation

When you add a guardian with a new email address:

1. **User Account Created**: A new user account is created with the `parent` role
2. **Clerk Invitation Sent**: An invitation email is sent via Clerk
3. **Password Setup**: The parent receives instructions to set up their password
4. **Account Access**: Once set up, the parent can log in and view their child's information

If the email already exists in the system:
- The existing user account is updated
- The user's role is set to `parent` if not already
- A new invitation may be sent if needed

## Real-time Updates

Guardian lists update automatically when:
- A new guardian is added
- A guardian is edited
- A guardian is removed
- Primary guardian status changes

These updates happen via Server-Sent Events (SSE), so you don't need to refresh the page to see changes.

## Best Practices

1. **Always Set a Primary Guardian**: Ensure at least one guardian is marked as primary for emergency contacts
2. **Keep Contact Information Updated**: Regularly review and update phone numbers and emails
3. **Use Clear Relationships**: Select the most accurate relationship type for better organization
4. **Add Occupation When Available**: This helps with communication and record-keeping
5. **Upload Photos**: Guardian photos help with identification and personalization

## Troubleshooting

### Guardian Not Receiving Invitation Email
- Check the email address for typos
- Verify the email is not in spam/junk folder
- Check Clerk dashboard for invitation status
- You can resend invitations from the user management section

### Cannot Set Primary Guardian
- Ensure the guardian is successfully linked to the student
- Check that you have admin permissions
- Try refreshing the page if real-time updates didn't sync

### Guardian Appears Multiple Times
- Each guardian-student relationship is unique
- A parent with multiple children will appear once per child
- This is expected behavior and allows for different relationships per child

## Related Features

- **Student Detail Pages**: View all guardians for a student
- **Activity Logs**: Track all guardian-related actions
- **User Management**: Manage parent accounts and permissions
- **Invitation System**: Track and manage parent invitations
