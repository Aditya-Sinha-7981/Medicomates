import { CalendarDays, Home, MessageCircle, Pill, UserCircle2 } from "lucide-react";
import { NavLink } from "react-router-dom";
import HealthcareLogo from "../branding/HealthcareLogo";

const navItems = [
  { to: "/patient", label: "Dashboard", icon: Home },
  { to: "/medicines", label: "Medicines", icon: Pill },
  { to: "/notes", label: "Notes", icon: MessageCircle },
  { to: "/profile", label: "Profile", icon: UserCircle2 },
];

export default function AppShell({ title, subtitle, actions, children }) {
  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-800">
      <aside className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur md:inset-x-auto md:inset-y-0 md:left-0 md:w-64 md:border-r md:border-t-0">
        <div className="hidden h-full flex-col p-5 md:flex">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
              <HealthcareLogo iconClassName="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">MedicoMates</p>
              <p className="text-xs text-slate-500">Healthcare Dashboard</p>
            </div>
          </div>
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition ${
                      isActive
                        ? "bg-blue-50 text-blue-700"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`
                  }
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        </div>

        <nav className="flex items-center justify-around px-2 py-2 md:hidden">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-medium transition ${
                    isActive ? "text-blue-700" : "text-slate-500"
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      </aside>

      <div className="mx-auto max-w-7xl px-4 pb-24 pt-5 md:ml-64 md:px-8 md:pb-8 md:pt-8">
        {(title || subtitle || actions) && (
          <header className="mb-6 flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
            <div>
              {title ? <h1 className="text-2xl font-semibold text-slate-900">{title}</h1> : null}
              {subtitle ? (
                <p className="mt-1 text-sm text-slate-500 flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" />
                  {subtitle}
                </p>
              ) : null}
            </div>
            {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
          </header>
        )}
        {children}
      </div>
    </div>
  );
}

