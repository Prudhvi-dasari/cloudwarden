import { useState } from 'react';
import { Link } from 'react-router-dom';
import PageFrame from '../components/PageFrame';
import AuthModal from '../components/AuthModal';
import ProfileModal from '../components/ProfileModal';
import CountUp from '../components/ds/CountUp';
import { HomeFaq } from '../components/home/HomeSections';
import { getStoredUser, clearUserSession } from '../lib/authSession';
import {
  Link2, Mail, Wifi, Inbox, Lock, Clock, QrCode, Smartphone,
  ArrowRight, Check, Copy, FileArchive, FileImage, FileVideo, Ban, Eye, Laptop,
} from 'lucide-react';

const CONTROLS = [
  { icon: Lock, title: 'Password on the download', text: 'Optional. The download page waits until the password matches. It is never written into the email.' },
  { icon: Clock, title: 'You pick the expiry', text: '1 hour, 24 hours, 3 days, or 7 days on Free. Up to 180 days on Pro. Then the files are deleted.' },
  { icon: QrCode, title: 'QR code for the link', text: 'Show the download link as a QR code, so a phone can open it without typing.' },
  { icon: Eye, title: 'Preview before download', text: 'The download page can preview files it can show, so the recipient knows what they are getting.' },
  { icon: Ban, title: 'Executables blocked', text: 'File types like .exe, .dmg, .apk, and .sh are refused on upload. This is a name check, not a virus scan.' },
  { icon: Smartphone, title: 'Nothing to install', text: 'It all runs in a modern browser on iOS, Android, macOS, Windows, and Linux.' },
];

const STATS = [
  { label: 'Free transfer', value: 6, unit: 'GB', note: 'No account on either side.' },
  { label: 'Free link', value: 7, unit: 'days', note: 'Pick anything from 1 hour.' },
  { label: 'Pro transfer', value: 250, unit: 'GB', note: 'Once the server confirms payment.' },
  { label: 'Pro link', value: 180, unit: 'days', note: 'Billed through Dodo Payments.' },
];

const FAQS = [
  { q: 'Does the person receiving need an account?', a: 'No. They open the link in a browser and download. Sending on Free does not need an account either.' },
  { q: 'How many people can I email at once?', a: 'Up to 10 addresses per send. Each address gets its own message with the download link. The file is not attached.' },
  { q: 'Does the password encrypt my file?', a: 'No. The server stores a SHA-256 hash of the password and checks it before the download starts. It gates the download; it does not encrypt the file.' },
  { q: 'What happens when the link expires?', a: 'The download page stops working and a scheduled cleanup deletes the files from storage.' },
  { q: 'Is device transfer stored anywhere?', a: 'No. The file goes from one browser to the other over WebRTC. Both screens stay open until it finishes. It works best on the same network.' },
];

function LinkMock() {
  return (
    <div className="pa-mock-card">
      <div className="ds-row">
        <span className="ds-file-icon"><FileArchive className="w-4 h-4" /></span>
        <div className="flex-1 min-w-0">
          <p className="ds-row-title truncate">final-cut-v3.zip</p>
          <p className="ds-row-sub">4.1 GB · 12 files</p>
        </div>
        <span className="ds-badge">7 days</span>
      </div>
      <div className="ds-row">
        <div className="ds-url"><span className="truncate">sendtoanyone.com/d/<b>final-cut-x7p2k9qa</b></span></div>
        <span className="ds-copy-btn" aria-hidden="true"><span><Copy className="w-3.5 h-3.5" />Copy</span></span>
      </div>
    </div>
  );
}

function EmailMock() {
  return (
    <div className="pa-mock-card">
      <div className="ds-row">
        <span className="ds-file-icon bg-[#060a12] text-white"><Mail className="w-4 h-4" /></span>
        <div className="flex-1 min-w-0">
          <p className="ds-row-title truncate">You have files waiting</p>
          <p className="ds-row-sub truncate">Link inside · nothing attached</p>
        </div>
      </div>
    </div>
  );
}

function DeviceMock() {
  return (
    <div className="pa-mock-card p-4">
      <div className="flex items-center gap-3">
        <span className="ds-icon is-sm"><Smartphone /></span>
        <div className="flex-1 min-w-0">
          <div className="ds-bar"><i style={{ width: '62%' }} /></div>
        </div>
        <span className="ds-icon is-sm"><Laptop /></span>
      </div>
      <p className="mt-3 pa-spec">Pair code · AIR-7K92</p>
    </div>
  );
}

function RequestMock() {
  const files = [
    { name: 'raw-footage.mov', meta: '1.8 GB', icon: FileVideo },
    { name: 'stills.zip', meta: '640 MB', icon: FileImage },
  ];
  return (
    <div className="pa-mock-card">
      {files.map((file) => (
        <div key={file.name} className="ds-row">
          <span className="ds-file-icon"><file.icon className="w-4 h-4" /></span>
          <div className="flex-1 min-w-0">
            <p className="ds-row-title truncate">{file.name}</p>
            <p className="ds-row-sub">{file.meta} · uploaded to you</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function SettingsMock() {
  return (
    <div className="ds-frame" data-reveal style={{ '--d': '120ms' }}>
      <div className="ds-frame-chrome">
        <span className="ds-frame-dots" aria-hidden="true"><i /><i /><i /></span>
        <span className="pa-screen-bar"><Lock aria-hidden="true" />sendtoanyone.com</span>
        <span className="w-[42px] hidden sm:block" aria-hidden="true" />
      </div>
      <div className="ds-frame-screen" aria-hidden="true">
        <div className="flex items-center justify-between gap-3">
          <p className="ds-row-title">Transfer settings</p>
          <span className="ds-badge ds-badge-blue">Free</span>
        </div>

        <p className="mt-5 ds-label">Link expires after</p>
        <div className="mt-2 ds-choices">
          {['1 hour', '24 hours', '3 days', '7 days'].map((label) => (
            <span key={label} className={`ds-choice${label === '7 days' ? ' is-on' : ''}`}>{label}</span>
          ))}
          <span className="ds-choice opacity-50">180 days · Pro</span>
        </div>

        <div className="mt-5 rounded-2xl border border-[#e6e8ee]">
          <div className="ds-row">
            <span className="ds-icon is-sm"><Lock /></span>
            <div className="flex-1 min-w-0">
              <p className="ds-row-title">Password</p>
              <p className="ds-row-sub">Gates the download</p>
            </div>
            <span className="pa-toggle is-on" />
          </div>
          <div className="ds-row">
            <span className="ds-icon is-sm"><QrCode /></span>
            <div className="flex-1 min-w-0">
              <p className="ds-row-title">QR code</p>
              <p className="ds-row-sub">Open the link on a phone</p>
            </div>
            <span className="pa-toggle" />
          </div>
        </div>

        <span className="mt-5 ds-btn ds-btn-dark w-full">Create link</span>
      </div>
    </div>
  );
}

export default function FeaturesPage() {
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
        eyebrow="Features"
        title="What you can send, and how it arrives."
        accent={3}
        subtitle="A link, an email, a device handoff, or a request link. Free sends up to 6 GB with no account. Pro raises it to 250 GB."
        actions={(
          <>
            <Link to="/" className="ds-btn ds-btn-dark">Send a file<ArrowRight className="ds-btn-arrow w-4 h-4" /></Link>
            <Link to="/pricing" className="ds-btn ds-btn-ghost">See pricing</Link>
          </>
        )}
        nextLabel="Send a file"
        nextTo="/"
      >
        <section aria-labelledby="ways-title">
          <div className="ds-section-head" data-reveal>
            <p className="ds-kicker"><b>●</b> Ways to send</p>
            <h2 id="ways-title" className="ds-h2">Four ways out of one screen.</h2>
          </div>

          <div className="pa-bento mt-10">
            <article className="ds-feature is-soft is-wide" data-reveal>
              <div className="pa-wide-split">
                <div className="grid gap-2.5">
                  <div className="pa-feature-top justify-start">
                    <span className="ds-icon is-blue"><Link2 /></span>
                    <span className="pa-spec">Link · up to 6 GB free</span>
                  </div>
                  <h3>Shareable link</h3>
                  <p>Drop the files and copy a download link. Paste it into WhatsApp, Slack, or an invoice. The other person opens it in a browser. No signup, no app.</p>
                  <ul className="ds-checks mt-2">
                    <li><Check strokeWidth={3} aria-hidden="true" />Readable link with a random suffix</li>
                    <li><Check strokeWidth={3} aria-hidden="true" />Folders work too</li>
                  </ul>
                </div>
                <div className="pa-mock"><LinkMock /></div>
              </div>
            </article>

            <article className="ds-feature" data-reveal style={{ '--d': '80ms' }}>
              <div className="pa-feature-top">
                <span className="ds-icon is-green"><Mail /></span>
                <span className="pa-spec">Up to 10 addresses</span>
              </div>
              <h3>Email the link</h3>
              <p>Past the 25 MB attachment limit. Each address gets its own message with the link and your note.</p>
              <div className="pa-mock"><EmailMock /></div>
            </article>

            <article className="ds-feature" data-reveal>
              <div className="pa-feature-top">
                <span className="ds-icon"><Wifi /></span>
                <span className="pa-spec">Nothing stored</span>
              </div>
              <h3>Device to device</h3>
              <p>Phone to laptop over WebRTC, browser to browser. Pair with a short code. Both screens stay open. Keep it within 6 GB.</p>
              <div className="pa-mock"><DeviceMock /></div>
            </article>

            <article className="ds-feature is-wide" data-reveal style={{ '--d': '80ms' }}>
              <div className="pa-wide-split">
                <div className="grid gap-2.5">
                  <div className="pa-feature-top justify-start">
                    <span className="ds-icon is-dark"><Inbox /></span>
                    <span className="pa-spec">Request link · 7 days</span>
                  </div>
                  <h3>Request files</h3>
                  <p>Make a request link with a title and instructions. Clients or teammates upload up to 6 GB to you, without an account. You sign in to create it.</p>
                  <Link to="/receive" className="ds-link mt-1 w-fit">Make a request link<ArrowRight className="w-4 h-4" /></Link>
                </div>
                <div className="pa-mock"><RequestMock /></div>
              </div>
            </article>
          </div>
        </section>

        <section className="pa-block-lg" aria-labelledby="controls-title">
          <div className="ds-split">
            <div data-reveal>
              <p className="ds-kicker"><b>●</b> Control</p>
              <h2 id="controls-title" className="ds-h2 mt-3">Decide who opens it, and for how long.</h2>
              <p className="ds-lead mt-4">Every send has the same few switches. Set them once, then copy the link.</p>
              <ul className="ds-checks mt-6">
                <li><Check strokeWidth={3} aria-hidden="true" />Password stored as a SHA-256 hash</li>
                <li><Check strokeWidth={3} aria-hidden="true" />Expiry from 1 hour up to 7 days free</li>
                <li><Check strokeWidth={3} aria-hidden="true" />Up to 180 days with Pro</li>
                <li><Check strokeWidth={3} aria-hidden="true" />Files deleted after the link closes</li>
              </ul>
              <Link to="/security" className="ds-link mt-6">How the password works<ArrowRight className="w-4 h-4" /></Link>
            </div>
            <SettingsMock />
          </div>
        </section>

        <section className="pa-block-lg" aria-labelledby="details-title">
          <div className="ds-section-head" data-reveal>
            <p className="ds-kicker"><b>●</b> Details</p>
            <h2 id="details-title" className="ds-h2">Small things that make it work.</h2>
          </div>
          <div className="ds-grid cols-3 mt-10">
            {CONTROLS.map(({ icon: Icon, title, text }, i) => (
              <article key={title} className="ds-feature" data-reveal style={{ '--d': `${(i % 3) * 70}ms` }}>
                <span className="ds-icon mb-2"><Icon /></span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="pa-block-lg" aria-labelledby="limits-title">
          <div className="ds-band" data-reveal>
            <div className="pa-head-row">
              <div className="max-w-xl">
                <p className="ds-kicker text-white/60"><b>●</b> Limits</p>
                <h2 id="limits-title" className="ds-h2 mt-3">Plain numbers, checked on upload.</h2>
              </div>
              <Link to="/pricing" className="ds-btn ds-btn-light">Compare plans<ArrowRight className="ds-btn-arrow w-4 h-4" /></Link>
            </div>
            <div className="pa-stats mt-8">
              {STATS.map((stat) => (
                <div key={stat.label} className="pa-stat">
                  <p className="pa-spec">{stat.label}</p>
                  <p className="pa-stat-value"><CountUp value={stat.value} /><small>{stat.unit}</small></p>
                  <p className="pa-stat-note">{stat.note}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="pa-flush">
          <HomeFaq
            faqs={FAQS}
            title="Questions about features."
            lead="What each part of a transfer does, and where it stops."
          />
        </div>
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
