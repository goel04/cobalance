import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import { ButtonLink, Card } from '@/components/ui';
import { cn } from '@/lib/cn';

export function SectionHeading({ eyebrow, title, description, center, className }: { eyebrow?: string; title: ReactNode; description?: ReactNode; center?: boolean; className?: string }) {
  return (
    <div className={cn('max-w-2xl', center && 'mx-auto text-center', className)}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{title}</h2>
      {description && <p className="mt-4 text-base leading-relaxed text-ink-muted">{description}</p>}
    </div>
  );
}

/** Top-of-page hero for inner marketing pages. */
export function PageHero({ eyebrow, title, description, icon: Icon, actions }: { eyebrow: string; title: ReactNode; description: ReactNode; icon?: LucideIcon; actions?: ReactNode }) {
  return (
    <section className="border-b border-line bg-gradient-to-b from-surface to-canvas">
      <div className="container-page py-16 sm:py-20">
        <div className="max-w-3xl">
          <div className="flex items-center gap-3">
            {Icon && (
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest-50 text-forest">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
            )}
            <p className="eyebrow">{eyebrow}</p>
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-ink sm:text-5xl">{title}</h1>
          <p className="mt-5 text-lg leading-relaxed text-ink-muted">{description}</p>
          {actions && <div className="mt-8 flex flex-wrap gap-3">{actions}</div>}
        </div>
      </div>
    </section>
  );
}

export function Section({ children, className, muted }: { children: ReactNode; className?: string; muted?: boolean }) {
  return (
    <section className={cn('py-16 sm:py-20', muted && 'border-y border-line bg-surface', className)}>
      <div className="container-page">{children}</div>
    </section>
  );
}

export function FeatureCard({ icon: Icon, title, children, to, linkLabel = 'Learn more' }: { icon: LucideIcon; title: string; children: ReactNode; to?: string; linkLabel?: string }) {
  const body = (
    <>
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest-50 text-forest">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <h3 className="mt-4 text-base font-semibold text-ink">{title}</h3>
      <div className="mt-2 text-sm leading-relaxed text-ink-muted">{children}</div>
      {to && (
        <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-forest">
          {linkLabel}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
      )}
    </>
  );
  if (to) {
    return (
      <Link to={to} className="group block h-full rounded-xl border border-line bg-surface p-6 shadow-card transition-all hover:-translate-y-0.5 hover:border-sage hover:shadow-pop">
        {body}
      </Link>
    );
  }
  return <Card className="h-full p-6">{body}</Card>;
}

export function IllustrativeLabel({ className, children = 'Illustrative sample data' }: { className?: string; children?: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800', className)}>
      {children}
    </span>
  );
}

export function CtaBand({ title, description, cta, to }: { title: string; description: string; cta: string; to: string }) {
  return (
    <section className="py-16 sm:py-20">
      <div className="container-page">
        <div className="rounded-2xl bg-forest-deep px-6 py-12 text-center sm:px-12 sm:py-16">
          <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">{title}</h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-sage-light/90">{description}</p>
          <div className="mt-8 flex justify-center">
            <ButtonLink to={to} size="lg" className="bg-white text-forest-deep hover:bg-sage-light">
              {cta}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}

export function CheckList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-3">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3 text-sm leading-relaxed text-ink">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest" aria-hidden />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

/** Prose wrapper for long-form pages (legal, resources). */
export function Prose({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-3xl space-y-4 text-[15px] leading-relaxed text-ink [&_a]:font-medium [&_a]:text-forest [&_a:hover]:underline [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h3]:mt-6 [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_p]:text-ink/90 [&_ul]:space-y-2">
      {children}
    </div>
  );
}
