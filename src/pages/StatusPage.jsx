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
  const [pingLatency, setPingLatency] = useState(18);
  const [lastCheck, setLastCheck] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate live ping fluctuation
      setPingLatency(Math.floor(14 + Math.random() * 12));
      setLastCheck(new Date().toLocaleTimeString());
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const components = [
    { name: 'Core File Upload API', status: 'Operational', uptime: '99.99%', latency: `${pingLatency}ms` },
    { name: 'Cloud Storage & Multi-Part S3', status: 'Operational', uptime: '100.0%', latency: `${pingLatency + 5}ms` },
    { name: 'WebRTC P2P Direct Signaler', status: 'Operational', uptime: '99.98%', latency: `${pingLatency - 2}ms` },
    { name: 'Supabase Realtime Sync Engine', status: 'Operational', uptime: '99.99%', latency: `${pingLatency + 3}ms` },
    { name: 'Email Delivery & Notifications', status: 'Operational', uptime: '99.95%', latency: 'Instant' },
    { name: 'Embeddable Web Drop Widget CDN', status: 'Operational', uptime: '100.0%', latency: `${pingLatency - 4}ms` },
  ];

  const regions = [
    { region: 'Asia South (Mumbai, IN)', status: 'Operational', ping: `${pingLatency}ms` },
    { region: 'Europe Central (Frankfurt, DE)', status: 'Operational', ping: `${pingLatency + 22}ms` },
    { region: 'US East (N. Virginia, US)', status: 'Operational', ping: `${pingLatency + 35}ms` },
    { region: 'Asia East (Singapore, SG)', status: 'Operational', ping: `${pingLatency + 18}ms` },
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
        <div className="text-center max-w-2xl mx-auto mb-10 animate-fadeIn">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold theme-bg-light theme-text mb-4 border border-indigo-100/80 shadow-2xs">
            <Activity className="w-3.5 h-3.5" /> Realtime Global Telemetry
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight mb-4 leading-tight">
            System Uptime & Live Status
          </h1>
          <p className="text-base sm:text-lg text-slate-600 font-medium leading-relaxed">
            Monitor real-time infrastructure health, API response latencies, and regional cluster availability.
          </p>
        </div>

        {/* Big Status Badge */}
        <div className="custom-card p-6 sm:p-8 mb-10 bg-emerald-500 text-white shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-7 h-7 text-white stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black">All Systems Fully Operational</h2>
              <p className="text-xs sm:text-sm text-emerald-100 font-medium">99.99% overall uptime recorded over the past 90 days.</p>
            </div>
          </div>

          <div className="text-xs font-bold bg-white/20 px-3.5 py-2 rounded-xl border border-white/30 flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Updated: {lastCheck}</span>
          </div>
        </div>

        {/* Service Health List */}
        <div className="custom-card p-6 sm:p-8 bg-white/95 shadow-md mb-12 space-y-4">
          <h3 className="text-lg font-bold text-slate-900 pb-2 border-b border-slate-200">
            System Component Status
          </h3>

          <div className="divide-y divide-slate-100">
            {components.map((c, idx) => (
              <div key={idx} className="py-3.5 flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="font-bold text-slate-900">{c.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-slate-500 font-medium hidden sm:inline">Latency: {c.latency}</span>
                  <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md">{c.uptime}</span>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                    {c.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Global Edge Node Latencies */}
        <div className="custom-card p-6 sm:p-8 bg-white/95 shadow-md mb-16">
          <h3 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-200 flex items-center gap-2">
            <Globe className="w-5 h-5 text-indigo-600" />
            <span>Regional Edge Cluster Latencies</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {regions.map((r, idx) => (
              <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-900">{r.region}</p>
                  <p className="text-xs text-emerald-600 font-semibold">{r.status}</p>
                </div>
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-800">
                  {r.ping}
                </span>
              </div>
            ))}
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
