import { useState } from 'react';
import { HardDriveDownload } from 'lucide-react';
import { Badge, Button, Card, Dialog, Notice } from '@/components/ui';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { importLegacyOrganization, removeLegacyData, useLegacyOrgs } from '@/lib/data/legacy';

/**
 * Offers to move organisations saved in this browser by the earlier demo version
 * into the signed-in account. Renders nothing when there is no such data.
 */
export function LegacyImportCard({ className, onImported }: { className?: string; onImported?: (orgId: string) => void }) {
  const orgs = useLegacyOrgs();
  const [busy, setBusy] = useState<string | null>(null);
  const [step, setStep] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  if (orgs.length === 0) return null;
  const pending = orgs.filter((o) => !o.importedAt);

  const run = async (id: string) => {
    setBusy(id);
    setError(null);
    try {
      const r = await importLegacyOrganization(id, setStep);
      toast(`Imported ${r.counts.activities} records, ${r.counts.facilities} facilities and ${r.counts.documents} documents`);
      if (r.missingFiles.length) {
        setError(`${r.missingFiles.length} document${r.missingFiles.length > 1 ? 's were' : ' was'} not found in this browser and could not be imported: ${r.missingFiles.join(', ')}`);
      }
      onImported?.(r.orgId);
    } catch (e) {
      setError(`Nothing was imported — the import was rolled back. ${e instanceof Error ? e.message : ''}`.trim());
    } finally {
      setBusy(null);
      setStep('');
    }
  };

  return (
    <Card className={cn('p-5', className)}>
      <div className="flex gap-3">
        <HardDriveDownload className="mt-0.5 h-5 w-5 shrink-0 text-forest" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-medium">Data saved in this browser</p>
          <p className="mt-1 text-sm text-ink-muted">
            The earlier demo version of Cobalance kept data only in this browser. Import an organisation to move it into your account — each import is
            all-or-nothing, and the browser copy stays untouched until you remove it.
          </p>
          <ul className="mt-4 divide-y divide-line rounded-lg border border-line">
            {orgs.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{o.name}</span>
                  <span className="block text-xs text-ink-muted">
                    {o.facilities} facilit{o.facilities === 1 ? 'y' : 'ies'} · {o.activities} records · {o.documents} documents
                    {o.ownerEmail ? ` · saved by ${o.ownerEmail}` : ''}
                  </span>
                </span>
                {o.importedAt && <Badge tone="green">Imported</Badge>}
                <Button size="sm" variant={o.importedAt ? 'ghost' : 'primary'} onClick={() => run(o.id)} loading={busy === o.id} disabled={busy !== null}>
                  {o.importedAt ? 'Import again' : 'Import'}
                </Button>
              </li>
            ))}
          </ul>
          {busy && <p className="mt-2 text-xs text-ink-muted" role="status">{step || 'Working'}…</p>}
          {error && (
            <Notice tone="warning" className="mt-3">
              {error}
            </Notice>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(true)} disabled={busy !== null}>
              Remove browser copy
            </Button>
            {pending.length > 0 && <span className="text-xs text-ink-muted">{pending.length} not imported yet</span>}
          </div>
        </div>
      </div>

      <Dialog
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        title="Remove the browser copy?"
        description="This deletes the old demo data and files stored in this browser. Anything you imported stays in your account."
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmRemove(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await removeLegacyData();
                setConfirmRemove(false);
                toast('Browser copy removed');
              }}
            >
              Remove
            </Button>
          </>
        }
      >
        {pending.length > 0 ? (
          <Notice tone="warning" title={`${pending.length} organisation${pending.length > 1 ? 's have' : ' has'} not been imported`}>
            {pending.map((o) => o.name).join(', ')} will be lost. Import first if you want to keep it.
          </Notice>
        ) : (
          <p className="text-sm">Every organisation has been imported.</p>
        )}
      </Dialog>
    </Card>
  );
}
