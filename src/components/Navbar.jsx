import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { isAdmin, isUserPro } from '../lib/authSession';
import { useAccount } from '../lib/AccountContext';
import {
  Send, Crown, FolderKanban, Menu, X,
  ChevronDown, Wifi, Link2, Mail, ArrowRight, Lock, QrCode, Hash, Zap, Inbox, HelpCircle, Scale
} from 'lucide-react';

const NAV_LINKS = [
  { label: 'Transfer', path: '/', tab: 'transfer' },
  { label: 'Receive', path: '/receive' },
  { label: 'Device', path: '/?mode=device' },
  { label: 'Pricing', path: '/pricing', hidePro: true },
  { label: 'Security', path: '/security' },
];

const MORE_GROUPS = [
  {
    label: 'Send another way',
    items: [
      { title: 'QR Transfer', desc: 'Scan to move a file between two screens', path: '/qr-transfer', icon: QrCode },
      { title: 'Email Transfer', desc: 'Past the inbox size limit, link in the mail', path: '/send-files-by-email', icon: Mail },
    ],
  },
  {
    label: 'Check a file',
    items: [
      { title: 'Checksum', desc: 'Verify a download has not changed', path: '/checksum', icon: Hash },
      { title: 'Compare', desc: 'See iTransfer next to the usual tools', path: '/compare', icon: Scale },
    ],
  },
  {
    label: 'Learn',
    items: [
      { title: 'Features', desc: 'What you can send and how it arrives', path: '/features', icon: Zap },
      { title: 'Help', desc: 'Answers and a way to reach us', path: '/help', icon: HelpCircle },
    ],
  },
];

export default function Navbar({ onOpenAuth, onOpenProfile, activeTab, setActiveTab }) {
  const { user } = useAccount();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (navRef.current && !navRef.current.contains(event.target)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    setMoreOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 12);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isDevice = location.pathname === '/' && new URLSearchParams(location.search).get('mode') === 'device';
  const isTransferHome = location.pathname === '/' && !isDevice && (!activeTab || activeTab === 'transfer');

  let itemIndex = 0;

  return (
    <header
      ref={navRef}
      className="sticky top-0 z-50 select-none bg-transparent px-3 sm:px-4 pt-3"
    >
      <div className={`mx-auto max-w-6xl rounded-full border text-white transition-colors duration-300 ${
        scrolled
          ? 'border-white/15 bg-[#0b1020]/92 backdrop-blur-xl'
          : 'border-white/12 bg-[#0b1020]/80 backdrop-blur-xl'
      }`}>
        <div className="h-14 px-2 sm:px-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 min-w-0">
            <Link
              to="/"
              className="flex items-center gap-2.5 group shrink-0 pl-1.5 pr-2"
              onClick={() => setActiveTab?.('transfer')}
            >
              <span className="nav-mark" aria-hidden="true">
                <Send className="w-3.5 h-3.5 text-black" />
              </span>
              <span className="text-[15px] sm:text-base font-semibold tracking-tight text-white">
                iTransfer
              </span>
            </Link>

            <nav className="hidden lg:flex items-center gap-0.5 text-[13px] font-medium text-white/70 ml-2">
              {NAV_LINKS.filter((l) => !(l.hidePro && isUserPro(user))).map((item) => {
                const active = item.path.includes('mode=device')
                  ? isDevice
                  : item.path === '/'
                    ? isTransferHome
                    : location.pathname === item.path;
                return (
                  <Link
                    key={item.label}
                    to={item.path}
                    onClick={() => {
                      if (item.tab) setActiveTab?.(item.tab);
                    }}
                    className={`nav-link ${active ? 'is-active' : ''}`}
                  >
                    {item.label}
                  </Link>
                );
              })}

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMoreOpen((v) => !v)}
                  className={`nav-link ${moreOpen ? 'is-active' : ''}`}
                  aria-expanded={moreOpen}
                >
                  More
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${moreOpen ? 'rotate-180' : ''}`} />
                </button>
                <div className={`nav-more ${moreOpen ? 'open' : ''}`} inert={!moreOpen}>
                  <div className="nav-more-panel">
                    {MORE_GROUPS.map((group) => (
                      <div key={group.label} className="nav-more-group">
                        <p className="nav-more-label">{group.label}</p>
                        {group.items.map((item) => {
                          const Icon = item.icon;
                          const delay = moreOpen ? `${50 + itemIndex * 40}ms` : '0ms';
                          itemIndex += 1;
                          return (
                            <Link
                              key={item.path}
                              to={item.path}
                              style={{ transitionDelay: delay }}
                              className="nav-more-item"
                              onClick={() => setMoreOpen(false)}
                            >
                              <span className="nav-more-icon">
                                <Icon className="w-4 h-4" />
                              </span>
                              <span className="min-w-0">
                                <span className="block text-sm font-semibold text-white">{item.title}</span>
                                <span className="block text-[11px] text-white/45 leading-snug mt-0.5">{item.desc}</span>
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </nav>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 pr-1">
            {user ? (
              <>
                {isAdmin(user) && (
                  <button
                    type="button"
                    onClick={() => onOpenProfile?.()}
                    className="hidden sm:flex px-2.5 py-1.5 rounded-full bg-white/10 text-white text-xs font-semibold items-center gap-1 border border-white/15 cursor-pointer"
                  >
                    <Crown className="w-3.5 h-3.5" />
                    Admin
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveTab?.(activeTab === 'dashboard' ? 'transfer' : 'dashboard')}
                  className={`hidden sm:flex px-3 py-1.5 rounded-full text-xs font-semibold items-center gap-1.5 cursor-pointer transition-all ${
                    activeTab === 'dashboard'
                      ? 'bg-white text-black'
                      : 'text-white bg-white/5 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  <FolderKanban className="w-3.5 h-3.5" />
                  My Files
                </button>
                <button
                  type="button"
                  onClick={() => onOpenProfile?.()}
                  className="w-8 h-8 rounded-full bg-white text-black font-semibold text-xs flex items-center justify-center cursor-pointer"
                >
                  {user.email?.[0]?.toUpperCase() || 'U'}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onOpenAuth?.('login')}
                  className="text-xs font-semibold px-2.5 py-1.5 rounded-full text-white/75 hover:text-white hover:bg-white/10 cursor-pointer"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAuth?.('signup')}
                  className="text-xs font-semibold px-3 py-1.5 sm:px-4 rounded-full bg-white text-black cursor-pointer flex items-center gap-1 hover:bg-white/90"
                >
                  Get Started
                  <ArrowRight className="w-3.5 h-3.5 hidden sm:inline" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="lg:hidden grid h-8 w-8 place-items-center rounded-full bg-white text-black outline-none"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden mx-auto mt-2 max-w-6xl overflow-hidden rounded-[28px] bg-white text-[#14151c] shadow-[0_24px_50px_-24px_rgba(12,20,48,0.55)]">
          <div className="grid grid-cols-4 gap-1 p-2">
            {[
              { to: '/', label: 'Link', icon: Link2, onClick: () => setActiveTab?.('transfer') },
              { to: '/?mode=device', label: 'Device', icon: Wifi },
              { to: '/receive', label: 'Request', icon: Inbox },
              { to: '/security', label: 'Security', icon: Lock },
            ].map((item) => (
              <Link
                key={item.label}
                to={item.to}
                onClick={() => { setMobileMenuOpen(false); item.onClick?.(); }}
                className="flex flex-col items-center gap-1 rounded-2xl bg-slate-50 py-3 text-[11px] font-semibold text-slate-700"
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            ))}
          </div>
          <div className="max-h-[42vh] overflow-y-auto px-2 pb-2">
            {MORE_GROUPS.map((group) => (
              <div key={group.label} className="pt-1">
                <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-[0.16em] text-slate-400 font-semibold">{group.label}</p>
                {group.items.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-slate-50"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-700">
                      <item.icon className="w-4 h-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-slate-900">{item.title}</span>
                      <span className="block truncate text-[11px] text-slate-500">{item.desc}</span>
                    </span>
                  </Link>
                ))}
              </div>
            ))}
            {!isUserPro(user) && (
              <Link
                to="/pricing"
                onClick={() => setMobileMenuOpen(false)}
                className="mt-1 flex items-center justify-center rounded-2xl bg-slate-900 py-3 text-sm font-semibold text-white"
              >
                Pricing
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
