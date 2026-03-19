import { useEffect } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const BOOTSTRAP_KEY = "bootstrap-user-access-done";

export function ProtectedRoute() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!user) return;
    if (sessionStorage.getItem(BOOTSTRAP_KEY)) return;

    sessionStorage.setItem(BOOTSTRAP_KEY, "1");

    supabase.functions
      .invoke("bootstrap-user-access")
      .catch(() => {
        // fire-and-forget — don't block the user
      });
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
