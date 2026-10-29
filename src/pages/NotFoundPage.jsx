import { Link } from 'react-router-dom';
import { ArrowRight, Timer } from 'lucide-react';
import PageFrame from '../components/PageFrame';

const PLACES = [
  { to: '/', label: 'Send a file' },
  { to: '/receive', label: 'Request files' },
  { to: '/how-it-works', label: 'How it works' },
  { to: '/help', label: 'Help center' },
  { to: '/status', label: 'Service status' },
];

export default function NotFoundPage() {
  return (
    <PageFrame
      eyebrow="404"
      title="This page is gone."
      accent={1}
      subtitle="The link may be wrong, or the transfer may have expired. Start a new send from the homepage."
      actions={(
        <>
          <Link to="/" className="ds-btn ds-btn-dark">Send a file<ArrowRight className="ds-btn-arrow w-4 h-4" /></Link>
          <Link to="/help" className="ds-btn ds-btn-ghost">Get help</Link>
        </>
      )}
      nextLabel="Send a file"
      nextTo="/"
    >
      <section className="ds-split items-start" aria-label="Where to go next">
        <div data-reveal>
          <p className="pa-404" aria-hidden="true">404</p>
          <div className="ds-callout mt-6 max-w-md">
            <Timer className="w-5 h-5 shrink-0 text-[#6b7486]" aria-hidden="true" />
            <p>If you expected a download here, ask the sender for a fresh link. Expired files are deleted on purpose.</p>
          </div>
        </div>
        <nav className="pa-dir is-single" aria-label="Pages to try" data-reveal style={{ '--d': '80ms' }}>
          <div>
            <h2>Try one of these</h2>
            <ul>
              {PLACES.map((place) => (
                <li key={place.to}>
                  <Link to={place.to}>{place.label}<ArrowRight className="w-4 h-4" aria-hidden="true" /></Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      </section>
    </PageFrame>
  );
}
