import { useState } from "react";
import { Link } from "react-router-dom";
import useAuth from "../hooks/useAuth";

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
    <main className="min-h-screen bg-[#f3f6fb] flex items-center justify-center p-4 md:p-8 font-sans text-slate-800">
      <div className="w-full max-w-md bg-white rounded-[32px] border border-[#e2e8f0] shadow-sm py-10 px-8 md:p-12">
        <h1 className="m-0 text-[2.1rem] leading-[1.1] text-slate-800 font-extrabold">Welcome Back</h1>
        <p className="mt-2 mb-0 text-gray-500">Sign in to continue your care</p>

        <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
          <div className="mb-[14px]">
            <label className="block mb-2 text-[0.92rem] text-gray-700 font-semibold">Email Address</label>
            <input
              type="email"
              required
              placeholder="Enter your email"
              className="w-full h-[52px] border border-[#e3e8f0] bg-[#f6f8fc] rounded-[14px] px-[14px] text-base text-gray-800 focus:border-[#2e88ff] focus:outline-none"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            />
          </div>
          <div className="mb-[14px]">
            <label className="block mb-2 text-[0.92rem] text-gray-700 font-semibold">Password</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              className="w-full h-[52px] border border-[#e3e8f0] bg-[#f6f8fc] rounded-[14px] px-[14px] text-base text-gray-800 focus:border-[#2e88ff] focus:outline-none"
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
            />
          </div>
          {error ? <p className="text-red-600 text-[0.9rem]">{error}</p> : null}
          <button type="submit" disabled={loading} className="w-full h-[52px] rounded-[14px] bg-[#2a79e8] text-white text-[1.05rem] font-bold disabled:opacity-50">
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p style={{ marginTop: 18, textAlign: "center" }}>
          <span className="text-gray-500">Don't have an account? </span>
          <Link to="/register" style={{ color: "#2a79e8", fontWeight: 700 }}>
            Create Account
          </Link>
        </p>
      </div>
    </main>
  );
}
