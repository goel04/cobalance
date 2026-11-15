import { useState, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { HeaderBrand } from '@/components/brand/Logo';
import { useSpaceRoot } from '@/components/marketing/space';
import { Button, Field, Input, Notice } from '@/components/ui';
import { AuthLoading } from '@/components/app/guards';
import { SetupRequired } from '@/components/app/SetupRequired';
import { EmailNotConfirmedError, logIn, requestPasswordReset, resendConfirmation, saveGuestAccount, signUp, updatePassword } from '@/lib/data/actions';
import { useAuth } from '@/lib/data/hooks';
import { getLinkError } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';

function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  useSpaceRoot();
  if (!isSupabaseConfigured) return <SetupRequired />;
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
          <div className="dashboard sm:!p-9">
            <h1 className="text-[28px] font-extrabold tracking-tight">{title}</h1>
            <p className="mt-1.5 text-sm text-ink-muted">{subtitle}</p>
            <div className="mt-6">{children}</div>
          </div>
          <div className="mt-4 text-center text-sm text-ink-muted">{footer}</div>
        </div>
      </main>
    </div>
  );
}

const safeNext = (n: string | null) => (n && n.startsWith('/') && !n.startsWith('//') ? n : '/app/dashboard');

/** Logging in is optional: the app opens in a guest workspace for visitors without an account. */
function ContinueAsGuest() {
  const { user } = useAuth();
  return (
    <p className="text-center text-sm text-ink-muted">
      <Link to="/app/dashboard" className="font-medium text-forest hover:underline">
        {user?.isAnonymous ? 'Back to your guest workspace' : 'Continue without an account'}
      </Link>
    </p>
  );
}

const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

export function LoginPage() {
  const { ready, user } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(getLinkError);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema) });
  const next = safeNext(params.get('next'));
  const guestUnavailable = params.get('guest') === 'unavailable';
  if (isSupabaseConfigured && !ready) return <AuthLoading />;
  // Guests may still log in to a real account; only full accounts skip this page.
  if (user && !user.isAnonymous) return <Navigate to={next} replace />

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    setUnconfirmedEmail(null);
    setResent(false);
    try {
      await logIn(v.email, v.password);
      navigate(next, { replace: true });
    } catch (e) {
      if (e instanceof EmailNotConfirmedError) setUnconfirmedEmail(v.email);
      setError(e instanceof Error ? e.message : 'Could not log in.');
    }
  });

  const resend = async () => {
    if (!unconfirmedEmail) return;
    try {
      await resendConfirmation(unconfirmedEmail);
      setResent(true);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not resend the email.');
    }
  };

  return (
    <AuthLayout
      title="Log in"
      subtitle="Welcome back to Cobalance."
      footer={
        <>
          New to Cobalance?{' '}
          <Link to={`/signup${params.get('next') ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-medium text-forest hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {guestUnavailable && !error && (
          <Notice tone="info" title="Log in or create an account to continue">
            Trying Cobalance without an account isn't available right now.
          </Notice>
        )}
        {user?.isAnonymous && (
          <Notice tone="warning" title="You're in a guest workspace">
            Logging in to another account leaves it. To keep it instead,{' '}
            <Link to="/signup" className="font-medium underline">
              save it with your email
            </Link>
            .
          </Notice>
        )}
        {error && (
          <Notice tone="error">
            {error}
            {unconfirmedEmail && (
              <button type="button" onClick={resend} className="mt-1 block font-medium underline">
                Resend confirmation email
              </button>
            )}
          </Notice>
        )}
        {resent && <Notice tone="success">Confirmation email sent to {unconfirmedEmail}. Open the link in it, then log in.</Notice>}
        <Field label="Email" error={formState.errors.email?.message}>
          {(p) => <Input type="email" autoComplete="email" {...p} {...register('email')} />}
        </Field>
        <Field label="Password" error={formState.errors.password?.message}>
          {(p) => <Input type="password" autoComplete="current-password" {...p} {...register('password')} />}
        </Field>
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm text-forest hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" className="w-full" loading={formState.isSubmitting}>
          Log in
        </Button>
        {!guestUnavailable && <ContinueAsGuest />}
      </form>
    </AuthLayout>
  );
}

const signupSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter your name.'),
    email: z.string().trim().email('Enter a valid email address.'),
    password: z.string().min(8, 'Use at least 8 characters.'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match.' });

export function SignupPage() {
  const { ready, user } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof signupSchema>>({ resolver: zodResolver(signupSchema) });
  if (isSupabaseConfigured && !ready) return <AuthLoading />;
  if (user && !user.isAnonymous) return <Navigate to="/app/dashboard" replace />;
  // A guest "signs up" by converting their guest account, so their data comes with them.
  if (user?.isAnonymous) return <SaveGuestPage />;

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      const { needsConfirmation } = await signUp(v.name, v.email, v.password);
      if (needsConfirmation) setSentTo(v.email.trim());
      else navigate('/onboarding', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the account.');
    }
  });

  if (sentTo) {
    return (
      <AuthLayout
        title="Check your email"
        subtitle="One more step before you can set up your organisation."
        footer={
          <Link to="/login" className="font-medium text-forest hover:underline">
            Back to log in
          </Link>
        }
      >
        <Notice tone="success" title="Confirm your email address">
          We sent a confirmation link to <strong>{sentTo}</strong>. Open it on this device to finish creating your account. If nothing arrives in a few
          minutes, check your spam folder. If you already have an account with this email, log in or reset your password instead.
        </Notice>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Get started"
      subtitle="Create your Cobalance account, then set up your organisation."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-forest hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <Notice tone="error">{error}</Notice>}
        <Field label="Full name" error={formState.errors.name?.message}>
          {(p) => <Input autoComplete="name" {...p} {...register('name')} />}
        </Field>
        <Field label="Work email" error={formState.errors.email?.message}>
          {(p) => <Input type="email" autoComplete="email" {...p} {...register('email')} />}
        </Field>
        <Field label="Password" hint="At least 8 characters." error={formState.errors.password?.message}>
          {(p) => <Input type="password" autoComplete="new-password" {...p} {...register('password')} />}
        </Field>
        <Field label="Confirm password" error={formState.errors.confirm?.message}>
          {(p) => <Input type="password" autoComplete="new-password" {...p} {...register('confirm')} />}
        </Field>
        <Button type="submit" className="w-full" loading={formState.isSubmitting}>
          Create account
        </Button>
        <p className="text-xs text-ink-muted">
          By creating an account you agree to the <Link to="/terms" className="underline">Terms</Link> and{' '}
          <Link to="/privacy" className="underline">Privacy Policy</Link>.
        </p>
        <ContinueAsGuest />
      </form>
    </AuthLayout>
  );
}

const saveGuestSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name.'),
  email: z.string().trim().email('Enter a valid email address.'),
});

/** Sign-up for someone already in a guest workspace: attach an email to the same account. */
function SaveGuestPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof saveGuestSchema>>({ resolver: zodResolver(saveGuestSchema) });
  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      await saveGuestAccount(v.name, v.email);
      setSentTo(v.email.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your account.');
    }
  });
  return (
    <AuthLayout
      title={sentTo ? 'Check your email' : 'Save your work'}
      subtitle={sentTo ? 'One more step to keep your guest workspace.' : 'Create your account from your guest workspace — everything you entered comes with you.'}
      footer={
        <Link to="/app/dashboard" className="font-medium text-forest hover:underline">
          Back to your guest workspace
        </Link>
      }
    >
      {sentTo ? (
        <Notice tone="success" title="Confirm your email address">
          We sent a link to <strong>{sentTo}</strong>. Open it on this device, then choose a password. Until then you can keep working as a guest.
        </Notice>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error && <Notice tone="error">{error}</Notice>}
          <Field label="Full name" error={formState.errors.name?.message}>
            {(p) => <Input autoComplete="name" {...p} {...register('name')} />}
          </Field>
          <Field label="Work email" hint="You'll choose a password after confirming it." error={formState.errors.email?.message}>
            {(p) => <Input type="email" autoComplete="email" {...p} {...register('email')} />}
          </Field>
          <Button type="submit" className="w-full" loading={formState.isSubmitting}>
            Send confirmation link
          </Button>
          <p className="text-xs text-ink-muted">
            By creating an account you agree to the <Link to="/terms" className="underline">Terms</Link> and{' '}
            <Link to="/privacy" className="underline">Privacy Policy</Link>.
          </p>
        </form>
      )}
    </AuthLayout>
  );
}

export function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<{ email: string }>({
    resolver: zodResolver(z.object({ email: z.string().trim().email('Enter a valid email address.') })),
  });

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      await requestPasswordReset(v.email);
      setSentTo(v.email.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the reset email.');
    }
  });

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter the email you signed up with."
      footer={
        <Link to="/login" className="font-medium text-forest hover:underline">
          Back to log in
        </Link>
      }
    >
      {sentTo ? (
        <Notice tone="success" title="Check your email">
          If an account exists for <strong>{sentTo}</strong>, we've sent a link to choose a new password. Open it on this device.
        </Notice>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error && <Notice tone="error">{error}</Notice>}
          <Field label="Email" error={formState.errors.email?.message}>
            {(p) => <Input type="email" autoComplete="email" {...p} {...register('email')} />}
          </Field>
          <Button type="submit" className="w-full" loading={formState.isSubmitting}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}

const resetSchema = z
  .object({
    password: z.string().min(8, 'Use at least 8 characters.'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match.' });

/** Landing page for the emailed reset link: the link signs the user in, then they choose a new password. */
export function ResetPasswordPage() {
  const { ready, user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // Also the last step of saving a guest workspace: the email is confirmed, now pick a password.
  const welcome = params.get('welcome') === '1';
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema) });
  if (isSupabaseConfigured && !ready) return <AuthLoading />;

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      await updatePassword(v.password);
      navigate('/app/dashboard', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the password.');
    }
  });

  return (
    <AuthLayout
      title={welcome ? 'Choose a password' : 'Choose a new password'}
      subtitle={
        welcome && user && !user.isAnonymous
          ? `Your email ${user.email} is confirmed and your guest work is saved. Set a password to log in from any device.`
          : user && !user.isAnonymous
            ? `For ${user.email}.`
            : 'Open the link from your email to continue.'
      }
      footer={
        <Link to={welcome ? '/app/dashboard' : '/login'} className="font-medium text-forest hover:underline">
          {welcome ? 'Skip for now' : 'Back to log in'}
        </Link>
      }
    >
      {user?.isAnonymous ? (
        <Notice tone="info" title="Confirm your email first">
          Open the confirmation link we emailed you on this device. It brings you back here to choose a password.
        </Notice>
      ) : !user ? (
        <Notice tone="error" title="This reset link can't be used">
          {getLinkError() ?? 'The link is missing, has expired or was already used.'}{' '}
          <Link to="/forgot-password" className="font-medium underline">
            Request a new link
          </Link>
          .
        </Notice>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error && <Notice tone="error">{error}</Notice>}
          <Field label="New password" hint="At least 8 characters." error={formState.errors.password?.message}>
            {(p) => <Input type="password" autoComplete="new-password" {...p} {...register('password')} />}
          </Field>
          <Field label="Confirm new password" error={formState.errors.confirm?.message}>
            {(p) => <Input type="password" autoComplete="new-password" {...p} {...register('confirm')} />}
          </Field>
          <Button type="submit" className="w-full" loading={formState.isSubmitting}>
            Save new password
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
