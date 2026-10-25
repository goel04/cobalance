import { useState, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Logo } from '@/components/brand/Logo';
import { Button, Field, Input, Notice } from '@/components/ui';
import { logIn, signUp } from '@/lib/data/actions';
import { useAuth } from '@/lib/data/hooks';

function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="container-page flex h-16 items-center">
        <Link to="/" aria-label="Cobalance home">
          <Logo />
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-6 sm:pt-12">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-8">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>
            <div className="mt-6">{children}</div>
          </div>
          <div className="mt-4 text-center text-sm text-ink-muted">{footer}</div>
          <Notice tone="info" className="mt-6" title="Demo mode">
            Accounts and data are stored only in this browser. Nothing is sent to a server, and clearing site data will remove them.
          </Notice>
        </div>
      </main>
    </div>
  );
}

const safeNext = (n: string | null) => (n && n.startsWith('/') && !n.startsWith('//') ? n : '/app/dashboard');

const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

export function LoginPage() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema) });
  const next = safeNext(params.get('next'));
  if (user) return <Navigate to={next} replace />;

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      await logIn(v.email, v.password);
      navigate(next, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not log in.');
    }
  });

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
        {error && <Notice tone="error">{error}</Notice>}
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
  const { user } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof signupSchema>>({ resolver: zodResolver(signupSchema) });
  if (user) return <Navigate to="/app/dashboard" replace />;

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      await signUp(v.name, v.email, v.password);
      navigate('/onboarding', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the account.');
    }
  });

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
      </form>
    </AuthLayout>
  );
}

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState } = useForm<{ email: string }>({
    resolver: zodResolver(z.object({ email: z.string().trim().email('Enter a valid email address.') })),
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
      {sent ? (
        <Notice tone="warning" title="Email reset isn't available in demo mode">
          Password-reset emails need the hosted Cobalance backend, which isn't connected in this build. No email has been sent. Because demo accounts
          live only in this browser, you can create a new account, or clear this site's data to start over.
        </Notice>
      ) : (
        <form onSubmit={handleSubmit(() => setSent(true))} className="space-y-4" noValidate>
          <Field label="Email" error={formState.errors.email?.message}>
            {(p) => <Input type="email" autoComplete="email" {...p} {...register('email')} />}
          </Field>
          <Button type="submit" className="w-full">
            Continue
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
