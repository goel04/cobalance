import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { MarketingLayout } from '@/components/marketing/MarketingLayout';
import HomePage from '@/pages/marketing/HomePage';
import ProductsPage from '@/pages/marketing/ProductsPage';
import { CarbonCalculatorProductPage, DashboardProductPage, ReductionPlannerProductPage, ReportingProductPage } from '@/pages/marketing/ProductPages';
import { AboutPage, HowItWorksPage, MissionPage, TransparencyPage } from '@/pages/marketing/AboutPages';
import { CompanyPage, ContactPage, PartnershipsPage, ResourcesPage } from '@/pages/marketing/CompanyPages';
import { PrivacyPage, TermsPage } from '@/pages/marketing/LegalPages';
import NotFoundPage from '@/pages/marketing/NotFoundPage';
import { ForgotPasswordPage, LoginPage, SignupPage } from '@/pages/auth/AuthPages';
import { AppLayout } from '@/components/app/AppLayout';
import { RequireAuth, RequireOrganization } from '@/components/app/guards';

const OnboardingPage = lazy(() => import('@/pages/app/OnboardingPage'));
const DashboardPage = lazy(() => import('@/pages/app/DashboardPage'));
const FacilitiesPage = lazy(() => import('@/pages/app/FacilitiesPage'));
const ActivityDataPage = lazy(() => import('@/pages/app/ActivityDataPage'));
const CalculatorPage = lazy(() => import('@/pages/app/CalculatorPage'));
const InsightsPage = lazy(() => import('@/pages/app/InsightsPage'));
const ReductionPlannerPage = lazy(() => import('@/pages/app/ReductionPlannerPage'));
const ReportsPage = lazy(() => import('@/pages/app/ReportsPage'));
const SettingsPage = lazy(() => import('@/pages/app/SettingsPage'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-ink-muted">Loading…</div>}>
      <Routes>
        <Route element={<MarketingLayout />}>
          <Route index element={<HomePage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="products/carbon-calculator" element={<CarbonCalculatorProductPage />} />
          <Route path="products/sustainability-dashboard" element={<DashboardProductPage />} />
          <Route path="products/reduction-planner" element={<ReductionPlannerProductPage />} />
          <Route path="products/reporting" element={<ReportingProductPage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="about/mission" element={<MissionPage />} />
          <Route path="about/how-it-works" element={<HowItWorksPage />} />
          <Route path="about/transparency" element={<TransparencyPage />} />
          <Route path="company" element={<CompanyPage />} />
          <Route path="company/contact" element={<ContactPage />} />
          <Route path="company/partnerships" element={<PartnershipsPage />} />
          <Route path="resources" element={<ResourcesPage />} />
          <Route path="privacy" element={<PrivacyPage />} />
          <Route path="terms" element={<TermsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        <Route path="login" element={<LoginPage />} />
        <Route path="signup" element={<SignupPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />

        <Route element={<RequireAuth />}>
          <Route path="onboarding" element={<OnboardingPage />} />
          <Route element={<RequireOrganization />}>
            <Route path="app" element={<AppLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="facilities" element={<FacilitiesPage />} />
              <Route path="activity-data" element={<ActivityDataPage />} />
              <Route path="calculator" element={<CalculatorPage />} />
              <Route path="insights" element={<InsightsPage />} />
              <Route path="reduction-planner" element={<ReductionPlannerPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="dashboard" replace />} />
            </Route>
          </Route>
        </Route>
      </Routes>
      </Suspense>
    </>
  );
}
