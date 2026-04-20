"use client";

import * as React from "react";
import { PromptDialog } from "@/components/ui/prompt-dialog";
import type { ConfirmationDialogIntent } from "@/components/ui/confirmation-dialog";

export type PromptRequest = {
  title: string;
  description?: string;
  inputLabel?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  intent?: ConfirmationDialogIntent;
  zIndexClass?: string;
};

type PendingState = {
  open: boolean;
  request: PromptRequest | null;
};

/**
 * Promise-based optional text prompt, same UX pattern as {@link useConfirmationDialog}.
 * Resolves to trimmed string on confirm (may be empty), or `null` on cancel / dismiss.
 */
export function usePromptDialog() {
  const resolverRef = React.useRef<((value: string | null) => void) | null>(
    null
  );
  const [pending, setPending] = React.useState<PendingState>({
    open: false,
    request: null,
  });
  const [inputValue, setInputValue] = React.useState("");

  const resolveAndClose = React.useCallback((value: string | null) => {
    const resolver = resolverRef.current;
    resolverRef.current = null;
    setPending({ open: false, request: null });
    resolver?.(value);
  }, []);

  const prompt = React.useCallback((request: PromptRequest) => {
    if (resolverRef.current) {
      resolverRef.current(null);
      resolverRef.current = null;
    }

    setInputValue(request.defaultValue ?? "");

    return new Promise<string | null>((resolve) => {
      resolverRef.current = resolve;
      setPending({ open: true, request });
    });
  }, []);

  React.useEffect(() => {
    return () => {
      if (resolverRef.current) {
        resolverRef.current(null);
        resolverRef.current = null;
      }
    };
  }, []);

  const promptDialog = pending.request ? (
    <PromptDialog
      open={pending.open}
      onOpenChange={(open) => {
        if (!open) resolveAndClose(null);
      }}
      title={pending.request.title}
      description={pending.request.description}
      inputLabel={pending.request.inputLabel}
      placeholder={pending.request.placeholder}
      value={inputValue}
      onValueChange={setInputValue}
      confirmLabel={pending.request.confirmLabel}
      cancelLabel={pending.request.cancelLabel}
      intent={pending.request.intent}
      zIndexClass={pending.request.zIndexClass}
      onConfirm={() => resolveAndClose(inputValue.trim())}
      onCancel={() => resolveAndClose(null)}
    />
  ) : null;

  return {
    prompt,
    promptDialog,
  };
}
