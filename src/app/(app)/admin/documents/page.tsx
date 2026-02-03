// src/app/(app)/admin/documents/page.tsx
import { ComingSoonState } from "@/components/ui/coming-soon-state";

export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Documents</h1>
        <p className="text-muted">Manage school documents and files</p>
      </div>
      <ComingSoonState
        feature="Document management"
        description="Upload, organize, and share school documents from this page."
      />
    </div>
  );
}
