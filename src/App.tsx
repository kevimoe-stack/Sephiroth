import { Suspense, lazy } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";

const Index = lazy(() => import("@/pages/Index"));
const StrategiesPage = lazy(() => import("@/pages/StrategiesPage"));
const StrategyDetailPage = lazy(() => import("@/pages/StrategyDetailPage"));
const BacktestsPage = lazy(() => import("@/pages/BacktestsPage"));
const WalkForwardPage = lazy(() => import("@/pages/WalkForwardPage"));
const ChampionPage = lazy(() => import("@/pages/ChampionPage"));
const PaperTradingPage = lazy(() => import("@/pages/PaperTradingPage"));
const ExecutionPage = lazy(() => import("@/pages/ExecutionPage"));
const AgentPage = lazy(() => import("@/pages/AgentPage"));
const GuidePage = lazy(() => import("@/pages/GuidePage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const queryClient = new QueryClient();

function RouteFallback() {
  return <div className="rounded-xl bg-muted p-6 text-sm text-slate-500">Seite wird geladen...</div>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<Index />} />
              <Route path="/dashboard" element={<Navigate to="/" replace />} />
              <Route path="/strategies" element={<StrategiesPage />} />
              <Route path="/strategies/:id" element={<StrategyDetailPage />} />
              <Route path="/backtests" element={<BacktestsPage />} />
              <Route path="/walkforward" element={<WalkForwardPage />} />
              <Route path="/champion" element={<ChampionPage />} />
              <Route path="/paper-trading" element={<PaperTradingPage />} />
              <Route path="/execution" element={<ExecutionPage />} />
              <Route path="/agent" element={<AgentPage />} />
              <Route path="/guide" element={<GuidePage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
