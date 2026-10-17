import { useState, useCallback, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { activeStorageProvider, sanitizeStoragePath, uploadMultipleFilesConcurrently } from '../lib/storageProvider';
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
import CloudTransferAnimation from '../components/CloudTransferAnimation';
import Footer from '../components/Footer';
import { getStoredUser, persistUserSession, clearUserSession, isUserPro, isAdmin, isUserOnTrial, startProTrial, getUserPlanLimits } from '../lib/authSession';
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
  Code, Key, Clock, Star, Users, ArrowUpRight, Copy
} from 'lucide-react';

function generateShareId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatTime(seconds) {
  if (!seconds || seconds === Infinity || isNaN(seconds)) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

const SLOGANS = [
  { action: 'Transfer files up to 25 GB', highlight: 'at gigabit speeds.' },
  { action: 'Send high-res 4K videos', highlight: 'with zero compression.' },
  { action: 'Share complete project files', highlight: 'in one simple click.' },
  { action: 'Deliver private archives', highlight: 'with zero friction.' },
];

const FAQS = [
  {
    q: 'How to send and share large files with iTransfer?',
    a: '1. Select your files or folders by clicking the Start button or dragging them onto the interface. 2. Choose whether to generate a sharing link or send directly via email. 3. Click Transfer to start high-speed encrypted streaming.',
  },
  {
    q: 'What is the maximum file size I can send?',
    a: 'You can send up to 5 GB per transfer completely free with no registration required. Upgrading to iTransfer Pro unlocks 25 GB transfers, priority bandwidth, and permanent storage.',
  },
  {
    q: 'Are my files safe and encrypted?',
    a: 'Yes. All file transfers use TLS 1.3 in transit and are encrypted on disk at rest using AES-256 bits. If you add a password, only recipients with your passphrase can unlock and decrypt the files.',
  },
  {
    q: 'How long do files remain available for download?',
    a: 'Free transfers remain active for 7 days before being automatically purged. With an iTransfer Pro account, files can remain downloadable for 30 days, 1 year, or permanently (Never Expire).',
  },
  {
    q: 'Can I upload full directory folders with subfolders?',
    a: 'Yes! Click the "Add Folder" button to select any directory. iTransfer preserves the full folder hierarchy for your recipients.',
  },
  {
    q: 'How does Direct Device P2P work?',
    a: 'Device P2P streams files directly between your devices (e.g. phone to laptop) over local Wi-Fi and WebRTC with zero cloud server storage required.',
  },
];

const EXPIRY_PRESETS = [
  { hours: 1, label: '1 Hour', subtitle: 'Flash share', badge: '⚡ Flash' },
  { hours: 24, label: '24 Hours', subtitle: '1 Day access', badge: '1 Day' },
  { hours: 72, label: '3 Days', subtitle: 'Quick team', badge: '3 Days' },
  { hours: 168, label: '7 Days', subtitle: 'Standard Free', badge: '7 Days (Free)' },
  { hours: 336, label: '14 Days', subtitle: 'Extended', badge: '14d • Trial/Pro', trial: true },
  { hours: 720, label: '30 Days', subtitle: '1 Month', badge: '30d • Pro', pro: true },
  { hours: 0, label: 'Permanent', subtitle: 'Never expire', badge: '♾️ Pro Vault', pro: true },
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

  // Animated Slogan Cycling State
  const [sloganIndex, setSloganIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSloganIndex(prev => (prev + 1) % SLOGANS.length);
    }, 3400);
    return () => clearInterval(timer);
  }, []);

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
  const [uploadStatus, setUploadStatus] = useState('uploading');
  const [shareData, setShareData] = useState(null);
  const [telemetry, setTelemetry] = useState(null);

  // FAQ State
  const [openFaq, setOpenFaq] = useState(null);

  // Network State
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
      document.title = `iTransfer — Free Secure File Transfer`;
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
      concurrency: 2,
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
    setUploadStatus('idle');
    setProgress(0);
    setUploadSpeed('-- MB/s');
    setTimeRemaining('--:--');
    showToast('Transfer cancelled. You can edit your files and settings.', 'info');
  };

  const handleReset = () => {
    setFiles([]);
    setSubject('');
    setMessage('');
    setPassword('');
    setEnablePassword(false);
    setRecipientEmails('');
    setMaxDownloads(0);
    setView('form');
    setShareData(null);
    setUploadStatus('uploading');
    setProgress(0);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-indigo-500 selection:text-white">

      <Navbar
        user={user}
        onOpenAuth={handleOpenAuth}
        onOpenProfile={() => setIsProfileOpen(true)}
        onOpenMyUploads={() => setIsMyUploadsOpen(true)}
        activeTab={activeNavTab}
        setActiveTab={setActiveNavTab}
      />

      {activeNavTab === 'dashboard' ? (
        <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 w-full">
          <DashboardView user={user} />
        </main>
      ) : (
        <>
          {/* =========================================================================
          {/* =========================================================================
              1. 3D IMMERSIVE CLOUDSCAPE HERO WORLD (10X PREMIUM DESIGN)
              ========================================================================= */}
          <div className="relative w-full bg-[#0f1f5e] overflow-hidden pt-6 sm:pt-10 pb-14 sm:pb-20 px-3 sm:px-6 text-white min-h-[520px] sm:min-h-[620px] flex flex-col justify-center items-center">
            
            {/* Premium Multi-Layer Gradient Background */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a1744] via-[#152b8a] to-[#1d3cc4] pointer-events-none" />
            
            {/* Crisp High-Definition 3D Cloudscape Background Layer */}
            <div
              className="absolute inset-0 bg-cover bg-[center_25%] sm:bg-center bg-no-repeat opacity-85 pointer-events-none"
              style={{
                backgroundImage: `url('/images/hero_3d_cloudscape.jpg')`,
                maskImage: 'linear-gradient(to top, rgba(0,0,0,1) 60%, rgba(0,0,0,0.15) 100%)',
                WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,1) 60%, rgba(0,0,0,0.15) 100%)',
              }}
            />

            {/* Animated Ambient Light Beams */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="absolute -top-20 left-1/4 w-[500px] h-[600px] bg-gradient-to-b from-indigo-400/8 via-transparent to-transparent rotate-12 blur-2xl" style={{ animation: 'floatOrb1 20s ease-in-out infinite' }} />
              <div className="absolute -top-20 right-1/4 w-[400px] h-[500px] bg-gradient-to-b from-purple-400/6 via-transparent to-transparent -rotate-12 blur-2xl" style={{ animation: 'floatOrb2 24s ease-in-out infinite' }} />
            </div>

            {/* Dynamic Animated Traveling Laser Pulses across 3D Buildings */}
            <CloudTransferAnimation />

            {/* Billowing Cloud Shimmer Bottom Glow */}
            <div className="absolute -bottom-10 left-0 right-0 h-32 sm:h-40 bg-gradient-to-t from-slate-50 via-slate-50/90 to-transparent pointer-events-none z-10" />

            {/* High-Contrast Interactive Hero Headline */}
            <div className="relative z-20 text-center max-w-2xl mx-auto mb-4 sm:mb-5 px-3">
              
              {/* Premium Feature Pill Badge with Shimmer */}
              <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/10 border border-white/15 text-white text-[10px] sm:text-xs font-semibold backdrop-blur-xl mb-4 shadow-lg shadow-indigo-500/10 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                <Zap className="w-3 h-3 text-amber-300 fill-amber-300/30" />
                <span>TurboBandwidth™ Gigabit Engine</span>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                </span>
                <span className="hidden xs:inline text-white/80">Up to 25 GB</span>
              </div>

              {/* Kinetic Headline Box with FIXED HEIGHT to guarantee ZERO layout shifts */}
              <div className="h-[56px] sm:h-[72px] md:h-[80px] flex flex-col items-center justify-center">
                <h1
                  key={sloganIndex}
                  className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] animate-text-glide leading-tight sm:leading-snug font-sans"
                >
                  <span>{SLOGANS[sloganIndex].action}</span>{' '}
                  <br className="hidden sm:inline" />
                  <span className="bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-300 bg-clip-text text-transparent drop-shadow-sm">
                    {SLOGANS[sloganIndex].highlight}
                  </span>
                </h1>
              </div>

              {/* Subtitle */}
              <p className="text-xs sm:text-sm text-white/90 drop-shadow-[0_1px_4px_rgba(0,0,0,0.4)] font-medium max-w-md mx-auto tracking-normal leading-relaxed mt-2">
                Fast, end-to-end encrypted file delivery. No compression. Zero friction.
              </p>

              {/* Inline Trust Signals Bar */}
              <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5 mt-4 text-[10px] sm:text-[11px] font-bold text-white/70 tracking-wide">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  AES-256 Encrypted
                </span>
                <span className="w-px h-3 bg-white/20 hidden sm:block" />
                <span className="flex items-center gap-1">
                  <Globe className="w-3 h-3 text-sky-400" />
                  Global CDN
                </span>
                <span className="w-px h-3 bg-white/20 hidden sm:block" />
                <span className="flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-400" />
                  Zero Compression
                </span>
              </div>
            </div>

            {/* Mode Switcher Segmented Control (InstantDomainSearch Precision Pill Style) */}
            <div className="relative z-20 max-w-full overflow-x-auto no-scrollbar px-2 mb-4 sm:mb-5">
              <div className="inline-flex p-1 bg-white/15 backdrop-blur-xl rounded-2xl border border-white/25 shadow-xl gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => { setMainMode('link'); setView('form'); }}
                  className={`px-3 sm:px-4 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                    mainMode === 'link'
                      ? 'bg-white text-slate-950 shadow-md scale-[1.02]'
                      : 'text-white/90 hover:text-white hover:bg-white/15'
                  }`}
                >
                  <Link2 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Share Link</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setMainMode('email'); setView('form'); }}
                  className={`px-3 sm:px-4 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                    mainMode === 'email'
                      ? 'bg-white text-slate-950 shadow-md scale-[1.02]'
                      : 'text-white/90 hover:text-white hover:bg-white/15'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5 text-purple-600" />
                  <span>Email Send</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMainMode('device')}
                  className={`px-3 sm:px-4 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                    mainMode === 'device'
                      ? 'bg-white text-slate-950 shadow-md scale-[1.02]'
                      : 'text-white/90 hover:text-white hover:bg-white/15'
                  }`}
                >
                  <Wifi className="w-3.5 h-3.5 text-teal-600" />
                  <span>Device P2P</span>
                </button>

                <Link
                  to="/receive"
                  className="px-3 sm:px-4 py-1.5 rounded-xl font-bold text-xs text-white/90 hover:text-white hover:bg-white/15 transition-all flex items-center gap-1.5"
                >
                  <Inbox className="w-3.5 h-3.5 text-rose-300" />
                  <span>Request</span>
                </Link>
              </div>
            </div>

            {/* Central Uploader Core (DropZone or Selected Files Card) */}
            <div className="relative z-20 max-w-lg mx-auto w-full px-2 sm:px-0">
              
              {/* Direct Device P2P Transfer View */}
              {mainMode === 'device' && (
                <div className="custom-card p-5 sm:p-6 bg-white text-slate-900 shadow-2xl">
                  <P2PTransferView />
                </div>
              )}

              {/* Cloud Upload Flow */}
              {mainMode !== 'device' && (
                <>
                  {view === 'form' && files.length === 0 && (
                    <DropZone onFilesSelected={handleFilesSelected} maxSizeBytes={maxSizeBytes} />
                  )}

                  {view === 'form' && files.length > 0 && (
                    <div className="custom-card p-4 sm:p-7 bg-white text-slate-900 shadow-2xl animate-scale-in">
                      
                      {/* Email Recipient Input (when email mode active) */}
                      {mainMode === 'email' && (
                        <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
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
                                placeholder="client@company.com"
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:border-indigo-500"
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
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      <FileList
                        files={files}
                        onRemoveFile={handleRemoveFile}
                        onAddMore={handleFilesSelected}
                      />

                      {/* 10x Redesigned Transfer Title / Subject Input with Live Slug Preview */}
                      <div className="space-y-1.5 pt-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Transfer Title / Project Name</span>
                          </label>
                          <span className="text-[10px] text-slate-400 font-semibold">Auto-hyphenated URL link</span>
                        </div>
                        <input
                          type="text"
                          value={subject}
                          onChange={(e) => setSubject(e.target.value)}
                          placeholder="e.g. Hi Tech Machine"
                          className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-bold text-slate-900 focus:outline-none transition-all shadow-2xs"
                        />
                        {/* Real-Time Live URL Slug Preview Card */}
                        <div className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50/80 border border-indigo-100 rounded-xl text-[11px] font-medium text-indigo-950">
                          <Link2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span className="text-slate-500 font-bold truncate">Live Link:</span>
                          <span className="font-mono font-bold text-indigo-700 truncate">itransfer.iprudhvi.in/d/{formatLiveSlugPreview(subject)}</span>
                        </div>
                      </div>

                      {/* 10x Redesigned Expiration Selector Grid */}
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Transfer Expiration</span>
                          </label>
                          <span className="text-[10px] text-slate-400 font-semibold">Auto-purges after expiry</span>
                        </div>

                        <div className="grid grid-cols-2 xs:grid-cols-3 gap-2">
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
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-500/30'
                                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-1 w-full mb-1">
                                  <span className={`text-xs font-black truncate ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                                    {preset.label}
                                  </span>
                                  {((preset.pro && !isPro) || (preset.trial && !isPro && !isOnTrial)) && (
                                    <Crown className="w-3 h-3 text-amber-500 shrink-0" />
                                  )}
                                </div>
                                <span className={`text-[10px] font-semibold truncate ${isSelected ? 'text-indigo-100' : 'text-slate-500'}`}>
                                  {preset.subtitle}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Redesigned Password Protection Card */}
                      <div className="mt-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 transition-all">
                        <label className="flex items-center justify-between cursor-pointer select-none">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 shadow-2xs">
                              <Lock className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-xs font-black text-slate-900">Password Protection</p>
                              <p className="text-[10px] text-slate-500 font-medium">Require unlock password to download</p>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={enablePassword}
                            onChange={(e) => setEnablePassword(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </label>
                        {enablePassword && (
                          <div className="mt-3 pt-3 border-t border-slate-200 relative animate-fadeIn">
                            <input
                              type={showPassword ? 'text' : 'password'}
                              required
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="Set unlock password (e.g. secret123)"
                              className="w-full pl-3 pr-9 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-5 text-slate-400 hover:text-slate-600"
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Submit Button */}
                      <button
                        onClick={handleUploadLinkTransfer}
                        className="w-full mt-4 py-3.5 bg-[#ff5722] hover:bg-[#f4511e] text-white font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer"
                      >
                        <span className="truncate">
                          {mainMode === 'email' ? 'Send via Email' : 'Transfer & Create Link'} • {files.length} {files.length === 1 ? 'file' : 'files'} ({formatBytes(files.reduce((a, f) => a + f.size, 0))})
                        </span>
                        <ArrowRight className="w-4 h-4 shrink-0" />
                      </button>

                    </div>
                  )}

                  {view === 'progress' && (
                    <div className="custom-card p-5 sm:p-6 bg-white text-slate-900 shadow-2xl">
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
                    <div className="custom-card p-5 sm:p-6 bg-white text-slate-900 shadow-2xl">
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

          {/* =========================================================================
              2. HOW IT WORKS — PREMIUM TIMELINE DESIGN
              ========================================================================= */}
          <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 w-full">
            <div className="text-center max-w-xl mx-auto mb-10 sm:mb-14 space-y-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full">
                <Layers className="w-3 h-3" />
                Simple Process
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
                How to send large files
              </h2>
              <p className="text-sm text-slate-500 font-medium max-w-md mx-auto">
                Three simple steps to share anything, with anyone, anywhere.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-8 relative">
              {/* Connector Line (desktop only) */}
              <div className="hidden sm:block absolute top-[52px] left-[16.67%] right-[16.67%] h-px bg-gradient-to-r from-indigo-200 via-purple-200 to-emerald-200 z-0" />

              <div className="relative group">
                <div className="custom-card p-6 sm:p-7 bg-white hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-center sm:text-left">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white font-black text-lg flex items-center justify-center mb-4 mx-auto sm:mx-0 shadow-lg shadow-indigo-500/25 relative z-10">
                    1
                  </div>
                  <h3 className="text-base font-black text-slate-900 mb-2">Select your files</h3>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    Click <strong className="text-slate-700">Start</strong> to select files, or drag and drop them directly onto the interface.
                  </p>
                </div>
              </div>

              <div className="relative group">
                <div className="custom-card p-6 sm:p-7 bg-white hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-center sm:text-left">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 text-white font-black text-lg flex items-center justify-center mb-4 mx-auto sm:mx-0 shadow-lg shadow-purple-500/25 relative z-10">
                    2
                  </div>
                  <h3 className="text-base font-black text-slate-900 mb-2">Configure transfer</h3>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    Choose link or email delivery. Set expiry, passwords, and custom project slugs.
                  </p>
                </div>
              </div>

              <div className="relative group">
                <div className="custom-card p-6 sm:p-7 bg-white hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-center sm:text-left">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white font-black text-lg flex items-center justify-center mb-4 mx-auto sm:mx-0 shadow-lg shadow-emerald-500/25 relative z-10">
                    3
                  </div>
                  <h3 className="text-base font-black text-slate-900 mb-2">Transfer at gigabit speed</h3>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    Click <strong className="text-slate-700">Transfer</strong> and watch your files stream at maximum speed. 🚀
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* =========================================================================
              3. ENTERPRISE FEATURES — PREMIUM BENTO GRID
              ========================================================================= */}
          <section className="bg-gradient-to-b from-slate-50 via-slate-100/50 to-slate-50 py-16 sm:py-24 border-y border-slate-200/50">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
              
              {/* Header */}
              <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16 space-y-3">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full">
                  <Sparkles className="w-3 h-3" />
                  Enterprise Capability
                </span>
                <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
                  Built for modern teams
                </h2>
                <p className="text-sm text-slate-500 font-medium max-w-lg mx-auto leading-relaxed">
                  Transfer massive archives, 4K footage, and client assets with zero compression and enterprise-grade security.
                </p>
              </div>

              {/* Bento 6-Card Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                
                <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.04)] hover:shadow-2xl hover:border-indigo-200/80 transition-all duration-500 space-y-3 group relative overflow-hidden">
                  <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-indigo-400 to-indigo-600 rounded-l-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-indigo-500/15 transition-all duration-300">
                    <Link2 className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-black text-slate-900">Custom Slugs & Shareable Links</h3>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    Generate beautiful branded download links with custom project titles, optional passwords, and automatic expiration.
                  </p>
                </div>

                <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.04)] hover:shadow-2xl hover:border-purple-200/80 transition-all duration-500 space-y-3 group relative overflow-hidden">
                  <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-purple-400 to-purple-600 rounded-l-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-purple-500/15 transition-all duration-300">
                    <Send className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-black text-slate-900">Direct Email Transfer Engine</h3>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    Bypass standard 25 MB email attachment limits. Automated transfer cards delivered directly to recipient inboxes.
                  </p>
                </div>

                <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.04)] hover:shadow-2xl hover:border-teal-200/80 transition-all duration-500 space-y-3 group relative overflow-hidden">
                  <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-teal-400 to-teal-600 rounded-l-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="w-11 h-11 rounded-2xl bg-teal-50 text-teal-600 border border-teal-100 flex items-center justify-center group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-teal-500/15 transition-all duration-300">
                    <BarChart2 className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-black text-slate-900">Real-Time Transfer Telemetry</h3>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    Track downloads, verify bit-for-bit file integrity, and re-transfer files instantly without re-uploading.
                  </p>
                </div>

                <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.04)] hover:shadow-2xl hover:border-emerald-200/80 transition-all duration-500 space-y-3 group relative overflow-hidden">
                  <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-emerald-400 to-emerald-600 rounded-l-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-emerald-500/15 transition-all duration-300">
                    <Zap className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-black text-slate-900">TurboBandwidth™ Gigabit Pipeline</h3>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    Direct-to-Cloud 0-Hop multi-socket acceleration. Slices and streams files at maximum line speed.
                  </p>
                </div>

                <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.04)] hover:shadow-2xl hover:border-rose-200/80 transition-all duration-500 space-y-3 group relative overflow-hidden">
                  <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-rose-400 to-rose-600 rounded-l-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-rose-500/15 transition-all duration-300">
                    <Inbox className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-black text-slate-900">Client File Request Portals</h3>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    Create secure upload portals. Receive large files from clients without requiring them to create an account.
                  </p>
                </div>

                <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.04)] hover:shadow-2xl hover:border-amber-200/80 transition-all duration-500 space-y-3 group relative overflow-hidden">
                  <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-amber-400 to-amber-600 rounded-l-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-amber-500/15 transition-all duration-300">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-black text-slate-900">AES-256 Vault Encryption</h3>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    TLS 1.3 in-transit and AES-256 on-disk encryption. Optional passphrase hashing for authorized access only.
                  </p>
                </div>

              </div>

              {/* Premium Network Metrics Strip */}
              <div className="mt-12 p-6 sm:p-8 bg-white rounded-3xl border border-slate-200/80 shadow-sm grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                <div className="space-y-1">
                  <p className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">99.99%</p>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Global Uptime</p>
                </div>
                <div className="space-y-1">
                  <p className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-indigo-600 to-indigo-400 bg-clip-text text-transparent">0-Hop</p>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Edge Streaming</p>
                </div>
                <div className="space-y-1">
                  <p className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-emerald-600 to-emerald-400 bg-clip-text text-transparent">256-Bit</p>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Encryption</p>
                </div>
                <div className="space-y-1">
                  <p className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-amber-600 to-amber-400 bg-clip-text text-transparent">25 GB</p>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Max Transfer</p>
                </div>
              </div>

            </div>
          </section>

          {/* =========================================================================
              4. FAQ — PREMIUM ACCORDION
              ========================================================================= */}
          <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 w-full">
            <div className="text-center max-w-xl mx-auto mb-10 sm:mb-14 space-y-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full">
                <HelpCircle className="w-3 h-3" />
                Help & FAQs
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
                Frequently asked questions
              </h2>
              <p className="text-sm text-slate-500 font-medium max-w-md mx-auto">
                Everything you need to know about sending files with iTransfer.
              </p>
            </div>

            <div className="space-y-3">
              {FAQS.map((faq, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div
                    key={idx}
                    className={`bg-white rounded-2xl overflow-hidden transition-all duration-300 border ${
                      isOpen ? 'border-indigo-200 shadow-lg shadow-indigo-500/5' : 'border-slate-200 hover:border-slate-300 shadow-sm'
                    }`}
                  >
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : idx)}
                      className="w-full p-5 sm:p-6 flex items-center justify-between text-left font-bold text-sm text-slate-900 hover:text-indigo-600 transition-colors gap-3 cursor-pointer"
                    >
                      <span>{faq.q}</span>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
                        isOpen ? 'bg-indigo-100 text-indigo-600 rotate-180' : 'bg-slate-100 text-slate-400'
                      }`}>
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </button>

                    {isOpen && (
                      <div className="px-5 sm:px-6 pb-5 sm:pb-6 text-sm text-slate-600 font-medium leading-relaxed border-t border-slate-100 pt-4 animate-fadeIn">
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
