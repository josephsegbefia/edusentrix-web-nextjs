import PlatformAuditExplorer from "@/components/platform/audit/PlatformAuditExplorer";

export const dynamic = "force-dynamic";

export default function PlatformAuditPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold">Audit logs</h1>
        <p className="text-muted-foreground text-sm mt-2">
          Normalized audit events across platform and school scopes (read-only).
        </p>
      </div>
      <PlatformAuditExplorer />
    </div>
  );
}
