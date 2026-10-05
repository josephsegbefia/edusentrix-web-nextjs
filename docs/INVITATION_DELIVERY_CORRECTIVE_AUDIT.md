# Invitation delivery corrective audit

Classification after the Coolify/Vercel-cron corrective pass.

| Flow | Clerk invite | notify:false | role + schoolId metadata | Ticket URL required | Canonical Invitation | Immediate email | Retry on provider fail | Truthful response | Class |
|---|---|---|---|---|---|---|---|---|---|
| Platform school create | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | SOUND |
| Platform school admin invite | Yes | Yes | Yes | Yes | Upsert pending | Yes | Yes | Yes | SOUND |
| Platform application approve | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Warning/status returned | SOUND |
| Admin invitation resend | Yes | Yes | Yes | Yes | Same row | Yes | Yes | Yes | SOUND |
| Teacher create | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Teacher create still succeeds | SOUND |
| Teacher bulk create | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Per-row persist | SOUND |
| Guardian/parent invite | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Guardian create still succeeds | SOUND |
| Admissions parent provision | Yes | Yes | Yes | Yes | Yes | Yes (`PARENT_INVITE`) | Yes | Boolean outcome | SOUND |
| Bursar invite | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | SOUND |
| Billing owner invite | Yes | Yes | Yes | Yes | Yes | Yes | Yes | `emailStatus` + delivery code | SOUND |
| Finance delegate invite | Yes | Yes | bursar + schoolId | Yes | Yes | Yes | Yes | `emailStatus` + delivery code | SOUND |
| Platform staff invite | Yes | Yes | platform_staff (no schoolId) | Yes | No — `PlatformStaffProfile` | Immediate `sendRawEmail` | No | `emailStatus` surfaced | SOUND_WITH_INTENTIONAL_DIFFERENCE |
| Platform bootstrap admin | Yes | Yes | platform_admin (no schoolId) | Yes | No | Immediate `sendRawEmail` | No | Failure is 500 | SOUND_WITH_INTENTIONAL_DIFFERENCE |
| Legacy `POST /api/invites` | No writes | n/a | n/a | n/a | Legacy `Invite` reads only | Retired 410 | n/a | 410 | LEGACY |

## Remaining `async: true` email flows

Classified **B — APPROPRIATE_BACKGROUND_JOB**. Delivery now uses `BackgroundJob` `EMAIL_DISPATCH` + Inngest. They do **not** need `/api/cron/email-dispatch` or a Coolify email cron:

- `src/lib/lessons/lesson-publish-notifications.ts`
- `src/lib/library/library-notifications.ts`
- `src/lib/subscriptions/renewal-notices.ts` (delivery only; scheduling remains cron)
- `src/lib/subscriptions/subscription-receipts.ts`
- `src/app/api/webhooks/paystack/route.ts`
- `src/app/api/platform/applications/route.ts` confirmation uses `enqueueOnFailure` on the same EmailMessage

See `docs/BACKGROUND_WORK_ENGINE_EMAIL_MIGRATION.md`.

**A — MUST_SEND_IMMEDIATELY:** invitation / authentication / onboarding links. Implemented in this pass.

## Notes

- `SCHOOL_ONBOARDING` remains unused for school creation. Creation uses `SCHOOL_CREATED_CONTACT`.
- `generateOnboardingMagicLink` is deleted. School-admin Clerk invites now go through `issueInvitation` with `role` + `schoolId`.
- Legacy `Invite` documents are still read by `findPendingSchoolInvite` for historical account resolution.
