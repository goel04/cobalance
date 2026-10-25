import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ReportModel } from './build';

// jsPDF's built-in Helvetica has no ₹ or subscript glyphs, so the PDF uses "INR" and "CO2e".
const FOREST: [number, number, number] = [35, 107, 69];
const INK: [number, number, number] = [32, 41, 35];
const MUTED: [number, number, number] = [107, 117, 110];

const n = (v: number | null | undefined, d = 2) => (v == null || !Number.isFinite(v) ? '-' : v.toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: d }));
const inr = (v: number | null | undefined) => (v == null ? '-' : `INR ${Math.round(v).toLocaleString('en-IN')}`);
const date = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export function renderPdf(m: ReportModel): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const M = 48;
  let y = M;

  const ensure = (h: number) => {
    if (y + h > doc.internal.pageSize.getHeight() - 56) {
      doc.addPage();
      y = M;
    }
  };
  const h2 = (text: string) => {
    ensure(40);
    y += 14;
    doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(...FOREST).text(text, M, y);
    y += 8;
    doc.setDrawColor(227, 233, 226).line(M, y, W - M, y);
    y += 14;
  };
  const para = (text: string, size = 10, color = INK) => {
    doc.setFont('helvetica', 'normal').setFontSize(size).setTextColor(...color);
    const lines = doc.splitTextToSize(text, W - 2 * M);
    ensure(lines.length * size * 1.35);
    doc.text(lines, M, y);
    y += lines.length * size * 1.35 + 4;
  };
  const table = (head: string[], body: (string | number)[][], opts: { columnStyles?: Record<number, object> } = {}) => {
    autoTable(doc, {
      startY: y,
      head: [head],
      body,
      margin: { left: M, right: M },
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 4, textColor: INK, lineColor: [227, 233, 226], lineWidth: 0.5 },
      headStyles: { fillColor: [238, 245, 240], textColor: INK, fontStyle: 'bold' },
      columnStyles: opts.columnStyles,
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
  };

  // Cover
  doc.setFillColor(...FOREST).roundedRect(M, y, 22, 22, 5, 5, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(14).setTextColor(...INK).text('Cobalance', M + 30, y + 16);
  y += 52;
  doc.setFontSize(20).text(doc.splitTextToSize(m.title, W - 2 * M), M, y);
  y += 30;
  para(`Status: ${m.statusLabel} - not third-party verified.`, 10, MUTED);
  para(`Generated ${date(m.generatedAt)} from calculation run ${m.run.id.slice(0, 8)} (${date(m.run.createdAt)}), engine ${m.run.engineVersion}, methodology ${m.run.methodologyVersion}.`, 9, MUTED);
  if (m.org.isSample) para('SAMPLE ORGANISATION - all data and sample factors in this report are illustrative and must not be disclosed.', 10, [180, 83, 9]);

  h2('1. Organisation and reporting boundary');
  table(
    ['Item', 'Detail'],
    [
      ['Organisation', m.org.name],
      ['Industry', m.org.industry],
      ['Location', `${m.org.city}, ${m.org.state}, ${m.org.country}`],
      ['Reporting period', `${m.period.label}: ${m.period.startDate} to ${m.period.endDate}`],
      ['Consolidation approach', 'Operational control (facilities listed below)'],
      ['Facilities', m.facilities.map((f) => `${f.name} (${f.city}, ${f.state})`).join('; ') || '-'],
      ['Scopes', 'Scope 1, Scope 2 (location-based), selected Scope 3 categories'],
    ],
    { columnStyles: { 0: { cellWidth: 140, fontStyle: 'bold' } } },
  );

  h2('2. Emissions summary');
  const total = m.totalsKg.total;
  table(
    ['Scope', 'tCO2e', 'kg CO2e', 'Share'],
    [
      ...([1, 2, 3] as const).map((s) => [
        s === 1 ? 'Scope 1 - direct' : s === 2 ? 'Scope 2 - purchased energy (location-based)' : 'Scope 3 - assessed categories only',
        n(m.totalsKg.byScope[s] / 1000, 3),
        n(m.totalsKg.byScope[s], 1),
        total ? `${n((m.totalsKg.byScope[s] / total) * 100, 1)}%` : '-',
      ]),
      ['Total assessed footprint', n(total / 1000, 3), n(total, 1), '100%'],
    ],
  );
  para(m.intensity ? `Emissions intensity: ${n(m.intensity.value, 4)} kg CO2e per ${m.intensity.unit} produced.` : 'Emissions intensity: not available (production data missing or recorded in mixed units).');

  h2('3. Activity-source breakdown');
  table(
    ['Source', 'Scope', 'tCO2e', 'Share'],
    m.sources.map((s) => [s.label, s.scope, n(s.kg / 1000, 3), total ? `${n((s.kg / total) * 100, 1)}%` : '-']),
  );

  h2('4. Scope 3 coverage');
  table(
    ['Category', 'Status', 'tCO2e', 'Note'],
    m.scope3.map((s) => [s.label, s.status, s.kg ? n(s.kg / 1000, 3) : '-', s.reason || '']),
  );

  h2('5. Methodology and emission factors');
  para(
    'Emissions = activity quantity x emission factor, after unit normalisation. Multi-gas factors are converted to CO2e using IPCC AR5 100-year GWPs. Each result stores a snapshot of the factor used, so this report is reproducible from its calculation run. Missing activity data is never treated as zero; activities without a documented factor are excluded and listed below.',
    9,
  );
  table(
    ['Factor code', 'Value', 'Source', 'Version', 'Status'],
    m.factors.map((f) => [
      f.factorCode,
      `${n(f.kgCo2ePerUnit, 4)} kg CO2e/${f.activityUnit}`,
      `${f.sourceName}${f.sourceUrl ? `\n${f.sourceUrl}` : ''}${f.conversions?.densityKgPerL ? `\nDensity ${f.conversions.densityKgPerL} kg/L` : ''}${f.conversions?.densityKgPerScm ? `\nDensity ${f.conversions.densityKgPerScm} kg/scm` : ''}`,
      f.version,
      f.origin === 'sample' ? 'SAMPLE (illustrative)' : f.origin === 'user' ? `User-supplied, ${f.reviewStatus}` : f.reviewStatus,
    ]),
    { columnStyles: { 2: { cellWidth: 200 } } },
  );

  h2('6. Data coverage, evidence and exclusions');
  table(
    ['Measure', 'Value'],
    [
      ['Core monthly data completeness (electricity & production)', `${n(m.coverage.completenessPct, 0)}% (${m.coverage.missing} entries missing)`],
      ['Records with supporting documents', `${m.evidence.attached} of ${m.evidence.total}`],
      ['Results based on estimated data or sample factors', String(m.coverage.estimated)],
      ['Records awaiting an emission factor (excluded)', m.coverage.awaiting.map((a) => `${a.label} (${a.count})`).join(', ') || 'None'],
      ['Invalid records (excluded)', String(m.coverage.invalid)],
      ['Scope 3 categories excluded from boundary', m.run.scope3Exclusions.length ? m.run.scope3Exclusions.map((x) => x.category.replace(/_/g, ' ')).join(', ') : 'None'],
    ],
    { columnStyles: { 0: { cellWidth: 230 } } },
  );

  h2('7. Data-quality limitations');
  m.limitations.forEach((l) => para(`- ${l}`, 9));

  h2('8. Reduction recommendations and financial assumptions');
  if (m.reductions.length === 0) para('No reduction scenarios were recorded for this period.', 9, MUTED);
  else {
    table(
      ['Action', 'Status', 'Investment', 'Net savings / yr', 'Payback', 'Est. tCO2e / yr'],
      m.reductions.map((r) => [`${r.title}\n${r.type}`, r.status, inr(r.capex), inr(r.netSavings), r.payback !== null ? `${n(r.payback, 1)} yr` : 'n/a', r.reductionT !== null ? n(r.reductionT, 2) : 'n/a']),
    );
    m.reductions.forEach((r) => {
      if (r.assumptions || r.limitations) para(`${r.title} - Assumptions: ${r.assumptions || '-'} Limitations: ${r.limitations || '-'}`, 8.5, MUTED);
    });
    para('Savings and reductions are estimates based on the stated assumptions. They are not guaranteed and are not carbon credits.', 9);
  }

  // Footer on every page
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...MUTED);
    const h = doc.internal.pageSize.getHeight();
    doc.text(`${m.org.name} | ${m.period.label} | ${m.statusLabel} - not third-party verified`, M, h - 28);
    doc.text(`Page ${i} of ${pages}`, W - M, h - 28, { align: 'right' });
  }
  return doc;
}
