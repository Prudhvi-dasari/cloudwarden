import { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import AuthModal from '../components/AuthModal';
import ProfileModal from '../components/ProfileModal';
import { getStoredUser, clearUserSession } from '../lib/authSession';
import {
  Scale, CheckCircle2, XCircle, Sparkles, Send,
  ArrowRight, ShieldCheck, Zap, Lock
} from 'lucide-react';

export default function ComparePage() {
  const [user, setUser] = useState(() => getStoredUser());
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('signup');
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const comparisonData = [
    {
      feature: 'Free Transfer Size (No Signup)',
      itransfer: '5 GB (or Unlimited via P2P)',
      wetransfer: '2 GB',
      transfernow: '5 GB',
      swisstransfer: '50 GB',
      winner: 'itransfer',
    },
    {
      feature: 'Device-to-Device Direct P2P Mode',
      itransfer: 'Unlimited & 0-Server Storage',
      wetransfer: 'Not Supported',
      transfernow: 'Not Supported',
      swisstransfer: 'Not Supported',
      winner: 'itransfer',
    },
    {
      feature: 'Password Protection on Free Plan',
      itransfer: 'Yes (100% Free)',
      wetransfer: 'Paid Pro Only ($12/mo)',
      transfernow: 'Paid Only',
      swisstransfer: 'Yes',
      winner: 'itransfer',
    },
    {
      feature: 'In-Browser 4K Video Streaming & Previews',
      itransfer: 'Yes (Instant)',
      wetransfer: 'Limited',
      transfernow: 'Yes',
      swisstransfer: 'No',
      winner: 'itransfer',
    },
    {
      feature: 'Embeddable Web Drop Widget',
      itransfer: 'Yes (1-line embed)',
      wetransfer: 'No',
      transfernow: 'Yes (Enterprise)',
      swisstransfer: 'No',
      winner: 'itransfer',
    },
    {
      feature: 'Zero AI Training Guarantee',
      itransfer: 'Strict Commitment',
      wetransfer: 'Terms Vary',
      transfernow: 'Yes',
      swisstransfer: 'Yes',
      winner: 'itransfer',
    },
    {
      feature: 'Developer REST API & SDKs',
      itransfer: 'Yes (cURL, JS, Python)',
      wetransfer: 'Deprecated / Limited',
      transfernow: 'Paid API',
      swisstransfer: 'No',
      winner: 'itransfer',
    },
    {
      feature: 'Interactive Speed Estimator & Checksum',
      itransfer: 'Built-in Free',
      wetransfer: 'No',
      transfernow: 'No',
      swisstransfer: 'No',
      winner: 'itransfer',
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

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-16 z-10 relative">
        
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-14 animate-fadeIn">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold theme-bg-light theme-text mb-4 border border-indigo-100/80 shadow-2xs">
            <Scale className="w-3.5 h-3.5" /> Direct Competitor Matrix
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight mb-4 leading-tight">
            iTransfer vs. Other Transfer Services
          </h1>
          <p className="text-base sm:text-lg text-slate-600 font-medium leading-relaxed">
            See how iTransfer compares side-by-side with WeTransfer, TransferNow, and SwissTransfer.
          </p>
        </div>

        {/* Comparison Table */}
        <div className="custom-card p-6 sm:p-10 bg-white/95 shadow-md mb-16 overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                <th className="py-4 px-4 font-bold">Feature</th>
                <th className="py-4 px-4 font-extrabold text-indigo-700 bg-indigo-50/50 rounded-t-xl text-center">
                  iTransfer 2.0 ✨
                </th>
                <th className="py-4 px-4 font-bold text-center text-slate-700">WeTransfer</th>
                <th className="py-4 px-4 font-bold text-center text-slate-700">TransferNow</th>
                <th className="py-4 px-4 font-bold text-center text-slate-700">SwissTransfer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {comparisonData.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-4 px-4 font-bold text-slate-900">{row.feature}</td>
                  <td className="py-4 px-4 text-center font-black text-indigo-700 bg-indigo-50/40">
                    <span className="inline-flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{row.itransfer}</span>
                    </span>
                  </td>
                  <td className="py-4 px-4 text-center text-slate-600">{row.wetransfer}</td>
                  <td className="py-4 px-4 text-center text-slate-600">{row.transfernow}</td>
                  <td className="py-4 px-4 text-center text-slate-600">{row.swisstransfer}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Why Switch Highlight Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <div className="custom-card p-6 bg-white/90 space-y-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Direct Device P2P</h3>
            <p className="text-sm text-slate-500 font-medium leading-relaxed">
              Only iTransfer gives you browser-to-browser WebRTC streaming with zero server upload for infinite transfer sizes.
            </p>
          </div>

          <div className="custom-card p-6 bg-white/90 space-y-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Free Password Vault</h3>
            <p className="text-sm text-slate-500 font-medium leading-relaxed">
              WeTransfer charges $12/month just to password-protect your links. With iTransfer, passwords are 100% free.
            </p>
          </div>

          <div className="custom-card p-6 bg-white/90 space-y-2.5">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Zero Mandatory Signup</h3>
            <p className="text-sm text-slate-500 font-medium leading-relaxed">
              No verification codes, spam marketing, or forced registration for one-time transfers.
            </p>
          </div>
        </div>

        {/* CTA Banner */}
        <div className="text-center bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 text-white rounded-3xl p-8 sm:p-12 shadow-xl">
          <h2 className="text-3xl sm:text-4xl font-black mb-3 tracking-tight">
            Switch to the faster, freer transfer engine
          </h2>
          <p className="text-base sm:text-lg text-indigo-100 max-w-xl mx-auto mb-6 font-medium">
            Experience the difference today with zero signup required.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 bg-white text-indigo-900 hover:bg-slate-100 font-black text-base px-8 py-3.5 rounded-2xl shadow-lg transition-transform hover:scale-105"
          >
            <span>Start Free Transfer</span>
            <ArrowRight className="w-5 h-5" />
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
