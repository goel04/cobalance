import type { ActivityCategory, CalculationResult, DataQuality, EmissionFactor } from '@/lib/engine/types';
import type { RunSummary } from '@/lib/engine/calculate';
import type { ReductionActionType, ScenarioInputs } from '@/lib/engine/reduction';

// Record shapes mirror the planned Supabase tables (see docs/schema.md).

export type Role = 'owner' | 'admin' | 'editor' | 'viewer';

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: string;
}

export interface Organization {
  id: string;
  name: string;
  industry: string;
  companySize: string;
  country: string;
  state: string;
  city: string;
  website: string;
  /** Sample organisations hold illustrative data only and are isolated from real records. */
  isSample: boolean;
  /** Number of onboarding steps completed (0–4). */
  onboardingStep: number;
  createdAt: string;
}

export interface Membership {
  organizationId: string;
  userId: string;
  role: Role;
  createdAt: string;
}

export interface Facility {
  id: string;
  organizationId: string;
  name: string;
  address: string;
  state: string;
  city: string;
  facilityType: string;
  industry: string;
  productionUnit: string;
  annualCapacity: number | null;
  createdAt: string;
}

export interface Scope3Exclusion {
  category: ActivityCategory;
  reason: string;
}

export interface ReportingPeriod {
  id: string;
  organizationId: string;
  label: string;
  startDate: string;
  endDate: string;
  status: 'open' | 'closed';
  methodologyVersion: string;
  scope3Exclusions: Scope3Exclusion[];
  createdAt: string;
}

export type EvidenceStatus = 'none' | 'attached';
export type ReviewStatus = 'unreviewed' | 'reviewed';

export interface ActivityRecord {
  id: string;
  organizationId: string;
  facilityId: string;
  reportingPeriodId: string;
  category: ActivityCategory;
  subtype: string;
  activityDate: string;
  quantity: number | null;
  unit: string;
  normalizedQuantity: number | null;
  normalizedUnit: string | null;
  distanceKm: number | null;
  weightTonnes: number | null;
  costAmount: number | null;
  currency: string;
  dataQuality: DataQuality;
  dataSource: 'manual' | 'csv' | 'onboarding' | 'sample';
  evidenceDocumentId: string | null;
  reviewStatus: ReviewStatus;
  notes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceDocument {
  id: string;
  organizationId: string;
  facilityId: string | null;
  reportingPeriodId: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  /** Key of the blob in browser IndexedDB (demo stand-in for private Supabase Storage). */
  storagePath: string;
  documentType: string;
  reviewStatus: ReviewStatus;
  uploadedBy: string;
  createdAt: string;
}

export interface CalculationRun {
  id: string;
  organizationId: string;
  reportingPeriodId: string;
  engineVersion: string;
  methodologyVersion: string;
  status: 'completed' | 'completed_with_warnings';
  createdBy: string;
  createdAt: string;
  /** Snapshot of every input record used, so the run is reproducible after later edits. */
  inputs: ActivityRecord[];
  results: CalculationResult[];
  summary: RunSummary;
  /** Scope 3 boundary at the time of the run. */
  scope3Exclusions: Scope3Exclusion[];
}

export type ReductionStatus = 'proposed' | 'in_progress' | 'completed' | 'rejected';

export interface ReductionAction {
  id: string;
  organizationId: string;
  facilityId: string | null;
  reportingPeriodId: string;
  actionType: ReductionActionType;
  title: string;
  description: string;
  baselineLabel: string;
  baselineUnit: string;
  inputs: ScenarioInputs;
  assumptions: string;
  limitations: string;
  status: ReductionStatus;
  createdAt: string;
  updatedAt: string;
}

export type ReportStatus = 'draft' | 'reviewed_internally';

export interface Report {
  id: string;
  organizationId: string;
  reportingPeriodId: string;
  calculationRunId: string;
  reportType: 'pdf' | 'csv';
  status: ReportStatus;
  fileName: string;
  generatedAt: string;
  createdBy: string;
}

export interface AuditEvent {
  id: string;
  organizationId: string | null;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  createdAt: string;
}

export interface Session {
  userId: string | null;
  organizationId: string | null;
  periodId: string | null;
  /** 'all' or a facility id. */
  facilityId: string;
}

export interface DB {
  version: 1;
  users: User[];
  organizations: Organization[];
  memberships: Membership[];
  facilities: Facility[];
  periods: ReportingPeriod[];
  activities: ActivityRecord[];
  evidence: EvidenceDocument[];
  runs: CalculationRun[];
  reductionActions: ReductionAction[];
  reports: Report[];
  /** Organisation-specific factors (user-supplied or sample). Library defaults live in code. */
  factors: EmissionFactor[];
  audit: AuditEvent[];
  session: Session;
}
