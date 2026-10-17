import { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import AuthModal from '../components/AuthModal';
import ProfileModal from '../components/ProfileModal';
import { getStoredUser, clearUserSession } from '../lib/authSession';
import {
  ShieldCheck, Lock, Key, Server, EyeOff, RefreshCw,
  FileCheck, CheckCircle2, Sparkles, Send, ArrowRight, ShieldAlert
} from 'lucide-react';

export default function SecurityPage() {
  const [user, setUser] = useState(() => getStoredUser());
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(() => getStoredUser()?.user_metadata?.theme || 'indigo');

  const securityPillars = [
    {
      icon: Lock,
      title: 'Encryption in Transit & at Rest',
      desc: 'All file streams and network requests are protected by modern TLS 1.3 encryption in transit. Files stored in cloud storage are secured with AES-256 server-side encryption at rest.',
    },
    {
      icon: Key,
      title: 'Password Protected Transfers',
      desc: 'Lock transfers with custom client-side secret keys. The download portal requires password authentication before any file metadata or download stream is initiated.',
    },
    {
      icon: EyeOff,
      title: 'Automatic Expiration & Data Deletion',
      desc: 'Transfers automatically self-destruct once their expiration timer expires or maximum download count is reached. Expired files are permanently purged with zero residual copies.',
    },
    {
      icon: RefreshCw,
      title: 'Direct Peer-to-Peer Streaming',
      desc: 'In Device P2P mode, files stream directly between browsers over encrypted WebRTC data channels without intermediate storage on any server.',
    },
    {
      icon: FileCheck,
      title: 'Individual Recipient Privacy',
      desc: 'When sending transfers to multiple email recipients, each recipient receives their own isolated private link. Email addresses are never exposed to other recipients.',
    },
    {
      icon: Server,
      title: 'Isolated Storage Abstraction',
      desc: 'All backend storage providers (Supabase Cloud Storage, S3, or Local 1TB Private HDD) operate behind a strict API proxy layer and are never directly exposed to the public internet.',
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
            <ShieldCheck className="w-3.5 h-3.5" /> Security & Privacy Architecture
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight mb-4 leading-tight">
            Trust built into every layer.
          </h1>
          <p className="text-base sm:text-lg text-slate-600 font-medium leading-relaxed">
            Your data belongs to you. We design iTransfer around transparent security controls, rigorous encryption standards, and strict retention lifecycles.
          </p>
        </div>

        {/* Pillars Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {securityPillars.map((pillar, idx) => {
            const Icon = pillar.icon;
            return (
              <div key={idx} className="custom-card p-6 bg-white/85 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">{pillar.title}</h3>
                <p className="text-sm text-slate-500 font-medium leading-relaxed">{pillar.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Security Checklist */}
        <div className="mt-12 custom-card p-8 bg-white/95 shadow-sm">
          <h3 className="text-base font-bold text-slate-900 mb-5 flex items-center gap-2">
            <Sparkles className="w-5 h-5 theme-text" /> Security Standards Checklist
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2.5 text-slate-700 font-medium">
              <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
              <span>TLS 1.3 Transport Layer Security</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-700 font-medium">
              <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
              <span>AES-256 Server-Side Encryption</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-700 font-medium">
              <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
              <span>Zero Account Requirement for Sending</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-700 font-medium">
              <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
              <span>Row-Level Security (RLS) Database Policies</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-700 font-medium">
              <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
              <span>Automatic Cleanup & Purging Routine</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-700 font-medium">
              <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
              <span>Direct WebRTC P2P Data Channels</span>
            </div>
          </div>
        </div>

        {/* CTA Banner */}
        <div className="mt-12 custom-card p-8 sm:p-12 text-center bg-white/90 shadow-md">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mb-3">
            Experience private, secure file delivery
          </h2>
          <p className="text-sm sm:text-base text-slate-600 max-w-md mx-auto mb-6 font-medium">
            Send confidential documents or large media archives with password protection and auto-expiry.
          </p>
          <Link
            to="/"
            className="theme-btn-primary px-7 py-3.5 text-sm font-bold shadow-md inline-flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            <span>Send Protected Transfer</span>
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
        currentTheme={currentTheme}
        onThemeChange={(t) => setCurrentTheme(t)}
      />
    </div>
  );
}
