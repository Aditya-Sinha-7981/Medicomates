import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Stethoscope, UserRound } from "lucide-react";
import useAuth from "../hooks/useAuth";
import AuthLayout from "../components/layout/AuthLayout";
import { getAuthToken, getCurrentUser } from "../utils/auth";

export default function Register() {
  const navigate = useNavigate();
  const { register, loading, error } = useAuth();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "patient",
  });
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const token = getAuthToken();
    const user = getCurrentUser();
    if (token && user) {
      navigate(user.role === "doctor" ? "/doctor" : "/patient", { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    await register(form);
  };

  return (
    <AuthLayout>
      <h1 className="text-4xl font-bold text-slate-800">Create Account</h1>
      <p className="mt-2 text-[1.65rem] leading-tight text-slate-800 md:text-3xl">
        Set up your care profile
      </p>

      <form onSubmit={handleSubmit} className="mt-8">
        <div className="mb-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setForm((prev) => ({ ...prev, role: "patient" }))}
            className={`rounded-2xl border px-4 py-4 text-center transition ${
              form.role === "patient"
                ? "border-[#2a79e8] bg-blue-50 text-[#2a79e8]"
                : "border-slate-100 bg-slate-50 text-slate-700"
            }`}
          >
            <UserRound className="mx-auto h-5 w-5" />
            <p className="mt-2 text-base font-semibold">Patient</p>
          </button>
          <button
            type="button"
            onClick={() => setForm((prev) => ({ ...prev, role: "doctor" }))}
            className={`rounded-2xl border px-4 py-4 text-center transition ${
              form.role === "doctor"
                ? "border-[#2a79e8] bg-blue-50 text-[#2a79e8]"
                : "border-slate-100 bg-slate-50 text-slate-700"
            }`}
          >
            <Stethoscope className="mx-auto h-5 w-5" />
            <p className="mt-2 text-base font-semibold">Doctor</p>
          </button>
        </div>

        <div className="mb-4">
          <label className="mb-2 block text-base font-semibold text-slate-700">Full Name</label>
          <input
            required
            placeholder="John Doe"
            className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 text-lg text-slate-800 outline-none focus:border-blue-500"
            value={form.full_name}
            onChange={(event) => setForm((prev) => ({ ...prev, full_name: event.target.value }))}
          />
        </div>

        <div className="mb-4">
          <label className="mb-2 block text-base font-semibold text-slate-700">Email Address</label>
          <input
            type="email"
            required
            placeholder="john.doe@email.com"
            className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 text-lg text-slate-800 outline-none focus:border-blue-500"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
          />
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-base font-semibold text-slate-700">Password</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              placeholder="Minimum 8 characters"
              className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 pr-12 text-lg text-slate-800 outline-none focus:border-blue-500"
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {error ? <p className="mb-4 text-base font-medium text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="h-14 w-full rounded-2xl bg-[#2a79e8] text-2xl font-semibold text-white shadow-[0_10px_24px_rgba(42,121,232,0.35)] transition hover:bg-[#1f67d2] disabled:opacity-50"
        >
            {loading ? "Creating account..." : "Create Account"}
        </button>
      </form>

      <p className="mt-8 text-center text-lg">
        <span className="text-slate-700">Already registered? </span>
        <Link to="/login" className="font-semibold text-[#2a79e8]">
          Login
        </Link>
      </p>
    </AuthLayout>
  );
}
