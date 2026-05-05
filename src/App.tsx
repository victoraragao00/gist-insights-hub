import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ClientProvider } from "@/context/ClientContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DashboardLayout } from "@/components/DashboardLayout";
import Index from "./pages/Index";
import ClientsPage from "./pages/ClientsPage";
import ClientDetailPage from "./pages/ClientDetailPage";
import DemandsPage from "./pages/DemandsPage";
import DemandDetailPage from "./pages/DemandDetailPage";
import TaskDetailPage from "./pages/TaskDetailPage";
import DemandsDashboardPage from "./pages/DemandsDashboardPage";
import SearchPage from "./pages/SearchPage";
import Audits from "./pages/Audits";
import AgendasPage from "./pages/AgendasPage";
import AgendaDetailPage from "./pages/AgendaDetailPage";
import SettingsPage from "./pages/SettingsPage";
import ProjectsPage from "./pages/ProjectsPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import PublicDemandsPage from "./pages/PublicDemandsPage";
import TechDashboardPage from "./pages/TechDashboardPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            {/* Public route — outside ProtectedRoute */}
            <Route path="/public/demands/:token" element={<PublicDemandsPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<ClientProvider><DashboardLayout /></ClientProvider>}>
                <Route path="/" element={<ErrorBoundary><Index /></ErrorBoundary>} />
                
                <Route path="/clients" element={<ErrorBoundary><ClientsPage /></ErrorBoundary>} />
                <Route path="/clients/:slug" element={<ErrorBoundary><ClientDetailPage /></ErrorBoundary>} />
                <Route path="/demands" element={<ErrorBoundary><DemandsPage /></ErrorBoundary>} />
                <Route path="/demands/dashboard" element={<ErrorBoundary><DemandsDashboardPage /></ErrorBoundary>} />
                <Route path="/demands/:id" element={<ErrorBoundary><DemandDetailPage /></ErrorBoundary>} />
                <Route path="/tasks/:id" element={<ErrorBoundary><TaskDetailPage /></ErrorBoundary>} />
                <Route path="/agendas" element={<ErrorBoundary><AgendasPage /></ErrorBoundary>} />
                <Route path="/agendas/:id" element={<ErrorBoundary><AgendaDetailPage /></ErrorBoundary>} />
                <Route path="/search" element={<ErrorBoundary><SearchPage /></ErrorBoundary>} />
                <Route path="/audits" element={<ErrorBoundary><Audits /></ErrorBoundary>} />
                <Route path="/settings" element={<ErrorBoundary><SettingsPage /></ErrorBoundary>} />
                <Route path="/projects" element={<ErrorBoundary><ProjectsPage /></ErrorBoundary>} />
                <Route path="/projects/:id" element={<ErrorBoundary><ProjectDetailPage /></ErrorBoundary>} />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
