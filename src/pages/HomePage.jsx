import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { applyTheme } from '../lib/supabase';
import Navbar from '../components/Navbar';
import AuthModal from '../components/AuthModal';
import ProfileModal from '../components/ProfileModal';
import PaymentModal from '../components/PaymentModal';
import AdminPanelModal from '../components/AdminPanelModal';
import DropZone from '../components/DropZone';
import FileList from '../components/FileList';
import UploadProgress from '../components/UploadProgress';
import ShareLink from '../components/ShareLink';
import DashboardView from '../components/DashboardView';
import P2PTransferView from '../components/P2PTransferView';
import MyUploadsDrawer from '../components/MyUploadsDrawer';
import FloatingUploadDock from '../components/FloatingUploadDock';
import { clearUserSession, isAdmin } from '../lib/authSession';
import { useAccount } from '../lib/AccountContext';
import { playSuccessChime } from '../lib/sound';
import { detectClientGeo, guessVisitorPlace } from '../lib/geo';
import { generateTransferSlug, formatLiveSlugPreview } from '../lib/slug';
import { getOrCreateGuestId, saveTransferSecrets, trackGuestTransfer } from '../lib/guestSession';
import { TransferManager } from '../lib/transferManager';
import PersistentTransferManager from '../components/PersistentTransferManager';
import TransferSuccessModal from '../components/TransferSuccessModal';
import FlagBearer from '../components/FlagBearer';
import SkyScene from '../components/SkyScene';
import StoryLane from '../components/StoryLane';
import Footer from '../components/Footer';
import { useToast } from '../components/Toast';
import {
  Mail, Link2, Lock, Send, ShieldCheck, Zap, Sparkles,
  CheckCircle2, Wifi, ArrowRight, Laptop, Smartphone,
  RefreshCw, Eye, EyeOff, HardDrive, Inbox, FolderPlus,
  HelpCircle, ChevronDown, Check, Globe, Layers, BarChart2,
  Code, Key, Clock, Star, Users, ArrowUpRight, Copy, CheckCircle,
  FileCheck, Server, AlertCircle
} from 'lucide-react';

const SEND_STORY = {
  link: {
    title: 'Send a file. They get a link.',
    line: '6 GB free. No signup. A password can gate the download.',
    bubble: 'Drop a file here. You get a link in seconds.',
    steps: ['You drop it', 'A link leaves', 'They open it'],
  },
  email: {
    title: 'Too big for the inbox.',
    line: 'The mail carries the link. The file stays on it, up to 6 GB.',
    bubble: 'Drop the file, add their email, and we send the link.',
    steps: ['You drop it', 'We mail the link', 'They download it'],
  },
  device: {
    title: 'Phone to laptop. Nothing stored.',
    line: 'Both screens stay on this page. The file goes straight across.',
    bubble: 'Open iTransfer on both devices and pair with a short code.',
    steps: ['Open both screens', 'Pair a code', 'Nothing is stored'],
  },
};

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

const FAQS = [
  {
    q: 'How does iTransfer work?',
    a: 'Simply select your files or an entire folder, configure your transfer settings (optional password, expiration time, or recipient email), and click Transfer. Your files stream directly to Cloudflare R2 object storage at gigabit edge speed, generating an instant shareable link.',
  },
  {
    q: 'Is iTransfer completely free to use?',
    a: 'Yes. You can send up to 6 GB per transfer with no account. Links last up to 7 days. Larger transfers and longer retention are not available yet.',
  },
  {
    q: 'How are my files protected from hackers and eavesdropping?',
    a: 'Files travel over TLS 1.3 and are stored with AES-256 at rest on Cloudflare R2. Optional password protection gates downloads (hashed on our servers — not zero-knowledge E2EE). Dangerous executables are blocked on upload.',
  },
  {
    q: 'How long do transfer download links remain active?',
    a: 'A free transfer stays available for the time you choose, up to 7 days. After that the link stops working. Longer retention is not available yet.',
  },
  {
    q: 'Can I upload entire folders with nested subdirectories?',
    a: 'Yes. Click "Select Folder" or drag an entire folder into the transfer zone. iTransfer preserves your directory structure so recipients receive the exact layout you sent.',
  },
  {
    q: 'How does Direct Device P2P work?',
    a: 'Device P2P transfers files directly between your devices (e.g., iPhone to Windows PC or Mac to Android) over your local network using WebRTC. Files never touch any cloud server, providing infinite transfer speeds with zero storage limits.',
  },
];

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
}

const EXPIRY_PRESETS = [
  { hours: 1, label: '1 Hour', subtitle: 'Flash access' },
  { hours: 24, label: '24 Hours', subtitle: '1 Day access' },
  { hours: 72, label: '3 Days', subtitle: 'Quick team' },
  { hours: 168, label: '7 Days', subtitle: 'Standard Free' },
  { hours: 336, label: '14 Days', subtitle: 'Extended', trial: true },
  { hours: 720, label: '30 Days', subtitle: '1 Month', pro: true },
  { hours: 0, label: 'Permanent', subtitle: 'Never expire', pro: true },
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
  const [scrollY, setScrollY] = useState(0);
  const [storyChapter, setStoryChapter] = useState('hero');
  const [chapterProgress, setChapterProgress] = useState(0);
  // React-owned visibility — classList is-in is wiped on re-render
  const [revealed, setRevealed] = useState(() => new Set(['hero']));
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
  const [openFaq, setOpenFaq] = useState(0);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const { addToast } = useToast();

  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const showOrbit = view === 'form' && files.length === 0 && mainMode !== 'device';

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
      document.title = `(${Math.round(activeProg)}%) iTransfer — Uploading...`;
    } else if (view === 'complete') {
      document.title = `✅ Transfer Ready! • iTransfer`;
    } else {
      document.title = `iTransfer — Send Large Files Free (6 GB)`;
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

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const y = window.scrollY || 0;
        setScrollY(y);
        const nodes = pageRef.current?.querySelectorAll('[data-chapter]');
        if (nodes?.length) {
          const mid = window.innerHeight * 0.42;
          let best = 'hero';
          let bestScore = Infinity;
          let prog = 0;
          const nextRevealed = new Set();
          nodes.forEach((node) => {
            const id = node.getAttribute('data-chapter') || 'hero';
            const rect = node.getBoundingClientRect();
            const center = rect.top + rect.height * 0.35;
            const score = Math.abs(center - mid);
            if (score < bestScore) {
              bestScore = score;
              best = id;
              prog = Math.min(1, Math.max(0, (window.innerHeight - rect.top) / (window.innerHeight + rect.height * 0.5)));
            }
            if (rect.top < window.innerHeight * 0.88 && rect.bottom > 60) {
              nextRevealed.add(id);
            }
          });
          nextRevealed.add('hero');
          setStoryChapter(best);
          setChapterProgress(prog);
          setRevealed((prev) => {
            if (prev.size === nextRevealed.size && [...nextRevealed].every((k) => prev.has(k))) return prev;
            return nextRevealed;
          });
        }
        ticking = false;
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  const chapterClass = (id, extra = '') =>
    `chapter-reveal ${revealed.has(id) ? 'is-in' : ''} ${extra}`.trim();

  const isMasterAdmin = isAdmin(user);
  const maxSizeBytes = 6_000_000_000;

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
      addToast(`This transfer is larger than the 6 GB free limit (${formatBytes(totalSize)}).`, 'error');
      return;
    }

    // 1. Generate Smart Slug from Title / Subject (or fallback random)
    const generatedSlug = generateTransferSlug(subject);
    const guestId = getOrCreateGuestId();
    const isGuest = !user;
    const userDisplayName = user ? (user.user_metadata?.fullName || user.user_metadata?.full_name || user.email?.split('@')[0]) : null;
    const finalTransferName = subject.trim() || `Transfer-${generatedSlug.slice(0, 6).toUpperCase()}`;

    // 2. Instantiate Persistent TransferManager
    const safeExpiry = expiryHours > 0 && expiryHours <= 168 ? expiryHours : 168;
    const manager = new TransferManager({
      shareId: generatedSlug,
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
    });

    uploadLock.current = true;
    setActiveTransferManager(manager);
    manager.addFiles(files);
    setTransferSnapshot(manager.getSnapshot());
    setIsTransferManagerOpen(false);
    setShowSuccessModal(false);
    setView('progress');
    setUploadStatus('uploading');

    // Subscribe to state changes
    manager.on('stateChanged', (snap) => {
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
      setTransferSnapshot(manager.getSnapshot());
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
              isPasswordProtected: !!pwdHash,
            }),
          });
          emailResult = await emailRes.json();
        } catch (e) {
          console.warn('Email send warning:', e);
        }
      }

      try { playSuccessChime(); } catch (e) {}

      const formattedFiles = completedFiles.map(f => ({ name: f.name, size: f.size, type: f.type }));
      setShareData({
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
      });
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
      activeTransferManager.cancelAll();
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
    <div ref={pageRef} className="min-h-screen flex flex-col bg-transparent text-white relative">
      {activeNavTab !== 'dashboard' && (
        <>
          <SkyScene scrollY={scrollY} chapter={storyChapter} timeZone={clientGeo.timeZone} />
          <StoryLane
            chapter={view === 'form' ? storyChapter : 'hero'}
            progress={chapterProgress}
            journey={view === 'form' ? null : (uploadStatus === 'complete' ? 1 : (progress || 0) / 100)}
            phase={view === 'form' ? 'idle' : uploadStatus}
          />
        </>
      )}

      <Navbar
        user={user}
        onOpenAuth={handleOpenAuth}
        onOpenProfile={() => setIsProfileOpen(true)}
        activeTab={activeNavTab}
        setActiveTab={setActiveNavTab}
        onOpenMyUploads={() => setIsMyUploadsOpen(true)}
      />

      {activeNavTab === 'dashboard' ? (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 relative z-10">
          <DashboardView user={user} onStartTransfer={() => setActiveNavTab('transfer')} />
        </div>
      ) : (
        <>
          <section
            data-chapter="hero"
            className={chapterClass(
              'hero',
              `relative -mt-16 min-h-[100svh] w-full px-4 sm:px-6 pt-36 pb-16 z-10 overflow-hidden text-white${view === 'progress' ? ' hero-sending' : ''}`,
            )}
          >
            <div className="hidden lg:block absolute right-0 xl:right-[1%] bottom-0 z-[2] w-[420px] xl:w-[500px]">
              <FlagBearer countryCode={clientGeo.countryCode} countryName={clientGeo.countryName} />
            </div>
            <div className="relative z-10 mx-auto w-full max-w-lg text-center">
              <div className="mb-5">
                {(() => {
                  const story = SEND_STORY[mainMode] || SEND_STORY.link;
                  let title = story.title;
                  let line = story.line;
                  if (view === 'progress') {
                    title = 'Your file is leaving.';
                    line = 'Stay on this page until the link is ready.';
                  } else if (view === 'complete') {
                    title = 'The link is ready.';
                    line = 'Send it. It closes when the time you chose runs out.';
                  } else if (files.length > 0 && mainMode === 'email') {
                    title = 'Add who should get it.';
                    line = 'We mail the link. The file never sits in their inbox.';
                  } else if (files.length > 0 && mainMode === 'link') {
                    title = 'One step from a link.';
                    line = 'Name it if you want. A password can gate the download.';
                  }
                  return (
                    <>
                      <p className="text-[11px] uppercase tracking-[0.22em] text-white/80 mb-3">
                        {clientGeo.detected && clientGeo.countryName
                          ? `${clientGeo.flag} You're in ${clientGeo.countryName}`
                          : 'Your location isn’t shown'}
                      </p>
                      <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-white leading-[1.05] mb-3">
                        {title}
                      </h1>
                      <p className="text-sm sm:text-base text-white/85 mb-4 max-w-md mx-auto">
                        {line}
                      </p>
                      {files.length === 0 && view === 'form' && (
                        <ol className="story-steps">
                          {story.steps.map((step, index) => (
                            <li key={step} className="story-step">
                              <i>{index + 1}</i>
                              {step}
                            </li>
                          ))}
                        </ol>
                      )}
                    </>
                  );
                })()}

                <div className="noir-segment inline-flex gap-1 mb-5">
                  {[
                    { id: 'link', label: 'Link', icon: Link2 },
                    { id: 'email', label: 'Email', icon: Mail },
                    { id: 'device', label: 'Device', icon: Wifi },
                  ].map((m) => {
                    const Icon = m.icon;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setMainMode(m.id);
                          if (m.id !== 'device') setView('form');
                        }}
                        className={`noir-segment-item px-3.5 sm:px-4 py-2 flex items-center gap-1.5 cursor-pointer ${
                          mainMode === m.id ? 'active' : ''
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {m.label}
                      </button>
                    );
                  })}
                  <Link
                    to="/receive"
                    className="noir-segment-item px-3.5 sm:px-4 py-2 flex items-center gap-1.5 hover:text-white"
                  >
                    <Inbox className="w-3.5 h-3.5" />
                    Request
                  </Link>
                </div>
              </div>

              {files.length === 0 && view === 'form' && (
                <p className="story-bubble">
                  {(SEND_STORY[mainMode] || SEND_STORY.link).bubble}
                </p>
              )}
              {files.length > 0 && view === 'form' && mainMode !== 'device' && (
                <p className="story-bubble">
                  {mainMode === 'email'
                    ? 'Add their email. We send the link, not the file.'
                    : 'Name it if you want, then create the link.'}
                </p>
              )}

              <div className="w-full">
                {mainMode === 'device' ? (
                  <div className="custom-card p-5 sm:p-7 w-full max-w-lg">
                    <P2PTransferView initialRoom={searchParams.get('room') || undefined} />
                  </div>
                ) : (
                  <>
                    {view === 'form' && files.length === 0 && (
                      <DropZone onFilesSelected={handleFilesSelected} variant="card" />
                    )}

                    {view === 'form' && files.length > 0 && (
                      <div className="custom-card p-5 sm:p-7 w-full max-w-lg animate-scale-in">
                        {mainMode === 'email' && (
                          <div className="mb-4 p-3.5 bg-white/5 border border-white/10 rounded-2xl space-y-2.5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              <div>
                                <label className="block text-[11px] font-semibold text-white/55 uppercase tracking-wider mb-1">
                                  Recipient <span className="text-[#c47a7a]">*</span>
                                </label>
                                <input
                                  type="email"
                                  value={recipientEmails}
                                  onChange={(e) => setRecipientEmails(e.target.value)}
                                  placeholder="colleague@company.com"
                                  className="noir-input w-full px-3 py-2 text-xs font-medium"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold text-white/55 uppercase tracking-wider mb-1">
                                  Your email
                                </label>
                                <input
                                  type="email"
                                  value={senderEmail}
                                  onChange={(e) => setSenderEmail(e.target.value)}
                                  placeholder="you@company.com"
                                  className="noir-input w-full px-3 py-2 text-xs font-medium"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        <FileList
                          files={files}
                          onRemoveFile={handleRemoveFile}
                          onAddMore={handleFilesSelected}
                          maxSizeBytes={maxSizeBytes}
                          maxSizeLabel="6 GB"
                        />

                        <div className="space-y-1.5 pt-3">
                          <label className="text-[11px] font-semibold text-white/55 uppercase tracking-wider">
                            Title
                          </label>
                          <input
                            type="text"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="e.g. Brand assets"
                            className="noir-input w-full px-3.5 py-2.5 text-xs font-medium"
                          />
                          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/8 border border-white/15 rounded-xl text-[11px] font-medium text-white">
                            <Link2 className="w-3.5 h-3.5 shrink-0" />
                            <span className="font-mono truncate">/d/{formatLiveSlugPreview(subject)}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setShowAdvancedOptions((v) => !v)}
                          className="mt-4 w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-white/10 text-xs font-semibold text-white/55 hover:text-white hover:bg-white/5 cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <Lock className="w-3.5 h-3.5 text-white" />
                            Options · password, expiry, message
                          </span>
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvancedOptions ? 'rotate-180' : ''}`} />
                        </button>

                        {showAdvancedOptions && (
                          <div className="mt-3 space-y-3 animate-fadeIn">
                            <div className="space-y-2">
                              <label className="text-[11px] font-semibold text-white/55 uppercase tracking-wider flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-white" />
                                Expiration
                              </label>
                              <div className="grid grid-cols-2 gap-2">
                                {EXPIRY_PRESETS.map((preset) => {
                                  const unavailable = preset.hours === 0 || preset.hours > 168;
                                  const isSelected = expiryHours === preset.hours;
                                  return (
                                    <button
                                      key={preset.hours}
                                      type="button"
                                      disabled={unavailable}
                                      onClick={() => {
                                        if (unavailable) return;
                                        setExpiryHours(preset.hours);
                                      }}
                                      className={`p-2.5 rounded-xl border text-left ${
                                        unavailable
                                          ? 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed'
                                          : isSelected
                                            ? 'bg-white text-black border-white cursor-pointer'
                                            : 'bg-white/5 border-white/10 text-white/70 hover:border-white/40 cursor-pointer'
                                      }`}
                                    >
                                      <span className="text-xs font-semibold block">{preset.label}</span>
                                      <span className="text-[10px] opacity-80">{unavailable ? 'Not available yet' : preset.subtitle}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10">
                              <label className="flex items-center justify-between cursor-pointer">
                                <div className="flex items-center gap-2.5">
                                  <Lock className="w-4 h-4 text-white" />
                                  <div>
                                    <p className="text-xs font-semibold text-white">Password protection</p>
                                    <p className="text-[10px] text-white/40">Free on every transfer</p>
                                  </div>
                                </div>
                                <input
                                  type="checkbox"
                                  checked={enablePassword}
                                  onChange={(e) => setEnablePassword(e.target.checked)}
                                  className="w-4 h-4 rounded accent-[#c4a574] cursor-pointer"
                                />
                              </label>
                              {enablePassword && (
                                <div className="mt-3 relative">
                                  <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Unlock passphrase"
                                    className="noir-input w-full pl-3 pr-9 py-2 text-xs font-medium"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-2 text-white/40 cursor-pointer"
                                  >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                  </button>
                                </div>
                              )}
                            </div>

                            <textarea
                              value={message}
                              onChange={(e) => setMessage(e.target.value)}
                              placeholder="Optional message for recipients"
                              rows={2}
                              className="noir-input w-full px-3 py-2 text-xs font-medium resize-none"
                            />
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={handleUploadLinkTransfer}
                          className="w-full mt-4 py-3.5 theme-btn-primary font-semibold text-sm rounded-full flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <span className="truncate">
                            {mainMode === 'email' ? 'Send transfer' : 'Create download link'} · {files.length}{' '}
                            {files.length === 1 ? 'file' : 'files'} ({formatBytes(files.reduce((a, f) => a + f.size, 0))})
                          </span>
                          <ArrowRight className="w-4 h-4 shrink-0" />
                        </button>
                      </div>
                    )}

                    {view === 'progress' && (
                      <div className="w-full max-w-lg send-shell">
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
                      <div className="custom-card p-5 sm:p-7 w-full max-w-lg">
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
              <div className="lg:hidden mt-8 flex justify-center">
                <div className="w-[280px]">
                  <FlagBearer countryCode={clientGeo.countryCode} countryName={clientGeo.countryName} />
                </div>
              </div>
            </div>
          </section>

          <section data-chapter="ways" className="move-stage relative z-10 text-white">
            <div className={chapterClass('ways', 'max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24')}>
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-white/45 mb-3">How it moves</p>
                  <h2 className="text-4xl sm:text-6xl font-semibold tracking-tight leading-[0.95] max-w-xl">Four ways. One link when you need it.</h2>
                </div>
                <p className="text-sm text-white/50 max-w-xs">Pick a path. The file leaves your screen and arrives as a link, a mail, or a direct handoff.</p>
              </div>

              <div className="move-rail">
                <span className="move-beam" aria-hidden="true" />
                {[
                  { n: '01', title: 'Link', body: 'A download link in seconds. Copy it, send it on WhatsApp, or show a QR.', href: '/', Icon: Link2 },
                  { n: '02', title: 'Email', body: 'Past the 25 MB inbox limit. The file stays on the link, not in the mail.', href: '/send-files-by-email', Icon: Mail },
                  { n: '03', title: 'Device', body: 'Phone to laptop on the same network. Nothing is stored.', href: '/?mode=device', Icon: Wifi },
                  { n: '04', title: 'Request', body: 'A portal so a client can send files back to you.', href: '/receive', Icon: Inbox },
                ].map((item, i) => (
                  <Link key={item.n} to={item.href} className="move-card" style={{ animationDelay: `${i * 90}ms` }}>
                    <span className="move-index">{item.n}</span>
                    <span className="move-icon" style={{ animationDelay: `${i * 0.35}s` }}>
                      <item.Icon className="w-5 h-5" />
                    </span>
                    <span className="move-title">{item.title}</span>
                    <span className="move-body">{item.body}</span>
                    <span className="move-go">Open <ArrowRight className="w-3.5 h-3.5" /></span>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          <section data-chapter="security" className="close-band relative z-10 text-white">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
              <div className={chapterClass('security', 'mb-14')}>
                <p className="text-[11px] uppercase tracking-[0.22em] text-white/40 mb-4">Security</p>
                <h2 className="text-4xl sm:text-6xl font-semibold tracking-tight leading-[0.95] max-w-2xl">Locked on the way. Gone when you say.</h2>
                <p className="mt-5 text-sm sm:text-base text-white/55 max-w-xl leading-relaxed">
                  Three things that matter. A password only gates the download — it is not zero-knowledge encryption.
                </p>
                <div className="mt-8 grid sm:grid-cols-3 gap-3">
                  {[
                    ['In transit', 'TLS 1.3 on the way up. AES-256 at rest on Cloudflare R2.'],
                    ['Password gate', 'Optional. Hashed on our side. Blocks the download page until it matches.'],
                    ['Gone on expiry', 'When the link dies, the files are deleted. Executables never upload.'],
                  ].map(([t, d]) => (
                    <div key={t} className="rounded-2xl border border-white/10 bg-[#17192e] px-5 py-5">
                      <p className="text-lg font-semibold tracking-tight">{t}</p>
                      <p className="mt-2 text-[15px] text-white/75 leading-relaxed">{d}</p>
                    </div>
                  ))}
                </div>
                <Link to="/security" className="inline-flex items-center gap-2 mt-6 text-sm font-semibold rounded-full bg-white text-black px-5 py-2.5 hover:bg-white/90">
                  Security details <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              <div data-chapter="arrive" className={chapterClass('arrive')}>
                <div className="flex items-end justify-between gap-4 mb-6">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-white/40 mb-3">Compare</p>
                    <h2 className="text-3xl sm:text-5xl font-semibold tracking-tight">Against the usual options.</h2>
                  </div>
                  <Link to="/compare" className="hidden sm:inline-flex text-sm font-semibold underline underline-offset-4">Full comparison</Link>
                </div>

                <div className="compare-board hidden sm:block">
                  <div className="compare-head">
                    <span />
                    <span className="compare-us">iTransfer</span>
                    <span>WeTransfer</span>
                    <span>SendGB</span>
                  </div>
                  {[
                    ['Free size', '6 GB + device', '2 GB', '5 GB'],
                    ['Password', 'Free', 'Paid', 'Included'],
                    ['Phone to laptop', 'Yes', 'No', 'No'],
                    ['Ads', 'None', 'Full screen', 'Banners'],
                  ].map((row) => (
                    <div key={row[0]} className="compare-row">
                      <span>{row[0]}</span>
                      <span className="compare-us">{row[1]}</span>
                      <span>{row[2]}</span>
                      <span>{row[3]}</span>
                    </div>
                  ))}
                </div>

                <div className="sm:hidden space-y-3">
                  {[
                    ['Free size', '6 GB + device', 'WeTransfer 2 GB · SendGB 5 GB'],
                    ['Password', 'Free', 'WeTransfer paid · SendGB included'],
                    ['Phone to laptop', 'Yes', 'WeTransfer no · SendGB no'],
                    ['Ads', 'None', 'WeTransfer full screen · SendGB banners'],
                  ].map(([label, us, them]) => (
                    <div key={label} className="rounded-2xl border border-white/10 bg-[#17192e] px-4 py-4">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-white/40 mb-2">{label}</p>
                      <p className="text-base font-semibold text-white">iTransfer · {us}</p>
                      <p className="mt-1 text-sm text-white/45">{them}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Link to="/pricing" className="inline-flex rounded-full bg-white text-black text-sm font-semibold px-5 py-3 hover:bg-white/90 transition-colors">
                    See pricing
                  </Link>
                  <Link to="/compare" className="sm:hidden text-sm font-semibold underline underline-offset-4">
                    Full comparison
                  </Link>
                </div>
              </div>
            </div>
          </section>

        </>
      )}

      <div className={chapterClass('arrive', 'relative z-10')}>
        <Footer />
      </div>

      <FloatingUploadDock
        activeUploads={activeBackgroundUploads}
        onStartAnother={handleRunInBackground}
        onDismissUpload={(id) => setActiveBackgroundUploads((prev) => prev.filter((q) => q.id !== id))}
      />

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

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        initialMode={authMode}
        onAuthSuccess={(u) => setUser(u)}
      />

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

      <PaymentModal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        user={user}
        onUpgradeSuccess={(updated) => setUser(updated)}
      />

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

      {isMasterAdmin && (
        <AdminPanelModal
          isOpen={isAdminPanelOpen}
          onClose={() => setIsAdminPanelOpen(false)}
          user={user}
        />
      )}
    </div>
  );
}
