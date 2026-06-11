import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './hooks/useAuth'
import AuthPage from './pages/AuthPage'
import DashboardLayout from './components/layout/DashboardLayout'
import PortfolioPage from './pages/PortfolioPage'
import BacktestPage from './pages/BacktestPage'
import StrategyPage from './pages/StrategyPage'
import PaperTradePage from './pages/PaperTradePage'
import AnalyticsPage from './pages/AnalyticsPage'
import LandingPage from './pages/LandingPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import NotFoundPage from './pages/NotFoundPage'
import ErrorBoundary from './components/ErrorBoundary'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="h-screen flex items-center justify-center">
      <div className="spinner w-8 h-8" />
    </div>
  )
  return user ? children : <Navigate to="/auth" replace />
}

function AppRoutes() {
  const { user, loading } = useAuth()
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth" element={
        loading ? (
          <div className="h-screen flex items-center justify-center" style={{ background: '#0a0a0f' }}>
            <div className="spinner w-8 h-8" />
          </div>
        ) : user ? (
          <Navigate to="/dashboard" replace />
        ) : (
          <AuthPage />
        )
      } />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route index element={<PortfolioPage />} />
        <Route path="backtest" element={<BacktestPage />} />
        <Route path="strategy" element={<StrategyPage />} />
        <Route path="paper" element={<PaperTradePage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
      </Route>
      {/* 404 catch-all */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 }
  }
})

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
            <Toaster position="bottom-right" />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
