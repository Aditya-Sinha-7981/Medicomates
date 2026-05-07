import { useNavigate } from "react-router-dom";

export default function Splash() {
  const navigate = useNavigate();

  return (
    <main
      className="min-h-screen bg-[#f3f6fb] flex flex-col items-center justify-center cursor-pointer p-4 transition-colors hover:bg-[#ebf1fa]"
      onClick={() => navigate("/login")}
    >
      <div className="bg-white rounded-[32px] p-10 mb-8 shadow-sm">
        <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#2a79e8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
        <div className="text-[10px] font-bold text-center mt-2 text-[#2a79e8]">HEALTHCARE</div>
      </div>
      <h1 className="text-[2.5rem] font-bold text-[#2a79e8] mb-1">MedicoMates</h1>
      <p className="text-gray-900 font-semibold text-[1.1rem]">Your Smart Health Companion</p>

      <div className="absolute bottom-16 flex gap-2">
        <div className="w-2.5 h-2.5 rounded-full bg-[#2a79e8]"></div>
        <div className="w-2.5 h-2.5 rounded-full bg-[#2a79e8]"></div>
        <div className="w-2.5 h-2.5 rounded-full bg-[#2a79e8]"></div>
      </div>
    </main>
  );
}
