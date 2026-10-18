import { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import AuthModal from '../components/AuthModal';
import ProfileModal from '../components/ProfileModal';
import { getStoredUser, clearUserSession } from '../lib/authSession';
import {
  BookOpen, Video, Smartphone, Laptop, Mail, Link2,
  ArrowRight, ShieldCheck, Hash, QrCode, Scale
} from 'lucide-react';

const GUIDES = [
  { title: 'Send large video without compression', path: '/send-large-video', tag: 'Media', icon: Video },
  { title: 'iPhone to Windows', path: '/iphone-to-windows', tag: 'Devices', icon: Smartphone },
  { title: 'Android to Mac', path: '/android-to-mac', tag: 'Devices', icon: Laptop },
  { title: 'Send files by email', path: '/send-files-by-email', tag: 'Email', icon: Mail },
  { title: 'Create sharing links', path: '/create-file-sharing-link', tag: 'Links', icon: Link2 },
  { title: 'Request files from clients', path: '/file-request', tag: 'Workflow', icon: BookOpen },
  { title: 'Send files on WhatsApp', path: '/send-files-whatsapp', tag: 'India', icon: Mail },
  { title: 'WeTransfer alternative (India)', path: '/best-wetransfer-alternative-india', tag: 'Compare', icon: Scale },
  { title: 'QR device transfer', path: '/qr-transfer', tag: 'P2P', icon: QrCode },
  { title: 'Checksum verifier', path: '/checksum', tag: 'Trust', icon: Hash },
  { title: 'Security overview', path: '/security', tag: 'Trust', icon: ShieldCheck },
  { title: 'Full comparison', path: '/compare', tag: 'Compare', icon: Scale },
];

export default function ResourcesPage() {
  const [user, setUser] = useState(() => getStoredUser());
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col text-white relative overflow-hidden bg-[#07080d]">
      <div className="page-sky" aria-hidden="true" />
<Navbar
        user={user}
        onOpenAuth={(mode) => { setAuthMode(mode); setIsAuthOpen(true); }}
        onOpenProfile={() => setIsProfileOpen(true)}
      />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-16 z-10 relative">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h1 className="font-display text-4xl sm:text-5xl font-semibold text-white tracking-tight italic mb-3">
            Resources
          </h1>
          <p className="text-white/55 font-medium">
            Guides and tools to send files faster — every page links back to a free transfer.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
          {GUIDES.map((g) => {
            const Icon = g.icon;
            return (
              <Link
                key={g.path}
                to={g.path}
                className="custom-card p-5 hover:border-[#c4a574]/40 transition-colors group"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-[#c4a574]/12 text-[#c4a574] flex items-center justify-center">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-white/45">{g.tag}</span>
                </div>
                <h2 className="text-sm font-semibold text-white group-hover:text-[#c4a574] transition-colors mb-2">
                  {g.title}
                </h2>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#c4a574]">
                  Read <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </Link>
            );
          })}
        </div>

        <div className="text-center">
          <Link to="/" className="theme-btn-primary inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold">
            Transfer files free
            <ArrowRight className="w-4 h-4" />
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
