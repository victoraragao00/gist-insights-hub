// Deprecated — feed de interações movido para /clients/:slug (tab Interações)
import { Navigate } from "react-router-dom";
export default function InteractionsPage() {
  return <Navigate to="/clients" replace />;
}
