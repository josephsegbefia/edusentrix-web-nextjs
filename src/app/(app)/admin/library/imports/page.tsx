"use client";

import * as React from "react";
import { WorkspaceScope } from "@/components/theme/workspace-scope";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  LibraryBackLink,
  libraryGlassPanel,
  LibraryPageHeader,
  LibraryPageShell,
} from "@/components/admin/library/LibraryAdminChrome";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { TERMINAL_LIBRARY_IMPORT_STATUSES } from "@/lib/library/library-import.shared";
import {
  useLibraryCapabilitiesQuery,
  useLibraryImportJobQuery,
  useLibraryImportMutation,
} from "@/hooks/admin/useLibraryAdmin";
import type { ILibraryImportJob } from "@/models/LibraryImportJob";

export default function AdminLibraryImportsPage() {
  const { data: capsRes } = useLibraryCapabilitiesQuery();
  const caps = capsRes?.data;
  const canImport = caps?.booksCreate ?? false;

  const importMutation = useLibraryImportMutation();
  const [pollingJobId, setPollingJobId] = React.useState<string | null>(null);
  const jobQuery = useLibraryImportJobQuery(pollingJobId);
  const importFinishedKeyRef = React.useRef<string | null>(null);

  const [fileName, setFileName] = React.useState("library-import.csv");
  const [importType, setImportType] = React.useState<"books" | "copies" | "books_and_copies">(
    "books"
  );
  const [csvText, setCsvText] = React.useState("");
  const [lastSummary, setLastSummary] = React.useState<Record<string, unknown> | null>(null);

  const liveJob = jobQuery.data?.data;
  const showLiveProgress =
    Boolean(pollingJobId) &&
    liveJob &&
    !TERMINAL_LIBRARY_IMPORT_STATUSES.has(liveJob.status as ILibraryImportJob["status"]);
  const displaySummary = showLiveProgress ? liveJob : lastSummary;

  React.useEffect(() => {
    if (!pollingJobId) return;
    const d = jobQuery.data?.data;
    if (!d?.status) return;
    if (!TERMINAL_LIBRARY_IMPORT_STATUSES.has(d.status as ILibraryImportJob["status"])) return;
    const key = `${pollingJobId}:${d.status}:${String(d.updatedAt ?? "")}`;
    if (importFinishedKeyRef.current === key) return;
    importFinishedKeyRef.current = key;
    setLastSummary(d as Record<string, unknown>);
    setPollingJobId(null);
    toast.success("Import finished — see summary below");
  }, [pollingJobId, jobQuery.data?.data]);

  const importBusy = importMutation.isPending || Boolean(pollingJobId);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!csvText.trim()) {
      toast.error("Paste CSV content");
      return;
    }
    try {
      importFinishedKeyRef.current = null;
      const res = await importMutation.mutateAsync({
        type: importType,
        fileName: fileName.trim() || "import.csv",
        csvText,
      });
      setLastSummary(null);
      setPollingJobId(res.jobId);
      toast.message("Import queued — processing in the background");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    }
  }

  return (
    <WorkspaceScope>
      <LibraryPageShell>
      <LibraryBackLink href="/admin/library" label="Library home" />
      <LibraryPageHeader
        icon={Upload}
        title="CSV import"
        description="Books, copies, or combined rows. Row-level errors are captured; good rows still commit."
      />

      {!canImport ? (
        <p className="rounded-2xl border border-(--ws-line) bg-(--ws-fill) px-4 py-3 text-sm text-(--ws-fg-70)">
          You need catalogue create permission to run imports.
        </p>
      ) : null}

      {canImport ? (
        <form onSubmit={onSubmit} className={`${libraryGlassPanel} space-y-4 p-5`}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-(--ws-fg-80)">Import type</Label>
              <PremiumSelect
                value={importType}
                onValueChange={(v) =>
                  setImportType(v as "books" | "copies" | "books_and_copies")
                }
              >
                <PremiumSelectTrigger className="border-(--ws-line-strong) bg-(--ws-fill) text-(--ws-fg)">
                  <PremiumSelectValue />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  <PremiumSelectItem value="books">Books only</PremiumSelectItem>
                  <PremiumSelectItem value="copies">Copies only</PremiumSelectItem>
                  <PremiumSelectItem value="books_and_copies">Book + copy per row</PremiumSelectItem>
                </PremiumSelectContent>
              </PremiumSelect>
            </div>
            <div className="space-y-2">
              <Label className="text-(--ws-fg-80)">File name (label)</Label>
              <Input
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className="border-(--ws-line-strong) bg-(--ws-fill) text-(--ws-fg)"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-(--ws-fg-80)">CSV contents</Label>
            <Textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              className="min-h-[220px] border-(--ws-line-strong) bg-(--ws-fill) font-mono text-sm text-(--ws-fg)"
              placeholder={`Example books header:\ntitle,author,isbn,initialCopies,tags`}
            />
          </div>
          <Button type="submit" disabled={importBusy}>
            {importBusy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {importMutation.isPending ? "Starting…" : "Processing…"}
              </>
            ) : (
              "Run import"
            )}
          </Button>

          {displaySummary ? (
            <div className="rounded-xl border border-(--ws-line) bg-(--ws-fill) p-4 text-sm text-(--ws-fg-80)">
              <p>
                Status: <strong className="text-(--ws-fg)">{String(displaySummary.status)}</strong>
              </p>
              <p>Total rows: {String(displaySummary.totalRows ?? "—")}</p>
              <p>Successful: {String(displaySummary.successfulRows ?? "—")}</p>
              <p>Failed: {String(displaySummary.failedRows ?? "—")}</p>
              {Array.isArray(displaySummary.errors) && displaySummary.errors.length > 0 ? (
                <div className="mt-3 max-h-48 overflow-y-auto text-xs text-(--ws-amber)">
                  {(displaySummary.errors as { rowNumber?: number; message?: string }[])
                    .slice(0, 20)
                    .map((err, i) => (
                      <div key={i}>
                        Row {err.rowNumber}: {err.message}
                      </div>
                    ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </form>
      ) : null}
    </LibraryPageShell>
    </WorkspaceScope>
  );
}
