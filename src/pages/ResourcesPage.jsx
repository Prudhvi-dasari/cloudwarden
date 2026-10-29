import { useState } from 'react';
import { Link } from 'react-router-dom';
import PageFrame from '../components/PageFrame';
import AuthModal from '../components/AuthModal';
import ProfileModal from '../components/ProfileModal';
import { getStoredUser, clearUserSession } from '../lib/authSession';
import {
  BookOpen, Mail, Link2, Inbox,
  ArrowRight, ArrowUpRight, ShieldCheck, Hash, QrCode, Scale,
} from 'lucide-react';

const NOTE_GROUPS = [
  {
    label: 'Product',
    notes: [
      { title: 'How it works', path: '/how-it-works' },
      { title: 'Features', path: '/features' },
      { title: 'Pricing', path: '/pricing' },
      { title: 'Apps', path: '/apps' },
      { title: 'Teams', path: '/teams' },
      { title: 'Changelog', path: '/changelog' },
    ],
  },
  {
    label: 'Builders and trust',
    notes: [
      { title: 'API notes', path: '/api-docs' },
      { title: 'Widget preview', path: '/widget' },
      { title: 'Compliance notes', path: '/compliance' },
      { title: 'Status', path: '/status' },
    ],
  },
  {
    label: 'Help and legal',
    notes: [
      { title: 'Help', path: '/help' },
      { title: 'Privacy', path: '/privacy' },
      { title: 'Terms', path: '/terms' },
    ],
  },
];

const FEATURED = [
  { title: 'Send a large file (6 GB)', path: '/send-large-files', tag: 'Send', icon: Link2, text: 'Send up to 6 GB free with a link or an email. No account on either side.' },
  { title: 'How to send a large file', path: '/how-to-send-large-files', tag: 'Guide', icon: BookOpen, text: 'A step-by-step walkthrough for files that are too big for email.' },
];

const GUIDES = [
  { title: 'Send without an account', path: '/send-files-without-signup', tag: 'Send', icon: Mail, text: 'Neither side signs up. Drop, copy, send.' },
  { title: 'Request files', path: '/receive', tag: 'Request', icon: Inbox, text: 'A link others can upload to, without an account.' },
  { title: 'Download password', path: '/security', tag: 'Trust', icon: ShieldCheck, text: 'What the password does, and what it does not.' },
  { title: 'Limits, checked 23 Oct 2026', path: '/compare', tag: 'Compare', icon: Scale, text: 'Our limits next to other tools, with sources.' },
  { title: 'QR device transfer', path: '/qr-transfer', tag: 'Device', icon: QrCode, text: 'Phone to laptop, browser to browser. Nothing stored.' },
  { title: 'Checksum tool', path: '/checksum', tag: 'Trust', icon: Hash, text: 'Hash a file in your browser to check it arrived intact.' },
];

export default function ResourcesPage() {
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
        eyebrow="Resources"
        title="Guides and tools for sending a file."
        accent={2}
        subtitle="Short guides and small tools. Every page links back to a free transfer."
        nextLabel="Send a file"
        nextTo="/"
      >
        <section aria-labelledby="guides-title">
          <h2 id="guides-title" className="sr-only">Guides</h2>
          <div className="ds-grid cols-2">
            {FEATURED.map(({ title, path, tag, icon: Icon, text }, i) => (
              <Link
                key={path}
                to={path}
                className={`ds-feature ${i === 0 ? 'is-dark' : 'is-soft'} min-h-[15rem] sm:p-8`}
                data-reveal
                style={{ '--d': `${i * 80}ms` }}
              >
                <div className="pa-feature-top">
                  <span className={`ds-icon ${i === 0 ? 'is-blue' : 'is-dark'}`}><Icon /></span>
                  <span className={`pa-guide-tag ${i === 0 ? '!text-white/50' : ''}`}>{tag}</span>
                </div>
                <h3 className="!text-[1.5rem] !leading-tight mt-2">{title}</h3>
                <p>{text}</p>
                <span className={`pa-guide-go ${i === 0 ? '!text-white' : ''}`}>Read<ArrowUpRight className="w-4 h-4" aria-hidden="true" /></span>
              </Link>
            ))}
          </div>

          <div className="ds-grid cols-3 mt-4">
            {GUIDES.map(({ title, path, tag, icon: Icon, text }, i) => (
              <Link key={path} to={path} className="ds-feature" data-reveal style={{ '--d': `${(i % 3) * 70}ms` }}>
                <div className="pa-feature-top">
                  <span className="ds-icon is-sm is-blue"><Icon /></span>
                  <span className="pa-guide-tag">{tag}</span>
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
                <span className="pa-guide-go">Read<ArrowUpRight className="w-4 h-4" aria-hidden="true" /></span>
              </Link>
            ))}
          </div>
        </section>

        <nav className="pa-block-lg" aria-labelledby="pages-title">
          <div className="ds-section-head" data-reveal>
            <p className="ds-kicker"><b>●</b> Directory</p>
            <h2 id="pages-title" className="ds-h2">Other public pages</h2>
          </div>
          <div className="pa-dir mt-10" data-reveal style={{ '--d': '80ms' }}>
            {NOTE_GROUPS.map((group) => (
              <div key={group.label}>
                <h3>{group.label}</h3>
                <ul>
                  {group.notes.map((note) => (
                    <li key={note.path}>
                      <Link to={note.path}>{note.title}<ArrowRight className="w-4 h-4" aria-hidden="true" /></Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        <section className="pa-block-lg" aria-labelledby="start-title">
          <div className="ds-band-soft flex flex-col gap-6 md:flex-row md:items-center md:justify-between" data-reveal>
            <div className="max-w-xl">
              <p className="ds-kicker"><b>●</b> Skip the reading</p>
              <h2 id="start-title" className="ds-h2 mt-3 !text-[clamp(1.6rem,3vw,2.2rem)]">Send the file now.</h2>
              <p className="ds-lead mt-3">Up to 6 GB, no account, link open up to 7 days.</p>
            </div>
            <Link to="/" className="ds-btn ds-btn-dark ds-btn-lg shrink-0 self-start md:self-auto">
              Transfer files free
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
