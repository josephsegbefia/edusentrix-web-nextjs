"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Search,
  BookOpen,
  ChevronRight,
  Home,
  DollarSign,
  Users,
  GraduationCap,
  Calendar,
  BarChart3,
  Clock,
  MessageSquare,
  Wallet,
  Receipt,
  HeartHandshake,
  UserCircle,
  Backpack,
  Library,
  ClipboardCheck,
  FileText,
  Route,
  Video,
  ShieldCheck,
  Settings,
  Package,
  ShoppingBag,
  Sparkles,
  Bell,
  Target,
  PanelLeftClose,
  PanelLeftOpen,
  Presentation,
  UserPlus,
  ArrowUpDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

type DocSection = {
  title: string;
  slug: string;
  path: string;
};

type DocCategory = {
  title: string;
  icon?: React.ReactNode;
  sections: DocSection[];
};

const DOC_CATEGORIES: DocCategory[] = [
  {
    title: "Getting Started",
    icon: <Home className="h-4 w-4" />,
    sections: [
      { title: "Welcome", slug: "welcome", path: "getting-started/welcome.md" },
      {
        title: "Initial Setup",
        slug: "initial-setup",
        path: "getting-started/initial-setup.md",
      },
    ],
  },
  {
    title: "Students",
    icon: <Users className="h-4 w-4" />,
    sections: [
      {
        title: "Managing Students",
        slug: "managing-students",
        path: "students/managing-students.md",
      },
      {
        title: "Academics & Gradebook",
        slug: "academics-gradebook",
        path: "students/academics-gradebook.md",
      },
      {
        title: "Managing Guardians",
        slug: "managing-guardians",
        path: "students/managing-guardians.md",
      },
    ],
  },
  {
    title: "Teachers",
    icon: <GraduationCap className="h-4 w-4" />,
    sections: [
      {
        title: "Managing Teachers",
        slug: "managing-teachers",
        path: "teachers/managing-teachers.md",
      },
      {
        title: "Teacher Assignments",
        slug: "teacher-assignments",
        path: "teachers/teacher-assignments.md",
      },
    ],
  },
  {
    title: "Teacher Portal",
    icon: <BookOpen className="h-4 w-4" />,
    sections: [
      {
        title: "Lesson Notes Builder",
        slug: "lesson-notes",
        path: "teacher-portal/lesson-notes.md",
      },
      {
        title: "Teacher Studio",
        slug: "teacher-studio",
        path: "teacher-portal/teacher-studio.md",
      },
      {
        title: "Gradebook & Attendance",
        slug: "teacher-gradebook-attendance",
        path: "teacher-portal/gradebook-attendance.md",
      },
      {
        title: "Communication",
        slug: "teacher-communication",
        path: "teacher-portal/communication.md",
      },
    ],
  },
  {
    title: "Lessons",
    icon: <Presentation className="h-4 w-4" />,
    sections: [
      {
        title: "Lessons Overview",
        slug: "lessons-overview",
        path: "lessons/lessons-overview.md",
      },
    ],
  },
  {
    title: "Schemes of Work",
    icon: <Route className="h-4 w-4" />,
    sections: [
      {
        title: "Managing Schemes",
        slug: "managing-schemes",
        path: "schemes/managing-schemes.md",
      },
    ],
  },
  {
    title: "Curricula",
    icon: <Target className="h-4 w-4" />,
    sections: [
      {
        title: "Curricula Overview",
        slug: "curricula-overview",
        path: "curricula/curricula-overview.md",
      },
    ],
  },
  {
    title: "Examinations",
    icon: <ClipboardCheck className="h-4 w-4" />,
    sections: [
      {
        title: "Examinations & Question Bank",
        slug: "examinations-overview",
        path: "examinations/examinations-overview.md",
      },
    ],
  },
  {
    title: "Library",
    icon: <Library className="h-4 w-4" />,
    sections: [
      {
        title: "Library Overview",
        slug: "library-overview",
        path: "library/library-overview.md",
      },
    ],
  },
  {
    title: "Parent Portal",
    icon: <UserCircle className="h-4 w-4" />,
    sections: [
      {
        title: "Parent Portal Overview",
        slug: "parent-portal-overview",
        path: "parent-portal/overview.md",
      },
    ],
  },
  {
    title: "Student Portal",
    icon: <Backpack className="h-4 w-4" />,
    sections: [
      {
        title: "Student Portal Overview",
        slug: "student-portal-overview",
        path: "student-portal/overview.md",
      },
    ],
  },
  {
    title: "Class Groups",
    icon: <Users className="h-4 w-4" />,
    sections: [
      {
        title: "Managing Class Groups",
        slug: "managing-class-groups",
        path: "class-groups/managing-class-groups.md",
      },
    ],
  },
  {
    title: "Subjects",
    icon: <BookOpen className="h-4 w-4" />,
    sections: [
      {
        title: "Managing Subjects",
        slug: "managing-subjects",
        path: "subjects/managing-subjects.md",
      },
      {
        title: "Subject Offerings",
        slug: "subject-offerings",
        path: "subjects/subject-offerings.md",
      },
    ],
  },
  {
    title: "Academic Periods",
    icon: <Calendar className="h-4 w-4" />,
    sections: [
      {
        title: "Managing Periods",
        slug: "managing-periods",
        path: "academic-periods/managing-periods.md",
      },
    ],
  },
  {
    title: "Academic Calendar",
    icon: <Calendar className="h-4 w-4" />,
    sections: [
      {
        title: "Calendar Overview",
        slug: "calendar-overview",
        path: "academic-calendar/calendar-overview.md",
      },
    ],
  },
  {
    title: "Admissions",
    icon: <UserPlus className="h-4 w-4" />,
    sections: [
      {
        title: "Admissions Overview",
        slug: "admissions-overview",
        path: "admissions/admissions-overview.md",
      },
    ],
  },
  {
    title: "Promotions",
    icon: <ArrowUpDown className="h-4 w-4" />,
    sections: [
      {
        title: "Student Promotions",
        slug: "promotions-overview",
        path: "promotions/promotions-overview.md",
      },
    ],
  },
  {
    title: "Fees & Payments",
    icon: <DollarSign className="h-4 w-4" />,
    sections: [
      {
        title: "Fees Dashboard",
        slug: "fees-dashboard",
        path: "fees/fees-dashboard.md",
      },
      {
        title: "Managing Fee Structures",
        slug: "managing-fee-structures",
        path: "fees/managing-fee-structures.md",
      },
      {
        title: "Creating Invoices",
        slug: "creating-invoices",
        path: "fees/creating-invoices.md",
      },
      {
        title: "Recording Payments",
        slug: "recording-payments",
        path: "fees/recording-payments.md",
      },
      {
        title: "Managing Student Credit",
        slug: "managing-student-credit",
        path: "fees/managing-student-credit.md",
      },
    ],
  },
  {
    title: "Financial Center",
    icon: <Wallet className="h-4 w-4" />,
    sections: [
      {
        title: "Financial Center",
        slug: "financial-center",
        path: "finance/financial-center.md",
      },
    ],
  },
  {
    title: "Expenses",
    icon: <Receipt className="h-4 w-4" />,
    sections: [
      {
        title: "Managing Expenses",
        slug: "managing-expenses",
        path: "expenses/managing-expenses.md",
      },
    ],
  },
  {
    title: "Community Hub",
    icon: <HeartHandshake className="h-4 w-4" />,
    sections: [
      {
        title: "Community Hub",
        slug: "community-hub",
        path: "community/community-hub.md",
      },
    ],
  },
  {
    title: "Timetable",
    icon: <Clock className="h-4 w-4" />,
    sections: [
      {
        title: "Master Timetable",
        slug: "master-timetable",
        path: "timetable/master-timetable.md",
      },
    ],
  },
  {
    title: "Meetings",
    icon: <Video className="h-4 w-4" />,
    sections: [
      {
        title: "Video Meetings",
        slug: "meetings-overview",
        path: "meetings/meetings-overview.md",
      },
    ],
  },
  {
    title: "Supply Programs",
    icon: <Package className="h-4 w-4" />,
    sections: [
      {
        title: "Supply Programs",
        slug: "supply-programs-overview",
        path: "supply-programs/supply-programs-overview.md",
      },
    ],
  },
  {
    title: "School Store",
    icon: <ShoppingBag className="h-4 w-4" />,
    sections: [
      {
        title: "School Store",
        slug: "store-overview",
        path: "store/store-overview.md",
      },
    ],
  },
  {
    title: "Staff Delegation",
    icon: <ShieldCheck className="h-4 w-4" />,
    sections: [
      {
        title: "Delegations Overview",
        slug: "delegations-overview",
        path: "delegations/delegations-overview.md",
      },
    ],
  },
  {
    title: "Leo AI Assistant",
    icon: <Sparkles className="h-4 w-4" />,
    sections: [
      {
        title: "Leo Overview",
        slug: "leo-overview",
        path: "leo/leo-overview.md",
      },
    ],
  },
  {
    title: "Notifications",
    icon: <Bell className="h-4 w-4" />,
    sections: [
      {
        title: "Notifications",
        slug: "notifications-overview",
        path: "notifications/notifications-overview.md",
      },
    ],
  },
  {
    title: "Settings",
    icon: <Settings className="h-4 w-4" />,
    sections: [
      {
        title: "School Settings",
        slug: "school-settings",
        path: "settings/school-settings.md",
      },
    ],
  },
  {
    title: "Reports & Analytics",
    icon: <BarChart3 className="h-4 w-4" />,
    sections: [
      {
        title: "Reports & Analytics",
        slug: "reports-analytics",
        path: "reports/reports-analytics.md",
      },
    ],
  },
  {
    title: "Invitations",
    icon: <MessageSquare className="h-4 w-4" />,
    sections: [
      {
        title: "Managing Invitations",
        slug: "managing-invitations",
        path: "invitations/managing-invitations.md",
      },
    ],
  },
];

const TOTAL_SECTIONS = DOC_CATEGORIES.reduce(
  (sum, cat) => sum + cat.sections.length,
  0
);

type Props = {
  initialSlug?: string;
  initialCategory?: string;
};

export function DocsViewer({ initialSlug, initialCategory }: Props) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState(
    initialCategory || "getting-started"
  );
  const [selectedSlug, setSelectedSlug] = React.useState(
    initialSlug || "welcome"
  );
  const [content, setContent] = React.useState<string>("");
  const [loading, setLoading] = React.useState(true);
  const [sidebarOpen, setSidebarOpen] = React.useState(true);

  const currentDoc = React.useMemo(() => {
    for (const category of DOC_CATEGORIES) {
      const section = category.sections.find((s) => s.slug === selectedSlug);
      if (section) {
        return {
          ...section,
          category: category.title.toLowerCase().replace(/\s+/g, "-"),
        };
      }
    }
    return null;
  }, [selectedSlug]);

  React.useEffect(() => {
    if (!currentDoc) return;

    setLoading(true);
    fetch(`/api/docs/${currentDoc.path}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load content");
        return res.text();
      })
      .then((text) => {
        setContent(text);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading doc:", err);
        setContent(
          "# Content Not Found\n\nThe requested documentation page could not be loaded."
        );
        setLoading(false);
      });
  }, [currentDoc]);

  const filteredCategories = React.useMemo(() => {
    if (!searchQuery.trim()) return DOC_CATEGORIES;

    const query = searchQuery.toLowerCase();
    return DOC_CATEGORIES.map((category) => ({
      ...category,
      sections: category.sections.filter(
        (section) =>
          section.title.toLowerCase().includes(query) ||
          category.title.toLowerCase().includes(query)
      ),
    })).filter((category) => category.sections.length > 0);
  }, [searchQuery]);

  const headings = React.useMemo(() => {
    if (!content) return [];
    const headingRegex = /^(#{1,3})\s+(.+)$/gm;
    const matches = Array.from(content.matchAll(headingRegex));
    return matches.map((match) => ({
      level: match[1].length,
      text: match[2],
      id: match[2]
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
    }));
  }, [content]);

  const glassPanel =
    "relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/35 backdrop-blur-xl";

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? "300px" : "0px" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="shrink-0 overflow-hidden"
      >
        <div
          className={cn(
            "flex h-full w-[300px] flex-col border-r border-white/10",
            "bg-linear-to-b from-slate-900/60 via-slate-950/80 to-black backdrop-blur-xl"
          )}
        >
          {/* Search */}
          <div className="border-b border-white/10 p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <Input
                type="text"
                placeholder="Search docs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:border-sky-400/40 focus:ring-sky-400/20"
              />
            </div>
            <p className="mt-2 text-[10px] uppercase tracking-widest text-white/30">
              {DOC_CATEGORIES.length} categories &middot; {TOTAL_SECTIONS}{" "}
              articles
            </p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
            {filteredCategories.map((category) => {
              const catKey = category.title
                .toLowerCase()
                .replace(/\s+/g, "-");
              const isActiveCategory = selectedCategory === catKey;
              return (
                <div key={category.title} className="space-y-1">
                  <div
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors",
                      isActiveCategory
                        ? "text-sky-200/90"
                        : "text-white/45"
                    )}
                  >
                    <span className="text-sky-300/60">{category.icon}</span>
                    <span>{category.title}</span>
                  </div>
                  <div className="space-y-0.5 pl-1">
                    {category.sections.map((section) => {
                      const isActive =
                        isActiveCategory &&
                        selectedSlug === section.slug;
                      return (
                        <button
                          key={section.slug}
                          onClick={() => {
                            setSelectedCategory(catKey);
                            setSelectedSlug(section.slug);
                          }}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all",
                            isActive
                              ? "border border-sky-400/25 bg-sky-500/15 text-sky-100 shadow-sm shadow-sky-950/20"
                              : "text-white/60 hover:bg-white/5 hover:text-white/90"
                          )}
                        >
                          <ChevronRight
                            className={cn(
                              "h-3 w-3 shrink-0 transition-transform",
                              isActive && "rotate-90 text-sky-300"
                            )}
                          />
                          <span className="truncate">{section.title}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Content Header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-white/4 px-5 py-3 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="rounded-lg p-2 text-white/50 transition-colors hover:bg-white/5 hover:text-white/80"
              aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            >
              {sidebarOpen ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeftOpen className="h-4 w-4" />
              )}
            </button>
            <div>
              <h2 className="text-base font-semibold text-white">
                {currentDoc?.title || "Documentation"}
              </h2>
              <p className="text-xs text-white/40">
                {DOC_CATEGORIES.find(
                  (c) =>
                    c.title.toLowerCase().replace(/\s+/g, "-") ===
                    selectedCategory
                )?.title || "Getting Started"}
              </p>
            </div>
          </div>

          {/* Table of Contents (inline, scrollable) */}
          {headings.length > 0 && (
            <div className="hidden items-center gap-2 lg:flex">
              <span className="text-[10px] uppercase tracking-widest text-white/30">
                On this page
              </span>
              <div className="flex max-w-md flex-wrap gap-x-3 gap-y-1">
                {headings
                  .filter((h) => h.level <= 2)
                  .slice(0, 8)
                  .map((heading, idx) => (
                    <a
                      key={idx}
                      href={`#${heading.id}`}
                      className="text-[11px] text-sky-300/60 transition-colors hover:text-sky-200 hover:underline"
                    >
                      {heading.text}
                    </a>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="mx-auto max-w-4xl px-6 py-8 md:px-10">
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-4 py-32">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-sky-400" />
                <p className="text-sm text-white/40">Loading article...</p>
              </div>
            ) : (
              <article
                className={cn(
                  glassPanel,
                  "p-6 md:p-10"
                )}
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ children }) => (
                      <h1 className="mb-6 mt-8 border-b border-white/10 pb-3 text-3xl font-bold text-white first:mt-0">
                        {children}
                      </h1>
                    ),
                    h2: ({ children }) => (
                      <h2
                        id={String(children)
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, "-")
                          .replace(/^-|-$/g, "")}
                        className="mb-4 mt-10 scroll-mt-20 text-2xl font-semibold text-white"
                      >
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3
                        id={String(children)
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, "-")
                          .replace(/^-|-$/g, "")}
                        className="mb-3 mt-6 scroll-mt-20 text-xl font-semibold text-white/90"
                      >
                        {children}
                      </h3>
                    ),
                    p: ({ children }) => (
                      <p className="mb-4 leading-relaxed text-white/75">
                        {children}
                      </p>
                    ),
                    ul: ({ children }) => (
                      <ul className="mb-4 ml-4 list-disc space-y-2 text-white/75 marker:text-sky-400/50">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="mb-4 ml-4 list-decimal space-y-2 text-white/75 marker:text-sky-400/50">
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => (
                      <li className="text-white/75 pl-1">{children}</li>
                    ),
                    code: ({ children, className }) => {
                      const isInline = !className;
                      return isInline ? (
                        <code className="rounded bg-sky-500/10 px-1.5 py-0.5 font-mono text-sm text-sky-200">
                          {children}
                        </code>
                      ) : (
                        <code className="mb-4 block overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-4 font-mono text-sm text-white/85 backdrop-blur-sm">
                          {children}
                        </code>
                      );
                    },
                    strong: ({ children }) => (
                      <strong className="font-semibold text-white">
                        {children}
                      </strong>
                    ),
                    em: ({ children }) => (
                      <em className="italic text-white/85">{children}</em>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className="my-4 rounded-r-xl border-l-4 border-sky-400/40 bg-sky-500/5 py-2 pl-4 backdrop-blur-sm">
                        {children}
                      </blockquote>
                    ),
                    a: ({ href, children }) => (
                      <a
                        href={href}
                        className="text-sky-300 underline decoration-sky-400/30 underline-offset-2 transition-colors hover:text-sky-200 hover:decoration-sky-400/60"
                        target={
                          href?.startsWith("http") ? "_blank" : undefined
                        }
                        rel={
                          href?.startsWith("http")
                            ? "noopener noreferrer"
                            : undefined
                        }
                      >
                        {children}
                      </a>
                    ),
                    table: ({ children }) => (
                      <div className="my-6 overflow-x-auto rounded-xl border border-white/10 backdrop-blur-sm">
                        <table className="min-w-full">{children}</table>
                      </div>
                    ),
                    thead: ({ children }) => (
                      <thead className="bg-white/5">{children}</thead>
                    ),
                    tbody: ({ children }) => <tbody>{children}</tbody>,
                    tr: ({ children }) => (
                      <tr className="border-b border-white/8 transition-colors hover:bg-white/4">
                        {children}
                      </tr>
                    ),
                    th: ({ children }) => (
                      <th className="px-4 py-3 text-left text-sm font-semibold text-white">
                        {children}
                      </th>
                    ),
                    td: ({ children }) => (
                      <td className="px-4 py-3 text-sm text-white/75">
                        {children}
                      </td>
                    ),
                  }}
                >
                  {content}
                </ReactMarkdown>
              </article>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
