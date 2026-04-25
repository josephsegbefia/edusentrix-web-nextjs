"use client";

import * as React from "react";
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
  Presentation,
  BarChart3,
  DatabaseZap,
  RefreshCw,
  Clock3,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { LeoIcon } from "@/components/icons/LeoIcon";
import {
  premiumSideItem,
  premiumSideItemActive,
} from "@/components/ui/premium";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarFooterBranding } from "@/components/nav/sidebars/SidebarFooterBranding";
import { useSidebar } from "@/providers/sidebar-provider";
import { SidebarPlatformIdentity } from "@/components/platform/SidebarPlatformIdentity";

type NavSection = {
  title: string;
  items: Array<{
    label: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    exact?: boolean;
  }>;
};

const navSections: NavSection[] = [
  {
    title: "Overview",
    items: [
      {
        label: "Command Center",
        href: "/platform",
        icon: LayoutDashboard,
        exact: true,
      },
    ],
  },
  {
    title: "Growth",
    items: [
      {
        label: "Applications",
        href: "/platform/applications",
        icon: CheckSquare,
      },
      {
        label: "Demo Leads",
        href: "/platform/demo-leads",
        icon: Presentation,
      },
      {
        label: "Schools",
        href: "/platform/schools",
        icon: Building2,
      },
      {
        label: "Users",
        href: "/platform/users",
        icon: Users,
      },
      {
        label: "Pilot",
        href: "/platform/pilot",
        icon: FlaskConical,
      },
    ],
  },
  {
    title: "Revenue",
    items: [
      {
        label: "Billing Overview",
        href: "/platform/billing",
        icon: Banknote,
        exact: true,
      },
      {
        label: "Revenue Analytics",
        href: "/platform/billing/revenue",
        icon: BarChart3,
      },
      {
        label: "Usage Ledger",
        href: "/platform/billing/usage",
        icon: DatabaseZap,
      },
      {
        label: "Cost Ledger",
        href: "/platform/billing/costs",
        icon: DatabaseZap,
      },
      {
        label: "Provider Sync",
        href: "/platform/billing/sync",
        icon: RefreshCw,
      },
      {
        label: "Billing Events",
        href: "/platform/billing/events",
        icon: Clock3,
      },
      {
        label: "Subscription Tiers",
        href: "/platform/billing/tiers",
        icon: Flag,
      },
      {
        label: "Reconciliation",
        href: "/platform/reconciliation",
        icon: Landmark,
      },
    ],
  },
  {
    title: "Operations",
    items: [
      {
        label: "Email Inbox",
        href: "/platform/email",
        icon: Inbox,
      },
      {
        label: "Email Templates",
        href: "/platform/emails",
        icon: Mail,
      },
      {
        label: "Webhooks",
        href: "/platform/webhooks",
        icon: Webhook,
      },
      {
        label: "Audit Logs",
        href: "/platform/audit",
        icon: FileWarning,
      },
    ],
  },
  {
    title: "System",
    items: [
      {
        label: "Feature Flags",
        href: "/platform/flags",
        icon: Flag,
      },
      {
        label: "Leo Copilot",
        href: "/platform/leo",
        icon: LeoIcon,
      },
      {
        label: "Settings",
        href: "/platform/settings",
        icon: Settings,
      },
    ],
  },
];

const sidebarTooltipClasses =
  "bg-white/10 text-white ring-1 ring-white/10 rounded-xl backdrop-blur-md border-0 px-3 py-2.5 text-sm font-medium shadow-lg";

function NavContent({
  onItemClick,
  collapsed,
}: {
  onItemClick?: () => void;
  collapsed: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav className={cn("space-y-5", collapsed && "space-y-3")}>
      {navSections.map((section, sectionIdx) => (
        <div key={section.title}>
          {!collapsed ? (
            <div className="mb-2 px-3.5">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">
                {section.title}
              </h3>
            </div>
          ) : null}

          <div className={cn("space-y-0.5", collapsed && "space-y-1.5")}>
            {section.items.map(({ label, href, icon: Icon, exact }) => {
              const active = exact
                ? pathname === href
                : pathname === href || pathname.startsWith(href + "/");

              if (collapsed) {
                return (
                  <Tooltip key={href} delayDuration={0}>
                    <TooltipTrigger asChild>
                      <ActiveLink
                        href={href}
                        exact={exact}
                        onClick={onItemClick}
                        className={cn(
                          "mx-auto flex h-10 w-10 items-center justify-center rounded-xl",
                          "text-white/50 transition-all duration-200 hover:bg-white/7 hover:text-white",
                          active &&
                            "bg-white/9 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                        )}
                        activeClassName="nav-active"
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                      </ActiveLink>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={8} className={sidebarTooltipClasses}>
                      {label}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return (
                <ActiveLink
                  key={href}
                  href={href}
                  exact={exact}
                  onClick={onItemClick}
                  className={cn(premiumSideItem, active && premiumSideItemActive)}
                  activeClassName="nav-active"
                >
                  <Icon className={cn("h-4 w-4 shrink-0", active && "text-cyan-300")} />
                  <span className="truncate">{label}</span>
                </ActiveLink>
              );
            })}
          </div>

          {sectionIdx < navSections.length - 1 ? (
            <Separator className={cn("mt-5 bg-white/4", collapsed && "mt-3")} />
          ) : null}
        </div>
      ))}
    </nav>
  );
}

function DesktopSidebar() {
  const { collapsed, toggle } = useSidebar();

  React.useEffect(() => {
    const styleId = "platform-sidebar-scrollbar-hide";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        .platform-sidebar-scroll::-webkit-scrollbar {
          display: none;
        }
        .platform-sidebar-scroll {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  return (
    <TooltipProvider>
      <aside
        className={cn(
          "platform-sidebar-scroll hidden md:flex fixed left-0 top-14 z-30 h-[calc(100vh-3.5rem)] shrink-0 flex-col border-r border-white/6 bg-[linear-gradient(180deg,rgba(15,21,36,0.97)_0%,rgba(10,14,26,0.99)_100%)] backdrop-blur-2xl transition-[width] duration-200 ease-in-out",
          collapsed ? "w-16" : "w-72"
        )}
      >
        <div
          className={cn(
            "shrink-0 border-b border-white/5",
            collapsed ? "px-2 py-4" : "px-5 py-4"
          )}
        >
          <div className={cn("flex", collapsed ? "justify-center" : "justify-end")}>
            <button
              type="button"
              onClick={toggle}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/50 transition-all duration-150 hover:border-white/15 hover:bg-white/10 hover:text-white"
            >
              {collapsed ? (
                <ChevronRight className="h-3.5 w-3.5" />
              ) : (
                <ChevronLeft className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          <div className={cn("mt-2", collapsed ? "flex justify-center" : "min-w-0")}>
            <SidebarPlatformIdentity collapsed={collapsed} className={cn(!collapsed && "min-w-0")} />
          </div>
        </div>

        <div
          className={cn(
            "platform-sidebar-scroll flex-1 overflow-y-auto",
            collapsed ? "px-1 py-3" : "px-3 py-4"
          )}
        >
          <NavContent collapsed={collapsed} />
        </div>

        <div
          className={cn(
            "shrink-0 border-t border-white/5",
            collapsed ? "px-2 pb-3 pt-2" : "px-4 pb-4 pt-3"
          )}
        >
          <SidebarFooterBranding collapsed={collapsed} />
        </div>
      </aside>
    </TooltipProvider>
  );
}

function MobileSidebar({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-[300px] border-r border-white/6 bg-[linear-gradient(180deg,rgba(15,21,36,0.98)_0%,rgba(10,14,26,1)_100%)] p-0 sm:w-[320px]"
      >
        <SheetHeader className="border-b border-white/5 px-5 py-4">
          <SheetTitle className="sr-only">Platform Admin Navigation Menu</SheetTitle>
          <div className="flex items-center justify-between gap-3">
            <SidebarPlatformIdentity className="min-w-0 flex-1" />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close menu</span>
            </Button>
          </div>
        </SheetHeader>

        <div className="platform-sidebar-scroll overflow-y-auto p-4">
          <NavContent onItemClick={() => onOpenChange(false)} collapsed={false} />
          <div className="mt-4 border-t border-white/5 pt-4">
            <SidebarFooterBranding />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      className="h-9 w-9 border border-white/10 bg-card/95 text-white backdrop-blur-sm hover:border-white/20 hover:bg-white/10 md:hidden"
    >
      <Menu className="h-4 w-4" />
      <span className="sr-only">Open menu</span>
    </Button>
  );
}

export default function PlatformSidebar() {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <>
      <div className="fixed left-4 top-[4.5rem] z-40 md:hidden">
        <MobileMenuButton onClick={() => setMobileMenuOpen(true)} />
      </div>
      <DesktopSidebar />
      <MobileSidebar open={mobileMenuOpen} onOpenChange={setMobileMenuOpen} />
    </>
  );
}
