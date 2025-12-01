"use client";

import { toast as baseToast } from "sonner";

type Options = {
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  duration?: number; // ms
};

export function useToast() {
  const toast = (title: string, opts?: Options) =>
    baseToast(title, {
      description: opts?.description,
      duration: opts?.duration ?? 3500,
      action:
        opts?.actionLabel && opts?.onAction
          ? { label: opts.actionLabel, onClick: opts.onAction }
          : undefined,
    });

  const success = (title: string, opts?: Options) =>
    baseToast.success(title, {
      description: opts?.description,
      duration: opts?.duration ?? 3000,
      action:
        opts?.actionLabel && opts?.onAction
          ? { label: opts.actionLabel, onClick: opts.onAction }
          : undefined,
    });

  const error = (title: string, opts?: Options) =>
    baseToast.error(title, {
      description: opts?.description,
      duration: opts?.duration ?? 5000,
      action:
        opts?.actionLabel && opts?.onAction
          ? { label: opts.actionLabel, onClick: opts.onAction }
          : undefined,
    });

  const info = (title: string, opts?: Options) =>
    baseToast.message(title, {
      description: opts?.description,
      duration: opts?.duration ?? 3500,
      action:
        opts?.actionLabel && opts?.onAction
          ? { label: opts.actionLabel, onClick: opts.onAction }
          : undefined,
    });

  const warning = (title: string, opts?: Options) =>
    baseToast.warning(title, {
      description: opts?.description,
      duration: opts?.duration ?? 5000,
      action:
        opts?.actionLabel && opts?.onAction
          ? { label: opts.actionLabel, onClick: opts.onAction }
          : undefined,
    });

  // Helper for async flows
  const promise = <T>(
    p: Promise<T>,
    labels: { loading: string; success: string; error: string }
  ) =>
    baseToast.promise(p, {
      loading: labels.loading,
      success: labels.success,
      error: labels.error,
    });

  return { toast, success, error, info, warning, promise };
}
