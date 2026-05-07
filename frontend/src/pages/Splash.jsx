import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getAuthToken, getCurrentUser } from "../utils/auth";

export default function Splash() {
  const navigate = useNavigate();

  useEffect(() => {
    const token = getAuthToken();
    const user = getCurrentUser();
    if (token && user) {
      navigate(user.role === "doctor" ? "/doctor" : "/patient", { replace: true });
    }
  }, [navigate]);

  return (
    <main className="min-h-screen bg-[#e9eef7] relative overflow-hidden">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-6 text-center">
        <div className="mb-8 flex h-28 w-28 items-center justify-center rounded-[28px] bg-white shadow-[0_12px_30px_rgba(15,23,42,0.12)]">
          <svg
            width="52"
            height="52"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#2a79e8"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 2h6v4h4v6h-4v4H9v-4H5V6h4z" />
            <path d="M12 8c-1.6-2-4-1.7-5.1-.2-1.3 1.8-.7 4.1.8 5.6L12 17l4.3-3.6c1.5-1.5 2.1-3.8.8-5.6-1.1-1.5-3.5-1.8-5.1.2Z" />
          </svg>
        </div>
        <h1 className="text-5xl font-bold tracking-tight text-[#2a79e8]">MedicoMates</h1>
        <p className="mt-3 text-3xl font-semibold text-slate-900">Your Smart Health Companion</p>

        <button
          onClick={() => navigate("/login")}
          className="mt-10 rounded-full bg-blue-600 px-9 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          Continue
        </button>

        <div className="absolute bottom-12 flex gap-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#2a79e8]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#2a79e8]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#2a79e8]" />
        </div>
      </div>
    </main>
  );
}
