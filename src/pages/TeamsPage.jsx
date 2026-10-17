import { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import AuthModal from '../components/AuthModal';
import ProfileModal from '../components/ProfileModal';
import { getStoredUser, clearUserSession } from '../lib/authSession';
import {
  Users, Building2, Globe, Palette, ShieldCheck, HardDrive,
  BarChart3, KeyRound, Sparkles, Send, CheckCircle2, ArrowRight,
  Lock, Check, UserCheck
} from 'lucide-react';

export default function TeamsPage() {
  const [user, setUser] = useState(() => getStoredUser());
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('signup');
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const teamFeatures = [
    {
      icon: Building2,
      title: 'Custom Domain & Subdomains',
      desc: 'Deliver files on your own branded URL such as files.yourcompany.com with automatic SSL certificates.',
    },
    {
      icon: Palette,
      title: 'White-Label Branding',
      desc: 'Add your company logo, custom background wallpapers, custom email templates, and signature brand colors.',
    },
    {
      icon: Users,
      title: 'Multi-User Member Management',
      desc: 'Invite team collaborators, assign admin and member roles, and organize shared address books for instant transfers.',
    },
    {
      icon: BarChart3,
      title: 'Centralized Activity & Audit Logs',
      desc: 'Complete visibility into all files sent, downloaded, and received across your organization with timestamped logs.',
    },
    {
      icon: HardDrive,
      title: 'Pooled Team Cloud & HDD Storage',
      desc: 'Shared high-capacity 1 TB to 10 TB storage pools with automated retention policies and scheduled archiving.',
    },
    {
      icon: KeyRound,
      title: 'SSO & Advanced Security Controls',
      desc: 'Enforce team-wide password policies, two-factor authentication (2FA), and mandatory transfer expiration dates.',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans text-slate-900 bg-dot-grid relative overflow-hidden">
      
      <div className="ambient-orb-1" />
      <div className="ambient-orb-3" />

      <Navbar
        user={user}
        onOpenAuth={(mode) => { setAuthMode(mode); setIsAuthOpen(true); }}
        onOpenProfile={() => setIsProfileOpen(true)}
      />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-16 z-10 relative">
        
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-14 animate-fadeIn">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold theme-bg-light theme-text mb-4 border border-indigo-100/80 shadow-2xs">
            <Users className="w-3.5 h-3.5" /> iTransfer for Business & Teams
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight mb-4 leading-tight">
            Collaborative file transfer for modern teams.
          </h1>
          <p className="text-base sm:text-lg text-slate-600 font-medium leading-relaxed mb-6">
            Equip your entire organization with branded transfer pages, pooled high-capacity storage, and enterprise-grade privacy controls.
          </p>
          <div className="flex flex-wrap justify-center gap-3.5">
            <button
              onClick={() => { setAuthMode('signup'); setIsAuthOpen(true); }}
              className="theme-btn-primary px-7 py-3.5 text-sm font-bold shadow-md inline-flex items-center gap-2"
            >
              <UserCheck className="w-4.5 h-4.5" />
              <span>Start 14-Day Team Trial</span>
            </button>
            <Link
              to="/pricing"
              className="px-7 py-3.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-sm font-bold transition-colors shadow-2xs"
            >
              Compare Team Plans
            </Link>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-16">
          {teamFeatures.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <div key={idx} className="custom-card p-6 bg-white/90 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">{feat.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed font-medium">{feat.desc}</p>
              </div>
            );
          })}
        </div>

        {/* White-Label Mockup Banner */}
        <div className="custom-card p-8 sm:p-12 bg-white/95 shadow-md border border-slate-200 text-center space-y-6">
          <div className="max-w-xl mx-auto space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Your brand at the center of every transfer.
            </h2>
            <p className="text-sm text-slate-500 font-medium">
              Every download link and recipient email carries your agency or company identity.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200/80">
              <span className="text-xs font-bold uppercase text-indigo-600 tracking-wider">Custom Domain</span>
              <p className="text-sm font-bold text-slate-900 mt-1">files.acme-agency.com</p>
              <p className="text-xs text-slate-400 mt-0.5 font-medium">Automatic HTTPS certificate</p>
            </div>

            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200/80">
              <span className="text-xs font-bold uppercase text-indigo-600 tracking-wider">Custom Wallpaper</span>
              <p className="text-sm font-bold text-slate-900 mt-1">Full-Bleed 4K Backgrounds</p>
              <p className="text-xs text-slate-400 mt-0.5 font-medium">Showcase your portfolio on download</p>
            </div>

            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200/80">
              <span className="text-xs font-bold uppercase text-indigo-600 tracking-wider">Email Branding</span>
              <p className="text-sm font-bold text-slate-900 mt-1">Custom Header & Logo</p>
              <p className="text-xs text-slate-400 mt-0.5 font-medium">Direct notifications from your brand</p>
            </div>
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
      />
    </div>
  );
}
