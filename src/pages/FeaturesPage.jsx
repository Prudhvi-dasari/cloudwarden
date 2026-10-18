import { useState } from 'react';
import PageFrame from '../components/PageFrame';
import AuthModal from '../components/AuthModal';
import ProfileModal from '../components/ProfileModal';
import { getStoredUser, clearUserSession } from '../lib/authSession';
import { Link2, Mail, Wifi, Inbox, Lock, Clock, QrCode, Smartphone } from 'lucide-react';

const SECTIONS = [
  {
    category: 'Ways to send',
    items: [
      { icon: Link2, title: 'Shareable links', desc: 'A download link in seconds. Copy it, send it on WhatsApp, or show a QR.', badge: 'Up to 6 GB' },
      { icon: Mail, title: 'Email dispatch', desc: 'Past the inbox size limit. The file stays on the link, not in the mail.', badge: 'Multi-recipient' },
      { icon: Wifi, title: 'Device P2P', desc: 'Phone to laptop on the same network. Nothing is stored on our servers.', badge: 'No size cap' },
      { icon: Inbox, title: 'File requests', desc: 'A portal so a client can send files back to you without an account.', badge: 'Drop portal' },
    ],
  },
  {
    category: 'Control',
    items: [
      { icon: Lock, title: 'Password gate', desc: 'Optional. Blocks the download page until the passphrase matches.', badge: 'Free' },
      { icon: Clock, title: 'Expiry you choose', desc: 'From one hour up to 7 days. Longer retention is not available yet.', badge: 'Up to 7 days' },
      { icon: QrCode, title: 'QR handoff', desc: 'Scan between two screens when typing a link would slow you down.', badge: 'Phone ↔ laptop' },
      { icon: Smartphone, title: 'Works in the browser', desc: 'iOS, Android, macOS, Windows, Linux. No install for a one-off send.', badge: 'Universal' },
    ],
  },
];

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
        subtitle="Link, email, device, or a request portal. Pick the path that fits the moment."
        nextLabel="Send a file"
        nextTo="/"
      >
        <div className="space-y-10">
          {SECTIONS.map((section) => (
            <div key={section.category}>
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/40 mb-4">{section.category}</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {section.items.map((feat) => {
                  const Icon = feat.icon;
                  return (
                    <div key={feat.title} className="custom-card p-5 sm:p-6">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-white/8 flex items-center justify-center">
                          <Icon className="w-5 h-5" />
                        </div>
                        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-white/10 text-white/50">{feat.badge}</span>
                      </div>
                      <h2 className="text-lg font-semibold tracking-tight">{feat.title}</h2>
                      <p className="mt-2 text-sm text-white/55 leading-relaxed">{feat.desc}</p>
                    </div>
                  );
                })}
              </div>
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
