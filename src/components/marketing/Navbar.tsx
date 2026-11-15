import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, Menu, X } from 'lucide-react';
import { HeaderBrand } from '@/components/brand/Logo';
import { cn } from '@/lib/cn';
import { NAV_GROUPS, type NavGroup } from './nav-data';

function Dropdown({ group, open, onOpen, onClose }: { group: NavGroup; open: boolean; onOpen: () => void; onClose: () => void }) {
  const id = useId();
  const wide = group.label === 'Products';
  const closeTimer = useRef<number>();

  const enter = () => {
    window.clearTimeout(closeTimer.current);
    onOpen();
  };
  const leave = () => {
    closeTimer.current = window.setTimeout(onClose, 120);
  };

  return (
    <div className="relative" onMouseEnter={enter} onMouseLeave={leave}>
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => (open ? onClose() : onOpen())} className="sp-nav-link">
        {group.label}
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      <div id={id} hidden={!open} className={cn('absolute left-1/2 top-full z-50 -translate-x-1/2 pt-3', wide ? 'w-[580px]' : 'w-80')}>
        <ul className={cn('sp-menu', wide && 'grid grid-cols-2 gap-1')}>
          {group.items.map((item) => (
            <li key={item.to}>
              <Link to={item.to} onClick={onClose}>
                <span className="sp-menu-icon">
                  <item.icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">{item.label}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">{item.description}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function Navbar() {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileGroup, setMobileGroup] = useState<string | null>(null);
  const [stuck, setStuck] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();

  useEffect(() => {
    setOpenMenu(null);
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 80);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenu(null);
        setMobileOpen(false);
      }
    };
    const onClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, []);

  return (
    <header ref={navRef} className={cn('sp-header', (stuck || mobileOpen) && 'is-stuck')}>
      <nav className="sp-nav" aria-label="Main">
        <Link to="/" aria-label="Cobalance home" className="rounded-lg">
          <HeaderBrand />
        </Link>

        <div className="sp-nav-links">
          {NAV_GROUPS.map((g) => (
            <Dropdown
              key={g.label}
              group={g}
              open={openMenu === g.label}
              onOpen={() => setOpenMenu(g.label)}
              onClose={() => setOpenMenu((cur) => (cur === g.label ? null : cur))}
            />
          ))}
          <Link to="/resources" className="sp-nav-link">
            Resources
          </Link>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <Link to="/login" className="sp-nav-link">
            Log in
          </Link>
          <Link to="/signup" className="btn btn-ghost">
            Sign up
          </Link>
        </div>

        <button
          type="button"
          className="rounded-full p-2 text-ink hover:bg-white/10 md:hidden"
          aria-expanded={mobileOpen}
          aria-controls="mobile-menu"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      <div id="mobile-menu" hidden={!mobileOpen} className="border-t border-line md:hidden" data-lenis-prevent>
        <div className="max-h-[calc(100vh-4.5rem)] overflow-y-auto px-5 py-3">
          <ul className="space-y-1">
            {NAV_GROUPS.map((g) => {
              const expanded = mobileGroup === g.label;
              return (
                <li key={g.label}>
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={`m-${g.label}`}
                    onClick={() => setMobileGroup(expanded ? null : g.label)}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-medium text-ink hover:bg-white/5"
                  >
                    {g.label}
                    <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} aria-hidden />
                  </button>
                  <ul id={`m-${g.label}`} hidden={!expanded} className="mb-2 space-y-0.5 pl-2">
                    {g.items.map((item) => (
                      <li key={item.to}>
                        <Link to={item.to} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink-muted hover:bg-white/5 hover:text-ink">
                          <item.icon className="h-4 w-4 text-forest" aria-hidden />
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line pb-2 pt-4">
            <Link to="/login" className="btn btn-outline">
              Log in
            </Link>
            <Link to="/signup" className="btn btn-primary">
              Get started
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
