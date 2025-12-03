// src/components/nav/sidebars/school-admin-sidebar.tsx
"use client";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import ActiveLink from "../active/ActiveLink";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  Calendar,
  DollarSign,
  FileText,
  BarChart3,
  Settings,
  School,
  UserCog,
  Mail,
  CheckSquare,
} from "lucide-react";
import {
  premiumSideItem,
  premiumSideItemActive,
} from "@/components/ui/premium";

const nav = [
  {
    label: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
    exact: true,
  },
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
    label: "Invitations",
    href: "/admin/invitations",
    icon: Mail,
  },
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
    label: "Academic Periods",
    href: "/admin/periods",
    icon: Calendar,
  },
  {
    label: "Fees & Payments",
    href: "/admin/fees",
    icon: DollarSign,
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
    label: "Settings",
    href: "/admin/settings",
    icon: Settings,
  },
  {
    label: "Task Tracker",
    href: "/admin/tasks",
    icon: CheckSquare,
  },
];

export default function SchoolAdminSidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:block fixed left-0 top-14 w-64 h-[calc(100vh-3.5rem)] shrink-0 border-r border-neutral-900 bg-card overflow-y-auto">
      <div className="p-3">
        <nav className="space-y-1">
          {nav.map(({ label, href, icon: Icon, exact }) => {
            const active =
              exact
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
