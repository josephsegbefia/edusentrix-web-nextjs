// src/app/demo/(app)/admin/subjects/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Loader2, Eye } from "lucide-react";

interface Subject {
  _id: string;
  name: string;
  code?: string;
  description?: string;
  category?: string;
  status: string;
}

export default function DemoSubjectsPage() {
  const [subjects, setSubjects] = React.useState<Subject[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/demo/subjects");
        if (res.ok) {
          const data = await res.json();
          setSubjects(data.data || []);
        }
      } catch (error) {
        console.error("Failed to fetch subjects:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Group by category
  const grouped = React.useMemo(() => {
    const groups: Record<string, Subject[]> = {};
    subjects.forEach((s) => {
      const cat = s.category || "Uncategorized";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(s);
    });
    return groups;
  }, [subjects]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <Link
            href="/demo/admin"
            className="text-white/60 hover:text-white transition-colors text-sm mb-2 block"
          >
            ← Dashboard
          </Link>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-cyan-400" />
            Subjects
            <Badge variant="outline" className="border-amber-500/50 text-amber-400">
              DEMO
            </Badge>
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage curriculum subjects
          </p>
        </div>
        <Button disabled>Add Subject</Button>
      </div>

      {/* Demo Notice */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-3">
          <p className="text-sm text-amber-200/80">
            <Eye className="h-4 w-4 inline mr-2" />
            Viewing demo data. Create/edit operations are disabled.
          </p>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-white/60">
        <span>{subjects.length} subjects total</span>
        <span>•</span>
        <span>{Object.keys(grouped).length} categories</span>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-white/40" />
        </div>
      ) : subjects.length === 0 ? (
        <Card className="border-white/10 bg-white/5">
          <CardContent className="py-12 text-center">
            <BookOpen className="h-12 w-12 mx-auto mb-4 text-white/20" />
            <h3 className="text-lg font-semibold mb-2">No subjects found</h3>
            <p className="text-white/60">No demo subjects available</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, categorySubjects]) => (
            <div key={category}>
              <h2 className="text-lg font-semibold mb-3 text-white/80">{category}</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {categorySubjects.map((subject) => (
                  <div
                    key={subject._id}
                    className="rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition-all"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="p-2 rounded-lg bg-cyan-500/20 border border-cyan-500/30">
                        <BookOpen className="h-4 w-4 text-cyan-300" />
                      </div>
                      <Badge variant="outline" className="capitalize text-xs">
                        {subject.status}
                      </Badge>
                    </div>
                    <h3 className="font-medium text-white mb-1">{subject.name}</h3>
                    {subject.code && (
                      <div className="text-xs text-white/50 font-mono">{subject.code}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
