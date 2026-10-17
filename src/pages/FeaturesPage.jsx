import { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import AuthModal from '../components/AuthModal';
import ProfileModal from '../components/ProfileModal';
import { getStoredUser, clearUserSession } from '../lib/authSession';
import {
  Send, Link2, Mail, Wifi, Inbox, ShieldCheck, Lock, HardDrive,
  Eye, CheckCircle2, Zap, Sparkles, Server, Clock, Users, ArrowRight,
  Code, Sliders, Smartphone, Laptop, FileText, QrCode, RefreshCw
} from 'lucide-react';

export default function FeaturesPage() {
  const [user, setUser] = useState(() => getStoredUser());
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(() => getStoredUser()?.user_metadata?.theme || 'indigo');

  const featureSections = [
    {
      category: '1. Transfer Engines & Delivery Modes',
      items: [
        {
          icon: Wifi,
          title: 'Direct Device P2P Streaming',
          desc: 'High-speed browser-to-browser WebRTC streaming between laptops, iPhones, and Android devices without intermediate server storage.',
          badge: 'Unlimited Size',
        },
        {
          icon: Link2,
          title: 'Secure Shareable Links',
          desc: 'Generate protected download links with custom expiration times (1 hour to 30 days), max download limits, and instant 1-click sharing.',
          badge: 'Up to 25 GB',
        },
        {
          icon: Mail,
          title: 'Automated Email Dispatch',
          desc: 'Deliver files directly to recipient inboxes with automated notifications, individual download links, and delivery tracking receipts.',
          badge: 'Multi-Recipient',
        },
        {
          icon: Inbox,
          title: 'File Requests & Drop Portals',
          desc: 'Create dedicated drop links and embeddable forms for clients and team members to upload large files directly into your storage.',
          badge: 'Zero Sender Signup',
        },
      ],
    },
    {
      category: '2. Security, Privacy & Integrity',
      items: [
        {
          icon: Lock,
          title: 'Password Protected Vault',
          desc: 'Lock any transfer with custom passwords. Files remain encrypted and inaccessible until the recipient enters the correct password.',
          badge: 'Client Encrypted',
        },
        {
          icon: ShieldCheck,
          title: 'Automatic Expiration & Self-Destruct',
          desc: 'Set transfers to automatically wipe after 1 download or after a set time window, guaranteeing sensitive data never lingers.',
          badge: 'Zero Residuals',
        },
        {
          icon: Server,
          title: '100% Bit-for-Bit File Integrity',
          desc: 'Your videos, RAW photos, archives, and documents are delivered with 100% bit-for-bit integrity without compression or downsampling.',
          badge: 'Original Quality',
        },
        {
          icon: ShieldCheck,
          title: 'Zero AI Training Guarantee',
          desc: 'Your files are strictly your property. We never scan, analyze, or train machine learning models on your uploaded files or metadata.',
          badge: 'Strict Privacy',
        },
      ],
    },
    {
      category: '3. Streaming, Previews & Tools',
      items: [
        {
          icon: Eye,
          title: 'In-Browser Media Previews',
          desc: 'Recipients can stream 4K videos, listen to audio files, view high-res photos, and read PDFs directly in the browser before downloading.',
          badge: 'Streaming Ready',
        },
        {
          icon: QrCode,
          title: 'Instant QR Code Generation',
          desc: 'Instantly generate QR codes for any transfer so mobile users can scan and download without typing long URLs.',
          badge: 'Mobile Optimized',
        },
        {
          icon: CheckCircle2,
          title: 'Real-Time Download Tracking',
          desc: 'Track exact download counts, recipient opens, and transfer activity with live updates on your dashboard.',
          badge: 'Realtime Sync',
        },
        {
          icon: Zap,
          title: 'High-Concurrency Chunked Uploads',
          desc: 'Multi-part streaming storage engine capable of handling parallel uploads with automatic pause/resume on network drops.',
          badge: 'Network Resilient',
        },
      ],
    },
    {
      category: '4. Ecosystem & Integrations',
      items: [
        {
          icon: Code,
          title: 'Embeddable Web Widget',
          desc: 'Embed a file drop form into any website with 1 line of HTML code to collect assets directly from your users.',
          badge: '1-Line Embed',
        },
        {
          icon: Users,
          title: 'iTransfer for Teams',
          desc: 'Multi-user workspace with custom domain branding, team activity audits, and pooled cloud storage.',
          badge: 'Business Ready',
        },
        {
          icon: Code,
          title: 'Developer REST API',
          desc: 'Programmatic upload initiation, presigned upload URLs, webhooks, and SDKs in cURL, JavaScript, and Python.',
          badge: 'API & SDK',
        },
        {
          icon: Smartphone,
          title: 'Cross-Platform Ecosystem',
          desc: 'Seamless file transfer across iOS, Android, macOS, Windows, Linux, and web browsers with zero installation.',
          badge: 'Universal',
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans text-slate-900 bg-dot-grid relative overflow-hidden">
      
      <div className="ambient-orb-1" />
      <div className="ambient-orb-2" />

      <Navbar
        user={user}
        onOpenAuth={(mode) => { setAuthMode(mode); setIsAuthOpen(true); }}
        onOpenProfile={() => setIsProfileOpen(true)}
      />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-16 z-10 relative">
        
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-14 animate-fadeIn">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold theme-bg-light theme-text mb-4 border border-indigo-100/80 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5" /> Complete Platform Capabilities
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight mb-4 leading-tight">
            Engineered for seamless file delivery.
          </h1>
          <p className="text-base sm:text-lg text-slate-600 font-medium leading-relaxed">
            From direct device transfers to enterprise-grade file requests, explore everything built into iTransfer.
          </p>
        </div>

        {/* Categories */}
        <div className="space-y-12">
          {featureSections.map((section, idx) => (
            <div key={idx} className="space-y-4">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
                {section.category}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {section.items.map((feat, fIdx) => {
                  const Icon = feat.icon;
                  return (
                    <div
                      key={fIdx}
                      className="custom-card p-6 space-y-3 bg-white/85 hover:bg-white transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3.5">
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                            <Icon className="w-5 h-5" />
                          </div>
                          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                            {feat.badge}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-slate-900 mb-1.5">{feat.title}</h3>
                        <p className="text-sm text-slate-500 font-medium leading-relaxed">{feat.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* CTA Banner */}
        <div className="mt-16 custom-card p-8 sm:p-12 text-center bg-white/90 shadow-md">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mb-3">
            Ready to send files with zero limits?
          </h2>
          <p className="text-sm sm:text-base text-slate-600 max-w-md mx-auto mb-6 font-medium">
            Start transferring instantly. No registration required for one-time transfers.
          </p>
          <div className="flex flex-wrap justify-center gap-3.5">
            <Link
              to="/"
              className="theme-btn-primary px-7 py-3.5 text-sm font-bold shadow-md inline-flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>Send Files Now</span>
            </Link>
            <Link
              to="/pricing"
              className="px-7 py-3.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-sm font-bold transition-colors"
            >
              <span>View Pricing & Pro</span>
            </Link>
          </div>
        </div>

      </main>

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
        onSignOut={async () => {
          await clearUserSession();
          setUser(null);
        }}
        currentTheme={currentTheme}
        onThemeChange={(t) => setCurrentTheme(t)}
      />
    </div>
  );
}
