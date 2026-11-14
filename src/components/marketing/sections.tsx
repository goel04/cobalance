import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { rd } from './space';

export function SectionHeading({ eyebrow, title, description, center, className }: { eyebrow?: string; title: ReactNode; description?: ReactNode; center?: boolean; className?: string }) {
  return (
    <div className={cn('max-w-2xl', center && 'mx-auto text-center', className)}>
      {eyebrow && (
        <p className="eyebrow mb-4" data-reveal>
          {eyebrow}
        </p>
      )}
      <h2 className="sp-h2" data-reveal style={rd(80)}>
        {title}
      </h2>
      {description && (
        <p className="sp-lead" data-reveal style={rd(160)}>
          {description}
        </p>
      )}
    </div>
  );
}

/** Top-of-page hero for inner marketing pages. */
export function PageHero({ eyebrow, title, description, icon: Icon, actions }: { eyebrow: string; title: ReactNode; description: ReactNode; icon?: LucideIcon; actions?: ReactNode }) {
  return (
    <section className="sp-page-hero">
      <div className="flex items-center gap-3" data-reveal style={rd(0)}>
        {Icon && (
          <span className="card-icon !mb-0 !h-10 !w-10">
            <Icon aria-hidden />
          </span>
        )}
        <p className="eyebrow">{eyebrow}</p>
      </div>
      <h1 className="mt-6" data-reveal style={rd(80)}>
        {title}
      </h1>
      <p className="sp-lead" data-reveal style={rd(160)}>
        {description}
      </p>
      {actions && (
        <div className="mt-9 flex flex-wrap gap-3" data-reveal style={rd(240)}>
          {actions}
        </div>
      )}
    </section>
  );
}

export function Section({ children, className, muted }: { children: ReactNode; className?: string; muted?: boolean }) {
  return (
    <section className={cn('relative py-16 sm:py-24', muted && 'border-y border-line bg-white/[0.015]', className)}>
      <div className="container-page">{children}</div>
    </section>
  );
}

export function FeatureCard({ icon: Icon, title, children, to, linkLabel = 'Learn more', delay = 0 }: { icon: LucideIcon; title: string; children: ReactNode; to?: string; linkLabel?: string; delay?: number }) {
  const body = (
    <>
      <span className="card-icon">
        <Icon aria-hidden />
      </span>
      <h3>{title}</h3>
      <div className="mt-2.5 text-[15px] leading-relaxed text-ink-muted">{children}</div>
      {to && (
        <span className="sp-card-link">
          {linkLabel}
          <ArrowRight aria-hidden />
        </span>
      )}
    </>
  );
  if (to) {
    return (
      <Link to={to} className="sp-card h-full" data-reveal style={rd(delay)}>
        {body}
      </Link>
    );
  }
  return (
    <div className="sp-card h-full" data-reveal style={rd(delay)}>
      {body}
    </div>
  );
}

export function IllustrativeLabel({ className, children = 'Illustrative sample data' }: { className?: string; children?: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border border-[rgba(255,210,122,.28)] bg-[rgba(255,210,122,.08)] px-2.5 py-0.5 text-[11px] font-medium text-[#ffd27a]', className)}>
      {children}
    </span>
  );
}

export function CtaBand({ title, description, cta, to, eyebrow = 'Get started' }: { title: string; description: string; cta: string; to: string; eyebrow?: string }) {
  return (
    <section className="sp-section">
      <div className="sp-cta-card">
        <p className="eyebrow" data-reveal style={rd(60)}>
          {eyebrow}
        </p>
        <h2 className="sp-h2" data-reveal style={rd(140)}>
          {title}
        </h2>
        <p className="sp-lead" data-reveal style={rd(220)}>
          {description}
        </p>
        <div className="hero-actions" data-reveal style={rd(300)}>
          <Link to={to} className="btn btn-primary">
            {cta}
            <ArrowRight aria-hidden />
          </Link>
          <Link to="/company/contact" className="btn btn-outline">
            Talk to us
          </Link>
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
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest shadow-[0_0_8px_rgba(93,240,168,.7)]" aria-hidden />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

/** Prose wrapper for long-form pages (legal, resources). */
export function Prose({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-3xl space-y-4 text-[15px] leading-relaxed text-ink [&_a]:font-medium [&_a]:text-forest [&_a:hover]:underline [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h3]:mt-6 [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_li]:marker:text-forest [&_p]:text-ink-muted [&_ul]:space-y-2 [&_ul]:text-ink-muted">
      {children}
    </div>
  );
}
