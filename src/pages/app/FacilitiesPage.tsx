import { useState } from 'react';
import { Building2, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button, Card, Dialog, EmptyState, PageHeader } from '@/components/ui';
import { attempt } from '@/components/ui/toast';
import { FacilityForm } from '@/components/app/forms';
import { createFacility, deleteFacility, updateFacility } from '@/lib/data/actions';
import { useOrg } from '@/lib/data/hooks';
import type { Facility } from '@/lib/data/types';
import { fmtNumber } from '@/lib/format';

export default function FacilitiesPage() {
  const { org, facilities, activities, canEdit, canAdmin } = useOrg();
  const [editing, setEditing] = useState<Facility | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Facility | null>(null);
  if (!org) return null;

  return (
    <>
      <PageHeader
        title="Facilities"
        description="Factories and sites included in your reporting boundary."
        actions={
          canEdit && (
            <Button onClick={() => setEditing('new')}>
              <Plus className="h-4 w-4" /> Add facility
            </Button>
          )
        }
      />
      {facilities.length === 0 ? (
        <Card>
          <EmptyState icon={<Building2 className="h-6 w-6" />} title="No facilities yet" description="Add your first factory to start recording activity data." action={canEdit && <Button onClick={() => setEditing('new')}>Add facility</Button>} />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {facilities.map((f) => {
            const count = activities.filter((a) => a.facilityId === f.id).length;
            return (
              <Card key={f.id} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <div className="rounded-lg bg-forest-50 p-2 text-forest">
                      <Building2 className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate font-semibold">{f.name}</h2>
                      <p className="text-sm text-ink-muted">{f.facilityType}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {canEdit && (
                      <Button variant="ghost" size="sm" aria-label={`Edit ${f.name}`} onClick={() => setEditing(f)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {canAdmin && (
                      <Button variant="ghost" size="sm" aria-label={`Delete ${f.name}`} onClick={() => setDeleting(f)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <p className="mt-4 flex items-start gap-2 text-sm text-ink-muted">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>
                    {f.address}, {f.city}, {f.state}
                  </span>
                </p>
                <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-4 text-sm">
                  <div>
                    <dt className="text-xs text-ink-muted">Production unit</dt>
                    <dd className="font-medium">{f.productionUnit}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-muted">Capacity / yr</dt>
                    <dd className="font-medium">{f.annualCapacity ? fmtNumber(f.annualCapacity) : '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-muted">Records</dt>
                    <dd className="font-medium">{count}</dd>
                  </div>
                </dl>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add facility' : 'Edit facility'} wide>
        {editing !== null && (
          <FacilityForm
            country={org.country}
            defaultValues={editing === 'new' ? { state: org.state, city: org.city, industry: org.industry } : editing}
            submitLabel={editing === 'new' ? 'Add facility' : 'Save changes'}
            onCancel={() => setEditing(null)}
            onSubmit={(v) => {
              const ok = attempt(() => (editing === 'new' ? createFacility(org.id, v) : updateFacility(editing.id, v)) ?? true, editing === 'new' ? 'Facility added' : 'Facility updated');
              if (ok !== undefined) setEditing(null);
            }}
          />
        )}
      </Dialog>

      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete facility?"
        description={deleting ? `"${deleting.name}" will be removed. Facilities with activity records cannot be deleted.` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (deleting && attempt(() => (deleteFacility(deleting.id), true), 'Facility deleted')) setDeleting(null);
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">This is recorded in the audit history.</p>
      </Dialog>
    </>
  );
}
