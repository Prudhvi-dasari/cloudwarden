import { useState } from 'react';
import PageFrame from '../components/PageFrame';
import AuthModal from '../components/AuthModal';
import ProfileModal from '../components/ProfileModal';
import { getStoredUser, clearUserSession } from '../lib/authSession';
import { Lock, Key, EyeOff, RefreshCw, FileCheck, Server } from 'lucide-react';

const PILLARS = [
  {
    icon: Lock,
    title: 'Locked in transit and at rest',
    desc: 'TLS 1.3 on the way up. Files at rest on Cloudflare R2 use AES-256. Storage is never opened to the public internet.',
  },
  {
    icon: Key,
    title: 'Password gates the download',
    desc: 'An optional password hashes on our servers and blocks the download page until it matches. This is a gate, not zero-knowledge end-to-end encryption.',
  },
  {
    icon: EyeOff,
    title: 'Gone when the link expires',
    desc: 'When the timer ends or the download limit is hit, files are deleted. Executables are blocked on upload.',
  },
  {
    icon: RefreshCw,
    title: 'Device mode stores nothing',
    desc: 'Phone-to-laptop transfers stream over encrypted WebRTC. The file never sits on our servers.',
  },
  {
    icon: FileCheck,
    title: 'One private link per person',
    desc: 'When you email several people, each gets their own link. Addresses stay private to each recipient.',
  },
  {
    icon: Server,
    title: 'Storage behind a proxy',
    desc: 'Object storage is reached only through our API. Keys and buckets stay off the public page.',
  },
];

export default function SecurityPage() {
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
        eyebrow="Security"
        title="Locked on the way. Gone when you say."
        subtitle="Honest controls: encryption in transit, a password that only gates the download, and automatic deletion when the link expires."
        nextLabel="Send a file"
        nextTo="/"
      >
        <div className="grid sm:grid-cols-2 gap-3">
          {PILLARS.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="custom-card p-5 sm:p-6">
                <div className="w-10 h-10 rounded-xl bg-white/8 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-semibold tracking-tight">{item.title}</h2>
                <p className="mt-2 text-sm text-white/55 leading-relaxed">{item.desc}</p>
              </div>
            );
          })}
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
