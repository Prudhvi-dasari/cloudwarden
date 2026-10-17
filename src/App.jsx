import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './components/Toast';
import ScrollToTop from './components/ScrollToTop';
import SeoHead from './components/SeoHead';
import HomePage from './pages/HomePage';
import DownloadPage from './pages/DownloadPage';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
import PricingPage from './pages/PricingPage';
import FeaturesPage from './pages/FeaturesPage';
import SecurityPage from './pages/SecurityPage';
import ResourcesPage from './pages/ResourcesPage';
import WidgetPage from './pages/WidgetPage';
import TeamsPage from './pages/TeamsPage';
import AppsPage from './pages/AppsPage';
import ApiDocsPage from './pages/ApiDocsPage';
import FileRequestPage from './pages/FileRequestPage';
import HowItWorksPage from './pages/HowItWorksPage';
import HelpContactPage from './pages/HelpContactPage';
import ChecksumPage from './pages/ChecksumPage';
import CompliancePage from './pages/CompliancePage';
import ComparePage from './pages/ComparePage';
import StatusPage from './pages/StatusPage';
import ChangelogPage from './pages/ChangelogPage';
import QrTransferPage from './pages/QrTransferPage';
import SeoLandingPage from './pages/SeoLandingPage';
import NotFoundPage from './pages/NotFoundPage';

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
];

export default function App() {
  useEffect(() => {
    // Proactively purge expired Google Drive & Supabase transfers in background
    const lastCleanup = sessionStorage.getItem('itransfer_last_purge');
    const now = Date.now();
    if (!lastCleanup || now - parseInt(lastCleanup, 10) > 300000) {
      sessionStorage.setItem('itransfer_last_purge', now.toString());
      fetch('/api/r2?action=cleanup').catch(() => {});
      fetch('/api/drive?action=cleanup').catch(() => {});
    }
  }, []);

  return (
    <ErrorBoundary>
      <ToastProvider>
        <BrowserRouter>
          <ScrollToTop />
          <SeoHead />
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
        </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  );
}
