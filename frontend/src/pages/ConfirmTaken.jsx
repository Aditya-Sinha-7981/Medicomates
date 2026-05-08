import { useSearchParams } from "react-router-dom";
import AuthLayout from "../components/layout/AuthLayout";

export default function ConfirmTaken() {
  const [searchParams] = useSearchParams();
  const status = searchParams.get("status");
  const medicine = searchParams.get("medicine");
  const isSuccess = status === "success";

  return (
    <AuthLayout>
      <section className="py-8 text-center">
        {isSuccess ? (
          <>
            <div className="mb-4 text-6xl">✅</div>
            <h1 className="text-3xl font-semibold text-emerald-700">Dose Confirmed</h1>
            <p className="mt-3 text-slate-700">
              Great job! Keep it up. Your dose has been recorded.
            </p>
            {medicine ? (
              <p className="mt-2 text-sm text-slate-500">
                Medicine: <span className="font-medium text-slate-700">{medicine}</span>
              </p>
            ) : null}
          </>
        ) : (
          <>
            <div className="mb-4 text-6xl">🙂</div>
            <h1 className="text-3xl font-semibold text-slate-900">Link Unavailable</h1>
            <p className="mt-3 text-slate-600">
              Looks like this was already confirmed, or the link has expired.
            </p>
          </>
        )}
      </section>
    </AuthLayout>
  );
}
