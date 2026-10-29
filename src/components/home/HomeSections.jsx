import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Check, CheckCircle2, Copy, EyeOff, FileArchive, FileImage, FileVideo,
  Globe2, Inbox, KeyRound, Laptop, Link2, Lock, Mail, Server, Smartphone, Timer, Wifi,
} from 'lucide-react';
import CountUp from '../ds/CountUp';
import { FlagGreeting } from '../ds/HeroSky';

export function JourneyStrip({ countryCode = '', countryName = '' }) {
  return (
    <div className="ds-journey" data-reveal aria-label="What happens when you send">
      <div className="ds-journey-step" style={{ '--i': 0 }}>
        <span className="ds-journey-icon"><FileArchive className="w-4 h-4" /></span>
        <span>
          <small>You drop</small>
          <strong>brand-assets.zip · 2.4 GB</strong>
        </span>
      </div>
      <span className="ds-journey-wire" aria-hidden="true" />
      <div className="ds-journey-step" style={{ '--i': 1 }}>
        <span className="ds-journey-icon"><Link2 className="w-4 h-4" /></span>
        <span>
          <small>Link copied</small>
          <strong className="ds-mono text-[0.8rem]">/d/brand-assets-k3m9x2qa</strong>
        </span>
      </div>
      <span className="ds-journey-wire is-late" aria-hidden="true" />
      <div className="ds-journey-step is-end" style={{ '--i': 2 }}>
        <span className="ds-journey-icon"><CheckCircle2 className="w-4 h-4" /></span>
        <span>
          <small>They open it</small>
          <strong>Download started</strong>
        </span>
      </div>
      <FlagGreeting countryCode={countryCode} countryName={countryName} />
    </div>
  );
}

const PRIVACY_NOTES = [
  { icon: EyeOff, title: 'Private links', text: 'Random, unlisted, kept out of search.' },
  { icon: Globe2, title: 'Global cloud storage', text: "Kept on Cloudflare's network, reachable worldwide." },
  { icon: KeyRound, title: 'Password when you want', text: 'Never written into the email.' },
  { icon: Timer, title: 'Gone on expiry', text: 'Files are deleted when the link closes.' },
];

export function PrivacyNotes() {
  return (
    <ul className="ds-trust" aria-label="How your files are kept">
      {PRIVACY_NOTES.map(({ icon: Icon, title, text }) => (
        <li key={title}>
          <Icon aria-hidden="true" />
          <span><b>{title}</b><span className="ds-trust-note">{text}</span></span>
        </li>
      ))}
    </ul>
  );
}

const FACTS = [
  { label: 'Free transfer', value: 6, unit: 'GB', note: 'Per transfer, without an account.' },
  { label: 'Free link', value: 7, unit: 'days', note: 'You choose anything from 1 hour.' },
  { label: 'Pro transfer', value: 250, unit: 'GB', note: 'Once the server confirms payment.' },
  { label: 'Pro link', value: 180, unit: 'days', note: 'The same link, open six months.' },
];

export function FactsBand() {
  const [health, setHealth] = useState('checking');

  useEffect(() => {
    let alive = true;
    fetch('/api/r2?action=health')
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (alive) setHealth(res.ok && data.configured ? 'up' : 'down');
      })
      .catch(() => { if (alive) setHealth('down'); });
    return () => { alive = false; };
  }, []);

  return (
    <section className="ds-section !pt-10 sm:!pt-14" aria-labelledby="facts-title">
      <div className="ds-wrap">
        <div className="ds-section-head" data-reveal>
          <p className="ds-kicker"><b>●</b> Plain numbers</p>
          <h2 id="facts-title" className="ds-h2">No testimonials yet. Here is what the server enforces.</h2>
          <p className="ds-lead">Every limit below is checked on upload. Nothing here is a marketing estimate.</p>
        </div>

        <div className="ds-facts mt-10" data-reveal style={{ '--d': '80ms' }}>
          {FACTS.map((fact) => (
            <div key={fact.label} className="ds-fact">
              <p className="ds-fact-label">{fact.label}</p>
              <p className="ds-fact-value">
                <CountUp value={fact.value} />
                <small>{fact.unit}</small>
              </p>
              <p className="ds-fact-note">{fact.note}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2" data-reveal style={{ '--d': '160ms' }}>
          <Link to="/status" className="ds-chip">
            {health === 'up' ? (
              <span className="ds-dot-live" aria-hidden="true" />
            ) : (
              <span className="w-2 h-2 rounded-full" style={{ background: health === 'down' ? '#d92d20' : '#9aa1af' }} aria-hidden="true" />
            )}
            {health === 'up' ? 'Upload service reachable now' : health === 'down' ? 'Upload service not answering' : 'Checking upload service…'}
          </Link>
          <span className="ds-chip"><Server className="w-3.5 h-3.5" aria-hidden="true" />Files stored on Cloudflare R2</span>
          <span className="ds-chip"><Check className="w-3.5 h-3.5" aria-hidden="true" />No ads</span>
          <span className="ds-chip"><Timer className="w-3.5 h-3.5" aria-hidden="true" />Deleted after expiry</span>
        </div>
      </div>
    </section>
  );
}

/* Chapter demos */

function LinkDemo() {
  return (
    <div className="ds-demo" data-reveal>
      <div className="ds-demo-card">
        <div className="ds-card-head">
          <span>New transfer</span>
          <span className="ds-badge ds-badge-green"><Check className="w-3 h-3" />Ready</span>
        </div>
        <div className="ds-row">
          <span className="ds-file-icon"><FileArchive className="w-4 h-4" /></span>
          <div className="flex-1 min-w-0">
            <p className="ds-row-title">brand-assets.zip</p>
            <p className="ds-row-sub">2.4 GB · 38 files</p>
          </div>
          <span className="ds-badge">7 days</span>
        </div>
        <div className="ds-row">
          <div className="ds-url"><span className="truncate">sendtoanyone.com/d/<b>brand-assets</b></span></div>
          <span className="ds-copy-btn" aria-hidden="true">
            <span className="is-copy"><Copy className="w-3.5 h-3.5" />Copy</span>
            <span className="is-done"><Check className="w-3.5 h-3.5" />Copied</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function EmailDemo() {
  return (
    <div className="ds-demo" data-reveal>
      <div className="ds-demo-card">
        <div className="ds-card-head">
          <span className="inline-flex items-center gap-2"><Inbox className="w-4 h-4" />Inbox</span>
          <span className="ds-badge ds-badge-blue">1 new</span>
        </div>
        <div className="ds-row items-start">
          <span className="ds-file-icon bg-[#060a12] text-white"><Mail className="w-4 h-4" /></span>
          <div className="flex-1 min-w-0">
            <p className="ds-row-title">Priya sent you brand-assets.zip</p>
            <p className="ds-row-sub">via SendToAnyone · just now</p>
            <div className="mt-3 rounded-xl border border-[#e6e8ee] p-3">
              <p className="text-[13px] text-[#1b2230]">“Final logos and the deck for Monday.”</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="ds-btn ds-btn-blue ds-btn-sm">Download files</span>
                <span className="text-[12px] text-[#6b7486]">2.4 GB · expires in 7 days</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-3 text-[12px] text-[#6b7486]">The mail carries the link. Nothing is attached.</p>
    </div>
  );
}

function DeviceDemo() {
  return (
    <div className="ds-demo" data-reveal>
      <div className="ds-demo-card p-5">
        <div className="flex items-center gap-3">
          <div className="grid place-items-center w-14 h-14 rounded-2xl bg-[#f6f7f9] border border-[#e6e8ee]">
            <Smartphone className="w-6 h-6 text-[#060a12]" />
          </div>
          <div className="flex-1">
            <div className="ds-bar is-loop"><i /></div>
            <p className="mt-2 text-center text-[12px] text-[#6b7486]">IMG_2041.mov · straight across</p>
          </div>
          <div className="grid place-items-center w-14 h-14 rounded-2xl bg-[#f6f7f9] border border-[#e6e8ee]">
            <Laptop className="w-6 h-6 text-[#060a12]" />
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[12px] font-semibold text-[#6b7486] mb-2">Pair code</p>
            <div className="ds-digits">
              {['4', '8', '1', '2'].map((d, i) => <span key={i} style={{ '--i': i }}>{d}</span>)}
            </div>
          </div>
          <span className="ds-badge ds-badge-green"><Wifi className="w-3 h-3" />Same network · nothing stored</span>
        </div>
      </div>
    </div>
  );
}

function RequestDemo() {
  const incoming = [
    { name: 'ceremony-01.jpg', meta: '8.2 MB · from Anika', icon: FileImage },
    { name: 'first-dance.mp4', meta: '1.1 GB · from Rahul', icon: FileVideo },
    { name: 'family-portraits.zip', meta: '640 MB · from Meera', icon: FileArchive },
  ];
  return (
    <div className="ds-demo" data-reveal>
      <div className="ds-demo-card">
        <div className="ds-card-head">
          <span>Request · Wedding photos</span>
          <span className="ds-badge">Open</span>
        </div>
        <div className="ds-row">
          <div className="ds-url"><span className="truncate">sendtoanyone.com/request/<b>wedding</b></span></div>
        </div>
        <div className="ds-stack-in">
          {incoming.map((file, i) => (
            <div key={file.name} className="ds-row" style={{ '--i': i }}>
              <span className="ds-file-icon"><file.icon className="w-4 h-4" /></span>
              <div className="flex-1 min-w-0">
                <p className="ds-row-title truncate">{file.name}</p>
                <p className="ds-row-sub">{file.meta}</p>
              </div>
              <CheckCircle2 className="w-4 h-4 text-[#12a150]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PasswordDemo() {
  return (
    <div className="ds-demo" data-reveal>
      <div className="ds-demo-card p-6 text-center">
        <div className="mx-auto grid place-items-center w-12 h-12 rounded-2xl bg-[#060a12] text-white">
          <Lock className="w-5 h-5" />
        </div>
        <p className="mt-4 ds-row-title">brand-assets.zip is locked</p>
        <p className="ds-row-sub">Enter the password the sender gave you.</p>
        <div className="mt-4 mx-auto max-w-[17rem] flex items-center h-11 px-3 rounded-xl border border-[#d5d9e1] bg-white">
          <span className="ds-typing flex items-center">
            {Array.from({ length: 8 }, (_, i) => <span key={i} style={{ '--i': i }} />)}
          </span>
        </div>
        <span className="mt-3 ds-btn ds-btn-dark ds-btn-sm">Unlock download</span>
      </div>
      <p className="mt-3 text-[12px] text-[#6b7486]">The server keeps a salted hash. The password gates the download; it does not encrypt the file.</p>
    </div>
  );
}

function ExpiryDemo() {
  return (
    <div className="ds-demo" data-reveal>
      <div className="ds-demo-card">
        <div className="ds-card-head">
          <span>Link stays open</span>
          <span className="ds-badge"><Timer className="w-3 h-3" />Auto delete</span>
        </div>
        <div className="ds-card-body">
          <div className="ds-scale">
            <span className="ds-scale-pin">Expires</span>
            <div className="ds-scale-track" />
            <div className="ds-scale-marks">
              <span>1h</span><span>24h</span><span>3d</span><span>7d</span><span>180d</span>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="ds-badge ds-badge-blue">Free · up to 7 days</span>
            <span className="ds-badge ds-badge-dark">Pro · up to 180 days</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const CHAPTERS = [
  {
    id: 'link',
    nav: 'Link',
    title: 'Copy one link. Paste it anywhere.',
    lead: 'Drop the files and get a download page. Send it on WhatsApp, Slack, or a text. The other person does not need an account.',
    checks: ['A readable link you can name', 'Download page with file list and size', 'Works from any browser'],
    mode: 'link',
    cta: 'Create a link',
    Demo: LinkDemo,
  },
  {
    id: 'email',
    nav: 'Email',
    title: 'Too big for the inbox? Mail the link.',
    lead: 'Type their address and we send a short email with the download button. The file stays on the link, so size limits of mail servers never apply.',
    checks: ['Recipient gets a clean email', 'Your note and title travel with it', 'Up to 6 GB free'],
    mode: 'email',
    cta: 'Send by email',
    Demo: EmailDemo,
  },
  {
    id: 'device',
    nav: 'Device',
    title: 'Phone to laptop, straight across.',
    lead: 'Open SendToAnyone on both screens, pair with a short code, and the file moves over WebRTC on the same network. Nothing from it is stored here.',
    checks: ['No upload to storage', 'Pair with a short code', 'Both screens stay on this page'],
    mode: 'device',
    cta: 'Pair a device',
    Demo: DeviceDemo,
  },
  {
    id: 'request',
    nav: 'Request',
    title: 'Need files from someone? Ask with a link.',
    lead: 'Share a request link. They add files to it from their own browser, without an account.',
    checks: ['They upload without signup', 'One link to share', 'Works from any browser'],
    to: '/receive',
    cta: 'Make a request link',
    Demo: RequestDemo,
  },
  {
    id: 'password',
    nav: 'Password',
    title: 'Put a password on the download.',
    lead: 'Turn on the password and the download page waits until it matches. The notification email never includes it, so you share it separately.',
    checks: ['Stored as a salted hash', 'Left out of every email', 'Optional on every transfer'],
    mode: 'link',
    cta: 'Send with a password',
    Demo: PasswordDemo,
  },
  {
    id: 'expiry',
    nav: 'Expiry',
    title: 'Pick when it disappears.',
    lead: 'Choose one hour, a day, three days, or a week. When the time runs out the link closes and the files are deleted from storage.',
    checks: ['From 1 hour to 7 days free', 'Up to 180 days with Pro', 'Deletion runs on a schedule'],
    mode: 'link',
    cta: 'Choose an expiry',
    Demo: ExpiryDemo,
  },
];

function ChapterStage({ chapters, onPickMode }) {
  const trackRef = useRef(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;
    const onScroll = () => {
      const rect = track.getBoundingClientRect();
      const total = track.offsetHeight - window.innerHeight;
      if (total <= 0) return;
      const passed = Math.min(Math.max(-rect.top, 0), total);
      const next = Math.min(chapters.length - 1, Math.floor((passed / total) * chapters.length));
      setIndex((current) => (current === next ? current : next));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [chapters.length]);

  const chapter = chapters[index];

  return (
    <div className="ds-stage" ref={trackRef} style={{ '--steps': chapters.length }}>
      <div className="ds-stage-pin">
        <div className="ds-stage-copy">
          <p className="ds-kicker"><b>{String(index + 1).padStart(2, '0')}</b> {chapter.nav}</p>
          <h3 className="ds-h2 ds-stage-title" key={chapter.id}>{chapter.title}</h3>
          <p className="ds-lead">{chapter.lead}</p>
          <ul className="ds-checks">
            {chapter.checks.map((item) => <li key={item}><Check strokeWidth={3} aria-hidden="true" />{item}</li>)}
          </ul>
          <div className="ds-chapter-cta">
            {chapter.to ? (
              <Link to={chapter.to} className="ds-link">{chapter.cta}<ArrowRight className="w-4 h-4" /></Link>
            ) : (
              <button type="button" className="ds-link" onClick={() => onPickMode?.(chapter.mode)}>
                {chapter.cta}<ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
          <ol className="ds-stage-steps">
            {chapters.map((item, i) => (
              <li key={item.id} className={i === index ? 'is-on' : i < index ? 'is-done' : ''}>
                <span>{String(i + 1).padStart(2, '0')}</span>
                {item.nav}
              </li>
            ))}
          </ol>
        </div>
        <div className="ds-stage-frame" aria-live="polite">
          {chapters.map((item, i) => (
            <div className={`ds-stage-pane ${i === index ? 'is-on' : ''}`} key={item.id} aria-hidden={i !== index}>
              <item.Demo />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Chapters({ onPickMode }) {
  const [active, setActive] = useState(CHAPTERS[0].id);
  const refs = useRef({});

  useEffect(() => {
    if (!('IntersectionObserver' in window)) return undefined;
    const io = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActive(visible[0].target.id.replace('ch-', ''));
    }, { rootMargin: '-35% 0px -55% 0px' });
    Object.values(refs.current).forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <section id="how-it-works" className="ds-section bg-[#f6f7f9] border-y border-[#e6e8ee]" aria-labelledby="chapters-title">
      <div className="ds-wrap">
        <div className="ds-section-head" data-reveal>
          <p className="ds-kicker"><b>●</b> Six ways in</p>
          <h2 id="chapters-title" className="ds-h2">One drop. Every way a file needs to travel.</h2>
          <p className="ds-lead">Pick the path that fits the person on the other side. The limits stay the same.</p>
        </div>

        <ChapterStage chapters={CHAPTERS} onPickMode={onPickMode} />

        <div className="ds-chapter-flow ds-chapters mt-14">
          <nav className="ds-toc" aria-label="Chapters">
            <p>Contents</p>
            <ol>
              {CHAPTERS.map((ch, i) => (
                <li key={ch.id}>
                  <a href={`#ch-${ch.id}`} className={active === ch.id ? 'is-active' : ''}>
                    <span>{String(i + 1).padStart(2, '0')}</span>
                    {ch.nav}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="grid gap-14">
            {CHAPTERS.map((ch, i) => (
              <article
                key={ch.id}
                id={`ch-${ch.id}`}
                ref={(el) => { refs.current[ch.id] = el; }}
                className="ds-chapter"
              >
                <div data-reveal>
                  <p className="ds-kicker"><b>{String(i + 1).padStart(2, '0')}</b> {ch.nav}</p>
                  <h3 className="ds-h2">{ch.title}</h3>
                  <p className="ds-lead">{ch.lead}</p>
                  <ul className="ds-checks">
                    {ch.checks.map((c) => <li key={c}><Check strokeWidth={3} aria-hidden="true" />{c}</li>)}
                  </ul>
                  <div className="ds-chapter-cta">
                    {ch.to ? (
                      <Link to={ch.to} className="ds-link">{ch.cta}<ArrowRight className="w-4 h-4" /></Link>
                    ) : (
                      <button type="button" className="ds-link" onClick={() => onPickMode?.(ch.mode)}>
                        {ch.cta}<ArrowRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                <ch.Demo />
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function HomeFaq({
  faqs,
  title = 'Straight answers before you send.',
  lead = 'What the uploader above does, what it does not, and where the file goes.',
}) {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="ds-section" aria-labelledby="faq-title">
      <div className="ds-wrap ds-faq">
        <div data-reveal>
          <p className="ds-kicker"><b>●</b> Questions</p>
          <h2 id="faq-title" className="ds-h2 mt-3">{title}</h2>
          <p className="ds-lead mt-4">{lead}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/help" className="ds-btn ds-btn-ghost">Help center</Link>
            <Link to="/security" className="ds-link">Security details<ArrowRight className="w-4 h-4" /></Link>
          </div>
        </div>
        <ul className="ds-faq-list" data-reveal style={{ '--d': '100ms' }}>
          {faqs.map((faq, i) => {
            const isOpen = open === i;
            return (
              <li key={faq.q} className={`ds-faq-item ${isOpen ? 'is-open' : ''}`}>
                <button
                  type="button"
                  className="ds-faq-q"
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-a-${i}`}
                >
                  <span>{faq.q}</span>
                  <span className="ds-faq-plus" aria-hidden="true" />
                </button>
                <div id={`faq-a-${i}`} className="ds-faq-a" role="region">
                  <div><p>{faq.a}</p></div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
