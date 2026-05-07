import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  login as authLogin,
  logout as authLogout,
  getCurrentUser,
  registerUser,
} from "../utils/auth";

export default function useAuth() {
  const navigate = useNavigate();
  const [user, setUser] = useState(getCurrentUser());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const login = async (formData) => {
    setLoading(true);
    setError("");
    try {
      const loggedInUser = await authLogin(formData.email, formData.password);
      setUser(loggedInUser);
      navigate(loggedInUser.role === "doctor" ? "/doctor" : "/patient");
    } catch (err) {
      setError(err.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const register = async (formData) => {
    setLoading(true);
    setError("");
    try {
      await registerUser(formData);
      navigate("/login");
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const logout = useCallback(() => {
    authLogout();
    setUser(null);
    navigate("/login");
  }, [navigate]);

  return {
    user,
    loading,
    error,
    login,
    register,
    logout,
  };
}
