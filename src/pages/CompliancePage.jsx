import { useState } from 'react';
import { Link } from 'react-router-dom';
import PageFrame from '../components/PageFrame';
import AuthModal from '../components/AuthModal';
import ProfileModal from '../components/ProfileModal';
import { getStoredUser, clearUserSession } from '../lib/authSession';
import {
  ArrowRight, Ban, BrainCircuit, Clock, FileX2, Globe, KeyRound, UserCheck,
} from 'lucide-react';

const complianceStandards = [
  {
    icon: FileX2,
    title: 'Not a certification',
    desc: 'This page does not certify SendToAnyone against GDPR or any other standard. There is no signed data-processing agreement to request.',
    badge: 'No certificate',
  },
  {
    icon: BrainCircuit,
    title: 'Files are not a training set here',
    desc: 'The terms say uploaded files are not used to train models. That is a policy line, not an audit.',
    badge: 'Policy',
  },
  {
    icon: KeyRound,
    title: 'No named cipher',
    desc: 'A download password, when you set one, gates the download. It does not encrypt the file. This page does not name a cipher for transit or storage.',
    badge: 'Password gate',
  },
  {
    icon: Clock,
    title: 'Expiry refuses the download',
    desc: 'When the time you picked is up, the download is refused. Cleanup removes expired files. The longest cloud link is 7 days.',
    badge: 'Up to 7 days',
  },
  {
    icon: Globe,
    title: 'No region picker',
    desc: 'The app does not offer a choice of country or data-residency region.',
    badge: 'No residency control',
  },
  {
    icon: UserCheck,
    title: 'No account required to send',
    desc: 'A cloud transfer can be sent without an account. The cap is 6 GB. Email is optional and only carries the link.',
    badge: '6 GB',
  },
];

const HANDLING = [
  ['Where files are kept', "Cloudflare R2, on Cloudflare's global network"],
  ['In transit', 'HTTPS (TLS) between your browser and the service'],
  ['Download password', 'Stored as a SHA-256 hash. Gates the download. Does not encrypt the file.'],
  ['After expiry', 'The download is refused. A scheduled cleanup deletes the files.'],
  ['Device transfer', 'WebRTC between two browsers. The file is not stored.'],
  ['Executable files', 'Blocked by file type on upload'],
  ['Download pages', 'Marked noindex for search engines'],
];

const PROMISES = [
  {
    q: 'Does this page certify the service?',
    a: 'No. There is no GDPR certificate, no residency guarantee, and no data-processing agreement on offer.',
  },
  {
    q: 'What happens when a link expires?',
    a: 'The download is refused. Cleanup removes expired files. That is not a promise that every copy disappears from every disk at the same second.',
  },
  {
    q: 'Can we sign a data-processing agreement?',
    a: 'No. A signed DPA is not offered. Teams and paid plans are not available either.',
  },
];

export default function CompliancePage() {
  const [user, setUser] = useState(() => getStoredUser());
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('signup');
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <>
      <PageFrame
        user={user}
        onOpenAuth={(mode) => { setAuthMode(mode); setIsAuthOpen(true); }}
        onOpenProfile={() => setIsProfileOpen(true)}
        eyebrow="Notes, not a certificate"
        title="Data handling notes"
        accent={2}
        subtitle="What the product actually does with a file: a 6 GB cap, a link that lasts up to 7 days, and an optional download password. This is not a compliance certificate."
      >
        <section aria-label="Notes">
          <div className="ds-grid cols-3">
            {complianceStandards.map(({ icon: Icon, title, desc, badge }, i) => (
              <div key={title} className="ds-feature" data-reveal style={{ '--d': `${(i % 3) * 60}ms` }}>
                <div className="pgb-tile-top">
                  <span className="ds-icon is-sm"><Icon aria-hidden="true" /></span>
                  <span className="ds-badge">{badge}</span>
                </div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="pt-6" aria-labelledby="handling-title">
          <div className="pgb-head" data-reveal>
            <div>
              <p className="ds-kicker"><b>●</b> In practice</p>
              <h2 id="handling-title" className="ds-h2">How a file is handled.</h2>
              <p className="ds-lead">Facts about the running service. None of them is a certification.</p>
            </div>
          </div>
          <div className="ds-table-wrap mt-8" data-reveal>
            <table className="ds-table">
              <tbody>
                {HANDLING.map(([label, value]) => (
                  <tr key={label}>
                    <th scope="row" className="font-semibold text-[#060a12] w-[38%]">{label}</th>
                    <td>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="ds-band-soft" aria-labelledby="promise-title" data-reveal>
          <div className="ds-split items-start">
            <div>
              <p className="ds-kicker"><b>●</b> Limits</p>
              <h2 id="promise-title" className="ds-h2 mt-3">What this page will not promise</h2>
            </div>
            <dl className="grid gap-3">
              {PROMISES.map((item) => (
                <div key={item.q} className="ds-panel ds-panel-pad">
                  <dt className="flex items-start gap-2 font-semibold text-[#060a12]">
                    <Ban className="w-4 h-4 mt-1 shrink-0 text-[#6b7486]" aria-hidden="true" />
                    {item.q}
                  </dt>
                  <dd className="mt-2 text-[0.9375rem] leading-relaxed text-[#6b7486]">{item.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <div className="ds-band" data-reveal>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="max-w-xl">
              <h2 className="ds-h2">Send a file within the real limits</h2>
              <p className="ds-lead mt-3">Up to 6 GB, no account required to send, and a link that lasts up to 7 days.</p>
            </div>
            <div className="flex flex-wrap gap-3 shrink-0">
              <Link to="/" className="ds-btn ds-btn-light ds-btn-lg">
                Send a file
                <ArrowRight className="ds-btn-arrow w-4 h-4" aria-hidden="true" />
              </Link>
              <Link to="/security" className="ds-btn ds-btn-outline-light ds-btn-lg">Security details</Link>
            </div>
          </div>
        </div>

        <p className="ds-hint">
          Read the <Link to="/privacy" className="ds-link">privacy page</Link> and the <Link to="/terms" className="ds-link">terms</Link> for the full text.
        </p>
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
