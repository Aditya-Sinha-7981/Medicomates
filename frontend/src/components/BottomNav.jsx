import { useNavigate, useLocation } from "react-router-dom";

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <div className="fixed bottom-0 left-0 w-full md:w-24 md:h-screen md:top-0 md:flex-col md:border-r md:border-t-0 md:rounded-none bg-white border-t border-[#e6edf8] shadow-[0_-10px_24px_rgba(21,60,119,0.05)] md:shadow-[10px_0_24px_rgba(21,60,119,0.05)] px-4 py-3 md:py-8 flex justify-between md:justify-start gap-2 md:gap-10 items-center z-50">
      
      {/* Brand logo space for desktop */}
      <div className="hidden md:flex flex-col items-center justify-center mb-8">
        <div className="w-10 h-10 rounded-full bg-[#2a79e8] text-white flex items-center justify-center font-bold text-lg">M</div>
      </div>

      <button onClick={() => navigate("/patient")} className={`flex flex-col items-center gap-1 ${isActive("/patient") ? "text-[#2a79e8]" : "text-gray-500 hover:text-gray-900 transition-colors"}`}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        <span className="text-[10px] md:text-xs font-semibold">Home</span>
      </button>

      <button onClick={() => navigate("/medicines")} className={`flex flex-col items-center gap-1 ${isActive("/medicines") || isActive("/medicine/new") ? "text-[#2a79e8]" : "text-gray-500 hover:text-gray-900 transition-colors"}`}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>
        <span className="text-[10px] md:text-xs font-semibold">Meds</span>
      </button>

      <button onClick={() => navigate("/profile")} className={`flex flex-col items-center gap-1 ${isActive("/profile") ? "text-[#2a79e8]" : "text-gray-500 hover:text-gray-900 transition-colors"}`}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <span className="text-[10px] md:text-xs font-semibold">Profile</span>
      </button>

    </div>
  );
}
