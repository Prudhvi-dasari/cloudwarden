import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import AuthModal from '../components/AuthModal';
import ProfileModal from '../components/ProfileModal';
import P2PTransferView from '../components/P2PTransferView';
import { getStoredUser, clearUserSession } from '../lib/authSession';
import { QrCode, RefreshCw, ArrowRight } from 'lucide-react';
import { generateP2PCode } from '../lib/p2p';

export default function QrTransferPage() {
  const [user, setUser] = useState(() => getStoredUser());
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [hostCode, setHostCode] = useState(() => generateP2PCode());

  const joinUrl = `${window.location.origin}/?mode=device&room=${encodeURIComponent(hostCode)}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(joinUrl)}&bgcolor=0c0b0a&color=c4a574`;

  useEffect(() => {
    // Keep URL shareable for this host session
    const url = new URL(window.location.href);
    url.searchParams.set('host', hostCode);
    window.history.replaceState({}, '', url.pathname + url.search);
  }, [hostCode]);

  return (
    <div className="min-h-screen flex flex-col text-white relative overflow-hidden bg-[#07080d]">
      <div className="page-sky" aria-hidden="true" />
<Navbar
        user={user}
        onOpenAuth={(mode) => { setAuthMode(mode); setIsAuthOpen(true); }}
        onOpenProfile={() => setIsProfileOpen(true)}
      />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-16 z-10 relative">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold text-[#c4a574] bg-[#c4a574]/10 border border-[#c4a574]/25 mb-4">
            <QrCode className="w-3.5 h-3.5" /> Device P2P
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold text-white tracking-tight mb-4 italic">
            Scan & stream directly
          </h1>
          <p className="text-base text-white/55 font-medium leading-relaxed">
            Open this page on your laptop, scan with your phone, and transfer over the local network — zero cloud storage.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 items-start">
          <div className="custom-card p-8 text-center">
            <div className="inline-block p-4 rounded-2xl border border-white/10 bg-[#17192e] mb-6">
              <img src={qrCodeUrl} alt="Scan to pair devices" className="w-56 h-56 rounded-xl object-contain mx-auto" />
            </div>
            <p className="text-xs font-semibold text-white/45 uppercase tracking-wider mb-2">Pairing code</p>
            <div className="text-2xl font-mono font-semibold tracking-widest text-[#c4a574] mb-4">
              {hostCode}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setHostCode(generateP2PCode())}
                className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                New code
              </button>
              <Link
                to={`/?mode=device&room=${encodeURIComponent(hostCode)}`}
                className="theme-btn-primary px-5 py-2 rounded-full text-xs font-semibold inline-flex items-center gap-1.5"
              >
                Open as receiver
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <p className="mt-4 text-[11px] text-white/45">
              Phone scans QR → joins as receiver. Use the panel to send from this device.
            </p>
          </div>

          <div className="custom-card p-5 sm:p-6">
            <P2PTransferView preferredCode={hostCode} key={hostCode} />
          </div>
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
