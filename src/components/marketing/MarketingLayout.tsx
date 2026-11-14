import { Outlet, useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { useLenis, useReveal, useSpaceRoot } from './space';

export function MarketingLayout() {
  const { pathname } = useLocation();
  const isHome = pathname === '/';
  useSpaceRoot();
  useLenis();
  useReveal(pathname);

  return (
    <div className="theme-space relative flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-surface focus:px-4 focus:py-2 focus:shadow-pop">
        Skip to content
      </a>
      {/* The home page mounts its own WebGL planet; every other page gets the static space backdrop. */}
      {!isHome && <div className="space-backdrop" aria-hidden />}
      <Navbar />
      <main id="main" className="page flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
