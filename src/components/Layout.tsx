import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../hooks/useWorkspace';
import { Home, Archive, LogOut, PenSquare, Paperclip, BookOpen } from 'lucide-react';
import { isDiaryEnabled } from '../config/diary';

export default function Layout() {
  const { user, signOut } = useAuth();
  const { title, logoUrl } = useWorkspace();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const navItems = [
    { to: '/', icon: Home, label: '首页' },
    ...(isDiaryEnabled() ? [{ to: '/diary', icon: BookOpen, label: '日记' }] : []),
    { to: '/attachments', icon: Paperclip, label: '附件' },
    { to: '/archived', icon: Archive, label: '归档' },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-60 bg-surface border-r border-border flex flex-col fixed h-full">
        <div className="p-5 flex items-center gap-2.5">
          <img
            src={logoUrl || '/logo.webp'}
            alt={title}
            className="w-8 h-8 rounded-lg object-cover"
          />
          <span className="font-bold text-lg text-text-primary truncate">{title}</span>
        </div>

        <nav className="flex-1 px-3 space-y-0.5">
          <NavLink
            to="/write"
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary-hover transition mb-3 shadow-sm"
          >
            <PenSquare className="w-4 h-4" />
            写 Memo
          </NavLink>
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? 'bg-tag text-primary'
                    : 'text-text-secondary hover:bg-surface-secondary hover:text-text-primary'
                }`
              }
            >
              <Icon className="w-4.5 h-4.5" />
              {label}
            </NavLink>
          ))}
        </nav>

        {user && (
          <div className="p-3 border-t border-border">
            <div className="flex items-center gap-2.5 px-3 py-2">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.displayName || user.username}
                  className="w-8 h-8 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-sm font-medium">
                  {(user.displayName || user.username || '?').slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">
                  {user.displayName || user.username}
                </p>
              </div>
              <button
                onClick={handleSignOut}
                className="p-1.5 rounded-lg text-text-secondary hover:text-red-500 hover:bg-red-50 transition"
                title="退出登录"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-60">
        <div className="max-w-[1200px] mx-auto px-6 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
