import { useState } from 'react';
import { Link } from 'react-router-dom';
import PageFrame from '../components/PageFrame';
import AuthModal from '../components/AuthModal';
import ProfileModal from '../components/ProfileModal';
import { getStoredUser, clearUserSession } from '../lib/authSession';
import {
  ArrowRight, Link2, Mail, Wifi, Lock, UploadCloud, Send, Monitor, Puzzle, Terminal,
} from 'lucide-react';

const FLOWS = [
  {
    n: '01',
    icon: Link2,
    title: 'Link',
    body: 'Drop the file and copy a download link. Up to 6 GB free. The other person does not need an account.',
    specimen: 'sendtoanyone.com/d/…',
    specimenLabel: 'A link you copy',
  },
  {
    n: '02',
    icon: Mail,
    title: 'Email',
    body: 'Add their address. SendToAnyone mails the link. The file stays on the link, not in the inbox.',
    specimen: 'Link in the mail',
    specimenLabel: 'Not an attachment',
  },
  {
    n: '03',
    icon: Wifi,
    title: 'Device',
    body: 'Phone and laptop, browser to browser. Nothing from that handoff is stored on SendToAnyone.',
    specimen: 'Same network',
    specimenLabel: 'Nothing stored',
    href: '/?mode=device',
    hrefLabel: 'Open device transfer',
  },
];

const ABSENT = [
  { icon: Monitor, term: 'Desktop', detail: 'No macOS or Windows app.' },
  { icon: Puzzle, term: 'Mail plugins', detail: 'No Outlook or Gmail add-in.' },
  { icon: Terminal, term: 'Command line', detail: 'No CLI, SDK, or install script.' },
];

function BrowserMock() {
  return (
    <div className="ds-frame" data-reveal style={{ '--d': '120ms' }}>
      <div className="ds-frame-chrome">
        <span className="ds-frame-dots" aria-hidden="true"><i /><i /><i /></span>
        <span className="pa-screen-bar"><Lock aria-hidden="true" />sendtoanyone.com</span>
        <span className="w-[42px] hidden sm:block" aria-hidden="true" />
      </div>
      <div className="ds-frame-screen" aria-hidden="true">
        <div className="ds-tabs">
          <span className="ds-tab" aria-pressed="true"><Link2 className="w-3.5 h-3.5" />Link</span>
          <span className="ds-tab"><Mail className="w-3.5 h-3.5" />Email</span>
          <span className="ds-tab"><Wifi className="w-3.5 h-3.5" />Device</span>
        </div>
        <div className="pa-mini-drop mt-4 !py-8">
          <span><UploadCloud className="w-4 h-4" /></span>
          <p className="ds-row-title">Drop files or folders here</p>
          <p className="ds-row-sub">Up to 6 GB · no account</p>
        </div>
      </div>
    </div>
  );
}

function PhoneMock() {
  const blanks = Array.from({ length: 11 }, (_, i) => i);
  return (
    <div className="pa-phone mx-auto" aria-hidden="true" data-reveal style={{ '--d': '200ms' }}>
      <div className="pa-phone-screen">
        <div className="pa-phone-grid">
          {blanks.slice(0, 5).map((i) => <span key={i} className="pa-app"><i /></span>)}
          <span className="pa-app is-ours"><i><Send /></i>SendTo…</span>
          {blanks.slice(5).map((i) => <span key={i} className="pa-app"><i /></span>)}
        </div>
      </div>
    </div>
  );
}

export default function AppsPage() {
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
        eyebrow="Apps"
        title="It already lives in the browser."
        accent={2}
        subtitle="Link, email, and device transfer open in a tab. There is no desktop app, mail plugin, or command-line tool to install."
        actions={(
          <>
            <Link to="/" className="ds-btn ds-btn-dark">Open SendToAnyone<ArrowRight className="ds-btn-arrow w-4 h-4" /></Link>
            <a href="#home-screen" className="ds-btn ds-btn-ghost">Add to home screen</a>
          </>
        )}
        nextLabel="Send a file"
        nextTo="/"
      >
        <section aria-labelledby="tab-title">
          <h2 id="tab-title" className="sr-only">The web app</h2>
          <figure className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-center lg:gap-12">
            <BrowserMock />
            <PhoneMock />
            <figcaption className="pa-spec lg:col-span-2 justify-center whitespace-normal text-center">
              The web app on a laptop, and as a home-screen icon on a phone. Nothing else is installed.
            </figcaption>
          </figure>
        </section>

        <section className="pa-block-lg" aria-labelledby="flows-title">
          <div className="ds-section-head" data-reveal>
            <p className="ds-kicker"><b>01</b> In the tab</p>
            <h2 id="flows-title" className="ds-h2">Three ways, one screen.</h2>
          </div>
          <ol className="ds-grid cols-3 mt-10">
            {FLOWS.map((flow, i) => (
              <li key={flow.n} className="ds-feature" data-reveal style={{ '--d': `${i * 70}ms` }}>
                <div className="pa-feature-top">
                  <span className="ds-icon"><flow.icon /></span>
                  <span className="pa-spec">{flow.n}</span>
                </div>
                <h3>{flow.title}</h3>
                <p>{flow.body}</p>
                <div className="mt-auto pt-4">
                  <div className="ds-url !flex-none">
                    <span className="truncate">{flow.specimen}</span>
                  </div>
                  <p className="mt-2 pa-spec">{flow.specimenLabel}</p>
                </div>
                {flow.href && (
                  <Link to={flow.href} className="ds-link w-fit mt-2">
                    {flow.hrefLabel}<ArrowRight className="w-4 h-4" />
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </section>

        <section id="home-screen" className="pa-block-lg scroll-mt-24" aria-labelledby="home-screen-title">
          <div className="ds-section-head" data-reveal>
            <p className="ds-kicker"><b>02</b> On your phone</p>
            <h2 id="home-screen-title" className="ds-h2">Keep it one tap away.</h2>
            <p className="ds-lead">Add the site to your home screen from the browser. It opens like any other icon. Under the hood it is the same website.</p>
          </div>
          <ol className="ds-steps is-row mt-10" style={{ '--n': 3 }}>
            <li className="ds-step" data-reveal>
              <h3>Open sendtoanyone.com</h3>
              <p>In Safari on iPhone, or Chrome on Android.</p>
            </li>
            <li className="ds-step" data-reveal style={{ '--d': '80ms' }}>
              <h3>Open the browser menu</h3>
              <p>The Share button in Safari. The three-dot menu in Chrome.</p>
            </li>
            <li className="ds-step" data-reveal style={{ '--d': '160ms' }}>
              <h3>Add to Home Screen</h3>
              <p>The icon appears next to your other apps.</p>
            </li>
          </ol>
        </section>

        <section className="pa-block-lg" aria-labelledby="absent-title">
          <div className="ds-band" data-reveal>
            <div className="max-w-2xl">
              <p className="ds-kicker text-white/60"><b>03</b> Not available</p>
              <h2 id="absent-title" className="ds-h2 mt-3">Nothing to download.</h2>
              <p className="ds-lead mt-4">These do not exist today. The browser tab is the whole product.</p>
            </div>
            <ul className="pa-nolist is-3 mt-8">
              {ABSENT.map(({ icon: Icon, term, detail }) => (
                <li key={term}>
                  <Icon aria-hidden="true" />
                  <span><b>{term}</b><small>{detail}</small></span>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <Link to="/" className="ds-btn ds-btn-light">Open the tab. Send the file.<ArrowRight className="ds-btn-arrow w-4 h-4" /></Link>
            </div>
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
