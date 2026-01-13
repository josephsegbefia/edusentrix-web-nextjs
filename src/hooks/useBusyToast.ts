"use client";

import { useBusy } from "@/providers/busy-provider";
import { useToast } from "./useToast";

type Labels = {
  loading: string;
  success: string;
  error: string | ((e: Error) => string);
};

export function useBusyToast() {
  const { toast, success, error, info, warning, dismiss } = useToast();
  const { beginBusy, endBusy } = useBusy();

  /** Just like toast.promise, but disables the page while pending */
  const busyPromise = async <T>(p: Promise<T>, labels: Labels): Promise<T> => {
    beginBusy();
    try {
      const result = await p;
      success(labels.success);
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

  return { promise: busyPromise, toast, success, error, info, warning, dismiss };
}
