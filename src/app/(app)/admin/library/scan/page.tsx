"use client";

import * as React from "react";
import { WorkspaceScope } from "@/components/theme/workspace-scope";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ScanLine, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  LibraryBackLink,
  libraryGlassPanel,
  LibraryPageHeader,
  LibraryPageShell,
} from "@/components/admin/library/LibraryAdminChrome";
import { useLibraryCapabilitiesQuery } from "@/hooks/admin/useLibraryAdmin";
import { LibraryScanCameraPane } from "@/components/admin/library/LibraryScanCameraPane";

export default function AdminLibraryScanPage() {
  const router = useRouter();
  const { data: capsRes } = useLibraryCapabilitiesQuery();
  const canRead = capsRes?.data?.loansRead ?? false;
  const [code, setCode] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [lastTitle, setLastTitle] = React.useState<string | null>(null);
  const [lastBookId, setLastBookId] = React.useState<string | null>(null);
  const [lastCopyId, setLastCopyId] = React.useState<string | null>(null);
  const [copyStatus, setCopyStatus] = React.useState<string | null>(null);

  const runLookup = React.useCallback(async (rawFromInput?: string) => {
    const raw = (rawFromInput ?? code).trim();
    if (!raw) {
      toast.error("Scan, paste, or type a copy identifier");
      return;
    }
    setLoading(true);
    setLastTitle(null);
    setLastBookId(null);
    setLastCopyId(null);
    setCopyStatus(null);
    try {
      const res = await fetch(
        `/api/admin/library/copies/lookup?code=${encodeURIComponent(raw)}`,
        { cache: "no-store" }
      );
      const json = (await res.json()) as {
        success?: boolean;
        error?: { message?: string };
        data?: {
          copy?: { id: string; bookId: string; status: string };
          book?: { id: string; title: string };
        };
      };
      if (!res.ok) throw new Error(json?.error?.message || "Lookup failed");
      const copy = json.data?.copy;
      const book = json.data?.book;
      if (!copy || !book) throw new Error("Invalid response");
      setLastTitle(book.title);
      setLastBookId(book.id);
      setLastCopyId(copy.id);
      setCopyStatus(copy.status);
      setCode("");
      toast.success(`Found ${book.title}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  }, [code]);

  return (
    <WorkspaceScope>
      <LibraryPageShell>
      <LibraryBackLink href="/admin/library" label="Library home" />
      <LibraryPageHeader
        icon={ScanLine}
        title="Scan & lookup"
        description="Wedge scanner, typed code, paste, or device camera (BarcodeDetector). Then open circulation to issue or return."
      />

      {!canRead ? (
        <p className="rounded-2xl border border-(--ws-line) bg-(--ws-fill) px-4 py-3 text-sm text-(--ws-fg-70)">
          Your role does not include reading library loans.
        </p>
      ) : null}

      {canRead ? (
        <section className={`${libraryGlassPanel} space-y-4 p-5`}>
          <div className="space-y-2">
            <Label className="text-(--ws-fg-80)">Identifier</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void runLookup();
              }}
              placeholder="Copy code · barcode · EDU:…"
              className="border-(--ws-line-strong) bg-(--ws-fill) text-(--ws-fg)"
              autoComplete="off"
              autoFocus
            />
          </div>
          <Button
            type="button"
            className="bg-linear-to-r from-teal-500 to-cyan-600 text-(--ws-fg) shadow-lg shadow-teal-500/25"
            disabled={loading}
            onClick={() => void runLookup()}
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Lookup
          </Button>

          <LibraryScanCameraPane disabled={loading} onDetected={(v) => void runLookup(v)} />

          {lastTitle && lastBookId && lastCopyId ? (
            <div className="rounded-xl border border-(--ws-line) bg-(--ws-fill) p-4 text-sm text-(--ws-fg-80)">
              <p className="font-medium text-(--ws-fg)">{lastTitle}</p>
              {copyStatus ? (
                <p className="mt-1 text-xs text-(--ws-fg-50)">
                  Copy status: <span className="text-(--ws-fg-80)">{copyStatus}</span>
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="bg-(--ws-fill-strong) text-(--ws-fg)"
                  onClick={() =>
                    router.push(
                      `/admin/library/circulation?bookId=${encodeURIComponent(lastBookId)}&copyId=${encodeURIComponent(lastCopyId)}`
                    )
                  }
                >
                  Open circulation
                </Button>
                <Button type="button" size="sm" variant="outline" className="border-(--ws-line-strong) text-(--ws-fg)" asChild>
                  <Link href={`/admin/library/books/${lastBookId}`}>Book detail</Link>
                </Button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </LibraryPageShell>
    </WorkspaceScope>
  );
}
