// src/components/platform/PlatformSidebar.tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
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

const nav = [
  { label: "Overview", href: "/platform", icon: LayoutDashboard },
  { label: "Applications", href: "/platform/applications", icon: CheckSquare },
  { label: "Schools", href: "/platform/schools", icon: Building2 },
  { label: "Users", href: "/platform/users", icon: Users },
  { label: "Billing", href: "/platform/billing", icon: Banknote },
  { label: "Reconciliation", href: "/platform/reconciliation", icon: Landmark },
  { label: "Webhooks", href: "/platform/webhooks", icon: Webhook },
  { label: "Email Templates", href: "/platform/emails", icon: Mail },
  { label: "Feature Flags", href: "/platform/flags", icon: Flag },
  { label: "Audit Log", href: "/platform/audit", icon: FileWarning },
  { label: "Settings", href: "/platform/settings", icon: Settings },
];

export default function PlatformSidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:block w-64 shrink-0  bg-card">
      <div className="p-3">
        <nav className="space-y-1">
          {nav.map(({ label, href, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-accent",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
