import { useState } from 'react';
import { Link } from 'react-router-dom';
import PageFrame from '../components/PageFrame';
import AuthModal from '../components/AuthModal';
import ProfileModal from '../components/ProfileModal';
import { getStoredUser, clearUserSession } from '../lib/authSession';
import {
  ArrowRight, Check, Copy, Hash, Inbox, Key, Link2, Package, Server, X,
} from 'lucide-react';
import { useToast } from '../components/Toast';

const NOT_AVAILABLE = [
  { icon: Server, title: 'Public REST API', text: 'There is no documented endpoint for other apps to upload or create links.' },
  { icon: Package, title: 'SDKs', text: 'There is no JavaScript, Python, or other client library.' },
  { icon: Key, title: 'API keys', text: 'No keys are issued. Any page that shows one is not ours.' },
];

const SNIPPETS = {
  health: {
    label: 'Health check',
    note: 'The one read-only endpoint you can call today. The status page uses it.',
    code: `curl https://sendtoanyone.com/api/r2?action=health

# The answer includes "configured": true when storage is set up.`,
  },
  mac: {
    label: 'Mac / Linux',
    note: 'Compare a downloaded file with the hash the sender gave you.',
    code: `shasum -a 256 brand-assets.zip
# or on Linux
sha256sum brand-assets.zip`,
  },
  windows: {
    label: 'Windows',
    note: 'PowerShell prints the same SHA-256 the checksum page shows.',
    code: `Get-FileHash .\\brand-assets.zip -Algorithm SHA256`,
  },
};

const INSTEAD = [
  { to: '/', icon: Link2, title: 'Send from the browser', text: 'Upload up to 6 GB free and copy a link. No account.' },
  { to: '/receive', icon: Inbox, title: 'Collect files', text: 'Make a request link. People upload to it from their browser.' },
  { to: '/checksum', icon: Hash, title: 'Check a hash', text: 'Compute SHA-256 in your browser. The file stays on your device.' },
];

export default function ApiDocsPage() {
  const { addToast } = useToast();
  const [user, setUser] = useState(() => getStoredUser());
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [selectedLang, setSelectedLang] = useState('health');
  const [copied, setCopied] = useState(false);

  const active = SNIPPETS[selectedLang];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(active.code);
      setCopied(true);
      addToast('Copied.', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      addToast('Copy failed. Select the text instead.', 'error');
    }
  };

  return (
    <>
      <PageFrame
        user={user}
        onOpenAuth={(mode) => { setAuthMode(mode); setIsAuthOpen(true); }}
        onOpenProfile={() => setIsProfileOpen(true)}
        eyebrow="Developers · Not available"
        title="There is no public API yet."
        accent={2}
        subtitle="Every upload goes through the browser app. There is no SDK, no API key, and no supported way to upload from another application."
        actions={(
          <>
            <Link to="/" className="ds-btn ds-btn-dark">
              Send from the browser
              <ArrowRight className="ds-btn-arrow w-4 h-4" aria-hidden="true" />
            </Link>
            <Link to="/help" className="ds-btn ds-btn-ghost">Ask for an API</Link>
          </>
        )}
      >
        <section aria-label="What does not exist">
          <div className="ds-grid cols-3">
            {NOT_AVAILABLE.map(({ icon: Icon, title, text }, i) => (
              <div key={title} className="ds-feature" data-reveal style={{ '--d': `${i * 60}ms` }}>
                <div className="pgb-tile-top">
                  <span className="ds-icon"><Icon aria-hidden="true" /></span>
                  <span className="ds-badge"><X className="w-3 h-3" aria-hidden="true" />Not public yet</span>
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="ds-split pt-6" aria-labelledby="today-title">
          <div data-reveal>
            <p className="ds-kicker"><b>●</b> What works today</p>
            <h2 id="today-title" className="ds-h2 mt-3">Private endpoints, not a contract.</h2>
            <p className="ds-lead mt-4">
              The app talks to its own endpoints under <code className="ds-inline-code">/api/</code>. They are rate limited and change without notice. Do not build on them.
            </p>
            <p className="ds-lead mt-3">
              Two things are safe to script: the health check, and checking a file you downloaded against a hash.
            </p>
          </div>

          <div className="ds-frame min-w-0" data-reveal style={{ '--d': '100ms' }}>
            <div className="ds-frame-chrome">
              <span className="ds-frame-dots" aria-hidden="true"><i /><i /><i /></span>
              <div className="ds-tabs" role="group" aria-label="Example">
                {Object.entries(SNIPPETS).map(([key, snippet]) => (
                  <button
                    key={key}
                    type="button"
                    className="ds-tab"
                    aria-pressed={selectedLang === key}
                    onClick={() => { setSelectedLang(key); setCopied(false); }}
                  >
                    {snippet.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="ds-frame-screen">
              <div className="pgb-code-wrap">
                <pre className="ds-code"><code>{active.code}</code></pre>
                <button type="button" onClick={handleCopy} className="ds-btn ds-btn-light ds-btn-sm pgb-code-copy">
                  {copied ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="ds-hint mt-3">{active.note}</p>
            </div>
          </div>
        </section>

        <section className="pt-6" aria-labelledby="instead-title">
          <div className="pgb-head" data-reveal>
            <div>
              <p className="ds-kicker"><b>●</b> Instead</p>
              <h2 id="instead-title" className="ds-h2">Do it in the browser.</h2>
            </div>
          </div>
          <div className="ds-grid cols-3 mt-8">
            {INSTEAD.map(({ to, icon: Icon, title, text }, i) => (
              <Link key={to} to={to} className="ds-feature" data-reveal style={{ '--d': `${i * 60}ms` }}>
                <span className="ds-icon is-blue"><Icon aria-hidden="true" /></span>
                <h3>{title}</h3>
                <p>{text}</p>
                <span className="ds-link mt-auto pt-2">Open<ArrowRight className="w-4 h-4" aria-hidden="true" /></span>
              </Link>
            ))}
          </div>
        </section>

        <div className="ds-band" data-reveal>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="max-w-xl">
              <h2 className="ds-h2">Need an API?</h2>
              <p className="ds-lead mt-3">Tell us what you would build. Real requests decide whether one ships.</p>
            </div>
            <Link to="/help" className="ds-btn ds-btn-light ds-btn-lg shrink-0">
              Write to us
              <ArrowRight className="ds-btn-arrow w-4 h-4" aria-hidden="true" />
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
