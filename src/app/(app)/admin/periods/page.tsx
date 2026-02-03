// src/app/(app)/admin/periods/page.tsx
import { ComingSoonState } from "@/components/ui/coming-soon-state";

export default function PeriodsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Academic Periods</h1>
        <p className="text-muted">Manage terms and academic years</p>
      </div>
      <ComingSoonState
        feature="Academic period management"
        description="You will be able to create terms, set current periods, and manage academic years here."
      />
    </div>
  );
}
