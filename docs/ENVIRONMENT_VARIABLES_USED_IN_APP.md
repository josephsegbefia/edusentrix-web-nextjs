# Environment Variables Used In App

Generated: 2026-05-31T00:35:46.748Z

Source: static scan of source/config/script files for `process.env.*`, `process.env["*"]`, and `const { ... } = process.env`. `.env*` files are not scanned.

Total variables: 126

## AI

| Variable | Scopes | Files | Example locations |
| --- | --- | ---: | --- |
| `AI_DAILY_REQUEST_CAP_PER_SCHOOL` | Server/shared libs | 1 | `src/lib/ai/feature-budget.ts:25` |
| `DEMO_AI_ENABLED` | Server/shared libs, Tests | 2 | `src/lib/demo/runtime.ts:20`<br>`tests/demo.runtime.test.ts:14` |
| `DEMO_AI_MAX_REQUESTS_PER_SESSION` | Server/shared libs, Tests | 2 | `src/lib/demo/runtime.ts:22`<br>`tests/demo.runtime.test.ts:15` |
| `FEATURE_LEO_COPILOT_RUNTIME_ENABLED` | Server/shared libs | 1 | `src/lib/leo/runtime.ts:8` |
| `GEMINI_SCHEME_IMPORT_MODEL` | Server/shared libs | 1 | `src/lib/schemes/scheme-import-pdf-gemini.ts:28` |
| `OPENAI_SCHEME_IMPORT_MODEL` | Server/shared libs | 1 | `src/lib/schemes/scheme-import-pdf-ai.ts:25` |
| `OPENAI_TIMETABLE_COACH_MODEL` | API routes, Server/shared libs | 3 | `src/app/api/admin/classes/[id]/timetable/leo-coach/route.ts:264`<br>`src/app/api/admin/school-daily-schedule/leo-coach/route.ts:55`<br>`src/lib/leo/exam-scheduling-advisory-shared.ts:162` |

## Client-exposed

| Variable | Scopes | Files | Example locations |
| --- | --- | ---: | --- |
| `NEXT_PUBLIC_APP_RUNTIME_MODE` | Server/shared libs, Tests | 2 | `src/lib/demo/runtime.ts:72`<br>`tests/demo.runtime.test.ts:8`<br>`tests/demo.runtime.test.ts:116` |
| `NEXT_PUBLIC_APP_URL` | API routes, App routes, Server/shared libs | 6 | `src/app/(app)/platform/settings/page.tsx:70`<br>`src/app/api/public/admissions/applications/[token]/pay/init/route.ts:27`<br>`src/app/api/public/admissions/embed.js/route.ts:79`<br>`src/lib/jobs/trigger-provisioning-runner.ts:13` |
| `NEXT_PUBLIC_CLERK_GOOGLE_ENABLED` | App routes | 2 | `src/app/sign-in/[[...sign-in]]/page.tsx:40`<br>`src/app/sign-up/[[...sign-up]]/page.tsx:31` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | App routes | 1 | `src/app/(app)/platform/settings/page.tsx:81` |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Server/shared libs | 1 | `src/lib/cloudinary-url.ts:15` |
| `NEXT_PUBLIC_FEATURE_LEO_COPILOT_RUNTIME_ENABLED` | Server/shared libs | 1 | `src/lib/leo/runtime.ts:12`<br>`src/lib/leo/runtime.ts:15` |
| `NEXT_PUBLIC_FEATURE_TEACHER_STUDIO` | Server/shared libs, Tests | 2 | `src/lib/features/teacherStudio.ts:8`<br>`tests/teacherStudioFeature.test.ts:24`<br>`tests/teacherStudioFeature.test.ts:25`<br>`tests/teacherStudioFeature.test.ts:28` |
| `NEXT_PUBLIC_FEATURE_TIMETABLE_ADMIN_PLANNER_ENABLED` | Tests | 1 | `tests/timetable.featureFlags.test.ts:30`<br>`tests/timetable.featureFlags.test.ts:55` |
| `NEXT_PUBLIC_FEATURE_TIMETABLE_DUAL_WRITE_ENABLED` | Tests | 1 | `tests/timetable.featureFlags.test.ts:36`<br>`tests/timetable.featureFlags.test.ts:58` |
| `NEXT_PUBLIC_FEATURE_TIMETABLE_PUBLISH_WORKFLOW_ENABLED` | Tests | 1 | `tests/timetable.featureFlags.test.ts:32`<br>`tests/timetable.featureFlags.test.ts:56` |
| `NEXT_PUBLIC_FEATURE_TIMETABLE_REBOOT_ENABLED` | Tests | 1 | `tests/timetable.featureFlags.test.ts:28`<br>`tests/timetable.featureFlags.test.ts:54`<br>`tests/timetable.featureFlags.test.ts:75` |
| `NEXT_PUBLIC_FEATURE_TIMETABLE_ROLE_READ_VIEWS_ENABLED` | Tests | 1 | `tests/timetable.featureFlags.test.ts:34`<br>`tests/timetable.featureFlags.test.ts:57` |
| `NEXT_PUBLIC_FEATURE_TIMETABLE_SUNSET` | Server/shared libs | 1 | `src/lib/timetable/feature-flags.ts:10`<br>`src/lib/timetable/feature-flags.ts:12` |
| `NEXT_PUBLIC_LIVEKIT_URL` | Server/shared libs | 1 | `src/lib/meetings/livekit.ts:149` |
| `NEXT_PUBLIC_NETWORK_TELEMETRY` | Runtime | 1 | `src/hooks/useNetworkHealth.ts:98` |
| `NEXT_PUBLIC_SUBSCRIPTION_ENFORCEMENT_ENABLED` | App routes | 1 | `src/app/(app)/admin/subscription/page.tsx:268` |
| `NEXT_PUBLIC_SUBSCRIPTION_FRONTEND_GATES_ENABLED` | Runtime | 1 | `src/hooks/useSchoolSubscription.ts:28` |

## Cron / Jobs

| Variable | Scopes | Files | Example locations |
| --- | --- | ---: | --- |
| `INTERNAL_CRON_URL` | Server/shared libs | 1 | `src/lib/jobs/trigger-provisioning-runner.ts:12` |

## Database

| Variable | Scopes | Files | Example locations |
| --- | --- | ---: | --- |
| `DEMO_DATA_MONGO_DB_NAME` | Runtime | 1 | `src/db/connectToDemoDataDatabase.ts:14` |
| `DEMO_DATA_MONGODB_URI` | Runtime | 1 | `src/db/connectToDemoDataDatabase.ts:10` |
| `DEMO_MONGO_DB_NAME` | Runtime | 1 | `src/db/connectToDemoDataDatabase.ts:15` |
| `DEMO_MONGODB_URI` | Runtime | 1 | `src/db/connectToDemoDataDatabase.ts:10` |
| `MONGO_DB_NAME` | Runtime | 1 | `src/db/connectToDatabase.ts:44`<br>`src/db/connectToDatabase.ts:51` |
| `MONGODB_URI` | App routes, Runtime, Scripts | 5 | `scripts/demo/seed-flagship-template.ts:74`<br>`scripts/subscription-lifecycle-advance.ts:37`<br>`src/app/(app)/platform/settings/page.tsx:75`<br>`src/db/connectToDatabase.ts:12` |

## Demo

| Variable | Scopes | Files | Example locations |
| --- | --- | ---: | --- |
| `DEMO_BASE_URL` | Runtime, Server/shared libs, Tests | 3 | `src/lib/demo/runtime.ts:11`<br>`src/lib/demo/runtime.ts:34`<br>`src/middleware.ts:9`<br>`tests/demo.runtime.test.ts:9` |
| `DEMO_DEFAULT_SESSION_MINUTES` | Server/shared libs, Tests | 2 | `src/lib/demo/runtime.ts:15`<br>`tests/demo.runtime.test.ts:11` |
| `DEMO_IDLE_TIMEOUT_MINUTES` | Server/shared libs | 1 | `src/lib/demo/runtime.ts:17` |
| `DEMO_MAX_ACTIVE_SESSIONS` | API routes, Server/shared libs, Tests | 3 | `src/app/api/demo/request-access/route.ts:44`<br>`src/lib/demo/runtime.ts:18`<br>`tests/demo.runtime.test.ts:12` |

## Email

| Variable | Scopes | Files | Example locations |
| --- | --- | ---: | --- |
| `BREVO_BILLING_FROM_EMAIL` | Server/shared libs | 1 | `src/lib/email/providers/brevo-provider.ts:6` |
| `BREVO_DEFAULT_FROM_EMAIL` | Server/shared libs | 1 | `src/lib/email/providers/brevo-provider.ts:6` |
| `BREVO_DEFAULT_FROM_NAME` | Server/shared libs | 1 | `src/lib/email/providers/brevo-provider.ts:6` |
| `BREVO_FROM_EMAIL` | API routes, Server/shared libs | 2 | `src/app/api/admin/fees/reminders/route.ts:124`<br>`src/lib/email/brevo.ts:13` |
| `BREVO_FROM_NAME` | API routes, Server/shared libs | 2 | `src/app/api/admin/fees/reminders/route.ts:124`<br>`src/lib/email/brevo.ts:13` |
| `BREVO_SUPPORT_FROM_EMAIL` | Server/shared libs | 1 | `src/lib/email/providers/brevo-provider.ts:6` |
| `EMAIL` | Scripts | 1 | `scripts/createPlatformAdmin.ts:22` |
| `EMAIL_AUDIT_ENABLED` | Server/shared libs | 1 | `src/lib/email/brevo.ts:13` |
| `EMAIL_REPLY_DOMAIN` | Server/shared libs | 1 | `src/lib/email/routing.ts:4` |
| `EMAIL_SYNC_ENABLED` | Server/shared libs | 1 | `src/lib/jobs/imapMailboxSync.ts:109` |
| `PLATFORM_BOOTSTRAP_NOTIFY_EMAIL` | Server/shared libs | 1 | `src/lib/platform-bootstrap/config.ts:6` |
| `PLATFORM_GROWTH_ADMIN_EMAIL` | Server/shared libs | 1 | `src/lib/proposals/reply-handler.ts:10` |
| `SPACEMAIL_SMTP_HOST` | Server/shared libs | 1 | `src/lib/email/providers/spaceship-provider.ts:4` |
| `SPACEMAIL_SMTP_PORT` | Server/shared libs | 1 | `src/lib/email/providers/spaceship-provider.ts:4` |
| `SPACEMAIL_SMTP_USER` | Server/shared libs | 2 | `src/lib/email/providers/spaceship-provider.ts:4`<br>`src/lib/email/services/send-manual-support-email.ts:73` |
| `SUPPORT_EMAIL` | App routes, Server/shared libs | 2 | `src/app/(app)/platform/settings/page.tsx:69`<br>`src/lib/email/providers/brevo-provider.ts:6` |

## Feature Flags

| Variable | Scopes | Files | Example locations |
| --- | --- | ---: | --- |
| `E2E_TEACHER_LOGIN_BYPASS_ENABLED` | API routes | 1 | `src/app/api/admin/teachers/create/route.ts:60` |
| `FEATURE_CAMBRIDGE_LIGHTHOUSE_EXPORT` | Server/shared libs | 1 | `src/lib/curriculum/cambridge-lighthouse.ts:6` |
| `FEATURE_TIMETABLE_ADMIN_PLANNER_ENABLED` | Tests | 1 | `tests/timetable.featureFlags.test.ts:31` |
| `FEATURE_TIMETABLE_DUAL_WRITE_ENABLED` | Tests | 1 | `tests/timetable.featureFlags.test.ts:37` |
| `FEATURE_TIMETABLE_PUBLISH_WORKFLOW_ENABLED` | Tests | 1 | `tests/timetable.featureFlags.test.ts:33` |
| `FEATURE_TIMETABLE_REBOOT_ENABLED` | Tests | 1 | `tests/timetable.featureFlags.test.ts:29`<br>`tests/timetable.featureFlags.test.ts:76` |
| `FEATURE_TIMETABLE_ROLE_READ_VIEWS_ENABLED` | Tests | 1 | `tests/timetable.featureFlags.test.ts:35` |
| `FEATURE_TIMETABLE_SUNSET` | Server/shared libs, Tests | 2 | `src/lib/timetable/feature-flags.ts:11`<br>`src/lib/timetable/feature-flags.ts:13`<br>`tests/timetable.featureFlags.test.ts:15`<br>`tests/timetable.featureFlags.test.ts:27` |

## Meetings

| Variable | Scopes | Files | Example locations |
| --- | --- | ---: | --- |
| `LIVEKIT_URL` | Server/shared libs | 1 | `src/lib/meetings/livekit.ts:139`<br>`src/lib/meetings/livekit.ts:149` |
| `LIVEKIT_WS_URL` | Server/shared libs | 1 | `src/lib/meetings/livekit.ts:146` |

## Other

| Variable | Scopes | Files | Example locations |
| --- | --- | ---: | --- |
| `APP_RUNTIME_MODE` | Runtime, Server/shared libs, Tests | 3 | `src/db/connectToDatabase.ts:52`<br>`src/lib/demo/runtime.ts:62`<br>`tests/demo.runtime.test.ts:7`<br>`tests/demo.runtime.test.ts:48` |
| `CLD_ENABLE_BG_REMOVE` | Server/shared libs | 1 | `src/lib/cloudinary.ts:26` |
| `EDUSENTRIX_LEARN_LAZY_EXPLORE` | Server/shared libs | 1 | `src/lib/learn/explore/explore-flags.ts:3`<br>`src/lib/learn/explore/explore-flags.ts:4` |
| `EDUSENTRIX_TRANSACTION_FEE_CAP_MINOR` | Server/shared libs | 2 | `src/lib/billing/transaction-fees.ts:37`<br>`src/lib/subscriptions/transaction-fees.ts:51`<br>`src/lib/subscriptions/transaction-fees.ts:52` |
| `EDUSENTRIX_TRANSACTION_FEE_PERCENT` | Server/shared libs | 2 | `src/lib/billing/transaction-fees.ts:35`<br>`src/lib/subscriptions/transaction-fees.ts:47` |
| `LEARN_MOBILE_APP_VERSION` | Server/shared libs | 1 | `src/lib/learn/mobile-settings.ts:82` |
| `PLATFORM_BOOTSTRAP_ALLOW_WHEN_ADMINS_EXIST` | Server/shared libs | 1 | `src/lib/platform-bootstrap/config.ts:17` |
| `RECONCILIATION_DUAL_CONTROL_THRESHOLD_MINOR` | API routes | 2 | `src/app/api/admin/finance/transactions/[id]/reconcile/route.ts:75`<br>`src/app/api/admin/finance/transactions/[id]/route.ts:16` |
| `RECONCILIATION_INGESTION_BATCH_LIMIT` | Server/shared libs | 1 | `src/lib/fees/reconciliation/deterministic.ts:23` |
| `RECONCILIATION_MATCH_WINDOW_DAYS` | Server/shared libs | 1 | `src/lib/fees/reconciliation/deterministic.ts:18` |
| `RECONCILIATION_SLA_HOURS` | Server/shared libs | 1 | `src/lib/fees/reconciliation/deterministic.ts:13` |
| `SCHOOL_NAME` | Scripts | 2 | `scripts/reset-school-payment-provisioning.ts:28`<br>`scripts/reset-timetable-day-spring-school.ts:31` |
| `SMS_ALLOW_STUB_IN_PRODUCTION` | Server/shared libs | 1 | `src/lib/notifications/sms.ts:19` |
| `SMS_PROVIDER` | Server/shared libs | 1 | `src/lib/notifications/sms.ts:18` |
| `WHATSAPP_ALLOW_STUB_IN_PRODUCTION` | Server/shared libs | 1 | `src/lib/notifications/whatsapp.ts:20` |
| `WHATSAPP_PROVIDER` | Server/shared libs | 1 | `src/lib/notifications/whatsapp.ts:17` |

## Payments / Billing

| Variable | Scopes | Files | Example locations |
| --- | --- | ---: | --- |
| `SUBSCRIPTION_API_GATES_ENABLED` | Server/shared libs | 1 | `src/lib/subscriptions/guards.ts:28` |
| `SUBSCRIPTION_AUDIT_LOGS_ENABLED` | Server/shared libs | 2 | `src/lib/subscriptions/guards.ts:22`<br>`src/lib/subscriptions/record-event.ts:41` |
| `SUBSCRIPTION_ENFORCEMENT_ENABLED` | Server/shared libs, Tests | 5 | `src/lib/subscriptions/access-mode.ts:47`<br>`src/lib/subscriptions/guards.ts:25`<br>`src/lib/subscriptions/resolve-school-entitlements.ts:46`<br>`tests/subscription.access-mode-extended.test.ts:15` |
| `SUBSCRIPTION_FRONTEND_GATES_ENABLED` | Server/shared libs | 1 | `src/lib/subscriptions/require-page-feature.ts:27` |
| `SUBSCRIPTION_PAYMENT_CHARGES_ENABLED` | Server/shared libs | 2 | `src/lib/subscriptions/resolve-payment-charge-policy.ts:51`<br>`src/lib/subscriptions/transaction-fees.ts:26` |
| `SUBSCRIPTION_USAGE_GATES_ENABLED` | Server/shared libs | 2 | `src/lib/subscriptions/guards.ts:216`<br>`src/lib/subscriptions/usage-tracker.ts:19` |

## Runtime / URLs

| Variable | Scopes | Files | Example locations |
| --- | --- | ---: | --- |
| `APP_URL` | API routes, App routes, Scripts, Server/shared libs | 7 | `scripts/createPlatformAdmin.ts:23`<br>`src/app/(app)/platform/settings/page.tsx:70`<br>`src/app/api/platform/applications/[id]/approve/route.ts:142`<br>`src/app/api/public/admissions/embed.js/route.ts:79` |
| `NODE_ENV` | API routes, Runtime, Server/shared libs, Tests | 21 | `src/app/api/admin/teachers/create/route.ts:59`<br>`src/app/api/banks/search/route.ts:57`<br>`src/app/api/banks/search/route.ts:65`<br>`src/app/api/parent/payments/checkout/route.ts:102` |
| `PORT` | Server/shared libs | 1 | `src/lib/utils/getAppUrl.ts:28` |
| `SCHEME_IMPORT_PRIMARY_PROVIDER` | Server/shared libs | 1 | `src/lib/schemes/scheme-import-pdf-resolve.ts:33` |
| `VERCEL_ENV` | Server/shared libs | 1 | `src/lib/utils/getAppUrl.ts:21` |
| `VERCEL_PROJECT_PRODUCTION_URL` | Server/shared libs | 1 | `src/lib/utils/getBaseUrl.ts:20`<br>`src/lib/utils/getBaseUrl.ts:21` |
| `VERCEL_URL` | Server/shared libs | 2 | `src/lib/jobs/trigger-provisioning-runner.ts:14`<br>`src/lib/jobs/trigger-provisioning-runner.ts:15`<br>`src/lib/utils/getBaseUrl.ts:25`<br>`src/lib/utils/getBaseUrl.ts:26` |

## Secrets / Auth

| Variable | Scopes | Files | Example locations |
| --- | --- | ---: | --- |
| `ADMISSIONS_DIGEST_CRON_SECRET` | API routes | 1 | `src/app/api/cron/admissions-weekly-digest/route.ts:17` |
| `AI_DAILY_TOKEN_CAP_PER_SCHOOL` | Server/shared libs | 1 | `src/lib/ai/feature-budget.ts:21` |
| `AI_USD_PER_1M_TOKENS` | Server/shared libs | 1 | `src/lib/ai/feature-budget.ts:29` |
| `BREVO_API_KEY` | API routes, App routes, Server/shared libs | 4 | `src/app/(app)/platform/settings/page.tsx:92`<br>`src/app/api/admin/fees/reminders/route.ts:124`<br>`src/lib/email/brevo.ts:13`<br>`src/lib/email/providers/brevo-provider.ts:6` |
| `BREVO_INBOUND_PARSE_WEBHOOK_SECRET` | API routes | 1 | `src/app/api/webhooks/brevo-inbound/route.ts:5` |
| `BREVO_WEBHOOK_SECRET` | API routes, App routes | 2 | `src/app/(app)/platform/webhooks/page.tsx:45`<br>`src/app/api/webhooks/brevo/route.ts:9` |
| `CLERK_SECRET_KEY` | API routes, App routes, Scripts | 3 | `scripts/createPlatformAdmin.ts:23`<br>`src/app/(app)/platform/settings/page.tsx:81`<br>`src/app/api/me/route.ts:73` |
| `CLERK_WEBHOOK_SECRET` | API routes, App routes | 2 | `src/app/(app)/platform/webhooks/page.tsx:33`<br>`src/app/api/webhooks/clerk/route.ts:66` |
| `CLOUDINARY_API_KEY` | API routes, Server/shared libs | 3 | `src/app/api/uploads/sign/route.ts:104`<br>`src/lib/cloudinary.ts:9`<br>`src/lib/cloudinary.ts:17`<br>`src/lib/uploads/delete.ts:51` |
| `CLOUDINARY_API_SECRET` | API routes, Server/shared libs | 3 | `src/app/api/uploads/sign/route.ts:34`<br>`src/lib/cloudinary.ts:6`<br>`src/lib/uploads/delete.ts:52` |
| `CLOUDINARY_API_SECRET_KEY` | API routes, Server/shared libs | 3 | `src/app/api/uploads/sign/route.ts:34`<br>`src/lib/cloudinary.ts:6`<br>`src/lib/uploads/delete.ts:52` |
| `COMMUNICATIONS_JOB_SECRET` | API routes | 1 | `src/app/api/jobs/communications/process-outbox/route.ts:15` |
| `CRON_SECRET` | API routes, Server/shared libs | 7 | `src/app/api/cron/demo-maintenance/route.ts:6`<br>`src/app/api/cron/email-dispatch/route.ts:7`<br>`src/app/api/cron/imap-recovery/route.ts:10`<br>`src/app/api/cron/subscription-plan-changes/route.ts:9` |
| `DELEGATIONS_EXPIRY_CRON_SECRET` | Server/shared libs | 1 | `src/lib/delegations/expireDelegations.ts:61` |
| `DEMO_SESSION_SECRET` | Server/shared libs, Tests | 2 | `src/lib/demo/runtime.ts:12`<br>`tests/demo.runtime.test.ts:10` |
| `E2E_TEACHER_DEFAULT_PASSWORD` | API routes | 1 | `src/app/api/admin/teachers/create/route.ts:66` |
| `EMAIL_DISPATCH_CRON_SECRET` | API routes | 2 | `src/app/api/cron/email-dispatch/route.ts:7`<br>`src/app/api/cron/imap-recovery/route.ts:9` |
| `GEMINI_API_KEY` | App routes, Server/shared libs | 2 | `src/app/(app)/platform/settings/page.tsx:108`<br>`src/lib/schemes/scheme-import-pdf-gemini.ts:23` |
| `GOOGLE_AI_API_KEY` | App routes, Server/shared libs | 2 | `src/app/(app)/platform/settings/page.tsx:108`<br>`src/lib/schemes/scheme-import-pdf-gemini.ts:23` |
| `IMAP_RECOVERY_CRON_SECRET` | API routes | 1 | `src/app/api/cron/imap-recovery/route.ts:8` |
| `INTERNAL_CRON_SECRET` | API routes, Server/shared libs | 4 | `src/app/api/academic-calendars/reminders/run/route.ts:30`<br>`src/app/api/academic-calendars/reminders/run/route.ts:30`<br>`src/app/api/admin/teachers/leave/run/route.ts:26`<br>`src/app/api/admin/teachers/leave/run/route.ts:26` |
| `LIBRARY_CRON_SECRET` | Server/shared libs | 1 | `src/lib/library/library-reservation-scheduler.ts:11` |
| `LIVEKIT_API_KEY` | Server/shared libs | 1 | `src/lib/meetings/livekit.ts:140` |
| `LIVEKIT_API_SECRET` | Server/shared libs | 1 | `src/lib/meetings/livekit.ts:141` |
| `OPENAI_API_KEY` | API routes, App routes, Server/shared libs | 32 | `src/app/(app)/platform/settings/page.tsx:102`<br>`src/app/api/admin/class-groups/leo-draft/route.ts:278`<br>`src/app/api/admin/class-groups/leo-draft/route.ts:297`<br>`src/app/api/admin/classes/[id]/timetable/leo-coach/route.ts:185` |
| `OPENAI_COST_PER_1M_TOKENS_MINOR` | Server/shared libs | 1 | `src/lib/platform-billing/provider-sync.ts:66` |
| `PAYSTACK_SECRET_KEY` | API routes, App routes, Server/shared libs | 5 | `src/app/(app)/platform/settings/page.tsx:87`<br>`src/app/(app)/platform/webhooks/page.tsx:39`<br>`src/app/api/parent/payments/checkout-status/route.ts:87`<br>`src/app/api/webhooks/paystack/route.ts:132` |
| `PLATFORM_ADMIN_BOOTSTRAP_SECRET` | Server/shared libs | 1 | `src/lib/platform-bootstrap/config.ts:13` |
| `PLATFORM_BOOTSTRAP_KEY_PEPPER` | Server/shared libs | 1 | `src/lib/platform-bootstrap/key.ts:7` |
| `RECONCILIATION_CRON_SECRET` | API routes | 1 | `src/app/api/cron/reconciliation/route.ts:12` |
| `SPACEMAIL_SMTP_PASSWORD` | Server/shared libs | 1 | `src/lib/email/providers/spaceship-provider.ts:4` |
| `SUBSCRIPTION_CRON_SECRET` | API routes | 2 | `src/app/api/cron/subscription-plan-changes/route.ts:9`<br>`src/app/api/cron/subscription-renewal-notices/route.ts:9` |
| `UPLOADTHING_TOKEN` | API routes, App routes | 2 | `src/app/(app)/platform/settings/page.tsx:97`<br>`src/app/api/uploadthing/route.ts:10` |

## Uploads / Storage

| Variable | Scopes | Files | Example locations |
| --- | --- | ---: | --- |
| `CLOUDINARY_CLOUD_NAME` | API routes, Server/shared libs | 4 | `src/app/api/uploads/sign/route.ts:103`<br>`src/lib/cloudinary-url.ts:16`<br>`src/lib/cloudinary.ts:8`<br>`src/lib/cloudinary.ts:16` |
| `DEMO_UPLOADS_ENABLED` | Server/shared libs, Tests | 2 | `src/lib/demo/runtime.ts:19`<br>`tests/demo.runtime.test.ts:13` |
| `UPLOADTHING_COST_PER_GB_MINOR` | Server/shared libs | 1 | `src/lib/platform-billing/provider-sync.ts:70` |

## Detailed Locations

### AI_DAILY_REQUEST_CAP_PER_SCHOOL

Category: AI

Scopes: Server/shared libs

- `src/lib/ai/feature-budget.ts:25` - process.env.AI_DAILY_REQUEST_CAP_PER_SCHOOL,


### DEMO_AI_ENABLED

Category: AI

Scopes: Server/shared libs, Tests

- `src/lib/demo/runtime.ts:20` - aiEnabled: process.env.DEMO_AI_ENABLED !== "false",
- `tests/demo.runtime.test.ts:14` - delete process.env.DEMO_AI_ENABLED;


### DEMO_AI_MAX_REQUESTS_PER_SESSION

Category: AI

Scopes: Server/shared libs, Tests

- `src/lib/demo/runtime.ts:22` - process.env.DEMO_AI_MAX_REQUESTS_PER_SESSION || 20
- `tests/demo.runtime.test.ts:15` - delete process.env.DEMO_AI_MAX_REQUESTS_PER_SESSION;


### FEATURE_LEO_COPILOT_RUNTIME_ENABLED

Category: AI

Scopes: Server/shared libs

- `src/lib/leo/runtime.ts:8` - return process.env.FEATURE_LEO_COPILOT_RUNTIME_ENABLED === "true";


### GEMINI_SCHEME_IMPORT_MODEL

Category: AI

Scopes: Server/shared libs

- `src/lib/schemes/scheme-import-pdf-gemini.ts:28` - return process.env.GEMINI_SCHEME_IMPORT_MODEL?.trim() || DEFAULT_GEMINI_MODEL;


### OPENAI_SCHEME_IMPORT_MODEL

Category: AI

Scopes: Server/shared libs

- `src/lib/schemes/scheme-import-pdf-ai.ts:25` - const configured = process.env.OPENAI_SCHEME_IMPORT_MODEL?.trim();


### OPENAI_TIMETABLE_COACH_MODEL

Category: AI

Scopes: API routes, Server/shared libs

- `src/app/api/admin/classes/[id]/timetable/leo-coach/route.ts:264` - model: process.env.OPENAI_TIMETABLE_COACH_MODEL || "gpt-4o-mini",
- `src/app/api/admin/school-daily-schedule/leo-coach/route.ts:55` - const model = process.env.OPENAI_TIMETABLE_COACH_MODEL || "gpt-4o-mini";
- `src/lib/leo/exam-scheduling-advisory-shared.ts:162` - model: process.env.OPENAI_TIMETABLE_COACH_MODEL ?? "gpt-4o-mini",


### NEXT_PUBLIC_APP_RUNTIME_MODE

Category: Client-exposed

Scopes: Server/shared libs, Tests

- `src/lib/demo/runtime.ts:72` - process.env.NEXT_PUBLIC_APP_RUNTIME_MODE === "demo"
- `tests/demo.runtime.test.ts:8` - delete process.env.NEXT_PUBLIC_APP_RUNTIME_MODE;
- `tests/demo.runtime.test.ts:116` - process.env.NEXT_PUBLIC_APP_RUNTIME_MODE = "demo";


### NEXT_PUBLIC_APP_URL

Category: Client-exposed

Scopes: API routes, App routes, Server/shared libs

- `src/app/(app)/platform/settings/page.tsx:70` - const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "Not configured";
- `src/app/api/public/admissions/applications/[token]/pay/init/route.ts:27` - const envOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim();
- `src/app/api/public/admissions/embed.js/route.ts:79` - const env = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";
- `src/lib/jobs/trigger-provisioning-runner.ts:13` - process.env.NEXT_PUBLIC_APP_URL?.trim() ||
- `src/lib/utils/getAppUrl.ts:15` - if (process.env.NEXT_PUBLIC_APP_URL) {
- `src/lib/utils/getAppUrl.ts:16` - return process.env.NEXT_PUBLIC_APP_URL;
- `src/lib/utils/getBaseUrl.ts:15` - if (process.env.NEXT_PUBLIC_APP_URL) {
- `src/lib/utils/getBaseUrl.ts:16` - return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");


### NEXT_PUBLIC_CLERK_GOOGLE_ENABLED

Category: Client-exposed

Scopes: App routes

- `src/app/sign-in/[[...sign-in]]/page.tsx:40` - const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_CLERK_GOOGLE_ENABLED === "true";
- `src/app/sign-up/[[...sign-up]]/page.tsx:31` - const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_CLERK_GOOGLE_ENABLED === "true";


### NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

Category: Client-exposed

Scopes: App routes

- `src/app/(app)/platform/settings/page.tsx:81` - process.env.CLERK_SECRET_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY


### NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME

Category: Client-exposed

Scopes: Server/shared libs

- `src/lib/cloudinary-url.ts:15` - process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||


### NEXT_PUBLIC_FEATURE_LEO_COPILOT_RUNTIME_ENABLED

Category: Client-exposed

Scopes: Server/shared libs

- `src/lib/leo/runtime.ts:12` - if (typeof process.env.NEXT_PUBLIC_FEATURE_LEO_COPILOT_RUNTIME_ENABLED === "undefined") {
- `src/lib/leo/runtime.ts:15` - return process.env.NEXT_PUBLIC_FEATURE_LEO_COPILOT_RUNTIME_ENABLED === "true";


### NEXT_PUBLIC_FEATURE_TEACHER_STUDIO

Category: Client-exposed

Scopes: Server/shared libs, Tests

- `src/lib/features/teacherStudio.ts:8` - const value = process.env.NEXT_PUBLIC_FEATURE_TEACHER_STUDIO;
- `tests/teacherStudioFeature.test.ts:24` - const previous = process.env.NEXT_PUBLIC_FEATURE_TEACHER_STUDIO;
- `tests/teacherStudioFeature.test.ts:25` - delete process.env.NEXT_PUBLIC_FEATURE_TEACHER_STUDIO;
- `tests/teacherStudioFeature.test.ts:28` - process.env.NEXT_PUBLIC_FEATURE_TEACHER_STUDIO = previous;
- `tests/teacherStudioFeature.test.ts:33` - const previous = process.env.NEXT_PUBLIC_FEATURE_TEACHER_STUDIO;
- `tests/teacherStudioFeature.test.ts:34` - process.env.NEXT_PUBLIC_FEATURE_TEACHER_STUDIO = "false";
- `tests/teacherStudioFeature.test.ts:41` - delete process.env.NEXT_PUBLIC_FEATURE_TEACHER_STUDIO;
- `tests/teacherStudioFeature.test.ts:43` - process.env.NEXT_PUBLIC_FEATURE_TEACHER_STUDIO = previous;
- `tests/teacherStudioFeature.test.ts:49` - const previous = process.env.NEXT_PUBLIC_FEATURE_TEACHER_STUDIO;
- `tests/teacherStudioFeature.test.ts:50` - process.env.NEXT_PUBLIC_FEATURE_TEACHER_STUDIO = "true";
- `tests/teacherStudioFeature.test.ts:72` - delete process.env.NEXT_PUBLIC_FEATURE_TEACHER_STUDIO;
- `tests/teacherStudioFeature.test.ts:74` - process.env.NEXT_PUBLIC_FEATURE_TEACHER_STUDIO = previous;


### NEXT_PUBLIC_FEATURE_TIMETABLE_ADMIN_PLANNER_ENABLED

Category: Client-exposed

Scopes: Tests

- `tests/timetable.featureFlags.test.ts:30` - delete process.env.NEXT_PUBLIC_FEATURE_TIMETABLE_ADMIN_PLANNER_ENABLED;
- `tests/timetable.featureFlags.test.ts:55` - process.env.NEXT_PUBLIC_FEATURE_TIMETABLE_ADMIN_PLANNER_ENABLED = "false";


### NEXT_PUBLIC_FEATURE_TIMETABLE_DUAL_WRITE_ENABLED

Category: Client-exposed

Scopes: Tests

- `tests/timetable.featureFlags.test.ts:36` - delete process.env.NEXT_PUBLIC_FEATURE_TIMETABLE_DUAL_WRITE_ENABLED;
- `tests/timetable.featureFlags.test.ts:58` - process.env.NEXT_PUBLIC_FEATURE_TIMETABLE_DUAL_WRITE_ENABLED = "true";


### NEXT_PUBLIC_FEATURE_TIMETABLE_PUBLISH_WORKFLOW_ENABLED

Category: Client-exposed

Scopes: Tests

- `tests/timetable.featureFlags.test.ts:32` - delete process.env.NEXT_PUBLIC_FEATURE_TIMETABLE_PUBLISH_WORKFLOW_ENABLED;
- `tests/timetable.featureFlags.test.ts:56` - process.env.NEXT_PUBLIC_FEATURE_TIMETABLE_PUBLISH_WORKFLOW_ENABLED = "false";


### NEXT_PUBLIC_FEATURE_TIMETABLE_REBOOT_ENABLED

Category: Client-exposed

Scopes: Tests

- `tests/timetable.featureFlags.test.ts:28` - delete process.env.NEXT_PUBLIC_FEATURE_TIMETABLE_REBOOT_ENABLED;
- `tests/timetable.featureFlags.test.ts:54` - process.env.NEXT_PUBLIC_FEATURE_TIMETABLE_REBOOT_ENABLED = "false";
- `tests/timetable.featureFlags.test.ts:75` - process.env.NEXT_PUBLIC_FEATURE_TIMETABLE_REBOOT_ENABLED = "true";


### NEXT_PUBLIC_FEATURE_TIMETABLE_ROLE_READ_VIEWS_ENABLED

Category: Client-exposed

Scopes: Tests

- `tests/timetable.featureFlags.test.ts:34` - delete process.env.NEXT_PUBLIC_FEATURE_TIMETABLE_ROLE_READ_VIEWS_ENABLED;
- `tests/timetable.featureFlags.test.ts:57` - process.env.NEXT_PUBLIC_FEATURE_TIMETABLE_ROLE_READ_VIEWS_ENABLED = "false";


### NEXT_PUBLIC_FEATURE_TIMETABLE_SUNSET

Category: Client-exposed

Scopes: Server/shared libs

- `src/lib/timetable/feature-flags.ts:10` - if (process.env.NEXT_PUBLIC_FEATURE_TIMETABLE_SUNSET === "false") return false;
- `src/lib/timetable/feature-flags.ts:12` - if (process.env.NEXT_PUBLIC_FEATURE_TIMETABLE_SUNSET === "true") return true;


### NEXT_PUBLIC_LIVEKIT_URL

Category: Client-exposed

Scopes: Server/shared libs

- `src/lib/meetings/livekit.ts:149` - const base = process.env.NEXT_PUBLIC_LIVEKIT_URL?.trim() || process.env.LIVEKIT_URL?.trim();


### NEXT_PUBLIC_NETWORK_TELEMETRY

Category: Client-exposed

Scopes: Runtime

- `src/hooks/useNetworkHealth.ts:98` - if (process.env.NEXT_PUBLIC_NETWORK_TELEMETRY === "true") return true;


### NEXT_PUBLIC_SUBSCRIPTION_ENFORCEMENT_ENABLED

Category: Client-exposed

Scopes: App routes

- `src/app/(app)/admin/subscription/page.tsx:268` - const isEnforcementOn = process.env.NEXT_PUBLIC_SUBSCRIPTION_ENFORCEMENT_ENABLED === "true";


### NEXT_PUBLIC_SUBSCRIPTION_FRONTEND_GATES_ENABLED

Category: Client-exposed

Scopes: Runtime

- `src/hooks/useSchoolSubscription.ts:28` - process.env.NEXT_PUBLIC_SUBSCRIPTION_FRONTEND_GATES_ENABLED === "true";


### INTERNAL_CRON_URL

Category: Cron / Jobs

Scopes: Server/shared libs

- `src/lib/jobs/trigger-provisioning-runner.ts:12` - process.env.INTERNAL_CRON_URL?.trim() ||


### DEMO_DATA_MONGO_DB_NAME

Category: Database

Scopes: Runtime

- `src/db/connectToDemoDataDatabase.ts:14` - process.env.DEMO_DATA_MONGO_DB_NAME ||


### DEMO_DATA_MONGODB_URI

Category: Database

Scopes: Runtime

- `src/db/connectToDemoDataDatabase.ts:10` - process.env.DEMO_DATA_MONGODB_URI || process.env.DEMO_MONGODB_URI || "";


### DEMO_MONGO_DB_NAME

Category: Database

Scopes: Runtime

- `src/db/connectToDemoDataDatabase.ts:15` - process.env.DEMO_MONGO_DB_NAME ||


### DEMO_MONGODB_URI

Category: Database

Scopes: Runtime

- `src/db/connectToDemoDataDatabase.ts:10` - process.env.DEMO_DATA_MONGODB_URI || process.env.DEMO_MONGODB_URI || "";


### MONGO_DB_NAME

Category: Database

Scopes: Runtime

- `src/db/connectToDatabase.ts:44` - dbName: process.env.MONGO_DB_NAME || undefined,
- `src/db/connectToDatabase.ts:51` - m.connection.name || process.env.MONGO_DB_NAME || "unknown-db";


### MONGODB_URI

Category: Database

Scopes: App routes, Runtime, Scripts

- `scripts/demo/seed-flagship-template.ts:74` - const uri = process.env.MONGODB_URI;
- `scripts/subscription-lifecycle-advance.ts:37` - const mongoUri = process.env.MONGODB_URI;
- `src/app/(app)/platform/settings/page.tsx:75` - configured: Boolean(process.env.MONGODB_URI),
- `src/db/connectToDatabase.ts:12` - const MONGODB_URI = uri ?? process.env.MONGODB_URI;
- `src/scripts/migrate-lesson-notes-v2.ts:19` - const uri = process.env.MONGODB_URI;


### DEMO_BASE_URL

Category: Demo

Scopes: Runtime, Server/shared libs, Tests

- `src/lib/demo/runtime.ts:11` - baseUrl: process.env.DEMO_BASE_URL ?? "",
- `src/lib/demo/runtime.ts:34` - const raw = process.env.DEMO_BASE_URL ?? "";
- `src/middleware.ts:9` - const baseUrl = process.env.DEMO_BASE_URL ?? "";
- `tests/demo.runtime.test.ts:9` - delete process.env.DEMO_BASE_URL;
- `tests/demo.runtime.test.ts:70` - process.env.DEMO_BASE_URL = "https://demo.tryedusentrix.app";
- `tests/demo.runtime.test.ts:76` - process.env.DEMO_BASE_URL = "demo.tryedusentrix.app";
- `tests/demo.runtime.test.ts:82` - process.env.DEMO_BASE_URL = "https://demo.tryedusentrix.app";
- `tests/demo.runtime.test.ts:88` - process.env.DEMO_BASE_URL = "https://demo.tryedusentrix.app";
- `tests/demo.runtime.test.ts:94` - process.env.DEMO_BASE_URL = "https://demo.tryedusentrix.app";
- `tests/demo.runtime.test.ts:100` - process.env.DEMO_BASE_URL = "https://Demo.TryEduSentrix.App";


### DEMO_DEFAULT_SESSION_MINUTES

Category: Demo

Scopes: Server/shared libs, Tests

- `src/lib/demo/runtime.ts:15` - process.env.DEMO_DEFAULT_SESSION_MINUTES || 90
- `tests/demo.runtime.test.ts:11` - delete process.env.DEMO_DEFAULT_SESSION_MINUTES;


### DEMO_IDLE_TIMEOUT_MINUTES

Category: Demo

Scopes: Server/shared libs

- `src/lib/demo/runtime.ts:17` - idleTimeoutMinutes: Number(process.env.DEMO_IDLE_TIMEOUT_MINUTES || 5),


### DEMO_MAX_ACTIVE_SESSIONS

Category: Demo

Scopes: API routes, Server/shared libs, Tests

- `src/app/api/demo/request-access/route.ts:44` - const maxSessions = Number(process.env.DEMO_MAX_ACTIVE_SESSIONS || 50);
- `src/lib/demo/runtime.ts:18` - maxActiveSessions: Number(process.env.DEMO_MAX_ACTIVE_SESSIONS || 50),
- `tests/demo.runtime.test.ts:12` - delete process.env.DEMO_MAX_ACTIVE_SESSIONS;


### BREVO_BILLING_FROM_EMAIL

Category: Email

Scopes: Server/shared libs

- `src/lib/email/providers/brevo-provider.ts:6` - const { BREVO_API_KEY, BREVO_DEFAULT_FROM_EMAIL, BREVO_DEFAULT_FROM_NAME, BREVO_BILLING_FROM_EMAIL, BREVO_SUPPORT_FROM_EMAIL, SUPPORT_EMAIL, } = process.env


### BREVO_DEFAULT_FROM_EMAIL

Category: Email

Scopes: Server/shared libs

- `src/lib/email/providers/brevo-provider.ts:6` - const { BREVO_API_KEY, BREVO_DEFAULT_FROM_EMAIL, BREVO_DEFAULT_FROM_NAME, BREVO_BILLING_FROM_EMAIL, BREVO_SUPPORT_FROM_EMAIL, SUPPORT_EMAIL, } = process.env


### BREVO_DEFAULT_FROM_NAME

Category: Email

Scopes: Server/shared libs

- `src/lib/email/providers/brevo-provider.ts:6` - const { BREVO_API_KEY, BREVO_DEFAULT_FROM_EMAIL, BREVO_DEFAULT_FROM_NAME, BREVO_BILLING_FROM_EMAIL, BREVO_SUPPORT_FROM_EMAIL, SUPPORT_EMAIL, } = process.env


### BREVO_FROM_EMAIL

Category: Email

Scopes: API routes, Server/shared libs

- `src/app/api/admin/fees/reminders/route.ts:124` - process.env.BREVO_API_KEY && process.env.BREVO_FROM_EMAIL && process.env.BREVO_FROM_NAME
- `src/lib/email/brevo.ts:13` - const { BREVO_API_KEY, BREVO_FROM_EMAIL, BREVO_FROM_NAME, EMAIL_AUDIT_ENABLED } = process.env


### BREVO_FROM_NAME

Category: Email

Scopes: API routes, Server/shared libs

- `src/app/api/admin/fees/reminders/route.ts:124` - process.env.BREVO_API_KEY && process.env.BREVO_FROM_EMAIL && process.env.BREVO_FROM_NAME
- `src/lib/email/brevo.ts:13` - const { BREVO_API_KEY, BREVO_FROM_EMAIL, BREVO_FROM_NAME, EMAIL_AUDIT_ENABLED } = process.env


### BREVO_SUPPORT_FROM_EMAIL

Category: Email

Scopes: Server/shared libs

- `src/lib/email/providers/brevo-provider.ts:6` - const { BREVO_API_KEY, BREVO_DEFAULT_FROM_EMAIL, BREVO_DEFAULT_FROM_NAME, BREVO_BILLING_FROM_EMAIL, BREVO_SUPPORT_FROM_EMAIL, SUPPORT_EMAIL, } = process.env


### EMAIL

Category: Email

Scopes: Scripts

- `scripts/createPlatformAdmin.ts:22` - const email = (process.env.EMAIL || "").toLowerCase().trim();


### EMAIL_AUDIT_ENABLED

Category: Email

Scopes: Server/shared libs

- `src/lib/email/brevo.ts:13` - const { BREVO_API_KEY, BREVO_FROM_EMAIL, BREVO_FROM_NAME, EMAIL_AUDIT_ENABLED } = process.env


### EMAIL_REPLY_DOMAIN

Category: Email

Scopes: Server/shared libs

- `src/lib/email/routing.ts:4` - const { EMAIL_REPLY_DOMAIN } = process.env


### EMAIL_SYNC_ENABLED

Category: Email

Scopes: Server/shared libs

- `src/lib/jobs/imapMailboxSync.ts:109` - if (process.env.EMAIL_SYNC_ENABLED === "false") {


### PLATFORM_BOOTSTRAP_NOTIFY_EMAIL

Category: Email

Scopes: Server/shared libs

- `src/lib/platform-bootstrap/config.ts:6` - process.env.PLATFORM_BOOTSTRAP_NOTIFY_EMAIL?.trim().toLowerCase() ||


### PLATFORM_GROWTH_ADMIN_EMAIL

Category: Email

Scopes: Server/shared libs

- `src/lib/proposals/reply-handler.ts:10` - const PLATFORM_GROWTH_ADMIN_EMAIL = process.env.PLATFORM_GROWTH_ADMIN_EMAIL ?? "";


### SPACEMAIL_SMTP_HOST

Category: Email

Scopes: Server/shared libs

- `src/lib/email/providers/spaceship-provider.ts:4` - const { SPACEMAIL_SMTP_HOST, SPACEMAIL_SMTP_PORT, SPACEMAIL_SMTP_USER, SPACEMAIL_SMTP_PASSWORD, } = process.env


### SPACEMAIL_SMTP_PORT

Category: Email

Scopes: Server/shared libs

- `src/lib/email/providers/spaceship-provider.ts:4` - const { SPACEMAIL_SMTP_HOST, SPACEMAIL_SMTP_PORT, SPACEMAIL_SMTP_USER, SPACEMAIL_SMTP_PASSWORD, } = process.env


### SPACEMAIL_SMTP_USER

Category: Email

Scopes: Server/shared libs

- `src/lib/email/providers/spaceship-provider.ts:4` - const { SPACEMAIL_SMTP_HOST, SPACEMAIL_SMTP_PORT, SPACEMAIL_SMTP_USER, SPACEMAIL_SMTP_PASSWORD, } = process.env
- `src/lib/email/services/send-manual-support-email.ts:73` - from: input.fromEmail || process.env.SPACEMAIL_SMTP_USER || "",


### SUPPORT_EMAIL

Category: Email

Scopes: App routes, Server/shared libs

- `src/app/(app)/platform/settings/page.tsx:69` - const supportEmail = process.env.SUPPORT_EMAIL || "support@edusentrix.com";
- `src/lib/email/providers/brevo-provider.ts:6` - const { BREVO_API_KEY, BREVO_DEFAULT_FROM_EMAIL, BREVO_DEFAULT_FROM_NAME, BREVO_BILLING_FROM_EMAIL, BREVO_SUPPORT_FROM_EMAIL, SUPPORT_EMAIL, } = process.env


### E2E_TEACHER_LOGIN_BYPASS_ENABLED

Category: Feature Flags

Scopes: API routes

- `src/app/api/admin/teachers/create/route.ts:60` - process.env.E2E_TEACHER_LOGIN_BYPASS_ENABLED === "true"


### FEATURE_CAMBRIDGE_LIGHTHOUSE_EXPORT

Category: Feature Flags

Scopes: Server/shared libs

- `src/lib/curriculum/cambridge-lighthouse.ts:6` - return process.env.FEATURE_CAMBRIDGE_LIGHTHOUSE_EXPORT === "true";


### FEATURE_TIMETABLE_ADMIN_PLANNER_ENABLED

Category: Feature Flags

Scopes: Tests

- `tests/timetable.featureFlags.test.ts:31` - delete process.env.FEATURE_TIMETABLE_ADMIN_PLANNER_ENABLED;


### FEATURE_TIMETABLE_DUAL_WRITE_ENABLED

Category: Feature Flags

Scopes: Tests

- `tests/timetable.featureFlags.test.ts:37` - delete process.env.FEATURE_TIMETABLE_DUAL_WRITE_ENABLED;


### FEATURE_TIMETABLE_PUBLISH_WORKFLOW_ENABLED

Category: Feature Flags

Scopes: Tests

- `tests/timetable.featureFlags.test.ts:33` - delete process.env.FEATURE_TIMETABLE_PUBLISH_WORKFLOW_ENABLED;


### FEATURE_TIMETABLE_REBOOT_ENABLED

Category: Feature Flags

Scopes: Tests

- `tests/timetable.featureFlags.test.ts:29` - delete process.env.FEATURE_TIMETABLE_REBOOT_ENABLED;
- `tests/timetable.featureFlags.test.ts:76` - process.env.FEATURE_TIMETABLE_REBOOT_ENABLED = "false";


### FEATURE_TIMETABLE_ROLE_READ_VIEWS_ENABLED

Category: Feature Flags

Scopes: Tests

- `tests/timetable.featureFlags.test.ts:35` - delete process.env.FEATURE_TIMETABLE_ROLE_READ_VIEWS_ENABLED;


### FEATURE_TIMETABLE_SUNSET

Category: Feature Flags

Scopes: Server/shared libs, Tests

- `src/lib/timetable/feature-flags.ts:11` - if (process.env.FEATURE_TIMETABLE_SUNSET === "false") return false;
- `src/lib/timetable/feature-flags.ts:13` - if (process.env.FEATURE_TIMETABLE_SUNSET === "true") return true;
- `tests/timetable.featureFlags.test.ts:15` - delete process.env.FEATURE_TIMETABLE_SUNSET;
- `tests/timetable.featureFlags.test.ts:27` - process.env.FEATURE_TIMETABLE_SUNSET = "false";
- `tests/timetable.featureFlags.test.ts:53` - process.env.FEATURE_TIMETABLE_SUNSET = "false";
- `tests/timetable.featureFlags.test.ts:74` - process.env.FEATURE_TIMETABLE_SUNSET = "false";


### LIVEKIT_URL

Category: Meetings

Scopes: Server/shared libs

- `src/lib/meetings/livekit.ts:139` - process.env.LIVEKIT_URL?.trim() &&
- `src/lib/meetings/livekit.ts:149` - const base = process.env.NEXT_PUBLIC_LIVEKIT_URL?.trim() || process.env.LIVEKIT_URL?.trim();


### LIVEKIT_WS_URL

Category: Meetings

Scopes: Server/shared libs

- `src/lib/meetings/livekit.ts:146` - const explicit = process.env.LIVEKIT_WS_URL?.trim();


### APP_RUNTIME_MODE

Category: Other

Scopes: Runtime, Server/shared libs, Tests

- `src/db/connectToDatabase.ts:52` - const runtimeMode = process.env.APP_RUNTIME_MODE || "standard";
- `src/lib/demo/runtime.ts:62` - return process.env.APP_RUNTIME_MODE === "demo";
- `tests/demo.runtime.test.ts:7` - delete process.env.APP_RUNTIME_MODE;
- `tests/demo.runtime.test.ts:48` - process.env.APP_RUNTIME_MODE = "demo";
- `tests/demo.runtime.test.ts:54` - process.env.APP_RUNTIME_MODE = "production";


### CLD_ENABLE_BG_REMOVE

Category: Other

Scopes: Server/shared libs

- `src/lib/cloudinary.ts:26` - String(process.env.CLD_ENABLE_BG_REMOVE || "true") === "true";


### EDUSENTRIX_LEARN_LAZY_EXPLORE

Category: Other

Scopes: Server/shared libs

- `src/lib/learn/explore/explore-flags.ts:3` - process.env.EDUSENTRIX_LEARN_LAZY_EXPLORE !== "0" &&
- `src/lib/learn/explore/explore-flags.ts:4` - process.env.EDUSENTRIX_LEARN_LAZY_EXPLORE !== "false";


### EDUSENTRIX_TRANSACTION_FEE_CAP_MINOR

Category: Other

Scopes: Server/shared libs

- `src/lib/billing/transaction-fees.ts:37` - const rawCapMinor = parseNumber(process.env.EDUSENTRIX_TRANSACTION_FEE_CAP_MINOR);
- `src/lib/subscriptions/transaction-fees.ts:51` - process.env.EDUSENTRIX_TRANSACTION_FEE_CAP_MINOR
- `src/lib/subscriptions/transaction-fees.ts:52` - ? parseInt(process.env.EDUSENTRIX_TRANSACTION_FEE_CAP_MINOR, 10)


### EDUSENTRIX_TRANSACTION_FEE_PERCENT

Category: Other

Scopes: Server/shared libs

- `src/lib/billing/transaction-fees.ts:35` - parseNumber(process.env.EDUSENTRIX_TRANSACTION_FEE_PERCENT) ?? 0
- `src/lib/subscriptions/transaction-fees.ts:47` - process.env.EDUSENTRIX_TRANSACTION_FEE_PERCENT ?? "2.5"


### LEARN_MOBILE_APP_VERSION

Category: Other

Scopes: Server/shared libs

- `src/lib/learn/mobile-settings.ts:82` - appVersion: process.env.LEARN_MOBILE_APP_VERSION?.trim() || "1.0.0",


### PLATFORM_BOOTSTRAP_ALLOW_WHEN_ADMINS_EXIST

Category: Other

Scopes: Server/shared libs

- `src/lib/platform-bootstrap/config.ts:17` - return process.env.PLATFORM_BOOTSTRAP_ALLOW_WHEN_ADMINS_EXIST === "true";


### RECONCILIATION_DUAL_CONTROL_THRESHOLD_MINOR

Category: Other

Scopes: API routes

- `src/app/api/admin/finance/transactions/[id]/reconcile/route.ts:75` - process.env.RECONCILIATION_DUAL_CONTROL_THRESHOLD_MINOR || "",
- `src/app/api/admin/finance/transactions/[id]/route.ts:16` - process.env.RECONCILIATION_DUAL_CONTROL_THRESHOLD_MINOR || "",


### RECONCILIATION_INGESTION_BATCH_LIMIT

Category: Other

Scopes: Server/shared libs

- `src/lib/fees/reconciliation/deterministic.ts:23` - const parsed = Number(process.env.RECONCILIATION_INGESTION_BATCH_LIMIT);


### RECONCILIATION_MATCH_WINDOW_DAYS

Category: Other

Scopes: Server/shared libs

- `src/lib/fees/reconciliation/deterministic.ts:18` - const parsed = Number(process.env.RECONCILIATION_MATCH_WINDOW_DAYS);


### RECONCILIATION_SLA_HOURS

Category: Other

Scopes: Server/shared libs

- `src/lib/fees/reconciliation/deterministic.ts:13` - const parsed = Number(process.env.RECONCILIATION_SLA_HOURS);


### SCHOOL_NAME

Category: Other

Scopes: Scripts

- `scripts/reset-school-payment-provisioning.ts:28` - process.env.SCHOOL_NAME?.trim() ||
- `scripts/reset-timetable-day-spring-school.ts:31` - const nameArg = process.argv[2]?.trim() || process.env.SCHOOL_NAME?.trim() || DEFAULT_SCHOOL_NAME;


### SMS_ALLOW_STUB_IN_PRODUCTION

Category: Other

Scopes: Server/shared libs

- `src/lib/notifications/sms.ts:19` - const allowStubInProduction = process.env.SMS_ALLOW_STUB_IN_PRODUCTION === "true";


### SMS_PROVIDER

Category: Other

Scopes: Server/shared libs

- `src/lib/notifications/sms.ts:18` - const configuredProvider = (process.env.SMS_PROVIDER || "stub").trim().toLowerCase();


### WHATSAPP_ALLOW_STUB_IN_PRODUCTION

Category: Other

Scopes: Server/shared libs

- `src/lib/notifications/whatsapp.ts:20` - const allowStubInProduction = process.env.WHATSAPP_ALLOW_STUB_IN_PRODUCTION === "true";


### WHATSAPP_PROVIDER

Category: Other

Scopes: Server/shared libs

- `src/lib/notifications/whatsapp.ts:17` - const configuredProvider = (process.env.WHATSAPP_PROVIDER || "stub")


### SUBSCRIPTION_API_GATES_ENABLED

Category: Payments / Billing

Scopes: Server/shared libs

- `src/lib/subscriptions/guards.ts:28` - process.env.SUBSCRIPTION_API_GATES_ENABLED === "true";


### SUBSCRIPTION_AUDIT_LOGS_ENABLED

Category: Payments / Billing

Scopes: Server/shared libs

- `src/lib/subscriptions/guards.ts:22` - process.env.SUBSCRIPTION_AUDIT_LOGS_ENABLED === "true";
- `src/lib/subscriptions/record-event.ts:41` - const auditEnabled = process.env.SUBSCRIPTION_AUDIT_LOGS_ENABLED === "true";


### SUBSCRIPTION_ENFORCEMENT_ENABLED

Category: Payments / Billing

Scopes: Server/shared libs, Tests

- `src/lib/subscriptions/access-mode.ts:47` - if (process.env.SUBSCRIPTION_ENFORCEMENT_ENABLED !== "true") {
- `src/lib/subscriptions/guards.ts:25` - process.env.SUBSCRIPTION_ENFORCEMENT_ENABLED === "true";
- `src/lib/subscriptions/resolve-school-entitlements.ts:46` - process.env.SUBSCRIPTION_ENFORCEMENT_ENABLED === "true";
- `tests/subscription.access-mode-extended.test.ts:15` - process.env.SUBSCRIPTION_ENFORCEMENT_ENABLED = "true";
- `tests/subscription.access-mode-extended.test.ts:19` - delete process.env.SUBSCRIPTION_ENFORCEMENT_ENABLED;
- `tests/subscription.access-mode.test.ts:28` - originalEnforcement = process.env.SUBSCRIPTION_ENFORCEMENT_ENABLED;
- `tests/subscription.access-mode.test.ts:34` - delete process.env.SUBSCRIPTION_ENFORCEMENT_ENABLED;


### SUBSCRIPTION_FRONTEND_GATES_ENABLED

Category: Payments / Billing

Scopes: Server/shared libs

- `src/lib/subscriptions/require-page-feature.ts:27` - process.env.SUBSCRIPTION_FRONTEND_GATES_ENABLED === "true";


### SUBSCRIPTION_PAYMENT_CHARGES_ENABLED

Category: Payments / Billing

Scopes: Server/shared libs

- `src/lib/subscriptions/resolve-payment-charge-policy.ts:51` - const enforcementEnabled = process.env.SUBSCRIPTION_PAYMENT_CHARGES_ENABLED === "true";
- `src/lib/subscriptions/transaction-fees.ts:26` - process.env.SUBSCRIPTION_PAYMENT_CHARGES_ENABLED === "true";


### SUBSCRIPTION_USAGE_GATES_ENABLED

Category: Payments / Billing

Scopes: Server/shared libs

- `src/lib/subscriptions/guards.ts:216` - process.env.SUBSCRIPTION_USAGE_GATES_ENABLED === "true";
- `src/lib/subscriptions/usage-tracker.ts:19` - process.env.SUBSCRIPTION_USAGE_GATES_ENABLED === "true";


### APP_URL

Category: Runtime / URLs

Scopes: API routes, App routes, Scripts, Server/shared libs

- `scripts/createPlatformAdmin.ts:23` - const { CLERK_SECRET_KEY, APP_URL } = process.env
- `src/app/(app)/platform/settings/page.tsx:70` - const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "Not configured";
- `src/app/api/platform/applications/[id]/approve/route.ts:142` - // const APP_URL = process.env.APP_URL!;
- `src/app/api/public/admissions/embed.js/route.ts:79` - const env = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";
- `src/lib/email/templates.ts:5` - const { APP_URL = "" } = process.env
- `src/lib/utils/getAppUrl.ts:12` - if (process.env.APP_URL) {
- `src/lib/utils/getAppUrl.ts:13` - return process.env.APP_URL;
- `src/lib/utils/getBaseUrl.ts:30` - if (process.env.APP_URL) {
- `src/lib/utils/getBaseUrl.ts:31` - return process.env.APP_URL.replace(/\/$/, "");


### NODE_ENV

Category: Runtime / URLs

Scopes: API routes, Runtime, Server/shared libs, Tests

- `src/app/api/admin/teachers/create/route.ts:59` - process.env.NODE_ENV !== "production" &&
- `src/app/api/banks/search/route.ts:57` - const errorMessage = process.env.NODE_ENV === "development"
- `src/app/api/banks/search/route.ts:65` - ...(process.env.NODE_ENV === "development" && { details: e?.stack })
- `src/app/api/parent/payments/checkout/route.ts:102` - process.env.NODE_ENV === "production"
- `src/app/api/platform/billing/payout-settings/challenge/route.ts:113` - debugCode: process.env.NODE_ENV === "production" ? undefined : code,
- `src/app/api/platform/bootstrap/create/route.ts:161` - secure: process.env.NODE_ENV === "production",
- `src/app/api/platform/bootstrap/otp/send/route.ts:97` - ...(process.env.NODE_ENV !== "production" ? { _debugCode: code } : {}),
- `src/app/api/platform/bootstrap/otp/verify/route.ts:95` - secure: process.env.NODE_ENV === "production",
- `src/db/connectToDatabase.ts:53` - const nodeEnv = process.env.NODE_ENV || "development";
- `src/lib/demo/session.ts:40` - secure: process.env.NODE_ENV === "production",
- `src/lib/library/library-fee-hook.ts:12` - if (process.env.NODE_ENV === "development") {
- `src/lib/library/library-notifications.ts:123` - if (process.env.NODE_ENV === "development") {
- Additional files using this variable: 9

### PORT

Category: Runtime / URLs

Scopes: Server/shared libs

- `src/lib/utils/getAppUrl.ts:28` - const port = process.env.PORT || "3000";


### SCHEME_IMPORT_PRIMARY_PROVIDER

Category: Runtime / URLs

Scopes: Server/shared libs

- `src/lib/schemes/scheme-import-pdf-resolve.ts:33` - return process.env.SCHEME_IMPORT_PRIMARY_PROVIDER?.trim().toLowerCase() === "gemini";


### VERCEL_ENV

Category: Runtime / URLs

Scopes: Server/shared libs

- `src/lib/utils/getAppUrl.ts:21` - process.env.VERCEL_ENV === "production" ||


### VERCEL_PROJECT_PRODUCTION_URL

Category: Runtime / URLs

Scopes: Server/shared libs

- `src/lib/utils/getBaseUrl.ts:20` - if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
- `src/lib/utils/getBaseUrl.ts:21` - return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;


### VERCEL_URL

Category: Runtime / URLs

Scopes: Server/shared libs

- `src/lib/jobs/trigger-provisioning-runner.ts:14` - (process.env.VERCEL_URL
- `src/lib/jobs/trigger-provisioning-runner.ts:15` - ? `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, "")}`
- `src/lib/utils/getBaseUrl.ts:25` - if (process.env.VERCEL_URL) {
- `src/lib/utils/getBaseUrl.ts:26` - return `https://${process.env.VERCEL_URL}`;


### ADMISSIONS_DIGEST_CRON_SECRET

Category: Secrets / Auth

Scopes: API routes

- `src/app/api/cron/admissions-weekly-digest/route.ts:17` - const secret = process.env.ADMISSIONS_DIGEST_CRON_SECRET;


### AI_DAILY_TOKEN_CAP_PER_SCHOOL

Category: Secrets / Auth

Scopes: Server/shared libs

- `src/lib/ai/feature-budget.ts:21` - process.env.AI_DAILY_TOKEN_CAP_PER_SCHOOL,


### AI_USD_PER_1M_TOKENS

Category: Secrets / Auth

Scopes: Server/shared libs

- `src/lib/ai/feature-budget.ts:29` - usdPerMillionTokens: Number(process.env.AI_USD_PER_1M_TOKENS || "0.30"),


### BREVO_API_KEY

Category: Secrets / Auth

Scopes: API routes, App routes, Server/shared libs

- `src/app/(app)/platform/settings/page.tsx:92` - configured: Boolean(process.env.BREVO_API_KEY),
- `src/app/api/admin/fees/reminders/route.ts:124` - process.env.BREVO_API_KEY && process.env.BREVO_FROM_EMAIL && process.env.BREVO_FROM_NAME
- `src/lib/email/brevo.ts:13` - const { BREVO_API_KEY, BREVO_FROM_EMAIL, BREVO_FROM_NAME, EMAIL_AUDIT_ENABLED } = process.env
- `src/lib/email/providers/brevo-provider.ts:6` - const { BREVO_API_KEY, BREVO_DEFAULT_FROM_EMAIL, BREVO_DEFAULT_FROM_NAME, BREVO_BILLING_FROM_EMAIL, BREVO_SUPPORT_FROM_EMAIL, SUPPORT_EMAIL, } = process.env


### BREVO_INBOUND_PARSE_WEBHOOK_SECRET

Category: Secrets / Auth

Scopes: API routes

- `src/app/api/webhooks/brevo-inbound/route.ts:5` - const { BREVO_INBOUND_PARSE_WEBHOOK_SECRET } = process.env


### BREVO_WEBHOOK_SECRET

Category: Secrets / Auth

Scopes: API routes, App routes

- `src/app/(app)/platform/webhooks/page.tsx:45` - configured: Boolean(process.env.BREVO_WEBHOOK_SECRET),
- `src/app/api/webhooks/brevo/route.ts:9` - const { BREVO_WEBHOOK_SECRET } = process.env


### CLERK_SECRET_KEY

Category: Secrets / Auth

Scopes: API routes, App routes, Scripts

- `scripts/createPlatformAdmin.ts:23` - const { CLERK_SECRET_KEY, APP_URL } = process.env
- `src/app/(app)/platform/settings/page.tsx:81` - process.env.CLERK_SECRET_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
- `src/app/api/me/route.ts:73` - secretKey: process.env.CLERK_SECRET_KEY!,


### CLERK_WEBHOOK_SECRET

Category: Secrets / Auth

Scopes: API routes, App routes

- `src/app/(app)/platform/webhooks/page.tsx:33` - configured: Boolean(process.env.CLERK_WEBHOOK_SECRET),
- `src/app/api/webhooks/clerk/route.ts:66` - const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;


### CLOUDINARY_API_KEY

Category: Secrets / Auth

Scopes: API routes, Server/shared libs

- `src/app/api/uploads/sign/route.ts:104` - const apiKey = process.env.CLOUDINARY_API_KEY!;
- `src/lib/cloudinary.ts:9` - !process.env.CLOUDINARY_API_KEY ||
- `src/lib/cloudinary.ts:17` - api_key: process.env.CLOUDINARY_API_KEY,
- `src/lib/uploads/delete.ts:51` - api_key: process.env.CLOUDINARY_API_KEY,


### CLOUDINARY_API_SECRET

Category: Secrets / Auth

Scopes: API routes, Server/shared libs

- `src/app/api/uploads/sign/route.ts:34` - process.env.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_API_SECRET_KEY;
- `src/lib/cloudinary.ts:6` - process.env.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_API_SECRET_KEY;
- `src/lib/uploads/delete.ts:52` - api_secret: process.env.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_API_SECRET_KEY,


### CLOUDINARY_API_SECRET_KEY

Category: Secrets / Auth

Scopes: API routes, Server/shared libs

- `src/app/api/uploads/sign/route.ts:34` - process.env.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_API_SECRET_KEY;
- `src/lib/cloudinary.ts:6` - process.env.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_API_SECRET_KEY;
- `src/lib/uploads/delete.ts:52` - api_secret: process.env.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_API_SECRET_KEY,


### COMMUNICATIONS_JOB_SECRET

Category: Secrets / Auth

Scopes: API routes

- `src/app/api/jobs/communications/process-outbox/route.ts:15` - const expected = process.env.COMMUNICATIONS_JOB_SECRET;


### CRON_SECRET

Category: Secrets / Auth

Scopes: API routes, Server/shared libs

- `src/app/api/cron/demo-maintenance/route.ts:6` - const cronSecret = process.env.CRON_SECRET;
- `src/app/api/cron/email-dispatch/route.ts:7` - const secret = process.env.EMAIL_DISPATCH_CRON_SECRET || process.env.CRON_SECRET;
- `src/app/api/cron/imap-recovery/route.ts:10` - process.env.CRON_SECRET;
- `src/app/api/cron/subscription-plan-changes/route.ts:9` - const secret = process.env.SUBSCRIPTION_CRON_SECRET || process.env.CRON_SECRET;
- `src/app/api/cron/subscription-renewal-notices/route.ts:9` - const secret = process.env.SUBSCRIPTION_CRON_SECRET || process.env.CRON_SECRET;
- `src/lib/delegations/expireDelegations.ts:61` - process.env.DELEGATIONS_EXPIRY_CRON_SECRET || process.env.CRON_SECRET || "";
- `src/lib/library/library-reservation-scheduler.ts:11` - const secret = process.env.LIBRARY_CRON_SECRET || process.env.CRON_SECRET || "";


### DELEGATIONS_EXPIRY_CRON_SECRET

Category: Secrets / Auth

Scopes: Server/shared libs

- `src/lib/delegations/expireDelegations.ts:61` - process.env.DELEGATIONS_EXPIRY_CRON_SECRET || process.env.CRON_SECRET || "";


### DEMO_SESSION_SECRET

Category: Secrets / Auth

Scopes: Server/shared libs, Tests

- `src/lib/demo/runtime.ts:12` - sessionSecret: process.env.DEMO_SESSION_SECRET ?? "",
- `tests/demo.runtime.test.ts:10` - delete process.env.DEMO_SESSION_SECRET;


### E2E_TEACHER_DEFAULT_PASSWORD

Category: Secrets / Auth

Scopes: API routes

- `src/app/api/admin/teachers/create/route.ts:66` - process.env.E2E_TEACHER_DEFAULT_PASSWORD?.trim() || "TeacherTest123!"


### EMAIL_DISPATCH_CRON_SECRET

Category: Secrets / Auth

Scopes: API routes

- `src/app/api/cron/email-dispatch/route.ts:7` - const secret = process.env.EMAIL_DISPATCH_CRON_SECRET || process.env.CRON_SECRET;
- `src/app/api/cron/imap-recovery/route.ts:9` - process.env.EMAIL_DISPATCH_CRON_SECRET ||


### GEMINI_API_KEY

Category: Secrets / Auth

Scopes: App routes, Server/shared libs

- `src/app/(app)/platform/settings/page.tsx:108` - process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_AI_API_KEY?.trim(),
- `src/lib/schemes/scheme-import-pdf-gemini.ts:23` - process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_AI_API_KEY?.trim() || null;


### GOOGLE_AI_API_KEY

Category: Secrets / Auth

Scopes: App routes, Server/shared libs

- `src/app/(app)/platform/settings/page.tsx:108` - process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_AI_API_KEY?.trim(),
- `src/lib/schemes/scheme-import-pdf-gemini.ts:23` - process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_AI_API_KEY?.trim() || null;


### IMAP_RECOVERY_CRON_SECRET

Category: Secrets / Auth

Scopes: API routes

- `src/app/api/cron/imap-recovery/route.ts:8` - process.env.IMAP_RECOVERY_CRON_SECRET ||


### INTERNAL_CRON_SECRET

Category: Secrets / Auth

Scopes: API routes, Server/shared libs

- `src/app/api/academic-calendars/reminders/run/route.ts:30` - if (!process.env.INTERNAL_CRON_SECRET || secret !== process.env.INTERNAL_CRON_SECRET) {
- `src/app/api/academic-calendars/reminders/run/route.ts:30` - if (!process.env.INTERNAL_CRON_SECRET || secret !== process.env.INTERNAL_CRON_SECRET) {
- `src/app/api/admin/teachers/leave/run/route.ts:26` - if (!process.env.INTERNAL_CRON_SECRET || secret !== process.env.INTERNAL_CRON_SECRET) {
- `src/app/api/admin/teachers/leave/run/route.ts:26` - if (!process.env.INTERNAL_CRON_SECRET || secret !== process.env.INTERNAL_CRON_SECRET) {
- `src/app/api/provisioning/run/route.ts:21` - !process.env.INTERNAL_CRON_SECRET ||
- `src/app/api/provisioning/run/route.ts:22` - secret !== process.env.INTERNAL_CRON_SECRET
- `src/lib/jobs/trigger-provisioning-runner.ts:8` - const secret = process.env.INTERNAL_CRON_SECRET?.trim();


### LIBRARY_CRON_SECRET

Category: Secrets / Auth

Scopes: Server/shared libs

- `src/lib/library/library-reservation-scheduler.ts:11` - const secret = process.env.LIBRARY_CRON_SECRET || process.env.CRON_SECRET || "";


### LIVEKIT_API_KEY

Category: Secrets / Auth

Scopes: Server/shared libs

- `src/lib/meetings/livekit.ts:140` - process.env.LIVEKIT_API_KEY?.trim() &&


### LIVEKIT_API_SECRET

Category: Secrets / Auth

Scopes: Server/shared libs

- `src/lib/meetings/livekit.ts:141` - process.env.LIVEKIT_API_SECRET?.trim()


### OPENAI_API_KEY

Category: Secrets / Auth

Scopes: API routes, App routes, Server/shared libs

- `src/app/(app)/platform/settings/page.tsx:102` - configured: Boolean(process.env.OPENAI_API_KEY),
- `src/app/api/admin/class-groups/leo-draft/route.ts:278` - if (!process.env.OPENAI_API_KEY) {
- `src/app/api/admin/class-groups/leo-draft/route.ts:297` - const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
- `src/app/api/admin/classes/[id]/timetable/leo-coach/route.ts:185` - const apiKey = process.env.OPENAI_API_KEY;
- `src/app/api/admin/fees/ai/account-brief/route.ts:303` - if (!process.env.OPENAI_API_KEY) {
- `src/app/api/admin/fees/ai/account-brief/route.ts:307` - const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
- `src/app/api/admin/fees/reconciliation/sessions/[id]/ai-suggest/route.ts:76` - const apiKey = process.env.OPENAI_API_KEY;
- `src/app/api/admin/fees/reconciliation/sessions/[id]/report/route.ts:123` - const apiKey = process.env.OPENAI_API_KEY;
- `src/app/api/admin/fees/reminders/ai-template/route.ts:267` - if (!process.env.OPENAI_API_KEY) {
- `src/app/api/admin/fees/reminders/ai-template/route.ts:271` - const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
- `src/app/api/admin/periods/[id]/report/route.ts:89` - if (!process.env.OPENAI_API_KEY) {
- `src/app/api/admin/periods/[id]/report/route.ts:172` - const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
- Additional files using this variable: 20

### OPENAI_COST_PER_1M_TOKENS_MINOR

Category: Secrets / Auth

Scopes: Server/shared libs

- `src/lib/platform-billing/provider-sync.ts:66` - Number(process.env.OPENAI_COST_PER_1M_TOKENS_MINOR || "0")


### PAYSTACK_SECRET_KEY

Category: Secrets / Auth

Scopes: API routes, App routes, Server/shared libs

- `src/app/(app)/platform/settings/page.tsx:87` - configured: Boolean(process.env.PAYSTACK_SECRET_KEY),
- `src/app/(app)/platform/webhooks/page.tsx:39` - configured: Boolean(process.env.PAYSTACK_SECRET_KEY),
- `src/app/api/parent/payments/checkout-status/route.ts:87` - const secretKey = process.env.PAYSTACK_SECRET_KEY;
- `src/app/api/webhooks/paystack/route.ts:132` - const secretKey = process.env.PAYSTACK_SECRET_KEY;
- `src/lib/paystack.ts:47` - const k = process.env.PAYSTACK_SECRET_KEY || "";
- `src/lib/paystack.ts:32` - const { PAYSTACK_SECRET_KEY } = process.env


### PLATFORM_ADMIN_BOOTSTRAP_SECRET

Category: Secrets / Auth

Scopes: Server/shared libs

- `src/lib/platform-bootstrap/config.ts:13` - return process.env.PLATFORM_ADMIN_BOOTSTRAP_SECRET?.trim() ?? "";


### PLATFORM_BOOTSTRAP_KEY_PEPPER

Category: Secrets / Auth

Scopes: Server/shared libs

- `src/lib/platform-bootstrap/key.ts:7` - process.env.PLATFORM_BOOTSTRAP_KEY_PEPPER?.trim() ||


### RECONCILIATION_CRON_SECRET

Category: Secrets / Auth

Scopes: API routes

- `src/app/api/cron/reconciliation/route.ts:12` - const secret = process.env.RECONCILIATION_CRON_SECRET;


### SPACEMAIL_SMTP_PASSWORD

Category: Secrets / Auth

Scopes: Server/shared libs

- `src/lib/email/providers/spaceship-provider.ts:4` - const { SPACEMAIL_SMTP_HOST, SPACEMAIL_SMTP_PORT, SPACEMAIL_SMTP_USER, SPACEMAIL_SMTP_PASSWORD, } = process.env


### SUBSCRIPTION_CRON_SECRET

Category: Secrets / Auth

Scopes: API routes

- `src/app/api/cron/subscription-plan-changes/route.ts:9` - const secret = process.env.SUBSCRIPTION_CRON_SECRET || process.env.CRON_SECRET;
- `src/app/api/cron/subscription-renewal-notices/route.ts:9` - const secret = process.env.SUBSCRIPTION_CRON_SECRET || process.env.CRON_SECRET;


### UPLOADTHING_TOKEN

Category: Secrets / Auth

Scopes: API routes, App routes

- `src/app/(app)/platform/settings/page.tsx:97` - configured: Boolean(process.env.UPLOADTHING_TOKEN),
- `src/app/api/uploadthing/route.ts:10` - token: process.env.UPLOADTHING_TOKEN,


### CLOUDINARY_CLOUD_NAME

Category: Uploads / Storage

Scopes: API routes, Server/shared libs

- `src/app/api/uploads/sign/route.ts:103` - const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;
- `src/lib/cloudinary-url.ts:16` - process.env.CLOUDINARY_CLOUD_NAME;
- `src/lib/cloudinary.ts:8` - !process.env.CLOUDINARY_CLOUD_NAME ||
- `src/lib/cloudinary.ts:16` - cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
- `src/lib/uploads/delete.ts:50` - cloud_name: process.env.CLOUDINARY_CLOUD_NAME,


### DEMO_UPLOADS_ENABLED

Category: Uploads / Storage

Scopes: Server/shared libs, Tests

- `src/lib/demo/runtime.ts:19` - uploadsEnabled: process.env.DEMO_UPLOADS_ENABLED === "true",
- `tests/demo.runtime.test.ts:13` - delete process.env.DEMO_UPLOADS_ENABLED;


### UPLOADTHING_COST_PER_GB_MINOR

Category: Uploads / Storage

Scopes: Server/shared libs

- `src/lib/platform-billing/provider-sync.ts:70` - Number(process.env.UPLOADTHING_COST_PER_GB_MINOR || "0")

