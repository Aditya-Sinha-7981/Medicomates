import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";
import ConfirmTaken from "./pages/ConfirmTaken";
import DoctorDashboard from "./pages/DoctorDashboard";
import Login from "./pages/Login";
import MedicineForm from "./pages/MedicineForm";
import Notes from "./pages/Notes";
import PatientDashboard from "./pages/PatientDashboard";
import PatientProfile from "./pages/PatientProfile";
import Profile from "./pages/Profile";
import Register from "./pages/Register";
import Splash from "./pages/Splash";

function ProtectedRoute({ children }) {
  const user = localStorage.getItem("medicomates_user");
  if (!user) return <Navigate to="/login" replace />;
  return children;
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
              <Notes />
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
              <DoctorDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient-profile/:patientId"
          element={
            <ProtectedRoute>
              <PatientProfile />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}
