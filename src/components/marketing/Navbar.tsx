import { useEffect, useId, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, Menu, X } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { ButtonLink } from '@/components/ui';
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
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => (open ? onClose() : onOpen())}
        className={cn(
          'inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          open ? 'bg-forest-50 text-forest-deep' : 'text-ink hover:bg-forest-50 hover:text-forest-deep',
        )}
      >
        {group.label}
        <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      <div
        id={id}
        hidden={!open}
        className={cn('absolute left-1/2 top-full z-50 -translate-x-1/2 pt-2', wide ? 'w-[560px]' : 'w-80')}
      >
        <ul className={cn('rounded-xl border border-line bg-surface p-2 shadow-pop', wide && 'grid grid-cols-2 gap-1')}>
          {group.items.map((item) => (
            <li key={item.to}>
              <Link to={item.to} onClick={onClose} className="flex gap-3 rounded-lg p-3 transition-colors hover:bg-canvas focus-visible:bg-canvas">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-forest-50 text-forest">
                  <item.icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink">{item.label}</span>
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
  const navRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();

  useEffect(() => {
    setOpenMenu(null);
    setMobileOpen(false);
  }, [pathname]);

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
    <header ref={navRef} className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur supports-[backdrop-filter]:bg-surface/75">
      <nav className="container-page flex h-16 items-center justify-between gap-4" aria-label="Main">
        <Link to="/" className="rounded-lg" aria-label="Cobalance home">
          <Logo />
        </Link>

        <div className="hidden flex-1 items-center justify-center gap-1 md:flex">
          {NAV_GROUPS.map((g) => (
            <Dropdown
              key={g.label}
              group={g}
              open={openMenu === g.label}
              onOpen={() => setOpenMenu(g.label)}
              onClose={() => setOpenMenu((cur) => (cur === g.label ? null : cur))}
            />
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <NavLink to="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-ink hover:bg-forest-50 hover:text-forest-deep">
            Log in
          </NavLink>
          <ButtonLink to="/signup" size="md">
            Get started
          </ButtonLink>
        </div>

        <button
          type="button"
          className="rounded-lg p-2 text-ink hover:bg-forest-50 md:hidden"
          aria-expanded={mobileOpen}
          aria-controls="mobile-menu"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      <div id="mobile-menu" hidden={!mobileOpen} className="border-t border-line bg-surface md:hidden">
        <div className="container-page max-h-[calc(100vh-4rem)] overflow-y-auto py-3">
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
                    className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-sm font-medium text-ink hover:bg-canvas"
                  >
                    {g.label}
                    <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} aria-hidden />
                  </button>
                  <ul id={`m-${g.label}`} hidden={!expanded} className="mb-2 space-y-0.5 pl-2">
                    {g.items.map((item) => (
                      <li key={item.to}>
                        <Link to={item.to} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-ink hover:bg-canvas">
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
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-4">
            <ButtonLink to="/login" variant="outline">
              Log in
            </ButtonLink>
            <ButtonLink to="/signup">Get started</ButtonLink>
          </div>
        </div>
      </div>
    </header>
  );
}
