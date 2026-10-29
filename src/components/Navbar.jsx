import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { isAdmin, isUserPro } from '../lib/authSession';
import { useAccount } from '../lib/AccountContext';
import { myFilesAction } from '../lib/myFilesNav';
import MyUploadsDrawer from './MyUploadsDrawer';
import {
  Send, Crown, FolderKanban, Menu, X,
  ChevronDown, Wifi, Link2, Mail, ArrowRight, Lock, QrCode, Hash, Zap, Inbox, HelpCircle, Scale, BookOpen,
  AppWindow, Users, Code2, Blocks, Activity, ScrollText,
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
      { title: 'Large files', desc: '6 GB, no account, link up to 7 days', path: '/send-large-files', icon: Link2 },
      { title: 'No account', desc: 'Sender and recipient can both skip signup', path: '/send-files-without-signup', icon: Send },
      { title: 'How to send', desc: 'The message carries the link, not the file', path: '/how-to-send-large-files', icon: Mail },
    ],
  },
  {
    label: 'Check a file',
    items: [
      { title: 'Checksum', desc: 'Verify a download has not changed', path: '/checksum', icon: Hash },
      { title: 'Compare', desc: 'See SendToAnyone next to the usual tools', path: '/compare', icon: Scale },
    ],
  },
  {
    label: 'Learn',
    items: [
      { title: 'Features', desc: 'What you can send and how it arrives', path: '/features', icon: Zap },
      { title: 'How it works', desc: 'A walkthrough of link, email, and device transfer', path: '/how-it-works', icon: BookOpen },
      { title: 'Resources', desc: 'Guides for size, password, and requests', path: '/resources', icon: BookOpen },
      { title: 'Help', desc: 'Answers and a way to reach us', path: '/help', icon: HelpCircle },
    ],
  },
  {
    label: 'Product',
    items: [
      { title: 'Apps', desc: 'What exists today, and what does not', path: '/apps', icon: AppWindow },
      { title: 'Teams', desc: 'Shared sending is not a billed plan yet', path: '/teams', icon: Users },
      { title: 'API', desc: 'Notes for the transfer routes', path: '/api-docs', icon: Code2 },
      { title: 'Widget', desc: 'A preview of an embed, not a live install', path: '/widget', icon: Blocks },
      { title: 'Compliance', desc: 'What this product does not certify', path: '/compliance', icon: Lock },
      { title: 'Status', desc: 'Whether the service is up', path: '/status', icon: Activity },
      { title: 'Changelog', desc: 'What changed in the product', path: '/changelog', icon: ScrollText },
    ],
  },
];

export default function Navbar({ onOpenAuth, onOpenProfile, activeTab, setActiveTab, onOpenMyUploads, myFilesOpen = false }) {
  const { user } = useAccount();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef(null);
  const myFilesActive = activeTab === 'dashboard' || Boolean(myFilesOpen) || filesOpen;

  function closeMenus() {
    setMoreOpen(false);
    setMobileMenuOpen(false);
  }

  function openMyFiles() {
    closeMenus();
    const action = myFilesAction({
      hasDashboardToggle: typeof setActiveTab === 'function',
      hasParentDrawer: typeof onOpenMyUploads === 'function',
    });
    if (action === 'dashboard') {
      setActiveTab(activeTab === 'dashboard' ? 'transfer' : 'dashboard');
      return;
    }
    if (action === 'parent-drawer') {
      onOpenMyUploads();
      return;
    }
    setFilesOpen((open) => !open);
  }

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
    setFilesOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!moreOpen && !mobileMenuOpen) return undefined;
    function onKey(event) {
      if (event.key !== 'Escape') return;
      closeMenus();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [moreOpen, mobileMenuOpen]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isDevice = location.pathname === '/' && new URLSearchParams(location.search).get('mode') === 'device';
  const isTransferHome = location.pathname === '/' && !isDevice && (!activeTab || activeTab === 'transfer');

  return (
    <header
      ref={navRef}
      className={`ds-nav select-none ${scrolled || mobileMenuOpen ? 'is-scrolled' : ''}`}
    >
      <div className="ds-wrap ds-nav-bar">
        <div className="flex items-center min-w-0">
          <Link
            to="/"
            className="ds-logo"
            onClick={() => setActiveTab?.('transfer')}
          >
            <span className="ds-logo-mark" aria-hidden="true">
              <Send className="w-3.5 h-3.5" />
            </span>
            <span className="ds-logo-name">SendToAnyone</span>
          </Link>

          <nav className="ds-nav-links" aria-label="Main">
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
                  className={`ds-nav-link ${active ? 'is-active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              );
            })}

            <div className="relative">
              <button
                type="button"
                onClick={() => setMoreOpen((v) => !v)}
                className={`ds-nav-link ${moreOpen ? 'is-active' : ''}`}
                aria-expanded={moreOpen}
                aria-haspopup="true"
              >
                More
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${moreOpen ? 'rotate-180' : ''}`} />
              </button>
              <div className={`ds-more ${moreOpen ? 'open' : ''}`} inert={!moreOpen}>
                <div className="ds-more-panel">
                  <div className="ds-more-quick">
                    {[
                      { to: '/', label: 'Link', icon: Link2, onClick: () => setActiveTab?.('transfer') },
                      { to: '/?mode=device', label: 'Device', icon: Wifi },
                      { to: '/receive', label: 'Request', icon: Inbox },
                      { to: '/security', label: 'Security', icon: Lock },
                    ].map((item) => (
                      <Link
                        key={item.label}
                        to={item.to}
                        onClick={() => { setMoreOpen(false); item.onClick?.(); }}
                      >
                        <item.icon className="w-4 h-4" aria-hidden="true" />
                        {item.label}
                      </Link>
                    ))}
                  </div>
                  {MORE_GROUPS.map((group) => (
                    <div key={group.label}>
                      <p className="ds-more-label">{group.label}</p>
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            className="ds-more-item"
                            onClick={() => setMoreOpen(false)}
                          >
                            <span className="ds-more-icon">
                              <Icon className="w-4 h-4" />
                            </span>
                            <span className="min-w-0">
                              <b>{item.title}</b>
                              <small>{item.desc}</small>
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

        <div className="ds-nav-actions">
          {user ? (
            <>
              {isAdmin(user) && (
                <button
                  type="button"
                  onClick={() => onOpenProfile?.()}
                  className="ds-btn ds-btn-ghost ds-btn-sm hidden sm:inline-flex"
                >
                  <Crown className="w-3.5 h-3.5" />
                  Admin
                </button>
              )}
              <button
                type="button"
                onClick={openMyFiles}
                aria-label="My Files"
                aria-pressed={myFilesActive}
                className={`ds-btn ds-btn-ghost ds-btn-sm ds-nav-chip hidden sm:inline-flex ${myFilesActive ? 'is-active' : ''}`}
              >
                <FolderKanban className="w-3.5 h-3.5" />
                My Files
              </button>
              <button
                type="button"
                onClick={() => onOpenProfile?.()}
                className="ds-nav-icon"
                aria-label="Profile"
              >
                {user.email?.[0]?.toUpperCase() || 'U'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onOpenAuth?.('login')}
                className="ds-nav-link hidden sm:inline-flex"
              >
                Sign in
              </button>
              <button
                type="button"
                data-ml-goal="signup_click"
                onClick={() => onOpenAuth?.('signup')}
                className="ds-btn ds-btn-dark ds-btn-sm"
              >
                Get started
                <ArrowRight className="ds-btn-arrow w-3.5 h-3.5 hidden sm:inline" />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="ds-nav-icon is-menu"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="ds-mobile" role="navigation" aria-label="Mobile">
          <div className="ds-mobile-quick">
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
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            ))}
          </div>
          <div className="ds-mobile-group">
            {!user && (
              <button
                type="button"
                onClick={() => { setMobileMenuOpen(false); onOpenAuth?.('login'); }}
                className="ds-btn ds-btn-ghost w-full mt-2 sm:hidden"
              >
                Sign in
              </button>
            )}
            {user && (
              <button
                type="button"
                onClick={openMyFiles}
                aria-pressed={myFilesActive}
                className="ds-more-item w-full text-left mt-1"
              >
                <span className="ds-more-icon"><FolderKanban className="w-4 h-4" aria-hidden="true" /></span>
                <span><b>My Files</b><small>Transfers you sent from this account</small></span>
              </button>
            )}
            {MORE_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="ds-more-label">{group.label}</p>
                {group.items.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className="ds-more-item"
                  >
                    <span className="ds-more-icon">
                      <item.icon className="w-4 h-4" />
                    </span>
                    <span className="min-w-0">
                      <b>{item.title}</b>
                      <small className="truncate">{item.desc}</small>
                    </span>
                  </Link>
                ))}
              </div>
            ))}
            {!isUserPro(user) && (
              <Link
                to="/pricing"
                onClick={() => setMobileMenuOpen(false)}
                className="ds-btn ds-btn-dark w-full my-2"
              >
                See pricing
              </Link>
            )}
          </div>
        </div>
      )}

      {myFilesAction({
        hasDashboardToggle: typeof setActiveTab === 'function',
        hasParentDrawer: typeof onOpenMyUploads === 'function',
      }) === 'local-drawer' && (
        <MyUploadsDrawer
          isOpen={filesOpen}
          onClose={() => setFilesOpen(false)}
          user={user}
          onOpenAuth={(mode) => {
            setFilesOpen(false);
            onOpenAuth?.(mode);
          }}
          onStartNewTransfer={() => {
            setFilesOpen(false);
            if (location.pathname !== '/') navigate('/');
          }}
        />
      )}
    </header>
  );
}
