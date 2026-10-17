import { useState, useCallback, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { activeStorageProvider, sanitizeStoragePath } from '../lib/storageProvider';
import { supabase, publicSupabase, applyTheme } from '../lib/supabase';
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
import Footer from '../components/Footer';
import { getStoredUser, persistUserSession, clearUserSession, isUserPro, isAdmin, isUserOnTrial, getUserPlanLimits } from '../lib/authSession';
import { playSuccessChime } from '../lib/sound';
import { detectClientGeo } from '../lib/geo';
import { generateTransferSlug, formatLiveSlugPreview } from '../lib/slug';
import { getOrCreateGuestId, trackGuestTransfer } from '../lib/guestSession';
import { TransferManager } from '../lib/transferManager';
import PersistentTransferManager from '../components/PersistentTransferManager';
import {
  Mail, Link2, Lock, Send, ShieldCheck, Zap, Sparkles,
  CheckCircle2, Crown, Wifi, ArrowRight, Laptop, Smartphone,
  RefreshCw, Eye, EyeOff, HardDrive, Inbox, FolderPlus,
  HelpCircle, ChevronDown, Check, Globe, Layers, BarChart2,
  Code, Key, Clock, Star, Users, ArrowUpRight, Copy, CheckCircle,
  FileCheck, Server, AlertCircle
} from 'lucide-react';

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
    a: 'Yes! You can transfer up to 5 GB per transfer 100% free with no registration, no watermarks, and zero ads. For larger transfers up to 25 GB, extended retention (up to permanent storage), and priority bandwidth, you can upgrade to iTransfer Pro.',
  },
  {
    q: 'How are my files protected from hackers and eavesdropping?',
    a: 'All files are encrypted in-transit via TLS 1.3 and encrypted on disk using AES-256. If you enable password protection, files can only be unlocked with your secret passphrase. In addition, incoming uploads are automatically verified against malware, ransomware, and malicious executables.',
  },
  {
    q: 'How long do transfer download links remain active?',
    a: 'Free guest transfers remain accessible for 7 days (or 1h, 24h, 3d depending on your preference). After expiration, files are cryptographically wiped from our cloud storage. Pro users can choose 14 days, 30 days, or permanent vault storage.',
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
  const [user, setUser] = useState(() => getStoredUser());
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('signin');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(() => getStoredUser()?.user_metadata?.theme || 'indigo');
  const [activeNavTab, setActiveNavTab] = useState('transfer');

  // Mode Selection: 'link' | 'email' | 'device'
  const [mainMode, setMainMode] = useState(searchParams.get('p2p') ? 'device' : 'link');

  // Geolocation
  const [clientGeo, setClientGeo] = useState({ flag: '🇮🇳', countryName: 'India', edgeRegion: 'Mumbai Edge' });

  useEffect(() => {
    detectClientGeo().then(g => { if (g) setClientGeo(g); });
  }, []);

  // Drawer & Upload Queue State
  const [isMyUploadsOpen, setIsMyUploadsOpen] = useState(false);
  const [activeBackgroundUploads, setActiveBackgroundUploads] = useState([]);

  // Form State
  const [files, setFiles] = useState([]);
  const [senderEmail, setSenderEmail] = useState(() => getStoredUser()?.email || '');
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

  const [isPaused] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

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
      document.title = `iTransfer — Free Secure File Transfer up to 25 GB`;
    }
  }, [view, progress, activeBackgroundUploads]);

  // Init Auth listener
  useEffect(() => {
    const cached = getStoredUser();
    if (cached) {
      setUser(cached);
      setSenderEmail(cached.email || '');
      const userTheme = cached.user_metadata?.theme || 'indigo';
      setCurrentTheme(userTheme);
      applyTheme(userTheme);
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const persisted = await persistUserSession(session.user);
        setUser(persisted);
        const userTheme = persisted.user_metadata?.theme || 'indigo';
        setCurrentTheme(userTheme);
        applyTheme(userTheme);
        setSenderEmail(persisted.email || '');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const persisted = await persistUserSession(session.user);
        setUser(persisted);
        setSenderEmail(persisted.email || '');
        const userTheme = persisted.user_metadata?.theme || 'indigo';
        setCurrentTheme(userTheme);
        applyTheme(userTheme);
      } else if (event === 'SIGNED_OUT') {
        try { localStorage.removeItem('itransfer_user_session'); } catch (e) {}
        setUser(null);
        setSenderEmail('');
        setActiveNavTab('transfer');
        setIsProfileOpen(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const isPro = isUserPro(user);
  const isMasterAdmin = isAdmin(user);
  const isOnTrial = isUserOnTrial(user);
  const planLimits = getUserPlanLimits(user);
  const maxSizeBytes = planLimits.maxFileSizeBytes;

  const handleFilesSelected = useCallback((newFiles) => {
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const handleRemoveFile = useCallback((index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleOpenAuth = (mode) => {
    setAuthMode(mode);
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
    if (files.length === 0) return;

    if (mainMode === 'email' && !recipientEmails.trim()) {
      alert('Please enter at least one recipient email address.');
      return;
    }

    if (enablePassword && !password.trim()) {
      alert('Please enter a password for protection, or uncheck "Password Protect".');
      return;
    }

    const totalSize = files.reduce((acc, f) => acc + f.size, 0);
    if (totalSize > maxSizeBytes) {
      if (!isPro) {
        if (confirm(`This transfer is ${formatBytes(totalSize)}, which exceeds the 5 GB Free limit. Would you like to upgrade to Pro for 25 GB transfers?`)) {
          setIsPaymentOpen(true);
        }
        return;
      }
      alert(`Total size exceeds 25 GB limit.`);
      return;
    }

    // 1. Generate Smart Slug from Title / Subject (or fallback random)
    const generatedSlug = generateTransferSlug(subject);
    const guestId = getOrCreateGuestId();
    const isGuest = !user;
    const userDisplayName = user ? (user.user_metadata?.fullName || user.user_metadata?.full_name || user.email?.split('@')[0]) : null;
    const finalTransferName = subject.trim() || `Transfer-${generatedSlug.slice(0, 6).toUpperCase()}`;

    // 2. Instantiate Persistent TransferManager
    const manager = new TransferManager({
      shareId: generatedSlug,
      transferName: finalTransferName,
      expiryHours,
      isGuest,
      guestId,
      userDisplayName,
      concurrency: 3,
      apiBase: '/api/r2',
    });

    setActiveTransferManager(manager);
    manager.addFiles(files);
    setTransferSnapshot(manager.getSnapshot());
    setIsTransferManagerOpen(true);
    setView('progress');
    setUploadStatus('uploading');

    // Subscribe to state changes
    manager.on('stateChanged', (snap) => {
      setTransferSnapshot(snap);
      setProgress(snap.overallProgress);
      setUploadSpeed(snap.speedStr);
      setTimeRemaining(snap.timeRemainingStr);
    });

    manager.on('transferComplete', async (snap) => {
      setTransferSnapshot(manager.getSnapshot());
      const completedFiles = snap.files.filter(f => f.status === 'completed');
      if (completedFiles.length === 0) return;

      const expiresAt = expiryHours === 0
        ? new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString()
        : new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString();
      const pwdHash = enablePassword && password.trim() ? password.trim() : null;
      const isValidUUID = (str) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
      const validUserId = (user?.id && isValidUUID(user.id)) ? user.id : null;

      const insertPayloads = completedFiles.map((f) => ({
        share_id: generatedSlug,
        file_name: f.name,
        file_size: f.size,
        file_path: f.fileId || sanitizeStoragePath(`${generatedSlug}/${f.name}`),
        content_type: f.type || 'application/octet-stream',
        subject: finalTransferName,
        message: message || null,
        sender_email: user?.email || `guest:${guestId}`,
        recipient_emails: recipientEmails || null,
        password_hash: pwdHash,
        user_id: validUserId,
        transfer_type: mainMode,
        max_downloads: maxDownloads,
        expires_at: expiresAt,
      }));

      try {
        let { error: insertErr } = await publicSupabase.from('transfers').insert(insertPayloads);
        if (insertErr) {
          const sanitized = insertPayloads.map(p => ({ ...p, user_id: null }));
          await publicSupabase.from('transfers').insert(sanitized);
        }
      } catch (e) {
        console.warn('DB insert catch:', e);
      }

      // Local Cache Backup so download links always work seamlessly
      try {
        localStorage.setItem('itransfer_transfer_' + generatedSlug, JSON.stringify(insertPayloads));
      } catch (e) {}

      if (isGuest) {
        trackGuestTransfer(generatedSlug);
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
              shareId: generatedSlug,
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
        shareId: generatedSlug,
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
      setTransferSnapshot(manager.getSnapshot());
    });

    manager.start();
  };

  const handleCancelUpload = () => {
    if (activeTransferManager) {
      activeTransferManager.cancelAll();
      setActiveTransferManager(null);
    }
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
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-900 selection:bg-indigo-600 selection:text-white">
      {/* Primary Navigation Bar */}
      <Navbar
        user={user}
        onOpenAuth={handleOpenAuth}
        onOpenProfile={() => setIsProfileOpen(true)}
        activeTab={activeNavTab}
        setActiveTab={setActiveNavTab}
        onOpenMyUploads={() => setIsMyUploadsOpen(true)}
      />

      {/* Dashboard View Toggle */}
      {activeNavTab === 'dashboard' ? (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
          <DashboardView user={user} onStartTransfer={() => setActiveNavTab('transfer')} />
        </div>
      ) : (
        <>
          {/* =========================================================================
              1. HERO SECTION (MODERN, CLEAN, PROFESSIONAL SAAS AESTHETIC)
              ========================================================================= */}
          <section className="relative w-full bg-[#0A0E1A] text-white pt-8 sm:pt-14 pb-16 sm:pb-24 px-4 sm:px-6 overflow-hidden">
            {/* Subtle Ambient Radial Backlight */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] sm:w-[900px] h-[350px] sm:h-[450px] bg-gradient-to-b from-indigo-500/15 via-indigo-600/5 to-transparent rounded-full blur-3xl pointer-events-none" />

            {/* Subtle Dot Grid Background Pattern */}
            <div
              className="absolute inset-0 opacity-[0.14] pointer-events-none"
              style={{
                backgroundImage: 'radial-gradient(#94A3B8 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}
            />

            {/* Content Container */}
            <div className="relative z-10 max-w-4xl mx-auto text-center">
              
              {/* Trust & Node Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-white text-[11px] font-semibold backdrop-blur-md mb-5 shadow-sm">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                </span>
                <span className="text-white/90">Cloudflare Global Edge</span>
                <span className="text-white/30">•</span>
                <span className="text-white/70">Zero Egress Fees</span>
                <span className="text-white/30">•</span>
                <span className="text-emerald-400 font-bold">100% Free up to 5 GB</span>
              </div>

              {/* Confident Headline */}
              <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight text-white leading-tight sm:leading-tight mb-3">
                Send large files with zero compression
              </h1>

              {/* Reassuring Subtitle */}
              <p className="text-xs sm:text-base text-slate-300 font-normal max-w-xl mx-auto leading-relaxed mb-6">
                Direct browser-to-edge cloud streaming with TLS 1.3 encryption. Upload videos, archives, and project files without registration.
              </p>

              {/* Mode Switcher Segmented Control */}
              <div className="inline-flex p-1 bg-white/10 backdrop-blur-md rounded-2xl border border-white/15 shadow-xl gap-1 mb-6">
                <button
                  type="button"
                  onClick={() => { setMainMode('link'); setView('form'); }}
                  className={`px-3.5 sm:px-4 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                    mainMode === 'link'
                      ? 'bg-white text-slate-950 shadow-md scale-[1.02]'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Link2 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Share Link</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setMainMode('email'); setView('form'); }}
                  className={`px-3.5 sm:px-4 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                    mainMode === 'email'
                      ? 'bg-white text-slate-950 shadow-md scale-[1.02]'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5 text-purple-600" />
                  <span>Email Send</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMainMode('device')}
                  className={`px-3.5 sm:px-4 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                    mainMode === 'device'
                      ? 'bg-white text-slate-950 shadow-md scale-[1.02]'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Wifi className="w-3.5 h-3.5 text-teal-600" />
                  <span>Device P2P</span>
                </button>

                <Link
                  to="/receive"
                  className="px-3.5 sm:px-4 py-1.5 rounded-xl font-bold text-xs text-white/80 hover:text-white hover:bg-white/10 transition-all flex items-center gap-1.5"
                >
                  <Inbox className="w-3.5 h-3.5 text-rose-300" />
                  <span>Request</span>
                </Link>
              </div>

              {/* Central Transfer Card Console */}
              <div className="max-w-lg mx-auto w-full text-left">
                {mainMode === 'device' ? (
                  <div className="bg-white rounded-3xl p-5 sm:p-7 text-slate-900 shadow-2xl border border-slate-200/90">
                    <P2PTransferView />
                  </div>
                ) : (
                  <>
                    {view === 'form' && files.length === 0 && (
                      <DropZone onFilesSelected={handleFilesSelected} maxSizeBytes={maxSizeBytes} />
                    )}

                    {view === 'form' && files.length > 0 && (
                      <div className="bg-white rounded-3xl p-5 sm:p-7 text-slate-900 shadow-2xl border border-slate-200/90 animate-scale-in">
                        {/* Email Fields (when email mode selected) */}
                        {mainMode === 'email' && (
                          <div className="mb-4 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                                  Recipient Email <span className="text-rose-500">*</span>
                                </label>
                                <input
                                  type="email"
                                  required
                                  value={recipientEmails}
                                  onChange={(e) => setRecipientEmails(e.target.value)}
                                  placeholder="colleague@company.com"
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                                  Your Email
                                </label>
                                <input
                                  type="email"
                                  value={senderEmail}
                                  onChange={(e) => setSenderEmail(e.target.value)}
                                  placeholder="you@company.com"
                                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* File List Component */}
                        <FileList
                          files={files}
                          onRemoveFile={handleRemoveFile}
                          onAddMore={handleFilesSelected}
                          maxSizeBytes={maxSizeBytes}
                        />

                        {/* Transfer Title / Project Name */}
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                              <span>Project Title</span>
                            </label>
                            <span className="text-[10px] text-slate-400 font-semibold">Custom Link Preview</span>
                          </div>
                          <input
                            type="text"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="e.g. Q4 Brand Assets Final"
                            className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-indigo-600 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none transition-all"
                          />
                          {/* Live Link Badge */}
                          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50/70 border border-indigo-100 rounded-xl text-[11px] font-medium text-indigo-950">
                            <Link2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span className="text-slate-500 font-semibold truncate">Link:</span>
                            <span className="font-mono font-bold text-indigo-700 truncate">itransfer.iprudhvi.in/d/{formatLiveSlugPreview(subject)}</span>
                          </div>
                        </div>

                        {/* Expiration Options */}
                        <div className="space-y-2 pt-3">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Transfer Expiration</span>
                            </label>
                            <span className="text-[10px] text-slate-400 font-semibold">Auto-wipes from storage</span>
                          </div>

                          <div className="grid grid-cols-2 xs:grid-cols-4 gap-2">
                            {EXPIRY_PRESETS.map((preset) => {
                              const isSelected = expiryHours === preset.hours;
                              return (
                                <button
                                  key={preset.hours}
                                  type="button"
                                  onClick={() => {
                                    if (preset.pro && !isPro) {
                                      setIsPaymentOpen(true);
                                      return;
                                    }
                                    if (preset.trial && !isPro && !isOnTrial) {
                                      setIsPaymentOpen(true);
                                      return;
                                    }
                                    setExpiryHours(preset.hours);
                                  }}
                                  className={`p-2.5 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer ${
                                    isSelected
                                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-1 w-full mb-0.5">
                                    <span className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                                      {preset.label}
                                    </span>
                                    {((preset.pro && !isPro) || (preset.trial && !isPro && !isOnTrial)) && (
                                      <Crown className="w-3 h-3 text-amber-500 shrink-0" />
                                    )}
                                  </div>
                                  <span className={`text-[10px] font-medium truncate ${isSelected ? 'text-indigo-100' : 'text-slate-500'}`}>
                                    {preset.subtitle}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Password Protection Card */}
                        <div className="mt-3.5 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 transition-all">
                          <label className="flex items-center justify-between cursor-pointer select-none">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 shadow-2xs">
                                <Lock className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-900">Password Protection</p>
                                <p className="text-[10px] text-slate-500 font-medium">Require secret passphrase to unlock</p>
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              checked={enablePassword}
                              onChange={(e) => setEnablePassword(e.target.checked)}
                              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                          </label>
                          {enablePassword && (
                            <div className="mt-3 pt-3 border-t border-slate-200 relative animate-fadeIn">
                              <input
                                type={showPassword ? 'text' : 'password'}
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter unlock passphrase"
                                className="w-full pl-3 pr-9 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-indigo-600"
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-5 text-slate-400 hover:text-slate-600 cursor-pointer"
                              >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Submit Action Button */}
                        <button
                          type="button"
                          onClick={handleUploadLinkTransfer}
                          className="w-full mt-4 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer"
                        >
                          <span className="truncate">
                            {mainMode === 'email' ? 'Send Transfer' : 'Create Download Link'} • {files.length} {files.length === 1 ? 'file' : 'files'} ({formatBytes(files.reduce((a, f) => a + f.size, 0))})
                          </span>
                          <ArrowRight className="w-4 h-4 shrink-0" />
                        </button>
                      </div>
                    )}

                    {view === 'progress' && (
                      <div className="bg-white rounded-3xl p-5 sm:p-7 text-slate-900 shadow-2xl border border-slate-200/90">
                        <UploadProgress
                          progress={progress}
                          fileName={currentFileName}
                          uploadSpeed={uploadSpeed}
                          timeRemaining={timeRemaining}
                          status={uploadStatus}
                          isPaused={isPaused}
                          isOffline={isOffline}
                          telemetry={telemetry}
                          onRunInBackground={handleRunInBackground}
                          onCancel={handleCancelUpload}
                        />
                      </div>
                    )}

                    {view === 'complete' && shareData && (
                      <div className="bg-white rounded-3xl p-5 sm:p-7 text-slate-900 shadow-2xl border border-slate-200/90">
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
          </section>

          {/* =========================================================================
              2. TRUST & INFRASTRUCTURE STATS BAR
              ========================================================================= */}
          <section className="bg-white border-b border-slate-200/80 py-6 px-4 sm:px-6">
            <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 text-center">
              <div className="p-3">
                <p className="text-xl sm:text-2xl font-black text-slate-900">5 GB Free</p>
                <p className="text-xs text-slate-500 font-medium mt-0.5">No signup required</p>
              </div>
              <div className="p-3">
                <p className="text-xl sm:text-2xl font-black text-indigo-600">300+ Cities</p>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Cloudflare Anycast edge</p>
              </div>
              <div className="p-3">
                <p className="text-xl sm:text-2xl font-black text-emerald-600">TLS 1.3 + AES</p>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Encrypted at rest & in transit</p>
              </div>
              <div className="p-3">
                <p className="text-xl sm:text-2xl font-black text-slate-900">Auto-Purged</p>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Zero permanent logging</p>
              </div>
            </div>
          </section>

          {/* =========================================================================
              3. ARCHITECTURAL PILLARS OF TRUST
              ========================================================================= */}
          <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
            <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16 space-y-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full">
                <ShieldCheck className="w-3.5 h-3.5" />
                Enterprise Security & Privacy
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
                Engineered for speed, built for privacy
              </h2>
              <p className="text-sm text-slate-500 font-medium leading-relaxed">
                Unlike ad-supported transfer tools that throttle bandwidth and harvest data, iTransfer is designed around zero-knowledge principles and direct edge streaming.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
                  <Server className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1.5">Direct Edge Streaming</h3>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  Uploads stream directly to Cloudflare R2 object storage with zero egress fees and zero intermediary server bottlenecks.
                </p>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4">
                  <Lock className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1.5">Passphrase Protection</h3>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  Protect confidential archives with client-side passwords. Only recipients with the passphrase can decrypt download tokens.
                </p>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
                  <Clock className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1.5">Cryptographic Shredding</h3>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  Transfers are strictly ephemeral. Once the 7 or 30 day expiration window ends, files are permanently deleted.
                </p>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1.5">Anti-Malware Shield</h3>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  Incoming payloads are automatically screened to block dangerous executables and malware, safeguarding your recipients.
                </p>
              </div>
            </div>
          </section>

          {/* =========================================================================
              4. HONEST COMPARISON MATRIX
              ========================================================================= */}
          <section className="bg-slate-100/60 border-y border-slate-200/80 py-16 sm:py-24">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center max-w-xl mx-auto mb-10 sm:mb-14 space-y-2">
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  Why professionals choose iTransfer
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 font-medium">
                  Compare our transparent free tier with legacy transfer alternatives.
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="py-3.5 px-4 sm:px-6 font-bold text-slate-900">Feature</th>
                        <th className="py-3.5 px-4 font-bold text-indigo-600 bg-indigo-50/50">iTransfer</th>
                        <th className="py-3.5 px-4 font-medium text-slate-600">WeTransfer</th>
                        <th className="py-3.5 px-4 font-medium text-slate-600">SendGB</th>
                        <th className="py-3.5 px-4 font-medium text-slate-600">Google Drive</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="py-3 px-4 sm:px-6 font-semibold text-slate-900">Free File Size Limit</td>
                        <td className="py-3 px-4 font-bold text-indigo-600 bg-indigo-50/30">5 GB</td>
                        <td className="py-3 px-4 text-slate-600">2 GB</td>
                        <td className="py-3 px-4 text-slate-600">5 GB</td>
                        <td className="py-3 px-4 text-slate-600">Uses 15 GB account storage</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 sm:px-6 font-semibold text-slate-900">Sign-Up Required?</td>
                        <td className="py-3 px-4 font-bold text-emerald-600 bg-indigo-50/30">No (Instant Guest)</td>
                        <td className="py-3 px-4 text-slate-600">No (with nags)</td>
                        <td className="py-3 px-4 text-slate-600">No</td>
                        <td className="py-3 px-4 text-rose-600 font-medium">Yes (Google Account)</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 sm:px-6 font-semibold text-slate-900">Password Protection</td>
                        <td className="py-3 px-4 font-bold text-emerald-600 bg-indigo-50/30">Included Free</td>
                        <td className="py-3 px-4 text-rose-500">Paid ($12/mo)</td>
                        <td className="py-3 px-4 text-slate-600">Included</td>
                        <td className="py-3 px-4 text-slate-500">Not supported natively</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 sm:px-6 font-semibold text-slate-900">Third-Party Ads</td>
                        <td className="py-3 px-4 font-bold text-emerald-600 bg-indigo-50/30">Zero Ads</td>
                        <td className="py-3 px-4 text-slate-600">Full-screen ads</td>
                        <td className="py-3 px-4 text-slate-600">Banner ads</td>
                        <td className="py-3 px-4 text-slate-600">Workspace upsells</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 sm:px-6 font-semibold text-slate-900">Infrastructure</td>
                        <td className="py-3 px-4 font-bold text-indigo-600 bg-indigo-50/30">Cloudflare Global Edge</td>
                        <td className="py-3 px-4 text-slate-600">AWS Standard</td>
                        <td className="py-3 px-4 text-slate-600">Standard Hosting</td>
                        <td className="py-3 px-4 text-slate-600">Google Cloud</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>

          {/* =========================================================================
              5. FAQ ACCORDION SECTION
              ========================================================================= */}
          <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 w-full">
            <div className="text-center max-w-xl mx-auto mb-10 space-y-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full">
                <HelpCircle className="w-3.5 h-3.5" />
                Frequently Asked Questions
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Questions? We have answers.
              </h2>
            </div>

            <div className="space-y-3">
              {FAQS.map((faq, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div
                    key={idx}
                    className={`bg-white rounded-2xl overflow-hidden transition-all duration-200 border ${
                      isOpen ? 'border-indigo-300 shadow-md shadow-indigo-500/5' : 'border-slate-200/80 hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : idx)}
                      className="w-full p-4 sm:p-5 flex items-center justify-between text-left font-bold text-xs sm:text-sm text-slate-900 hover:text-indigo-600 transition-colors gap-3 cursor-pointer"
                    >
                      <span>{faq.q}</span>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-transform ${
                        isOpen ? 'bg-indigo-50 text-indigo-600 rotate-180' : 'bg-slate-100 text-slate-400'
                      }`}>
                        <ChevronDown className="w-3.5 h-3.5" />
                      </div>
                    </button>

                    {isOpen && (
                      <div className="px-4 sm:px-5 pb-5 text-xs sm:text-sm text-slate-600 font-normal leading-relaxed border-t border-slate-100 pt-3 animate-fadeIn">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      {/* Floating Upload Dock for Multitasking */}
      <FloatingUploadDock
        activeUploads={activeBackgroundUploads}
        onStartAnother={handleRunInBackground}
        onDismissUpload={(id) => setActiveBackgroundUploads(prev => prev.filter(q => q.id !== id))}
      />

      {/* Slide-over My Uploads Explorer Drawer */}
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

      <Footer />

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
        onOpenUpgrade={() => setIsPaymentOpen(true)}
        onOpenAdmin={() => setIsAdminPanelOpen(true)}
      />

      <PaymentModal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        user={user}
        onUpgradeSuccess={(updated) => setUser(updated)}
      />

      {/* Persistent Transfer Manager Modal Overlay */}
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
