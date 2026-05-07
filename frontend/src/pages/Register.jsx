import { useState } from "react";
import { Link } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import AuthLayout from "../components/layout/AuthLayout";

export default function Register() {
  const { register, loading, error } = useAuth();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "patient",
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    await register(form);
  };

  return (
    <AuthLayout>
      <h1 className="text-3xl font-semibold text-slate-900">Create account</h1>
      <p className="mt-2 text-sm text-slate-500">Set up your MedAdhere profile</p>

      <form onSubmit={handleSubmit} className="mt-6">
          <div className="mb-[14px]">
            <label className="block mb-2 text-sm text-slate-700 font-medium">Full Name</label>
            <input
              required
              placeholder="Enter your full name"
              className="w-full h-12 border border-slate-200 bg-slate-50 rounded-xl px-3.5 text-base text-slate-800 focus:border-blue-500 focus:outline-none"
              value={form.full_name}
              onChange={(event) => setForm((prev) => ({ ...prev, full_name: event.target.value }))}
            />
          </div>
          <div className="mb-[14px]">
            <label className="block mb-2 text-sm text-slate-700 font-medium">Email</label>
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
              placeholder="Minimum 8 characters"
              className="w-full h-12 border border-slate-200 bg-slate-50 rounded-xl px-3.5 text-base text-slate-800 focus:border-blue-500 focus:outline-none"
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
            />
          </div>
          <div className="mb-[14px]">
            <label className="block mb-2 text-sm text-slate-700 font-medium">Role</label>
            <select
              className="w-full h-12 border border-slate-200 bg-slate-50 rounded-xl px-3.5 text-base text-slate-800 focus:border-blue-500 focus:outline-none"
              value={form.role}
              onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}
            >
              <option value="patient">Patient</option>
              <option value="doctor">Doctor</option>
            </select>
          </div>
          {error ? <p className="text-red-600 text-[0.9rem]">{error}</p> : null}
          <button type="submit" disabled={loading} className="w-full h-12 rounded-xl bg-blue-600 text-white text-base font-semibold disabled:opacity-50 hover:bg-blue-700 transition-colors">
            {loading ? "Creating account..." : "Create Account"}
          </button>
      </form>

      <p className="mt-5 text-center text-sm">
          <span className="text-slate-500">Already registered? </span>
          <Link to="/login" className="text-blue-600 font-semibold">
            Login
          </Link>
      </p>
    </AuthLayout>
  );
}
