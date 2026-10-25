import { useMemo, useRef, useState } from 'react';
import { CheckCircle2, Download, FileText, Paperclip, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { Badge, Button, Card, CardHeader, Dialog, EmptyState, Notice, PageHeader, Select, td, th } from '@/components/ui';
import { attempt, toast } from '@/components/ui/toast';
import { ActivityFormDialog } from '@/components/app/ActivityForm';
import { CalcStatusBadge, EvidenceBadge, QualityBadge, ScopeBadge, recordCalcStatus } from '@/components/app/status';
import { CATEGORIES, categoryLabel, subtypeLabel } from '@/lib/engine/catalog';
import { UNIT_LABELS } from '@/lib/engine/units';
import { completeness } from '@/lib/data/analytics';
import { deleteActivity, deleteEvidence, importActivities, setActivityReview, uploadEvidence } from '@/lib/data/actions';
import { getFile } from '@/lib/data/evidence-files';
import { useOrg } from '@/lib/data/hooks';
import type { ActivityRecord } from '@/lib/data/types';
import { CSV_TEMPLATE, downloadText, parseCsv, toCsv, validateRows, type ParsedRow } from '@/lib/csv-import';
import { DOCUMENT_TYPES } from '@/lib/constants';
import { fmtDate, fmtInr, fmtMonth, fmtNumber } from '@/lib/format';

export default function ActivityDataPage() {
  const { org, period, facilities, facilityId, periodActivities, latestRun, canEdit, canAdmin } = useOrg();
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const [editing, setEditing] = useState<ActivityRecord | 'new' | null>(null);
  const [deleting, setDeleting] = useState<ActivityRecord | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [attachFor, setAttachFor] = useState<ActivityRecord | null>(null);
  const [showMissing, setShowMissing] = useState(false);

  const facilityName = (id: string) => facilities.find((f) => f.id === id)?.name ?? '—';
  const rows = useMemo(
    () =>
      periodActivities
        .filter((a) => facilityId === 'all' || a.facilityId === facilityId)
        .filter((a) => category === 'all' || a.category === category)
        .map((a) => ({ a, calc: recordCalcStatus(a, latestRun) }))
        .filter(({ a, calc }) =>
          status === 'all' ? true : status === 'no_evidence' ? !a.evidenceDocumentId && a.category !== 'production' : status === 'unreviewed' ? a.reviewStatus === 'unreviewed' : calc.status === status,
        )
        .sort((x, y) => y.a.activityDate.localeCompare(x.a.activityDate) || x.a.category.localeCompare(y.a.category)),
    [periodActivities, facilityId, category, status, latestRun],
  );

  if (!org || !period) return null;
  const comp = completeness(periodActivities, period, facilities, { facilityId });

  const exportCsv = () => {
    const data = rows.map(({ a, calc }) => ({
      facility: facilityName(a.facilityId),
      month: a.activityDate.slice(0, 7),
      category: a.category,
      source: a.subtype,
      quantity: a.quantity,
      unit: a.unit,
      normalized_quantity: a.normalizedQuantity,
      normalized_unit: a.normalizedUnit,
      distance_km: a.distanceKm,
      weight_tonnes: a.weightTonnes,
      cost_inr: a.costAmount,
      data_quality: a.dataQuality,
      data_source: a.dataSource,
      evidence: a.evidenceDocumentId ? 'attached' : 'missing',
      review_status: a.reviewStatus,
      calculation_status: calc.status,
      emissions_kg_co2e: calc.kg,
      notes: a.notes,
    }));
    downloadText(`cobalance-activity-${period.label.replace(/\s+/g, '-')}.csv`, toCsv(data));
  };

  return (
    <>
      <PageHeader
        title="Activity data"
        description={`Records for ${period.label}. Original quantities and units are preserved; normalised values are shown alongside.`}
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            {canEdit && (
              <>
                <Button variant="outline" onClick={() => setImportOpen(true)}>
                  <Upload className="h-4 w-4" /> Import CSV
                </Button>
                <Button onClick={() => setEditing('new')}>
                  <Plus className="h-4 w-4" /> Add record
                </Button>
              </>
            )}
          </>
        }
      />

      {comp.missing.length > 0 && (
        <Notice tone="warning" className="mb-4" title={`${comp.missing.length} monthly entries missing (${Math.round(comp.pct)}% complete)`}>
          Electricity or production data is missing for some months. Missing months are flagged, never assumed to be zero.{' '}
          <button className="font-medium underline" onClick={() => setShowMissing((s) => !s)}>
            {showMissing ? 'Hide' : 'Show'} details
          </button>
          {showMissing && (
            <ul className="mt-2 grid gap-x-6 gap-y-0.5 sm:grid-cols-2">
              {comp.missing.slice(0, 40).map((m) => (
                <li key={`${m.facility}${m.month}${m.category}`}>
                  {fmtMonth(m.month)} · {m.facility} · {categoryLabel(m.category)}
                </li>
              ))}
              {comp.missing.length > 40 && <li>…and {comp.missing.length - 40} more</li>}
            </ul>
          )}
        </Notice>
      )}

      <Card>
        <div className="flex flex-wrap items-end gap-3 border-b border-line p-4">
          <div>
            <label htmlFor="ad-cat" className="mb-1 block text-xs font-medium text-ink-muted">
              Category
            </label>
            <Select id="ad-cat" className="h-9 w-56" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="all">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="ad-status" className="mb-1 block text-xs font-medium text-ink-muted">
              Status
            </label>
            <Select id="ad-status" className="h-9 w-48" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="pending">Not calculated</option>
              <option value="calculated">Calculated</option>
              <option value="estimated">Estimated</option>
              <option value="awaiting_factor">Awaiting factor</option>
              <option value="invalid">Invalid</option>
              <option value="no_evidence">Missing evidence</option>
              <option value="unreviewed">Unreviewed</option>
            </Select>
          </div>
          <p className="ml-auto text-sm text-ink-muted">{rows.length} records</p>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title={periodActivities.length ? 'No records match these filters' : 'No activity records yet'}
            description={periodActivities.length ? 'Try a different category or status.' : 'Add records manually or import a CSV of monthly bills and invoices.'}
            action={canEdit && !periodActivities.length && <Button onClick={() => setEditing('new')}>Add record</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead className="border-b border-line bg-canvas/60">
                <tr>
                  <th className={th}>Month</th>
                  <th className={th}>Facility</th>
                  <th className={th}>Activity</th>
                  <th className={`${th} text-right`}>Quantity</th>
                  <th className={`${th} text-right`}>Normalised</th>
                  <th className={`${th} text-right`}>Cost</th>
                  <th className={th}>Quality</th>
                  <th className={th}>Evidence</th>
                  <th className={th}>Review</th>
                  <th className={th}>Calculation</th>
                  <th className={th}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(({ a, calc }) => (
                  <tr key={a.id} className="hover:bg-canvas/50">
                    <td className={td}>{fmtMonth(a.activityDate)}</td>
                    <td className={`${td} max-w-[10rem] truncate`}>{facilityName(a.facilityId)}</td>
                    <td className={td}>
                      <div className="flex items-center gap-2">
                        <ScopeBadge scope={CATEGORIES.find((c) => c.value === a.category)?.scope ?? null} />
                        <span className="font-medium">{subtypeLabel(a.category, a.subtype)}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {categoryLabel(a.category)}
                        {a.dataSource === 'csv' && ' · CSV'}
                        {a.dataSource === 'sample' && ' · sample'}
                      </p>
                      {calc.warnings.length > 0 && <p className="mt-1 max-w-xs text-xs text-amber-700">{calc.warnings[0]}</p>}
                    </td>
                    <td className={`${td} text-right tabular-nums`}>
                      {a.quantity === null ? <Badge tone="red">Missing</Badge> : `${fmtNumber(a.quantity, 2)} ${UNIT_LABELS[a.unit] ?? a.unit}`}
                      {a.distanceKm !== null && <p className="text-xs text-ink-muted">{fmtNumber(a.distanceKm)} km × {fmtNumber(a.weightTonnes, 2)} t</p>}
                    </td>
                    <td className={`${td} text-right tabular-nums text-ink-muted`}>{a.normalizedQuantity !== null ? `${fmtNumber(a.normalizedQuantity, 2)} ${a.normalizedUnit}` : '—'}</td>
                    <td className={`${td} text-right tabular-nums`}>{fmtInr(a.costAmount)}</td>
                    <td className={td}>
                      <QualityBadge quality={a.dataQuality} />
                    </td>
                    <td className={td}>
                      {a.category === 'production' && !a.evidenceDocumentId ? <span className="text-xs text-ink-muted">Optional</span> : <EvidenceBadge attached={!!a.evidenceDocumentId} />}
                    </td>
                    <td className={td}>
                      {a.reviewStatus === 'reviewed' ? <Badge tone="green">Reviewed</Badge> : <Badge tone="neutral">Unreviewed</Badge>}
                    </td>
                    <td className={td}>
                      <CalcStatusBadge status={calc.status} />
                    </td>
                    <td className={`${td} whitespace-nowrap text-right`}>
                      {canEdit && (
                        <>
                          <Button variant="ghost" size="sm" aria-label="Attach evidence" title="Attach evidence" onClick={() => setAttachFor(a)}>
                            <Paperclip className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" aria-label="Edit record" title="Edit" onClick={() => setEditing(a)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {canAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={a.reviewStatus === 'reviewed' ? 'Mark unreviewed' : 'Mark reviewed'}
                          title={a.reviewStatus === 'reviewed' ? 'Mark unreviewed' : 'Mark reviewed'}
                          onClick={() => attempt(() => setActivityReview(a.id, a.reviewStatus === 'reviewed' ? 'unreviewed' : 'reviewed'))}
                        >
                          <CheckCircle2 className={a.reviewStatus === 'reviewed' ? 'h-4 w-4 text-forest' : 'h-4 w-4'} />
                        </Button>
                      )}
                      {canEdit && (
                        <Button variant="ghost" size="sm" aria-label="Delete record" title="Delete" onClick={() => setDeleting(a)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <EvidenceList />

      <ActivityFormDialog open={editing !== null} onClose={() => setEditing(null)} record={editing === 'new' ? null : editing} />
      <CsvImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
      <AttachEvidenceDialog record={attachFor} onClose={() => setAttachFor(null)} />
      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete this record?"
        description="Past calculation runs keep their own snapshot, so saved reports stay reproducible."
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => deleting && attempt(() => (deleteActivity(deleting.id), setDeleting(null)), 'Record deleted')}>
              Delete
            </Button>
          </>
        }
      >
        {deleting && (
          <p className="text-sm">
            {subtypeLabel(deleting.category, deleting.subtype)} · {fmtMonth(deleting.activityDate)} · {deleting.quantity ?? '—'} {deleting.unit}
          </p>
        )}
      </Dialog>
    </>
  );
}

function EvidenceList() {
  const { evidence, period, activities, canEdit } = useOrg();
  const docs = evidence.filter((e) => !period || e.reportingPeriodId === period.id || e.reportingPeriodId === null);
  if (docs.length === 0) return null;
  const open = async (path: string, name: string) => {
    const blob = await getFile(path).catch(() => undefined);
    if (!blob) return toast('File not found in this browser.', 'error');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <Card className="mt-6">
      <CardHeader title="Supporting documents" description="Stored privately in this browser (IndexedDB). Not uploaded anywhere." />
      <ul className="divide-y divide-line">
        {docs.map((d) => {
          const linked = activities.filter((a) => a.evidenceDocumentId === d.id).length;
          return (
            <li key={d.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
              <FileText className="h-4 w-4 text-ink-muted" aria-hidden />
              <span className="min-w-0 flex-1 truncate font-medium">{d.fileName}</span>
              <Badge>{d.documentType}</Badge>
              <span className="text-xs text-ink-muted">
                {(d.sizeBytes / 1024).toFixed(0)} KB · {fmtDate(d.createdAt)} · linked to {linked} record{linked === 1 ? '' : 's'}
              </span>
              <Button variant="ghost" size="sm" onClick={() => open(d.storagePath, d.fileName)}>
                <Download className="h-4 w-4" /> Download
              </Button>
              {canEdit && (
                <Button variant="ghost" size="sm" aria-label={`Delete ${d.fileName}`} onClick={() => deleteEvidence(d.id).then(() => toast('Document deleted'), (e) => toast(String(e.message ?? e), 'error'))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function AttachEvidenceDialog({ record, onClose }: { record: ActivityRecord | null; onClose: () => void }) {
  const { org } = useOrg();
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState(DOCUMENT_TYPES[0]);
  const [busy, setBusy] = useState(false);
  if (!org) return null;
  const save = async () => {
    if (!record || !file) return;
    setBusy(true);
    try {
      await uploadEvidence(org.id, file, { facilityId: record.facilityId, reportingPeriodId: record.reportingPeriodId, documentType: type, attachToActivityId: record.id });
      toast('Document attached');
      setFile(null);
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Upload failed', 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={record !== null}
      onClose={onClose}
      title="Attach supporting document"
      description={record ? `${subtypeLabel(record.category, record.subtype)} · ${fmtMonth(record.activityDate)}` : undefined}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!file} loading={busy}>
            Attach
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="ev-file" className="mb-1.5 block text-sm font-medium">
            File (PDF or image, up to 10 MB)
          </label>
          <input id="ev-file" type="file" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm" />
        </div>
        <div>
          <label htmlFor="ev-type" className="mb-1.5 block text-sm font-medium">
            Document type
          </label>
          <Select id="ev-type" value={type} onChange={(e) => setType(e.target.value)}>
            {DOCUMENT_TYPES.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </Select>
        </div>
      </div>
    </Dialog>
  );
}

function CsvImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { org, period, facilities, activities } = useOrg();
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [skipDupes, setSkipDupes] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  if (!org || !period) return null;

  const close = () => {
    setParsed(null);
    setError(null);
    onClose();
  };

  const onFile = async (f: File | undefined) => {
    setError(null);
    setParsed(null);
    if (!f) return;
    const { rows, error } = parseCsv(await f.text());
    if (error) return setError(error);
    if (rows.length === 0) return setError('The file has no data rows.');
    if (rows.length > 2000) return setError('Import up to 2,000 rows at a time.');
    setParsed(validateRows(rows, { facilities, period, existing: activities }));
  };

  const valid = parsed?.filter((p) => p.draft && (!skipDupes || p.warnings.length === 0)) ?? [];
  const errors = parsed?.filter((p) => p.errors.length) ?? [];
  const dupes = parsed?.filter((p) => p.warnings.length) ?? [];

  return (
    <Dialog
      open={open}
      onClose={close}
      wide
      title="Import activity data from CSV"
      description={`Rows are validated before anything is saved. Imports go into ${period.label}.`}
      footer={
        <>
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button
            disabled={!valid.length}
            onClick={() => {
              const n = attempt(() => importActivities(org.id, valid.map((v) => v.draft!)));
              if (n !== undefined) {
                toast(`Imported ${n} records`);
                close();
              }
            }}
          >
            Import {valid.length || ''} valid row{valid.length === 1 ? '' : 's'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <input ref={inputRef} type="file" accept=".csv,text/csv" className="sr-only" id="csv-file" onChange={(e) => onFile(e.target.files?.[0])} />
          <Button variant="primary" onClick={() => inputRef.current?.click()}>
            <Upload className="h-4 w-4" /> Choose CSV file
          </Button>
          <Button variant="outline" onClick={() => downloadText('cobalance-activity-template.csv', CSV_TEMPLATE)}>
            <Download className="h-4 w-4" /> Download template
          </Button>
        </div>
        <p className="text-xs text-ink-muted">
          Columns: facility (name), month (YYYY-MM), category, source, quantity, unit, distance_km, weight_tonnes, cost_inr, data_quality, notes. Facilities:{' '}
          {facilities.map((f) => f.name).join(', ')}.
        </p>
        {error && <Notice tone="error">{error}</Notice>}
        {parsed && (
          <>
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge tone="green">{parsed.filter((p) => p.draft).length} valid</Badge>
              <Badge tone="red">{errors.length} with errors</Badge>
              <Badge tone="amber">{dupes.length} possible duplicates</Badge>
            </div>
            {dupes.length > 0 && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="accent-forest" checked={skipDupes} onChange={(e) => setSkipDupes(e.target.checked)} />
                Skip rows flagged as possible duplicates
              </label>
            )}
            <div className="max-h-80 overflow-auto rounded-lg border border-line">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="sticky top-0 bg-canvas">
                  <tr>
                    <th className={th}>Line</th>
                    <th className={th}>Row</th>
                    <th className={th}>Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {parsed.map((p) => (
                    <tr key={p.line}>
                      <td className={td}>{p.line}</td>
                      <td className={`${td} text-xs`}>
                        {p.raw.facility} · {p.raw.month} · {p.raw.category}/{p.raw.source} · {p.raw.quantity || '—'} {p.raw.unit}
                      </td>
                      <td className={`${td} text-xs`}>
                        {p.errors.length ? (
                          <span className="text-red-700">{p.errors.join(' ')}</span>
                        ) : p.warnings.length ? (
                          <span className="text-amber-700">{p.warnings.join(' ')}</span>
                        ) : (
                          <span className="text-forest">OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
