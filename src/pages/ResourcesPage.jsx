import { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import AuthModal from '../components/AuthModal';
import ProfileModal from '../components/ProfileModal';
import { getStoredUser, clearUserSession } from '../lib/authSession';
import {
  BookOpen, Video, Smartphone, Laptop, Mail, Link2,
  ShieldCheck, ArrowRight, Sparkles, Send, HelpCircle, FileText
} from 'lucide-react';

export default function ResourcesPage() {
  const [user, setUser] = useState(() => getStoredUser());
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(() => getStoredUser()?.user_metadata?.theme || 'indigo');

  const guides = [
    {
      title: 'How to Send Large Video Files Without Compression',
      desc: 'Learn how to share 4K videos, ProRes files, and wedding footage without quality loss or file size limits.',
      path: '/send-large-video',
      tag: 'Video & Media',
      icon: Video,
    },
    {
      title: 'Transfer Files Between iPhone and Windows PC',
      desc: 'Seamlessly send photos, videos, and PDFs between iOS devices and Windows computers without cables or iTunes.',
      path: '/iphone-to-windows',
      tag: 'Cross-Platform',
      icon: Smartphone,
    },
    {
      title: 'Transfer Files Between Android and Mac',
      desc: 'Overcome Android File Transfer bugs and wirelessly stream high-res files straight into macOS Finder.',
      path: '/android-to-mac',
      tag: 'Cross-Platform',
      icon: Laptop,
    },
    {
      title: 'How to Send Files by Email Without 25MB Limits',
      desc: 'Bypass Gmail, Outlook, and Apple Mail attachment restrictions with automated high-speed email dispatch.',
      path: '/send-files-by-email',
      tag: 'Email Delivery',
      icon: Mail,
    },
    {
      title: 'Create Secure Shareable Download Links',
      desc: 'Best practices for setting custom expiration dates, password protection, and tracking link downloads.',
      path: '/create-file-sharing-link',
      tag: 'Security & Links',
      icon: Link2,
    },
    {
      title: 'How to Collect & Request Files from Clients',
      desc: 'Create secure upload portals and drop links so clients can send large files directly to your storage without signing up.',
      path: '/file-request',
      tag: 'Client Workflow',
      icon: BookOpen,
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

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-16 z-10 relative">
        
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-14 animate-fadeIn">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold theme-bg-light theme-text mb-4 border border-indigo-100/80 shadow-2xs">
            <BookOpen className="w-3.5 h-3.5" /> Transfer Guides & Knowledge Hub
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight mb-4 leading-tight">
            Guides & Best Practices
          </h1>
          <p className="text-base sm:text-lg text-slate-600 font-medium leading-relaxed">
            Practical walkthroughs for fast, secure file transfers across any device, operating system, and file format.
          </p>
        </div>

        {/* Guides List */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {guides.map((guide, idx) => {
            const Icon = guide.icon;
            return (
              <Link
                key={idx}
                to={guide.path}
                className="custom-card p-6 bg-white/85 hover:bg-white transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-3.5">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                      {guide.tag}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 mb-1.5 group-hover:text-indigo-600 transition-colors">
                    {guide.title}
                  </h3>

                  <p className="text-sm text-slate-500 font-medium leading-relaxed mb-4">
                    {guide.desc}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 group-hover:translate-x-1 transition-transform">
                  <span>Read Guide</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </Link>
            );
          })}
        </div>

        {/* CTA Banner */}
        <div className="mt-14 custom-card p-8 sm:p-12 text-center bg-white/90 shadow-md">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mb-3">
            Need custom help with your transfer workflow?
          </h2>
          <p className="text-sm sm:text-base text-slate-600 max-w-md mx-auto mb-6 font-medium">
            Explore our Help Center or contact our 24/7 technical team.
          </p>
          <div className="flex flex-wrap justify-center gap-3.5">
            <Link
              to="/help"
              className="theme-btn-primary px-7 py-3.5 text-sm font-bold shadow-md inline-flex items-center gap-2"
            >
              <HelpCircle className="w-4 h-4" />
              <span>Visit Help Center</span>
            </Link>
            <Link
              to="/"
              className="px-7 py-3.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-sm font-bold transition-colors"
            >
              <span>Send Files Now</span>
            </Link>
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
        currentTheme={currentTheme}
        onThemeChange={(t) => setCurrentTheme(t)}
      />
    </div>
  );
}
