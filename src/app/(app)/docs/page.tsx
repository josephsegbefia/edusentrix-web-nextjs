"use client";

import { DocsViewer } from "@/components/docs/DocsViewer";
import { BookOpen, Sparkles, Search, FileText } from "lucide-react";

export default function DocsPage() {
  return (
    <div className="flex h-screen flex-col">
      {/* Hero Header */}
      <div className="relative overflow-hidden border-b border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black px-6 py-6 backdrop-blur-xl">
        <div className="pointer-events-none absolute -left-20 -top-20 h-60 w-60 rounded-full bg-sky-500/8 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 top-0 h-48 w-48 rounded-full bg-blue-600/8 blur-3xl" />

        <div className="relative mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-xl border border-sky-400/20 bg-sky-500/10 p-2.5 backdrop-blur-sm">
              <BookOpen className="h-5 w-5 text-sky-300" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-white">
                  Documentation & Help
                </h1>
                <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-sky-200/80">
                  Updated
                </span>
              </div>
              <p className="mt-0.5 text-sm text-white/50">
                Everything you need to master EduSentrix for your school
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            {[
              { icon: Search, label: "Search" },
              { icon: FileText, label: "30+ articles" },
              { icon: Sparkles, label: "AI-powered" },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-1.5 rounded-lg border border-white/8 bg-white/4 px-3 py-1.5 text-xs text-white/45 backdrop-blur-sm"
              >
                <item.icon className="h-3 w-3 text-sky-300/50" />
                {item.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Docs Viewer */}
      <div className="flex-1 overflow-hidden">
        <DocsViewer />
      </div>
    </div>
  );
}
