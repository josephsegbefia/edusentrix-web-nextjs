"use client";

import Link from "next/link";
import { BookOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TeacherResourcesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Resources</h1>
          <p className="text-sm text-white/60">Save lesson links and reusable materials.</p>
        </div>
        <Button className="bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/30">
          <Plus className="h-4 w-4" />
          Add resource
        </Button>
      </div>

      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg">Resource library</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-white/60">
          <div className="flex items-center gap-2 text-white/70">
            <BookOpen className="h-4 w-4" />
            Resource management will be available soon.
          </div>
          <p>
            For now, you can attach resources directly to assignments from the
            <Link href="/teacher/studio/assignments" className="ml-1 text-indigo-200 hover:text-indigo-100">
              assignments
            </Link>
            page.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
