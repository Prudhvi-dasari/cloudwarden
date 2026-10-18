import { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import AuthModal from '../components/AuthModal';
import ProfileModal from '../components/ProfileModal';
import { getStoredUser, clearUserSession } from '../lib/authSession';
import {
  Smartphone, Laptop, Globe, Mail, Terminal, Download,
  Sparkles, CheckCircle2, ArrowRight, ShieldCheck, Zap
} from 'lucide-react';

export default function AppsPage() {
  const [user, setUser] = useState(() => getStoredUser());
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const appsList = [
    {
      icon: Globe,
      platform: 'Web Application',
      title: 'iTransfer Web',
      desc: 'Instant browser access from any device. No installation or registration required for one-time file transfers.',
      status: 'Live & Active',
      action: 'Open Web App',
      link: '/',
    },
    {
      icon: Mail,
      platform: 'Email Plugin',
      title: 'Outlook & Gmail Add-In',
      desc: 'Send heavy attachments directly from your compose window, bypassing 25 MB email server limits automatically.',
      status: 'Not available',
      action: 'Learn More',
      link: '/send-files-by-email',
    },
    {
      icon: Laptop,
      platform: 'macOS & Windows',
      title: 'Desktop Menu Bar & Tray',
      desc: 'Drag and drop files to your menu bar or system tray to generate instant shareable links in seconds.',
      status: 'Not available',
      action: 'Explore Features',
      link: '/features',
    },
    {
      icon: Smartphone,
      platform: 'iOS & Android',
      title: 'Mobile P2P Client',
      desc: 'High-speed wireless file streaming between phones and computers via camera QR code scanning.',
      status: 'Live in Browser',
      action: 'Try Device Transfer',
      link: '/?mode=device',
    },
    {
      icon: Terminal,
      platform: 'Developer CLI & SDK',
      title: 'iTransfer CLI',
      desc: 'Upload files and pipe stdout directly from terminal scripts, CI/CD pipelines, and automated server jobs.',
      status: 'Not available',
      action: 'Not available',
      link: null,
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

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-16 z-10 relative">
        
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-14 animate-fadeIn">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold theme-bg-light theme-text mb-3 border border-[#c4a574]/25/80 shadow-2xs">
            <Smartphone className="w-3.5 h-3.5" /> Multi-Platform Ecosystem
          </div>
          <h1 className="text-3xl sm:text-5xl font-semibold text-white tracking-tight mb-3">
            Transfer from any tool, anywhere.
          </h1>
          <p className="text-sm sm:text-base text-white/55 font-medium leading-relaxed">
            The website and same-network device transfer work in the browser. Desktop apps, email plugins, and a command-line tool are not available.
          </p>
        </div>

        {/* Grid of Apps */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {appsList.map((app, idx) => {
            const Icon = app.icon;
            return (
              <div key={idx} className="custom-card p-5 bg-[#17192e] space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-9 h-9 rounded-xl bg-[#c4a574]/12 text-[#c4a574] flex items-center justify-center">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${app.status === 'Not available' ? 'bg-white/10 text-white/60 border-white/15' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                      {app.status}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-white/45 uppercase tracking-wider">{app.platform}</span>
                  <h3 className="text-sm font-bold text-white mt-0.5 mb-1">{app.title}</h3>
                  <p className="text-xs text-white/45 font-medium leading-relaxed">{app.desc}</p>
                </div>

                {app.link ? (
                  <Link
                    to={app.link}
                    className="inline-flex items-center gap-1 text-xs font-bold theme-text pt-2 border-t border-white/10 hover:underline"
                  >
                    <span>{app.action}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                ) : (
                  <p className="text-xs text-white/45 pt-2 border-t border-white/10">Not available</p>
                )}
              </div>
            );
          })}
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
