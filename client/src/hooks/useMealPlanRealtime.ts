import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/authStore';

let socket: Socket | null = null;

function getSocket(token: string | null): Socket | null {
  if (!token) return null;
  if (socket && socket.connected) return socket;
  if (socket) socket.disconnect();
  socket = io({
    path: '/api/realtime',
    transports: ['websocket', 'polling'],
    auth: { token },
    reconnection: true,
  });
  return socket;
}

/**
 * Subscribe the current user to live updates for a meal plan. Whenever another
 * client edits the same plan, React-Query caches for that plan / week / groceries
 * are invalidated so the UI refreshes automatically.
 */
export function useMealPlanRealtime(mealPlanId: string | undefined): void {
  const token = useAuthStore((s) => s.token);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!mealPlanId || !token) return;
    const s = getSocket(token);
    if (!s) return;

    const handleUpdate = () => {
      void queryClient.invalidateQueries({ queryKey: ['mealPlan', mealPlanId] });
      void queryClient.invalidateQueries({ queryKey: ['mealPlans'] });
      void queryClient.invalidateQueries({ queryKey: ['grocery', mealPlanId] });
      void queryClient.invalidateQueries({ queryKey: ['nutrition', mealPlanId] });
    };
    const handleDelete = () => {
      void queryClient.invalidateQueries({ queryKey: ['mealPlans'] });
    };

    s.emit('mealplan:join', mealPlanId);
    s.on('mealplan:updated', handleUpdate);
    s.on('mealplan:deleted', handleDelete);

    return () => {
      s.emit('mealplan:leave', mealPlanId);
      s.off('mealplan:updated', handleUpdate);
      s.off('mealplan:deleted', handleDelete);
    };
  }, [mealPlanId, token, queryClient]);
}
