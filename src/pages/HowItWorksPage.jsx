import { useState } from 'react';
import { Link } from 'react-router-dom';
import PageFrame from '../components/PageFrame';
import AuthModal from '../components/AuthModal';
import ProfileModal from '../components/ProfileModal';
import { HomeFaq } from '../components/home/HomeSections';
import { getStoredUser, clearUserSession } from '../lib/authSession';
import {
  UploadCloud, Link2, Mail, Lock, ArrowRight, Check, Copy, QrCode,
  FileArchive, FileVideo, Wifi, Zap,
} from 'lucide-react';

const STEPS = [
  {
    number: 1,
    title: 'Drop files and pick how they leave',
    desc: 'Drag in files or a folder, up to 6 GB free or 250 GB on Pro. Choose a link, an email, or a device transfer.',
    detail: 'Nothing to install. It runs in the browser tab.',
  },
  {
    number: 2,
    title: 'Set the expiry and a password',
    desc: 'Pick 1 hour, 24 hours, 3 days, or 7 days. Pro adds up to 180 days. A password is optional.',
    detail: 'The password gates the download. The file is uploaded as you selected it.',
  },
  {
    number: 3,
    title: 'Share the link, or let us email it',
    desc: 'Copy the link, show its QR code, or email the link. The message does not attach the file.',
    detail: 'The recipient opens it in a browser, without an account. Speed depends on both connections.',
  },
];

const MODES = [
  {
    icon: Link2,
    tone: 'is-blue',
    title: 'Shareable link',
    body: 'For Slack, WhatsApp, or a client message. Upload once and paste the link anywhere.',
    checks: ['Up to 6 GB free, 250 GB on Pro', 'QR code for the download link', 'Optional password'],
  },
  {
    icon: Zap,
    tone: '',
    title: 'Device to device',
    body: 'For moving a file between a phone and a laptop while both screens stay open.',
    checks: ['Browser to browser over WebRTC', 'Both screens stay open', 'Not saved as a download link'],
  },
  {
    icon: Mail,
    tone: 'is-green',
    title: 'Email the link',
    body: 'For work inboxes that refuse anything over 25 MB. The mail carries the link, not the file.',
    checks: ['Up to 10 recipients', 'The email contains the link', 'Accepted by mail is not opened'],
  },
];

const FAQS = [
  { q: 'Do I need to install anything?', a: 'No. Sending and receiving both happen in a browser tab on a phone or a computer.' },
  { q: 'What does the recipient see?', a: 'A download page with the file names and sizes. If you set a password, they type it first. They do not need an account.' },
  { q: 'How long does an upload take?', a: 'It depends on your connection and theirs. We do not promise a speed.' },
  { q: 'What happens after the link expires?', a: 'The download page stops working. A scheduled cleanup deletes the files from storage.' },
];

function StepOneMock() {
  return (
    <>
      <div className="ds-tabs">
        <span className="ds-tab" aria-pressed="true"><Link2 className="w-3.5 h-3.5" />Link</span>
        <span className="ds-tab"><Mail className="w-3.5 h-3.5" />Email</span>
        <span className="ds-tab"><Wifi className="w-3.5 h-3.5" />Device</span>
      </div>
      <div className="pa-mini-drop mt-4">
        <span><UploadCloud className="w-4 h-4" /></span>
        <p className="ds-row-title">Drop files or a folder</p>
        <p className="ds-row-sub">Up to 6 GB free · no account</p>
      </div>
      <div className="mt-3 rounded-2xl border border-[#e6e8ee]">
        <div className="ds-row">
          <span className="ds-file-icon"><FileVideo className="w-4 h-4" /></span>
          <div className="flex-1 min-w-0"><p className="ds-row-title truncate">launch-film.mp4</p><p className="ds-row-sub">2.1 GB</p></div>
        </div>
        <div className="ds-row">
          <span className="ds-file-icon"><FileArchive className="w-4 h-4" /></span>
          <div className="flex-1 min-w-0"><p className="ds-row-title truncate">press-kit.zip</p><p className="ds-row-sub">340 MB</p></div>
        </div>
      </div>
    </>
  );
}

function StepTwoMock() {
  return (
    <>
      <p className="ds-label">Link expires after</p>
      <div className="mt-2 ds-choices">
        {['1 hour', '24 hours', '3 days', '7 days'].map((label) => (
          <span key={label} className={`ds-choice${label === '3 days' ? ' is-on' : ''}`}>{label}</span>
        ))}
      </div>
      <div className="mt-5 rounded-2xl border border-[#e6e8ee]">
        <div className="ds-row">
          <span className="ds-icon is-sm"><Lock /></span>
          <div className="flex-1 min-w-0"><p className="ds-row-title">Password</p><p className="ds-row-sub">Gates the download</p></div>
          <span className="pa-toggle is-on" />
        </div>
        <div className="ds-row">
          <div className="flex items-center h-10 w-full px-3 rounded-xl border border-[#d5d9e1] bg-white">
            <span className="text-[#060a12] tracking-[0.3em] leading-none">••••••••</span>
          </div>
        </div>
      </div>
      <p className="mt-4 pa-spec">Stored as a SHA-256 hash · not in the email</p>
    </>
  );
}

function StepThreeMock() {
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="ds-row-title">Your link is ready</p>
        <span className="ds-badge ds-badge-green"><Check className="w-3 h-3" />Uploaded</span>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <div className="ds-url"><span className="truncate">sendtoanyone.com/d/<b>launch-film-q8m3x2ta</b></span></div>
        <span className="ds-copy-btn"><span><Copy className="w-3.5 h-3.5" />Copy</span></span>
      </div>
      <div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-4 items-center rounded-2xl border border-[#e6e8ee] p-4">
        <span className="grid place-items-center w-16 h-16 rounded-xl bg-[#f6f7f9] border border-[#e6e8ee]"><QrCode className="w-8 h-8 text-[#060a12]" /></span>
        <div className="min-w-0">
          <p className="ds-row-title">Scan to open on a phone</p>
          <p className="ds-row-sub">Same link as a QR code</p>
        </div>
      </div>
      <div className="mt-3 ds-row rounded-2xl border border-[#e6e8ee]">
        <span className="ds-file-icon bg-[#060a12] text-white"><Mail className="w-4 h-4" /></span>
        <div className="flex-1 min-w-0"><p className="ds-row-title truncate">Sent to 2 addresses</p><p className="ds-row-sub">The email holds the link</p></div>
      </div>
    </>
  );
}

const MOCKS = { 1: StepOneMock, 2: StepTwoMock, 3: StepThreeMock };

export default function HowItWorksPage() {
  const [user, setUser] = useState(() => getStoredUser());
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('signup');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(1);

  const onOpenAuth = (mode = 'signup') => {
    setAuthMode(mode);
    setIsAuthOpen(true);
  };
  const onOpenProfile = () => setIsProfileOpen(true);

  const Mock = MOCKS[activeStep];
  const active = STEPS[activeStep - 1];

  return (
    <>
      <PageFrame
        user={user}
        onOpenAuth={onOpenAuth}
        onOpenProfile={onOpenProfile}
        eyebrow="How it works"
        title="How SendToAnyone works"
        accent={1}
        subtitle="Three steps from your browser to theirs. Nothing to install, and no account to send up to 6 GB."
        actions={(
          <>
            <Link to="/" className="ds-btn ds-btn-dark">Send a file<ArrowRight className="ds-btn-arrow w-4 h-4" /></Link>
            <Link to="/features" className="ds-btn ds-btn-ghost">See features</Link>
          </>
        )}
        nextLabel="Send a file"
        nextTo="/"
      >
        <section aria-labelledby="walkthrough-title">
          <h2 id="walkthrough-title" className="sr-only">Three steps</h2>
          <div className="ds-split items-start">
            <div className="pa-stepper" data-reveal>
              {STEPS.map((step) => (
                <button
                  key={step.number}
                  type="button"
                  className="pa-stepbtn"
                  aria-pressed={activeStep === step.number}
                  onClick={() => setActiveStep(step.number)}
                >
                  <span className="pa-stepnum">0{step.number}</span>
                  <strong>{step.title}</strong>
                  <span>{step.desc}</span>
                </button>
              ))}
              <p className="ds-callout mt-2" aria-live="polite">
                <Check className="w-4 h-4 mt-1 shrink-0 text-[#12a150]" aria-hidden="true" />
                <span>{active.detail}</span>
              </p>
            </div>

            <div className="ds-frame lg:sticky lg:top-24" data-reveal style={{ '--d': '120ms' }}>
              <div className="ds-frame-chrome">
                <span className="ds-frame-dots" aria-hidden="true"><i /><i /><i /></span>
                <span className="pa-screen-bar"><Lock aria-hidden="true" />sendtoanyone.com</span>
                <span className="pa-spec hidden sm:inline-flex">Step 0{activeStep}/03</span>
              </div>
              <div className="ds-frame-screen" aria-hidden="true">
                <div key={activeStep} className="pa-stage">
                  <Mock />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="pa-block-lg" aria-labelledby="modes-title">
          <div className="ds-section-head" data-reveal>
            <p className="ds-kicker"><b>●</b> Transfer modes</p>
            <h2 id="modes-title" className="ds-h2">Pick the mode that fits the person.</h2>
            <p className="ds-lead">Each mode suits a different kind of handoff. The limits stay the same.</p>
          </div>
          <div className="ds-grid cols-3 mt-10">
            {MODES.map(({ icon: Icon, tone, title, body, checks }, i) => (
              <article key={title} className="ds-feature" data-reveal style={{ '--d': `${i * 70}ms` }}>
                <span className={`ds-icon ${tone} mb-2`}><Icon /></span>
                <h3>{title}</h3>
                <p>{body}</p>
                <ul className="ds-checks mt-auto pt-4 border-t border-[#e6e8ee]">
                  {checks.map((c) => <li key={c}><Check strokeWidth={3} aria-hidden="true" />{c}</li>)}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="pa-block-lg" aria-labelledby="after-title">
          <div className="ds-section-head" data-reveal>
            <p className="ds-kicker"><b>●</b> After you send</p>
            <h2 id="after-title" className="ds-h2">What happens on their side.</h2>
          </div>
          <ol className="ds-steps is-row mt-10" style={{ '--n': 3 }}>
            <li className="ds-step" data-reveal>
              <h3>They open the link</h3>
              <p>A download page lists the files and sizes. No account, no app.</p>
            </li>
            <li className="ds-step" data-reveal style={{ '--d': '80ms' }}>
              <h3>They type the password</h3>
              <p>Only if you set one. You share it on another channel.</p>
            </li>
            <li className="ds-step" data-reveal style={{ '--d': '160ms' }}>
              <h3>The link closes</h3>
              <p>On the time you picked. A scheduled cleanup deletes the files.</p>
            </li>
          </ol>
        </section>

        <section className="pa-block-lg" aria-labelledby="ready-title">
          <div className="ds-band text-center" data-reveal>
            <p className="ds-kicker justify-center text-white/60"><b>●</b> Free to start</p>
            <h2 id="ready-title" className="ds-h2 mt-3">Ready to send a file?</h2>
            <p className="ds-lead mt-4 mx-auto max-w-xl">Free, up to 6 GB, with no registration. Links stay open up to 7 days.</p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link to="/" className="ds-btn ds-btn-light ds-btn-lg">Start a transfer<ArrowRight className="ds-btn-arrow w-4 h-4" /></Link>
              <Link to="/pricing" className="ds-btn ds-btn-outline-light ds-btn-lg">See Pro</Link>
            </div>
          </div>
        </section>

        <div className="pa-flush">
          <HomeFaq
            faqs={FAQS}
            title="Before your first send."
            lead="Short answers about installs, recipients, speed, and expiry."
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
