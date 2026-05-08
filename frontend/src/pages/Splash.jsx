import { useNavigate } from "react-router-dom";
import HealthcareLogo from "../components/branding/HealthcareLogo";

export default function Splash() {
  const navigate = useNavigate();

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#e9eef7]">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-6 text-center">
        <div className="mb-7 flex h-28 w-28 items-center justify-center rounded-[28px] bg-white shadow-[0_12px_30px_rgba(15,23,42,0.12)] md:h-32 md:w-32">
          <HealthcareLogo
            iconClassName="h-9 w-9 md:h-10 md:w-10"
            showWordmark
            wordmarkClassName="mt-1 text-[8px] font-semibold tracking-[0.1em] text-[#2f77b8]"
          />
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-[#2a79e8] md:text-5xl">MedicoMates</h1>
        <p className="mt-3 text-2xl font-semibold text-slate-900 md:text-3xl">
          Your Smart Health Companion
        </p>
        <div className="mt-8 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="rounded-xl bg-[#2a79e8] px-7 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(42,121,232,0.35)] transition hover:bg-[#1f67d2]"
          >
            Continue
          </button>
          <button
            type="button"
            onClick={() => navigate("/register")}
            className="rounded-xl border border-[#2a79e8] bg-white px-7 py-3 text-sm font-semibold text-[#2a79e8] transition hover:bg-blue-50"
          >
            Register
          </button>
        </div>

        <div className="absolute bottom-12 flex gap-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#2a79e8] animate-pulse" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#2a79e8] animate-pulse [animation-delay:180ms]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#2a79e8] animate-pulse [animation-delay:360ms]" />
        </div>
      </div>
    </main>
  );
}
