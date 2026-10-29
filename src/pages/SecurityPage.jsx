import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import PageFrame from '../components/PageFrame';
import SeoHead from '../components/SeoHead';
import AuthModal from '../components/AuthModal';
import ProfileModal from '../components/ProfileModal';
import { getStoredUser, clearUserSession } from '../lib/authSession';
import {
  Lock, Key, EyeOff, RefreshCw, FileCheck, Server, Check, X, ArrowRight,
  Laptop, Globe2, Download, Trash2,
} from 'lucide-react';

const PILLARS = [
  {
    icon: Lock,
    title: 'A password is not encryption',
    desc: 'The optional download password is checked as a hash. It does not encrypt the file. Files travel over HTTPS (TLS).',
  },
  {
    icon: Key,
    title: 'Password gates the download',
    desc: 'Optional. You set it on the send form. The server checks a SHA-256 hash. The explanation is below.',
  },
  {
    icon: EyeOff,
    title: 'Gone when the link expires',
    desc: 'When the time you picked is up, the download is refused. Cleanup removes expired files. Executable extensions are blocked by file name. That is not a malware scan.',
  },
  {
    icon: RefreshCw,
    title: 'Device mode is not a stored link',
    desc: 'Phone-to-laptop transfer needs both screens open. The file is not saved as a download link. Keep it within 6 GB. That path does not raise the cloud cap.',
  },
  {
    icon: FileCheck,
    title: 'One email per recipient',
    desc: 'Each address is mailed separately, so the other addresses are not listed on that message. The download link itself is the same.',
  },
  {
    icon: Server,
    title: 'Storage behind a proxy',
    desc: 'Object storage is reached only through our API. Keys and buckets stay off the public page.',
  },
];

const DOES = [
  'Stores a SHA-256 hash of the password, not the password',
  'Refuses the download until the password matches',
  'Pauses a link for the rest of the minute after 8 wrong tries',
  'Keeps the password out of every email',
];

const DOES_NOT = [
  'Encrypt the file',
  'Make the file unreadable to the service',
  'Act as end-to-end encryption',
  'Let you look the password up later',
];

const PATH = [
  { icon: Laptop, label: 'You', title: 'Your browser' },
  { icon: Server, label: 'Stored on', title: 'Cloudflare R2', accent: true, wire: 'TLS' },
  { icon: Download, label: 'They open', title: 'Download page', wire: 'link' },
  { icon: Trash2, label: 'On expiry', title: 'Files deleted', wire: 'timer' },
];

function GateMock() {
  return (
    <div className="ds-frame" data-reveal style={{ '--d': '120ms' }}>
      <div className="ds-frame-chrome">
        <span className="ds-frame-dots" aria-hidden="true"><i /><i /><i /></span>
        <span className="pa-screen-bar"><Lock aria-hidden="true" />sendtoanyone.com/d/brand-kit-k3m9x2qa</span>
        <span className="w-[42px] hidden sm:block" aria-hidden="true" />
      </div>
      <div className="ds-frame-screen text-center py-8 sm:py-10" aria-hidden="true">
        <span className="mx-auto grid place-items-center w-12 h-12 rounded-2xl bg-[#060a12] text-white">
          <Lock className="w-5 h-5" />
        </span>
        <p className="mt-4 ds-row-title">brand-kit.zip is locked</p>
        <p className="ds-row-sub">Enter the password the sender gave you.</p>
        <div className="mt-5 mx-auto max-w-[17rem] flex items-center h-11 px-3 rounded-xl border border-[#d5d9e1] bg-white">
          <span className="text-[#060a12] tracking-[0.3em] text-lg leading-none">••••••••</span>
        </div>
        <span className="mt-3 ds-btn ds-btn-dark ds-btn-sm">Unlock download</span>
        <p className="mt-5 pa-spec justify-center w-full">Checked against a SHA-256 hash</p>
      </div>
    </div>
  );
}

export default function SecurityPage() {
  const [user, setUser] = useState(() => getStoredUser());
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <>
      <SeoHead
        customTitle="Security: the download password | SendToAnyone"
        customDescription="An optional password gates the download. It is checked as a SHA-256 hash, it is not included in the email, and it does not encrypt the file."
        customCanonical="https://sendtoanyone.com/security"
      />
      <PageFrame
        user={user}
        onOpenAuth={(mode) => { setAuthMode(mode); setIsAuthOpen(true); }}
        onOpenProfile={() => setIsProfileOpen(true)}
        eyebrow="Security"
        title="Locked on the way. Gone when you say."
        accent={4}
        subtitle="Plain controls: HTTPS in transit, a password that only gates the download, and deletion when the link expires."
        actions={(
          <>
            <a href="#download-password" className="ds-btn ds-btn-dark">How the password works</a>
            <Link to="/" className="ds-btn ds-btn-ghost">Send a file</Link>
          </>
        )}
        nextLabel="Send a file"
        nextTo="/"
      >
        <section aria-labelledby="gate-title">
          <div className="ds-split">
            <div data-reveal>
              <p className="ds-kicker"><b>●</b> The gate</p>
              <h2 id="gate-title" className="ds-h2 mt-3">A password stops the download, not the file.</h2>
              <p className="ds-lead mt-4">
                Turn it on when you send. The download page waits until the recipient types the same password. Share it on another channel.
              </p>
              <ul className="ds-checks mt-6">
                <li><Check strokeWidth={3} aria-hidden="true" />Optional on every transfer</li>
                <li><Check strokeWidth={3} aria-hidden="true" />Never written into the email</li>
                <li><Check strokeWidth={3} aria-hidden="true" />Links still expire on your timer</li>
              </ul>
            </div>
            <GateMock />
          </div>
        </section>

        <section className="pa-block-lg" aria-labelledby="truth-title">
          <div className="ds-section-head" data-reveal>
            <p className="ds-kicker"><b>●</b> Straight answer</p>
            <h2 id="truth-title" className="ds-h2">What the password does, and what it does not.</h2>
          </div>
          <div className="pa-truth mt-10">
            <div className="pa-truth-col is-yes" data-reveal>
              <h3><span className="ds-icon is-sm is-green"><Check /></span>It does</h3>
              <ul>
                {DOES.map((item) => <li key={item}><Check strokeWidth={3} aria-hidden="true" />{item}</li>)}
              </ul>
            </div>
            <div className="pa-truth-col is-no" data-reveal style={{ '--d': '80ms' }}>
              <h3><span className="ds-icon is-sm"><X /></span>It does not</h3>
              <ul>
                {DOES_NOT.map((item) => <li key={item}><X strokeWidth={3} aria-hidden="true" />{item}</li>)}
              </ul>
            </div>
          </div>
        </section>

        <section className="pa-block-lg" aria-labelledby="pillars-title">
          <div className="ds-section-head" data-reveal>
            <p className="ds-kicker"><b>●</b> Controls</p>
            <h2 id="pillars-title" className="ds-h2">Six things that are true today.</h2>
          </div>
          <div className="ds-grid cols-3 mt-10">
            {PILLARS.map((item, i) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="ds-feature" data-reveal style={{ '--d': `${(i % 3) * 70}ms` }}>
                  <span className="ds-icon mb-2"><Icon /></span>
                  <h3>{item.title}</h3>
                  <p>{item.desc}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="pa-block-lg" aria-labelledby="path-title">
          <div className="ds-band" data-reveal>
            <div className="max-w-2xl">
              <p className="ds-kicker text-white/60"><b>●</b> Where the file goes</p>
              <h2 id="path-title" className="ds-h2 mt-3">One path, with an end date.</h2>
              <p className="ds-lead mt-4">
                Uploads go over HTTPS to Cloudflare R2 on Cloudflare’s global network. The download page is kept out of search, and the link ends in a random suffix.
              </p>
            </div>
            <ol className="pa-path mt-10" aria-label="File path">
              {PATH.map((node, i) => (
                <Fragment key={node.title}>
                  {i > 0 && <li className="pa-path-wire" aria-hidden="true"><span>{node.wire}</span></li>}
                  <li className={`pa-path-node${node.accent ? ' is-accent' : ''}`}>
                    <node.icon aria-hidden="true" />
                    <span className="min-w-0"><small>{node.label}</small><strong>{node.title}</strong></span>
                  </li>
                </Fragment>
              ))}
            </ol>
            <div className="mt-8 flex flex-wrap gap-2">
              <span className="ds-badge ds-badge-dark border border-white/15"><Globe2 className="w-3 h-3" />Cloudflare network</span>
              <span className="ds-badge ds-badge-dark border border-white/15"><EyeOff className="w-3 h-3" />Download pages noindex</span>
              <span className="ds-badge ds-badge-dark border border-white/15"><Trash2 className="w-3 h-3" />Scheduled cleanup</span>
            </div>
          </div>
        </section>

        <section id="download-password" className="pa-block-lg scroll-mt-24" aria-labelledby="download-password-title">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:gap-16">
            <div data-reveal>
              <p className="ds-kicker"><b>●</b> In detail</p>
              <p className="mt-3 text-sm text-[#6b7486]">How the check works, step by step.</p>
            </div>
            <div className="ds-prose" data-reveal style={{ '--d': '80ms' }}>
              <h2 id="download-password-title" className="!mt-0 !text-[clamp(1.6rem,3vw,2.1rem)]">The download password</h2>
              <p>
                After you add files on the send form, a Password checkbox is optional. The line next to it says the password gates the download. Turn it on and type the password before you create the link.
              </p>
              <p>
                The server stores a SHA-256 hash of that password and compares it with what the recipient types. A match opens the download. A wrong password is refused. Eight wrong attempts in one minute pause further tries on that link for the rest of the minute.
              </p>
              <p>
                The notification email does not include the password. Give it to the recipient on another channel: a separate message, a call, or in person. Keep your own copy. The email cannot be used to look the password up later.
              </p>
              <p>
                Anyone who has both the link and the password can download. The password does not encrypt the file. Losing it does not make the stored bytes unreadable to the service. This is not end-to-end encryption.
              </p>
              <p>
                The link still expires on the timer you set: from 1 hour up to 7 days on Free, or up to 180 days on Pro. <Link to="/">Set the password on a send</Link>.
              </p>
            </div>
          </div>
        </section>
      </PageFrame>

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} initialMode={authMode} onAuthSuccess={(u) => setUser(u)} />
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        user={user}
        onSignOut={async () => { await clearUserSession(); setUser(null); }}
      />
    </>
  );
}
