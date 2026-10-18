import { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import SeoHead from '../components/SeoHead';
import AuthModal from '../components/AuthModal';
import ProfileModal from '../components/ProfileModal';
import { getStoredUser, clearUserSession } from '../lib/authSession';
import {
  HelpCircle, Search, Mail, MessageSquare, ShieldCheck,
  ChevronDown, Send, CheckCircle2, AlertCircle, Clock,
  FileQuestion, Sparkles, LifeBuoy, ArrowRight, Zap
} from 'lucide-react';

const FAQ_ITEMS = [
  {
    q: 'How do I send files with iTransfer without creating an account?',
    a: 'Simply drag and drop your files into the upload box on the homepage, select your preferred mode (Share Link, Device P2P, or Send Email), and click Send or Create Link. No registration or credit card is ever required for free transfers.',
    category: 'general',
  },
  {
    q: 'What is the maximum file size I can transfer?',
    a: 'A cloud transfer can be up to 6 GB with no account. Links last up to 7 days. Larger cloud transfers are not available yet. Device-to-device transfer stays on your own network and is not stored by iTransfer.',
    category: 'limits',
  },
  {
    q: 'Are my transfers secure and encrypted?',
    a: 'Yes. All data in transit is protected using TLS 1.3 encryption, and data stored in our cloud infrastructure is encrypted using AES-256 standards. You can also add a custom unlock password for extra security.',
    category: 'security',
  },
  {
    q: 'How long are my files stored before they expire?',
    a: 'You can choose 1 hour, 24 hours, 3 days, or 7 days. Longer retention is not available yet. When that time is reached, the link stops working.',
    category: 'storage',
  },
  {
    q: 'Can recipients preview files before downloading?',
    a: 'Yes! Recipients can preview images, stream videos, listen to audio files, read PDFs, and view text documents directly in their browser without downloading the full archive first.',
    category: 'features',
  },
  {
    a: 'Our Web Widget allows you to embed a custom file drop form on your own website using 1 line of HTML code. Clients can upload assets directly to your storage without leaving your site.',
    category: 'features',
  },
];

export default function HelpContactPage() {
  const [user, setUser] = useState(() => getStoredUser());
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [openFaq, setOpenFaq] = useState(0);
  const [ticketName, setTicketName] = useState('');
  const [ticketEmail, setTicketEmail] = useState(() => getStoredUser()?.email || '');
  const [ticketCategory, setTicketCategory] = useState('general');
  const [ticketMessage, setTicketMessage] = useState('');
  const [ticketSent, setTicketSent] = useState(false);

  const filteredFaqs = FAQ_ITEMS.filter(
    (item) =>
      item.q?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.a?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmitTicket = (e) => {
    e.preventDefault();
    if (!ticketEmail || !ticketMessage) return;
    setTicketSent(true);
  };

  return (
    <div className="min-h-screen flex flex-col text-white relative overflow-hidden bg-[#07080d]">
      <div className="page-sky" aria-hidden="true" />
<Navbar
        user={user}
        onOpenAuth={(m) => { setAuthMode(m); setIsAuthOpen(true); }}
        onOpenProfile={() => setIsProfileOpen(true)}
      />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-16 z-10 relative">
        <SeoHead
          customTitle="How to Send Large Files Online Free (Up to 6 GB, No Sign Up) — iTransfer Guide"
          customDescription="Step-by-step guide on how to send large files, heavy videos, and archives online for free without registration. Instant shareable link & direct P2P."
          customKeywords="how to send large files, how to transfer large files online, how to share files online securely for free, send heavy files online, send huge files online free"
          customCanonical="https://itransfer.iprudhvi.in/help"
        />

        {/* High-Converting Direct Transfer Banner */}
        <div className="custom-card p-5 sm:p-6 mb-10 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 text-white rounded-3xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-fadeIn">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
              <Zap className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-300 bg-amber-400/20 px-2.5 py-0.5 rounded-full inline-block mb-1">
                Zero Signup • Up to 6 GB
              </span>
              <h2 className="text-lg sm:text-xl font-semibold text-white">Want to send your large files right now?</h2>
              <p className="text-xs sm:text-sm text-indigo-100">Upload in seconds with instant link or email delivery. 100% free.</p>
            </div>
          </div>
          <Link
            to="/"
            className="w-full sm:w-auto px-6 py-3 bg-[#17192e] hover:bg-white/5 text-[#c4a574] rounded-2xl text-xs sm:text-sm font-semibold shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer hover:scale-102 shrink-0"
          >
            <span>Start Free Transfer</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-10 animate-fadeIn">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold theme-bg-light theme-text mb-4 border border-[#c4a574]/25/80 shadow-2xs">
            <LifeBuoy className="w-3.5 h-3.5" /> 24/7 Knowledge & Support Center
          </div>
          <h1 className="text-4xl sm:text-5xl font-semibold text-white tracking-tight mb-4 leading-tight">
            How can we help you?
          </h1>
          <p className="text-base sm:text-lg text-white/55 font-medium leading-relaxed mb-8">
            Find answers to frequently asked questions or submit an inquiry to our support team.
          </p>

          {/* Search Bar */}
          <div className="relative max-w-xl mx-auto">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-white/45" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search help topics, encryption, file limits..."
              className="w-full pl-12 pr-4 py-3.5 bg-[#17192e] border border-white/10 rounded-2xl text-sm font-medium focus:outline-none focus:border-indigo-500 shadow-sm"
            />
          </div>
        </div>

        {/* System Health Status Banner */}
        <div className="custom-card p-4 sm:p-5 mb-12 flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#17192e]">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <div>
              <p className="text-sm font-bold text-white">All iTransfer Systems Operational</p>
              <p className="text-xs text-white/45 font-medium">Core API, S3 Multi-Part Stream & P2P Signaler: 99.99% Uptime</p>
            </div>
          </div>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
            Realtime Verified
          </span>
        </div>

        {/* Main 2-Column: FAQs + Contact Form */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-16">
          
          {/* FAQ Column (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <h2 className="text-xl sm:text-2xl font-semibold text-white mb-4 flex items-center gap-2">
              <FileQuestion className="w-6 h-6 text-[#c4a574]" />
              <span>Frequently Asked Questions</span>
            </h2>

            <div className="space-y-3">
              {filteredFaqs.map((faq, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div
                    key={idx}
                    className="custom-card bg-[#17192e] transition-all overflow-hidden"
                  >
                    <button
                      onClick={() => setOpenFaq(isOpen ? -1 : idx)}
                      className="w-full p-5 text-left flex items-center justify-between gap-4 font-bold text-sm sm:text-base text-white hover:text-[#c4a574] transition-colors"
                    >
                      <span>{faq.q}</span>
                      <ChevronDown className={`w-5 h-5 text-white/45 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#c4a574]' : ''}`} />
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-5 text-sm text-white/55 font-medium leading-relaxed border-t border-white/10 pt-3 animate-fadeIn">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredFaqs.length === 0 && (
                <div className="custom-card p-8 text-center text-white/45 font-medium">
                  No matching help articles found for "{searchQuery}". Please send us a message below.
                </div>
              )}
            </div>
          </div>

          {/* Contact Support Form (5 cols) */}
          <div className="lg:col-span-5">
            <div className="custom-card p-6 sm:p-8 bg-[#17192e] sticky top-24">
              <h3 className="text-xl font-semibold text-white mb-1 flex items-center gap-2">
                <Mail className="w-5 h-5 text-[#c4a574]" />
                <span>Contact Support</span>
              </h3>
              <p className="text-xs sm:text-sm text-white/45 font-medium mb-6">
                Have a question or custom request? Our team responds within 2 hours.
              </p>

              {ticketSent ? (
                <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-3 animate-scale-in">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="text-base font-bold text-emerald-900">Message Received!</h4>
                  <p className="text-xs text-emerald-700 font-medium">
                    Thank you for reaching out. We have received your inquiry and will reply to <span className="font-bold">{ticketEmail}</span> shortly.
                  </p>
                  <button
                    onClick={() => { setTicketSent(false); setTicketMessage(''); }}
                    className="text-xs font-bold text-emerald-800 underline hover:no-underline pt-2 block"
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmitTicket} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-white/55 uppercase tracking-wider mb-1.5">
                      Your Name
                    </label>
                    <input
                      type="text"
                      value={ticketName}
                      onChange={(e) => setTicketName(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-white/55 uppercase tracking-wider mb-1.5">
                      Your Email <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={ticketEmail}
                      onChange={(e) => setTicketEmail(e.target.value)}
                      placeholder="jane@company.com"
                      className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-white/55 uppercase tracking-wider mb-1.5">
                      Inquiry Category
                    </label>
                    <select
                      value={ticketCategory}
                      onChange={(e) => setTicketCategory(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm font-bold text-white/55 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="general">General Support</option>
                      <option value="teams">iTransfer for Teams / Enterprise</option>
                      <option value="api">Developer API & Webhooks</option>
                      <option value="bug">Report a Bug</option>
                      <option value="billing">Billing & Invoices</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-white/55 uppercase tracking-wider mb-1.5">
                      Message <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      required
                      rows={4}
                      value={ticketMessage}
                      onChange={(e) => setTicketMessage(e.target.value)}
                      placeholder="Describe your question or issue in detail..."
                      className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-500 resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="theme-btn-primary w-full py-3.5 rounded-xl text-sm font-semibold shadow-md flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>Send Inquiry</span>
                  </button>
                </form>
              )}
            </div>
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
