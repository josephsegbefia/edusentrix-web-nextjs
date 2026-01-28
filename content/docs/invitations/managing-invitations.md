# Managing Invitations

The Invitations module allows you to track and manage invitations sent to teachers, administrators, and parents. Access it from the admin sidebar at `/admin/invitations`.

## Overview

The Invitations feature provides:
- **Invitation Tracking**: Monitor all sent invitations
- **Status Management**: Track acceptance and expiration
- **Resend Capabilities**: Resend invitations as needed
- **Role-Based Invitations**: Invite users by role type
- **Integration with Clerk**: Seamless authentication setup

## How Invitations Work

### Invitation Flow

1. **User Created**: When you add a teacher, admin, or guardian with an email
2. **Invitation Sent**: System sends email via Clerk
3. **User Receives Email**: Email contains account setup link
4. **User Accepts**: User clicks link and sets up password
5. **Account Active**: User can now log in to EduSentrix

### Automatic Invitations

Invitations are automatically sent when:
- Creating a new teacher with email
- Adding a guardian to a student
- Creating an admin user

## Viewing Invitations

### Invitation List

The invitations page displays:
- All invitations sent
- Status indicators
- Role information
- Sent date
- Actions available

### Invitation Information

Each invitation shows:
- **Email**: Recipient email address
- **Role**: Teacher, Admin, or Parent
- **Status**: Pending, Accepted, Expired, Revoked
- **Sent Date**: When invitation was sent
- **Actions**: Available actions based on status

## Invitation Statuses

| Status | Description |
|--------|-------------|
| Pending | Invitation sent, awaiting acceptance |
| Accepted | User has accepted and set up account |
| Expired | Invitation link has expired |
| Revoked | Invitation was manually cancelled |

## Filtering Invitations

### Filter Options

- **By Status**: Pending, Accepted, Expired, Revoked
- **By Role**: Teacher, Admin, Parent
- **Search**: Find by email address

### Quick Filters

- **All**: View all invitations
- **Pending**: Invitations awaiting action
- **Accepted**: Successfully onboarded users
- **Expired**: Invitations that need resending

## Invitation Statistics

### Quick Stats

Displayed at the top of the page:
- **Total Invitations**: All-time count
- **Pending**: Awaiting acceptance
- **Accepted**: Successfully accepted
- **Expired**: Need attention

### Conversion Metrics

- Acceptance rate percentage
- Average time to accept
- Expiration rate

## Resending Invitations

### When to Resend

Resend invitations when:
- User didn't receive the email
- Invitation has expired
- User lost the original email
- Email went to spam

### How to Resend

1. Find the invitation in the list
2. Click the **"Resend"** button
3. Confirm the action
4. New invitation email sent
5. Status resets to Pending

### Resend Limits

- Avoid excessive resending (spam protection)
- Wait reasonable time between resends
- Verify email address is correct

## Revoking Invitations

### When to Revoke

Revoke invitations when:
- Sent to wrong email address
- Person is no longer joining
- Security concerns
- Administrative changes

### How to Revoke

1. Find the invitation in the list
2. Click the **"Revoke"** button
3. Confirm the action
4. Invitation link becomes invalid
5. Status changes to Revoked

### After Revocation

- User can no longer use the link
- You can send a new invitation
- Original invitation record preserved

## Invitation Details

Click any invitation to view details:

### Overview

- Full email address
- Role assigned
- Current status
- Sent timestamp

### Timeline

- When invitation was created
- When sent
- When accepted (if applicable)
- When expired or revoked (if applicable)

### Related Records

- Associated teacher/guardian record
- Linked student (for parent invitations)
- School information

## Managing Pending Invitations

### Following Up

For pending invitations:
1. Check if email was delivered
2. Verify email address is correct
3. Contact recipient directly
4. Resend if necessary

### Handling Expired

For expired invitations:
1. Review if still needed
2. Resend if person should join
3. Revoke if no longer relevant

## Role-Specific Considerations

### Teacher Invitations

- Created when adding a teacher
- Teacher can access teacher portal after accepting
- Linked to teacher profile

### Admin Invitations

- Created for school administrators
- Full admin access after accepting
- Higher privilege level

### Parent Invitations

- Created when adding guardians to students
- Access to parent portal
- View student information
- Multiple children linked automatically

## Email Delivery

### Invitation Email Contents

- Welcome message
- School name
- Role information
- Account setup link
- Expiration notice

### Email Not Received

Common causes:
- Spam/junk folder
- Incorrect email address
- Email filtering
- Full inbox

Solutions:
- Ask user to check spam
- Verify email spelling
- Add sender to whitelist
- Resend invitation

## Exporting Invitations

### Export Options

Export invitation data for:
- Tracking and reporting
- Audit purposes
- Follow-up campaigns

### Export Format

CSV export includes:
- Email address
- Role
- Status
- Sent date
- Accepted date (if applicable)

## Best Practices

### For Sending

1. **Verify Emails**: Double-check email addresses
2. **Inform Recipients**: Let them know to expect email
3. **Timing**: Send during business hours
4. **Batch Sending**: Group invitations appropriately

### For Follow-up

1. **Monitor Pending**: Check pending regularly
2. **Timely Resends**: Resend before expiration
3. **Direct Contact**: Reach out if issues persist
4. **Documentation**: Note any delivery issues

### For Security

1. **Revoke Promptly**: Cancel unnecessary invitations
2. **Verify Identity**: Ensure correct recipient
3. **Access Control**: Review role assignments
4. **Audit Trail**: Monitor invitation history

## Troubleshooting

### Invitation Not Sending

- Check email address format
- Verify Clerk configuration
- Check for system errors
- Contact support if persistent

### User Can't Accept

- Check invitation status (not expired/revoked)
- Verify link is complete
- Clear browser cache
- Try incognito/private browsing
- Resend invitation

### Wrong Role Assigned

- Revoke current invitation
- Update user record with correct role
- Send new invitation

### Duplicate Invitations

- System prevents duplicate emails
- Check existing invitations first
- Resend existing instead of creating new

## Integration with User Management

### After Acceptance

Once accepted:
- User account is created in Clerk
- User is linked to EduSentrix record
- Appropriate role permissions applied
- User can log in immediately

### User Record Sync

- Teacher/Guardian records updated
- User ID linked
- Status reflects in all modules

## Related Documentation

- [Managing Teachers](../teachers/managing-teachers.md): Creating teacher invitations
- [Managing Guardians](../students/managing-guardians.md): Parent invitations
- [Initial Setup](../getting-started/initial-setup.md): Onboarding process
