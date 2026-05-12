import AppShell from "../components/layout/AppShell";
import MedicalDocumentsSection from "../components/MedicalDocumentsSection";

export default function MedicalReportsPage() {
  return (
    <AppShell title="Medical reports" subtitle="View, upload, and manage your documents">
      <div className="max-w-3xl">
        <MedicalDocumentsSection variant="self" />
      </div>
    </AppShell>
  );
}
