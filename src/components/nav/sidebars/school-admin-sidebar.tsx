// src/components/nav/sidebars/school-admin-sidebar.tsx
"use client";
import * as React from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import ActiveLink from "../active/ActiveLink";
import {
  LayoutDashboard,
  GraduationCap,
  BookOpen,
  Calendar,
  CalendarDays,
  CalendarRange,
  DollarSign,
  FileText,
  BarChart3,
  Settings,
  School,
  UserCog,
  Mail,
  CheckSquare,
  ClipboardCheck,
  Menu,
  X,
  Crown,
  Vote,
  Heart,
  Landmark,
  Receipt,
  FileSearch,
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

// Navigation structure with sections
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
        label: "Dashboard",
        href: "/admin",
        icon: LayoutDashboard,
        exact: true,
      },
    ],
  },
  {
    title: "People",
    items: [
      {
        label: "Students",
        href: "/admin/students",
        icon: GraduationCap,
      },
      {
        label: "Teachers",
        href: "/admin/teachers",
        icon: UserCog,
      },
      {
        label: "Roles & Duties",
        href: "/admin/roles-duties",
        icon: Crown,
      },
      {
        label: "Staff Attendance",
        href: "/admin/staff-attendance",
        icon: ClipboardCheck,
      },
      {
        label: "Invitations",
        href: "/admin/invitations",
        icon: Mail,
      },
    ],
  },
  {
    title: "Academics",
    items: [
      {
        label: "Classes",
        href: "/admin/classes",
        icon: School,
      },
      {
        label: "Subjects",
        href: "/admin/subjects",
        icon: BookOpen,
      },
      {
        label: "Master Timetable",
        href: "/admin/timetable",
        icon: CalendarDays,
      },
      {
        label: "Academic Calendar",
        href: "/admin/academic-calendar",
        icon: CalendarRange,
      },
      {
        label: "Academic Periods",
        href: "/admin/periods",
        icon: Calendar,
      },
    ],
  },
  {
    title: "Community",
    items: [
      {
        label: "Polls",
        href: "/admin/community/polls",
        icon: Vote,
      },
      {
        label: "Fundraising",
        href: "/admin/community/fundraising",
        icon: Heart,
      },
    ],
  },
  {
    title: "Operations",
    items: [
      {
        label: "Financial Center",
        href: "/admin/finance",
        icon: Landmark,
      },
      {
        label: "Reconciliation Queue",
        href: "/admin/finance/reconciliation",
        icon: FileSearch,
      },
      {
        label: "Fees & Payments",
        href: "/admin/fees",
        icon: DollarSign,
      },
      {
        label: "Expenses",
        href: "/admin/expenses",
        icon: Receipt,
      },
      {
        label: "Reports",
        href: "/admin/reports",
        icon: BarChart3,
      },
      {
        label: "Documents",
        href: "/admin/documents",
        icon: FileText,
      },
      {
        label: "Task Tracker",
        href: "/admin/tasks",
        icon: CheckSquare,
      },
    ],
  },
  {
    title: "System",
    items: [
      {
        label: "Settings",
        href: "/admin/settings",
        icon: Settings,
      },
    ],
  },
];

// Shared navigation content component
function NavContent({ onItemClick }: { onItemClick?: () => void }) {
  const pathname = usePathname();

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
            {section.items.map(({ label, href, icon: Icon, exact }) => {
              const active =
                exact
                  ? pathname === href
                  : pathname === href || pathname.startsWith(href + "/");
              return (
                <ActiveLink
                  key={href}
                  href={href}
                  exact={exact}
                  onClick={onItemClick}
                  className={cn(
                    premiumSideItem,
                    active && premiumSideItemActive
                  )}
                  activeClassName="nav-active"
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{label}</span>
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
    const styleId = 'sidebar-scrollbar-hide';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
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
        <SchoolBrand size="md" showName href="/admin" />
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
          <SheetTitle className="sr-only">School Admin Navigation Menu</SheetTitle>
          <div className="flex items-center justify-between">
            <SchoolBrand size="md" showName href="/admin" />
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
export function MobileMenuButton({
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
export default function SchoolAdminSidebar() {
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
        <MobileMenuButton onClick={() => setMobileMenuOpen(true)} />
      </div>

      {/* Desktop Sidebar */}
      <DesktopSidebar />

      {/* Mobile Sidebar */}
      <MobileSidebar open={mobileMenuOpen} onOpenChange={setMobileMenuOpen} />
    </>
  );
}
