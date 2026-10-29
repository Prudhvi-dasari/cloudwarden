import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import PageFrame from '../components/PageFrame';
import AuthModal from '../components/AuthModal';
import ProfileModal from '../components/ProfileModal';
import { getStoredUser, clearUserSession } from '../lib/authSession';
import {
  AlertTriangle, ArrowRight, Check, CheckCircle2, Copy, FileText, Fingerprint, Laptop, Repeat, UploadCloud,
} from 'lucide-react';
import { useToast } from '../components/Toast';

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function formatSize(bytes) {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(2)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`;
  return `${bytes} bytes`;
}

const ABOUT = [
  {
    icon: Fingerprint,
    title: 'What a hash proves',
    text: 'A hash is a fingerprint of the bytes. Change one byte and the hash changes completely.',
  },
  {
    icon: Laptop,
    title: 'Nothing is uploaded',
    text: 'Your browser computes the hash with the Web Crypto API. The file stays on this device.',
  },
  {
    icon: Repeat,
    title: 'Same bytes in, same bytes out',
    text: 'The uploader sends the bytes you selected. It does not compress or transcode them.',
  },
];

export default function ChecksumPage() {
  const { addToast } = useToast();
  const [user, setUser] = useState(() => getStoredUser());
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const [computing, setComputing] = useState(false);
  const [hashes, setHashes] = useState(null);
  const [compareHash, setCompareHash] = useState('');
  const [copiedKey, setCopiedKey] = useState(null);
  const [failed, setFailed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const hashFile = async (selected) => {
    if (!selected || computing) return;
    setComputing(true);
    setHashes(null);
    setFailed(false);

    try {
      const buffer = await selected.arrayBuffer();
      const [hashBuffer256, hashBuffer1] = await Promise.all([
        crypto.subtle.digest('SHA-256', buffer),
        crypto.subtle.digest('SHA-1', buffer),
      ]);
      setHashes({
        sha256: toHex(hashBuffer256),
        sha1: toHex(hashBuffer1),
        size: selected.size,
        name: selected.name,
      });
      addToast('Hashes ready.', 'success');
    } catch (err) {
      console.error(err);
      setFailed(true);
      addToast('Could not read this file.', 'error');
    } finally {
      setComputing(false);
    }
  };

  const handleFileSelect = (e) => {
    hashFile(e.target.files?.[0]);
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    hashFile(e.dataTransfer?.files?.[0]);
  };

  const handleCopy = async (key, val) => {
    try {
      await navigator.clipboard.writeText(val);
      setCopiedKey(key);
      addToast(`${key === 'sha256' ? 'SHA-256' : 'SHA-1'} copied.`, 'info');
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      addToast('Copy failed. Select the text instead.', 'error');
    }
  };

  const expected = compareHash.trim().toLowerCase();
  const isMatched = Boolean(expected && hashes && (expected === hashes.sha256 || expected === hashes.sha1));

  return (
    <>
      <PageFrame
        user={user}
        onOpenAuth={(mode) => { setAuthMode(mode); setIsAuthOpen(true); }}
        onOpenProfile={() => setIsProfileOpen(true)}
        eyebrow="Checksum · Runs in your browser"
        title="Check a file against its hash."
        accent={2}
        subtitle="Pick a file. Your browser computes its SHA-256 and SHA-1. Paste the hash you were given and see if they match. Nothing is uploaded."
      >
        <section className="max-w-3xl mx-auto w-full" aria-label="Checksum tool">
          <div className="ds-frame" data-reveal>
            <div className="ds-frame-chrome">
              <span className="ds-frame-dots" aria-hidden="true"><i /><i /><i /></span>
              <span className="ds-mono text-[0.72rem] text-[#6b7486] truncate min-w-0">checksum · on this device</span>
              <span className="ds-badge ds-badge-green">Local</span>
            </div>
            <div className="ds-frame-screen space-y-5">
              <label
                className={`pgb-drop ${dragging ? 'is-drag' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
              >
                <input ref={inputRef} type="file" onChange={handleFileSelect} className="sr-only" />
                <span className="ds-icon is-dark" aria-hidden="true">
                  {computing ? <span className="ds-spinner" /> : <UploadCloud />}
                </span>
                <span className="pgb-drop-title">
                  {computing ? 'Reading the file…' : 'Drop a file, or click to choose one'}
                </span>
                <span className="ds-hint max-w-sm">
                  The whole file is read into memory. Very large files can fail in some browsers.
                </span>
              </label>

              {failed && (
                <div className="ds-alert is-danger" role="alert">
                  <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>The browser could not read this file. It may be too large for memory. Try a desktop browser, or the command line.</span>
                </div>
              )}

              {hashes && (
                <div className="space-y-3" aria-live="polite">
                  <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#e6e8ee]">
                    <div className="pgb-file">
                      <span className="ds-file-icon"><FileText className="w-4 h-4" aria-hidden="true" /></span>
                      <div className="min-w-0">
                        <p className="ds-row-title truncate">{hashes.name}</p>
                        <p className="ds-row-sub">{formatSize(hashes.size)}</p>
                      </div>
                    </div>
                    <span className="ds-badge ds-badge-blue shrink-0">Hashed</span>
                  </div>

                  {[['sha256', 'SHA-256'], ['sha1', 'SHA-1']].map(([key, label]) => (
                    <div key={key} className="pgb-hash">
                      <div className="pgb-hash-top">
                        <span className="pgb-hash-label">{label}</span>
                        <button type="button" onClick={() => handleCopy(key, hashes[key])} className="ds-btn ds-btn-ghost ds-btn-sm">
                          {copiedKey === key ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
                          {copiedKey === key ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <p className="pgb-hash-value">{hashes[key]}</p>
                    </div>
                  ))}

                  <div className="ds-field pt-3">
                    <label className="ds-label" htmlFor="compare-hash">Compare with the hash you were given</label>
                    <input
                      id="compare-hash"
                      type="text"
                      value={compareHash}
                      onChange={(e) => setCompareHash(e.target.value)}
                      placeholder="Paste a SHA-256 or SHA-1 hash"
                      className="ds-input ds-mono text-[0.8rem]"
                      spellCheck={false}
                      autoComplete="off"
                    />
                  </div>

                  {expected && (
                    <div className={`ds-alert ${isMatched ? 'is-success' : 'is-danger'}`} role="status">
                      {isMatched ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                          <span>Match. This file has the same bytes as the file that produced that hash.</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                          <span>No match. The file differs from the one that produced that hash, or the hash was copied wrong.</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {!hashes && !computing && (
                <div className="text-center">
                  <button type="button" className="ds-btn ds-btn-dark" onClick={() => inputRef.current?.click()}>
                    Choose a file
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="pt-6" aria-label="About checksums">
          <div className="ds-grid cols-3">
            {ABOUT.map(({ icon: Icon, title, text }, i) => (
              <div key={title} className="ds-feature is-soft" data-reveal style={{ '--d': `${i * 60}ms` }}>
                <span className="ds-icon"><Icon aria-hidden="true" /></span>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="ds-split items-start pt-6" aria-labelledby="after-title">
          <div data-reveal>
            <p className="ds-kicker"><b>●</b> After a transfer</p>
            <h2 id="after-title" className="ds-h2 mt-3">Compare on both ends.</h2>
            <p className="ds-lead mt-4">
              The transfer does not attach a hash for you. Share it yourself, on a different channel from the link.
            </p>
            <Link to="/" className="ds-btn ds-btn-dark mt-6">
              Send a file
              <ArrowRight className="ds-btn-arrow w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
          <ol className="ds-steps" data-reveal style={{ '--d': '100ms' }}>
            <li className="ds-step">
              <h3>The sender hashes the file</h3>
              <p>Run it here before upload and copy the SHA-256.</p>
            </li>
            <li className="ds-step">
              <h3>The hash travels separately</h3>
              <p>Send it in a chat or message, apart from the download link.</p>
            </li>
            <li className="ds-step">
              <h3>The recipient checks</h3>
              <p>They hash the download here and paste the sender’s value.</p>
            </li>
          </ol>
        </section>
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
