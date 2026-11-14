import { Link } from 'react-router-dom';
import { HeaderBrand } from '@/components/brand/Logo';
import { Notice } from '@/components/ui';
import { useSpaceRoot } from '@/components/marketing/space';

/** Shown instead of the app when the Supabase environment variables are missing from the build. */
export function SetupRequired() {
  useSpaceRoot();
  return (
    <div className="theme-space relative flex min-h-screen flex-col">
      <div className="space-backdrop" aria-hidden />
      <header className="sp-nav relative z-[1] w-full">
        <Link to="/" aria-label="Cobalance home" className="rounded-lg">
          <HeaderBrand />
        </Link>
      </header>
      <main className="relative z-[1] flex flex-1 items-start justify-center px-4 pb-16 pt-6 sm:pt-12">
        <div className="w-full max-w-md">
          <Notice tone="error" title="Cobalance isn't connected to its database">
            <p>
              This build is missing <code>VITE_SUPABASE_URL</code> or <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>. Add both to <code>.env.local</code> for local
              development, or to the hosting provider's environment variables, then rebuild.
            </p>
            <p className="mt-2">
              <Link to="/" className="font-medium underline">
                Back to the home page
              </Link>
            </p>
          </Notice>
        </div>
      </main>
    </div>
  );
}
