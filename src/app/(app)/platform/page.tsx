import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Building2,
  CheckSquare,
  ClipboardList,
  FileWarning,
  Inbox,
  Landmark,
  ListTodo,
  Mail,
  Presentation,
  School2,
  Settings,
  Sparkles,
  Users,
  Webhook,
} from "lucide-react";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  PlatformMetricCard,
  PlatformMetricGrid,
  PlatformPageHeader,
  PlatformSection,
} from "@/components/platform/platform-page-primitives";
import { School } from "@/models/School";

export const dynamic = "force-dynamic";

type Destination = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

type DestinationGroup = {
  title: string;
  blurb: string;
  items: Destination[];
};

const DESTINATION_GROUPS: DestinationGroup[] = [
  {
    title: "Growth & schools",
    blurb: "New demand, demos, and onboarded institutions.",
    items: [
      {
        href: "/platform/applications",
        label: "Applications",
        description: "Review and approve school signup requests.",
        icon: CheckSquare,
      },
      {
        href: "/platform/demo-leads",
        label: "Demo leads",
        description: "Prospects who tried the demo sandbox.",
        icon: Presentation,
      },
      {
        href: "/platform/schools",
        label: "Schools",
        description: "Portfolio and per-school tools.",
        icon: Building2,
      },
      {
        href: "/platform/staff",
        label: "Staff",
        description: "Internal EduSentrix operators, roles, and permissions.",
        icon: Users,
      },
      {
        href: "/platform/delegations",
        label: "Delegations",
        description: "Scoped platform staff assignments by school and task area.",
        icon: ClipboardList,
      },
      {
        href: "/platform/tasks",
        label: "Tasks",
        description: "Implementation, training, support, and follow-up work queue.",
        icon: ListTodo,
      },
    ],
  },
  {
    title: "Operations",
    blurb: "Comms, integrations, fees reconciliation, and forensic review.",
    items: [
      {
        href: "/platform/reconciliation",
        label: "Reconciliation",
        description: "Fees reconciliation sessions.",
        icon: Landmark,
      },
      {
        href: "/platform/email",
        label: "Email inbox",
        description: "Operational mail threads.",
        icon: Inbox,
      },
      {
        href: "/platform/emails",
        label: "Email templates",
        description: "Transactional template registry.",
        icon: Mail,
      },
      {
        href: "/platform/webhooks",
        label: "Webhooks",
        description: "Inbound webhook endpoints and logs.",
        icon: Webhook,
      },
      {
        href: "/platform/audit",
        label: "Audit logs",
        description: "Who changed what, across the platform.",
        icon: FileWarning,
      },
    ],
  },
  {
    title: "System",
    blurb: "Feature rollout and global configuration.",
    items: [
      {
        href: "/platform/flags",
        label: "Feature flags",
        description: "Toggle product behavior by school or cohort.",
        icon: Sparkles,
      },
      {
        href: "/platform/settings",
        label: "Settings",
        description: "Platform-wide preferences and secrets UI.",
        icon: Settings,
      },
    ],
  },
];

export default async function PlatformOverviewPage() {
  await connectToDatabase();
  const totalSchools = await School.countDocuments({});

  return (
    <div className="space-y-6 p-2 md:p-4">
      <PlatformPageHeader
        eyebrow="Platform admin"
        title="Overview"
        description="Home screen for platform operators. Open a workspace below—the sections match the sidebar."
      />

      <PlatformMetricGrid>
        <PlatformMetricCard
          icon={School2}
          label="Schools"
          value={totalSchools.toLocaleString()}
          note="Schools in the portfolio"
          tone="cyan"
        />
      </PlatformMetricGrid>

      <PlatformSection
        title="Find the right workspace"
        description="Each card goes to a live tool."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {DESTINATION_GROUPS.map((group) => (
            <div
              key={group.title}
              className="rounded-2xl border border-white/10 bg-black/20 p-4 md:p-5"
            >
              <h3 className="text-base font-semibold text-white">{group.title}</h3>
              <p className="mt-1 text-sm text-white/50">{group.blurb}</p>
              <ul className="mt-4 space-y-2">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="group flex gap-3 rounded-xl border border-transparent px-2 py-2 transition-colors hover:border-white/10 hover:bg-white/5"
                    >
                      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 group-hover:text-white">
                        <item.icon className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 font-medium text-white group-hover:text-cyan-100">
                          {item.label}
                          <ArrowRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                        </span>
                        <span className="mt-0.5 block text-sm text-white/45">
                          {item.description}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </PlatformSection>
    </div>
  );
}
