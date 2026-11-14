import { Calculator, ClipboardList, FileText, Lightbulb } from 'lucide-react';
import { rd } from './space';

export const STEPS = [
  { icon: ClipboardList, title: 'Enter operational data', text: "Add your factory's electricity, fuel, production and waste data — manually or by CSV — with supporting bills." },
  { icon: Calculator, title: 'Calculate emissions', text: 'Activity data is multiplied by documented emission factors to give Scope 1, 2 and assessed Scope 3 emissions.' },
  { icon: Lightbulb, title: 'Discover opportunities', text: 'Model energy efficiency, solar, fuel and waste actions with transparent savings and payback estimates.' },
  { icon: FileText, title: 'Generate a report', text: 'Download a report with results, methodology, factor sources, assumptions and data-quality notes.' },
];

export function ProcessSteps() {
  return (
    <ol className="sp-steps">
      {STEPS.map((s, i) => (
        <li key={s.title} className="sp-card" data-reveal style={rd(i * 90)}>
          <span className="sp-step-num">{i + 1}</span>
          <h3 className="flex items-center gap-2">
            <s.icon className="h-4 w-4 text-forest" aria-hidden />
            {s.title}
          </h3>
          <p>{s.text}</p>
        </li>
      ))}
    </ol>
  );
}
