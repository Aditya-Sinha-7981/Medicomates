import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import BrandMark from "../components/branding/BrandMark";

export default function Splash() {
  const navigate = useNavigate();

  return (
    <main className="relative min-h-screen overflow-hidden bg-surface-muted">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-6 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
          className="mb-8 flex h-32 w-32 items-center justify-center rounded-[32px] bg-white shadow-brand-glow md:h-36 md:w-36"
        >
          <BrandMark className="h-24 w-24 md:h-28 md:w-28" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.45 }}
          className="text-4xl font-bold tracking-tight md:text-5xl"
        >
          <span className="text-brand">Medico</span>
          <span className="text-accent">Mates</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.45 }}
          className="mt-3 text-2xl font-semibold text-slate-900 md:text-3xl"
        >
          Your Smart Health Companion
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.45 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-3"
        >
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="rounded-xl bg-brand px-7 py-3 text-sm font-semibold text-white shadow-brand-glow transition hover:bg-brand-hover"
          >
            Continue
          </button>
          <button
            type="button"
            onClick={() => navigate("/register")}
            className="rounded-xl border border-brand bg-white px-7 py-3 text-sm font-semibold text-brand transition hover:bg-brand-soft"
          >
            Register
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55, duration: 0.5 }}
          className="absolute bottom-12 flex gap-2.5"
          aria-hidden
        >
          <span className="h-2.5 w-2.5 rounded-full bg-brand animate-pulse" />
          <span className="h-2.5 w-2.5 rounded-full bg-accent animate-pulse [animation-delay:180ms]" />
          <span className="h-2.5 w-2.5 rounded-full bg-brand animate-pulse [animation-delay:360ms]" />
        </motion.div>
      </div>
    </main>
  );
}
