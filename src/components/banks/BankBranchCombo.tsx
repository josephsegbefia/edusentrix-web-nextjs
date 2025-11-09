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
import { ChevronsUpDown, Check } from "lucide-react";

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
  const [debounceId, setDebounceId] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!q) {
      setItems([]);
      return;
    }
    setLoading(true);
    if (debounceId) window.clearTimeout(debounceId);
    const id = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/banks/search?query=${encodeURIComponent(q)}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        setItems(data.items || []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    setDebounceId(id);
    return () => window.clearTimeout(id);
  }, [q]);

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
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between cursor-pointer"
            disabled={disabled}
          >
            <span className="truncate text-left">
              {value ? label : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="premiumMenuContent p-0 w-(--radix-popover-trigger-width)"
          align="start"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Type a bank, branch, or sort code…"
              value={q}
              onValueChange={setQ}
              disabled={disabled}
            />
            <CommandList>
              {loading ? (
                <CommandEmpty>Searching…</CommandEmpty>
              ) : items.length === 0 ? (
                <CommandEmpty>No matches</CommandEmpty>
              ) : (
                <CommandGroup heading="Results">
                  {items.map((it) => {
                    const text = `${it.bankName} — ${it.branchName} (${it.sortCode})`;
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
                        className="cursor-pointer"
                      >
                        <Check
                          className={`mr-2 h-4 w-4 ${
                            selected ? "opacity-100" : "opacity-0"
                          }`}
                        />
                        {text}
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
