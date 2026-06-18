"use client";

import { useRef } from "react";
import { useBusy } from "@/providers/busy-provider";
import { useToast } from "./useToast";

type Labels<T = unknown> = {
  loading: string;
  success: string | ((result: T) => string);
  error: string | ((e: Error) => string);
};

type ToastApi = ReturnType<typeof useToast>;

export type BusyToast = Omit<ToastApi, "promise"> & {
  promise: <T>(p: Promise<T>, labels: Labels<T>) => Promise<T>;
  show: (message: string) => void;
  hide: () => void;
};

export function useBusyToast(): BusyToast {
  const { toast, success, error, info, warning, dismiss } = useToast();
  const { beginBusy, endBusy } = useBusy();
  const toastIdRef = useRef<string | number | null>(null);

  /** Just like toast.promise, but disables the page while pending */
  const busyPromise = async <T>(p: Promise<T>, labels: Labels<T>): Promise<T> => {
    beginBusy();
    try {
      const result = await p;
      const successMsg =
        typeof labels.success === "function" ? labels.success(result) : labels.success;
      success(successMsg);
      return result;
    } catch (err) {
      const errorMsg =
        typeof labels.error === "function"
          ? labels.error(err instanceof Error ? err : new Error(String(err)))
          : labels.error;
      error(errorMsg);
      throw err;
    } finally {
      endBusy();
    }
  };

  /** Show a loading toast and begin busy state */
  const show = (message: string) => {
    beginBusy();
    toastIdRef.current = info(message, { duration: Infinity });
  };

  /** Hide the loading toast and end busy state */
  const hide = () => {
    if (toastIdRef.current !== null) {
      dismiss(toastIdRef.current);
      toastIdRef.current = null;
    }
    endBusy();
  };

  return { promise: busyPromise, show, hide, toast, success, error, info, warning, dismiss };
}
