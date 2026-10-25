import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Building2,
  Calculator,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Database,
  FileText,
  FlaskConical,
  Lightbulb,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  TrendingDown,
  X,
} from 'lucide-react';
import { Logo, LogoMark } from '@/components/brand/Logo';
import { cn } from '@/lib/cn';
import { logOut, setFacilityFilter, setPeriod, switchOrganization } from '@/lib/data/actions';
import { useAuth, useOrg } from '@/lib/data/hooks';
import { useAlerts } from './alerts';

const NAV = [
  { to: '/app/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/app/facilities', label: 'Facilities', icon: Building2 },
  { to: '/app/activity-data', label: 'Activity Data', icon: Database },
  { to: '/app/calculator', label: 'Carbon Calculator', icon: Calculator },
  { to: '/app/insights', label: 'Insights', icon: Lightbulb },
  { to: '/app/reduction-planner', label: 'Reduction Planner', icon: TrendingDown },
  { to: '/app/reports', label: 'Reports', icon: FileText },
  { to: '/app/settings', label: 'Settings', icon: Settings },
];

function readCollapsed() {
  try {
    return localStorage.getItem('cobalance.sidebar') === 'collapsed';
  } catch {
    return false;
  }
}

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  const { org } = useOrg();

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);
  useEffect(() => {
    try {
      localStorage.setItem('cobalance.sidebar', collapsed ? 'collapsed' : 'open');
    } catch {
      /* preference only */
    }
  }, [collapsed]);

  return (
    <div className="min-h-screen bg-canvas">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      {/* Desktop sidebar */}
      <aside className={cn('fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-surface transition-[width] lg:flex', collapsed ? 'w-16' : 'w-60')}>
        <div className={cn('flex h-16 items-center border-b border-line', collapsed ? 'justify-center' : 'px-4')}>
          <Link to="/app/dashboard" aria-label="Cobalance overview">
            {collapsed ? <LogoMark /> : <Logo />}
          </Link>
        </div>
        <SideNav collapsed={collapsed} />
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex h-11 items-center justify-center gap-2 border-t border-line text-sm text-ink-muted hover:bg-canvas hover:text-ink"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : (<><ChevronsLeft className="h-4 w-4" /> Collapse</>)}
        </button>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-surface shadow-pop">
            <div className="flex h-16 items-center justify-between border-b border-line px-4">
              <Logo />
              <button onClick={() => setMobileOpen(false)} className="rounded-md p-2 text-ink-muted hover:bg-canvas" aria-label="Close navigation">
                <X className="h-5 w-5" />
              </button>
            </div>
            <SideNav collapsed={false} />
            <MobileFacilityPicker />
          </aside>
        </div>
      )}

      <div className={cn('flex min-h-screen flex-col transition-[padding]', collapsed ? 'lg:pl-16' : 'lg:pl-60')}>
        <TopBar onMenu={() => setMobileOpen(true)} />
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-900">
          Demo mode — data is saved only in this browser and is not synced to a server.
        </div>
        {org?.isSample && (
          <div className="flex items-center justify-center gap-2 border-b border-sky-200 bg-sky-50 px-4 py-1.5 text-center text-xs text-sky-900">
            <FlaskConical className="h-3.5 w-3.5 shrink-0" aria-hidden />
            You are viewing a sample organisation. All figures and sample factors are illustrative and kept separate from your own data.
          </div>
        )}
        <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function SideNav({ collapsed }: { collapsed: boolean }) {
  return (
    <nav className="flex-1 overflow-y-auto px-2 py-4" aria-label="Application">
      <ul className="space-y-1">
        {NAV.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  collapsed && 'justify-center px-0',
                  isActive ? 'bg-forest-50 text-forest-deep' : 'text-ink-muted hover:bg-canvas hover:text-ink',
                )
              }
            >
              <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
              <span className={cn(collapsed && 'sr-only')}>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function MobileFacilityPicker() {
  const { facilities, facilityId } = useOrg();
  return (
    <div className="border-t border-line p-4 sm:hidden">
      <label htmlFor="m-facility" className="mb-1 block text-xs font-medium text-ink-muted">
        Facility
      </label>
      <select
        id="m-facility"
        className="h-10 w-full rounded-lg border border-line bg-surface px-2 text-sm"
        value={facilityId}
        onChange={(e) => setFacilityFilter(e.target.value)}
      >
        <option value="all">All facilities</option>
        {facilities.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}

function Popover({ trigger, label, children, align = 'right' }: { trigger: ReactNode; label: string; children: (close: () => void) => ReactNode; align?: 'left' | 'right' }) {
  const { open, setOpen, ref } = usePopover();
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={label}
        className="flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-ink hover:bg-canvas"
      >
        {trigger}
      </button>
      {open && (
        <div className={cn('absolute top-11 z-40 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-surface p-2 shadow-pop', align === 'right' ? 'right-0' : 'left-0')}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const { user } = useAuth();
  const { org, myOrgs, periods, period, facilities, facilityId } = useOrg();
  const navigate = useNavigate();
  const alerts = useAlerts();
  const selectCls = 'h-9 min-w-0 rounded-lg border border-line bg-surface px-2 text-sm text-ink focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20';

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-line bg-surface/95 px-3 backdrop-blur sm:gap-3 sm:px-6">
      <button onClick={onMenu} className="rounded-md p-2 text-ink-muted hover:bg-canvas lg:hidden" aria-label="Open navigation">
        <Menu className="h-5 w-5" />
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <label className="sr-only" htmlFor="tb-period">
          Reporting period
        </label>
        <select id="tb-period" className={cn(selectCls, 'max-w-[9rem] sm:max-w-none')} value={period?.id ?? ''} onChange={(e) => setPeriod(e.target.value)}>
          {periods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="tb-facility">
          Facility
        </label>
        <select id="tb-facility" className={cn(selectCls, 'hidden max-w-[12rem] sm:block')} value={facilityId} onChange={(e) => setFacilityFilter(e.target.value)}>
          <option value="all">All facilities</option>
          {facilities.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      <Popover
        label={`Notifications (${alerts.length})`}
        trigger={
          <span className="relative">
            <Bell className="h-5 w-5 text-ink-muted" />
            {alerts.length > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-forest px-1 text-[10px] font-semibold text-white">{alerts.length}</span>}
          </span>
        }
      >
        {(close) => (
          <div>
            <p className="px-2 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">Data alerts</p>
            {alerts.length === 0 ? (
              <p className="px-2 py-4 text-sm text-ink-muted">Nothing needs your attention for this period.</p>
            ) : (
              <ul className="max-h-80 space-y-1 overflow-y-auto">
                {alerts.map((a) => (
                  <li key={a.id}>
                    <button
                      onClick={() => {
                        close();
                        navigate(a.to);
                      }}
                      className="w-full rounded-lg px-2 py-2 text-left hover:bg-canvas"
                    >
                      <p className="text-sm font-medium text-ink">{a.title}</p>
                      <p className="text-xs text-ink-muted">{a.detail}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Popover>

      <Popover
        label="User menu"
        trigger={
          <>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-forest text-xs font-semibold text-white" aria-hidden>
              {(user?.name || user?.email || '?').slice(0, 1).toUpperCase()}
            </span>
            <ChevronDown className="hidden h-4 w-4 text-ink-muted sm:block" />
          </>
        }
      >
        {(close) => (
          <div>
            <div className="border-b border-line px-2 pb-2">
              <p className="truncate text-sm font-medium">{user?.name}</p>
              <p className="truncate text-xs text-ink-muted">{user?.email}</p>
            </div>
            <p className="px-2 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">Organisations</p>
            <ul>
              {myOrgs.map((o) => (
                <li key={o.id}>
                  <button
                    onClick={() => {
                      close();
                      if (o.onboardingStep < 3) navigate('/onboarding');
                      else switchOrganization(o.id);
                    }}
                    className={cn('flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-canvas', o.id === org?.id && 'font-medium text-forest-deep')}
                  >
                    <span className="truncate">{o.name}</span>
                    {o.isSample && <span className="text-[10px] uppercase text-sky-700">sample</span>}
                  </button>
                </li>
              ))}
              {!myOrgs.some((o) => !o.isSample) && (
                <li>
                  <button onClick={() => { close(); navigate('/onboarding'); }} className="w-full rounded-lg px-2 py-1.5 text-left text-sm text-forest hover:bg-canvas">
                    + Set up your own organisation
                  </button>
                </li>
              )}
            </ul>
            <div className="mt-2 border-t border-line pt-2">
              <button onClick={() => { close(); navigate('/app/settings'); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-canvas">
                <Settings className="h-4 w-4 text-ink-muted" /> Settings
              </button>
              <button
                onClick={() => {
                  logOut();
                  navigate('/');
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-canvas"
              >
                <LogOut className="h-4 w-4 text-ink-muted" /> Log out
              </button>
            </div>
          </div>
        )}
      </Popover>
    </header>
  );
}
