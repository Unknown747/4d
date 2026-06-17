import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastCtx {
  toast: (msg: string, type?: ToastType) => void;
}

const Ctx = createContext<ToastCtx>({ toast: () => {} });

const ICONS: Record<ToastType, string> = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
};

const COLORS: Record<ToastType, string> = {
  success: 'border-green-600 bg-green-900/30 text-green-300',
  error:   'border-red-600   bg-red-900/30   text-red-300',
  warning: 'border-amber-600 bg-amber-900/30 text-amber-300',
  info:    'border-blue-600  bg-blue-900/30  text-blue-300',
};

let _nextId = 1;

function ToastItem({ t, onClose }: { t: Toast; onClose: (id: number) => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => onClose(t.id), 3500);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [t.id, onClose]);

  return (
    <div
      className={`flex items-start gap-2.5 px-4 py-3 rounded-xl border shadow-xl text-sm font-medium
        animate-[slideIn_0.25s_ease] ${COLORS[t.type]}`}
      style={{ minWidth: '260px', maxWidth: '360px' }}
    >
      <span className="text-base shrink-0">{ICONS[t.type]}</span>
      <span className="flex-1 leading-snug">{t.message}</span>
      <button onClick={() => onClose(t.id)} className="opacity-50 hover:opacity-100 shrink-0 text-base leading-none">×</button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = _nextId++;
    setToasts(prev => [...prev.slice(-4), { id, type, message }]);
  }, []);

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 items-end pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem t={t} onClose={remove} />
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}
