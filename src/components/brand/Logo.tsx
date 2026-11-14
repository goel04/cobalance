import { cn } from '@/lib/cn';

/** Cobalance mark: a circle split into two balanced halves, one shaped like a leaf. Colours follow the active theme. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn('h-8 w-8 shrink-0', className)}>
      <rect width="32" height="32" rx="8" style={{ fill: 'var(--logo-bg)' }} />
      <path d="M16 6c5.5 0 10 4.5 10 10s-4.5 10-10 10V6z" style={{ fill: 'var(--logo-a)' }} />
      <path d="M16 26c-5.5 0-10-4.5-10-10S10.5 6 16 6c-3 2.6-4.5 6-4.5 10s1.5 7.4 4.5 10z" style={{ fill: 'var(--logo-b)' }} />
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

/** Space-theme wordmark: mint mark + letter-spaced uppercase name. */
export function SpaceBrand({ className }: { className?: string }) {
  return (
    <span className={cn('brand', className)}>
      <LogoMark className="h-7 w-7" />
      Cobalance
    </span>
  );
}

/** Header wordmark: name only (no mark) with the tagline underneath. */
export function HeaderBrand({ className }: { className?: string }) {
  return (
    <span className={cn('brand-stack', className)}>
      <span className="brand">Cobalance</span>
      <span className="brand-tagline">Balance out carbon</span>
    </span>
  );
}
