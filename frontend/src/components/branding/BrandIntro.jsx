import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import BrandMark from "./BrandMark";

export default function BrandIntro({ onComplete }) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => {
        if (onComplete) onComplete();
      }, 500);
    }, 2000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, filter: "blur(10px)" }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-surface"
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.75, ease: "easeOut", delay: 0.12 }}
            className="flex flex-col items-center gap-5 px-6"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 280, damping: 20 }}
              className="flex h-28 w-28 items-center justify-center rounded-[28px] bg-white shadow-brand-glow"
            >
              <BrandMark className="h-20 w-20" />
            </motion.div>
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
              <span className="text-brand">Medico</span>
              <span className="text-accent">Mates</span>
            </h1>
            <div className="h-1 w-48 max-w-[min(320px,80vw)] overflow-hidden rounded-full bg-brand-soft sm:w-64">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-brand to-accent"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 1.45, ease: "linear", delay: 0.35 }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
