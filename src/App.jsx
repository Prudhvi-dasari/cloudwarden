import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
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
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

const SEO_KEYS = [
  'send-large-files',
  'send-files-by-email',
  'create-file-sharing-link',
  'iphone-to-windows',
  'android-to-mac',
  'phone-to-laptop',
  'airdrop-alternative',
  'wetransfer-alternative',
  'transfernow-alternative',
  'p2p-file-transfer',
  'send-large-video',
  'send-files-without-signup',
  'send-files-without-compression',
  'file-request',
  'how-to-send-large-files',
  'file-transfer-free',
  'send-files-whatsapp',
  'send-folder-online',
  'expire-file-link',
  'best-wetransfer-alternative-india',
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
            <Route path="/qr-transfer" element={<QrTransferPage />} />

            {/* High-Intent SEO & Guide Landing Routes */}
            {SEO_KEYS.map((key) => (
              <Route
                key={key}
                path={`/${key}`}
                element={<SeoLandingPage pageKey={key} />}
              />
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
