import { useNavigate, useLocation } from "react-router-dom";
import BrandMark from "./branding/BrandMark";

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <div className="fixed bottom-0 left-0 z-50 flex w-full items-center justify-between gap-2 border-t border-brand-soft-border bg-white px-4 py-3 shadow-[0_-10px_24px_rgba(21,60,119,0.05)] md:left-0 md:top-0 md:h-screen md:w-24 md:flex-col md:justify-start md:gap-10 md:rounded-none md:border-r md:border-t-0 md:py-8 md:shadow-[10px_0_24px_rgba(21,60,119,0.05)]">
      <div className="mb-0 hidden flex-col items-center justify-center md:mb-8 md:flex">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-brand-soft-border bg-white p-0.5 shadow-sm">
          <BrandMark className="h-8 w-8 rounded-full" />
        </div>
      </div>

      <button
        type="button"
        onClick={() => navigate("/patient")}
        className={`flex flex-col items-center gap-1 ${isActive("/patient") ? "text-brand" : "text-gray-500 transition-colors hover:text-gray-900"}`}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        <span className="text-[10px] font-semibold md:text-xs">Home</span>
      </button>

      <button
        type="button"
        onClick={() => navigate("/medicines")}
        className={`flex flex-col items-center gap-1 ${isActive("/medicines") || isActive("/medicine/new") ? "text-brand" : "text-gray-500 transition-colors hover:text-gray-900"}`}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>
        <span className="text-[10px] font-semibold md:text-xs">Meds</span>
      </button>

      <button
        type="button"
        onClick={() => navigate("/profile")}
        className={`flex flex-col items-center gap-1 ${isActive("/profile") ? "text-brand" : "text-gray-500 transition-colors hover:text-gray-900"}`}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <span className="text-[10px] font-semibold md:text-xs">Profile</span>
      </button>
    </div>
  );
}
