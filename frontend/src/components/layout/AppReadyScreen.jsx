import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import BrandMark from "../branding/BrandMark";

export default function AppReadyScreen({ isReady, children }) {
  const [showLoader, setShowLoader] = useState(true);
  const [progress, setProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState("Preparing dashboard...");
  const [showSpinner, setShowSpinner] = useState(false);

  // Handle fake progress and subtle messages
  useEffect(() => {
    if (isReady) return;

    let timeElapsed = 0;
    const interval = setInterval(() => {
      timeElapsed += 100;
      
      setProgress((prev) => {
        if (prev >= 95) return prev;
        const remaining = 95 - prev;
        // Asymptotically approach 95, moving fast at first, then slowing down
        const increment = Math.max(0.2, remaining * 0.08);
        return prev + increment;
      });

      // Update loading messages based on time elapsed
      if (timeElapsed === 1500) {
        setLoadingMessage("Fetching medical records...");
      } else if (timeElapsed === 3000) {
        setLoadingMessage("Syncing adherence data...");
      } else if (timeElapsed === 5000) {
        setLoadingMessage("Weak internet detected. Optimizing connection...");
        setShowSpinner(true);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isReady]);

  // Handle real completion
  useEffect(() => {
    if (isReady) {
      setProgress(100);
      setLoadingMessage("Ready");
      setShowSpinner(false);
      
      // Wait for the progress bar to smoothly reach 100% before fading out
      const timer = setTimeout(() => {
        setShowLoader(false);
      }, 600); // 600ms gives time for the bar to hit 100% visually
      
      return () => clearTimeout(timer);
    }
  }, [isReady]);

  return (
    <>
      <AnimatePresence>
        {showLoader && (
          <motion.div
            key="app-loader"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, filter: "blur(10px)", transition: { duration: 0.5, ease: "easeOut" } }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-surface"
          >
            <div className="flex flex-col items-center gap-5 px-6 text-center w-full max-w-sm">
              <div className="flex h-24 w-24 items-center justify-center rounded-[24px] bg-white shadow-brand-glow">
                <BrandMark className="h-16 w-16" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl text-slate-900">
                <span className="text-brand">Medico</span>
                <span className="text-accent">Mates</span>
              </h1>
              
              <div className="mt-2 w-full flex flex-col items-center gap-3">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-soft">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-brand to-accent"
                    initial={{ width: "0%" }}
                    animate={{ width: `${progress}%` }}
                    transition={{ ease: "easeOut", duration: 0.2 }}
                  />
                </div>
                
                <AnimatePresence mode="wait">
                  <motion.div
                    key={loadingMessage}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-center gap-2 h-6"
                  >
                    {showSpinner && (
                      <div className="h-4 w-4 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                    )}
                    <p className={`text-sm font-medium ${showSpinner ? 'text-amber-600' : 'text-slate-500'}`}>
                      {loadingMessage}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* 
        We only mount children when isReady is true to prevent them from crashing
        due to missing critical data. 
      */}
      {isReady && children}
    </>
  );
}
