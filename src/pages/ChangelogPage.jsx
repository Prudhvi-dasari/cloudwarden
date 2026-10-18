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
      version: 'v3.0.0',
      date: 'October 2026',
      title: 'Luxury Noir Atelier redesign',
      badge: 'Major Release',
      highlights: [
        'Luxury dark editorial UI — charcoal canvas, champagne gold, Fraunces + DM Sans.',
        'Celebration modal with confetti when your share link is ready.',
        'Fixed QR ↔ Device P2P pairing for phone-to-laptop transfers.',
        'Real file request portals persisted in Supabase with owner routing.',
        'R2 cleanup aligned to transfer expiry + working object delete on revoke.',
        'Honest SEO meta, Compare matrix, and Security copy (no fake E2EE/API claims).',
        'Google sign-in via Supabase OAuth; Resources hub for organic traffic.',
      ],
    },
    {
      version: 'v2.0.0',
      date: 'August 2026',
      title: 'Ecosystem expansion',
      badge: 'Release',
      highlights: [
        'Checksum verifier, Compare pages, and SEO landing cluster.',
        'Dashboard, guest uploads, and Pro trial flows.',
        'Side-by-side competitor comparison vs WeTransfer and TransferNow.',
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
    <div className="min-h-screen flex flex-col text-white relative overflow-hidden bg-[#07080d]">
      <div className="page-sky" aria-hidden="true" />
<Navbar
        user={user}
        onOpenAuth={(mode) => { setAuthMode(mode); setIsAuthOpen(true); }}
        onOpenProfile={() => setIsProfileOpen(true)}
      />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-16 z-10 relative">
        
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-14 animate-fadeIn">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold theme-bg-light theme-text mb-4 border border-[#c4a574]/25/80 shadow-2xs">
            <History className="w-3.5 h-3.5" /> Product Updates & Evolution
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold text-white italic tracking-tight mb-4 leading-tight">
            iTransfer Changelog
          </h1>
          <p className="text-base sm:text-lg text-white/55 font-medium leading-relaxed">
            Follow our latest features, performance improvements, security enhancements, and SDK releases.
          </p>
        </div>

        {/* Timeline */}
        <div className="space-y-8 mb-16">
          {releases.map((rel, idx) => (
            <div key={idx} className="custom-card p-6 sm:p-8 bg-[#17192e] shadow-md relative">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-xl font-black text-white">{rel.version}</span>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-[#c4a574]/25">
                    {rel.badge}
                  </span>
                </div>
                <span className="text-xs font-bold text-slate-400">{rel.date}</span>
              </div>

              <h3 className="text-base sm:text-lg font-bold text-white mb-3">{rel.title}</h3>

              <ul className="space-y-2 text-sm text-white/55 font-medium">
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
          <h2 className="text-2xl font-black text-white mb-2">Want to test the latest features?</h2>
          <p className="text-sm text-white/55 mb-6 font-medium">Send your files today at maximum speed with zero limits.</p>
          <Link
            to="/"
            className="theme-btn-primary px-7 py-3.5 text-sm font-bold shadow-md inline-flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            <span>Launch iTransfer</span>
          </Link>
        </div>

      </main>

      
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pb-12">
        <div className="pt-8 border-t border-white/10">
          <Link to="/" className="inline-flex items-center gap-2 rounded-full bg-white text-black text-sm font-semibold px-5 py-3 hover:bg-white/90">
            Send a file
          </Link>
        </div>
      </div>

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
