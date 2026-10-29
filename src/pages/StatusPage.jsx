import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import PageFrame from '../components/PageFrame';
import AuthModal from '../components/AuthModal';
import ProfileModal from '../components/ProfileModal';
import { getStoredUser, clearUserSession } from '../lib/authSession';
import { ArrowRight, Clock, Mail, MapPin, RefreshCw, Smartphone, X } from 'lucide-react';

const NOT_REPORTED = [
  { icon: Clock, title: 'Uptime history', text: 'This page keeps no record of past checks. Each visit runs one fresh check.' },
  { icon: MapPin, title: 'Regional latency', text: 'The time shown is from your browser to the API, once. It is not a global average.' },
  { icon: Mail, title: 'Email delivery', text: 'Email is sent by a separate provider. This check does not test it.' },
  { icon: Smartphone, title: 'Device transfer', text: 'Device transfer runs between two browsers. This check does not test it.' },
];

const STATE_COPY = {
  checking: { title: 'Checking the file API…', text: 'Asking the server now.' },
  reachable: { title: 'The file API answered', text: 'The file API responded and reports storage configuration.' },
  unavailable: { title: 'The file API did not answer', text: 'The file API did not respond as available just now.' },
};

export default function StatusPage() {
  const [user, setUser] = useState(() => getStoredUser());
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [apiStatus, setApiStatus] = useState('checking');
  const [lastCheck, setLastCheck] = useState('');
  const [elapsed, setElapsed] = useState(null);
  const [details, setDetails] = useState(null);

  const runCheck = useCallback(async (isCancelled = () => false) => {
    setApiStatus('checking');
    const started = performance.now();
    try {
      const res = await fetch('/api/r2?action=health', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (isCancelled()) return;
      setDetails(data);
      setApiStatus(res.ok && data.configured ? 'reachable' : 'unavailable');
    } catch {
      if (!isCancelled()) {
        setDetails(null);
        setApiStatus('unavailable');
      }
    } finally {
      if (!isCancelled()) {
        setElapsed(Math.round(performance.now() - started));
        setLastCheck(new Date().toLocaleTimeString());
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    runCheck(() => cancelled);
    return () => { cancelled = true; };
  }, [runCheck]);

  const copy = STATE_COPY[apiStatus];
  const light = apiStatus === 'reachable' ? 'is-up' : apiStatus === 'unavailable' ? 'is-down' : '';

  return (
    <>
      <PageFrame
        user={user}
        onOpenAuth={(mode) => { setAuthMode(mode); setIsAuthOpen(true); }}
        onOpenProfile={() => setIsProfileOpen(true)}
        eyebrow="Service check"
        title="What this page can confirm"
        subtitle="This checks whether the file API answers. It does not report uptime, regional latency, email delivery, or storage health."
      >
        <section aria-labelledby="check-title" data-reveal>
          <div className="ds-frame">
            <div className="ds-frame-chrome">
              <span className="ds-frame-dots" aria-hidden="true"><i /><i /><i /></span>
              <span className="ds-mono text-[0.72rem] text-[#6b7486] truncate min-w-0">GET /api/r2?action=health</span>
              <button
                type="button"
                className="ds-btn ds-btn-ghost ds-btn-sm"
                onClick={() => runCheck()}
                disabled={apiStatus === 'checking'}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${apiStatus === 'checking' ? 'motion-safe:animate-spin' : ''}`} aria-hidden="true" />
                Check again
              </button>
            </div>
            <div className="ds-frame-screen pgb-status">
              <div className="pgb-status-main" role="status" aria-live="polite">
                <span className={`pgb-status-light ${light}`} aria-hidden="true"><i /></span>
                <div className="min-w-0 flex-1">
                  <h2 id="check-title" className="pgb-status-title">{copy.title}</h2>
                  <p className="mt-1 text-[0.9375rem] text-[#6b7486]">{copy.text}</p>
                </div>
                {apiStatus === 'reachable' && <span className="ds-badge ds-badge-green">Reachable</span>}
                {apiStatus === 'unavailable' && <span className="ds-badge">Not answering</span>}
              </div>

              <dl className="pgb-kv">
                <div>
                  <dt>Checked at</dt>
                  <dd>{lastCheck || '—'}</dd>
                </div>
                <div>
                  <dt>Round trip</dt>
                  <dd>{elapsed === null ? '—' : `${elapsed} ms`}</dd>
                </div>
                <div>
                  <dt>Storage configured</dt>
                  <dd>{details ? (details.configured ? 'Yes' : 'No') : '—'}</dd>
                </div>
                <div>
                  <dt>Provider</dt>
                  <dd>{details?.provider || '—'}</dd>
                </div>
              </dl>
            </div>
          </div>
          <p className="ds-hint mt-3">
            The round trip is one request from your browser. It changes with your own network.
          </p>
        </section>

        <section className="pt-6" aria-labelledby="not-title">
          <div className="pgb-head" data-reveal>
            <div>
              <p className="ds-kicker"><b>●</b> Not on this page</p>
              <h2 id="not-title" className="ds-h2">What this check leaves out.</h2>
            </div>
          </div>
          <div className="ds-grid cols-2 mt-8">
            {NOT_REPORTED.map(({ icon: Icon, title, text }, i) => (
              <div key={title} className="ds-feature is-soft" data-reveal style={{ '--d': `${i * 60}ms` }}>
                <div className="pgb-tile-top">
                  <span className="ds-icon is-sm"><Icon aria-hidden="true" /></span>
                  <span className="ds-badge"><X className="w-3 h-3" aria-hidden="true" />Not checked</span>
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="ds-callout" data-reveal>
          <p>
            Something broken that this page shows as fine? Tell us on the{' '}
            <Link to="/help" className="ds-link">help page<ArrowRight className="w-3.5 h-3.5" aria-hidden="true" /></Link>
          </p>
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
