"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckSquare, AlertCircle, Clock, BookOpen } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function TasksPage() {
  const [content, setContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadTasks() {
      try {
        const res = await fetch("/api/docs/tasks/deferred-tasks.md");
        if (res.ok) {
          const text = await res.text();
          setContent(text);
        } else {
          setContent("# Deferred Tasks\n\nFailed to load tasks. Please check the file.");
        }
      } catch (error) {
        console.error("Failed to load tasks:", error);
        setContent("# Deferred Tasks\n\nFailed to load tasks.");
      } finally {
        setIsLoading(false);
      }
    }
    loadTasks();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Task Tracker</h1>
          <p className="text-muted">Loading tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Task Tracker</h1>
          <p className="text-muted">
            Track deferred tasks and mark them complete as you finish them
          </p>
        </div>
      </div>

      {/* Tasks Content */}
      <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-indigo-500/15 via-indigo-500/5 to-transparent"
          aria-hidden="true"
        />
        <CardHeader className="relative z-10">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-500/20 border border-indigo-500/30">
              <CheckSquare className="h-4 w-4 text-indigo-300" />
            </div>
            Deferred Tasks
          </CardTitle>
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="prose prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => (
                  <h1 className="text-2xl font-bold text-white mb-4 mt-6 first:mt-0">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-xl font-semibold text-white mb-3 mt-6 first:mt-0 border-b border-white/10 pb-2">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-lg font-semibold text-white/90 mb-2 mt-4">
                    {children}
                  </h3>
                ),
                h4: ({ children }) => (
                  <h4 className="text-base font-semibold text-white/80 mb-2 mt-3">
                    {children}
                  </h4>
                ),
                p: ({ children }) => (
                  <p className="text-white/70 mb-4 leading-relaxed">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc list-inside text-white/70 mb-4 space-y-2 ml-4">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-inside text-white/70 mb-4 space-y-2 ml-4">
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li className="mb-1">{children}</li>
                ),
                code: ({ children, className }) => {
                  const isInline = !className;
                  return isInline ? (
                    <code className="px-1.5 py-0.5 rounded bg-white/10 text-emerald-300 text-sm font-mono">
                      {children}
                    </code>
                  ) : (
                    <code className="block p-4 rounded-lg bg-black/30 border border-white/10 text-white/90 text-sm font-mono overflow-x-auto mb-4">
                      {children}
                    </code>
                  );
                },
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-brand/50 pl-4 italic text-white/60 mb-4">
                    {children}
                  </blockquote>
                ),
                hr: () => (
                  <hr className="border-white/10 my-6" />
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold text-white">{children}</strong>
                ),
                em: ({ children }) => (
                  <em className="italic text-white/80">{children}</em>
                ),
                a: ({ href, children }) => (
                  <a
                    href={href}
                    className="text-brand hover:text-brand/80 underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {children}
                  </a>
                ),
                table: ({ children }) => (
                  <div className="overflow-x-auto mb-4">
                    <table className="min-w-full border-collapse border border-white/10">
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
                  <th className="px-4 py-2 text-left text-white font-semibold border border-white/10">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="px-4 py-2 text-white/70 border border-white/10">
                    {children}
                  </td>
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        </CardContent>
      </Card>

      {/* Edit Note */}
      <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-amber-500/15 via-amber-500/5 to-transparent"
          aria-hidden="true"
        />
        <CardContent className="relative z-10 p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20 border border-amber-500/30">
              <BookOpen className="h-4 w-4 text-amber-300" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-white/90 font-medium mb-1">
                How to Update Tasks
              </p>
              <p className="text-xs text-white/60">
                Edit the markdown file at{" "}
                <code className="px-1.5 py-0.5 rounded bg-white/10 text-emerald-300 text-xs font-mono">
                  content/tasks/deferred-tasks.md
                </code>{" "}
                to update task status, add new tasks, or mark them as complete. Changes will be
                reflected immediately.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
