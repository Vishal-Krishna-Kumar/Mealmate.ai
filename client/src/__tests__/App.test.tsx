import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '../App';
import { useAuthStore } from '@/stores/authStore';

function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('App routing', () => {
  beforeEach(() => {
    useAuthStore.setState({ token: null, user: null });
    localStorage.clear();
  });

  it('renders the public home page', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/plan smarter/i);
  });

  it('shows the login form on /login', () => {
    renderAt('/login');
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('shows the register form on /register', () => {
    renderAt('/register');
    expect(screen.getByRole('heading', { name: /create your account/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
  });

  it('redirects unauthenticated users away from /planner', () => {
    renderAt('/planner');
    // Should land on login page.
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
  });

  it('renders a protected page when authenticated', () => {
    useAuthStore.setState({
      token: 'fake-token',
      user: {
        id: '1',
        name: 'Test',
        email: 't@x.com',
        role: 'user',
        pantry: [],
        dietaryPreferences: [],
        allergies: [],
      },
    });
    renderAt('/planner');
    expect(screen.getByRole('heading', { name: /meal planner/i })).toBeInTheDocument();
  });

  it('renders 404 for unknown routes', () => {
    renderAt('/no-such-page');
    expect(screen.getByRole('heading', { name: /page not found/i })).toBeInTheDocument();
  });
});
