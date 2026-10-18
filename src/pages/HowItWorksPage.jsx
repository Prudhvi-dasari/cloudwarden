import { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import AuthModal from '../components/AuthModal';
import ProfileModal from '../components/ProfileModal';
import { getStoredUser, clearUserSession } from '../lib/authSession';
import {
  Send, UploadCloud, Link2, Mail, ShieldCheck, Clock,
  ArrowRight, Smartphone, Laptop, Sparkles, CheckCircle2,
  Lock, Eye, RefreshCw, Zap
} from 'lucide-react';

export default function HowItWorksPage() {
  const [user, setUser] = useState(() => getStoredUser());
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('signup');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(1);

  const steps = [
    {
      number: 1,
      title: 'Choose your transfer mode & select files',
      desc: 'Drag and drop files or folders up to 6 GB. Choose a device transfer, a share link, or email delivery.',
      icon: UploadCloud,
      detail: 'No software installation required. Drag files directly into the browser.',
    },
    {
      number: 2,
      title: 'Configure security, passwords & expiry',
      desc: 'Choose an expiry from 1 hour up to 7 days and add a password. Longer retention is not available yet.',
      icon: Lock,
      detail: 'Files are client-encrypted with AES-256 before streaming to high-speed storage.',
    },
    {
      number: 3,
      title: 'Share the link or let iTransfer notify recipients',
      desc: 'Copy the generated short link, scan the QR code from your smartphone, or let our automated mailer deliver high-priority inbox download links.',
      icon: Link2,
      detail: 'Recipients download at uncapped gigabit speeds with zero mandatory signup.',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col text-white relative overflow-hidden bg-[#07080d]">
      <div className="page-sky" aria-hidden="true" />
<Navbar user={user} onOpenAuth={onOpenAuth} onOpenProfile={onOpenProfile} />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-16 z-10 relative">
        
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12 animate-fadeIn">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold theme-bg-light theme-text mb-4 border border-[#c4a574]/25/80 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5" /> Simple, Fast & Secure
          </div>
          <h1 className="text-4xl sm:text-5xl font-semibold text-white tracking-tight mb-4 leading-tight">
            How iTransfer Works
          </h1>
          <p className="text-base sm:text-lg text-white/55 font-medium leading-relaxed">
            Sending large files has never been this effortless. Learn how our multi-mode file transfer engine connects your data securely.
          </p>
        </div>

        {/* 3 Step Interactive Walkthrough */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {steps.map((step) => {
            const Icon = step.icon;
            const isActive = activeStep === step.number;
            return (
              <div
                key={step.number}
                onClick={() => setActiveStep(step.number)}
                className={`custom-card p-6 sm:p-7 cursor-pointer transition-all duration-200 relative overflow-hidden ${
                  isActive ? 'ring-2 ring-indigo-500 shadow-md bg-white' : 'hover:bg-[#17192e] bg-white/70'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-semibold text-base ${
                    isActive ? 'theme-btn-primary' : 'bg-white/5 text-white/55'
                  }`}>
                    {step.number}
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-[#c4a574]/12 text-[#c4a574] flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                </div>

                <h3 className="text-lg font-bold text-white mb-2 tracking-tight">
                  {step.title}
                </h3>

                <p className="text-sm text-white/55 leading-relaxed font-medium mb-4">
                  {step.desc}
                </p>

                <div className="pt-3 border-t border-white/10 flex items-center gap-1.5 text-xs text-[#c4a574] font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{step.detail}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Transfer Methods Deep Dive */}
        <div className="custom-card p-8 sm:p-10 mb-16 bg-[#17192e]">
          <h2 className="text-2xl sm:text-3xl font-semibold text-white mb-6 text-center tracking-tight">
            Choose the Perfect Method for Every Situation
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10/80 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-[#c4a574] flex items-center justify-center font-bold">
                <Link2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Shareable Links</h3>
              <p className="text-sm text-white/55 font-medium leading-relaxed">
                Best for sending files in Slack, WhatsApp, Teams, or client project portals. Upload once and share the short link with anyone.
              </p>
              <ul className="space-y-1.5 text-xs font-semibold text-white/55 pt-2">
                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Up to 6 GB per transfer</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Instant QR code generation</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Optional password protection</li>
              </ul>
            </div>

            <div className="p-5 rounded-2xl bg-white/5 border border-white/10/80 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Device P2P Streaming</h3>
              <p className="text-sm text-white/55 font-medium leading-relaxed">
                Best for moving files between your phone and laptop on the same Wi-Fi. Files stream directly with 0 server storage.
              </p>
              <ul className="space-y-1.5 text-xs font-semibold text-white/55 pt-2">
                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Unlimited file size</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> WebRTC P2P direct protocol</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> 100% private & zero trace</li>
              </ul>
            </div>

            <div className="p-5 rounded-2xl bg-white/5 border border-white/10/80 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <Mail className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Inbox Email Delivery</h3>
              <p className="text-sm text-white/55 font-medium leading-relaxed">
                Best for sending client deliverables directly to work inboxes without worrying about standard 25MB attachment limits.
              </p>
              <ul className="space-y-1.5 text-xs font-semibold text-white/55 pt-2">
                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Up to 50 recipients per transfer</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Custom subject & message</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Delivery & open confirmations</li>
              </ul>
            </div>

          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 text-white rounded-3xl p-8 sm:p-12 shadow-xl">
          <h2 className="text-3xl sm:text-4xl font-semibold mb-3 tracking-tight">
            Ready to transfer files faster?
          </h2>
          <p className="text-base sm:text-lg text-indigo-100 max-w-xl mx-auto mb-6 font-medium">
            Send your first transfer now. No credit card, no registration required.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 bg-[#17192e] text-indigo-900 hover:bg-white/5 font-semibold text-base px-8 py-3.5 rounded-2xl shadow-lg transition-transform hover:scale-105"
          >
            <span>Start Transferring Now</span>
            <ArrowRight className="w-5 h-5" />
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
