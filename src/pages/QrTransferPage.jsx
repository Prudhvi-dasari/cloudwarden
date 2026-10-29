import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageFrame from '../components/PageFrame';
import AuthModal from '../components/AuthModal';
import ProfileModal from '../components/ProfileModal';
import P2PTransferView from '../components/P2PTransferView';
import { getStoredUser, clearUserSession } from '../lib/authSession';
import { ArrowRight, RefreshCw, Smartphone } from 'lucide-react';
import { generateP2PCode } from '../lib/p2p';

export default function QrTransferPage() {
  const [user, setUser] = useState(() => getStoredUser());
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [hostCode, setHostCode] = useState(() => generateP2PCode());

  const joinUrl = `${window.location.origin}/?mode=device&room=${encodeURIComponent(hostCode)}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(joinUrl)}&bgcolor=ffffff&color=060a12`;

  useEffect(() => {
    // Keep URL shareable for this host session
    const url = new URL(window.location.href);
    url.searchParams.set('host', hostCode);
    window.history.replaceState({}, '', url.pathname + url.search);
  }, [hostCode]);

  return (
    <>
      <PageFrame
        user={user}
        onOpenAuth={(mode) => { setAuthMode(mode); setIsAuthOpen(true); }}
        onOpenProfile={() => setIsProfileOpen(true)}
        eyebrow="Device transfer · QR"
        title="Scan the code. Send across."
        accent={2}
        subtitle="Open this page on your laptop and scan the code with your phone. The file moves between the two browsers over WebRTC. Nothing is stored on SendToAnyone."
      >
        <section className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] items-start" aria-label="Pair two devices">
          <div className="ds-frame" data-reveal>
            <div className="ds-frame-chrome">
              <span className="ds-frame-dots" aria-hidden="true"><i /><i /><i /></span>
              <span className="ds-badge"><Smartphone className="w-3 h-3" aria-hidden="true" />Scan with your phone</span>
            </div>
            <div className="ds-frame-screen text-center">
              <div className="pgb-qr">
                <img src={qrCodeUrl} alt="QR code that opens this pairing on your phone" width="240" height="240" />
              </div>

              <p className="mt-6 ds-kicker justify-center"><b>●</b> Pairing code</p>
              <p className="mt-2">
                <span className="sr-only">{hostCode}</span>
                <span className="pgb-pair" aria-hidden="true">
                  {hostCode.split('').map((ch, i) => (
                    <span key={`${ch}-${i}`} className={ch === '-' ? 'is-dash' : ''}>{ch}</span>
                  ))}
                </span>
              </p>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setHostCode(generateP2PCode())}
                  className="ds-btn ds-btn-ghost ds-btn-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                  New code
                </button>
                <Link
                  to={`/?mode=device&room=${encodeURIComponent(hostCode)}`}
                  className="ds-btn ds-btn-dark ds-btn-sm"
                >
                  Open as receiver
                  <ArrowRight className="ds-btn-arrow w-3.5 h-3.5" aria-hidden="true" />
                </Link>
              </div>
              <p className="mt-4 ds-hint">
                The phone that scans joins as the receiver. Send from the panel on this device.
              </p>
            </div>
          </div>

          <div className="pgb-device min-w-0" data-reveal style={{ '--d': '100ms' }}>
            <div className="pgb-device-head">
              <span>This device</span>
              <span className="ds-mono text-[0.72rem] text-white/50">{hostCode}</span>
            </div>
            <P2PTransferView preferredCode={hostCode} key={hostCode} />
          </div>
        </section>

        <section className="pt-6" aria-labelledby="qr-steps-title">
          <div className="pgb-head" data-reveal>
            <div>
              <p className="ds-kicker"><b>●</b> How it works</p>
              <h2 id="qr-steps-title" className="ds-h2">Three steps, both screens open.</h2>
            </div>
          </div>
          <ol className="ds-steps is-row mt-8" style={{ '--n': 3 }}>
            <li className="ds-step" data-reveal>
              <h3>Open this page on the sender</h3>
              <p>A new pairing code and QR appear each time.</p>
            </li>
            <li className="ds-step" data-reveal style={{ '--d': '80ms' }}>
              <h3>Scan with the other device</h3>
              <p>The camera opens SendToAnyone with the code filled in.</p>
            </li>
            <li className="ds-step" data-reveal style={{ '--d': '160ms' }}>
              <h3>Keep both screens open</h3>
              <p>The file moves straight across. Closing either tab stops it.</p>
            </li>
          </ol>
        </section>

        <div className="ds-grid cols-2" data-reveal>
          <div className="ds-callout">
            <p>
              Some networks block WebRTC and never connect. If that happens, send a <Link to="/" className="ds-link">cloud link</Link> instead. Keep the file within 6 GB.
            </p>
          </div>
          <div className="ds-callout">
            <p>
              The QR image is drawn by api.qrserver.com from the pairing link. The file itself never goes there.
            </p>
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
