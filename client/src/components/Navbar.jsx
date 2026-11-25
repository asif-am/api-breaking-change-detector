import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const navLinkClass = ({ isActive }) =>
  `rounded-lg px-2 py-2 text-xs font-medium transition sm:px-3 sm:text-sm ${
    isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
  }`;

const mobileNavLinkClass = ({ isActive }) =>
  `block rounded-lg px-3 py-2 text-sm font-medium transition ${
    isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
  }`;

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  async function handleLogout() {
    setMenuOpen(false);
    try {
      await logout();
      toast.success('Signed out.');
    } catch {
      toast.error('Could not sign out. Please try again.');
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex h-16 items-center justify-between gap-2">
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-600 text-xs font-bold text-white">
              AB
            </span>
            <span className="hidden leading-tight sm:block">
              <span className="block text-sm font-bold text-slate-900">API Breaking Change Detector</span>
              <span className="block text-[11px] text-slate-500">OpenAPI compatibility analysis</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-0.5 md:flex sm:gap-1">
            <NavLink to="/" end className={navLinkClass}>
              Compare
            </NavLink>
            <NavLink to="/projects" className={navLinkClass}>
              Projects
            </NavLink>
            <NavLink to="/docs" className={navLinkClass}>
              Docs
            </NavLink>
          </nav>

          <div className="hidden shrink-0 items-center gap-1.5 md:flex">
            {user ? (
              <>
                <span className="hidden max-w-[8rem] truncate text-sm text-slate-600 lg:block">{user.name}</span>
                <button type="button" className="btn-ghost" onClick={handleLogout}>
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn-ghost">
                  Sign in
                </Link>
                <Link to="/register" className="btn-primary">
                  Create account
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-slate-600 transition hover:bg-slate-100 md:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-6 w-6"
                aria-hidden="true"
              >
                <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-6 w-6"
                aria-hidden="true"
              >
                <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </button>
        </div>

        {menuOpen ? (
          <div id="mobile-navigation" className="border-t border-slate-100 pb-3 pt-2 md:hidden">
            <nav className="flex flex-col gap-0.5">
              <NavLink to="/" end className={mobileNavLinkClass}>
                Compare
              </NavLink>
              <NavLink to="/projects" className={mobileNavLinkClass}>
                Projects
              </NavLink>
              <NavLink to="/docs" className={mobileNavLinkClass}>
                Docs
              </NavLink>
            </nav>

            <div className="mt-2 flex flex-col gap-2 border-t border-slate-100 pt-3">
              {user ? (
                <>
                  <p className="px-3 text-xs text-slate-500">
                    Signed in as <span className="font-semibold text-slate-800">{user.name}</span>
                  </p>
                  <button type="button" className="btn-secondary w-full" onClick={handleLogout}>
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="btn-secondary w-full">
                    Sign in
                  </Link>
                  <Link to="/register" className="btn-primary w-full">
                    Create account
                  </Link>
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
