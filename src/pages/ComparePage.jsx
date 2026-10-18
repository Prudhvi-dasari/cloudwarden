import { useState } from 'react';
import PageFrame from '../components/PageFrame';
import AuthModal from '../components/AuthModal';
import ProfileModal from '../components/ProfileModal';
import { getStoredUser, clearUserSession } from '../lib/authSession';

const ROWS = [
  { feature: 'Free size (no signup)', itransfer: '6 GB + device transfer', wetransfer: '2 GB', transfernow: '5 GB', swiss: '50 GB', highlight: true },
  { feature: 'Device P2P', itransfer: 'Yes · nothing stored', wetransfer: 'No', transfernow: 'No', swiss: 'No', highlight: true },
  { feature: 'Password on free', itransfer: 'Yes', wetransfer: 'Paid only', transfernow: 'Paid only', swiss: 'Yes', highlight: true },
  { feature: 'Ads', itransfer: 'None', wetransfer: 'Full screen', transfernow: 'Light', swiss: 'None', highlight: true },
  { feature: 'Checksum tool', itransfer: 'Built-in', wetransfer: 'No', transfernow: 'No', swiss: 'No', highlight: true },
  { feature: 'Public API', itransfer: 'Not offered today', wetransfer: 'Limited', transfernow: 'Paid', swiss: 'No', highlight: false },
  { feature: 'Embed widget', itransfer: 'File request links only', wetransfer: 'No', transfernow: 'Enterprise', swiss: 'No', highlight: false },
];

export default function ComparePage() {
  const [user, setUser] = useState(() => getStoredUser());
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('signup');
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <>
      <PageFrame
        user={user}
        onOpenAuth={(mode) => { setAuthMode(mode); setIsAuthOpen(true); }}
        onOpenProfile={() => setIsProfileOpen(true)}
        eyebrow="Compare"
        title="iTransfer next to the usual options."
        subtitle="Honest rows. Where we win, and where we do not yet ship a public API or embed widget."
        nextLabel="Send a file"
        nextTo="/"
      >
        <div className="compare-board hidden md:block">
          <div className="compare-head" style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1fr' }}>
            <span />
            <span className="compare-us">iTransfer</span>
            <span>WeTransfer</span>
            <span>TransferNow</span>
            <span>SwissTransfer</span>
          </div>
          {ROWS.map((row) => (
            <div key={row.feature} className="compare-row" style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1fr' }}>
              <span>{row.feature}</span>
              <span className={row.highlight ? 'compare-us' : ''}>{row.itransfer}</span>
              <span>{row.wetransfer}</span>
              <span>{row.transfernow}</span>
              <span>{row.swiss}</span>
            </div>
          ))}
        </div>

        <div className="md:hidden space-y-3">
          {ROWS.map((row) => (
            <div key={row.feature} className="rounded-2xl border border-white/10 bg-[#17192e] px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-white/40 mb-2">{row.feature}</p>
              <p className="text-base font-semibold text-white">iTransfer · {row.itransfer}</p>
              <p className="mt-2 text-sm text-white/45 leading-relaxed">
                WeTransfer {row.wetransfer} · TransferNow {row.transfernow} · SwissTransfer {row.swiss}
              </p>
            </div>
          ))}
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
