"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Search, BookOpen, ChevronRight, Home } from "lucide-react";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
    icon: <BookOpen className="h-4 w-4" />,
    sections: [
      {
        title: "Managing Students",
        slug: "managing-students",
        path: "students/managing-students.md",
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
    icon: <BookOpen className="h-4 w-4" />,
    sections: [
      {
        title: "Managing Teachers",
        slug: "managing-teachers",
        path: "teachers/managing-teachers.md",
      },
    ],
  },
  {
    title: "Class Groups",
    icon: <BookOpen className="h-4 w-4" />,
    sections: [
      {
        title: "Managing Class Groups",
        slug: "managing-class-groups",
        path: "class-groups/managing-class-groups.md",
      },
    ],
  },
  {
    title: "Academic Periods",
    icon: <BookOpen className="h-4 w-4" />,
    sections: [
      {
        title: "Managing Periods",
        slug: "managing-periods",
        path: "academic-periods/managing-periods.md",
      },
    ],
  },
];

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

  // Find current doc path
  const currentDoc = React.useMemo(() => {
    for (const category of DOC_CATEGORIES) {
      const section = category.sections.find((s) => s.slug === selectedSlug);
      if (section) {
        return { ...section, category: category.title.toLowerCase().replace(/\s+/g, "-") };
      }
    }
    return null;
  }, [selectedSlug]);

  // Load markdown content
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
        setContent("# Content Not Found\n\nThe requested documentation page could not be loaded.");
        setLoading(false);
      });
  }, [currentDoc]);

  // Filter categories and sections based on search
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

  // Extract headings for table of contents
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

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? "280px" : "0px" }}
        className="border-r border-white/10 bg-card/50 backdrop-blur-sm overflow-hidden flex-shrink-0"
      >
        <div className="h-full flex flex-col">
          {/* Search */}
          <div className="p-4 border-b border-white/10">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <Input
                type="text"
                placeholder="Search docs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/40"
              />
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
            {filteredCategories.map((category) => (
              <div key={category.title} className="space-y-2">
                <div className="flex items-center gap-2 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-white/60">
                  {category.icon}
                  <span>{category.title}</span>
                </div>
                <div className="space-y-1">
                  {category.sections.map((section) => {
                    const isActive =
                      selectedCategory ===
                        category.title.toLowerCase().replace(/\s+/g, "-") &&
                      selectedSlug === section.slug;
                    return (
                      <button
                        key={section.slug}
                        onClick={() => {
                          setSelectedCategory(
                            category.title.toLowerCase().replace(/\s+/g, "-")
                          );
                          setSelectedSlug(section.slug);
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                          isActive
                            ? "bg-brand/20 text-brand border border-brand/30"
                            : "text-white/70 hover:bg-white/5 hover:text-white/90"
                        }`}
                      >
                        <ChevronRight
                          className={`h-4 w-4 transition-transform ${
                            isActive ? "rotate-90" : ""
                          }`}
                        />
                        {section.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-white/10 bg-card/50 backdrop-blur-sm p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              <BookOpen className="h-5 w-5 text-white/60" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-white">
                {currentDoc?.title || "Documentation"}
              </h1>
              <p className="text-xs text-white/50">
                {DOC_CATEGORIES.find(
                  (c) =>
                    c.title.toLowerCase().replace(/\s+/g, "-") === selectedCategory
                )?.title || "Getting Started"}
              </p>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="max-w-4xl mx-auto p-8">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-white/50">Loading content...</div>
              </div>
            ) : (
              <article className="prose prose-invert max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ children }) => (
                      <h1 className="text-3xl font-bold text-white mb-6 mt-8 first:mt-0 border-b border-white/10 pb-3">
                        {children}
                      </h1>
                    ),
                    h2: ({ children }) => (
                      <h2
                        id={String(children)
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, "-")
                          .replace(/^-|-$/g, "")}
                        className="text-2xl font-semibold text-white mb-4 mt-8 scroll-mt-20"
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
                        className="text-xl font-semibold text-white/90 mb-3 mt-6 scroll-mt-20"
                      >
                        {children}
                      </h3>
                    ),
                    p: ({ children }) => (
                      <p className="text-white/80 mb-4 leading-relaxed">{children}</p>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc list-inside text-white/80 mb-4 space-y-2 ml-4">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal list-inside text-white/80 mb-4 space-y-2 ml-4">
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => (
                      <li className="text-white/80">{children}</li>
                    ),
                    code: ({ children, className }) => {
                      const isInline = !className;
                      return isInline ? (
                        <code className="px-1.5 py-0.5 rounded bg-white/10 text-brand text-sm font-mono">
                          {children}
                        </code>
                      ) : (
                        <code className="block p-4 rounded-lg bg-white/5 border border-white/10 text-white/90 font-mono text-sm overflow-x-auto mb-4">
                          {children}
                        </code>
                      );
                    },
                    strong: ({ children }) => (
                      <strong className="font-semibold text-white">{children}</strong>
                    ),
                    em: ({ children }) => (
                      <em className="italic text-white/90">{children}</em>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-4 border-brand/50 pl-4 py-2 my-4 bg-white/5 rounded-r-lg">
                        {children}
                      </blockquote>
                    ),
                    a: ({ href, children }) => (
                      <a
                        href={href}
                        className="text-brand hover:text-brand/80 underline"
                        target={href?.startsWith("http") ? "_blank" : undefined}
                        rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
                      >
                        {children}
                      </a>
                    ),
                    table: ({ children }) => (
                      <div className="overflow-x-auto my-6">
                        <table className="min-w-full border border-white/10 rounded-lg">
                          {children}
                        </table>
                      </div>
                    ),
                    thead: ({ children }) => (
                      <thead className="bg-white/5">{children}</thead>
                    ),
                    tbody: ({ children }) => <tbody>{children}</tbody>,
                    tr: ({ children }) => (
                      <tr className="border-b border-white/10">{children}</tr>
                    ),
                    th: ({ children }) => (
                      <th className="px-4 py-3 text-left text-sm font-semibold text-white">
                        {children}
                      </th>
                    ),
                    td: ({ children }) => (
                      <td className="px-4 py-3 text-sm text-white/80">{children}</td>
                    ),
                  }}
                >
                  {content}
                </ReactMarkdown>
              </article>
            )}
          </div>
        </div>

        {/* Table of Contents (Optional - can be added later) */}
        {headings.length > 0 && (
          <div className="border-t border-white/10 bg-card/50 backdrop-blur-sm p-4">
            <div className="max-w-4xl mx-auto">
              <div className="text-xs font-semibold uppercase tracking-wider text-white/60 mb-2">
                On This Page
              </div>
              <div className="flex flex-wrap gap-2">
                {headings.map((heading, idx) => (
                  <a
                    key={idx}
                    href={`#${heading.id}`}
                    className="text-xs text-brand hover:text-brand/80 hover:underline"
                  >
                    {heading.text}
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
