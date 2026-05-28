# Platform email — external setup (Spacemail + DNS)

Complete these steps in **Spacemail** and your **DNS** provider alongside the app deployment. The app polls three IMAP mailboxes and routes school replies from `reply.tryedusentrix.app` into the support inbox.

---

## 1. Three Spacemail mailboxes

Create three separate mailboxes (if not already present):

| Mailbox | Purpose |
|---------|---------|
| `hello@tryedusentrix.app` | Proposals, growth, general platform mail |
| `support@tryedusentrix.app` | Platform support + **all** `*@reply.tryedusentrix.app` mail |
| `billing@tryedusentrix.app` | Platform billing |

Enable **IMAP** for each and note host (usually `mail.spacemail.com` or `mail.spaceship.com`), port `993`, and passwords.

---

## 2. Environment variables (`.env.local`)

Shared IMAP host (optional if all use the same host):

```env
SPACEMAIL_IMAP_HOST=mail.spacemail.com
```

Per-mailbox credentials (recommended):

```env
# Hello
SPACEMAIL_HELLO_IMAP_USER=hello@tryedusentrix.app
SPACEMAIL_HELLO_IMAP_PASSWORD=

# Support (legacy SPACEMAIL_IMAP_* also works as fallback for support only)
SPACEMAIL_SUPPORT_IMAP_USER=support@tryedusentrix.app
SPACEMAIL_SUPPORT_IMAP_PASSWORD=

# Billing
SPACEMAIL_BILLING_IMAP_USER=billing@tryedusentrix.app
SPACEMAIL_BILLING_IMAP_PASSWORD=
```

Optional explicit addresses (defaults match Brevo from addresses):

```env
PLATFORM_HELLO_EMAIL=hello@tryedusentrix.app
PLATFORM_SUPPORT_EMAIL=support@tryedusentrix.app
PLATFORM_BILLING_EMAIL=billing@tryedusentrix.app
EMAIL_REPLY_DOMAIN=reply.tryedusentrix.app
```

Inbound sync toggle:

```env
EMAIL_SYNC_ENABLED=true
```

Cron auth (Vercel sends `Authorization: Bearer <CRON_SECRET>`):

```env
CRON_SECRET=your-long-random-secret
IMAP_RECOVERY_CRON_SECRET=   # optional override
```

---

## 3. Routed replies → support@

School/parent replies use addresses like:

`school+s_<schoolId>+t_<token>@reply.tryedusentrix.app`

Those messages must **deliver into** `support@tryedusentrix.app` so IMAP sync can read them.

### DNS

1. Add subdomain `reply.tryedusentrix.app` if not present.
2. Set **MX** for `reply.tryedusentrix.app` to Spacemail’s MX targets (same as your main domain mail hosting).

### Spacemail

Configure one of:

- **Catch-all** on `reply.tryedusentrix.app` → deliver to `support@tryedusentrix.app`, or  
- **Forwarding rule** for `*@reply.tryedusentrix.app` → `support@tryedusentrix.app`

Verify by sending a test message to a fake alias address and confirming it appears in the support mailbox.

---

## 4. Brevo (outbound only)

Keep Brevo for sending. Verify sender identities:

- `hello@tryedusentrix.app`
- `support@tryedusentrix.app`
- `billing@tryedusentrix.app`

**Inbound parse / webhooks on Brevo are optional** — the app uses IMAP as the primary inbound path.

---

## 5. Verify in the app

1. Deploy with env vars set.
2. Open **Platform → Email** (`/platform/email`).
3. Click **Sync inbox** on each tab (Hello / Support / Billing).
4. Send a test proposal or compose email; reply from an external mailbox; sync again and confirm the thread appears.

Cron: `GET /api/cron/imap-recovery` every 10 minutes (see `vercel.json`) syncs all configured mailboxes when `CRON_SECRET` is set on Vercel.

---

## Checklist

- [ ] Three Spacemail mailboxes created with IMAP enabled
- [ ] `SPACEMAIL_*_IMAP_*` env vars set in Vercel / `.env.local`
- [ ] MX for `reply.tryedusentrix.app` → Spacemail
- [ ] Catch-all or forward `*@reply.tryedusentrix.app` → `support@tryedusentrix.app`
- [ ] Brevo sender addresses verified
- [ ] `CRON_SECRET` set on Vercel
- [ ] Test sync from `/platform/email`
