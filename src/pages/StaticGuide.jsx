import { useState } from 'react';
import { Link } from 'react-router-dom';
import PageFrame from '../components/PageFrame';
import AuthModal from '../components/AuthModal';
import ProfileModal from '../components/ProfileModal';
import { getStoredUser, clearUserSession } from '../lib/authSession';
import { ROUTE_SEO_MAP } from '../../functions/lib/seoRoutes.js';

export default function StaticGuide({ path, nextTo = '/', nextLabel = 'Send a file' }) {
  const page = ROUTE_SEO_MAP[path];
  const [user, setUser] = useState(() => getStoredUser());
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  if (!page) return null;

  return (
    <>
      <PageFrame
        user={user}
        onOpenAuth={(mode) => { setAuthMode(mode); setIsAuthOpen(true); }}
        onOpenProfile={() => setIsProfileOpen(true)}
        eyebrow={page.crumb}
        title={page.h1}
        subtitle={page.lead}
        accent={1}
        nextTo={nextTo}
        nextLabel={nextLabel}
        actions={path === '/file-request' ? (
          <Link to="/receive" className="ds-btn ds-btn-dark">Open the request form</Link>
        ) : path === '/about' ? null : (
          <Link to="/" className="ds-btn ds-btn-dark">Send a file</Link>
        )}
      >
        <article className="ds-prose max-w-3xl">
          {(page.sections || []).map((section) => (
            <section key={section.h2 || section.paragraphs?.[0]}>
              {section.h2 ? <h2>{section.h2}</h2> : null}
              {(section.paragraphs || []).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </section>
          ))}
        </article>
      </PageFrame>
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        initialMode={authMode}
        onAuthSuccess={(next) => setUser(next)}
      />
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        user={user}
        onSignOut={() => { clearUserSession(); setUser(null); }}
      />
    </>
  );
}
