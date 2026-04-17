import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import PublicLayout from './components/PublicLayout';
import Login from './pages/Login';
import Home from './pages/Home';
import Archived from './pages/Archived';
import WritePage from './pages/Write';
import MemoDetail from './pages/MemoDetail';
import Attachments from './pages/Attachments';
import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// Picks the full sidebar layout for logged-in users, or a minimal public
// shell for anonymous visitors. Used by routes that accept both audiences.
function PublicOrAuthShell() {
  const { user } = useAuth();
  return user ? <Layout /> : <PublicLayout />;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />

      {/* Default mode is visitor: home + single memo detail require no login. */}
      <Route element={<PublicOrAuthShell />}>
        <Route path="/" element={<Home />} />
        <Route path="/memo/*" element={<MemoDetail />} />
      </Route>

      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route path="/write" element={<WritePage />} />
        <Route path="/edit/*" element={<WritePage />} />
        <Route path="/archived" element={<Archived />} />
        <Route path="/attachments" element={<Attachments />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
      </AuthProvider>
    </BrowserRouter>
  );
}
