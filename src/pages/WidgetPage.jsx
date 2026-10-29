import { useState } from 'react';
import { Link } from 'react-router-dom';
import PageFrame from '../components/PageFrame';
import AuthModal from '../components/AuthModal';
import ProfileModal from '../components/ProfileModal';
import { getStoredUser, clearUserSession } from '../lib/authSession';
import { ArrowRight, Check, Copy, Sliders, X } from 'lucide-react';
import { useToast } from '../components/Toast';

const SWATCHES = ['#1769f5', '#060a12', '#12a150', '#7c3aed', '#e11d48', '#0891b2'];
const DEFAULT_LINK = 'https://sendtoanyone.com/receive';

const NOT_AVAILABLE = [
  'A hosted widget script',
  'An iframe of our pages on your site (browsers block it)',
  'Uploads that happen inside your own page',
  'Custom form fields or your own storage',
];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function safeHref(value) {
  const trimmed = value.trim();
  return /^https:\/\//i.test(trimmed) ? trimmed : DEFAULT_LINK;
}

export default function WidgetPage() {
  const { addToast } = useToast();
  const [user, setUser] = useState(() => getStoredUser());
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('signup');
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const [widgetTitle, setWidgetTitle] = useState('Send us your project files');
  const [widgetSubtitle, setWidgetSubtitle] = useState('Upload from your browser. No account needed.');
  const [buttonLabel, setButtonLabel] = useState('Upload files');
  const [requestLink, setRequestLink] = useState(DEFAULT_LINK);
  const [themeColor, setThemeColor] = useState('#1769f5');
  const [copiedCode, setCopiedCode] = useState(false);
  const [embedType, setEmbedType] = useState('button');

  const href = safeHref(requestLink);
  const linkLooksWrong = requestLink.trim() !== '' && href !== requestLink.trim();

  const embedCodeButton = `<div style="max-width:420px;padding:20px;border:1px solid #e6e8ee;border-radius:16px;text-align:center;font-family:system-ui,sans-serif">
  <h3 style="margin:0;font-size:18px">${escapeHtml(widgetTitle)}</h3>
  <p style="margin:6px 0 16px;color:#6b7486;font-size:14px">${escapeHtml(widgetSubtitle)}</p>
  <a href="${escapeHtml(href)}" target="_blank" rel="noopener"
     style="display:inline-block;padding:12px 20px;border-radius:10px;background:${escapeHtml(themeColor)};color:#fff;font-weight:600;text-decoration:none">
    ${escapeHtml(buttonLabel)}
  </a>
</div>`;

  const embedCodeLink = `<a href="${escapeHtml(href)}" target="_blank" rel="noopener">${escapeHtml(buttonLabel)}</a>`;

  const activeCode = embedType === 'button' ? embedCodeButton : embedCodeLink;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(activeCode);
      setCopiedCode(true);
      addToast('Snippet copied.', 'success');
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      addToast('Copy failed. Select the text instead.', 'error');
    }
  };

  return (
    <>
      <PageFrame
        user={user}
        onOpenAuth={(mode) => { setAuthMode(mode); setIsAuthOpen(true); }}
        onOpenProfile={() => setIsProfileOpen(true)}
        eyebrow="Widget · No hosted script"
        title="Put a request link on your site."
        accent={2}
        subtitle="There is no hosted widget. Make a request link, then paste a button on your site that opens it. Visitors upload on SendToAnyone."
        actions={(
          <>
            <Link to="/receive" className="ds-btn ds-btn-dark">
              Make a request link
              <ArrowRight className="ds-btn-arrow w-4 h-4" aria-hidden="true" />
            </Link>
            <a href="#builder" className="ds-btn ds-btn-ghost">Build the button</a>
          </>
        )}
      >
        <section aria-labelledby="steps-title">
          <h2 id="steps-title" className="sr-only">Three steps</h2>
          <ol className="ds-steps is-row" style={{ '--n': 3 }}>
            <li className="ds-step" data-reveal>
              <h3>Make a request</h3>
              <p>Open the <Link to="/receive" className="ds-link">request page</Link> and copy the link it gives you.</p>
            </li>
            <li className="ds-step" data-reveal style={{ '--d': '80ms' }}>
              <h3>Style the button</h3>
              <p>Paste the link below. Set the title, text, and color.</p>
            </li>
            <li className="ds-step" data-reveal style={{ '--d': '160ms' }}>
              <h3>Paste the HTML</h3>
              <p>Drop the snippet into any site builder that accepts HTML.</p>
            </li>
          </ol>
        </section>

        <section id="builder" className="pgb-builder scroll-mt-24" aria-labelledby="builder-title">
          <div className="ds-panel ds-panel-pad space-y-5" data-reveal>
            <div className="flex items-center gap-2">
              <span className="ds-icon is-sm"><Sliders aria-hidden="true" /></span>
              <h2 id="builder-title" className="ds-h3">Button settings</h2>
            </div>

            <div className="ds-field">
              <label className="ds-label" htmlFor="widget-link">Your request link</label>
              <input
                id="widget-link"
                type="url"
                inputMode="url"
                value={requestLink}
                onChange={(e) => setRequestLink(e.target.value)}
                className="ds-input ds-mono text-[0.85rem]"
                aria-invalid={linkLooksWrong}
                aria-describedby="widget-link-hint"
              />
              <p id="widget-link-hint" className="ds-hint">
                {linkLooksWrong ? 'Use a full https:// link. The snippet falls back to the request page.' : 'Paste the /request/ link you created.'}
              </p>
            </div>

            <div className="ds-field">
              <label className="ds-label" htmlFor="widget-title">Title</label>
              <input id="widget-title" type="text" value={widgetTitle} onChange={(e) => setWidgetTitle(e.target.value)} className="ds-input" />
            </div>

            <div className="ds-field">
              <label className="ds-label" htmlFor="widget-subtitle">Text under the title</label>
              <input id="widget-subtitle" type="text" value={widgetSubtitle} onChange={(e) => setWidgetSubtitle(e.target.value)} className="ds-input" />
            </div>

            <div className="ds-field">
              <label className="ds-label" htmlFor="widget-button">Button label</label>
              <input id="widget-button" type="text" value={buttonLabel} onChange={(e) => setButtonLabel(e.target.value)} className="ds-input" />
            </div>

            <div className="ds-field">
              <span className="ds-label" id="widget-color-label">Button color</span>
              <div className="pgb-swatches" role="group" aria-labelledby="widget-color-label">
                {SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setThemeColor(c)}
                    className="pgb-swatch"
                    aria-pressed={themeColor === c}
                    aria-label={`Color ${c}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <input
                  type="color"
                  value={themeColor}
                  onChange={(e) => setThemeColor(e.target.value)}
                  className="pgb-color-input"
                  aria-label="Custom color"
                />
              </div>
            </div>
          </div>

          <div className="space-y-5 min-w-0">
            <div className="ds-frame" data-reveal style={{ '--d': '80ms' }}>
              <div className="ds-frame-chrome">
                <span className="ds-frame-dots" aria-hidden="true"><i /><i /><i /></span>
                <span className="ds-url max-w-[18rem]"><span className="truncate">yourwebsite.com/<b>contact</b></span></span>
                <span className="ds-badge">Preview</span>
              </div>
              <div className="ds-frame-screen">
                <div className="pgb-site">
                  <div className="pgb-site-lines" aria-hidden="true">
                    <i style={{ width: '42%' }} />
                    <i style={{ width: '78%' }} />
                    <i style={{ width: '64%' }} />
                  </div>
                  <div className="pgb-embed">
                    <h4>{widgetTitle}</h4>
                    <p>{widgetSubtitle}</p>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pgb-embed-btn"
                      style={{ backgroundColor: themeColor }}
                    >
                      {buttonLabel}
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="ds-panel ds-panel-pad space-y-3" data-reveal style={{ '--d': '140ms' }}>
              <div className="pgb-toolbar">
                <h2 className="ds-h3">Snippet</h2>
                <div className="ds-tabs" role="group" aria-label="Snippet type">
                  <button type="button" className="ds-tab" aria-pressed={embedType === 'button'} onClick={() => setEmbedType('button')}>
                    Button card
                  </button>
                  <button type="button" className="ds-tab" aria-pressed={embedType === 'link'} onClick={() => setEmbedType('link')}>
                    Plain link
                  </button>
                </div>
              </div>
              <div className="pgb-code-wrap">
                <pre className="ds-code max-h-64"><code>{activeCode}</code></pre>
                <button type="button" onClick={handleCopyCode} className="ds-btn ds-btn-light ds-btn-sm pgb-code-copy">
                  {copiedCode ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
                  {copiedCode ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="ds-hint">The button opens the request page in a new tab. Uploads are capped at 6 GB on the free plan.</p>
            </div>
          </div>
        </section>

        <div className="ds-band" data-reveal>
          <div className="ds-split items-start">
            <div>
              <p className="ds-kicker text-white/60"><b>●</b> Not available</p>
              <h2 className="ds-h2 mt-3">What this page does not give you.</h2>
              <p className="ds-lead mt-3">The button is a link. Everything else happens on SendToAnyone.</p>
            </div>
            <ul className="pgb-nots">
              {NOT_AVAILABLE.map((item) => (
                <li key={item}><X strokeWidth={3} aria-hidden="true" />{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </PageFrame>

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        initialMode={authMode}
        onAuthSuccess={(u) => setUser(u)}
      />

      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        user={user}
        onSignOut={async () => {
          await clearUserSession();
          setUser(null);
        }}
      />
    </>
  );
}
