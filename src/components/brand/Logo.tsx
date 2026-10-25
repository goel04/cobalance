import { cn } from '@/lib/cn';

/** Cobalance mark: a circle split into two balanced halves, one shaped like a leaf. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn('h-8 w-8 shrink-0', className)}>
      <rect width="32" height="32" rx="8" fill="#236B45" />
      <path d="M16 6c5.5 0 10 4.5 10 10s-4.5 10-10 10V6z" fill="#A7C4A0" />
      <path d="M16 26c-5.5 0-10-4.5-10-10S10.5 6 16 6c-3 2.6-4.5 6-4.5 10s1.5 7.4 4.5 10z" fill="#fff" />
    </svg>
  );
}

export function Logo({ className, light = false }: { className?: string; light?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark />
      <span className={cn('text-lg font-semibold tracking-tight', light ? 'text-white' : 'text-ink')}>Cobalance</span>
    </span>
  );
}
