import { Link } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import { ArrowRight } from 'lucide-react';

/**
 * Shared shell for marketing / tool / legal pages.
 * Keeps transfer logic out — only sky wash, title, card surface, next step, footer.
 */
export default function PageFrame({
  user,
  onOpenAuth,
  onOpenProfile,
  eyebrow,
  title,
  subtitle,
  children,
  nextLabel = 'Send a file',
  nextTo = '/',
  hideNext = false,
}) {
  return (
    <div className="min-h-screen flex flex-col text-white relative overflow-hidden bg-[#07080d]">
      <div className="page-sky" aria-hidden="true" />
      <Navbar user={user} onOpenAuth={onOpenAuth} onOpenProfile={onOpenProfile} />

      <main className="relative z-10 flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-16">
        {(title || subtitle) && (
          <header className="mb-10 sm:mb-12 max-w-2xl">
            {eyebrow && (
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/45 mb-3">{eyebrow}</p>
            )}
            {title && (
              <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05] text-white">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="mt-4 text-sm sm:text-base text-white/55 leading-relaxed">{subtitle}</p>
            )}
          </header>
        )}

        <div className="page-body space-y-8">{children}</div>

        {!hideNext && (
          <div className="mt-14 pt-8 border-t border-white/10">
            <Link
              to={nextTo}
              className="inline-flex items-center gap-2 rounded-full bg-white text-black text-sm font-semibold px-5 py-3 hover:bg-white/90 transition-colors"
            >
              {nextLabel}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
