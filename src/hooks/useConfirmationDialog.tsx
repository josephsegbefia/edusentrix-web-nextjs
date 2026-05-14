"use client";

import * as React from "react";
import {
  ConfirmationDialog,
  type ConfirmationDialogIntent,
} from "@/components/ui/confirmation-dialog";

export type ConfirmationResult = "confirm" | "cancel" | "dismiss";

export type ConfirmationRequest = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  intent?: ConfirmationDialogIntent;
  className?: string;
  zIndexClass?: string;
};

type PendingState = {
  open: boolean;
  request: ConfirmationRequest | null;
};

export function useConfirmationDialog() {
  const resolverRef = React.useRef<((result: ConfirmationResult) => void) | null>(
    null
  );
  const [pending, setPending] = React.useState<PendingState>({
    open: false,
    request: null,
  });

  const resolveAndClose = React.useCallback((result: ConfirmationResult) => {
    const resolver = resolverRef.current;
    resolverRef.current = null;
    setPending({ open: false, request: null });
    resolver?.(result);
  }, []);

  const confirm = React.useCallback(
    (request: ConfirmationRequest) => {
      if (resolverRef.current) {
        resolverRef.current("dismiss");
        resolverRef.current = null;
      }

      return new Promise<ConfirmationResult>((resolve) => {
        resolverRef.current = resolve;
        setPending({ open: true, request });
      });
    },
    []
  );

  React.useEffect(() => {
    return () => {
      if (resolverRef.current) {
        resolverRef.current("dismiss");
        resolverRef.current = null;
      }
    };
  }, []);

  const confirmationDialog = pending.request ? (
    <ConfirmationDialog
      open={pending.open}
      onOpenChange={(open) => {
        if (!open) resolveAndClose("dismiss");
      }}
      title={pending.request.title}
      description={pending.request.description}
      confirmLabel={pending.request.confirmLabel}
      cancelLabel={pending.request.cancelLabel}
      intent={pending.request.intent}
      className={pending.request.className}
      zIndexClass={pending.request.zIndexClass}
      onConfirm={() => resolveAndClose("confirm")}
      onCancel={() => resolveAndClose("cancel")}
    />
  ) : null;

  return {
    confirm,
    confirmationDialog,
  };
}
