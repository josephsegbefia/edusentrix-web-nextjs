// src/components/nav/sidebars/parent-sidebar.tsx
"use client";
import * as React from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import ActiveLink from "../active/ActiveLink";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  DollarSign,
  Calendar,
  Bell,
  MessageSquare,
  FileText,
  Video,
  Menu,
  X,
  TrendingUp,
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  ClipboardList,
  BookOpen,
} from "lucide-react";
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
import { SidebarSchoolIdentity } from "@/components/nav/sidebars/SidebarSchoolIdentity";
import { SidebarFooterBranding } from "@/components/nav/sidebars/SidebarFooterBranding";
import { useUnreadNotificationCount } from "@/hooks/parent/useParentNotifications";
import { useUnreadMessageCount } from "@/hooks/parent/useParentMessages";
import { useSidebar } from "@/providers/sidebar-provider";

// Navigation structure with sections
type NavSection = {
  title: string;
  items: Array<{
    label: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    exact?: boolean;
    badgeCount?: number; // For unread notifications/messages count
  }>;
};

const sidebarTooltipClasses =
  "bg-white/10 text-white ring-1 ring-white/10 rounded-xl backdrop-blur-md border-0 px-3 py-2.5 text-sm font-medium shadow-lg";

function formatBadgeCount(count?: number) {
  if (!count || count <= 0) return null;
  if (count >= 10) return "10+";
  return String(count);
}

function getNavSections(unreadNotifications: number, unreadMessages: number): NavSection[] {
  return [
    {
      title: "Overview",
      items: [
        {
          label: "Dashboard",
          href: "/parent",
          icon: LayoutDashboard,
          exact: true,
        },
      ],
    },
    {
      title: "My Children",
      items: [
        {
          label: "All Wards",
          href: "/parent/wards",
          icon: Users,
        },
        {
          label: "Academic Progress",
          href: "/parent/academics",
          icon: GraduationCap,
        },
        {
          label: "Upcoming Exams",
          href: "/parent/exams",
          icon: ClipboardCheck,
        },
        {
          label: "Library",
          href: "/parent/library",
          icon: BookOpen,
        },
        {
          label: "Attendance",
          href: "/parent/attendance",
          icon: ClipboardCheck,
        },
        {
          label: "EduSentrix Learn",
          href: "/parent/learn",
          icon: LearnLogoIcon,
        },
      ],
    },
    {
      title: "Finances",
      items: [
        {
          label: "Fees & Payments",
          href: "/parent/fees",
          icon: DollarSign,
        },
        {
          label: "Payment History",
          href: "/parent/payments",
          icon: FileText,
        },
        {
          label: "School store",
          href: "/parent/store",
          icon: ShoppingBag,
        },
        {
          label: "Supply lists",
          href: "/parent/supplies",
          icon: ClipboardList,
        },
      ],
    },
    {
      title: "Communication",
      items: [
        {
          label: "Notifications",
          href: "/parent/notifications",
          icon: Bell,
          badgeCount: unreadNotifications,
        },
        {
          label: "Messages",
          href: "/parent/messages",
          icon: MessageSquare,
          badgeCount: unreadMessages,
        },
        {
          label: "Meetings",
          href: "/parent/meetings",
          icon: Video,
        },
      ],
    },
    {
      title: "School",
      items: [
        {
          label: "Calendar",
          href: "/parent/calendar",
          icon: Calendar,
        },
        {
          label: "Reports",
          href: "/parent/reports",
          icon: TrendingUp,
        },
      ],
    },
  ];
}

// Shared navigation content component
function NavContent({
  onItemClick,
  collapsed,
}: {
  onItemClick?: () => void;
  collapsed: boolean;
}) {
  const pathname = usePathname();
  const { data: unreadNotifications, isError: unreadNotificationsError } =
    useUnreadNotificationCount();
  const { data: unreadMessages, isError: unreadMessagesError } =
    useUnreadMessageCount();
  const navSections = React.useMemo(
    () =>
      getNavSections(
        unreadNotificationsError ? 0 : unreadNotifications ?? 0,
        unreadMessagesError ? 0 : unreadMessages ?? 0
      ),
    [
      unreadMessages,
      unreadMessagesError,
      unreadNotifications,
      unreadNotificationsError,
    ]
  );
  const sections = navSections;

  return (
    <nav className={cn("space-y-5", collapsed && "space-y-3")}>
      {sections.map((section, sectionIdx) => (
        <div key={section.title}>
          {!collapsed && (
            <div className="mb-2 px-3.5">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">
                {section.title}
              </h3>
            </div>
          )}

          <div className={cn("space-y-0.5", collapsed && "space-y-1.5")}>
            {section.items.map(({ label, href, icon: Icon, exact, badgeCount }) => {
              const active =
                exact
                  ? pathname === href
                  : pathname === href || pathname.startsWith(href + "/");
              const badge = formatBadgeCount(badgeCount);

              if (collapsed) {
                return (
                  <Tooltip key={href} delayDuration={0}>
                    <TooltipTrigger asChild>
                      <ActiveLink
                        href={href}
                        exact={exact}
                        onClick={onItemClick}
                        className={cn(
                          "relative mx-auto flex h-10 w-10 items-center justify-center rounded-xl",
                          "text-white/50 hover:text-white hover:bg-white/7 transition-all duration-200",
                          active &&
                            "bg-white/9 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                        )}
                        activeClassName="nav-active"
                      >
                        <SidebarNavItemIcon href={href} icon={Icon} />
                        {badge && (
                          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-semibold text-brand-foreground">
                            {badge}
                          </span>
                        )}
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
                  className={cn(
                    premiumSideItem,
                    active && premiumSideItemActive,
                    "relative"
                  )}
                  activeClassName="nav-active"
                >
                  <SidebarNavItemIcon
                    href={href}
                    icon={Icon}
                    className={cn("h-4 w-4 shrink-0", active && "text-amber-300")}
                  />
                  <SidebarNavItemLabel href={href} label={label} />
                  {badge && (
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-brand/20 px-1.5 text-[10px] font-medium text-brand">
                      {badge}
                    </span>
                  )}
                </ActiveLink>
              );
            })}
          </div>

          {sectionIdx < sections.length - 1 && (
            <Separator className={cn("mt-5 bg-white/4", collapsed && "mt-3")} />
          )}
        </div>
      ))}
    </nav>
  );
}

// Desktop Sidebar
function DesktopSidebar() {
  const { collapsed, toggle } = useSidebar();

  React.useEffect(() => {
    const styleId = "parent-sidebar-scrollbar-hide";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        .parent-sidebar-scroll::-webkit-scrollbar {
          display: none;
        }
        .parent-sidebar-scroll {
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
          "parent-sidebar-scroll hidden md:flex fixed left-0 top-14 h-[calc(100vh-3.5rem)] shrink-0 flex-col border-r border-white/6 bg-[linear-gradient(180deg,rgba(15,21,36,0.97)_0%,rgba(10,14,26,0.99)_100%)] backdrop-blur-2xl transition-[width] duration-200 ease-in-out z-30",
          collapsed ? "w-16" : "w-72"
        )}
      >
        <div
          className={cn(
            "border-b border-white/5 shrink-0",
            collapsed ? "px-2 py-4" : "px-5 py-4"
          )}
        >
          <div className={cn("flex", collapsed ? "justify-center" : "justify-end")}>
            <button
              type="button"
              onClick={toggle}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/50 hover:text-white hover:bg-white/10 hover:border-white/15 transition-all duration-150"
            >
              {collapsed ? (
                <ChevronRight className="h-3.5 w-3.5" />
              ) : (
                <ChevronLeft className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          <div className={cn("mt-2", collapsed ? "flex justify-center" : "min-w-0")}>
            <SidebarSchoolIdentity
              href="/parent"
              role="parent"
              collapsed={collapsed}
              className={cn(!collapsed && "min-w-0")}
            />
          </div>
        </div>
        <div
          className={cn(
            "flex-1 overflow-y-auto parent-sidebar-scroll",
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

// Mobile Sidebar (Sheet/Drawer)
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
        {/* Header */}
        <SheetHeader className="border-b border-white/5 px-4 py-4">
          <SheetTitle className="sr-only">Parent Navigation Menu</SheetTitle>
          <div className="flex items-center justify-between">
            <SidebarSchoolIdentity
              href="/parent"
              role="parent"
              className="min-w-0 flex-1"
            />
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

        <div className="parent-sidebar-scroll overflow-y-auto p-4">
          <NavContent onItemClick={() => onOpenChange(false)} collapsed={false} />
          <div className="mt-4 border-t border-white/5 pt-4">
            <SidebarFooterBranding />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Mobile Menu Button Component (exported for use in topbar if needed)
export function ParentMobileMenuButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      className="md:hidden h-9 w-9 border border-white/10 bg-card/95 backdrop-blur-sm text-white hover:bg-white/10 hover:border-white/20"
    >
      <Menu className="h-5 w-5" />
      <span className="sr-only">Open menu</span>
    </Button>
  );
}

// Main Component
export default function ParentSidebar() {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  // Close mobile menu when route changes
  const pathname = usePathname();
  React.useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Mobile Menu Button - Floating */}
      <div className="fixed left-4 top-[calc(3.5rem+0.75rem)] z-40 md:hidden">
        <ParentMobileMenuButton onClick={() => setMobileMenuOpen(true)} />
      </div>

      {/* Desktop Sidebar */}
      <DesktopSidebar />

      {/* Mobile Sidebar */}
      <MobileSidebar open={mobileMenuOpen} onOpenChange={setMobileMenuOpen} />
    </>
  );
}
