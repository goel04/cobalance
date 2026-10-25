import { useSyncExternalStore } from 'react';
import { CheckCircle2, X, XCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

interface Toast {
  id: number;
  tone: 'success' | 'error';
  message: string;
}

let toasts: Toast[] = [];
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function toast(message: string, tone: Toast['tone'] = 'success') {
  const id = ++seq;
  toasts = [...toasts, { id, tone, message }].slice(-3);
  emit();
  setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 4000);
}

/** Run an action and report failures (permission, validation, storage) as an error toast. */
export function attempt<T>(fn: () => T, success?: string): T | undefined {
  try {
    const out = fn();
    if (success) toast(success);
    return out;
  } catch (e) {
    toast(e instanceof Error ? e.message : 'Something went wrong.', 'error');
    return undefined;
  }
}

export function Toaster() {
  const list = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => toasts,
  );
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2" aria-live="polite">
      {list.map((t) => (
        <div
          key={t.id}
          className={cn(
            'pointer-events-auto flex items-start gap-3 rounded-lg border bg-surface px-4 py-3 text-sm shadow-pop',
            t.tone === 'success' ? 'border-forest-100' : 'border-red-200',
          )}
          role={t.tone === 'error' ? 'alert' : 'status'}
        >
          {t.tone === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-forest" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />}
          <p className="flex-1 text-ink">{t.message}</p>
          <button onClick={() => dismiss(t.id)} className="text-ink-muted hover:text-ink" aria-label="Dismiss notification">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
