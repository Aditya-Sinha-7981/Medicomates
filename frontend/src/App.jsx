import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";
import ConfirmTaken from "./pages/ConfirmTaken";
import Login from "./pages/Login";
import MedicineForm from "./pages/MedicineForm";
import PatientDashboard from "./pages/PatientDashboard";
import Profile from "./pages/Profile";
import Register from "./pages/Register";
import Splash from "./pages/Splash";

function ProtectedRoute({ children }) {
  const user = localStorage.getItem("medicomates_user");
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function Placeholder({ title }) {
  return (
    <div className="max-w-[420px] mx-auto min-h-screen md:min-h-[850px] md:h-[850px] md:my-8 md:rounded-[40px] md:border-[12px] md:border-gray-900 md:shadow-2xl relative overflow-hidden bg-[#f3f6fb] flex items-center py-5 px-4">
      <div className="w-full bg-white rounded-[24px] border border-[#e5ebf5] shadow-[0_10px_35px_rgba(13,54,124,0.08)] py-7 px-5 text-center">
        <h2 style={{ marginTop: 0, color: "#1f2937" }}>{title}</h2>
        <p className="text-gray-500">This screen is owned by Member 4.</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Splash />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/confirm" element={<ConfirmTaken />} />

        <Route
          path="/patient"
          element={
            <ProtectedRoute>
              <PatientDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/medicines"
          element={
            <ProtectedRoute>
              <MedicineForm />
            </ProtectedRoute>
          }
        />
        <Route
          path="/medicine/new"
          element={
            <ProtectedRoute>
              <MedicineForm />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notes"
          element={
            <ProtectedRoute>
              <Placeholder title="Notes" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctor"
          element={
            <ProtectedRoute>
              <Placeholder title="Doctor dashboard" />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}
