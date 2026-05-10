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
import ReviewerView from "./pages/ReviewerView";
import { getAuthToken, getCurrentUser } from "./utils/auth";
import IntroWrapper from "./components/layout/IntroWrapper";

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
  return <IntroWrapper>{children}</IntroWrapper>;
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
              <ProtectedRoute requiredRole="doctor">
                <DoctorDashboard />
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
