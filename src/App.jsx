import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Routes, Route, useLocation } from 'react-router-dom';
import { REDIRECTS } from '../functions/lib/seoRoutes.js';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './components/Toast';
import ScrollToTop from './components/ScrollToTop';
import SeoHead from './components/SeoHead';
import RevealObserver from './components/RevealObserver';
import { AccountProvider } from './lib/AccountContext';
import ActiveUploadDock from './components/ActiveUploadDock';

// Core entry route — eagerly loaded for instant first render without layout shift
import HomePage from './pages/HomePage';

// Route-level code-splitting for secondary, admin, tool, and SEO landing pages
const DownloadPage = lazy(() => import('./pages/DownloadPage'));
const FileRequestPage = lazy(() => import('./pages/FileRequestPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const PricingPage = lazy(() => import('./pages/PricingPage'));
const FeaturesPage = lazy(() => import('./pages/FeaturesPage'));
const SecurityPage = lazy(() => import('./pages/SecurityPage'));
const ResourcesPage = lazy(() => import('./pages/ResourcesPage'));
const WidgetPage = lazy(() => import('./pages/WidgetPage'));
const TeamsPage = lazy(() => import('./pages/TeamsPage'));
const AppsPage = lazy(() => import('./pages/AppsPage'));
const ApiDocsPage = lazy(() => import('./pages/ApiDocsPage'));
const HowItWorksPage = lazy(() => import('./pages/HowItWorksPage'));
const HelpContactPage = lazy(() => import('./pages/HelpContactPage'));
const ChecksumPage = lazy(() => import('./pages/ChecksumPage'));
const CompliancePage = lazy(() => import('./pages/CompliancePage'));
const ComparePage = lazy(() => import('./pages/ComparePage'));
const StatusPage = lazy(() => import('./pages/StatusPage'));
const ChangelogPage = lazy(() => import('./pages/ChangelogPage'));
const QrTransferPage = lazy(() => import('./pages/QrTransferPage'));
const SeoLandingPage = lazy(() => import('./pages/SeoLandingPage'));
const StaticGuide = lazy(() => import('./pages/StaticGuide'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

const GUIDE_PATHS = [
  '/about',
  '/wetransfer-alternative',
  '/send-large-video',
  '/send-files-whatsapp',
  '/file-request',
  '/send-files-by-email',
];

function Stage({ children }) {
  const { pathname } = useLocation();
  return (
    <div key={pathname} className="page-stage relative z-10 min-h-screen">
      {children}
    </div>
  );
}

function PageFallback() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center" role="status" aria-label="Loading page">
      <div className="w-6 h-6 border-2 border-slate-200 border-t-[#1769F5] rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <BrowserRouter>
          <AccountProvider>
          <ScrollToTop />
          <SeoHead />
          <RevealObserver />
          <ActiveUploadDock />
          <Stage>
          <Suspense fallback={<PageFallback />}>
          <Routes>
            {/* Core Product Pages */}
            <Route path="/" element={<HomePage />} />
            <Route path="/transfers" element={<HomePage />} />
            <Route path="/d/:shareId" element={<DownloadPage />} />
            <Route path="/download/:shareId" element={<DownloadPage />} />
            <Route path="/request/:requestId" element={<FileRequestPage />} />
            <Route path="/receive" element={<FileRequestPage />} />
            <Route path="/widget" element={<WidgetPage />} />
            <Route path="/teams" element={<TeamsPage />} />
            <Route path="/apps" element={<AppsPage />} />
            <Route path="/api-docs" element={<ApiDocsPage />} />
            <Route path="/features" element={<FeaturesPage />} />
            <Route path="/security" element={<SecurityPage />} />
            <Route path="/resources" element={<ResourcesPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/terms-and-conditions" element={<TermsPage />} />
            <Route path="/tos" element={<TermsPage />} />
            <Route path="/how-it-works" element={<HowItWorksPage />} />
            <Route path="/help" element={<HelpContactPage />} />
            <Route path="/contact" element={<HelpContactPage />} />
            <Route path="/checksum" element={<ChecksumPage />} />
            <Route path="/compliance" element={<CompliancePage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/vs-wetransfer" element={<ComparePage />} />
            <Route path="/vs-transfernow" element={<ComparePage />} />
            <Route path="/status" element={<StatusPage />} />
            <Route path="/changelog" element={<ChangelogPage />} />
            <Route path="/phone-to-laptop" element={<QrTransferPage />} />
            <Route path="/about" element={<StaticGuide path="/about" nextTo="/help" nextLabel="Contact" />} />
            {GUIDE_PATHS.filter((path) => path !== '/about').map((path) => (
              <Route key={path} path={path} element={<StaticGuide path={path} />} />
            ))}
            <Route path="/send-large-files" element={<SeoLandingPage pageKey="send-large-files" />} />
            <Route path="/send-files-without-signup" element={<SeoLandingPage pageKey="send-files-without-signup" />} />
            <Route path="/how-to-send-large-files" element={<SeoLandingPage pageKey="how-to-send-large-files" />} />
            {Object.entries(REDIRECTS).map(([from, to]) => (
              <Route key={from} path={from} element={<Navigate to={to} replace />} />
            ))}

            {/* 404 Route */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          </Suspense>
          </Stage>
          </AccountProvider>
        </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  );
}
