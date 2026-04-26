"use client";

import * as React from "react";

/**
 * Mounted on the public application page. When the page is rendered inside
 * an iframe (channel=embed), it watches body height and posts size updates
 * to the parent window so the embed shim can resize the iframe.
 */
export function EmbedResizeBroadcaster() {
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.parent === window) return;

    let lastHeight = 0;
    let raf = 0;

    function send() {
      const height = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight
      );
      if (Math.abs(height - lastHeight) < 4) return;
      lastHeight = height;
      try {
        window.parent.postMessage(
          { type: "edusentrix:admissions:resize", height },
          "*"
        );
      } catch {
        /* parent may be cross-origin, that's fine */
      }
    }

    function schedule() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(send);
    }

    send();
    const ro = new ResizeObserver(schedule);
    ro.observe(document.body);
    window.addEventListener("load", schedule);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("load", schedule);
    };
  }, []);

  return null;
}
