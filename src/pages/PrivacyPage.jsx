import { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import AuthModal from '../components/AuthModal';
import ProfileModal from '../components/ProfileModal';
import { getStoredUser, clearUserSession } from '../lib/authSession';
import {
  ShieldCheck, Wifi, Server, Lock, Clock, Database,
  ArrowLeft, CheckCircle2, Sparkles, Send, ArrowRight
} from 'lucide-react';

export default function PrivacyPage() {
  const [user, setUser] = useState(() => getStoredUser());
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [isProfileOpen, setIsProfileOpen] = useState(false);

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
            <ShieldCheck className="w-3.5 h-3.5" /> Plain Language Privacy Guarantee
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight mb-4 leading-tight">
            How Privacy Works on iTransfer
          </h1>
          <p className="text-base sm:text-lg text-slate-600 font-medium leading-relaxed">
            We believe in total transparency. Your files are never scanned, analyzed, or used to train artificial intelligence models.
          </p>
        </div>

        {/* Privacy Matrix */}
        <div className="space-y-6 mb-16">
          
          {/* Card 1: Direct P2P */}
          <div className="custom-card p-6 sm:p-8 bg-white/90">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl theme-bg-light theme-text flex items-center justify-center shrink-0">
                <Wifi className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900">1. Direct Browser-to-Browser Streaming (P2P)</h2>
                  <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
                    Zero Server Storage
                  </span>
                </div>
                <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-medium">
                  When transferring directly between two nearby devices, files stream <strong>directly between browsers via WebRTC data channels</strong> without ever passing through or lingering on our servers.
                </p>
                <ul className="text-sm text-slate-500 space-y-2 pt-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Unlimited file sizes with 0 byte server overhead</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Direct end-to-end DTLS/SRTP encryption</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Card 2: Ephemeral Cloud Links */}
          <div className="custom-card p-6 sm:p-8 bg-white/90">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Server className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900">2. Ephemeral Share Links & Email Delivery</h2>
                  <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2.5 py-0.5 rounded-full border border-indigo-200">
                    Auto-Destruct
                  </span>
                </div>
                <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-medium">
                  When you upload files for offline recipients, data is encrypted with AES-256 and stored temporarily behind secure API gateways.
                </p>
                <ul className="text-sm text-slate-500 space-y-2 pt-2">
                  <li className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>Files automatically self-destruct once your selected expiration date (24h to 30d) is reached.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>Optional password protection requires the secret key before metadata or downloads are permitted.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

        </div>

        {/* CTA */}
        <div className="text-center custom-card p-8 sm:p-12 bg-white/90">
          <h3 className="text-2xl font-black text-slate-900 mb-2">Ready to send files privately?</h3>
          <p className="text-sm text-slate-600 mb-6 font-medium">Start sending now. No tracking cookies or mandatory registration.</p>
          <Link
            to="/"
            className="theme-btn-primary px-7 py-3.5 text-sm font-bold shadow-md inline-flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            <span>Send Files Now</span>
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
