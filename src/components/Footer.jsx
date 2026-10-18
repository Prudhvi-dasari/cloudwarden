import { Link } from 'react-router-dom';

const LINKS = [
  { to: '/features', label: 'Features' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/security', label: 'Security' },
  { to: '/compare', label: 'Compare' },
  { to: '/help', label: 'Help' },
  { to: '/privacy', label: 'Privacy' },
];

export default function Footer() {
  return (
    <footer className="relative z-10 border-t border-white/10 bg-[#05060b] text-[#a1a1aa] text-xs">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex flex-col items-center gap-5 text-center">
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-medium">
          {LINKS.map((link) => (
            <Link key={link.to} to={link.to} className="hover:text-white transition-colors">
              {link.label}
            </Link>
          ))}
        </nav>
        <p className="text-sm tracking-wide text-white/80">
          Made in INDIA with{' '}
          <span aria-hidden="true">❤️</span>
          {' '}and lots of{' '}
          <span aria-hidden="true">☕️☕️☕️</span>
          {' · '}
          <a
            href="https://x.com/heyprudhvi_"
            target="_blank"
            rel="noreferrer"
            className="text-white font-medium hover:underline"
          >
            iprudhvi
          </a>
        </p>
      </div>
    </footer>
  );
}
