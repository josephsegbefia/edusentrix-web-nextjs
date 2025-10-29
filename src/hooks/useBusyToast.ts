"use client";

import { useBusy } from "@/providers/busy-provider";
import { i } from "framer-motion/client";
import { useToast } from "./useToast";

type Labels = { loading: string; success: string; error: string };

export function useBusyToast() {
  const { promise: toastPromise, toast, success, error, info } = useToast();
  const { beginBusy, endBusy } = useBusy();

  /** Just like toast.promise, but disables the page while pending */
  const busyPromise = async <T>(p: Promise<T>, labels: Labels) => {
    beginBusy();
    try {
      return await toastPromise(p, labels);
    } finally {
      endBusy();
    }
  };

  return { promise: busyPromise, toast, success, error, info };
}
