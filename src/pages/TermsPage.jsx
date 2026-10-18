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
    <div className="min-h-screen flex flex-col text-white relative overflow-hidden bg-[#07080d]">
      <div className="page-sky" aria-hidden="true" />
      
      <Navbar
        user={user}
        onOpenAuth={(mode) => { setAuthMode(mode); setIsAuthOpen(true); }}
        onOpenProfile={() => setIsProfileOpen(true)}
      />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-16">
        
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12 animate-fadeIn">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#c4a574]/12 text-[#c4a574] mb-4 border border-[#c4a574]/25 shadow-2xs">
            <Scale className="w-3.5 h-3.5" /> Legal Terms & Service Agreement
          </div>
          <h1 className="text-3xl sm:text-5xl font-semibold text-white tracking-tight mb-3">
            Terms & Conditions
          </h1>
          <p className="text-sm sm:text-base text-white/55 font-medium">
            Last Updated: August 2026 • Please read these terms carefully before using iTransfer.
          </p>
        </div>

        {/* Content Sections */}
        <div className="space-y-8 bg-[#17192e] rounded-3xl p-6 sm:p-10 border border-white/10/80 shadow-sm leading-relaxed text-sm sm:text-base text-white/55">
          
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-semibold text-white flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-[#c4a574]/12 text-[#c4a574] flex items-center justify-center text-xs font-semibold">1</span>
              Acceptance of Terms
            </h2>
            <p>
              By accessing, browsing, or using the iTransfer platform (accessible at <a href="https://itransfer.iprudhvi.in" className="text-[#c4a574] font-bold underline">https://itransfer.iprudhvi.in</a>), mobile apps, web widgets, or APIs, you agree to be bound by these Terms and Conditions and our Privacy Policy. If you do not agree, you must immediately discontinue using the service.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-semibold text-white flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-[#c4a574]/12 text-[#c4a574] flex items-center justify-center text-xs font-semibold">2</span>
              Service Description & Storage Limits
            </h2>
            <p>
              iTransfer provides high-speed, encrypted digital file transfer services through:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-white/55">
              <li><strong>Free transfers:</strong> Up to 6 GB per transfer, kept for at most 7 days. No account is required.</li>
              <li><strong>Larger plans:</strong> Not available yet. Paying does not raise the 6 GB limit or the 7-day expiry.</li>
              <li><strong>Device P2P:</strong> Direct browser-to-browser WebRTC streaming with zero server retention for infinite transfer sizes.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-semibold text-white flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-[#c4a574]/12 text-[#c4a574] flex items-center justify-center text-xs font-semibold">3</span>
              Automated File Expiration & Permanent Purge Policy
            </h2>
            <p>
              Stored files follow the expiry the sender chose, from 1 hour up to 7 days. Longer retention is not available yet.
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
            <h2 className="text-lg sm:text-xl font-semibold text-white flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-[#c4a574]/12 text-[#c4a574] flex items-center justify-center text-xs font-semibold">4</span>
              Zero Data Ownership & No AI Training Guarantee
            </h2>
            <p>
              You retain 100% full ownership, intellectual property rights, and copyright to all files, media, archives, and documents transferred through iTransfer. 
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-white/55">
              <li>iTransfer will <strong>never</strong> claim ownership of your uploaded files.</li>
              <li>We will <strong>never</strong> use your files to train, fine-tune, or evaluate artificial intelligence or machine learning models.</li>
              <li>Files are encrypted in transit via TLS 1.3 and at rest with AES-256 standards.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-semibold text-white flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-[#c4a574]/12 text-[#c4a574] flex items-center justify-center text-xs font-semibold">5</span>
              Prohibited Uses & Content Guidelines
            </h2>
            <p>You agree not to use iTransfer to upload, store, or distribute:</p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-white/55">
              <li>Malware, viruses, trojans, ransomware, or malicious software.</li>
              <li>Child sexual abuse material (CSAM) or non-consensual exploitative imagery.</li>
              <li>Copyright-infringing content without authorization from the copyright holder.</li>
              <li>Phishing materials, automated spam bots, or illegal contraband.</li>
            </ul>
            <p className="text-xs text-white/45">
              Violation of these rules will result in immediate termination of the transfer, account suspension, and reporting to law enforcement authorities where legally mandated.
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-semibold text-white flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-[#c4a574]/12 text-[#c4a574] flex items-center justify-center text-xs font-semibold">6</span>
              Pro Subscriptions & Billing Policy
            </h2>
            <p>
              iTransfer PRO memberships are billed on a recurring monthly or annual basis as selected during checkout. Payments are processed securely via verified payment gateways (Stripe, UPI, or Credit/Debit Cards). You may cancel your subscription at any time via your Account Settings.
            </p>
          </section>

          {/* Section 7 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-semibold text-white flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-[#c4a574]/12 text-[#c4a574] flex items-center justify-center text-xs font-semibold">7</span>
              Limitation of Liability
            </h2>
            <p>
              iTransfer is provided on an "AS IS" and "AS AVAILABLE" basis. While we maintain a 99.99% uptime target and enterprise server redundancy, iTransfer shall not be liable for any indirect, incidental, or consequential damages resulting from data loss, transmission interruptions, or expired transfers.
            </p>
          </section>

          {/* Section 8 */}
          <section className="space-y-3 pt-4 border-t border-white/10">
            <h2 className="text-lg sm:text-xl font-semibold text-white flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-[#c4a574]/12 text-[#c4a574] flex items-center justify-center text-xs font-semibold">8</span>
              Contact & Inquiries
            </h2>
            <p>
              If you have any questions or legal inquiries regarding these Terms and Conditions, please contact us at:
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                to="/contact"
                className="px-4 py-2 rounded-xl bg-[#c4a574]/12 hover:bg-indigo-100 text-[#c4a574] font-bold text-xs flex items-center gap-2 transition-colors"
              >
                <Mail className="w-4 h-4" />
                <span>Contact Legal Support</span>
              </Link>
              <Link
                to="/privacy"
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-slate-200 text-white/55 font-bold text-xs flex items-center gap-2 transition-colors"
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

      
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pb-12">
        <div className="pt-8 border-t border-white/10">
          <Link to="/" className="inline-flex items-center gap-2 rounded-full bg-white text-black text-sm font-semibold px-5 py-3 hover:bg-white/90">
            Send a file
          </Link>
        </div>
      </div>

      <Footer />

    </div>
  );
}
