import { useState } from 'react';
import { Link } from 'react-router-dom';
import PageFrame from '../components/PageFrame';
import SeoHead from '../components/SeoHead';
import AuthModal from '../components/AuthModal';
import ProfileModal from '../components/ProfileModal';
import { getStoredUser, clearUserSession } from '../lib/authSession';
import { Activity, ArrowRight, CheckCircle2, Mail, Search, Send } from 'lucide-react';

const SUPPORT_EMAIL = 'send@iprudhvi.in';

const FAQ_ITEMS = [
  {
    q: 'How do I send files with SendToAnyone without creating an account?',
    a: 'Drop your files into the upload box on the home page. Pick Link, Email, or Device, then press the button to create the link or send it. No account or card is needed on the free plan.',
    category: 'general',
  },
  {
    q: 'What is the maximum file size I can transfer?',
    a: 'A cloud transfer can be up to 6 GB with no account. Links last up to 7 days. Creator is 50 GB and 30 days, Pro is 250 GB and 180 days, and Studio is 250 GB and 1 year. Device-to-device transfer goes between two browsers and is not stored by SendToAnyone.',
    category: 'limits',
  },
  {
    q: 'Are my transfers secure and encrypted?',
    a: 'Files travel over HTTPS and are stored on Cloudflare R2. A password can gate the download. The server stores a salted hash of it, the email does not include it, and the password does not encrypt the file.',
    category: 'security',
  },
  {
    q: 'How long are my files stored before they expire?',
    a: 'On the free plan you choose 1 hour, 24 hours, 3 days, or 7 days. Creator can keep a link for 30 days, Pro for 180 days, and Studio for 1 year. When the time is reached, the link stops working and a scheduled cleanup deletes the files.',
    category: 'storage',
  },
  {
    q: 'Can recipients preview files before downloading?',
    a: 'Yes. Images, video, audio, and PDFs open in the browser from the download page.',
    category: 'features',
  },
  {
    q: 'How does Pro billing work?',
    a: 'Creator is ₹299 a month. Pro is ₹799 a month or ₹7,999 a year. Studio is ₹2,499 a month. A Pass is ₹149 for one transfer. Checkout runs through Dodo Payments, and the plan starts after Dodo confirms the payment to our server. An existing Pro subscription keeps its current price.',
    category: 'billing',
  },
  {
    q: 'Can I embed an upload box on my own website?',
    a: 'Not as a hosted widget. Make a request link, then put a button on your site that opens it. The widget page builds that button for you.',
    category: 'features',
  },
];

const CATEGORIES = [
  ['general', 'General question'],
  ['bug', 'Report a bug'],
  ['billing', 'Billing and Pro'],
  ['teams', 'Teams'],
  ['api', 'API or widget'],
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

  const query = searchQuery.trim().toLowerCase();
  const filteredFaqs = FAQ_ITEMS.filter(
    (item) => item.q.toLowerCase().includes(query) || item.a.toLowerCase().includes(query)
  );

  const handleSubmitTicket = (e) => {
    e.preventDefault();
    if (!ticketEmail || !ticketMessage) return;
    const categoryLabel = CATEGORIES.find(([value]) => value === ticketCategory)?.[1] || 'General question';
    const subject = `[SendToAnyone] ${categoryLabel}`;
    const body = `${ticketMessage}\n\n— ${ticketName || 'No name given'}\nReply to: ${ticketEmail}`;
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setTicketSent(true);
  };

  return (
    <>
      <SeoHead
        customTitle="How to Send Large Files Online Free (Up to 6 GB, No Sign Up) — SendToAnyone Guide"
        customDescription="Step-by-step guide on how to send large files, heavy videos, and archives online for free without registration. Instant shareable link & direct P2P."
        customKeywords="how to send large files, how to transfer large files online, how to share files online securely for free, send heavy files online, send huge files online free"
        customCanonical="https://sendtoanyone.com/help"
      />
      <PageFrame
        user={user}
        onOpenAuth={(m) => { setAuthMode(m); setIsAuthOpen(true); }}
        onOpenProfile={() => setIsProfileOpen(true)}
        eyebrow="Help and contact"
        title="How can we help you?"
        accent={2}
        subtitle="Short answers about sending, links, and expiry. Search them below, or write to the people who run SendToAnyone."
        actions={(
          <div className="ds-input-wrap pgb-search">
            <Search aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setOpenFaq(0); }}
              placeholder="Search: size, password, expiry…"
              className="ds-input"
              aria-label="Search help topics"
            />
          </div>
        )}
      >
        <div className="flex flex-wrap gap-2" data-reveal>
          <Link to="/" className="ds-chip">
            <Send className="w-3.5 h-3.5" aria-hidden="true" />
            Send up to 6 GB free, no account
          </Link>
          <Link to="/status" className="ds-chip">
            <Activity className="w-3.5 h-3.5" aria-hidden="true" />
            Check the file API on the status page
          </Link>
        </div>

        <div className="pgb-help">
          <section aria-labelledby="faq-title">
            <h2 id="faq-title" className="ds-h2 text-[clamp(1.5rem,2.6vw,2rem)]" data-reveal>Frequently asked questions</h2>

            <ul className="ds-faq-list mt-6" data-reveal style={{ '--d': '60ms' }}>
              {filteredFaqs.map((faq, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <li key={faq.q} className={`ds-faq-item ${isOpen ? 'is-open' : ''}`}>
                    <button
                      type="button"
                      className="ds-faq-q"
                      onClick={() => setOpenFaq(isOpen ? -1 : idx)}
                      aria-expanded={isOpen}
                      aria-controls={`help-a-${idx}`}
                    >
                      <span>{faq.q}</span>
                      <span className="ds-faq-plus" aria-hidden="true" />
                    </button>
                    <div id={`help-a-${idx}`} className="ds-faq-a" role="region">
                      <div><p>{faq.a}</p></div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {filteredFaqs.length === 0 && (
              <div className="ds-empty ds-card-soft mt-6">
                <h3>No answer matches “{searchQuery}”.</h3>
                <p>Write to us with the contact form.</p>
              </div>
            )}
          </section>

          <aside className="pgb-help-aside" aria-labelledby="contact-title">
            <div className="ds-panel ds-panel-pad" data-reveal style={{ '--d': '100ms' }}>
              <div className="flex items-center gap-3">
                <span className="ds-icon is-blue"><Mail aria-hidden="true" /></span>
                <h2 id="contact-title" className="ds-h3 text-[1.3rem]">Contact support</h2>
              </div>
              <p className="mt-2 text-[0.9375rem] text-[#6b7486]">
                The form opens your mail app with the message ready to send to <span className="font-semibold text-[#060a12] break-all">{SUPPORT_EMAIL}</span>.
              </p>

              {ticketSent ? (
                <div className="mt-6 space-y-4" role="status">
                  <div className="ds-alert is-success">
                    <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Your mail app should be open with the message. Press send there to reach us.</span>
                  </div>
                  <p className="text-[0.875rem] text-[#6b7486]">
                    Nothing opened? Email <a href={`mailto:${SUPPORT_EMAIL}`} className="ds-link">{SUPPORT_EMAIL}</a> directly.
                  </p>
                  <button
                    type="button"
                    onClick={() => { setTicketSent(false); setTicketMessage(''); }}
                    className="ds-btn ds-btn-ghost ds-btn-sm"
                  >
                    Write another message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmitTicket} className="mt-6 space-y-4">
                  <div className="ds-field">
                    <label className="ds-label" htmlFor="help-name">Your name</label>
                    <input
                      id="help-name"
                      type="text"
                      value={ticketName}
                      onChange={(e) => setTicketName(e.target.value)}
                      placeholder="Jane Doe"
                      autoComplete="name"
                      className="ds-input"
                    />
                  </div>

                  <div className="ds-field">
                    <label className="ds-label" htmlFor="help-email">Your email <span className="text-[#b42318]">*</span></label>
                    <input
                      id="help-email"
                      type="email"
                      required
                      value={ticketEmail}
                      onChange={(e) => setTicketEmail(e.target.value)}
                      placeholder="jane@company.com"
                      autoComplete="email"
                      className="ds-input"
                    />
                  </div>

                  <div className="ds-field">
                    <label className="ds-label" htmlFor="help-category">Topic</label>
                    <select
                      id="help-category"
                      value={ticketCategory}
                      onChange={(e) => setTicketCategory(e.target.value)}
                      className="ds-select"
                    >
                      {CATEGORIES.map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="ds-field">
                    <label className="ds-label" htmlFor="help-message">Message <span className="text-[#b42318]">*</span></label>
                    <textarea
                      id="help-message"
                      required
                      rows={5}
                      value={ticketMessage}
                      onChange={(e) => setTicketMessage(e.target.value)}
                      placeholder="What happened, and what did you expect?"
                      className="ds-textarea"
                    />
                    <p className="ds-hint">Do not paste download passwords here.</p>
                  </div>

                  <button type="submit" className="ds-btn ds-btn-dark w-full">
                    Open in my mail app
                    <ArrowRight className="ds-btn-arrow w-4 h-4" aria-hidden="true" />
                  </button>
                </form>
              )}
            </div>
          </aside>
        </div>
      </PageFrame>

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
    </>
  );
}
