import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";
import { ArrowRight, Cog, HeartPulse, ShieldCheck, Workflow } from "lucide-react";
import { connectToDatabase } from "@/db/connectToDatabase";
import { EDUSENTRIX_LOGO_PATH } from "@/lib/branding";
import { ProviderSyncRun } from "@/models/ProviderSyncRun";
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

export default async function PlatformSettingsPage() {
  await connectToDatabase();

  const [platformAdmins, activeSchools, pendingSchools, recentSyncRuns] = await Promise.all([
    User.find({ role: "platform_admin" })
      .sort({ updatedAt: -1 })
      .select("email name firstName lastName createdAt updatedAt")
      .lean<
        Array<{
          _id: unknown;
          email: string;
          name?: string | null;
          firstName?: string | null;
          lastName?: string | null;
          createdAt: Date;
          updatedAt: Date;
        }>
      >(),
    School.countDocuments({ status: "active" }),
    School.countDocuments({ status: "pending" }),
    ProviderSyncRun.find({})
      .sort({ createdAt: -1 })
      .limit(8)
      .select("provider status summary createdAt")
      .lean<
        Array<{
          _id: unknown;
          provider: string;
          status: "running" | "completed" | "failed";
          summary?: string | null;
          createdAt: Date;
        }>
      >(),
  ]);

  const repoRoot = process.cwd();
  const workflowDir = join(repoRoot, ".github", "workflows");
  const workflowFiles = existsSync(workflowDir)
    ? readdirSync(workflowDir).filter((file) => file.endsWith(".yml") || file.endsWith(".yaml"))
    : [];
  const deploymentManifests = [
    "vercel.json",
    "Dockerfile",
    "docker-compose.yml",
    "docker-compose.yaml",
  ].filter((file) => existsSync(join(repoRoot, file)));
  const healthRoutePresent = existsSync(join(repoRoot, "src/app/api/healthz/route.ts"));
  const supportEmail = process.env.SUPPORT_EMAIL || "support@edusentrix.com";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "Not configured";

  const integrations = [
    {
      label: "MongoDB",
      configured: Boolean(process.env.MONGODB_URI),
      note: "Primary application datastore",
    },
    {
      label: "Clerk",
      configured: Boolean(
        process.env.CLERK_SECRET_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
      ),
      note: "Authentication and identity",
    },
    {
      label: "Paystack",
      configured: Boolean(process.env.PAYSTACK_SECRET_KEY),
      note: "Payments and subaccount provisioning",
    },
    {
      label: "Brevo",
      configured: Boolean(process.env.BREVO_API_KEY),
      note: "Transactional and manual email delivery",
    },
    {
      label: "UploadThing",
      configured: Boolean(process.env.UPLOADTHING_TOKEN),
      note: "Attachment and asset storage",
    },
    {
      label: "OpenAI",
      configured: Boolean(process.env.OPENAI_API_KEY),
      note: "AI-assisted reporting and summaries",
    },
    {
      label: "Gemini",
      configured: Boolean(
        process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_AI_API_KEY?.trim(),
      ),
      note: "Scheme PDF import fallback when OpenAI is unavailable",
    },
  ];
  const configuredIntegrations = integrations.filter((item) => item.configured).length;

  return (
    <div className="space-y-6 p-2 md:p-4">
      <PlatformPageHeader
        eyebrow="Platform Configuration"
        title="Safe settings and operating posture"
        description="Review non-secret platform identity values, integration readiness, platform admin access, and repo-level delivery posture without touching working runtime state."
        actions={
          <>
            <Link
              href="/platform/webhooks"
              className="inline-flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              <span>Webhook Health</span>
              <ArrowRight className="ml-3 h-4 w-4" />
            </Link>
            <Link
              href="/platform/reconciliation"
              className="inline-flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              <span>Reconciliation</span>
              <ArrowRight className="ml-3 h-4 w-4" />
            </Link>
          </>
        }
      />

      <PlatformMetricGrid>
        <PlatformMetricCard
          icon={ShieldCheck}
          label="Platform Admins"
          value={platformAdmins.length.toLocaleString()}
          note="Current operator accounts with direct platform access."
          tone="violet"
        />
        <PlatformMetricCard
          icon={HeartPulse}
          label="Active Schools"
          value={activeSchools.toLocaleString()}
          note={`${pendingSchools.toLocaleString()} school records are still pending activation.`}
          tone="emerald"
        />
        <PlatformMetricCard
          icon={Cog}
          label="Integrations"
          value={`${configuredIntegrations}/${integrations.length}`}
          note="Configured external services detected from runtime env presence."
          tone="cyan"
        />
        <PlatformMetricCard
          icon={Workflow}
          label="CI Workflows"
          value={workflowFiles.length.toLocaleString()}
          note="Workflow files detected under .github/workflows."
          tone="amber"
        />
      </PlatformMetricGrid>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <PlatformSection
          title="Platform Identity"
          description="Non-secret runtime values and operator-facing identity references."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-white/35">Application URL</p>
              <p className="mt-2 text-sm text-white">{appUrl}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-white/35">Support Mailbox</p>
              <p className="mt-2 text-sm text-white">{supportEmail}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-white/35">Health Probe</p>
              <p className="mt-2 text-sm text-white">
                {healthRoutePresent ? "/api/healthz" : "Missing health route"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-white/35">Brand Asset</p>
              <p className="mt-2 text-sm text-white">{EDUSENTRIX_LOGO_PATH}</p>
            </div>
          </div>
        </PlatformSection>

        <PlatformSection
          title="Integration Readiness"
          description="Presence checks only. Secret values remain out of the UI."
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {integrations.map((integration) => (
              <div
                key={integration.label}
                className="rounded-2xl border border-white/8 bg-black/20 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-white">{integration.label}</p>
                    <p className="mt-1 text-sm text-white/50">{integration.note}</p>
                  </div>
                  <PlatformPill tone={integration.configured ? "emerald" : "rose"}>
                    {integration.configured ? "configured" : "missing"}
                  </PlatformPill>
                </div>
              </div>
            ))}
          </div>
        </PlatformSection>
      </div>

      <PlatformSection
        title="Platform Admin Roster"
        description="Operator accounts currently recorded in the user store."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-white/45">
                <th className="pb-3 font-medium">Admin</th>
                <th className="pb-3 font-medium">Email</th>
                <th className="pb-3 font-medium">Created</th>
                <th className="pb-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {platformAdmins.map((admin) => {
                const name =
                  admin.name?.trim() ||
                  [admin.firstName, admin.lastName].filter(Boolean).join(" ").trim() ||
                  admin.email;

                return (
                  <tr key={String(admin._id)} className="border-b border-white/5">
                    <td className="py-3 pr-4 font-medium text-white">{name}</td>
                    <td className="py-3 pr-4 text-white/60">{admin.email}</td>
                    <td className="py-3 pr-4 text-white/55">{formatDate(admin.createdAt)}</td>
                    <td className="py-3 text-white/55">{formatTimestamp(admin.updatedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </PlatformSection>

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <PlatformSection
          title="Delivery Posture"
          description="Repo-level signals that affect pilot operations and release confidence."
        >
          <div className="space-y-3">
            <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-white">CI workflows</p>
                  <p className="mt-1 text-sm text-white/50">
                    {workflowFiles.length > 0
                      ? workflowFiles.join(", ")
                      : "No workflow files detected in the repository."}
                  </p>
                </div>
                <PlatformPill tone={workflowFiles.length > 0 ? "emerald" : "rose"}>
                  {workflowFiles.length > 0 ? "present" : "missing"}
                </PlatformPill>
              </div>
            </div>
            <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-white">Deployment manifests</p>
                  <p className="mt-1 text-sm text-white/50">
                    {deploymentManifests.length > 0
                      ? deploymentManifests.join(", ")
                      : "No repo-level deployment manifest detected."}
                  </p>
                </div>
                <PlatformPill tone={deploymentManifests.length > 0 ? "emerald" : "amber"}>
                  {deploymentManifests.length > 0 ? "present" : "manual"}
                </PlatformPill>
              </div>
            </div>
            <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-white">Monitoring and backups</p>
                  <p className="mt-1 text-sm text-white/50">
                    No repo-backed automation was detected here. These still need explicit operational ownership outside this UI.
                  </p>
                </div>
                <PlatformPill tone="amber">manual</PlatformPill>
              </div>
            </div>
          </div>
        </PlatformSection>

        <PlatformSection
          title="Recent Sync Telemetry"
          description="Latest platform provider sync activity for cost, usage, and billing back-office visibility."
        >
          <div className="space-y-3">
            {recentSyncRuns.length > 0 ? (
              recentSyncRuns.map((run) => (
                <div
                  key={String(run._id)}
                  className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium capitalize text-white">{run.provider}</p>
                      <p className="mt-1 text-xs text-white/45">{formatTimestamp(run.createdAt)}</p>
                    </div>
                    <PlatformPill
                      tone={
                        run.status === "completed"
                          ? "emerald"
                          : run.status === "failed"
                            ? "rose"
                            : "amber"
                      }
                    >
                      {run.status}
                    </PlatformPill>
                  </div>
                  {run.summary ? (
                    <p className="mt-2 text-sm text-white/55">{run.summary}</p>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-sm text-white/45">No provider sync runs recorded yet.</p>
            )}
          </div>
        </PlatformSection>
      </div>
    </div>
  );
}
