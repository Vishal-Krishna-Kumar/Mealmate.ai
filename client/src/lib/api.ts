import axios, { AxiosError, type AxiosInstance } from 'axios';
import { useAuthStore } from '@/stores/authStore';

const baseURL = import.meta.env.VITE_API_URL ?? '/api';

export const api: AxiosInstance = axios.create({
  baseURL,
  timeout: 15_000,
});

// Attach JWT to outgoing requests.
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-logout on 401 and surface a friendly message.
api.interceptors.response.use(
  (res) => res,
  (error: AxiosError<{ message?: string }>) => {
    if (error.response?.status === 401) {
      const { token, logout } = useAuthStore.getState();
      // Only force logout if we actually had a token (not for failed login attempts).
      if (token) logout();
    }
    return Promise.reject(error);
  }
);

export function extractErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string; details?: unknown } | undefined;
    if (data?.message) return data.message;
    if (err.message) return err.message;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}
