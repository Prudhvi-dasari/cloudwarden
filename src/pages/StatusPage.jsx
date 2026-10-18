import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import AuthModal from '../components/AuthModal';
import ProfileModal from '../components/ProfileModal';
import { getStoredUser, clearUserSession } from '../lib/authSession';
import {
  Activity, CheckCircle2, Server, Globe, ShieldCheck,
  RefreshCw, Wifi, Clock, Sparkles, Send, AlertTriangle
} from 'lucide-react';

export default function StatusPage() {
  const [user, setUser] = useState(() => getStoredUser());
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [apiStatus, setApiStatus] = useState('checking');
  const [lastCheck, setLastCheck] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/r2?action=health');
        const data = await res.json().catch(() => ({}));
        if (!cancelled) setApiStatus(res.ok && data.configured ? 'reachable' : 'unavailable');
      } catch {
        if (!cancelled) setApiStatus('unavailable');
      } finally {
        if (!cancelled) setLastCheck(new Date().toLocaleTimeString());
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen flex flex-col text-white relative overflow-hidden bg-[#07080d]">
      <div className="page-sky" aria-hidden="true" />
<Navbar
        user={user}
        onOpenAuth={(mode) => { setAuthMode(mode); setIsAuthOpen(true); }}
        onOpenProfile={() => setIsProfileOpen(true)}
      />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-16 z-10 relative">
        
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-10 animate-fadeIn">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold theme-bg-light theme-text mb-4 border border-[#c4a574]/25/80 shadow-2xs">
            <Activity className="w-3.5 h-3.5" /> Service check
          </div>
          <h1 className="text-4xl sm:text-5xl font-semibold text-white tracking-tight mb-4 leading-tight">
            What this page can confirm
          </h1>
          <p className="text-base sm:text-lg text-white/55 font-medium leading-relaxed">
            This checks whether the file API answers. It does not report uptime, regional latency, email delivery, or storage health.
          </p>
        </div>

        <div className="custom-card p-6 sm:p-8 mb-16 bg-[#17192e]">
          <h2 className="text-xl font-semibold text-white">File API</h2>
          <p className="mt-2 text-sm text-white/70">
            {apiStatus === 'checking' && 'Checking…'}
            {apiStatus === 'reachable' && 'The file API responded and reports storage configuration.'}
            {apiStatus === 'unavailable' && 'The file API did not respond as available just now.'}
          </p>
          {lastCheck && <p className="mt-3 text-xs text-white/45">Checked at {lastCheck}</p>}
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
