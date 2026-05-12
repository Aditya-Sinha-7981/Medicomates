import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import AppShell from "../components/layout/AppShell";
import MedicalDocumentsSection from "../components/MedicalDocumentsSection";

/** Doctor-only: full patient chart documents (keeps patient profile uncluttered). */
export default function PatientDocumentsPage() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const patientName = location.state?.patientName;

  return (
    <AppShell
      title="Medical documents"
      subtitle={
        patientName
          ? `Reports and files for ${patientName}`
          : "Reports and files for this patient"
      }
      actions={
        <button
          type="button"
          onClick={() => navigate(`/patient/${patientId}`)}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to profile
        </button>
      }
    >
      <div className="max-w-3xl">
        <MedicalDocumentsSection variant="patient" patientId={patientId} />
      </div>
    </AppShell>
  );
}
