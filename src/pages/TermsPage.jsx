import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import PageFrame from '../components/PageFrame';
import AuthModal from '../components/AuthModal';
import ProfileModal from '../components/ProfileModal';
import { getStoredUser, clearUserSession } from '../lib/authSession';
import { Clock, Mail, ShieldCheck } from 'lucide-react';

const SECTIONS = [
  { id: 'acceptance', title: 'Acceptance of Terms' },
  { id: 'service', title: 'Service Description & Storage Limits' },
  { id: 'expiration', title: 'Automated File Expiration & Permanent Purge Policy' },
  { id: 'ownership', title: 'Zero Data Ownership & No AI Training Guarantee' },
  { id: 'prohibited', title: 'Prohibited Uses & Content Guidelines' },
  { id: 'billing', title: 'Subscriptions & Billing Policy' },
  { id: 'liability', title: 'Limitation of Liability' },
  { id: 'contact', title: 'Contact & Inquiries' },
];

const SHORT = {
  acceptance: 'Acceptance',
  service: 'Service and limits',
  expiration: 'Expiration',
  ownership: 'Ownership',
  prohibited: 'Prohibited uses',
  billing: 'Billing',
  liability: 'Liability',
  contact: 'Contact',
};

function Clause({ index, children }) {
  const { id, title } = SECTIONS[index];
  return (
    <section id={id} className="pgb-doc-section">
      <h2><span className="pgb-num">{String(index + 1).padStart(2, '0')}</span>{title}</h2>
      {children}
    </section>
  );
}

export default function TermsPage() {
  const [user, setUser] = useState(() => getStoredUser());
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [active, setActive] = useState(SECTIONS[0].id);
  const articleRef = useRef(null);

  useEffect(() => {
    if (!('IntersectionObserver' in window) || !articleRef.current) return undefined;
    const io = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActive(visible[0].target.id);
    }, { rootMargin: '-20% 0px -65% 0px' });
    articleRef.current.querySelectorAll('section[id]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <>
      <PageFrame
        user={user}
        onOpenAuth={(mode) => { setAuthMode(mode); setIsAuthOpen(true); }}
        onOpenProfile={() => setIsProfileOpen(true)}
        eyebrow="Legal terms and service agreement"
        title="Terms & Conditions"
        accent={1}
        subtitle="Last Updated: October 2026 • Please read these terms carefully before using SendToAnyone."
      >
        <div className="ds-chapters">
          <nav className="ds-toc" aria-label="Sections">
            <p>Sections</p>
            <ol>
              {SECTIONS.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className={active === s.id ? 'is-active' : ''}>
                    <span>{String(i + 1).padStart(2, '0')}</span>
                    {SHORT[s.id]}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <article ref={articleRef} className="ds-prose">
            <Clause index={0}>
              <p>
                By accessing, browsing, or using the SendToAnyone platform (accessible at <a href="https://sendtoanyone.com">https://sendtoanyone.com</a>), mobile apps, web widgets, or APIs, you agree to be bound by these Terms and Conditions and our Privacy Policy. If you do not agree, you must immediately discontinue using the service.
              </p>
            </Clause>

            <Clause index={1}>
              <p>SendToAnyone provides high-speed, encrypted digital file transfer services through:</p>
              <ul>
                <li><strong>Free transfers:</strong> Up to 6 GB per transfer, kept for at most 7 days. No account is required.</li>
                <li><strong>Creator:</strong> 50 GB per transfer, 200 GB stored, links up to 30 days.</li>
                <li><strong>Pro:</strong> 250 GB per transfer, 1 TB stored, links up to 180 days, and a logo on the download page.</li>
                <li><strong>Studio:</strong> 250 GB per transfer, 3 TB stored, links up to 1 year. A team workspace is not included yet.</li>
                <li><strong>Pass:</strong> One transfer up to 100 GB, kept 30 days. It does not change the account plan.</li>
                <li><strong>Device P2P:</strong> Direct browser-to-browser WebRTC streaming with zero server retention for infinite transfer sizes.</li>
              </ul>
            </Clause>

            <Clause index={2}>
              <p>
                Free files follow the expiry the sender chose, from 1 hour up to 7 days. Creator can keep a link for 30 days, Pro for 180 days, and Studio for 1 year. There is no permanent storage.
              </p>
              <div className="ds-callout is-warn">
                <Clock className="w-5 h-5 shrink-0 mt-0.5 text-[#8a5300]" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-[#060a12]">Permanent Deletion Notice</p>
                  <p className="mt-1">
                    Once a transfer link reaches its expiration timestamp or its maximum number of issued links, the files are permanently and irreversibly purged from our servers. SendToAnyone cannot recover expired files.
                  </p>
                </div>
              </div>
            </Clause>

            <Clause index={3}>
              <p>
                You retain 100% full ownership, intellectual property rights, and copyright to all files, media, archives, and documents transferred through SendToAnyone.
              </p>
              <ul>
                <li>SendToAnyone will <strong>never</strong> claim ownership of your uploaded files.</li>
                <li>We will <strong>never</strong> use your files to train, fine-tune, or evaluate artificial intelligence or machine learning models.</li>
                <li>A download password, when set, gates access to the file. It does not encrypt the file. These terms do not name a cipher for transit or storage.</li>
              </ul>
            </Clause>

            <Clause index={4}>
              <p>You agree not to use SendToAnyone to upload, store, or distribute:</p>
              <ul>
                <li>Malware, viruses, trojans, ransomware, or malicious software.</li>
                <li>Child sexual abuse material (CSAM) or non-consensual exploitative imagery.</li>
                <li>Copyright-infringing content without authorization from the copyright holder.</li>
                <li>Phishing materials, automated spam bots, or illegal contraband.</li>
              </ul>
              <p className="text-[0.9375rem] text-[#6b7486]">
                Violation of these rules will result in immediate termination of the transfer, account suspension, and reporting to law enforcement authorities where legally mandated.
              </p>
            </Clause>

            <Clause index={5}>
              <p>
                Creator (₹299 per month), Pro (₹799 per month or ₹7,999 per year), and Studio (₹2,499 per month) are billed through Dodo Payments at the prices shown before checkout. A Pass, when offered, is ₹149 for one transfer and does not change the account plan. The plan starts after the server confirms the payment. An existing Pro subscription keeps the price already billed. Free transfers stay free, with no recurring fee. Studio does not include a shared team workspace yet.
              </p>
            </Clause>

            <Clause index={6}>
              <p>
                SendToAnyone is provided on an &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE&rdquo; basis. SendToAnyone shall not be liable for any indirect, incidental, or consequential damages resulting from data loss, transmission interruptions, or expired transfers.
              </p>
            </Clause>

            <Clause index={7}>
              <p>
                If you have any questions or legal inquiries regarding these Terms and Conditions, please contact us at:
              </p>
            </Clause>
          </article>

          <div className="lg:col-start-2 -mt-8 lg:-mt-12 flex flex-wrap gap-3">
            <Link to="/help" className="ds-btn ds-btn-dark">
              <Mail className="w-4 h-4" aria-hidden="true" />
              Contact Legal Support
            </Link>
            <Link to="/privacy" className="ds-btn ds-btn-ghost">
              <ShieldCheck className="w-4 h-4" aria-hidden="true" />
              View Privacy Policy
            </Link>
          </div>
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
