import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useLogout } from '@/hooks/useAuth';
import { cn } from '@/lib/cn';

const links = [
  { to: '/recipes', label: 'Recipes' },
  { to: '/planner', label: 'Planner' },
  { to: '/grocery', label: 'Grocery' },
  { to: '/nutrition', label: 'Nutrition' },
  { to: '/pantry', label: 'Pantry' },
];

export function Navbar() {
  const user = useAuthStore((s) => s.user);
  const isAuthed = useAuthStore((s) => Boolean(s.token));
  const logout = useLogout();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <nav className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link to="/" className="group flex items-center gap-2.5">
          <span
            aria-hidden
            className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 font-serif text-sm font-semibold text-white shadow-soft transition group-hover:bg-brand-700"
          >
            M
          </span>
          <span className="font-serif text-xl font-semibold tracking-tight text-ink">
            Meal<span className="text-brand-700">Mate</span>
          </span>
        </Link>

        {isAuthed && (
          <ul className="hidden items-center gap-0.5 md:flex">
            {links.map((l) => (
              <li key={l.to}>
                <NavLink
                  to={l.to}
                  className={({ isActive }) =>
                    cn(
                      'rounded-full px-3.5 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-brand-50 text-brand-800'
                        : 'text-ink-soft hover:bg-canvas-soft hover:text-ink'
                    )
                  }
                >
                  {l.label}
                </NavLink>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center gap-2">
          {isAuthed ? (
            <>
              <span className="hidden text-sm text-ink-soft sm:inline">
                Hi, <span className="font-medium text-ink">{user?.name ?? 'there'}</span>
              </span>
              <button
                onClick={handleLogout}
                className="rounded-full px-3 py-2 text-sm font-medium text-ink-soft hover:bg-canvas-soft hover:text-ink"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="rounded-full px-3 py-2 text-sm font-medium text-ink-soft hover:bg-canvas-soft hover:text-ink"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-canvas shadow-soft transition hover:bg-brand-700"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
