import { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import AuthModal from '../components/AuthModal';
import ProfileModal from '../components/ProfileModal';
import { getStoredUser, clearUserSession } from '../lib/authSession';
import {
  Sparkles, Rocket, ShieldCheck, Zap, ArrowRight,
  Code, RefreshCw, Send, CheckCircle2, History
} from 'lucide-react';

export default function ChangelogPage() {
  const [user, setUser] = useState(() => getStoredUser());
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('signup');
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const releases = [
    {
      version: 'v2.0.0',
      date: 'August 2026',
      title: 'The Full TransferNow Ecosystem & 10X Redesign Upgrade',
      badge: 'Major Release',
      highlights: [
        'Interactive Navigation Mega Menus: Products, Tools & Utilities, Solutions & Enterprise, Resources & Trust.',
        'Embeddable Web Drop Widget: 1-line HTML & script generator for client file uploads.',
        'iTransfer for Teams: Custom domain branding, 4K wallpapers, pooled storage, and audit logs.',
        'Client-Side SHA-256 Checksum & Hash Integrity Verifier.',
        'Live 99.99% Global Uptime & Telemetry Monitor with regional edge pings.',
        'Full GDPR, DPA, and Regional Data Sovereignty Center.',
        'Side-by-side Competitor Comparison matrix against WeTransfer and TransferNow.',
        'Slow-motion full-page confetti celebration on transfer completion.',
      ],
    },
    {
      version: 'v1.5.0',
      date: 'July 2026',
      title: 'High-Concurrency S3 Chunking & Direct WebRTC P2P',
      badge: 'Performance Boost',
      highlights: [
        'Direct Device-to-Device WebRTC file streaming with 0-server storage.',
        'Multi-part S3-compatible chunked uploads with pause/resume resilience.',
        'In-browser 4K video player, audio streaming, and high-res photo viewer.',
        'Download count tracking and instant QR code generators.',
      ],
    },
    {
      version: 'v1.0.0',
      date: 'June 2026',
      title: 'Initial Launch of iTransfer Platform',
      badge: 'Foundation',
      highlights: [
        'Secure shareable links with custom expiration timers (24h to 7d).',
        'AES-256 password protection vault.',
        'Direct email delivery bypassing 25MB attachment limitations.',
        'Row-Level Security (RLS) PostgreSQL database architecture.',
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

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-16 z-10 relative">
        
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-14 animate-fadeIn">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold theme-bg-light theme-text mb-4 border border-indigo-100/80 shadow-2xs">
            <History className="w-3.5 h-3.5" /> Product Updates & Evolution
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight mb-4 leading-tight">
            iTransfer Changelog
          </h1>
          <p className="text-base sm:text-lg text-slate-600 font-medium leading-relaxed">
            Follow our latest features, performance improvements, security enhancements, and SDK releases.
          </p>
        </div>

        {/* Timeline */}
        <div className="space-y-8 mb-16">
          {releases.map((rel, idx) => (
            <div key={idx} className="custom-card p-6 sm:p-8 bg-white/95 shadow-md relative">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-xl font-black text-slate-900">{rel.version}</span>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                    {rel.badge}
                  </span>
                </div>
                <span className="text-xs font-bold text-slate-400">{rel.date}</span>
              </div>

              <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-3">{rel.title}</h3>

              <ul className="space-y-2 text-sm text-slate-600 font-medium">
                {rel.highlights.map((h, hIdx) => (
                  <li key={hIdx} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center custom-card p-8 sm:p-12 bg-white/90 shadow-md">
          <h2 className="text-2xl font-black text-slate-900 mb-2">Want to test the latest features?</h2>
          <p className="text-sm text-slate-600 mb-6 font-medium">Send your files today at maximum speed with zero limits.</p>
          <Link
            to="/"
            className="theme-btn-primary px-7 py-3.5 text-sm font-bold shadow-md inline-flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            <span>Launch iTransfer</span>
          </Link>
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
      />
    </div>
  );
}
