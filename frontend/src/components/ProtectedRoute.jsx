import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 40 }}>Chargement...</div>;
  if (!user) return <Navigate to="/connexion" replace />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={user.role === "employe" ? "/admin" : "/"} replace />;
  }
  return children;
}
