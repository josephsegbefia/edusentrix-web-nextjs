import Link from "next/link";
import {
  ArrowRight,
  Activity,
  Mail,
  ShieldCheck,
  Webhook,
} from "lucide-react";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AuditEvent } from "@/models/AuditEvent";
import { EmailEvent } from "@/models/EmailEvent";
import { EmailMessage } from "@/models/EmailMessage";
import { PaymentAuditEvent } from "@/models/PaymentAuditEvent";
import { School } from "@/models/School";
import { User } from "@/models/User";
import {
  PlatformMetricCard,
  PlatformMetricGrid,
  PlatformPageHeader,
  PlatformPill,
  PlatformSection,
  formatDate,
  formatTimestamp,
} from "@/components/platform/platform-page-primitives";

export const dynamic = "force-dynamic";

function configuredProviders() {
  return [
    {
      key: "clerk",
      label: "Clerk",
      configured: Boolean(process.env.CLERK_WEBHOOK_SECRET),
      note: "Identity lifecycle webhooks",
    },
    {
      key: "paystack",
      label: "Paystack",
      configured: Boolean(process.env.PAYSTACK_SECRET_KEY),
      note: "Payment settlement events",
    },
    {
      key: "brevo",
      label: "Brevo",
      configured: Boolean(process.env.BREVO_WEBHOOK_SECRET),
      note: "Email delivery and suppression events",
    },
  ];
}

export default async function PlatformWebhooksPage() {
  await connectToDatabase();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const providerConfigs = configuredProviders();

  const [
    webhookAuditCount,
    paystackWebhookCount,
    brevoEventCount,
    webhookAudits,
    paystackEvents,
    brevoEvents,
    lastClerkLinkedUser,
    lastPaystackEvent,
    lastBrevoEvent,
  ] = await Promise.all([
    AuditEvent.countDocuments({
      actorType: "webhook",
      occurredAt: { $gte: sevenDaysAgo },
    }),
    PaymentAuditEvent.countDocuments({
      title: /Paystack webhook/i,
      createdAt: { $gte: sevenDaysAgo },
    }),
    EmailEvent.countDocuments({
      provider: "brevo",
      occurredAt: { $gte: sevenDaysAgo },
    }),
    AuditEvent.find({ actorType: "webhook" })
      .sort({ occurredAt: -1 })
      .limit(18)
      .select("scopeType scopeId actionCode result actorName routePath occurredAt")
      .lean<
        Array<{
          _id: unknown;
          scopeType: "platform" | "school";
          scopeId?: unknown | null;
          actionCode: string;
          result: string;
          actorName?: string | null;
          routePath?: string | null;
          occurredAt: Date;
        }>
      >(),
    PaymentAuditEvent.find({ title: /Paystack webhook/i })
      .sort({ createdAt: -1 })
      .limit(12)
      .select("schoolId title description createdAt")
      .lean<
        Array<{
          _id: unknown;
          schoolId: unknown;
          title: string;
          description?: string | null;
          createdAt: Date;
        }>
      >(),
    EmailEvent.find({ provider: "brevo" })
      .sort({ occurredAt: -1 })
      .limit(14)
      .select("emailMessageId schoolId eventType providerMessageId occurredAt")
      .lean<
        Array<{
          _id: unknown;
          emailMessageId?: unknown | null;
          schoolId?: unknown | null;
          eventType: string;
          providerMessageId?: string | null;
          occurredAt: Date;
        }>
      >(),
    User.findOne({ clerkUserId: { $exists: true, $ne: null } })
      .sort({ updatedAt: -1 })
      .select("email name firstName lastName role updatedAt")
      .lean<{
        _id: unknown;
        email: string;
        name?: string | null;
        firstName?: string | null;
        lastName?: string | null;
        role?: string | null;
        updatedAt: Date;
      } | null>(),
    PaymentAuditEvent.findOne({ title: /Paystack webhook/i })
      .sort({ createdAt: -1 })
      .select("title createdAt")
      .lean<{ title: string; createdAt: Date } | null>(),
    EmailEvent.findOne({ provider: "brevo" })
      .sort({ occurredAt: -1 })
      .select("eventType occurredAt")
      .lean<{ eventType: string; occurredAt: Date } | null>(),
  ]);

  const schoolIds = Array.from(
    new Set(
      [
        ...webhookAudits.map((row) => (row.scopeType === "school" && row.scopeId ? String(row.scopeId) : null)),
        ...paystackEvents.map((row) => String(row.schoolId)),
        ...brevoEvents.map((row) => (row.schoolId ? String(row.schoolId) : null)),
      ].filter(Boolean) as string[]
    )
  );

  const emailMessageIds = Array.from(
    new Set(
      brevoEvents
        .map((row) => (row.emailMessageId ? String(row.emailMessageId) : null))
        .filter(Boolean) as string[]
    )
  );

  const [schools, emailMessages] = await Promise.all([
    schoolIds.length
      ? School.find({ _id: { $in: schoolIds } })
          .select("name")
          .lean<Array<{ _id: unknown; name: string }>>()
      : Promise.resolve([]),
    emailMessageIds.length
      ? EmailMessage.find({ _id: { $in: emailMessageIds } })
          .select("subject to status")
          .lean<
            Array<{
              _id: unknown;
              subject: string;
              to: string;
              status: string;
            }>
          >()
      : Promise.resolve([]),
  ]);

  const schoolMap = new Map(schools.map((school) => [String(school._id), school.name]));
  const emailMessageMap = new Map(emailMessages.map((message) => [String(message._id), message]));
  const configuredCount = providerConfigs.filter((provider) => provider.configured).length;

  return (
    <div className="space-y-6 p-2 md:p-4">
      <PlatformPageHeader
        eyebrow="Integration Health"
        title="Webhook telemetry and provider status"
        description="Monitor current webhook coverage, recent provider activity, and the telemetry gaps that still need a normalized event ledger."
        actions={
          <>
            <Link
              href="/platform/email"
              className="inline-flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              <span>Email Console</span>
              <ArrowRight className="ml-3 h-4 w-4" />
            </Link>
            <Link
              href="/platform/audit"
              className="inline-flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              <span>Audit Logs</span>
              <ArrowRight className="ml-3 h-4 w-4" />
            </Link>
          </>
        }
      />

      <PlatformMetricGrid>
        <PlatformMetricCard
          icon={ShieldCheck}
          label="Configured Providers"
          value={`${configuredCount}/${providerConfigs.length}`}
          note="Providers with webhook secrets configured in runtime env."
          tone="cyan"
        />
        <PlatformMetricCard
          icon={Webhook}
          label="Webhook Audits"
          value={webhookAuditCount.toLocaleString()}
          note="Tiered audit events written by webhook actors in the last 7 days."
          tone="violet"
        />
        <PlatformMetricCard
          icon={Activity}
          label="Paystack Events"
          value={paystackWebhookCount.toLocaleString()}
          note="Payment audit entries sourced from Paystack webhook processing this week."
          tone="emerald"
        />
        <PlatformMetricCard
          icon={Mail}
          label="Brevo Events"
          value={brevoEventCount.toLocaleString()}
          note="Brevo delivery lifecycle events captured in the last 7 days."
          tone="amber"
        />
      </PlatformMetricGrid>

      <PlatformSection
        title="Provider Status"
        description="Current configuration posture and the freshest signal available for each provider."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {providerConfigs.map((provider) => {
            const lastSeen =
              provider.key === "clerk"
                ? lastClerkLinkedUser?.updatedAt || null
                : provider.key === "paystack"
                  ? lastPaystackEvent?.createdAt || null
                  : lastBrevoEvent?.occurredAt || null;
            const lastNote =
              provider.key === "clerk"
                ? lastClerkLinkedUser
                  ? `Latest linked user: ${lastClerkLinkedUser.email}`
                  : "No linked-user activity found yet."
                : provider.key === "paystack"
                  ? lastPaystackEvent?.title || "No Paystack webhook-backed audit yet."
                  : lastBrevoEvent
                    ? `Latest Brevo event: ${lastBrevoEvent.eventType}`
                    : "No Brevo email event captured yet.";

            return (
              <div
                key={provider.key}
                className="rounded-2xl border border-white/8 bg-black/20 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-white">{provider.label}</p>
                    <p className="mt-1 text-sm text-white/50">{provider.note}</p>
                  </div>
                  <PlatformPill tone={provider.configured ? "emerald" : "rose"}>
                    {provider.configured ? "Configured" : "Missing secret"}
                  </PlatformPill>
                </div>
                <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2">
                  <p className="text-xs uppercase tracking-[0.14em] text-white/35">Last seen</p>
                  <p className="mt-1 text-sm text-white">{formatTimestamp(lastSeen)}</p>
                  <p className="mt-1 text-xs text-white/45">{lastNote}</p>
                </div>
              </div>
            );
          })}
        </div>
      </PlatformSection>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <PlatformSection
          title="Webhook Audit Trail"
          description="Normalized audit rows currently written by webhook actors."
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-white/45">
                  <th className="pb-3 font-medium">When</th>
                  <th className="pb-3 font-medium">Provider</th>
                  <th className="pb-3 font-medium">Action</th>
                  <th className="pb-3 font-medium">Scope</th>
                  <th className="pb-3 font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {webhookAudits.map((row) => (
                  <tr key={String(row._id)} className="border-b border-white/5">
                    <td className="py-3 pr-4 text-white/55">{formatTimestamp(row.occurredAt)}</td>
                    <td className="py-3 pr-4 text-white">
                      {row.actorName || row.routePath || "webhook"}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-white/70">{row.actionCode}</td>
                    <td className="py-3 pr-4 text-white/60">
                      {row.scopeType === "school" && row.scopeId
                        ? schoolMap.get(String(row.scopeId)) || "Unknown school"
                        : "Platform"}
                    </td>
                    <td className="py-3">
                      <PlatformPill tone={row.result === "succeeded" ? "emerald" : "rose"}>
                        {row.result}
                      </PlatformPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PlatformSection>

        <PlatformSection
          title="Brevo Delivery Stream"
          description="Latest delivery lifecycle events mapped back to platform email records where possible."
        >
          <div className="space-y-3">
            {brevoEvents.map((event) => {
              const message = event.emailMessageId
                ? emailMessageMap.get(String(event.emailMessageId))
                : null;

              return (
                <div
                  key={String(event._id)}
                  className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium text-white">
                        {message?.subject || event.providerMessageId || "Unlinked provider event"}
                      </p>
                      <p className="text-xs text-white/45">
                        {message?.to || schoolMap.get(String(event.schoolId || "")) || "No local message context"}
                      </p>
                    </div>
                    <PlatformPill tone="amber">{event.eventType}</PlatformPill>
                  </div>
                  <p className="mt-2 text-xs text-white/35">{formatTimestamp(event.occurredAt)}</p>
                </div>
              );
            })}
          </div>
        </PlatformSection>
      </div>

      <PlatformSection
        title="Coverage Gaps"
        description="Current limitations in the webhook operator surface so developers know what is still missing."
      >
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
            <p className="font-medium text-white">Clerk</p>
            <p className="mt-2 text-sm text-white/55">
              The route processes identity events, but it does not yet persist a normalized raw-event ledger for replay or operator inspection.
            </p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
            <p className="font-medium text-white">Paystack</p>
            <p className="mt-2 text-sm text-white/55">
              Visibility comes from finance audit trails and payment audit events, not a dedicated webhook event store with request payload history.
            </p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
            <p className="font-medium text-white">Brevo</p>
            <p className="mt-2 text-sm text-white/55">
              Delivery events are recorded, but the platform still lacks a single cross-provider webhook console with replay-safe tooling.
            </p>
          </div>
        </div>
      </PlatformSection>
    </div>
  );
}
