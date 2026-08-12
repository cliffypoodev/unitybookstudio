import './styles/globals-notebook.css';
// TOASTMOUNT-1: the app fires toast.* from sonner in 31+ files, but only the
// unused shadcn toaster (driven by useToast, which nothing calls) was mounted —
// every success/error notification was silently swallowed. Mount sonner's
// Toaster directly (not the ui/sonner wrapper: that one calls next-themes'
// useTheme, and this app uses its own ThemeProvider, not next-themes).
import { Toaster } from "sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import ThemeProvider from '@/components/notebook/ThemeProvider';
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import ProjectStudio from './pages/ProjectStudio';
import ImportCatalog from './pages/ImportCatalog';
import SeriesManager from './pages/SeriesManager';
import React, { useState, useEffect } from 'react';
import FloatingBrainstorm from '@/components/FloatingBrainstorm';
import { useUserSettings } from '@/lib/userSettings';
// Add page imports here

// ── Migration banner ────────────────────────────────────────────────────

function MigrationBanner() {
  const [message, setMessage] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { runServerMigration } = await import('@/lib/serverMigration');
        const result = await runServerMigration();
        if (!cancelled && result.migrated) {
          setMessage('Library migrated to server storage — all your devices now share it.');
        }
      } catch (err) {
        console.warn('[MIGRATION] Failed:', err.message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!message) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99999,
      background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
      color: 'white', padding: '12px 20px', textAlign: 'center',
      fontWeight: 600, fontSize: '14px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
    }}>
      <span>✅ {message}</span>
      <button
        onClick={() => setMessage(null)}
        style={{
          background: 'rgba(255,255,255,0.25)', border: 'none', color: 'white',
          borderRadius: '4px', padding: '4px 12px', cursor: 'pointer',
          fontSize: '12px', fontWeight: 700,
        }}
      >
        Dismiss
      </button>
    </div>
  );
}

// WAVE5-SETTINGS: FloatingBrainstorm existed but was never mounted, so its
// Settings toggle was a no-op. Gated mount — reads the setting on each render
// (the hook is reactive within a session; a toggle applies on next navigation).
function BrainstormGate() {
  const { settings } = useUserSettings();
  if (!settings.enable_floating_brainstorm) return null;
  return <FloatingBrainstorm />;
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/landing" element={<Home />} />
      <Route path="/projects/:projectId" element={<ProjectStudio />} />
      <Route path="/import-catalog" element={<ImportCatalog />} />
      <Route path="/series" element={<SeriesManager />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <ThemeProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <MigrationBanner />
            <AuthenticatedApp />
            <BrainstormGate />
          </Router>
          <Toaster richColors closeButton />
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App