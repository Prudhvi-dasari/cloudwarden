import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Navbar from './Navbar';
import Footer from './Footer';
import AnimatedHeadline from './ds/AnimatedHeadline';

/**
 * Shared shell for marketing, tool, and legal pages.
 * White canvas, page hero (kicker, headline, lead, actions), content, closing footer.
 */
export default function PageFrame({
  user,
  onOpenAuth,
  onOpenProfile,
  eyebrow,
  title,
  subtitle,
  accent = 1,
  actions,
  center = false,
  children,
  nextLabel = 'Send a file',
  nextTo = '/',
  hideNext = false,
}) {
  return (
    <div className="ds-page">
      <Navbar user={user} onOpenAuth={onOpenAuth} onOpenProfile={onOpenProfile} />

      <main className="flex-1">
        {(title || subtitle) && (
          <header className={`ds-page-hero${center ? ' is-center' : ''}`}>
            <div className="ds-wrap">
              {eyebrow && <p className="ds-kicker"><b>●</b> {eyebrow}</p>}
              {typeof title === 'string'
                ? <AnimatedHeadline text={title} accent={accent} />
                : title && <h1 className="ds-h1">{title}</h1>}
              {subtitle && <p className="ds-lead">{subtitle}</p>}
              {actions && <div className="ds-hero-actions">{actions}</div>}
            </div>
          </header>
        )}

        <div className="ds-wrap pb-16 sm:pb-24 space-y-10">
          {children}

          {!hideNext && nextTo !== '/' && (
            <div className="pt-2">
              <Link to={nextTo} className="ds-btn ds-btn-dark">
                {nextLabel}
                <ArrowRight className="ds-btn-arrow w-4 h-4" />
              </Link>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
