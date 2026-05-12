import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../components/layout/AuthLayout";
import { supabaseAuth } from "../utils/supabaseAuth";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supabaseAuth) {
      setError("Auth is not configured.");
      return;
    }
    let cancelled = false;
    supabaseAuth.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) setReady(true);
      else setError("Invalid or expired reset link. Request a new one from the login page.");
    });
    const { data: sub } = supabaseAuth.auth.onAuthStateChange((_event, session) => {
      if (session) setReady(true);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!supabaseAuth) return;
    setLoading(true);
    try {
      const { error: err } = await supabaseAuth.auth.updateUser({ password });
      if (err) throw err;
      navigate("/login", { replace: true, state: { resetOk: true } });
    } catch (err) {
      setError(err.message || "Could not update password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h1 className="text-3xl font-bold text-slate-800">Choose a new password</h1>
      {ready ? (
        <p className="mt-2 text-sm text-slate-600">
          This updates the Supabase account tied to the reset link you opened (not any other user).
        </p>
      ) : null}
      {!ready && !error ? (
        <p className="mt-4 text-slate-600">Verifying link…</p>
      ) : error && !ready ? (
        <p className="mt-4 text-sm text-rose-600">{error}</p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">New password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Confirm password</label>
            <input
              type="password"
              required
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900"
              autoComplete="new-password"
            />
          </div>
          {error && ready ? <p className="text-sm text-rose-600">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-sky-600 py-2.5 font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
          >
            {loading ? "Saving…" : "Update password"}
          </button>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-slate-500">
        <Link to="/login" className="font-medium text-sky-600 hover:text-sky-700">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
