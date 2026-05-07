import { useState } from "react";
import { Link } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import AuthLayout from "../components/layout/AuthLayout";

export default function Login() {
  const { login, loading, error } = useAuth();
  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    await login(form);
  };

  return (
    <AuthLayout>
      <h1 className="text-3xl font-semibold text-slate-900">Welcome back</h1>
      <p className="mt-2 text-sm text-slate-500">Sign in to continue your care</p>

      <form onSubmit={handleSubmit} className="mt-6">
          <div className="mb-[14px]">
            <label className="block mb-2 text-sm text-slate-700 font-medium">Email Address</label>
            <input
              type="email"
              required
              placeholder="Enter your email"
              className="w-full h-12 border border-slate-200 bg-slate-50 rounded-xl px-3.5 text-base text-slate-800 focus:border-blue-500 focus:outline-none"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            />
          </div>
          <div className="mb-[14px]">
            <label className="block mb-2 text-sm text-slate-700 font-medium">Password</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              className="w-full h-12 border border-slate-200 bg-slate-50 rounded-xl px-3.5 text-base text-slate-800 focus:border-blue-500 focus:outline-none"
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
            />
          </div>
          {error ? <p className="text-red-600 text-[0.9rem]">{error}</p> : null}
          <button type="submit" disabled={loading} className="w-full h-12 rounded-xl bg-blue-600 text-white text-base font-semibold disabled:opacity-50 hover:bg-blue-700 transition-colors">
            {loading ? "Signing in..." : "Sign In"}
          </button>
      </form>

      <p className="mt-5 text-center text-sm">
          <span className="text-slate-500">Don't have an account? </span>
          <Link to="/register" className="text-blue-600 font-semibold">
            Create Account
          </Link>
      </p>
    </AuthLayout>
  );
}
