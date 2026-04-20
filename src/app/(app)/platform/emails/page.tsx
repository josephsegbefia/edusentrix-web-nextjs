import Link from "next/link";
import { ArrowRight, Eye, Layers3, Mail, Sparkles } from "lucide-react";
import {
  EmailTemplates,
  type TemplateKey,
  type TemplatePayload,
} from "@/lib/email/templates";
import { TEMPLATE_REGISTRY } from "@/lib/email/registry";
import {
  PlatformMetricCard,
  PlatformMetricGrid,
  PlatformPageHeader,
  PlatformPill,
  PlatformSection,
} from "@/components/platform/platform-page-primitives";

export const dynamic = "force-dynamic";

const SAMPLE_PAYLOADS: { [K in TemplateKey]: TemplatePayload[K] } = {
  SCHOOL_INVITE: {
    schoolName: "North Ridge Academy",
    setupLink: "https://edusentrix.com/sign-up",
  },
  APPLICATION_RECEIVED: {
    name: "Ama Boateng",
  },
  SCHOOL_ONBOARDING: {
    schoolName: "North Ridge Academy",
    contactPerson: "Ama Boateng",
  },
  ADMIN_CREATED: {
    name: "Kofi Mensah",
    email: "admin@northridge.edu.gh",
    schoolName: "North Ridge Academy",
    tempPassword: "Temp#2026",
  },
  USER_INVITE: {
    name: "Esi Owusu",
    role: "Teacher",
    schoolName: "North Ridge Academy",
    setupLink: "https://edusentrix.com/sign-up",
  },
  REMINDER: {
    title: "Parent-teacher conference",
    name: "Esi Owusu",
    time: "April 22, 2026 at 10:00 AM",
    location: "Main hall",
    description: "Bring the latest academic report and attendance notes.",
    actionLink: "https://edusentrix.com/admin/calendar",
  },
  FEE_REMINDER: {
    schoolName: "North Ridge Academy",
    guardianName: "Mr. Agyeman",
    totalOutstandingMinor: 245000,
    currency: "GHS",
    wards: [
      {
        studentName: "Nana Agyeman",
        classGroupName: "Basic 6",
        outstandingMinor: 120000,
        overdueInvoiceCount: 1,
      },
      {
        studentName: "Afia Agyeman",
        classGroupName: "Basic 3",
        outstandingMinor: 125000,
        overdueInvoiceCount: 2,
      },
    ],
    customMessage: "Please settle the oldest invoice before Friday to avoid account restrictions.",
    actionLink: "https://edusentrix.com/parent/fees",
    subjectOverride: "Fee Reminder: North Ridge Academy",
  },
  PASSWORD_OTP: {
    code: "428913",
  },
};

function registryTone(brand: string): "cyan" | "violet" {
  return brand === "edusentrix" ? "cyan" : "violet";
}

function renderPreview<K extends TemplateKey>(key: K) {
  return EmailTemplates[key](SAMPLE_PAYLOADS[key]);
}

export default function PlatformEmailTemplatesPage() {
  const registryEntries = Object.entries(TEMPLATE_REGISTRY)
    .map(([key, meta]) => ({ key, ...meta }))
    .sort((a, b) => a.key.localeCompare(b.key));
  const previewableKeys = Object.keys(EmailTemplates) as TemplateKey[];
  const previewableSet = new Set(previewableKeys);
  const previews = previewableKeys.map((key) => ({
    key,
    meta: TEMPLATE_REGISTRY[key],
    rendered: renderPreview(key),
  }));
  const schoolBrandCount = registryEntries.filter((entry) => entry.brand === "school").length;
  const platformBrandCount = registryEntries.filter((entry) => entry.brand === "edusentrix").length;
  const unrenderedEntries = registryEntries.filter((entry) => !previewableSet.has(entry.key as TemplateKey));

  return (
    <div className="space-y-6 p-2 md:p-4">
      <PlatformPageHeader
        eyebrow="Communication Ops"
        title="Template registry and preview surface"
        description="Review the current template catalog, inspect message classification, and preview the code-rendered templates already wired into the email layer."
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
              <span>Email Audit</span>
              <ArrowRight className="ml-3 h-4 w-4" />
            </Link>
          </>
        }
      />

      <PlatformMetricGrid>
        <PlatformMetricCard
          icon={Layers3}
          label="Registry Entries"
          value={registryEntries.length.toLocaleString()}
          note="All known template keys in the central classification registry."
          tone="cyan"
        />
        <PlatformMetricCard
          icon={Eye}
          label="Rendered Previews"
          value={previews.length.toLocaleString()}
          note="Templates with code-backed sample renders on this page."
          tone="emerald"
        />
        <PlatformMetricCard
          icon={Sparkles}
          label="Platform Brand"
          value={platformBrandCount.toLocaleString()}
          note="Templates branded directly as EduSentrix."
          tone="violet"
        />
        <PlatformMetricCard
          icon={Mail}
          label="School Brand"
          value={schoolBrandCount.toLocaleString()}
          note="Templates that inherit school branding context."
          tone="amber"
        />
      </PlatformMetricGrid>

      <PlatformSection
        title="Template Registry"
        description="Message classification metadata used by orchestration, preference enforcement, and mailbox routing."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-white/45">
                <th className="pb-3 font-medium">Template</th>
                <th className="pb-3 font-medium">Brand</th>
                <th className="pb-3 font-medium">Mailbox</th>
                <th className="pb-3 font-medium">Sender</th>
                <th className="pb-3 font-medium">Class</th>
                <th className="pb-3 font-medium">Preference</th>
              </tr>
            </thead>
            <tbody>
              {registryEntries.map((entry) => (
                <tr key={entry.key} className="border-b border-white/5 align-top">
                  <td className="py-3 pr-4">
                    <div>
                      <p className="font-mono text-xs text-white">{entry.key}</p>
                      <p className="mt-1 text-xs text-white/40">
                        {previewableSet.has(entry.key as TemplateKey)
                          ? "Preview available"
                          : "Registry only"}
                      </p>
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <PlatformPill tone={registryTone(entry.brand)}>{entry.brand}</PlatformPill>
                  </td>
                  <td className="py-3 pr-4 text-white/60">{entry.mailboxScope}</td>
                  <td className="py-3 pr-4 text-white/60">{entry.senderFamily}</td>
                  <td className="py-3 pr-4 text-white/60">{entry.messageClass}</td>
                  <td className="py-3 text-white/60">{entry.preferenceClass}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PlatformSection>

      <PlatformSection
        title="Rendered Preview Cards"
        description="Sample HTML output from the code-rendered template set currently exposed by the email module."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {previews.map((preview) => (
            <div
              key={preview.key}
              className="rounded-2xl border border-white/8 bg-black/20 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-xs text-white">{preview.key}</p>
                  <p className="mt-1 text-sm text-white/60">{preview.rendered.subject}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <PlatformPill tone={registryTone(preview.meta.brand)}>
                    {preview.meta.brand}
                  </PlatformPill>
                  <PlatformPill tone="slate">{preview.meta.senderFamily}</PlatformPill>
                </div>
              </div>

              {preview.rendered.textContent ? (
                <p className="mt-3 line-clamp-3 text-sm text-white/50">
                  {preview.rendered.textContent}
                </p>
              ) : null}

              <div className="mt-4 max-h-72 overflow-auto rounded-2xl border border-white/8 bg-white p-4 text-black shadow-inner">
                <div dangerouslySetInnerHTML={{ __html: preview.rendered.htmlContent }} />
              </div>
            </div>
          ))}
        </div>
      </PlatformSection>

      <PlatformSection
        title="Registry Entries Waiting On Preview Support"
        description="These keys are classified in the registry but do not yet expose sample render payloads on this page."
      >
        <div className="flex flex-wrap gap-2">
          {unrenderedEntries.length > 0 ? (
            unrenderedEntries.map((entry) => (
              <PlatformPill key={entry.key} tone="slate">
                {entry.key}
              </PlatformPill>
            ))
          ) : (
            <p className="text-sm text-white/45">Every registry entry has preview coverage.</p>
          )}
        </div>
      </PlatformSection>
    </div>
  );
}
