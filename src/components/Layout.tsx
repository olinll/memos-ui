import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, Home, Archive, LogOut, User, PenSquare } from 'lucide-react';

export default function Layout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const navItems = [
    { to: '/', icon: Home, label: '首页' },
    { to: '/archived', icon: Archive, label: '归档' },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-60 bg-surface border-r border-border flex flex-col fixed h-full">
        <div className="p-5 flex items-center gap-2.5">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg text-text-primary">Memos</span>
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
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
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
        <div className="max-w-3xl mx-auto px-6 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
