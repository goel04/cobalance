import { forwardRef, useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Info, Loader2, X, XCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

// ── Button ───────────────────────────────────────────────────────────────

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-forest text-white hover:bg-forest-deep shadow-sm',
  secondary: 'bg-sage-light text-forest-deep hover:bg-sage/60',
  outline: 'border border-line bg-surface text-ink hover:bg-canvas hover:border-sage',
  ghost: 'text-ink hover:bg-forest-50',
  danger: 'bg-red-600 text-white hover:bg-red-700',
};
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
};

export const buttonClass = (variant: Variant = 'primary', size: Size = 'md', className?: string) =>
  cn(
    'inline-flex items-center justify-center rounded-lg font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap',
    variants[variant],
    sizes[size],
    className,
  );

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, loading, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={buttonClass(variant, size, className)} disabled={disabled || loading} {...rest}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

export function ButtonLink({ variant, size, className, ...rest }: LinkProps & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}

// ── Card ─────────────────────────────────────────────────────────────────

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-xl border border-line bg-surface shadow-card', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, description, action, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4', className)}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

// ── Form controls ────────────────────────────────────────────────────────

const control =
  'block w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-muted/70 transition-colors focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20 disabled:bg-canvas disabled:text-ink-muted aria-[invalid=true]:border-red-400';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(control, 'h-10', className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cn(control, 'h-10 pr-8', className)} {...rest}>
      {children}
    </select>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn(control, 'min-h-[80px] py-2', className)} {...rest} />;
});

/** Label + control + hint/error, wired with ids for accessibility. Pass a render function to receive the id. */
export function Field({
  label,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string }) => ReactNode;
}) {
  const id = useId();
  const descId = `${id}-desc`;
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </label>
      {children({ id, 'aria-invalid': !!error, 'aria-describedby': error || hint ? descId : undefined })}
      {error ? (
        <p id={descId} className="text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={descId} className="text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

// ── Badge ────────────────────────────────────────────────────────────────

type Tone = 'neutral' | 'green' | 'amber' | 'red' | 'blue' | 'sage';
const tones: Record<Tone, string> = {
  neutral: 'bg-canvas text-ink-muted border-line',
  green: 'bg-forest-50 text-forest-deep border-forest-100',
  sage: 'bg-sage-light text-forest-deep border-sage/50',
  amber: 'bg-amber-50 text-amber-800 border-amber-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  blue: 'bg-sky-50 text-sky-800 border-sky-200',
};

export function Badge({ tone = 'neutral', className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap', tones[tone], className)}>{children}</span>;
}

// ── Notice ───────────────────────────────────────────────────────────────

const noticeStyles = {
  info: { cls: 'border-sky-200 bg-sky-50 text-sky-900', Icon: Info },
  warning: { cls: 'border-amber-200 bg-amber-50 text-amber-900', Icon: AlertTriangle },
  error: { cls: 'border-red-200 bg-red-50 text-red-900', Icon: XCircle },
  success: { cls: 'border-forest-100 bg-forest-50 text-forest-deep', Icon: CheckCircle2 },
};

export function Notice({ tone = 'info', title, children, className }: { tone?: keyof typeof noticeStyles; title?: ReactNode; children?: ReactNode; className?: string }) {
  const { cls, Icon } = noticeStyles[tone];
  return (
    <div className={cn('flex gap-3 rounded-lg border px-4 py-3 text-sm', cls, className)} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 space-y-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className="opacity-90">{children}</div>}
      </div>
    </div>
  );
}

// ── Dialog ───────────────────────────────────────────────────────────────

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className={cn(
        'm-auto w-[calc(100%-2rem)] rounded-xl border border-line bg-surface p-0 text-ink shadow-pop backdrop:bg-ink/40',
        wide ? 'max-w-3xl' : 'max-w-lg',
      )}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <h2 className="text-base font-semibold">{title}</h2>
              {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
            </div>
            <button type="button" onClick={onClose} className="rounded-md p-1 text-ink-muted hover:bg-canvas hover:text-ink" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

// ── Tabs ─────────────────────────────────────────────────────────────────

export function Tabs<T extends string>({ value, onChange, items, className }: { value: T; onChange: (v: T) => void; items: { value: T; label: ReactNode }[]; className?: string }) {
  return (
    <div role="tablist" className={cn('inline-flex flex-wrap gap-1 rounded-lg border border-line bg-surface p-1', className)}>
      {items.map((it) => (
        <button
          key={it.value}
          role="tab"
          type="button"
          aria-selected={value === it.value}
          onClick={() => onChange(it.value)}
          onKeyDown={(e) => {
            const i = items.findIndex((x) => x.value === value);
            if (e.key === 'ArrowRight') onChange(items[(i + 1) % items.length].value);
            if (e.key === 'ArrowLeft') onChange(items[(i - 1 + items.length) % items.length].value);
          }}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            value === it.value ? 'bg-forest text-white shadow-sm' : 'text-ink-muted hover:bg-canvas hover:text-ink',
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      {icon && <div className="mb-3 rounded-full bg-forest-50 p-3 text-forest">{icon}</div>}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ── Stat ─────────────────────────────────────────────────────────────────

export function Stat({ label, value, sub, icon, className }: { label: ReactNode; value: ReactNode; sub?: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <Card className={cn('p-4', className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</p>
        {icon && <span className="text-forest">{icon}</span>}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-muted">{sub}</p>}
    </Card>
  );
}

// ── Table helpers ────────────────────────────────────────────────────────

export const th = 'px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted whitespace-nowrap';
export const td = 'px-3 py-2.5 text-sm text-ink align-top';

export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
