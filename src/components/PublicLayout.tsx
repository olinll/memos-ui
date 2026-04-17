import { Outlet, Link } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../hooks/useWorkspace';

export default function PublicLayout() {
  const { user } = useAuth();
  const { title, logoUrl } = useWorkspace();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-10 bg-surface/90 backdrop-blur border-b border-border">
        <div className="max-w-[900px] mx-auto px-6 h-14 flex items-center justify-between">
          <Link to={user ? '/' : '/login'} className="flex items-center gap-2">
            <img
              src={logoUrl || '/logo.webp'}
              alt={title}
              className="w-7 h-7 rounded-lg object-cover"
            />
            <span className="font-bold text-text-primary truncate">{title}</span>
          </Link>
          {!user && (
            <Link
              to="/login"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-text-secondary hover:text-primary hover:bg-tag transition"
            >
              <LogIn className="w-4 h-4" />
              登录
            </Link>
          )}
        </div>
      </header>
      <main className="flex-1">
        <div className="max-w-[900px] mx-auto px-6 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
