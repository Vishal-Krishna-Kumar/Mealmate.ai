import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GroceryDetailPage } from '../pages/GroceryDetailPage';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, api: { get: vi.fn(), patch: vi.fn(), delete: vi.fn() } };
});

const get = api.get as unknown as ReturnType<typeof vi.fn>;
const patch = api.patch as unknown as ReturnType<typeof vi.fn>;

function renderAt(id: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/grocery/${id}`]}>
        <Routes>
          <Route path="/grocery/:id" element={<GroceryDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('GroceryDetailPage', () => {
  beforeEach(() => {
    get.mockReset();
    patch.mockReset();
    useAuthStore.setState({
      token: 'fake',
      user: {
        id: 'u1',
        name: 'Test',
        email: 't@x.com',
        role: 'user',
        pantry: [],
        dietaryPreferences: [],
        allergies: [],
      },
    });
  });

  const sampleList = {
    id: 'g1',
    user: 'u1',
    mealPlan: 'p1',
    items: [
      { _id: 'i1', ingredient: 'tomato', category: 'produce', checked: false, quantity: 4 },
      { _id: 'i2', ingredient: 'chicken', category: 'meat', checked: false, quantity: 300, unit: 'g' },
      { _id: 'i3', ingredient: 'milk', category: 'dairy', checked: true, quantity: 1, unit: 'l' },
    ],
  };

  it('groups items by category and shows progress', async () => {
    get.mockResolvedValueOnce({ data: { list: sampleList } });

    renderAt('g1');
    expect(await screen.findByText(/produce/i)).toBeInTheDocument();
    expect(screen.getByText(/meat/i)).toBeInTheDocument();
    expect(screen.getByText(/dairy/i)).toBeInTheDocument();
    expect(screen.getByText(/1 of 3 items purchased/i)).toBeInTheDocument();
  });

  it('toggles a checkbox and patches the API', async () => {
    get.mockResolvedValue({ data: { list: sampleList } });
    patch.mockResolvedValue({
      data: {
        list: {
          ...sampleList,
          items: sampleList.items.map((i) =>
            i._id === 'i1' ? { ...i, checked: true } : i
          ),
        },
      },
    });

    renderAt('g1');
    const tomato = await screen.findByText('tomato');
    const checkbox = tomato.parentElement?.querySelector('input[type="checkbox"]');
    expect(checkbox).toBeTruthy();
    await userEvent.setup().click(checkbox!);

    await waitFor(() => {
      expect(patch).toHaveBeenCalledWith(
        '/grocery/g1/items',
        expect.objectContaining({ itemId: 'i1', checked: true })
      );
    });
  });
});
