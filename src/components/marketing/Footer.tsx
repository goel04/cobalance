import { Link } from 'react-router-dom';
import { SpaceBrand } from '@/components/brand/Logo';
import { CONTACT_EMAIL } from '@/config';
import { NAV_GROUPS } from './nav-data';

export function Footer() {
  const [products, about, company] = NAV_GROUPS;
  const companyLinks = company.items.filter((i) => i.to !== '/privacy' && i.to !== '/terms');
  const cols = [
    { title: 'Products', items: products.items },
    { title: 'About', items: about.items },
    { title: 'Company', items: companyLinks },
  ];

  return (
    <footer className="sp-footer">
      <div className="sp-footer-wrap">
        <div className="footer">
          <div className="footer-brand">
            <Link to="/" aria-label="Cobalance home" className="inline-block rounded-lg">
              <SpaceBrand />
            </Link>
            <p>Sustainability intelligence for manufacturers. Measure your carbon footprint, uncover operational savings and build transparent sustainability reports.</p>
            <p>
              Contact:{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="mail hover:underline">
                {CONTACT_EMAIL}
              </a>
            </p>
          </div>
          <div className="footer-cols">
            {cols.map((col) => (
              <div key={col.title}>
                <h4>{col.title}</h4>
                <ul>
                  {col.items.map((i) => (
                    <li key={i.to}>
                      <Link to={i.to}>{i.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="copyright">
          <span>© {new Date().getFullYear()} Cobalance. Built for India's manufacturers.</span>
          <span>Early access: features may change as we build with our first manufacturers.</span>
          <span className="flex gap-4">
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/terms">Terms of Service</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
