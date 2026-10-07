import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  widthClass?: string; // optional override
};

export function ResponsiveModal({
  open,
  onClose,
  title,
  children,
  widthClass,
}: Props) {
  // ESC close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-70 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          {/* Desktop dialog */}
          <div
            className="hidden sm:grid h-full place-items-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
              className={[
                "m-card-strong flex w-full max-h-[90vh] max-w-[65vw] flex-col rounded-2xl text-(--m-fg)",
                widthClass ?? "max-w-4xl",
              ].join(" ")}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-(--m-border) px-5 py-4">
                <div className="text-base font-semibold text-(--m-fg)">{title}</div>
                <button
                  onClick={onClose}
                  className="m-muted hover:text-(--m-fg)"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              <div className="p-5 overflow-y-auto flex-1 min-h-0">
                {children}
              </div>
            </motion.div>
          </div>

          {/* Mobile bottom sheet */}
          <div
            className="sm:hidden fixed inset-x-0 bottom-0"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 250, damping: 28 }}
              className="m-card-strong flex max-h-[90vh] flex-col rounded-t-2xl text-(--m-fg)"
            >
              <div className="shrink-0 py-2">
                <div className="mx-auto h-1.5 w-12 rounded-full bg-(--m-border)" />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
                {title && (
                  <div className="mb-2 text-base font-semibold text-(--m-fg)">{title}</div>
                )}
                {children}
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
