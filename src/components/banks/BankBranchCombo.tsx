// src/components/banks/BankBranchCombo.tsx
"use client";

import * as React from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { ChevronsUpDown, Check, Landmark, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Item = { bankName: string; branchName: string; sortCode: string };

export function BankBranchCombo(props: {
  value: Item | null;
  onChange: (v: Item | null) => void;
  placeholder?: string;
  disabled?: boolean;
  nameHiddenSortCode?: string; // optional hidden input name for form posts
}) {
  const {
    value,
    onChange,
    placeholder = "Search bank or branch…",
    disabled,
    nameHiddenSortCode,
  } = props;

  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [items, setItems] = React.useState<Item[]>([]);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const debounceRef = React.useRef<number | null>(null);

  const handleOpenChange = React.useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      setQ("");
      setItems([]);
      setLoading(false);
      setSearchError(null);
    }
  }, []);

  React.useEffect(() => {
    if (!open) return;

    const trimmed = q.trim();
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    setLoading(true);

    const delay = trimmed.length === 0 ? 0 : 250;
    debounceRef.current = window.setTimeout(async () => {
      try {
        setSearchError(null);
        const res = await fetch(
          `/api/banks/search?query=${encodeURIComponent(trimmed)}`,
          { cache: "no-store" }
        );
        let body: { success?: boolean; data?: unknown; error?: string } = {};
        try {
          body = await res.json();
        } catch {
          body = {};
        }
        if (!res.ok) {
          const msg =
            typeof body.error === "string" && body.error
              ? body.error
              : `Request failed (${res.status})`;
          setItems([]);
          setSearchError(msg);
          return;
        }
        if (body.success && Array.isArray(body.data)) {
          setItems(body.data);
          setSearchError(null);
        } else {
          setItems([]);
          setSearchError(
            typeof body.error === "string" && body.error
              ? body.error
              : "Invalid response from server."
          );
        }
      } catch (error) {
        console.error("Bank search error:", error);
        setItems([]);
        setSearchError(
          error instanceof Error ? error.message : "Could not search banks."
        );
      } finally {
        setLoading(false);
      }
    }, delay);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [open, q]);

  const label = value
    ? `${value.bankName} — ${value.branchName} (${value.sortCode})`
    : "Select bank & branch";

  return (
    <>
      {nameHiddenSortCode && (
        <input
          type="hidden"
          name={nameHiddenSortCode}
          value={value?.sortCode ?? ""}
        />
      )}
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-11 w-full cursor-pointer justify-between rounded-xl border-white/10 bg-black/30 px-3 text-white shadow-inner shadow-black/20 hover:border-cyan-300/25 hover:bg-black/40 hover:text-white",
              "focus-visible:border-cyan-300/60 focus-visible:ring-cyan-400/20 data-[state=open]:border-cyan-300/40 data-[state=open]:bg-cyan-400/10"
            )}
            disabled={disabled}
          >
            <span className="flex min-w-0 items-center gap-2 truncate text-left">
              <Landmark className="h-4 w-4 shrink-0 text-cyan-200/75" />
              <span className={cn("truncate", value ? "text-white" : "text-white/40")}>
                {value ? label : placeholder}
              </span>
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-white/40" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="z-[300] w-(--radix-popover-trigger-width) overflow-hidden rounded-2xl border border-white/10 bg-slate-950/98 p-0 text-white shadow-2xl shadow-black/50 backdrop-blur-xl"
          align="start"
          sideOffset={8}
        >
          <Command
            shouldFilter={false}
            className="bg-transparent text-white [&_[cmdk-input-wrapper]]:h-12 [&_[cmdk-input-wrapper]]:border-b [&_[cmdk-input-wrapper]]:border-white/10 [&_[cmdk-input-wrapper]]:bg-black/20 [&_[cmdk-input-wrapper]_svg]:text-cyan-200/70 [&_[cmdk-list]]:max-h-80"
          >
            <CommandInput
              placeholder="Type a bank, branch, or sort code…"
              value={q}
              onValueChange={setQ}
              disabled={disabled}
              className="text-white placeholder:text-white/35"
            />
            <CommandList>
              {loading ? (
                <CommandEmpty>
                  <span className="inline-flex items-center gap-2 text-white/55">
                    <Loader2 className="h-4 w-4 animate-spin text-cyan-200" />
                    Searching branches…
                  </span>
                </CommandEmpty>
              ) : searchError ? (
                <CommandEmpty>
                  <div className="px-4 py-3 text-center">
                    <p className="font-medium text-amber-200/90">Could not load banks</p>
                    <p className="mt-2 text-xs leading-5 text-white/50">{searchError}</p>
                  </div>
                </CommandEmpty>
              ) : items.length === 0 ? (
                <CommandEmpty>
                  <div className="px-4 py-3 text-center">
                    <Landmark className="mx-auto h-7 w-7 text-white/25" />
                    <p className="mt-2 font-medium text-white/75">No branches found</p>
                    <p className="mt-1 text-xs leading-5 text-white/45">
                      Try the bank name, branch name, or six-digit sort code. If this
                      environment should have bank data, run the bank seed against this
                      deployment&apos;s database.
                    </p>
                  </div>
                </CommandEmpty>
              ) : (
                <CommandGroup
                  heading="Matching bank branches"
                  className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-white/40"
                >
                  {items.map((it) => {
                    const selected =
                      value?.bankName === it.bankName &&
                      value?.branchName === it.branchName &&
                      value?.sortCode === it.sortCode;
                    return (
                      <CommandItem
                        key={`${it.sortCode}-${it.bankName}-${it.branchName}`}
                        onSelect={() => {
                          onChange(it);
                          setOpen(false);
                        }}
                        className="mx-1 cursor-pointer rounded-xl px-3 py-3 text-white/80 data-[selected=true]:bg-cyan-400/10 data-[selected=true]:text-white"
                      >
                        <Check
                          className={cn(
                            "mr-1 h-4 w-4 shrink-0 text-cyan-200",
                            selected ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <p className="truncate font-medium">{it.bankName}</p>
                            <span className="shrink-0 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-0.5 text-[11px] font-medium text-cyan-100">
                              {it.sortCode}
                            </span>
                          </div>
                          <p className="mt-1 truncate text-xs text-white/48">{it.branchName}</p>
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}
