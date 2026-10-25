import { BookOpen, Calculator, FileText, Handshake, LayoutDashboard, Mail, PiggyBank, ScrollText, ShieldCheck, Target, Workflow, Scale, type LucideIcon } from 'lucide-react';

export interface NavItem {
  label: string;
  to: string;
  description: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const PRODUCTS: NavItem[] = [
  { label: 'Carbon Calculator', to: '/products/carbon-calculator', description: 'Scope 1, 2 and selected Scope 3 emissions from your activity data.', icon: Calculator },
  { label: 'Sustainability Dashboard', to: '/products/sustainability-dashboard', description: 'Track emissions, energy, intensity and data completeness.', icon: LayoutDashboard },
  { label: 'Cost Savings & Reduction Planner', to: '/products/reduction-planner', description: 'Model savings, investment and payback for reduction actions.', icon: PiggyBank },
  { label: 'Sustainability Reporting', to: '/products/reporting', description: 'Downloadable reports with methodology and data quality.', icon: FileText },
];

export const NAV_GROUPS: NavGroup[] = [
  { label: 'Products', items: PRODUCTS },
  {
    label: 'About',
    items: [
      { label: 'Our Mission', to: '/about/mission', description: 'Why we are building Cobalance for manufacturers.', icon: Target },
      { label: 'How Cobalance Works', to: '/about/how-it-works', description: 'From factory data to a sustainability report.', icon: Workflow },
      { label: 'Transparent Carbon Accounting', to: '/about/transparency', description: 'Documented factors, retained inputs, flagged gaps.', icon: Scale },
    ],
  },
  {
    label: 'Company',
    items: [
      { label: 'Contact Us', to: '/company/contact', description: 'Get in touch with the team.', icon: Mail },
      { label: 'Partnerships', to: '/company/partnerships', description: 'Work with us to support manufacturers.', icon: Handshake },
      { label: 'Resources', to: '/resources', description: 'Guides on carbon accounting basics.', icon: BookOpen },
      { label: 'Privacy Policy', to: '/privacy', description: 'How we handle your data.', icon: ShieldCheck },
      { label: 'Terms of Service', to: '/terms', description: 'The terms for using Cobalance.', icon: ScrollText },
    ],
  },
];

