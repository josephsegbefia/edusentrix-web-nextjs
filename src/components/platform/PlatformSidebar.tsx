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
  ClipboardList,
  ListTodo,
  FileText,
} from "lucide-react";
import { LeoIcon } from "@/components/icons/LeoIcon";
import { LearnLogoIcon } from "@/components/icons/LearnLogoIcon";
import {
  SidebarNavItemIcon,
  SidebarNavItemLabel,
} from "@/components/nav/sidebars/SidebarLearnNav";
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
import { ApplicationsNavPendingBadge } from "@/components/platform/ApplicationsNavPendingBadge";
import type { PlatformPermissionKey } from "@/lib/platform/permissions/registry";
import { hasAnyRequiredPlatformPermission } from "@/lib/platform/permissions/navigation";

const PLATFORM_APPLICATIONS_HREF = "/platform/applications";

type NavSection = {
  title: string;
  items: Array<{
    label: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    exact?: boolean;
    requiredPermissions: PlatformPermissionKey[];
  }>;
};

type PlatformSidebarProps = {
  permissions: PlatformPermissionKey[];
  isLegacyPlatformAdmin?: boolean;
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
        requiredPermissions: ["platform.schools.read"],
      },
    ],
  },
  {
    title: "Growth",
    items: [
      {
        label: "Applications",
        href: PLATFORM_APPLICATIONS_HREF,
        icon: CheckSquare,
        requiredPermissions: ["platform.applications.read"],
      },
      {
        label: "Demo Leads",
        href: "/platform/demo-leads",
        icon: Presentation,
        requiredPermissions: ["platform.applications.read"],
      },
      {
        label: "Proposals",
        href: "/platform/proposals",
        icon: FileText,
        requiredPermissions: ["platform.proposals.read"],
      },
      {
        label: "Schools",
        href: "/platform/schools",
        icon: Building2,
        requiredPermissions: ["platform.schools.read"],
      },
      {
        label: "EduSentrix Learn",
        href: "/platform/learn",
        icon: LearnLogoIcon,
        requiredPermissions: ["platform.learn.read"],
      },
      {
        label: "Staff",
        href: "/platform/staff",
        icon: Users,
        requiredPermissions: ["platform.staff.read"],
      },
      {
        label: "Delegations",
        href: "/platform/delegations",
        icon: ClipboardList,
        requiredPermissions: ["platform.implementation.assignTasks"],
      },
      {
        label: "Tasks",
        href: "/platform/tasks",
        icon: ListTodo,
        requiredPermissions: ["platform.implementation.read"],
      },
    ],
  },
  {
    title: "Operations",
    items: [
      {
        label: "Reconciliation",
        href: "/platform/reconciliation",
        icon: Landmark,
        requiredPermissions: ["platform.billing.read"],
      },
      {
        label: "Email Inbox",
        href: "/platform/email",
        icon: Inbox,
        requiredPermissions: ["platform.support.read"],
      },
      {
        label: "Email Templates",
        href: "/platform/emails",
        icon: Mail,
        requiredPermissions: ["platform.support.read"],
      },
      {
        label: "Webhooks",
        href: "/platform/webhooks",
        icon: Webhook,
        requiredPermissions: ["platform.system.settings.read"],
      },
      {
        label: "Audit Logs",
        href: "/platform/audit",
        icon: FileWarning,
        requiredPermissions: ["platform.audit.read"],
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
        requiredPermissions: ["platform.system.featureFlags.read"],
      },
      {
        label: "Leo Copilot",
        href: "/platform/leo",
        icon: LeoIcon,
        requiredPermissions: ["platform.system.settings.read"],
      },
      {
        label: "Settings",
        href: "/platform/settings",
        icon: Settings,
        requiredPermissions: ["platform.system.settings.read"],
      },
    ],
  },
];

const sidebarTooltipClasses =
  "bg-white/10 text-white ring-1 ring-white/10 rounded-xl backdrop-blur-md border-0 px-3 py-2.5 text-sm font-medium shadow-lg";

function NavContent({
  onItemClick,
  collapsed,
  permissions,
  isLegacyPlatformAdmin,
}: {
  onItemClick?: () => void;
  collapsed: boolean;
  permissions: PlatformPermissionKey[];
  isLegacyPlatformAdmin?: boolean;
}) {
  const pathname = usePathname();
  const visibleSections = React.useMemo(
    () =>
      navSections
        .map((section) => ({
          ...section,
          items: section.items.filter((item) =>
            hasAnyRequiredPlatformPermission(
              permissions,
              item.requiredPermissions,
              isLegacyPlatformAdmin
            )
          ),
        }))
        .filter((section) => section.items.length > 0),
    [isLegacyPlatformAdmin, permissions]
  );

  return (
    <nav className={cn("space-y-5", collapsed && "space-y-3")}>
      {visibleSections.map((section, sectionIdx) => (
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
                          href === PLATFORM_APPLICATIONS_HREF && "relative",
                          "text-white/50 transition-all duration-200 hover:bg-white/7 hover:text-white",
                          active &&
                            "bg-white/9 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                        )}
                        activeClassName="nav-active"
                      >
                        <span className="relative inline-flex shrink-0">
                          <SidebarNavItemIcon href={href} icon={Icon} className="h-4 w-4 shrink-0" />
                          {href === PLATFORM_APPLICATIONS_HREF ? (
                            <ApplicationsNavPendingBadge collapsed />
                          ) : null}
                        </span>
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
                  <SidebarNavItemIcon
                    href={href}
                    icon={Icon}
                    className={cn("h-4 w-4 shrink-0", active && "text-cyan-300")}
                  />
                  <span className="min-w-0 flex-1">
                    <SidebarNavItemLabel href={href} label={label} />
                  </span>
                  {href === PLATFORM_APPLICATIONS_HREF ? (
                    <ApplicationsNavPendingBadge collapsed={false} />
                  ) : null}
                </ActiveLink>
              );
            })}
          </div>

          {sectionIdx < visibleSections.length - 1 ? (
            <Separator className={cn("mt-5 bg-white/4", collapsed && "mt-3")} />
          ) : null}
        </div>
      ))}
    </nav>
  );
}

function DesktopSidebar({ permissions, isLegacyPlatformAdmin }: PlatformSidebarProps) {
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
          <NavContent
            collapsed={collapsed}
            permissions={permissions}
            isLegacyPlatformAdmin={isLegacyPlatformAdmin}
          />
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
  permissions,
  isLegacyPlatformAdmin,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
} & PlatformSidebarProps) {
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
          <NavContent
            onItemClick={() => onOpenChange(false)}
            collapsed={false}
            permissions={permissions}
            isLegacyPlatformAdmin={isLegacyPlatformAdmin}
          />
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

export default function PlatformSidebar({
  permissions,
  isLegacyPlatformAdmin,
}: PlatformSidebarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <>
      <div className="fixed left-4 top-[4.5rem] z-40 md:hidden">
        <MobileMenuButton onClick={() => setMobileMenuOpen(true)} />
      </div>
      <DesktopSidebar
        permissions={permissions}
        isLegacyPlatformAdmin={isLegacyPlatformAdmin}
      />
      <MobileSidebar
        open={mobileMenuOpen}
        onOpenChange={setMobileMenuOpen}
        permissions={permissions}
        isLegacyPlatformAdmin={isLegacyPlatformAdmin}
      />
    </>
  );
}
