import { useState } from 'react';
import { Link } from 'react-router-dom';
import PageFrame from '../components/PageFrame';
import AuthModal from '../components/AuthModal';
import ProfileModal from '../components/ProfileModal';
import { getStoredUser, clearUserSession } from '../lib/authSession';
import { ArrowRight, BrainCircuit, Clock, Lock, Server, Wifi } from 'lucide-react';

const GLANCE = [
  { icon: Wifi, title: 'Device transfer', text: 'Both screens open. Not saved as a download link.' },
  { icon: Server, title: 'Cloud links', text: 'Stored until the expiry you set.' },
  { icon: Lock, title: 'Password', text: 'Gates the download. Does not encrypt the file.' },
  { icon: BrainCircuit, title: 'AI training', text: 'Your files are not used to train models.' },
];

export default function PrivacyPage() {
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
        eyebrow="Privacy, in plain language"
        title="How Privacy Works on SendToAnyone"
        accent={1}
        subtitle="We believe in total transparency. Your files are never scanned, analyzed, or used to train artificial intelligence models."
      >
        <div className="ds-chapters">
          <aside className="order-2 lg:order-none" aria-label="At a glance">
            <div className="ds-card-soft p-5 lg:sticky lg:top-24" data-reveal>
              <p className="ds-kicker"><b>●</b> At a glance</p>
              <ul className="pgb-summary mt-4">
                {GLANCE.map(({ icon: Icon, title, text }) => (
                  <li key={title}>
                    <span className="ds-icon is-sm bg-white"><Icon aria-hidden="true" /></span>
                    <span><b>{title}</b>{text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          <article className="ds-prose" data-reveal style={{ '--d': '80ms' }}>
            <section id="device" className="pgb-doc-section">
              <h2><span className="pgb-num">01</span>Direct Browser-to-Browser Streaming (P2P)</h2>
              <p><span className="ds-badge ds-badge-green">Not stored as a link</span></p>
              <p>
                A device transfer needs both screens open. The file is not saved as a download link. Keep it within 6 GB. That path does not raise the cloud cap, and this page does not call it end-to-end encryption.
              </p>
              <ul>
                <li>Keep the file within 6 GB</li>
                <li>Not saved as a download link</li>
              </ul>
            </section>

            <section id="cloud" className="pgb-doc-section">
              <h2><span className="pgb-num">02</span>Ephemeral Share Links &amp; Email Delivery</h2>
              <p><span className="ds-badge ds-badge-blue"><Clock className="w-3 h-3" aria-hidden="true" />Expires</span></p>
              <p>
                A cloud transfer is stored until the expiry you set, up to 7 days. A password, if you add one, gates the download and does not encrypt the file.
              </p>
              <ul>
                <li>Files automatically self-destruct once your selected expiration date (1h up to 7d) is reached.</li>
                <li>Optional password protection requires the secret key before metadata or downloads are permitted.</li>
              </ul>
            </section>

            <div className="pgb-doc-section">
              <p className="text-[0.9375rem] text-[#6b7486]">
                Related: <Link to="/terms">Terms</Link>, <Link to="/compliance">data handling notes</Link>, and <Link to="/security">security details</Link>.
              </p>
            </div>
          </article>
          <div className="lg:col-start-2 order-3 lg:order-none lg:-mt-12">
            <Link to="/" className="ds-btn ds-btn-dark">
              Send a file
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
