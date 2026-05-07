import { useSearchParams } from "react-router-dom";

export default function ConfirmTaken() {
  const [searchParams] = useSearchParams();
  const status = searchParams.get("status");
  const medicine = searchParams.get("medicine");
  const isSuccess = status === "success";

  return (
    <main className="min-h-screen bg-[#f3f6fb] flex items-center justify-center p-4 md:p-8 font-sans text-slate-800">
      <section className="w-full max-w-md bg-white rounded-[32px] border border-[#e2e8f0] shadow-sm py-12 px-8 text-center">
        {isSuccess ? (
          <>
            <div style={{ marginBottom: 16, fontSize: 64 }}>✅</div>
            <h1 style={{ margin: 0, color: "#1f9d53", fontSize: "2rem" }}>Dose Confirmed</h1>
            <p style={{ marginTop: 10, color: "#334155", fontSize: "1.1rem" }}>
              Great job! Keep it up.
              {medicine ? ` (${medicine})` : ""}
            </p>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 16, fontSize: 64 }}>🙂</div>
            <h1 style={{ margin: 0, color: "#1f2937", fontSize: "2rem" }}>Link Unavailable</h1>
            <p style={{ marginTop: 10, color: "#334155", fontSize: "1.05rem" }}>
              Looks like this was already confirmed, or the link has expired.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
