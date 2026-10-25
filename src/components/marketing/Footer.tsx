import { Link } from 'react-router-dom';
import { Logo } from '@/components/brand/Logo';
import { CONTACT_EMAIL } from '@/config';
import { NAV_GROUPS } from './nav-data';

export function Footer() {
  const [products, about, company] = NAV_GROUPS;
  const companyLinks = company.items.filter((i) => i.to !== '/privacy' && i.to !== '/terms');
  return (
    <footer className="border-t border-line bg-surface">
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Link to="/" aria-label="Cobalance home" className="inline-block rounded-lg">
            <Logo />
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-muted">
            Sustainability intelligence for manufacturers. Measure your carbon footprint, uncover operational savings and build transparent sustainability reports.
          </p>
          <p className="mt-4 text-sm">
            <span className="text-ink-muted">Contact: </span>
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-forest hover:text-forest-deep hover:underline">
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>
        {[
          { title: 'Products', items: products.items },
          { title: 'About', items: about.items },
          { title: 'Company', items: companyLinks },
        ].map((col) => (
          <div key={col.title}>
            <h2 className="text-sm font-semibold text-ink">{col.title}</h2>
            <ul className="mt-3 space-y-2">
              {col.items.map((i) => (
                <li key={i.to}>
                  <Link to={i.to} className="text-sm text-ink-muted transition-colors hover:text-forest">
                    {i.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-3 py-5 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Cobalance. All rights reserved.</p>
          <p className="sm:text-center">Early access: data is stored in your browser while our hosted platform is in development.</p>
          <div className="flex gap-4">
            <Link to="/privacy" className="hover:text-forest">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-forest">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
