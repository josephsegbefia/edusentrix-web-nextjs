// src/components/platform/PlatformSidebar.tsx
"use client";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import ActiveLink from "../nav/active/ActiveLink";
import {
  LayoutDashboard,
  CheckSquare,
  Users,
  Banknote,
  Webhook,
  Mail,
  Inbox,
  Flag,
  FileWarning,
  Settings,
  Building2,
  Landmark,
  FlaskConical,
} from "lucide-react";
import {
  premiumSideItem,
  premiumSideItemActive,
} from "@/components/ui/premium";

const nav = [
  { label: "Overview", href: "/platform", icon: LayoutDashboard, exact: true },
  {
    label: "Applications",
    href: "/platform/applications",
    icon: CheckSquare,
  },
  { label: "Schools", href: "/platform/schools", icon: Building2 },
  { label: "Users", href: "/platform/users", icon: Users },
  { label: "Billing", href: "/platform/billing", icon: Banknote },
  { label: "Pilot", href: "/platform/pilot", icon: FlaskConical },
  { label: "Reconciliation", href: "/platform/reconciliation", icon: Landmark },
  { label: "Webhooks", href: "/platform/webhooks", icon: Webhook },
  { label: "Email Inbox", href: "/platform/email", icon: Inbox },
  { label: "Email Templates", href: "/platform/emails", icon: Mail },
  { label: "Feature Flags", href: "/platform/flags", icon: Flag },
  { label: "Audit Logs", href: "/platform/audit", icon: FileWarning },
  { label: "Settings", href: "/platform/settings", icon: Settings },
];

export default function PlatformSidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex flex-col fixed left-0 top-14 w-72 h-[calc(100vh-3.5rem)] shrink-0 border-r border-white/6 bg-[linear-gradient(180deg,rgba(15,21,36,0.97)_0%,rgba(10,14,26,0.99)_100%)] backdrop-blur-2xl overflow-y-auto">
      <div className="px-3 py-4 flex-1">
        <div className="mb-4 px-3.5">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">
            Platform
          </h3>
        </div>
        <nav className="space-y-0.5">
          {nav.map(({ label, href, icon: Icon, exact }) => {
            const active = exact
              ? pathname === href
              : pathname === href || pathname.startsWith(href + "/");
            return (
              <ActiveLink
                key={href}
                href={href}
                exact={exact}
                className={cn(premiumSideItem, active && premiumSideItemActive)}
                activeClassName="nav-active"
              >
                <Icon className={cn("h-4 w-4", active && "text-emerald-400")} />
                <span>{label}</span>
              </ActiveLink>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
