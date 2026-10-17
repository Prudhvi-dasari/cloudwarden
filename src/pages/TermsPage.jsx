import { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import AuthModal from '../components/AuthModal';
import ProfileModal from '../components/ProfileModal';
import { getStoredUser } from '../lib/authSession';
import {
  FileText, ShieldCheck, Scale, Lock, Clock, HardDrive,
  CheckCircle2, AlertTriangle, ArrowRight, Mail, Globe, Zap
} from 'lucide-react';

export default function TermsPage() {
  const [user, setUser] = useState(() => getStoredUser());
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      
      <Navbar
        user={user}
        onOpenAuth={(mode) => { setAuthMode(mode); setIsAuthOpen(true); }}
        onOpenProfile={() => setIsProfileOpen(true)}
      />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-16">
        
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12 animate-fadeIn">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 mb-4 border border-indigo-100 shadow-2xs">
            <Scale className="w-3.5 h-3.5" /> Legal Terms & Service Agreement
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight mb-3">
            Terms & Conditions
          </h1>
          <p className="text-sm sm:text-base text-slate-600 font-medium">
            Last Updated: August 2026 • Please read these terms carefully before using iTransfer.
          </p>
        </div>

        {/* Content Sections */}
        <div className="space-y-8 bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/80 shadow-sm leading-relaxed text-sm sm:text-base text-slate-700">
          
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-black">1</span>
              Acceptance of Terms
            </h2>
            <p>
              By accessing, browsing, or using the iTransfer platform (accessible at <a href="https://itransfer.iprudhvi.in" className="text-indigo-600 font-bold underline">https://itransfer.iprudhvi.in</a>), mobile apps, web widgets, or APIs, you agree to be bound by these Terms and Conditions and our Privacy Policy. If you do not agree, you must immediately discontinue using the service.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-black">2</span>
              Service Description & Storage Limits
            </h2>
            <p>
              iTransfer provides high-speed, encrypted digital file transfer services through:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-600">
              <li><strong>Free Tier:</strong> Upload files up to 25 GB per transfer with standard cloud retention (up to 7 days).</li>
              <li><strong>Pro Tier:</strong> Unlimited transfers, extended expiration presets (up to 30 days or Permanent Vault), priority gigabit bandwidth, and custom vanity URL slugs.</li>
              <li><strong>Device P2P:</strong> Direct browser-to-browser WebRTC streaming with zero server retention for infinite transfer sizes.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-black">3</span>
              Automated File Expiration & Permanent Purge Policy
            </h2>
            <p>
              All files stored on our cloud infrastructure are automatically scheduled for permanent deletion based on the expiration period selected by the sender (e.g., 1 Hour, 24 Hours, 7 Days, or 30 Days).
            </p>
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs sm:text-sm flex items-start gap-3">
              <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Permanent Deletion Notice</p>
                <p className="mt-0.5 text-amber-800">
                  Once a transfer link reaches its expiration timestamp or max download limit, the files are permanently and irreversibly purged from our servers. iTransfer cannot recover expired files.
                </p>
              </div>
            </div>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-black">4</span>
              Zero Data Ownership & No AI Training Guarantee
            </h2>
            <p>
              You retain 100% full ownership, intellectual property rights, and copyright to all files, media, archives, and documents transferred through iTransfer. 
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-600">
              <li>iTransfer will <strong>never</strong> claim ownership of your uploaded files.</li>
              <li>We will <strong>never</strong> use your files to train, fine-tune, or evaluate artificial intelligence or machine learning models.</li>
              <li>Files are encrypted in transit via TLS 1.3 and at rest with AES-256 standards.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-black">5</span>
              Prohibited Uses & Content Guidelines
            </h2>
            <p>You agree not to use iTransfer to upload, store, or distribute:</p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-600">
              <li>Malware, viruses, trojans, ransomware, or malicious software.</li>
              <li>Child sexual abuse material (CSAM) or non-consensual exploitative imagery.</li>
              <li>Copyright-infringing content without authorization from the copyright holder.</li>
              <li>Phishing materials, automated spam bots, or illegal contraband.</li>
            </ul>
            <p className="text-xs text-slate-500">
              Violation of these rules will result in immediate termination of the transfer, account suspension, and reporting to law enforcement authorities where legally mandated.
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-black">6</span>
              Pro Subscriptions & Billing Policy
            </h2>
            <p>
              iTransfer PRO memberships are billed on a recurring monthly or annual basis as selected during checkout. Payments are processed securely via verified payment gateways (Stripe, UPI, or Credit/Debit Cards). You may cancel your subscription at any time via your Account Settings.
            </p>
          </section>

          {/* Section 7 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-black">7</span>
              Limitation of Liability
            </h2>
            <p>
              iTransfer is provided on an "AS IS" and "AS AVAILABLE" basis. While we maintain a 99.99% uptime target and enterprise server redundancy, iTransfer shall not be liable for any indirect, incidental, or consequential damages resulting from data loss, transmission interruptions, or expired transfers.
            </p>
          </section>

          {/* Section 8 */}
          <section className="space-y-3 pt-4 border-t border-slate-100">
            <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-black">8</span>
              Contact & Inquiries
            </h2>
            <p>
              If you have any questions or legal inquiries regarding these Terms and Conditions, please contact us at:
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                to="/contact"
                className="px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center gap-2 transition-colors"
              >
                <Mail className="w-4 h-4" />
                <span>Contact Legal Support</span>
              </Link>
              <Link
                to="/privacy"
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-2 transition-colors"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>View Privacy Policy</span>
              </Link>
            </div>
          </section>

        </div>

      </main>

      {isAuthOpen && (
        <AuthModal
          mode={authMode}
          onClose={() => setIsAuthOpen(false)}
          onSuccess={() => { setIsAuthOpen(false); setUser(getStoredUser()); }}
        />
      )}

      {isProfileOpen && (
        <ProfileModal
          user={user}
          onClose={() => setIsProfileOpen(false)}
        />
      )}

      <Footer />

    </div>
  );
}
