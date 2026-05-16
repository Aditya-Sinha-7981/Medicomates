import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";
import ConfirmTaken from "./pages/ConfirmTaken";
import DoctorAllPatients from "./pages/DoctorAllPatients";
import DoctorDashboard from "./pages/DoctorDashboard";
import Login from "./pages/Login";
import MedicineForm from "./pages/MedicineForm";
import Notes from "./pages/Notes";
import PatientDashboard from "./pages/PatientDashboard";
import PatientProfile from "./pages/PatientProfile";
import Profile from "./pages/Profile";
import MedicalReportsPage from "./pages/MedicalReportsPage";
import PatientDocumentsPage from "./pages/PatientDocumentsPage";
import Register from "./pages/Register";
import Splash from "./pages/Splash";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import ReviewerView from "./pages/ReviewerView";
import ReviewingListPage from "./pages/ReviewingListPage";
import { getAuthToken, getCurrentUser } from "./utils/auth";

function ProtectedRoute({ children, requiredRole }) {
  const token = getAuthToken();
  const user = getCurrentUser();
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }
  if (requiredRole && user.role !== requiredRole) {
    return (
      <Navigate
        to={user.role === "doctor" ? "/doctor" : "/patient"}
        replace
      />
    );
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Router>
        <Routes>
          <Route path="/" element={<Splash />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/register" element={<Register />} />
          <Route path="/confirm" element={<ConfirmTaken />} />

          <Route
            path="/patient"
            element={
              <ProtectedRoute requiredRole="patient">
                <PatientDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/review/:patientId"
            element={
              <ProtectedRoute requiredRole="patient">
                <ReviewerView />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reviewing"
            element={
              <ProtectedRoute requiredRole="patient">
                <ReviewingListPage />
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
            path="/medical-reports"
            element={
              <ProtectedRoute requiredRole="patient">
                <MedicalReportsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor"
            element={
              <ProtectedRoute requiredRole="doctor">
                <DoctorDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/patients"
            element={
              <ProtectedRoute requiredRole="doctor">
                <DoctorAllPatients />
              </ProtectedRoute>
            }
          />
          <Route
            path="/patient/:patientId/documents"
            element={
              <ProtectedRoute requiredRole="doctor">
                <PatientDocumentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/patient/:patientId"
            element={
              <ProtectedRoute requiredRole="doctor">
                <PatientProfile />
              </ProtectedRoute>
            }
          />
        </Routes>
    </Router>
  );
}
