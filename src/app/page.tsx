// src/app/page.tsx
"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";

export default function Home() {
  return (
    <main className="p-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <Card className="bg-card border-0 shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl">EduSentrix</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted">
              Fresh Next.js setup with Tailwind v4, shadcn, React Query, and a
              lightweight Auth Provider.
            </p>
            <Button className="bg-primary hover:opacity-90">
              Primary Action
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </main>
  );
}
