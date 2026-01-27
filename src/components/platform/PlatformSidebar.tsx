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
  Flag,
  FileWarning,
  Settings,
  Building2,
  Landmark,
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
  { label: "Reconciliation", href: "/platform/reconciliation", icon: Landmark },
  { label: "Webhooks", href: "/platform/webhooks", icon: Webhook },
  { label: "Email Templates", href: "/platform/emails", icon: Mail },
  { label: "Feature Flags", href: "/platform/flags", icon: Flag },
  { label: "Audit Logs", href: "/platform/audit", icon: FileWarning },
  { label: "Settings", href: "/platform/settings", icon: Settings },
];

export default function PlatformSidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:block fixed left-0 top-14 w-64 h-[calc(100vh-3.5rem)] shrink-0 border-r border-neutral-900 bg-card overflow-y-auto">
      <div className="p-3">
        <nav className="space-y-1">
          {nav.map(({ label, href, icon: Icon, exact }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <ActiveLink
                key={href}
                href={href}
                exact={exact}
                className={cn(premiumSideItem, active && premiumSideItemActive)}
                activeClassName="nav-active"
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </ActiveLink>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
