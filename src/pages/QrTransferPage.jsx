import { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import AuthModal from '../components/AuthModal';
import ProfileModal from '../components/ProfileModal';
import { getStoredUser, clearUserSession } from '../lib/authSession';
import {
  QrCode, Smartphone, Laptop, Wifi, ShieldCheck,
  Sparkles, Send, ArrowRight, RefreshCw, CheckCircle2, Zap
} from 'lucide-react';

export default function QrTransferPage() {
  const [user, setUser] = useState(() => getStoredUser());
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const [roomId, setRoomId] = useState(() => Math.floor(100000 + Math.random() * 900000).toString());

  const generateNewRoom = () => {
    setRoomId(Math.floor(100000 + Math.random() * 900000).toString());
  };

  const roomUrl = `${window.location.origin}/?p2p=true&room=${roomId}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(roomUrl)}`;

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
        <div className="text-center max-w-2xl mx-auto mb-10 animate-fadeIn">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold theme-bg-light theme-text mb-4 border border-indigo-100/80 shadow-2xs">
            <QrCode className="w-3.5 h-3.5" /> Instant Wireless P2P Pairing
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight mb-4 leading-tight">
            Scan & Stream Files Directly
          </h1>
          <p className="text-base sm:text-lg text-slate-600 font-medium leading-relaxed">
            Scan the QR code with your iPhone or Android camera to instantly pair devices and stream files over local Wi-Fi with zero server storage.
          </p>
        </div>

        {/* Dynamic QR Card */}
        <div className="custom-card p-8 sm:p-12 text-center max-w-md mx-auto bg-white/95 shadow-xl mb-12 animate-scale-in">
          
          <div className="inline-block p-4 bg-white rounded-3xl border-2 border-slate-200 shadow-md mb-6">
            <img
              src={qrCodeUrl}
              alt="Scan to pair devices"
              className="w-56 h-56 rounded-2xl object-contain mx-auto"
            />
          </div>

          <div className="space-y-2 mb-6">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Room Pairing Code</span>
            <div className="text-3xl font-black font-mono tracking-widest text-slate-900 bg-slate-100 py-2 px-4 rounded-xl border border-slate-200 inline-block">
              {roomId}
            </div>
          </div>

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={generateNewRoom}
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>New Room Code</span>
            </button>

            <Link
              to={`/?p2p=true&room=${roomId}`}
              className="theme-btn-primary px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm inline-flex items-center gap-1.5"
            >
              <span>Join Room in Browser</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

        </div>

        {/* 3 Step Guide */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-16">
          <div className="custom-card p-6 bg-white/90 space-y-2">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
              1
            </div>
            <h4 className="text-base font-bold text-slate-900">Open Camera</h4>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Open the native Camera app on your iPhone or Android phone and point it at the QR code above.
            </p>
          </div>

          <div className="custom-card p-6 bg-white/90 space-y-2">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-sm">
              2
            </div>
            <h4 className="text-base font-bold text-slate-900">Tap Browser Link</h4>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Tap the notification to automatically open iTransfer in Safari or Chrome paired to this session.
            </p>
          </div>

          <div className="custom-card p-6 bg-white/90 space-y-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
              3
            </div>
            <h4 className="text-base font-bold text-slate-900">Instant Stream</h4>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Select your photos or videos and stream them directly across devices with uncapped local Wi-Fi speeds.
            </p>
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
