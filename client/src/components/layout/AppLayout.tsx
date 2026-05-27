import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Navbar } from './Navbar';
import { AiAssistant } from '@/components/ai/AiAssistant';
import { useAuthStore } from '@/stores/authStore';

export function AppLayout() {
  const location = useLocation();
  const isAuthed = useAuthStore((s) => Boolean(s.token && s.user));
  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
      <footer className="border-t border-line bg-canvas-soft py-5 text-center">
        <p className="text-xs tracking-wide text-ink-mute">
          <span className="font-serif italic text-ink-soft">MealMate</span> · CS628 Team T03 ·{' '}
          {new Date().getFullYear()}
        </p>
      </footer>
      {isAuthed && <AiAssistant />}
    </div>
  );
}
