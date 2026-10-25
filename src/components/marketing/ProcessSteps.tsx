import { Calculator, ClipboardList, FileText, Lightbulb } from 'lucide-react';

export const STEPS = [
  { icon: ClipboardList, title: 'Enter operational data', text: "Add your factory's electricity, fuel, production and waste data — manually or by CSV — with supporting bills." },
  { icon: Calculator, title: 'Calculate emissions', text: 'Activity data is multiplied by documented emission factors to give Scope 1, 2 and assessed Scope 3 emissions.' },
  { icon: Lightbulb, title: 'Discover opportunities', text: 'Model energy efficiency, solar, fuel and waste actions with transparent savings and payback estimates.' },
  { icon: FileText, title: 'Generate a report', text: 'Download a report with results, methodology, factor sources, assumptions and data-quality notes.' },
];

export function ProcessSteps() {
  return (
    <ol className="relative grid gap-8 md:grid-cols-4 md:gap-6">
      <div className="absolute left-5 top-5 hidden h-px w-[calc(100%-2.5rem)] bg-line md:block" aria-hidden />
      <div className="absolute bottom-5 left-5 top-5 w-px bg-line md:hidden" aria-hidden />
      {STEPS.map((s, i) => (
        <li key={s.title} className="relative flex gap-4 md:block">
          <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-forest bg-surface text-sm font-semibold text-forest">
            {i + 1}
          </span>
          <div className="md:mt-5">
            <div className="flex items-center gap-2">
              <s.icon className="h-4 w-4 text-forest" aria-hidden />
              <h3 className="text-base font-semibold text-ink">{s.title}</h3>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{s.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
