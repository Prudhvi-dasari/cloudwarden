import { useId } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Send } from 'lucide-react';

const GROUPS = [
  {
    title: 'Send',
    links: [
      { to: '/', label: 'Transfer' },
      { to: '/receive', label: 'Request files' },
      { to: '/?mode=device', label: 'Device' },
      { to: '/phone-to-laptop', label: 'Phone to laptop' },
      { to: '/send-files-whatsapp', label: 'WhatsApp' },
      { to: '/wetransfer-alternative', label: 'WeTransfer alternative' },
      { to: '/send-large-files', label: 'Large files' },
      { to: '/send-files-without-signup', label: 'No account' },
    ],
  },
  {
    title: 'Product',
    links: [
      { to: '/features', label: 'Features' },
      { to: '/how-it-works', label: 'How it works' },
      { to: '/how-to-send-large-files', label: 'How to send' },
      { to: '/pricing', label: 'Pricing' },
      { to: '/apps', label: 'Apps' },
      { to: '/teams', label: 'Teams' },
    ],
  },
  {
    title: 'Tools',
    links: [
      { to: '/checksum', label: 'Checksum' },
      { to: '/compare', label: 'Compare' },
      { to: '/resources', label: 'Resources' },
      { to: '/api-docs', label: 'API' },
      { to: '/widget', label: 'Widget' },
      { to: '/security', label: 'Security' },
      { to: '/compliance', label: 'Compliance' },
    ],
  },
  {
    title: 'Company',
    links: [
      { to: '/about', label: 'About' },
      { to: '/help', label: 'Help' },
      { to: '/status', label: 'Status' },
      { to: '/changelog', label: 'Changelog' },
      { to: '/privacy', label: 'Privacy' },
      { to: '/terms', label: 'Terms' },
    ],
  },
];

export default function Footer() {
  const { pathname } = useLocation();
  const onHome = pathname === '/' || pathname === '/transfers';
  const wordmarkId = useId().replace(/:/g, '');

  return (
    <footer className="ds-footer relative z-10">
      <div className="ds-footer-panel">
        <div className="ds-wrap">
          <div className="ds-footer-cta" data-reveal>
            <div>
              <h2>Send the file now. They’ll have it in a minute.</h2>
              <p>Up to 6 GB with no account. The link closes when the time you picked runs out.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {onHome ? (
                <a href="#transfer" className="ds-btn ds-btn-light ds-btn-lg">
                  Send a file
                  <ArrowRight className="ds-btn-arrow w-4 h-4" />
                </a>
              ) : (
                <Link to="/" className="ds-btn ds-btn-light ds-btn-lg">
                  Send a file
                  <ArrowRight className="ds-btn-arrow w-4 h-4" />
                </Link>
              )}
              <Link to="/pricing" className="ds-btn ds-btn-lg ds-btn-outline-light">
                Pricing
              </Link>
            </div>
          </div>

          <div className="ds-footer-grid">
            <div className="ds-footer-brand">
              <Link to="/" className="ds-logo">
                <span className="ds-logo-mark" aria-hidden="true">
                  <Send className="w-3.5 h-3.5" />
                </span>
                SendToAnyone
              </Link>
              <p>Send a file. They get a link. Files sit on Cloudflare R2 until the link expires.</p>
              <Link to="/status" className="ds-footer-status">
                <span className="ds-dot-live" aria-hidden="true" />
                Service status
              </Link>
            </div>
            {GROUPS.map((group) => (
              <nav key={group.title} aria-label={group.title}>
                <p className="ds-footer-label">{group.title}</p>
                <ul>
                  {group.links.map((link) => (
                    <li key={link.to}>
                      <Link to={link.to}>{link.label}</Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>

          <div className="ds-footer-base">
            <p>
              Made in INDIA with{' '}
              <span aria-hidden="true">❤️</span>
              {' '}and lots of{' '}
              <span aria-hidden="true">☕️☕️☕️</span>
              {' · '}
              <a href="https://x.com/heyprudhvi_" target="_blank" rel="noreferrer">iprudhvi</a>
            </p>
            <p>© {new Date().getFullYear()} SendToAnyone</p>
          </div>
        </div>
        <svg className="ds-wordmark" viewBox="0 0 1200 168" role="presentation" aria-hidden="true">
          <defs>
            <linearGradient id={wordmarkId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.42" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.12" />
            </linearGradient>
          </defs>
          <text
            x="600"
            y="132"
            textAnchor="middle"
            textLength="1040"
            lengthAdjust="spacingAndGlyphs"
            fill={`url(#${wordmarkId})`}
            fontFamily="var(--ds-display), sans-serif"
            fontSize="128"
            fontWeight="800"
          >
            SendToAnyone
          </text>
        </svg>
      </div>
    </footer>
  );
}
