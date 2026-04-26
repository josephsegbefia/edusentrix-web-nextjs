# Admissions Runbook

> Operations playbook for the EduSentrix Admissions module.
> Audience: platform engineers (PE), school admins, support engineers (SE).
> Last updated: Phase 5 (Apr 2026).

This runbook covers the day-to-day operation of the Admissions feature
once it has shipped. For architecture and feature-level docs, see
[`ADMISSIONS_DEVELOPMENT_SPEC.md`](./ADMISSIONS_DEVELOPMENT_SPEC.md).

---

## 1. System overview

| Layer | Where to look |
| --- | --- |
| Data models | `src/models/AdmissionCycle.ts`, `AdmissionForm.ts`, `AdmissionApplication.ts`, `AdmissionEvent.ts`, `AdmissionInviteLink.ts` |
| Services | `src/lib/admissions/*` (analytics, fee-payments, weekly-digest, decision-service, provisioning-service) |
| Admin API | `src/app/api/admin/admissions/**` |
| Public API | `src/app/api/public/admissions/**` |
| Webhooks | `src/app/api/webhooks/paystack/route.ts` |
| Cron | `src/app/api/cron/admissions-weekly-digest/route.ts` |
| Admin UI | `src/components/admissions/cycle/**` |
| Public UI | `src/components/admissions/public/**` |

The admissions surface is multi-tenant and respects the platform RBAC: only
users with `school_admin` or `teacher + admissions_officer` subrole reach
admin pages (see `requireAdmissionsManager`).

---

## 2. Environment variables

Add the following to `.env.local` for production parity. All values are
documented in `.env.example` under the **Payments — Paystack** and
**Admissions** sections.

```dotenv
PAYSTACK_SECRET_KEY=sk_live_...
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_live_...
ADMISSIONS_DIGEST_CRON_SECRET=<random-32-char-string>
```

Without `PAYSTACK_SECRET_KEY` the online application fee flow will fail
and surface a generic error in the public tracker. Without
`ADMISSIONS_DIGEST_CRON_SECRET` the weekly digest cron returns `401`.

---

## 3. Cron schedule

| Job | Endpoint | Recommended cadence |
| --- | --- | --- |
| Weekly admissions digest | `POST /api/cron/admissions-weekly-digest` | Mondays 07:00 Africa/Accra |

Authentication: send either `Authorization: Bearer $ADMISSIONS_DIGEST_CRON_SECRET`
or `x-cron-secret: $ADMISSIONS_DIGEST_CRON_SECRET`. Optional query params:

- `?dryRun=1` — render and log but do not send.
- `?schoolId=<oid>` — only run for one school (debug / replay).

Vercel example (`vercel.json`):

```json
{
  "crons": [
    {
      "path": "/api/cron/admissions-weekly-digest",
      "schedule": "0 7 * * 1"
    }
  ]
}
```

Manual replay:

```bash
curl -X POST \
  -H "x-cron-secret: $ADMISSIONS_DIGEST_CRON_SECRET" \
  "https://app.edusentrix.com/api/cron/admissions-weekly-digest?dryRun=1"
```

---

## 4. Common operational scenarios

### 4.1 Parent says they lost their tracker link

1. Direct them to **`/apply/lookup`** (the self-service portal) and ask
   them to enter the email they applied with. They will receive an email
   with a magic-link per application.
2. If the email lookup yields nothing, an admin can resend manually:
   - Find the application in the cycle inbox.
   - Open the detail drawer → **Resend tracker link** (calls
     `POST /api/admin/admissions/applications/[applicationId]/resend-tracker-link`).
3. If the parent still can't access it, copy the tracker URL from the
   admin drawer and share over WhatsApp / SMS via the school's normal
   support channel.

### 4.2 Online application fee got stuck in `pending`

The Paystack flow is reconciled by **both** the redirect-back verify call
and the webhook. To force a manual reconciliation:

1. Find the application's `feePayment.reference` (visible in admin drawer
   audit trail or via `db.admissionapplications.findOne(...)`).
2. Hit the verify endpoint as the applicant:
   ```bash
   curl -X POST "https://app.edusentrix.com/api/public/admissions/applications/<token>/pay/verify"
   ```
3. If Paystack reports `success`, `markFeePaidByReference` updates the
   application atomically and emits `application.fee_paid`.
4. If Paystack reports `failed/abandoned`, `markFeeFailedByReference`
   resets the fee state so the parent can retry.

To override (e.g. cash payment received), an admin can set
`feeStatus: "waived"` directly via the admin API (PATCH application).

### 4.3 Reverting a wrong decision (accept ↔ reject)

Decisions are recorded as `AdmissionEvent`s with `kind:"application.decided"`.
The `DecisionService` is intentionally idempotent on the same outcome but
allows a switch (e.g. `rejected → accepted`). Steps:

1. Open the application drawer → Decision tab → choose the new outcome.
2. The audit tab will show both events; downstream provisioning is only
   triggered for `accepted` decisions, and `ProvisioningService` is
   idempotent on `(applicationId, schoolId)` so re-running is safe.
3. If a student account was already provisioned and you need to undo,
   open the user record and follow the standard offboarding flow — the
   admissions module will not auto-revoke a provisioned student.

### 4.4 Cycle is closed but parents keep applying

`AdmissionCycle.status` and the public form's `acceptingApplications`
flag are honoured by the public API. If parents still submit:

- Confirm `cycle.status` is not `published` and `applicationDeadline`
  has elapsed.
- Check the public route response (`GET /api/public/admissions/[schoolId]/[cycleSlug]`)
  in the browser — if `acceptingApplications: false`, the form should
  render the closed notice. If parents see otherwise, suspect a CDN
  cache; bust by changing the slug or revalidating the path.

### 4.5 Bulk import legacy applications

Currently we don't ship a CSV importer. To backfill, write a one-off
script under `scripts/admissions/` that:

1. Connects to mongo via `connectToDatabase`.
2. Creates `AdmissionApplication` documents with
   `status: "submitted", channel: "imported"`.
3. Skips email sends by **not** calling the public submit endpoint.
4. Generates `tracker.token` via `crypto.randomBytes(24).toString("hex")`.

Always run with `--dry-run` first and write the output to a temp file.

---

## 5. Monitoring & dashboards

| Signal | Where | What to watch |
| --- | --- | --- |
| Funnel snapshot | `GET /api/admin/admissions/cycles/[id]/analytics` | drop-off between submitted → reviewed |
| Capacity heatmap | Analytics tab → Capacity section | grades over 100% projected |
| Email delivery | EmailMessage collection / Brevo dashboard | `ADMISSIONS_*` template failures |
| Paystack | Paystack dashboard → Transactions | `admissions_fee` metadata type |
| Cron runs | Vercel cron logs / our cron audit | non-200 responses, recipient count |

Add an alert when a cycle has > 20 applications stuck in `under_review`
for more than 5 days — the analytics snapshot exposes
`pendingActions.staleDecisions` for this purpose.

---

## 6. Incident playbook

### Public form returns 500
1. Hit `/api/public/admissions/<schoolId>/<cycleSlug>` directly and
   inspect the response.
2. Most likely cause is a missing `intakeGrades` link or a corrupted
   `formSchema`. Restore the last good `AdmissionForm` snapshot from the
   audit trail.

### Webhook signature failures spike
1. Check that the `PAYSTACK_SECRET_KEY` in production matches the dashboard
   key for the active environment.
2. Inspect `paystack-webhook` logs — `verifyPaystackSignature` returns
   `false` if HMAC mismatches.
3. As a hotfix, re-run the verify endpoint for affected applications
   (see §4.2) — they will reconcile via the polling path.

### Weekly digest email storm
1. Set `ADMISSIONS_DIGEST_CRON_SECRET` to a new value to immediately
   block further runs.
2. Inspect `EmailMessage` for `templateKey: "ADMISSIONS_WEEKLY_DIGEST"`
   in the last hour and confirm the count is sensible.
3. Re-enable with the new secret once root cause is understood.

---

## 7. Admin onboarding tour

The admin UI ships with a lightweight onboarding tour stub
(`AdmissionsOnboardingTour`, wired into `CycleWorkspace`). The tour:

- Triggers automatically on a school's **first** visit to the admissions
  workspace (tracked via `localStorage` key
  `edusentrix:admissions:tour:dismissed`).
- Walks through 4 steps: Overview → Form builder → Distribution → Inbox.
- Can be re-launched at any time via the **?** help icon in the
  CycleWorkspace header.

Operators who want to disable the tour for a school can preset the
local-storage key during white-glove onboarding, or simply tell the
school admin to click "Skip tour" the first time it appears.

---

## 8. Where to escalate

| Issue | Owner |
| --- | --- |
| Paystack outage / signature regressions | Payments Pod |
| Email deliverability (Brevo) | Comms Pod |
| Provisioning bugs (student account creation) | Identity Pod |
| RBAC / membership questions | Identity Pod |
| Analytics regressions | Admissions Pod |

For anything not covered here, file an issue tagged `area:admissions`
with a link to the relevant request id (visible in server logs).
