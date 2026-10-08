"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckSquare, AlertCircle, Clock, BookOpen } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { WorkspaceScope } from "@/components/theme/workspace-scope";

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
      <WorkspaceScope>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Task Tracker</h1>
          <p className="text-muted">Loading tasks...</p>
        </div>
      </div>
      </WorkspaceScope>
    );
  }

  return (
    <WorkspaceScope>
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
      <Card className="relative overflow-hidden border border-(--ws-line) bg-linear-to-br from-(--ws-panel-from) via-(--ws-panel-via) to-(--ws-panel-to) shadow-[var(--ws-shadow)] backdrop-blur-xl">
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-indigo-500/15 via-indigo-500/5 to-transparent"
          aria-hidden="true"
        />
        <CardHeader className="relative z-10">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-500/20 border border-indigo-500/30">
              <CheckSquare className="h-4 w-4 text-(--ws-violet)" />
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
                  <h1 className="text-2xl font-bold text-(--ws-fg) mb-4 mt-6 first:mt-0">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-xl font-semibold text-(--ws-fg) mb-3 mt-6 first:mt-0 border-b border-(--ws-line) pb-2">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-lg font-semibold text-(--ws-fg) mb-2 mt-4">
                    {children}
                  </h3>
                ),
                h4: ({ children }) => (
                  <h4 className="text-base font-semibold text-(--ws-fg-80) mb-2 mt-3">
                    {children}
                  </h4>
                ),
                p: ({ children }) => (
                  <p className="text-(--ws-fg-70) mb-4 leading-relaxed">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc list-inside text-(--ws-fg-70) mb-4 space-y-2 ml-4">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-inside text-(--ws-fg-70) mb-4 space-y-2 ml-4">
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li className="mb-1">{children}</li>
                ),
                code: ({ children, className }) => {
                  const isInline = !className;
                  return isInline ? (
                    <code className="px-1.5 py-0.5 rounded bg-(--ws-fill-strong) text-(--ws-emerald) text-sm font-mono">
                      {children}
                    </code>
                  ) : (
                    <code className="block p-4 rounded-lg bg-black/30 border border-(--ws-line) text-(--ws-fg) text-sm font-mono overflow-x-auto mb-4">
                      {children}
                    </code>
                  );
                },
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-brand/50 pl-4 italic text-(--ws-fg-60) mb-4">
                    {children}
                  </blockquote>
                ),
                hr: () => (
                  <hr className="border-(--ws-line) my-6" />
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold text-(--ws-fg)">{children}</strong>
                ),
                em: ({ children }) => (
                  <em className="italic text-(--ws-fg-80)">{children}</em>
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
                    <table className="min-w-full border-collapse border border-(--ws-line)">
                      {children}
                    </table>
                  </div>
                ),
                thead: ({ children }) => (
                  <thead className="bg-(--ws-fill)">{children}</thead>
                ),
                tbody: ({ children }) => <tbody>{children}</tbody>,
                tr: ({ children }) => (
                  <tr className="border-b border-(--ws-line)">{children}</tr>
                ),
                th: ({ children }) => (
                  <th className="px-4 py-2 text-left text-(--ws-fg) font-semibold border border-(--ws-line)">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="px-4 py-2 text-(--ws-fg-70) border border-(--ws-line)">
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
      <Card className="relative overflow-hidden border border-(--ws-line) bg-linear-to-br from-(--ws-panel-from) via-(--ws-panel-via) to-(--ws-panel-to) shadow-[var(--ws-shadow)] backdrop-blur-xl">
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
              <p className="text-sm text-(--ws-fg) font-medium mb-1">
                How to Update Tasks
              </p>
              <p className="text-xs text-(--ws-fg-60)">
                Edit the markdown file at{" "}
                <code className="px-1.5 py-0.5 rounded bg-(--ws-fill-strong) text-(--ws-emerald) text-xs font-mono">
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
    </WorkspaceScope>
  );
}
