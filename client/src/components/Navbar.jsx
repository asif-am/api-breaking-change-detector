import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const LINKS = [
  ['/', 'Compare', true],
  ['/projects', 'Projects'],
  ['/docs', 'Docs'],
];

const linkClass = ({ isActive }) =>
  `rounded-md px-2.5 py-1.5 text-[13px] transition-colors ${
    isActive ? 'bg-sunken font-medium text-ink' : 'text-graphite hover:text-ink'
  }`;

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  async function handleLogout() {
    setMenuOpen(false);
    try {
      await logout();
      toast.success('Signed out.');
    } catch {
      toast.error('Could not sign out. Please try again.');
    }
  }

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded focus:bg-ink focus:px-3 focus:py-2 focus:text-[13px] focus:text-paper"
      >
        Skip to content
      </a>

      <div className="wrap flex h-14 items-center justify-between gap-4">
        <Link to="/" className="flex min-w-0 items-center gap-2.5">
          <span
            className="grid h-6 w-6 shrink-0 place-items-center rounded bg-ink font-mono text-[12px] leading-none text-paper"
            aria-hidden="true"
          >
            Δ
          </span>
          <span className="truncate text-[13px] font-medium tracking-[-0.005em]">API Breaking Change Detector</span>
        </Link>

        <nav className="hidden items-center gap-0.5 md:flex" aria-label="Main">
          {LINKS.map(([to, label, end]) => (
            <NavLink key={to} to={to} end={end} className={linkClass}>
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden shrink-0 items-center gap-2 md:flex">
          {user ? (
            <>
              <span className="max-w-[9rem] truncate text-[13px] text-graphite">{user.name}</span>
              <button type="button" className="btn btn-secondary" onClick={handleLogout}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-quiet text-[13px]">
                Sign in
              </Link>
              <Link to="/register" className="btn btn-primary">
                Create account
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="grid h-9 w-9 place-items-center rounded-md border border-line text-graphite transition-colors hover:text-ink md:hidden"
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4" aria-hidden="true">
            <path strokeLinecap="round" d={menuOpen ? 'M5 5l10 10M15 5L5 15' : 'M3 6h14M3 10h14M3 14h14'} />
          </svg>
        </button>
      </div>

      {menuOpen ? (
        <div id="mobile-navigation" className="wrap border-t border-line pb-4 pt-3 md:hidden">
          <nav className="flex flex-col" aria-label="Main">
            {LINKS.map(([to, label, end]) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `rounded-md px-2 py-2 text-sm transition-colors ${
                    isActive ? 'bg-sunken font-medium text-ink' : 'text-graphite hover:text-ink'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
            {user ? (
              <>
                <p className="px-2 text-[12px] text-muted">
                  Signed in as <span className="text-graphite">{user.name}</span>
                </p>
                <button type="button" className="btn btn-secondary" onClick={handleLogout}>
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-secondary" onClick={closeMenu}>
                  Sign in
                </Link>
                <Link to="/register" className="btn btn-primary" onClick={closeMenu}>
                  Create account
                </Link>
              </>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
