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
  Menu,
  X,
  TrendingUp,
  ClipboardCheck,
} from "lucide-react";
import {
  premiumSideItem,
  premiumSideItemActive,
} from "@/components/ui/premium";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SchoolBrand } from "@/components/brand/SchoolBrand";
import { useUnreadNotificationCount } from "@/hooks/parent/useParentNotifications";
import { useUnreadMessageCount } from "@/hooks/parent/useParentMessages";

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
          label: "Attendance",
          href: "/parent/attendance",
          icon: ClipboardCheck,
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
function NavContent({ onItemClick }: { onItemClick?: () => void }) {
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

  return (
    <nav className="space-y-6">
      {navSections.map((section, sectionIdx) => (
        <div key={section.title}>
          {/* Section Header */}
          <div className="mb-2.5 px-3">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/40">
              {section.title}
            </h3>
          </div>

          {/* Section Items */}
          <div className="space-y-1">
            {section.items.map(({ label, href, icon: Icon, exact, badgeCount }) => {
              const active =
                exact
                  ? pathname === href
                  : pathname === href || pathname.startsWith(href + "/");
              const badge = formatBadgeCount(badgeCount);
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
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{label}</span>
                  {badge && (
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-brand/20 px-1.5 text-[10px] font-medium text-brand">
                      {badge}
                    </span>
                  )}
                </ActiveLink>
              );
            })}
          </div>

          {/* Separator between sections (except last) */}
          {sectionIdx < navSections.length - 1 && (
            <Separator className="mt-6 bg-white/5" />
          )}
        </div>
      ))}
    </nav>
  );
}

// Desktop Sidebar
function DesktopSidebar() {
  React.useEffect(() => {
    const styleId = "sidebar-scrollbar-hide";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        .sidebar-scroll::-webkit-scrollbar {
          display: none;
        }
        .sidebar-scroll {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  return (
    <aside className="sidebar-scroll hidden md:block fixed left-0 top-14 w-64 h-[calc(100vh-3.5rem)] shrink-0 border-r border-neutral-900 bg-card overflow-y-auto">
      {/* School Brand Header */}
      <div className="border-b border-neutral-900 px-4 py-4">
        <SchoolBrand size="md" showName href="/parent" />
      </div>
      <div className="p-4">
        <NavContent />
      </div>
    </aside>
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
        className="w-[280px] border-r border-neutral-900 bg-card p-0 sm:w-[300px]"
      >
        {/* Header */}
        <SheetHeader className="border-b border-neutral-900 px-4 py-4">
          <SheetTitle className="sr-only">Parent Navigation Menu</SheetTitle>
          <div className="flex items-center justify-between">
            <SchoolBrand size="md" showName href="/parent" />
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

        {/* Navigation Content */}
        <div className="sidebar-scroll overflow-y-auto p-4">
          <NavContent onItemClick={() => onOpenChange(false)} />
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
