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
                "w-full max-w-[65vw] rounded-2xl border border-white/10 bg-card/95 shadow-2xl",
                widthClass ?? "max-w-4xl",
              ].join(" ")}
            >
              <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                <div className="text-base font-semibold">{title}</div>
                <button
                  onClick={onClose}
                  className="text-white/60 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <div className="p-5">{children}</div>
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
              className="rounded-t-2xl border border-white/10 bg-card/95 shadow-2xl"
            >
              <div className="py-2">
                <div className="mx-auto h-1.5 w-12 rounded-full bg-white/20" />
              </div>
              <div className="px-5 pb-4">
                {title && (
                  <div className="text-base font-semibold mb-2">{title}</div>
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
