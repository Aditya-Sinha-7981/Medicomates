import { motion, AnimatePresence } from "framer-motion";

export function Modal({ open, onClose, title, children, size = "md" }) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 24, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className={`w-full ${
              size === "lg" ? "max-w-xl" : "max-w-md"
            } rounded-3xl bg-white shadow-xl shadow-slate-900/10 border border-slate-100 p-6 md:p-7`}
          >
            {title ? (
              <h2 className="text-lg md:text-xl font-semibold text-slate-900 mb-3">{title}</h2>
            ) : null}
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

