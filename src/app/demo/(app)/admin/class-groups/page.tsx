// src/app/demo/(app)/admin/class-groups/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { School, Users, Loader2, Eye, UserCheck } from "lucide-react";

interface ClassGroup {
  _id: string;
  name: string;
  gradeLabel?: string;
  description?: string;
  capacity?: number;
  studentCount: number;
  homeroomTeacher?: string;
  status: string;
}

export default function DemoClassGroupsPage() {
  const [classGroups, setClassGroups] = React.useState<ClassGroup[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/demo/class-groups");
        if (res.ok) {
          const data = await res.json();
          setClassGroups(data.data || []);
        }
      } catch (error) {
        console.error("Failed to fetch class groups:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

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
            <School className="h-8 w-8 text-emerald-400" />
            Class Groups
            <Badge variant="outline" className="border-amber-500/50 text-amber-400">
              DEMO
            </Badge>
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage class groups and student assignments
          </p>
        </div>
        <Button disabled>Create Class</Button>
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

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-white/40" />
        </div>
      ) : classGroups.length === 0 ? (
        <Card className="border-white/10 bg-white/5">
          <CardContent className="py-12 text-center">
            <School className="h-12 w-12 mx-auto mb-4 text-white/20" />
            <h3 className="text-lg font-semibold mb-2">No class groups found</h3>
            <p className="text-white/60">No demo class groups available</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {classGroups.map((cg) => (
            <div
              key={cg._id}
              className="relative overflow-hidden rounded-xl border border-white/10 bg-white/5 p-5 hover:bg-white/10 transition-all"
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-white text-lg">{cg.name}</h3>
                  {cg.gradeLabel && (
                    <span className="text-sm text-white/60">{cg.gradeLabel}</span>
                  )}
                </div>
                <Badge variant="outline" className="capitalize">
                  {cg.status}
                </Badge>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-white/70">
                  <Users className="h-4 w-4" />
                  <span>{cg.studentCount} students</span>
                  {cg.capacity && (
                    <span className="text-white/50">/ {cg.capacity} capacity</span>
                  )}
                </div>
                {cg.homeroomTeacher && (
                  <div className="flex items-center gap-2 text-sm text-white/70">
                    <UserCheck className="h-4 w-4" />
                    <span>Homeroom: {cg.homeroomTeacher}</span>
                  </div>
                )}
              </div>

              {cg.description && (
                <p className="text-xs text-white/50 line-clamp-2">{cg.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
