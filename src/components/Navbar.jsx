import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { isAdmin, isUserPro } from '../lib/authSession';
import {
  Send, User, Settings, Crown, Sparkles, FolderKanban, ShieldCheck,
  Info, Menu, X, Inbox, BookOpen, Layers, Activity, Scale, History,
  ChevronDown, Wifi, Link2, Mail, Code, Users, Smartphone,
  Laptop, Video, HelpCircle, ArrowRight, Lock, ExternalLink, Hash, QrCode, HardDrive, Zap, CheckCircle2
} from 'lucide-react';

export default function Navbar({ user, onOpenAuth, onOpenProfile, activeTab, setActiveTab, onOpenMyUploads }) {
  const location = useLocation();
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null); // 'products' | 'tools' | 'trust' | null
  const [mobileAccordion, setMobileAccordion] = useState(null);
  const [navVisible, setNavVisible] = useState(true);
  const lastScrollY = useRef(0);

  const navRef = useRef(null);

  // Close dropdown on click outside or route change
  useEffect(() => {
    function handleClickOutside(event) {
      if (navRef.current && !navRef.current.contains(event.target)) {
        setActiveDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    setActiveDropdown(null);
  }, [location.pathname]);

  // Auto-hide navbar on scroll down, show on scroll up
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentY = window.scrollY;
          if (currentY < 80) {
            setNavVisible(true);
          } else if (currentY > lastScrollY.current + 5) {
            setNavVisible(false);
            setActiveDropdown(null);
          } else if (currentY < lastScrollY.current - 5) {
            setNavVisible(true);
          }
          lastScrollY.current = currentY;
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const productItems = [
    {
      title: 'Shareable Download Links',
      desc: 'High-speed cloud links with password encryption, custom slugs, and auto-expiry.',
      path: '/',
      icon: Link2,
      badge: 'Up to 25GB',
      iconBg: 'bg-indigo-50 text-indigo-600',
    },
    {
      title: 'Email Transfer',
      desc: 'Send large files directly to email inboxes bypassing 25MB attachment limits.',
      path: '/send-files-by-email',
      icon: Mail,
      badge: 'Direct Inbox',
      iconBg: 'bg-purple-50 text-purple-600',
    },
    {
      title: 'Device P2P Transfer',
      desc: 'Direct WebRTC device-to-device streaming without cloud server storage.',
      path: '/?p2p=true',
      icon: Wifi,
      badge: 'Zero Storage',
      iconBg: 'bg-teal-50 text-teal-600',
    },
    {
      title: 'Receive & Request Portals',
      desc: 'Collect files from clients without forcing them to register or login.',
      path: '/receive',
      icon: Inbox,
      badge: 'Client Drop',
      iconBg: 'bg-rose-50 text-rose-600',
    },
    {
      title: 'Embeddable Web Widget',
      desc: 'Add a custom file drop form to your website with 1 line of code.',
      path: '/widget',
      icon: Code,
      badge: 'SDK',
      iconBg: 'bg-amber-50 text-amber-600',
    },
    {
      title: 'iTransfer for Teams',
      desc: 'Multi-user workspace, shared pooled storage, and role permissions.',
      path: '/teams',
      icon: Users,
      badge: 'Business',
      iconBg: 'bg-blue-50 text-blue-600',
    },
  ];

  const toolItems = [
    {
      title: 'Instant QR P2P Room',
      desc: 'Pair phone and laptop instantly via camera QR scan over Wi-Fi.',
      path: '/qr-transfer',
      icon: QrCode,
      badge: 'Wireless',
      iconBg: 'bg-teal-50 text-teal-600',
    },
    {
      title: 'File Hash & Checksum',
      desc: 'Calculate SHA-256 and verify 100% bit-for-bit file integrity in-browser.',
      path: '/checksum',
      icon: Hash,
      badge: 'Integrity',
      iconBg: 'bg-indigo-50 text-indigo-600',
    },
    {
      title: 'Developer REST API',
      desc: 'Integrate automated file uploads, webhooks, and programmatic transfers.',
      path: '/api-docs',
      icon: Code,
      badge: 'v2.0',
      iconBg: 'bg-purple-50 text-purple-600',
    },
    {
      title: 'Desktop & Mobile Apps',
      desc: 'Native macOS, Windows, iOS, and Android standalone transfer utilities.',
      path: '/apps',
      icon: Smartphone,
      badge: 'Multi-Platform',
      iconBg: 'bg-cyan-50 text-cyan-600',
    },
  ];

  const trustItems = [
    {
      title: 'Security Architecture',
      desc: 'Zero-knowledge encryption, TLS 1.3 in-transit, and AES-256 at-rest protection.',
      path: '/security',
      icon: Lock,
      badge: 'AES-256',
      iconBg: 'bg-emerald-50 text-emerald-600',
    },
    {
      title: 'Enterprise Compliance',
      desc: 'GDPR, CCPA, and strict zero-logging privacy compliance standards.',
      path: '/compliance',
      icon: ShieldCheck,
      badge: 'GDPR / CCPA',
      iconBg: 'bg-blue-50 text-blue-600',
    },
    {
      title: 'Live Service Status',
      desc: 'Real-time uptime, regional edge latency, and scheduled maintenance logs.',
      path: '/status',
      icon: Activity,
      badge: '99.99% Uptime',
      iconBg: 'bg-emerald-50 text-emerald-600',
    },
    {
      title: 'Help & Knowledge Base',
      desc: 'Frequently asked questions, transfer guides, and dedicated VIP support.',
      path: '/help',
      icon: HelpCircle,
      iconBg: 'bg-amber-50 text-amber-600',
    },
  ];

  const isHome = location.pathname === '/' && (!activeTab || activeTab === 'transfer');

  return (
    <header
      ref={navRef}
      className={`sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-200/70 shadow-xs text-slate-800 select-none transition-transform duration-300 ease-in-out ${
        navVisible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo & Live Pulse Beacon */}
        <div className="flex items-center gap-6 xl:gap-8">
          <Link
            to="/"
            className="flex items-center gap-2.5 group shrink-0"
            onClick={() => { setActiveTab?.('transfer'); setActiveDropdown(null); }}
          >
            {/* Gradient Logo Icon */}
            <div className="w-9 h-9 rounded-xl theme-btn-primary flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform duration-200">
              <Send className="w-4.5 h-4.5 text-white transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-200" />
            </div>

            {/* Clean Brand Name */}
            <div className="flex items-center">
              <span className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors font-sans">
                iTransfer
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 text-[13px] font-bold text-slate-600">
            
            {/* Quick Send Tab */}
            <Link
              to="/"
              onClick={() => { setActiveTab?.('transfer'); setActiveDropdown(null); }}
              className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
                isHome
                  ? 'text-indigo-600 bg-indigo-50/80 font-black shadow-2xs'
                  : 'hover:text-slate-900 hover:bg-slate-100/80'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Send Files</span>
            </Link>

            {/* Products Mega Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setActiveDropdown(activeDropdown === 'products' ? null : 'products')}
                className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeDropdown === 'products' ? 'text-indigo-600 bg-indigo-50/80' : 'hover:text-slate-900 hover:bg-slate-100/80'
                }`}
              >
                <span>Products</span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${activeDropdown === 'products' ? 'rotate-180 text-indigo-600' : ''}`} />
              </button>

              {activeDropdown === 'products' && (
                <div className="absolute top-full left-0 mt-2 w-[540px] bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200/90 p-3 grid grid-cols-2 gap-2 animate-scale-in z-50">
                  {productItems.map((item, idx) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={idx}
                        to={item.path}
                        onClick={() => setActiveDropdown(null)}
                        className="p-2.5 rounded-xl hover:bg-slate-50 transition-all group flex items-start gap-2.5 text-left border border-transparent hover:border-slate-200/60"
                      >
                        <div className={`w-8 h-8 rounded-lg ${item.iconBg} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-slate-900 group-hover:text-indigo-600 transition-colors">
                              {item.title}
                            </span>
                            {item.badge && (
                              <span className="text-[8px] font-black uppercase px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200/60">
                                {item.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 font-normal leading-relaxed">
                            {item.desc}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Tools Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setActiveDropdown(activeDropdown === 'tools' ? null : 'tools')}
                className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeDropdown === 'tools' ? 'text-indigo-600 bg-indigo-50/80' : 'hover:text-slate-900 hover:bg-slate-100/80'
                }`}
              >
                <span>Tools</span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${activeDropdown === 'tools' ? 'rotate-180 text-indigo-600' : ''}`} />
              </button>

              {activeDropdown === 'tools' && (
                <div className="absolute top-full left-0 mt-2 w-[480px] bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200/90 p-3 grid grid-cols-2 gap-2 animate-scale-in z-50">
                  {toolItems.map((item, idx) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={idx}
                        to={item.path}
                        onClick={() => setActiveDropdown(null)}
                        className="p-2.5 rounded-xl hover:bg-slate-50 transition-all group flex items-start gap-2.5 text-left border border-transparent hover:border-slate-200/60"
                      >
                        <div className={`w-8 h-8 rounded-lg ${item.iconBg} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-slate-900 group-hover:text-indigo-600 transition-colors">
                              {item.title}
                            </span>
                            {item.badge && (
                              <span className="text-[8px] font-black uppercase px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200/60">
                                {item.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 font-normal leading-relaxed">
                            {item.desc}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Security Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setActiveDropdown(activeDropdown === 'trust' ? null : 'trust')}
                className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeDropdown === 'trust' ? 'text-indigo-600 bg-indigo-50/80' : 'hover:text-slate-900 hover:bg-slate-100/80'
                }`}
              >
                <span>Security</span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${activeDropdown === 'trust' ? 'rotate-180 text-indigo-600' : ''}`} />
              </button>

              {activeDropdown === 'trust' && (
                <div className="absolute top-full left-0 mt-2 w-[480px] bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200/90 p-3 grid grid-cols-2 gap-2 animate-scale-in z-50">
                  {trustItems.map((item, idx) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={idx}
                        to={item.path}
                        onClick={() => setActiveDropdown(null)}
                        className="p-2.5 rounded-xl hover:bg-slate-50 transition-all group flex items-start gap-2.5 text-left border border-transparent hover:border-slate-200/60"
                      >
                        <div className={`w-8 h-8 rounded-lg ${item.iconBg} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-slate-900 group-hover:text-indigo-600 transition-colors">
                              {item.title}
                            </span>
                            {item.badge && (
                              <span className="text-[8px] font-black uppercase px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200/60">
                                {item.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 font-normal leading-relaxed">
                            {item.desc}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            <Link
              to="/features"
              onClick={() => setActiveDropdown(null)}
              className={`px-3 py-1.5 rounded-xl transition-colors ${
                location.pathname === '/features' ? 'text-indigo-600 bg-indigo-50/80 font-black' : 'hover:text-slate-900 hover:bg-slate-100/80'
              }`}
            >
              Features
            </Link>

            {!isUserPro(user) && (
              <Link
                to="/pricing"
                onClick={() => setActiveDropdown(null)}
                className={`px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 ${
                  location.pathname === '/pricing' ? 'text-indigo-600 bg-indigo-50/80 font-black' : 'hover:text-slate-900 hover:bg-slate-100/80'
                }`}
              >
                <span>Pricing</span>
                <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                  PRO ✨
                </span>
              </Link>
            )}

          </nav>
        </div>

        {/* Right Section Action Hub */}
        <div className="flex items-center gap-2 sm:gap-3">
          
          {user ? (
            <div className="flex items-center gap-1.5 sm:gap-2">
              {isAdmin(user) && (
                <button
                  type="button"
                  onClick={() => onOpenProfile?.()}
                  className="hidden sm:flex px-2.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black items-center gap-1 shadow-xs transition-all cursor-pointer"
                  title="Master Admin Hub"
                >
                  <Crown className="w-3.5 h-3.5 fill-slate-950" />
                  <span>Admin</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setActiveTab?.(activeTab === 'dashboard' ? 'transfer' : 'dashboard')}
                className={`hidden sm:flex px-3 py-1.5 rounded-xl text-xs font-bold items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'theme-btn-primary text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 border border-slate-200/80'
                }`}
              >
                <FolderKanban className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenProfile?.()}
                className="w-8 h-8 rounded-xl theme-btn-primary text-white font-black text-xs flex items-center justify-center shadow-xs hover:scale-105 transition-all cursor-pointer"
                title="Account Settings"
              >
                {user.email?.[0]?.toUpperCase() || 'U'}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => onOpenAuth?.('login')}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Sign In
              </button>

              <button
                type="button"
                onClick={() => onOpenAuth?.('signup')}
                className="theme-btn-primary text-white text-xs font-bold px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-98 transition-all cursor-pointer flex items-center gap-1"
              >
                <span>Get Started</span>
                <ArrowRight className="w-3.5 h-3.5 hidden sm:inline" />
              </button>
            </div>
          )}

          {/* Mobile Menu Hamburger Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
            aria-label="Toggle Menu"
          >
            {mobileMenuOpen ? <X className="w-4.5 h-4.5" /> : <Menu className="w-4.5 h-4.5" />}
          </button>

        </div>
      </div>

      {/* =========================================================================
          OPTIMIZED MOBILE DRAWER MENU (LIGHT PEARL CLEAN)
          ========================================================================= */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white/98 backdrop-blur-2xl px-4 py-4 space-y-3 max-h-[85vh] overflow-y-auto animate-fadeIn shadow-2xl text-slate-800">
          
          {/* User Quick Bar if logged in */}
          {user ? (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl theme-btn-primary text-white flex items-center justify-center font-bold text-xs">
                  {user.email?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">{user.email}</p>
                  <p className="text-[9px] font-semibold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>{isAdmin(user) ? '👑 Master Admin' : isUserPro(user) ? '⭐ Pro Member' : 'Free Member'}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => { setMobileMenuOpen(false); setActiveTab?.('dashboard'); }}
                  className="px-2.5 py-1 text-xs font-bold text-white theme-btn-primary rounded-lg shadow-2xs cursor-pointer"
                >
                  Dashboard
                </button>
                <button
                  type="button"
                  onClick={() => { setMobileMenuOpen(false); onOpenProfile?.(); }}
                  className="px-2.5 py-1 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg shadow-2xs cursor-pointer"
                >
                  Settings
                </button>
              </div>
            </div>
          ) : null}

          {/* Quick Transfer Modes Grid on Mobile */}
          <div className="grid grid-cols-2 gap-2">
            <Link
              to="/"
              onClick={() => { setMobileMenuOpen(false); setActiveTab?.('transfer'); }}
              className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-2 hover:bg-slate-100 transition-colors"
            >
              <Link2 className="w-4 h-4 text-indigo-600 shrink-0" />
              <div className="text-left min-w-0">
                <span className="text-xs font-bold text-slate-900 block truncate">Send Link</span>
                <span className="text-[9px] text-slate-500 block truncate">Direct cloud link</span>
              </div>
            </Link>

            <Link
              to="/send-files-by-email"
              onClick={() => setMobileMenuOpen(false)}
              className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-2 hover:bg-slate-100 transition-colors"
            >
              <Mail className="w-4 h-4 text-purple-600 shrink-0" />
              <div className="text-left min-w-0">
                <span className="text-xs font-bold text-slate-900 block truncate">Send Email</span>
                <span className="text-[9px] text-slate-500 block truncate">To any inbox</span>
              </div>
            </Link>

            <Link
              to="/?p2p=true"
              onClick={() => setMobileMenuOpen(false)}
              className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-2 hover:bg-slate-100 transition-colors"
            >
              <Wifi className="w-4 h-4 text-teal-600 shrink-0" />
              <div className="text-left min-w-0">
                <span className="text-xs font-bold text-slate-900 block truncate">Device P2P</span>
                <span className="text-[9px] text-slate-500 block truncate">Direct streaming</span>
              </div>
            </Link>

            <Link
              to="/receive"
              onClick={() => setMobileMenuOpen(false)}
              className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-2 hover:bg-slate-100 transition-colors"
            >
              <Inbox className="w-4 h-4 text-rose-600 shrink-0" />
              <div className="text-left min-w-0">
                <span className="text-xs font-bold text-slate-900 block truncate">Request Files</span>
                <span className="text-[9px] text-slate-500 block truncate">Client drop portal</span>
              </div>
            </Link>
          </div>

          {/* Mobile Products Accordion */}
          <div className="border border-slate-200 rounded-2xl p-2.5 bg-slate-50/70">
            <button
              type="button"
              onClick={() => setMobileAccordion(mobileAccordion === 'products' ? null : 'products')}
              className="w-full flex items-center justify-between font-bold text-xs text-slate-900 py-1 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Send className="w-3.5 h-3.5 text-indigo-600" /> Products & Solutions
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${mobileAccordion === 'products' ? 'rotate-180 text-indigo-600' : ''}`} />
            </button>

            {mobileAccordion === 'products' && (
              <div className="pt-2 space-y-1 border-t border-slate-200 mt-2">
                {productItems.map((item, idx) => (
                  <Link
                    key={idx}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-white text-xs font-bold text-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <item.icon className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{item.title}</span>
                    </div>
                    {item.badge && (
                      <span className="text-[8px] font-bold px-1.5 py-0.2 rounded bg-slate-200/60 text-slate-600">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Mobile Tools Accordion */}
          <div className="border border-slate-200 rounded-2xl p-2.5 bg-slate-50/70">
            <button
              type="button"
              onClick={() => setMobileAccordion(mobileAccordion === 'tools' ? null : 'tools')}
              className="w-full flex items-center justify-between font-bold text-xs text-slate-900 py-1 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-purple-600" /> Tools & Utilities
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${mobileAccordion === 'tools' ? 'rotate-180 text-purple-600' : ''}`} />
            </button>

            {mobileAccordion === 'tools' && (
              <div className="pt-2 space-y-1 border-t border-slate-200 mt-2">
                {toolItems.map((item, idx) => (
                  <Link
                    key={idx}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-white text-xs font-bold text-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <item.icon className="w-3.5 h-3.5 text-purple-600" />
                      <span>{item.title}</span>
                    </div>
                    {item.badge && (
                      <span className="text-[8px] font-bold px-1.5 py-0.2 rounded bg-slate-200/60 text-slate-600">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Bottom Nav Links */}
          <div className={`grid ${!isUserPro(user) ? 'grid-cols-2' : 'grid-cols-1'} gap-2 pt-1`}>
            <Link
              to="/features"
              onClick={() => setMobileMenuOpen(false)}
              className="text-center py-2.5 px-3 rounded-xl bg-slate-100 border border-slate-200/80 font-bold text-xs text-slate-800 hover:bg-slate-200 transition-colors"
            >
              Features
            </Link>
            {!isUserPro(user) && (
              <Link
                to="/pricing"
                onClick={() => setMobileMenuOpen(false)}
                className="text-center py-2.5 px-3 rounded-xl bg-slate-100 border border-slate-200/80 font-bold text-xs text-slate-800 hover:bg-slate-200 transition-colors flex items-center justify-center gap-1.5"
              >
                <span>Pricing</span>
                <span className="text-[8px] font-black uppercase px-1.5 py-0.2 rounded bg-amber-200 text-amber-900">PRO</span>
              </Link>
            )}
          </div>

        </div>
      )}

    </header>
  );
}
