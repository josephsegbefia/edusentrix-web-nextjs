"use client";

import { DocsViewer } from "@/components/docs/DocsViewer";
import { BookOpen } from "lucide-react";

export default function DocsPage() {
  return (
    <div className="h-screen flex flex-col">
      {/* Page Header */}
      <div className="border-b border-white/10 bg-card/50 backdrop-blur-sm p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-brand/20 border border-brand/30">
              <BookOpen className="h-5 w-5 text-brand" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Documentation</h1>
              <p className="text-sm text-white/60">
                Learn how to use EduSentrix effectively
              </p>
            </div>
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
