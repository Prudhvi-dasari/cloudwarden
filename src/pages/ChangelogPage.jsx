import { useState } from 'react';
import { Link } from 'react-router-dom';
import PageFrame from '../components/PageFrame';
import AuthModal from '../components/AuthModal';
import ProfileModal from '../components/ProfileModal';
import { getStoredUser, clearUserSession } from '../lib/authSession';
import { ArrowRight, Check } from 'lucide-react';

const RELEASES = [
  {
    date: '30 Oct 2026',
    dateTime: '2026-10-30',
    span: 'Today',
    title: 'Alerts, branding, and a finished send',
    badge: 'Latest',
    highlights: [
      'The sender can get an email the first time a link is downloaded, or on every download. The email has an unsubscribe link.',
      'My Files shows when a transfer was downloaded. It does not show who downloaded it.',
      'Pro and Studio can set a color, a short message, and a background on the download page.',
      'When a link is ready, the card springs in and a short burst of paper plays once. It stays quiet if you prefer reduced motion.',
      'A send that is over the free 6 GB limit walks through a plan, sign-in, and checkout without dropping the files.',
      'A transfer can be set to close after the first download.',
    ],
  },
  {
    date: '30 Oct 2026',
    dateTime: '2026-10-30',
    span: 'Today',
    title: 'Uploads that continue, and pages search can read',
    badge: 'Send',
    highlights: [
      'A large upload can resume after the network drops or the page is reloaded.',
      'Leaving the send page for Pricing or another tab no longer cancels the upload.',
      'Free stays 6 GB and 7 days. Creator, Pro, Studio, and a one-time Pass are on the pricing page, each with its own storage total.',
      'Download passwords are stored as a salted hash. Older links still open.',
      'Guides for WeTransfer, large video, WhatsApp, phone to laptop, file requests, and email are real pages. The about page names who built the site.',
    ],
  },
  {
    date: 'Oct 2026',
    dateTime: '2026-10',
    span: 'Late October',
    title: 'Creator, Pro, and Studio',
    badge: 'Plans',
    highlights: [
      'Free stays 6 GB per transfer and 7 days, with no account.',
      'Creator is ₹299 a month. Pro is ₹799 a month or ₹7,999 a year. Studio is ₹2,499 a month.',
      'Each plan has a stored total. The account page shows how much of it is in use.',
      'A Pass is ₹149 for one transfer up to 100 GB, kept 30 days.',
      'Download passwords are stored as a salted hash. Older links still open.',
    ],
  },
  {
    date: 'Oct 2026',
    dateTime: '2026-10',
    span: 'Late October',
    title: 'Pro plan and a lighter site',
    badge: 'Plans',
    highlights: [
      'Pro: 250 GB per transfer and links up to 180 days, billed through Dodo Payments.',
      'Pro switches on once the server confirms the payment, not when the checkout page returns.',
      'A new light design across the site.',
      'Download pages are kept out of search results.',
    ],
  },
  {
    date: 'Oct 2026',
    dateTime: '2026-10',
    span: 'Mid October',
    title: 'Cloudflare R2 and security hardening',
    badge: 'Storage',
    highlights: [
      'Files moved to Cloudflare R2.',
      'The download password is checked as a SHA-256 hash. It does not encrypt the file.',
      'Eight wrong password tries in one minute pause that link for the rest of the minute.',
      'Executable file types are blocked on upload.',
      'Each email recipient gets a separate message.',
      'A scheduled cleanup deletes files after their link expires.',
    ],
  },
  {
    date: 'Jul 2026',
    dateTime: '2026-07',
    span: 'First version',
    title: 'iTransfer goes live',
    badge: 'Start',
    highlights: [
      'Upload files in the browser and share a download link.',
      'Pick when the link expires.',
      'The product was later renamed SendToAnyone.',
    ],
  },
];

export default function ChangelogPage() {
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
        eyebrow="Changelog"
        title="SendToAnyone changelog"
        accent={1}
        subtitle="Changes that have already shipped, newest first. This is a record, not a promise of future features."
        nextLabel="Send a file"
        nextTo="/"
      >
        <ol className="pa-timeline max-w-4xl" aria-label="Releases">
          {RELEASES.map((rel, idx) => (
            <li
              key={rel.title}
              className={`pa-release${idx === 0 ? ' is-latest' : ''}`}
              data-reveal
              style={{ '--d': `${idx * 60}ms` }}
            >
              <div className="pa-release-date">
                <time dateTime={rel.dateTime}>{rel.date}</time>
                <span>{rel.span}</span>
              </div>
              <article className="pa-release-body">
                <span className={`ds-badge ${idx === 0 ? 'ds-badge-blue' : ''}`}>{rel.badge}</span>
                <h2 className="mt-3">{rel.title}</h2>
                <ul className="ds-checks">
                  {rel.highlights.map((h) => (
                    <li key={h}><Check strokeWidth={3} aria-hidden="true" />{h}</li>
                  ))}
                </ul>
              </article>
            </li>
          ))}
        </ol>

        <section className="pa-block-lg max-w-4xl" aria-labelledby="try-title">
          <div className="ds-band-soft flex flex-col gap-6 md:flex-row md:items-center md:justify-between" data-reveal>
            <div className="max-w-lg">
              <p className="ds-kicker"><b>●</b> Try it</p>
              <h2 id="try-title" className="ds-h2 mt-3 !text-[clamp(1.6rem,3vw,2.2rem)]">Everything above is live now.</h2>
              <p className="ds-lead mt-3">Send up to 6 GB free, with no account.</p>
            </div>
            <Link to="/" className="ds-btn ds-btn-dark ds-btn-lg shrink-0 self-start md:self-auto">
              Send a file
              <ArrowRight className="ds-btn-arrow w-4 h-4" />
            </Link>
          </div>
        </section>
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
