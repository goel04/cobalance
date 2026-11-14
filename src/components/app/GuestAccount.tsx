import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserRound } from 'lucide-react';
import { Button, Dialog, Field, Input, Notice } from '@/components/ui';
import { logOut, saveGuestAccount } from '@/lib/data/actions';
import { useAuth } from '@/lib/data/hooks';

/** Dialog that turns a guest into a permanent account (email now, password after confirming). */
export function SaveAccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (name.trim().length < 2) return setError('Enter your name.');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email address.');
    setBusy(true);
    try {
      await saveGuestAccount(name, email);
      setSentTo(email.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your account.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Save your work"
      description="Add your email to keep everything you've entered and log in from any device."
      footer={
        sentTo ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="outline" onClick={onClose}>
              Not now
            </Button>
            <Button onClick={submit} loading={busy}>
              Send confirmation link
            </Button>
          </>
        )
      }
    >
      {sentTo ? (
        <Notice tone="success" title="Check your email">
          We sent a link to <strong>{sentTo}</strong>. Open it on this device, then choose a password. Your data stays exactly where it is in the meantime.
        </Notice>
      ) : (
        <div className="space-y-4">
          {error && <Notice tone="error">{error}</Notice>}
          <Field label="Your name" required>
            {(p) => <Input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} {...p} />}
          </Field>
          <Field label="Work email" required hint="Your organisations, records and reports move with you — nothing is lost.">
            {(p) => <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} {...p} />}
          </Field>
        </div>
      )}
    </Dialog>
  );
}

/** Thin banner reminding guests their work is tied to this browser until they add an email. */
export function GuestBanner() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  if (!user?.isAnonymous) return null;
  return (
    <>
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-b border-forest-100 bg-forest-50 px-4 py-1.5 text-center text-xs text-forest-deep">
        <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden />
        You're using Cobalance as a guest. Your work is saved, but only this browser can open it.
        <button type="button" onClick={() => setOpen(true)} className="font-semibold underline">
          Save your work
        </button>
      </div>
      <SaveAccountDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/**
 * Log out, warning guests first: once a guest session ends, its data can't be
 * reached again unless an email was added. Render `dialogs` somewhere that stays
 * mounted (not inside a popover that closes on click).
 */
export function useLogOut(): { requestLogOut: () => void; dialogs: ReactNode } {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const leave = async () => {
    setConfirm(false);
    await logOut();
    navigate('/');
  };
  const requestLogOut = () => {
    if (user?.isAnonymous) setConfirm(true);
    else void leave();
  };
  const dialogs = (
    <>
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Leave your guest workspace?"
        description="Guest workspaces aren't linked to an email. If you log out now, you won't be able to open this data again."
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={leave}>
              Log out anyway
            </Button>
            <Button
              onClick={() => {
                setConfirm(false);
                setSaving(true);
              }}
            >
              Save my work
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">Add your email to keep everything and log in from any device.</p>
      </Dialog>
      <SaveAccountDialog open={saving} onClose={() => setSaving(false)} />
    </>
  );
  return { requestLogOut, dialogs };
}
