import { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import AuthModal from '../components/AuthModal';
import ProfileModal from '../components/ProfileModal';
import { getStoredUser, clearUserSession } from '../lib/authSession';
import {
  ShieldCheck, FileText, CheckCircle2, Lock, Globe,
  Server, UserCheck, Scale, Sparkles, Send, ArrowRight
} from 'lucide-react';

export default function CompliancePage() {
  const [user, setUser] = useState(() => getStoredUser());
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('signup');
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const complianceStandards = [
    {
      title: 'EU GDPR Compliant',
      desc: 'Full compliance with General Data Protection Regulation (GDPR) requirements including Article 17 (Right to Erasure) and Article 32 (Security of Processing).',
      badge: 'EU Standard',
    },
    {
      title: 'Zero AI Training Guarantee',
      desc: 'We strictly never use your uploaded files, customer records, or transfer metadata to train machine learning or AI models.',
      badge: 'Strict Policy',
    },
    {
      title: 'Encrypted Data at Rest & in Transit',
      desc: 'All data transferred through iTransfer is encrypted in transit using TLS 1.3 and stored with AES-256 server-side encryption.',
      badge: 'Cryptographic Standard',
    },
    {
      title: 'Automatic Ephemeral Data Purging',
      desc: 'Transfers automatically expire and are permanently wiped from all physical disks when their scheduled expiration date is reached.',
      badge: 'Zero Residuals',
    },
    {
      title: 'Regional Data Sovereignty',
      desc: 'Data routing through dedicated regional infrastructure in India (Mumbai), Europe (Frankfurt), and US East (Virginia) with strict residency controls.',
      badge: 'Multi-Region',
    },
    {
      title: 'Zero Mandatory Identity Tracking',
      desc: 'Send files without mandatory email registration or social logins. One-time link transfers require zero user profiling.',
      badge: 'Privacy First',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans text-slate-900 bg-dot-grid relative overflow-hidden">
      <div className="ambient-orb-1" />
      <div className="ambient-orb-3" />

      <Navbar
        user={user}
        onOpenAuth={(mode) => { setAuthMode(mode); setIsAuthOpen(true); }}
        onOpenProfile={() => setIsProfileOpen(true)}
      />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-16 z-10 relative">
        
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-14 animate-fadeIn">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold theme-bg-light theme-text mb-4 border border-indigo-100/80 shadow-2xs">
            <Scale className="w-3.5 h-3.5" /> Trust & Compliance Center
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight mb-4 leading-tight">
            Compliance, GDPR & Data Sovereignty
          </h1>
          <p className="text-base sm:text-lg text-slate-600 font-medium leading-relaxed">
            Discover how iTransfer safeguards enterprise privacy, satisfies international data protection laws, and guarantees zero AI exploitation.
          </p>
        </div>

        {/* Standards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-16">
          {complianceStandards.map((std, idx) => (
            <div key={idx} className="custom-card p-6 bg-white/90 space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  {std.badge}
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900">{std.title}</h3>
              <p className="text-sm text-slate-500 font-medium leading-relaxed">{std.desc}</p>
            </div>
          ))}
        </div>

        {/* Plain Language FAQ Accordion */}
        <div className="custom-card p-8 sm:p-10 bg-white/95 shadow-md mb-16 space-y-6">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight text-center">
            Enterprise Compliance Commitments
          </h2>

          <div className="space-y-4 text-sm text-slate-600 font-medium leading-relaxed">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1.5">
              <h4 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Does iTransfer share or sell uploaded files to third parties?
              </h4>
              <p>
                No. Never. Your data and uploaded assets are strictly your property. We do not inspect file contents, monetize user data, or share transfer links with any third-party marketing entities.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1.5">
              <h4 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                How are expired files deleted?
              </h4>
              <p>
                When a transfer expires or reaches its maximum download count, our automated database routines trigger an immediate cryptographic deletion across all active storage nodes.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1.5">
              <h4 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Can we sign a Data Processing Agreement (DPA) for our business?
              </h4>
              <p>
                Yes. Enterprise and Teams customers can request a signed standard contractual DPA covering EU/EEA and Indian data sovereignty standards. Contact support@iprudhvi.in.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center custom-card p-8 sm:p-12 bg-white/90 shadow-md">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mb-3">
            Transfer with verified security & compliance
          </h2>
          <p className="text-sm sm:text-base text-slate-600 max-w-md mx-auto mb-6 font-medium">
            Send client deliverables or confidential legal records with guaranteed privacy.
          </p>
          <Link
            to="/"
            className="theme-btn-primary px-7 py-3.5 text-sm font-bold shadow-md inline-flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            <span>Send Files Securely</span>
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
