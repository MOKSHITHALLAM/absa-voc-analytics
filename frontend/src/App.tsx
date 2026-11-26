import type { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Spinner } from "./components/ui";
import { useAuth } from "./context/AppProviders";
import { AppLayout } from "./layouts/AppLayout";
import { AnalyzePage } from "./pages/Analyze";
import { BatchPage } from "./pages/Batch";
import { DashboardPage } from "./pages/Dashboard";
import { LoginPage } from "./pages/Login";
import { ResearchPage } from "./pages/Research";
import { ReviewsPage } from "./pages/Reviews";

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="grid min-h-screen place-items-center"><Spinner label="Loading" /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route index element={<DashboardPage />} />
        <Route path="analyze" element={<AnalyzePage />} />
        <Route path="batch" element={<BatchPage />} />
        <Route path="reviews" element={<ReviewsPage />} />
        <Route path="research" element={<ResearchPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
