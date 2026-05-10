import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import BrandIntro from "../branding/BrandIntro";

export default function IntroWrapper({ children }) {
  const [showIntro, setShowIntro] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(true);

  useEffect(() => {
    // Only show if not seen in this session
    const hasSeen = sessionStorage.getItem("hasSeenBrandIntro");
    if (!hasSeen) {
      setShowIntro(true);
      setHasCompleted(false);
    }
  }, []);

  const handleComplete = () => {
    sessionStorage.setItem("hasSeenBrandIntro", "true");
    setShowIntro(false);
    setHasCompleted(true);
  };

  return (
    <>
      <AnimatePresence>
        {showIntro && <BrandIntro onComplete={handleComplete} />}
      </AnimatePresence>
      {hasCompleted && <div className="w-full h-full">{children}</div>}
    </>
  );
}
