import { useState } from 'react';
import { Link } from 'react-router-dom';
import PageFrame from '../components/PageFrame';
import AuthModal from '../components/AuthModal';
import ProfileModal from '../components/ProfileModal';
import { HomeFaq } from '../components/home/HomeSections';
import { getStoredUser, clearUserSession } from '../lib/authSession';
import { ArrowRight, FileArchive, FileImage, FileVideo, Minus } from 'lucide-react';

const HANDOFF = [
  {
    n: '01',
    title: 'Drop the file',
    body: 'Up to 6 GB free, or 250 GB on Pro. A folder works. No account is required to send on Free.',
  },
  {
    n: '02',
    title: 'Choose how it leaves',
    body: 'A link, an email, or a device handoff. Email carries the link. The file does not sit in the inbox.',
  },
  {
    n: '03',
    title: 'They open it',
    body: 'The download page. A password can gate it. The link lasts from one hour up to 7 days free, then the files are deleted.',
  },
];

const AVAILABLE = [
  ['Size', '6 GB free, 250 GB on Pro'],
  ['Account', 'Not required to send on Free'],
  ['Ways to send', 'Link, email, device'],
  ['Receive', 'A request link, no account for the uploader'],
  ['Password', 'Optional gate on the download'],
  ['Expiry', '1 hour to 7 days free, up to 180 days on Pro'],
];

const UNAVAILABLE = [
  'Team plans and team billing',
  'Shared team storage',
  'SSO and member roles',
  'Custom domains',
  'White-label download pages',
  'Audit logs and branded email templates',
];

const PEOPLE = [
  { who: 'Anika', file: 'brand-kit.zip', meta: '1.2 GB', slug: 'brand-kit-m4q8z1rk', icon: FileArchive },
  { who: 'Rahul', file: 'site-walkthrough.mp4', meta: '3.4 GB', slug: 'site-walk-p2x7c9ve', icon: FileVideo },
  { who: 'You', file: 'final-photos.zip', meta: '860 MB', slug: 'final-photos-t6n3b8wd', icon: FileImage },
];

const FAQS = [
  { q: 'Can my team share one Pro plan?', a: 'Not yet. Pro is attached to one account. Each person who needs the larger limit buys their own.' },
  { q: 'Can teammates send without accounts?', a: 'Yes. On Free, anyone can send up to 6 GB without signing up. Recipients never need an account.' },
  { q: 'Is there an admin view of everyone’s transfers?', a: 'No. Each person sees only their own transfers. There is no shared workspace or member list.' },
  { q: 'Can clients upload to us?', a: 'Yes. A signed-in person can make a request link. Anyone with it can upload up to 6 GB for 7 days, without an account.' },
];

function PeopleMock() {
  return (
    <div className="ds-demo" data-reveal style={{ '--d': '120ms' }}>
      <div className="ds-demo-card">
        <div className="ds-card-head">
          <span>Three people, three links</span>
          <span className="ds-badge">No shared space</span>
        </div>
        {PEOPLE.map((person) => (
          <div key={person.who} className="ds-row items-start">
            <span className="ds-file-icon"><person.icon className="w-4 h-4" /></span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="ds-row-title truncate">{person.file}</p>
                <span className="pa-spec">{person.who}</span>
              </div>
              <p className="ds-row-sub">{person.meta}</p>
              <div className="ds-url mt-2 !h-9 !flex-none">
                <span className="truncate">/d/<b>{person.slug}</b></span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[12px] text-[#6b7486]">Each sender keeps their own links. Nobody else sees them.</p>
    </div>
  );
}

export default function TeamsPage() {
  const [user, setUser] = useState(() => getStoredUser());
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <>
      <PageFrame
        user={user}
        onOpenAuth={(mode) => { setAuthMode(mode); setIsAuthOpen(true); }}
        onOpenProfile={() => setIsProfileOpen(true)}
        eyebrow="Teams"
        title="One transfer. Not a team plan."
        accent={3}
        subtitle="People can send up to 6 GB from the browser, with no account. Team billing, shared storage, SSO, and custom domains cannot be purchased or used."
        actions={(
          <>
            <Link to="/" className="ds-btn ds-btn-dark">Send a file<ArrowRight className="ds-btn-arrow w-4 h-4" /></Link>
            <Link to="/pricing" className="ds-btn ds-btn-ghost">Pricing</Link>
          </>
        )}
        nextLabel="Send a file"
        nextTo="/"
      >
        <section aria-labelledby="handoff-title">
          <div className="ds-split items-start">
            <div>
              <div className="ds-section-head" data-reveal>
                <p className="ds-kicker"><b>01</b> Handoff</p>
                <h2 id="handoff-title" className="ds-h2">How a file moves now.</h2>
              </div>
              <ol className="ds-steps mt-8">
                {HANDOFF.map((step, i) => (
                  <li key={step.n} className="ds-step" data-reveal style={{ '--d': `${i * 70}ms` }}>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </li>
                ))}
              </ol>
            </div>
            <div className="lg:sticky lg:top-24">
              <PeopleMock />
            </div>
          </div>
        </section>

        <section className="pa-block-lg" aria-labelledby="available-title">
          <div className="ds-section-head" data-reveal>
            <p className="ds-kicker"><b>02</b> Available</p>
            <h2 id="available-title" className="ds-h2">What a group can use today.</h2>
            <p className="ds-lead">Several people can each send a file. There is no shared workspace behind it.</p>
          </div>
          <dl className="pa-facts is-3 mt-10" data-reveal style={{ '--d': '80ms' }}>
            {AVAILABLE.map(([term, detail]) => (
              <div key={term} className="pa-fact">
                <dt>{term}</dt>
                <dd>{detail}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="pa-block-lg" aria-labelledby="unavailable-title">
          <div className="ds-band" data-reveal>
            <div className="max-w-2xl">
              <p className="ds-kicker text-white/60"><b>03</b> Unavailable</p>
              <h2 id="unavailable-title" className="ds-h2 mt-3">These cannot be purchased or used.</h2>
              <p className="ds-lead mt-4">Not available yet. Nothing here is on sale.</p>
            </div>
            <ul className="pa-nolist is-3-lg mt-8">
              {UNAVAILABLE.map((item) => (
                <li key={item}><Minus aria-hidden="true" /><span>{item}</span></li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <p className="text-white/70">The working product is the transfer.</p>
              <Link to="/" className="ds-btn ds-btn-light">Send a file<ArrowRight className="ds-btn-arrow w-4 h-4" /></Link>
            </div>
          </div>
        </section>

        <div className="pa-flush">
          <HomeFaq
            faqs={FAQS}
            title="Sending as a group."
            lead="What works for several people today, and what does not."
          />
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
