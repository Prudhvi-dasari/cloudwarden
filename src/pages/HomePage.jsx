import { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { applyTheme } from '../lib/theme';
import CheckoutReturnNotice from '../components/CheckoutReturnNotice';
import Navbar from '../components/Navbar';
const AuthModal = lazy(() => import('../components/AuthModal'));
const ProfileModal = lazy(() => import('../components/ProfileModal'));
const PaymentModal = lazy(() => import('../components/PaymentModal'));
const AdminPanelModal = lazy(() => import('../components/AdminPanelModal'));
const MyUploadsDrawer = lazy(() => import('../components/MyUploadsDrawer'));
import DropZone from '../components/DropZone';
import FileList from '../components/FileList';
import UploadProgress from '../components/UploadProgress';
import ShareLink from '../components/ShareLink';
import FloatingUploadDock from '../components/FloatingUploadDock';

const DashboardView = lazy(() => import('../components/DashboardView'));
const P2PTransferView = lazy(() => import('../components/P2PTransferView'));
import { clearUserSession, isAdmin } from '../lib/authSession';
import { useAccount } from '../lib/AccountContext';
import { playSuccessChime } from '../lib/sound';
import { detectClientGeo, guessVisitorPlace } from '../lib/geo';
import { generateTransferSlug, formatLiveSlugPreview } from '../lib/slug';
import { getOrCreateGuestId, saveTransferSecrets, trackGuestTransfer } from '../lib/guestSession';
import { TransferManager } from '../lib/transferManager';
import { clearActiveUpload, getActiveUpload, publishActiveUpload, subscribeActiveUpload, touchActiveUpload } from '../lib/activeUpload';
import {
  applyResumeToFile,
  deleteUploadSession,
  describeResume,
  identitiesMatch,
  loadUploadSessions,
  matchResumeSession,
  sessionIsResumable,
} from '../lib/uploadPersistence';
import { PART_SIZE_BYTES } from '../lib/uploadPlan';
import PersistentTransferManager from '../components/PersistentTransferManager';
import TransferSuccessModal from '../components/TransferSuccessModal';
import Footer from '../components/Footer';
import HeroSky from '../components/ds/HeroSky';
import AnimatedHeadline from '../components/ds/AnimatedHeadline';
import RotatingLead from '../components/ds/RotatingLead';
import PlanCards from '../components/ds/PlanCards';
import { JourneyStrip, PrivacyNotes, FactsBand, Chapters, HomeFaq } from '../components/home/HomeSections';
import { useToast } from '../components/Toast';
import { emailTransportFailure, interpretSendEmailResponse } from '../lib/emailStatus';
import {
  Mail, Link2, Send, ShieldCheck, Zap, Sparkles,
  CheckCircle2, Wifi, ArrowRight, Laptop, Smartphone,
  RefreshCw, Eye, EyeOff, HardDrive, Inbox, FolderPlus,
  HelpCircle, ChevronDown, Check, Globe, Layers, BarChart2,
  Code, Key, Star, Users, ArrowUpRight, Copy, CheckCircle,
  FileCheck, Server, AlertCircle
} from 'lucide-react';

const SEND_STORY = {
  link: {
    title: 'Send a file. They get a link.',
    accent: 2,
    line: '6 GB free, no signup on either side. Drop it, copy the link, and a password can gate the download.',
  },
  email: {
    title: 'Too big for the inbox.',
    accent: 1,
    line: 'Add their address and we mail a download button. The file stays on the link, up to 6 GB.',
  },
  device: {
    title: 'Phone to laptop. Nothing stored.',
    accent: 2,
    line: 'Open this page on both screens, pair with a short code, and the file goes straight across.',
  },
};

const LINK_FACTS = [
  '6 GB free',
  'No signup on either side',
  'Drop it, copy the link',
  'A password can gate the download',
];

const MODE_TABS = [
  { id: 'link', label: 'Link', icon: Link2 },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'device', label: 'Device', icon: Wifi },
];

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

const FAQS = [
  {
    q: 'How does SendToAnyone work?',
    a: 'Select files or a folder, choose how long the link stays open, and add a password or an email if you want one. The files upload to Cloudflare R2 and you get a download link.',
  },
  {
    q: 'Is SendToAnyone completely free to use?',
    a: 'Yes. You can send up to 6 GB per transfer with no account. Links last up to 7 days. Creator, Pro, and Studio on the pricing page raise the size, the total you can store, and how long the link stays open after the server confirms payment.',
  },
  {
    q: 'How are my files protected from hackers and eavesdropping?',
    a: 'An optional password gates the download. The server stores a salted hash of it, and the notification email does not include the password. The password does not encrypt the file. Executable names are blocked on upload. That is not a malware scan.',
  },
  {
    q: 'How long do transfer download links remain active?',
    a: 'A free transfer stays available for the time you choose, up to 7 days. Creator can keep a link for 30 days, Pro for 180 days, and Studio for 1 year, after the server confirms the plan.',
  },
  {
    q: 'Can I upload entire folders with nested subdirectories?',
    a: 'Select Folder adds the files in that folder. The transfer stores each file by its name. It does not promise that the nested folder layout is rebuilt for the recipient. A free transfer stays within 6 GB. Creator can reach 50 GB, and Pro or Studio can reach 250 GB.',
  },
  {
    q: 'How does Direct Device P2P work?',
    a: 'Device transfer sends the file directly between two screens on the same network, using WebRTC. The file is not stored here. Both devices stay on this page and pair with a code.',
  },
];

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
}

const EXPIRY_PRESETS = [
  { hours: 1, label: '1 Hour', subtitle: 'Quick share' },
  { hours: 24, label: '24 Hours', subtitle: '1 Day access' },
  { hours: 72, label: '3 Days', subtitle: '72 Hours' },
  { hours: 168, label: '7 Days', subtitle: 'Free Max' },
  { hours: 30 * 24, label: '30 Days', subtitle: 'Creator' },
  { hours: 180 * 24, label: '6 Months', subtitle: '180 days' },
  { hours: 365 * 24, label: '1 Year', subtitle: 'Studio' },
];

export default function HomePage() {
  const [searchParams] = useSearchParams();
  const { user, setUser } = useAccount();
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('signin');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(() => user?.user_metadata?.theme || 'indigo');
  const [activeNavTab, setActiveNavTab] = useState('transfer');

  // Mode Selection: 'link' | 'email' | 'device'
  const [mainMode, setMainMode] = useState(
    searchParams.get('mode') === 'device' || searchParams.get('p2p') === 'true' || searchParams.get('room')
      ? 'device'
      : 'link'
  );

  // Geolocation
  const [clientGeo, setClientGeo] = useState(() => guessVisitorPlace());
  const pageRef = useRef(null);
  const uploadLock = useRef(false);

  // Drawer & Upload Queue State
  const [isMyUploadsOpen, setIsMyUploadsOpen] = useState(false);
  const [activeBackgroundUploads, setActiveBackgroundUploads] = useState([]);

  // Form State
  const [files, setFiles] = useState([]);
  const [senderEmail, setSenderEmail] = useState(() => user?.email || '');
  const [recipientEmails, setRecipientEmails] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [enablePassword, setEnablePassword] = useState(false);
  const [expiryHours, setExpiryHours] = useState(168); // 7 days default
  const [allowance, setAllowance] = useState({ bytes: 6_000_000_000, hours: 168, paid: false, tier: 'free' });
  const [maxDownloads, setMaxDownloads] = useState(0);

  // Transfer Manager Overlay State
  const [activeTransferManager, setActiveTransferManager] = useState(null);
  const [transferSnapshot, setTransferSnapshot] = useState(null);
  const [isTransferManagerOpen, setIsTransferManagerOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Upload Progress State
  const [view, setView] = useState('form'); // 'form' | 'progress' | 'complete'
  const [progress, setProgress] = useState(0);
  const [currentFileName, setCurrentFileName] = useState('');
  const [uploadSpeed, setUploadSpeed] = useState('');
  const [timeRemaining, setTimeRemaining] = useState('');
  const [uploadStatus, setUploadStatus] = useState('idle');
  const [telemetry, setTelemetry] = useState(null);
  const [shareData, setShareData] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const { addToast } = useToast();

  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [resumeOffer, setResumeOffer] = useState(null);
  const uiToken = useRef({});
  const showOrbit = view === 'form' && files.length === 0 && mainMode !== 'device';

  useEffect(() => {
    const token = {};
    uiToken.current = token;
    const applyManager = (next) => {
      if (!next || uiToken.current !== token) return;
      setActiveTransferManager(next);
      const snap = next.getSnapshot();
      setTransferSnapshot(snap);
      setProgress(snap.overallProgress || 0);
      if (next.result) {
        setShareData(next.result);
        setView('complete');
        setUploadStatus('complete');
        return;
      }
      const busy = snap.overallStatus === 'uploading' || snap.overallStatus === 'paused' || snap.overallStatus === 'error'
        || snap.uploadingFiles > 0 || snap.pausedFiles > 0 || snap.queuedFiles > 0;
      if (busy) {
        setView('progress');
        setUploadStatus(snap.overallStatus === 'paused' ? 'paused' : snap.overallStatus === 'error' ? 'error' : 'uploading');
      }
    };
    applyManager(getActiveUpload().manager);
    const unsub = subscribeActiveUpload(({ manager: next }) => applyManager(next));
    loadUploadSessions().then((sessions) => {
      if (uiToken.current !== token || getActiveUpload().manager) return;
      const saved = (sessions || []).filter((session) => sessionIsResumable(session))
        .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt))[0];
      if (saved) setResumeOffer(describeResume(saved));
    }).catch(() => {});
    return () => { unsub(); };
  }, []);

  useEffect(() => {
    function handleOnline() { setIsOffline(false); }
    function handleOffline() { setIsOffline(true); }
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Live Browser Tab Title Percentage
  useEffect(() => {
    if (view === 'progress' || (activeBackgroundUploads.length > 0 && activeBackgroundUploads[0]?.status === 'uploading')) {
      const activeProg = view === 'progress' ? progress : (activeBackgroundUploads[0]?.progress || 0);
      document.title = `(${Math.round(activeProg)}%) SendToAnyone — Uploading...`;
    } else if (view === 'complete') {
      document.title = `✅ Transfer Ready! • SendToAnyone`;
    } else {
      document.title = 'Send large files free, up to 6 GB — SendToAnyone';
    }
  }, [view, progress, activeBackgroundUploads]);

  useEffect(() => {
    if (!user) {
      setSenderEmail('');
      return;
    }
    setSenderEmail(user.email || '');
    const userTheme = user.user_metadata?.theme || 'indigo';
    setCurrentTheme(userTheme);
    applyTheme(userTheme);
  }, [user]);

  useEffect(() => {
    detectClientGeo().then((g) => { if (g) setClientGeo(g); });
  }, []);

  const pickMode = useCallback((mode) => {
    setActiveNavTab('transfer');
    setMainMode(mode);
    if (mode !== 'device') setView('form');
    document.getElementById('transfer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const isMasterAdmin = isAdmin(user);
  const maxSizeBytes = allowance.bytes;
  const maxSizeGb = Math.max(1, Math.round(maxSizeBytes / 1_000_000_000));
  const maxSizeLabel = maxSizeGb >= 1000 ? `${Math.round(maxSizeGb / 1000)} TB` : `${maxSizeGb} GB`;
  const retentionDays = Math.max(1, Math.round((allowance.hours || 168) / 24));
  const planLabel = allowance.tier === 'creator'
    ? 'Creator'
    : allowance.tier === 'studio'
      ? 'Studio'
      : allowance.paid
        ? 'Pro'
        : 'Free';
  const expiryChoices = EXPIRY_PRESETS.filter((preset) => preset.hours <= allowance.hours);

  useEffect(() => {
    let alive = true;
    async function loadAllowance() {
      if (!user) {
        if (alive) setAllowance({ bytes: 6_000_000_000, hours: 168, paid: false, tier: 'free' });
        return;
      }
      try {
        const { supabase } = await import('../lib/supabase.js');
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        const response = await fetch('/api/r2?action=tier-limits', {
          headers: token ? { authorization: `Bearer ${token}` } : {},
        });
        const body = await response.json();
        if (!alive || !response.ok || !body.maxFileSizeBytes) return;
        setAllowance({
          bytes: Number(body.maxFileSizeBytes),
          hours: Number(body.maxRetentionHours) || 168,
          paid: body.paid === true,
          tier: body.tier || (body.paid ? 'pro' : 'free'),
        });
      } catch {
        if (alive) setAllowance({ bytes: 6_000_000_000, hours: 168, paid: false, tier: 'free' });
      }
    }
    loadAllowance();
    return () => { alive = false; };
  }, [user]);

  useEffect(() => {
    if (expiryHours > allowance.hours) setExpiryHours(allowance.hours);
  }, [allowance.hours, expiryHours]);

  const handleFilesSelected = useCallback((newFiles) => {
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const handleRemoveFile = useCallback((index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleOpenAuth = (mode) => {
    const next = mode === 'signup' || mode === 'register' ? 'register' : 'login';
    setAuthMode(next);
    setIsAuthOpen(true);
  };

  const handleSignOut = async () => {
    try {
      await clearUserSession();
    } catch (e) {}
    setUser(null);
    setSenderEmail('');
    setIsProfileOpen(false);
    setActiveNavTab('transfer');
    applyTheme('indigo');
    setCurrentTheme('indigo');
  };

  const handleRunInBackground = () => {
    setView('form');
    setFiles([]);
    setSubject('');
    setMessage('');
    setPassword('');
    setEnablePassword(false);
    setRecipientEmails('');
  };

  const handleAppendMoreFiles = (newFiles) => {
    if (activeTransferManager) {
      activeTransferManager.addFiles(newFiles);
      setTransferSnapshot(activeTransferManager.getSnapshot());
    } else {
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleCopyGeneratedLink = () => {
    const slug = shareData?.shareId || activeTransferManager?.shareId;
    if (slug) {
      const url = `${window.location.origin}/d/${slug}`;
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleUploadLinkTransfer = async () => {
    if (uploadLock.current || files.length === 0) return;

    if (mainMode === 'email' && !recipientEmails.trim()) {
      addToast('Please enter at least one recipient email address.', 'error');
      return;
    }

    if (enablePassword && !password.trim()) {
      addToast('Enter a password, or turn off password protection.', 'error');
      return;
    }

    const totalSize = files.reduce((acc, f) => acc + f.size, 0);
    if (totalSize > maxSizeBytes) {
      addToast(`This transfer is larger than the ${maxSizeLabel} limit (${formatBytes(totalSize)}).`, 'error');
      return;
    }

    // 1. Generate Smart Slug from Title / Subject (or fallback random)
    const generatedSlug = generateTransferSlug(subject);
    const savedSessions = await loadUploadSessions().catch(() => []);
    const saved = matchResumeSession(savedSessions, files);
    const guestId = getOrCreateGuestId();
    const isGuest = !user;
    const userDisplayName = user ? (user.user_metadata?.fullName || user.user_metadata?.full_name || user.email?.split('@')[0]) : null;
    const finalTransferName = subject.trim() || `Transfer-${generatedSlug.slice(0, 6).toUpperCase()}`;

    // 2. Instantiate Persistent TransferManager
    const safeExpiry = expiryHours > 0 && expiryHours <= allowance.hours ? expiryHours : allowance.hours;
    const manager = new TransferManager({
      shareId: saved?.shareId || generatedSlug,
      deleteToken: saved?.deleteToken,
      claimToken: saved?.claimToken,
      expiresAt: saved?.expiresAt,
      transferName: finalTransferName,
      expiryHours: safeExpiry,
      isGuest,
      guestId,
      userDisplayName,
      concurrency: 3,
      apiBase: '/api/r2',
      password: enablePassword ? password.trim() : '',
      senderEmail: user?.email || `guest:${guestId}`,
      transferType: mainMode,
      accessToken: async () => {
        const { supabase } = await import('../lib/supabase.js');
        const { data } = await supabase.auth.getSession();
        return data?.session?.access_token || '';
      },
    });

    uploadLock.current = true;
    manager.uiToken = uiToken.current;
    setActiveTransferManager(manager);
    publishActiveUpload(manager);
    const added = manager.addFiles(files);
    if (saved) {
      for (const item of added) {
        const match = saved.files.find((file) => identitiesMatch(file, item.file));
        if (match) applyResumeToFile(item, match, PART_SIZE_BYTES);
      }
      setResumeOffer(null);
    }
    setTransferSnapshot(manager.getSnapshot());
    setIsTransferManagerOpen(false);
    setShowSuccessModal(false);
    setView('progress');
    setUploadStatus('uploading');

    // Subscribe to state changes
    manager.on('stateChanged', (snap) => {
      if (manager.uiToken !== uiToken.current) return;
      setTransferSnapshot(snap);
      setProgress(snap.overallProgress || 0);
      setUploadSpeed(snap.aggregateSpeed > 0 ? snap.speedStr : '');
      setTimeRemaining(snap.aggregateSpeed > 0 && snap.etaSeconds > 0 ? snap.timeRemainingStr : '');
      setCurrentFileName(snap.activeFileName || snap.files?.find((f) => f.status === 'uploading')?.name || snap.files?.[0]?.name || '');
      setUploadStatus((prev) => {
        if (prev === 'complete') return prev;
        if (snap.overallStatus === 'paused') return 'paused';
        if (snap.overallStatus === 'error') return 'error';
        if (snap.overallStatus === 'complete') return 'confirming';
        return 'uploading';
      });
    });

    manager.on('transferComplete', async (snap) => {
      const visible = manager.uiToken === uiToken.current;
      if (visible) setTransferSnapshot(manager.getSnapshot());
      const completedFiles = snap.files.filter(f => f.status === 'completed');
      if (completedFiles.length === 0) return;

      const expiresAt = manager.expiresAt
        || new Date(Date.now() + safeExpiry * 60 * 60 * 1000).toISOString();
      const pwdHash = enablePassword && password.trim() ? await sha256Hex(password.trim()) : null;

      setUploadStatus('confirming');
      setProgress(100);
      if (!completedFiles.every((file) => file.serverRecorded && file.fileId)) {
        uploadLock.current = false;
        setUploadStatus('error');
        addToast('The files uploaded, but the link could not be saved. Try again.', 'error');
        return;
      }
      fetch('/api/r2?action=event', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ event: saved ? 'upload_resumed' : 'link_created' }),
      }).catch(() => {});
      saveTransferSecrets(manager.shareId || generatedSlug, {
        claimToken: manager.claimToken,
        deleteToken: manager.deleteToken,
      });

      const publishedShareId = manager.shareId || generatedSlug;
      if (isGuest) {
        trackGuestTransfer(publishedShareId);
      }

      let emailResult = null;
      if (mainMode === 'email' && recipientEmails) {
        try {
          const emailRes = await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              senderEmail: senderEmail || user?.email,
              recipientEmails,
              subject: finalTransferName,
              message,
              shareId: publishedShareId,
              fileCount: completedFiles.length,
              totalSize: snap.totalBytes,
              expiresAt,
              expiryHours: safeExpiry,
              isPasswordProtected: !!pwdHash,
            }),
          });
          emailResult = interpretSendEmailResponse(emailRes.ok, await emailRes.json().catch(() => null));
        } catch {
          emailResult = emailTransportFailure();
        }
      }

      try { playSuccessChime(); } catch (e) {}

      const formattedFiles = completedFiles.map(f => ({ name: f.name, size: f.size, type: f.type }));
      const payload = {
        shareId: publishedShareId,
        fileCount: completedFiles.length,
        totalSize: snap.totalBytes,
        expiresAt,
        transferType: mainMode,
        recipientEmails,
        senderEmail: senderEmail || user?.email,
        isPasswordProtected: !!pwdHash,
        maxDownloads,
        subject: finalTransferName,
        message,
        emailResult,
        files: formattedFiles,
        filesList: formattedFiles,
      };
      manager.result = payload;
      touchActiveUpload();
      if (!visible) return;
      setShareData(payload);
      setUploadStatus('complete');
      setView('complete');
      setShowSuccessModal(false);
      setTransferSnapshot(manager.getSnapshot());
    });

    manager.start();
  };

  const handlePauseUpload = () => {
    if (!activeTransferManager) return;
    if (uploadStatus === 'paused') activeTransferManager.resumeAll();
    else activeTransferManager.pauseAll();
  };

  const handleRetryUpload = () => {
    if (!activeTransferManager || !transferSnapshot) return;
    transferSnapshot.files
      .filter((file) => file.status === 'error')
      .forEach((file) => activeTransferManager.retryFile(file.id));
    activeTransferManager.start();
  };

  const handleCancelUpload = () => {
    if (activeTransferManager) {
      const shareId = activeTransferManager.shareId;
      activeTransferManager.cancelAll();
      deleteUploadSession(shareId);
      clearActiveUpload(shareId);
      setActiveTransferManager(null);
    }
    uploadLock.current = false;
    setIsTransferManagerOpen(false);
    setView('form');
    setProgress(0);
    setUploadStatus('idle');
  };

  const handleReset = () => {
    setView('form');
    setFiles([]);
    setSubject('');
    setMessage('');
    setPassword('');
    setEnablePassword(false);
    setRecipientEmails('');
    setShareData(null);
    setProgress(0);
    setUploadStatus('idle');
    uploadLock.current = false;
    setShowSuccessModal(false);
    setShowAdvancedOptions(false);
  };

  return (
    <div ref={pageRef} className="ds-page">
      {activeNavTab !== 'dashboard' && (
        <div className="absolute inset-x-0 top-0 h-[min(980px,118svh)] pointer-events-none overflow-hidden">
          <HeroSky timeZone={clientGeo.timeZone} />
        </div>
      )}

      <Navbar
        user={user}
        onOpenAuth={handleOpenAuth}
        onOpenProfile={() => setIsProfileOpen(true)}
        activeTab={activeNavTab}
        setActiveTab={setActiveNavTab}
        onOpenMyUploads={() => setIsMyUploadsOpen(true)}
      />
      <CheckoutReturnNotice />

      {activeNavTab === 'dashboard' ? (
        <div className="ds-wrap py-8 flex-1 relative z-10">
          <div className="mb-6">
            <p className="ds-kicker"><b>●</b> Your account</p>
            <h1 className="ds-h2 mt-2">My files</h1>
          </div>
          <div className="ds-frame">
            <div className="ds-frame-screen">
              <Suspense fallback={
                <div className="py-20 flex flex-col items-center justify-center gap-3 text-center text-[var(--ds-muted)]">
                  <span className="ds-spinner" aria-hidden="true" />
                  <p className="text-xs">Loading dashboard…</p>
                </div>
              }>
                <DashboardView
                  user={user}
                  onOpenAuth={handleOpenAuth}
                  onStartTransfer={() => setActiveNavTab('transfer')}
                />
              </Suspense>
            </div>
          </div>
        </div>
      ) : (
        <>
          <section
            id="transfer"
            className={`ds-hero relative z-10 scroll-mt-16${view === 'progress' ? ' hero-sending' : ''}`}
          >
            <div className="ds-wrap ds-hero-grid">
              <div className="ds-hero-copy" aria-live="polite">
                {(() => {
                  const story = SEND_STORY[mainMode] || SEND_STORY.link;
                  let title = story.title;
                  let line = story.line;
                  let accent = story.accent;
                  if (view === 'progress') {
                    title = 'Your file is leaving.';
                    line = 'Stay on this page until the link is ready. You can keep it running in the background.';
                    accent = 1;
                  } else if (view === 'complete') {
                    title = 'The link is ready.';
                    line = 'Send it anywhere. It closes when the time you chose runs out.';
                    accent = 1;
                  } else if (files.length > 0 && mainMode === 'email') {
                    title = 'Add who should get it.';
                    line = 'We mail the link. The file never sits in their inbox.';
                    accent = 2;
                  } else if (files.length > 0 && mainMode === 'link') {
                    title = 'One step from a link.';
                    line = 'Name it if you want. A password can gate the download.';
                    accent = 1;
                  }
                  const cycleFacts = view === 'form' && files.length === 0 && mainMode === 'link';
                  return (
                    <>
                      <Link to="/pricing" className="ds-announce">
                        <span className="ds-announce-tag">Plans</span>
                        Creator ₹299 · Pro ₹799 · Studio ₹2,499
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                      <AnimatedHeadline text={title} accent={accent} />
                      {cycleFacts ? (
                        <RotatingLead phrases={LINK_FACTS} label={SEND_STORY.link.line} />
                      ) : (
                        <p className="ds-lead">{line}</p>
                      )}
                    </>
                  );
                })()}
                <PrivacyNotes />
              </div>

              <div className="ds-frame" data-reveal style={{ '--d': '200ms' }}>
                <div className="ds-frame-chrome">
                  <span className="ds-frame-dots" aria-hidden="true"><i /><i /><i /></span>
                  <div className="ds-tabs" role="group" aria-label="How to send">
                    {MODE_TABS.map((m) => {
                      const Icon = m.icon;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            const busy = view === 'progress' || uploadStatus === 'uploading' || uploadStatus === 'paused' || uploadStatus === 'confirming';
                            setMainMode(m.id);
                            if (busy && m.id !== 'device') {
                              setView('progress');
                              return;
                            }
                            if (m.id !== 'device') setView('form');
                          }}
                          className="ds-tab"
                          aria-pressed={mainMode === m.id}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {m.label}
                        </button>
                      );
                    })}
                    <Link to="/receive" className="ds-tab">
                      <Inbox className="w-3.5 h-3.5" />
                      Request
                    </Link>
                  </div>
                </div>

              <div className="ds-frame-screen home-hero-stage">
                {mainMode === 'device' ? (
                  <div className="snd-shell">
                    <Suspense fallback={
                      <div className="py-12 flex flex-col items-center justify-center gap-3 text-center text-[var(--ds-muted)]">
                        <span className="ds-spinner" aria-hidden="true" />
                        <p className="text-sm">Opening the device transfer…</p>
                      </div>
                    }>
                      <P2PTransferView initialRoom={searchParams.get('room') || undefined} />
                    </Suspense>
                  </div>
                ) : (
                  <>
                    {view === 'form' && files.length === 0 && (
                      <>
                        {resumeOffer && (
                          <p className="snd-note" role="status">
                            <span>
                              {resumeOffer.name} stopped at {resumeOffer.percent}%. Drop that same file to continue where it left off.
                            </span>
                            <button
                              type="button"
                              className="ds-btn ds-btn-ghost ds-btn-sm"
                              onClick={() => {
                                deleteUploadSession(resumeOffer.shareId);
                                setResumeOffer(null);
                              }}
                            >
                              Dismiss
                            </button>
                          </p>
                        )}
                        <DropZone onFilesSelected={handleFilesSelected} windowDrop />
                      </>
                    )}

                    {view === 'form' && files.length > 0 && (
                      <div className="snd-sheet">
                        {mainMode === 'email' && (
                          <div className="snd-email">
                            <p className="snd-note">
                              <Mail aria-hidden="true" />
                              <span>The email contains the download link. The file is not attached.</span>
                            </p>
                            <div className="snd-fields is-pair">
                              <label htmlFor="send-recipient" className="ds-field">
                                <span className="ds-label">Recipient</span>
                                <input
                                  id="send-recipient"
                                  type="email"
                                  value={recipientEmails}
                                  onChange={(e) => setRecipientEmails(e.target.value)}
                                  placeholder="colleague@company.com"
                                  autoComplete="email"
                                  className="ds-input"
                                  required
                                />
                              </label>
                              <label htmlFor="send-sender" className="ds-field">
                                <span className="ds-label">Your email</span>
                                <input
                                  id="send-sender"
                                  type="email"
                                  value={senderEmail}
                                  onChange={(e) => setSenderEmail(e.target.value)}
                                  placeholder="you@company.com"
                                  autoComplete="email"
                                  className="ds-input"
                                />
                              </label>
                            </div>
                          </div>
                        )}

                        <FileList
                          files={files}
                          onRemoveFile={handleRemoveFile}
                          onAddMore={handleFilesSelected}
                          maxSizeBytes={maxSizeBytes}
                          maxSizeLabel={maxSizeLabel}
                        />

                        <fieldset className="snd-expiry snd-sep">
                          <legend className="snd-label-row">
                            <span>Link stays open</span>
                            <small>{planLabel} · up to {retentionDays >= 365 ? '1 year' : `${retentionDays} days`}</small>
                          </legend>
                          <div className="snd-choices">
                            {expiryChoices.map((preset) => {
                              const isSelected = expiryHours === preset.hours;
                              return (
                                <button
                                  key={preset.hours}
                                  type="button"
                                  onClick={() => setExpiryHours(preset.hours)}
                                  aria-pressed={isSelected}
                                  className="snd-choice"
                                >
                                  <strong>{preset.label}</strong>
                                  <span>{preset.subtitle}</span>
                                </button>
                              );
                            })}
                          </div>
                        </fieldset>

                        <div className="snd-toggle snd-sep">
                          <label className="snd-toggle-row" htmlFor="send-password-toggle">
                            <span className="ds-icon is-sm" aria-hidden="true">
                              <Key />
                            </span>
                            <span className="snd-toggle-text">
                              <strong>Password</strong>
                              <span>Gates the download. Optional.</span>
                            </span>
                            <input
                              id="send-password-toggle"
                              type="checkbox"
                              className="snd-switch"
                              checked={enablePassword}
                              onChange={(e) => setEnablePassword(e.target.checked)}
                            />
                          </label>
                          {enablePassword && (
                            <>
                              <div className="snd-secret">
                                <input
                                  type={showPassword ? 'text' : 'password'}
                                  value={password}
                                  onChange={(e) => setPassword(e.target.value)}
                                  placeholder="Password for the download"
                                  autoComplete="new-password"
                                  className="ds-input"
                                  aria-label="Download password"
                                />
                                <button
                                  type="button"
                                  className="snd-icon-btn"
                                  onClick={() => setShowPassword(!showPassword)}
                                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                              </div>
                              <p className="ds-hint">The recipient types it before the download starts. It does not encrypt the file.</p>
                            </>
                          )}
                        </div>

                        <div className="snd-sep">
                          <button
                            type="button"
                            onClick={() => setShowAdvancedOptions((v) => !v)}
                            aria-expanded={showAdvancedOptions}
                            aria-controls="transfer-options"
                            className="snd-disclosure"
                          >
                            <span>Title and message</span>
                            <span>
                              <span className="snd-tag">Optional</span>
                              <ChevronDown className={showAdvancedOptions ? 'is-open' : ''} aria-hidden="true" />
                            </span>
                          </button>

                          {showAdvancedOptions && (
                            <div id="transfer-options" className="snd-details">
                              <label htmlFor="send-title" className="ds-field">
                                <span className="ds-label">Title</span>
                                <input
                                  id="send-title"
                                  type="text"
                                  value={subject}
                                  onChange={(e) => setSubject(e.target.value)}
                                  placeholder="Brand assets"
                                  className="ds-input"
                                />
                              </label>
                              <p className="snd-slug">
                                <Link2 className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>/d/{formatLiveSlugPreview(subject)}</span>
                              </p>
                              <label htmlFor="send-message" className="ds-field">
                                <span className="ds-label">Message</span>
                                <textarea
                                  id="send-message"
                                  value={message}
                                  onChange={(e) => setMessage(e.target.value)}
                                  placeholder="Optional note for the recipient"
                                  rows={2}
                                  className="ds-textarea"
                                />
                              </label>
                            </div>
                          )}
                        </div>

                        {files.reduce((sum, file) => sum + file.size, 0) > maxSizeBytes && (
                          <p className="ds-alert is-danger" role="alert">
                            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                            <span>This transfer is larger than {maxSizeLabel}. Remove a file to continue.</span>
                          </p>
                        )}

                        <button
                          type="button"
                          onClick={handleUploadLinkTransfer}
                          disabled={files.reduce((sum, file) => sum + file.size, 0) > maxSizeBytes}
                          className="ds-btn ds-btn-dark ds-btn-lg snd-go"
                        >
                          <span>
                            {mainMode === 'email' ? 'Send the link' : 'Create download link'}
                          </span>
                          <ArrowRight className="w-4 h-4 shrink-0 ds-btn-arrow" aria-hidden="true" />
                        </button>
                        <p className="snd-fine">
                          Up to {maxSizeLabel} per transfer. The files are deleted after the link closes.
                        </p>
                      </div>
                    )}

                    {view === 'progress' && (
                      <div className="snd-shell">
                        <UploadProgress
                          progress={progress}
                          fileName={currentFileName}
                          uploadSpeed={uploadSpeed}
                          timeRemaining={timeRemaining}
                          status={uploadStatus}
                          isPaused={uploadStatus === 'paused'}
                          isOffline={isOffline}
                          onRunInBackground={handleRunInBackground}
                          onCancel={handleCancelUpload}
                          onPause={handlePauseUpload}
                          onRetry={handleRetryUpload}
                        />
                      </div>
                    )}

                    {view === 'complete' && shareData && (
                      <div className="snd-shell">
                        <ShareLink
                          shareId={shareData.shareId}
                          fileCount={shareData.fileCount}
                          totalSize={shareData.totalSize}
                          expiresAt={shareData.expiresAt}
                          transferType={shareData.transferType}
                          recipientEmails={shareData.recipientEmails}
                          senderEmail={shareData.senderEmail}
                          isPasswordProtected={shareData.isPasswordProtected}
                          maxDownloads={shareData.maxDownloads}
                          subject={shareData.subject}
                          message={shareData.message}
                          filesList={shareData.filesList || shareData.files || []}
                          emailResult={shareData.emailResult}
                          onReset={handleReset}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
              </div>
            </div>

            <div className="ds-wrap relative z-10 mt-8 sm:mt-12">
              <JourneyStrip
                countryCode={clientGeo.countryCode}
                countryName={clientGeo.countryName}
              />
            </div>
          </section>

          <FactsBand />

          <Chapters onPickMode={pickMode} />

          <section id="plans" className="ds-section" aria-labelledby="plans-title">
            <div className="ds-wrap">
              <div className="ds-section-head is-center" data-reveal>
                <p className="ds-kicker"><b>●</b> Pricing</p>
                <h2 id="plans-title" className="ds-h2">Free up to 6 GB. Paid plans when the file is bigger.</h2>
                <p className="ds-lead">No card to send. Creator, Pro, and Studio open a Dodo checkout and apply once the payment is confirmed.</p>
              </div>
              <div className="mt-12 max-w-4xl mx-auto">
                <PlanCards freeHref="#transfer" isPro={allowance.paid} />
              </div>
            </div>
          </section>

          <HomeFaq faqs={FAQS} />
        </>
      )}

      <Footer />

      <FloatingUploadDock
        activeUploads={activeBackgroundUploads}
        onStartAnother={handleRunInBackground}
        onDismissUpload={(id) => setActiveBackgroundUploads((prev) => prev.filter((q) => q.id !== id))}
      />

      <Suspense fallback={null}>
      {isMyUploadsOpen && (
      <MyUploadsDrawer
        isOpen={isMyUploadsOpen}
        onClose={() => setIsMyUploadsOpen(false)}
        user={user}
        onOpenAuth={handleOpenAuth}
        onStartNewTransfer={() => {
          setView('form');
          setFiles([]);
        }}
      />
      )}

      <TransferSuccessModal
        open={showSuccessModal && !!shareData}
        shareId={shareData?.shareId}
        fileCount={shareData?.fileCount}
        totalSize={shareData?.totalSize}
        expiresAt={shareData?.expiresAt}
        subject={shareData?.subject}
        onClose={() => setShowSuccessModal(false)}
        onSendAnother={handleReset}
        onViewDashboard={() => {
          setShowSuccessModal(false);
          setActiveNavTab('dashboard');
        }}
      />

      {isAuthOpen && (
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        initialMode={authMode}
        onAuthSuccess={(u) => setUser(u)}
      />
      )}

      {isProfileOpen && (
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        user={user}
        onSignOut={handleSignOut}
        currentTheme={currentTheme}
        onThemeChange={(t) => setCurrentTheme(t)}
        onAccountChange={setUser}
        onOpenUpgrade={() => setIsPaymentOpen(true)}
        onOpenAdmin={() => setIsAdminPanelOpen(true)}
      />
      )}

      {isPaymentOpen && (
      <PaymentModal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        user={user}
        onUpgradeSuccess={(updated) => setUser(updated)}
      />
      )}

      {isTransferManagerOpen && activeTransferManager && (
        <PersistentTransferManager
          manager={activeTransferManager}
          snapshot={transferSnapshot}
          onAddFiles={handleAppendMoreFiles}
          onClose={() => setIsTransferManagerOpen(false)}
          onCancelAndEdit={handleCancelUpload}
          shareUrl={`${window.location.origin}/d/${shareData?.shareId || activeTransferManager.shareId}`}
          copied={copiedLink}
          onCopyLink={handleCopyGeneratedLink}
        />
      )}

      {isMasterAdmin && isAdminPanelOpen && (
        <AdminPanelModal
          isOpen={isAdminPanelOpen}
          onClose={() => setIsAdminPanelOpen(false)}
          user={user}
        />
      )}
      </Suspense>
    </div>
  );
}
