import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Dialog, Field, Input, Notice, Select, Textarea } from '@/components/ui';
import { toast } from '@/components/ui/toast';
import { CATEGORIES, CATEGORY_BY_VALUE } from '@/lib/engine/catalog';
import { UNIT_LABELS } from '@/lib/engine/units';
import type { ActivityCategory, Scope } from '@/lib/engine/types';
import { monthsBetween, DOCUMENT_TYPES } from '@/lib/constants';
import { findDuplicate, saveActivity, uploadEvidence, type ActivityDraft } from '@/lib/data/actions';
import { useOrg } from '@/lib/data/hooks';
import type { ActivityRecord } from '@/lib/data/types';
import { fmtMonth } from '@/lib/format';

const optionalNumber = z.union([z.literal(''), z.coerce.number().min(0, 'Must be zero or more.')]);

const schema = z
  .object({
    facilityId: z.string().min(1, 'Choose a facility.'),
    category: z.string().min(1),
    subtype: z.string().min(1, 'Choose a source.'),
    activityDate: z.string().min(1, 'Choose a month.'),
    quantity: optionalNumber,
    unit: z.string().min(1),
    distanceKm: optionalNumber,
    weightTonnes: optionalNumber,
    costAmount: optionalNumber,
    dataQuality: z.enum(['measured', 'calculated', 'estimated']),
    notes: z.string().max(500),
    documentType: z.string(),
  })
  .superRefine((v, ctx) => {
    const freight = CATEGORY_BY_VALUE[v.category as ActivityCategory]?.freight;
    if (freight) {
      if (v.distanceKm === '' && v.quantity === '') ctx.addIssue({ path: ['distanceKm'], code: 'custom', message: 'Enter distance and weight, or tonne-km.' });
      if ((v.distanceKm === '') !== (v.weightTonnes === '')) ctx.addIssue({ path: ['weightTonnes'], code: 'custom', message: 'Enter both distance and weight.' });
    } else if (v.quantity === '') {
      ctx.addIssue({ path: ['quantity'], code: 'custom', message: 'Enter the quantity. Missing data is never treated as zero.' });
    }
  });

type Values = z.input<typeof schema>;

export function ActivityFormDialog({
  open,
  onClose,
  record,
  scope,
  defaultCategory,
}: {
  open: boolean;
  onClose: () => void;
  record?: ActivityRecord | null;
  scope?: Scope | 'production';
  defaultCategory?: ActivityCategory;
}) {
  const { org, period, facilities, facilityId, db } = useOrg();
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDup, setConfirmDup] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = CATEGORIES.filter((c) => (scope === undefined ? true : scope === 'production' ? c.scope === null : c.scope === scope));
  const months = period ? monthsBetween(period.startDate, period.endDate) : [];

  const initial = (): Values => {
    const cat = CATEGORY_BY_VALUE[record?.category ?? defaultCategory ?? categories[0].value];
    const sub = cat.subtypes.find((s) => s.value === record?.subtype) ?? cat.subtypes[0];
    return {
      facilityId: record?.facilityId ?? (facilityId !== 'all' ? facilityId : facilities[0]?.id ?? ''),
      category: cat.value,
      subtype: sub.value,
      activityDate: record?.activityDate ?? months[0] ?? '',
      quantity: record?.quantity ?? '',
      unit: record?.unit ?? sub.units[0],
      distanceKm: record?.distanceKm ?? '',
      weightTonnes: record?.weightTonnes ?? '',
      costAmount: record?.costAmount ?? '',
      dataQuality: record?.dataQuality ?? 'measured',
      notes: record?.notes ?? '',
      documentType: cat.value === 'purchased_electricity' ? 'Electricity bill' : 'Fuel invoice',
    };
  };

  const { register, handleSubmit, watch, setValue, reset, formState } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: initial() });

  useEffect(() => {
    if (open) {
      reset(initial());
      setFile(null);
      setConfirmDup(false);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, record?.id]);

  const category = watch('category') as ActivityCategory;
  const subtype = watch('subtype');
  const catDef = CATEGORY_BY_VALUE[category];
  const subDef = catDef?.subtypes.find((s) => s.value === subtype) ?? catDef?.subtypes[0];
  const distance = watch('distanceKm');
  const weight = watch('weightTonnes');
  const values = watch();

  const duplicate = useMemo(
    () => (org && values.facilityId && values.activityDate ? findDuplicate(db, org.id, { facilityId: values.facilityId, category, subtype, activityDate: values.activityDate }, record?.id) : undefined),
    [db, org, values.facilityId, values.activityDate, category, subtype, record?.id],
  );

  if (!org || !period) return null;

  const onCategory = (c: ActivityCategory) => {
    const def = CATEGORY_BY_VALUE[c];
    setValue('category', c);
    setValue('subtype', def.subtypes[0].value);
    setValue('unit', def.subtypes[0].units[0]);
    setValue('documentType', c === 'purchased_electricity' ? 'Electricity bill' : 'Fuel invoice');
  };
  const onSubtype = (s: string) => {
    const def = catDef.subtypes.find((x) => x.value === s)!;
    setValue('subtype', s);
    if (!def.units.includes(watch('unit'))) setValue('unit', def.units[0]);
  };

  const submit = handleSubmit(async (v) => {
    setError(null);
    if (duplicate && !confirmDup) {
      setError('A record already exists for this facility, source and month. Tick the box below to save anyway.');
      return;
    }
    const p = schema.parse(v);
    const n = (x: number | '') => (x === '' ? null : x);
    const freight = !!catDef.freight;
    const tkm = freight && p.distanceKm !== '' && p.weightTonnes !== '' ? p.distanceKm * p.weightTonnes : n(p.quantity);
    const draft: ActivityDraft = {
      facilityId: p.facilityId,
      reportingPeriodId: period.id,
      category,
      subtype: p.subtype,
      activityDate: p.activityDate,
      quantity: tkm,
      unit: freight ? 'tkm' : p.unit,
      distanceKm: freight ? n(p.distanceKm) : null,
      weightTonnes: freight ? n(p.weightTonnes) : null,
      costAmount: n(p.costAmount),
      currency: 'INR',
      dataQuality: p.dataQuality,
      dataSource: record?.dataSource ?? 'manual',
      evidenceDocumentId: record?.evidenceDocumentId ?? null,
      reviewStatus: record ? 'unreviewed' : 'unreviewed',
      notes: p.notes,
    };
    setSaving(true);
    try {
      const id = saveActivity(org.id, draft, record?.id);
      if (file) await uploadEvidence(org.id, file, { facilityId: p.facilityId, reportingPeriodId: period.id, documentType: p.documentType, attachToActivityId: id });
      toast(record ? 'Record updated' : 'Record added');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the record.');
    } finally {
      setSaving(false);
    }
  });

  const e = formState.errors;
  const costLabel = category === 'purchased_electricity' ? 'Bill amount (₹)' : 'Cost (₹)';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide
      title={record ? 'Edit activity record' : 'Add activity record'}
      description={`${period.label} · original quantities and units are kept alongside normalised values.`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            {record ? 'Save changes' : 'Add record'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="Facility" required error={e.facilityId?.message}>
          {(p) => (
            <Select {...p} {...register('facilityId')}>
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Month" required error={e.activityDate?.message}>
          {(p) => (
            <Select {...p} {...register('activityDate')}>
              {months.map((m) => (
                <option key={m} value={m}>
                  {fmtMonth(m)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Activity category" required>
          {(p) => (
            <Select {...p} value={category} onChange={(ev) => onCategory(ev.target.value as ActivityCategory)}>
              {categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.scope ? `Scope ${c.scope} · ` : ''}
                  {c.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Source" required error={e.subtype?.message} hint={catDef?.description}>
          {(p) => (
            <Select {...p} value={subtype} onChange={(ev) => onSubtype(ev.target.value)}>
              {catDef?.subtypes.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          )}
        </Field>

        {catDef?.freight ? (
          <>
            <Field label="Distance (km)" required error={e.distanceKm?.message}>
              {(p) => <Input type="number" min="0" step="any" inputMode="decimal" {...p} {...register('distanceKm')} />}
            </Field>
            <Field
              label="Weight transported (tonnes)"
              required
              error={e.weightTonnes?.message}
              hint={distance !== '' && weight !== '' ? `= ${(Number(distance) * Number(weight)).toLocaleString('en-IN')} tonne-km` : undefined}
            >
              {(p) => <Input type="number" min="0" step="any" inputMode="decimal" {...p} {...register('weightTonnes')} />}
            </Field>
          </>
        ) : (
          <div className="grid grid-cols-[1fr_8rem] gap-2 sm:col-span-2">
            <Field label="Quantity" required error={e.quantity?.message} hint={category === 'refrigerants' ? 'Amount leaked or topped up, from service records.' : undefined}>
              {(p) => <Input type="number" min="0" step="any" inputMode="decimal" {...p} {...register('quantity')} />}
            </Field>
            <Field label="Unit" required>
              {(p) => (
                <Select {...p} {...register('unit')}>
                  {subDef?.units.map((u) => (
                    <option key={u} value={u}>
                      {UNIT_LABELS[u] ?? u}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        )}

        {category !== 'production' && (
          <Field
            label={costLabel}
            hint={category === 'purchased_electricity' ? 'Optional. Used for cost insights only — never as consumption.' : 'Optional.'}
            error={e.costAmount?.message}
          >
            {(p) => <Input type="number" min="0" step="any" inputMode="decimal" {...p} {...register('costAmount')} />}
          </Field>
        )}
        <Field label="Data quality" hint="Measured = from meter/bill; Calculated = derived; Estimated = approximation.">
          {(p) => (
            <Select {...p} {...register('dataQuality')}>
              <option value="measured">Measured</option>
              <option value="calculated">Calculated</option>
              <option value="estimated">Estimated</option>
            </Select>
          )}
        </Field>
        <Field label="Notes" className="sm:col-span-2" error={e.notes?.message}>
          {(p) => <Textarea rows={2} {...p} {...register('notes')} />}
        </Field>

        <div className="grid gap-4 rounded-lg border border-dashed border-line p-3 sm:col-span-2 sm:grid-cols-2">
          <Field label={record?.evidenceDocumentId ? 'Replace supporting document' : 'Supporting document'} hint="PDF or image, up to 10 MB. Stored privately in this browser.">
            {(p) => <Input type="file" accept=".pdf,image/*" className="py-1.5" onChange={(ev) => setFile(ev.target.files?.[0] ?? null)} {...p} />}
          </Field>
          <Field label="Document type">
            {(p) => (
              <Select {...p} {...register('documentType')}>
                {DOCUMENT_TYPES.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        {duplicate && (
          <div className="sm:col-span-2">
            <Notice tone="warning" title="Possible duplicate">
              A {catDef.label.toLowerCase()} record for this source and month already exists ({duplicate.quantity ?? '—'} {duplicate.unit}).
              <label className="mt-2 flex items-center gap-2">
                <input type="checkbox" className="accent-forest" checked={confirmDup} onChange={(ev) => setConfirmDup(ev.target.checked)} />
                This is a separate record — save anyway
              </label>
            </Notice>
          </div>
        )}
        {error && (
          <div className="sm:col-span-2">
            <Notice tone="error">{error}</Notice>
          </div>
        )}
        <button type="submit" className="hidden" />
      </form>
    </Dialog>
  );
}
