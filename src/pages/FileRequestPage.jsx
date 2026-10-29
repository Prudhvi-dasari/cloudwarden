import { useState, useCallback, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { createFileRequest, saveTransferSecrets } from '../lib/guestSession';
import { useAccount } from '../lib/AccountContext';
import { activeStorageProvider } from '../lib/storageProvider';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import SeoHead from '../components/SeoHead';
import DropZone from '../components/DropZone';
import FileList from '../components/FileList';
import UploadProgress from '../components/UploadProgress';
import AuthModal from '../components/AuthModal';
import ProfileModal from '../components/ProfileModal';
import AnimatedHeadline from '../components/ds/AnimatedHeadline';
import {
  Check, Copy, CircleAlert, CircleCheck, Link2, Link2Off, Lock, Quote, Upload, ArrowRight,
  ArrowUpRight, Inbox, ShieldCheck, Timer, EyeOff,
} from 'lucide-react';

function generateShareId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatTime(seconds) {
  if (!seconds || seconds === Infinity || isNaN(seconds)) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatWhen(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function publicMessage(value) {
  const message = typeof value === 'string' ? value.trim() : '';
  if (!message || message.length > 160 || /password_hash|secret|token|LOCAL_/i.test(message)) return '';
  return message;
}

function limitError(title, instructions) {
  if (title.trim().length > 120) return 'Title must be 120 characters or fewer.';
  if (instructions.trim().length > 500) return 'Instructions must be 500 characters or fewer.';
  return '';
}

async function copyText(value) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* fall through to the selection copy */
  }
  try {
    const area = document.createElement('textarea');
    area.value = value;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.left = '-9999px';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

export default function FileRequestPage() {
  const { requestId } = useParams();
  const { user, setUser, signOut } = useAccount();
  const [files, setFiles] = useState([]);
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [note, setNote] = useState('');
  const [portal, setPortal] = useState(null);
  const [portalLoading, setPortalLoading] = useState(!!requestId);
  const [portalError, setPortalError] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [requestTitle, setRequestTitle] = useState('');
  const [requestInstructions, setRequestInstructions] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const [creating, setCreating] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [profileOpen, setProfileOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [view, setView] = useState('form');
  const [progress, setProgress] = useState(0);
  const [currentFileName, setCurrentFileName] = useState('');
  const [uploadSpeed, setUploadSpeed] = useState('');
  const [timeRemaining, setTimeRemaining] = useState('');
  const [uploadStatus, setUploadStatus] = useState('uploading');
  const [shareData, setShareData] = useState(null);

  useEffect(() => {
    setView('form');
    setFiles([]);
    setUploadError('');
    setShareData(null);
  }, [requestId]);

  useEffect(() => {
    if (!requestId) {
      setPortal(null);
      setPortalError('');
      setPortalLoading(false);
      return undefined;
    }
    let cancelled = false;
    setPortalLoading(true);
    setPortalError('');
    (async () => {
      try {
        const res = await fetch(`/api/r2?action=request-meta&requestId=${encodeURIComponent(requestId)}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.status === 410 || data.code === 'REQUEST_CLOSED') {
          setPortal({
            closed: true,
            title: data.title || 'File request',
            expiresAt: data.expiresAt || null,
          });
          setPortalError('');
          return;
        }
        if (!res.ok) {
          setPortal(null);
          setPortalError(publicMessage(data.error) || (res.status === 404
            ? 'That request link was not found.'
            : 'This request could not be loaded.'));
          return;
        }
        setPortal(data);
        setPortalError('');
      } catch {
        if (!cancelled) {
          setPortal(null);
          setPortalError('This request could not be loaded.');
        }
      } finally {
        if (!cancelled) setPortalLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [requestId, reloadKey]);

  const handleFilesSelected = useCallback((newFiles) => {
    setFiles((prev) => [...prev, ...newFiles]);
    setUploadError('');
  }, []);

  const handleRemoveFile = useCallback((index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleCreateRequest = async (event) => {
    event.preventDefault();
    if (creating) return;
    const problem = limitError(requestTitle, requestInstructions);
    if (problem) {
      setFieldError(problem);
      return;
    }
    setFieldError('');
    setCreating(true);
    setUploadError('');
    setCopied(false);
    setCopyError('');
    try {
      const { data: sessionWrap } = await supabase.auth.getSession();
      const result = await createFileRequest({
        accessToken: sessionWrap?.session?.access_token,
        title: requestTitle.trim() || 'File request',
        instructions: requestInstructions.trim(),
      });
      if (!result?.requestId) throw new Error('The request link was not returned.');
      setCreated({
        url: `${window.location.origin}/request/${result.requestId}`,
        title: result.title || requestTitle.trim() || 'File request',
        expiresAt: result.expiresAt || null,
      });
      setRequestTitle('');
      setRequestInstructions('');
    } catch (err) {
      setUploadError(publicMessage(err.message) || 'Could not create the request link. Try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleCopyCreated = async () => {
    if (!created?.url) return;
    const ok = await copyText(created.url);
    if (!ok) {
      setCopied(false);
      setCopyError('Could not copy the link. Select it and copy it manually.');
      return;
    }
    setCopyError('');
    setCopied(true);
  };

  const handleUploadFiles = async (e) => {
    if (e) e.preventDefault();
    if (submitting || files.length === 0 || !portal || portal.closed) return;
    const totalSize = files.reduce((a, f) => a + f.size, 0);
    if (totalSize > 6_000_000_000) {
      setUploadError('This transfer is larger than the 6 GB limit.');
      return;
    }

    setSubmitting(true);
    setUploadError('');
    setView('progress');
    setUploadStatus('uploading');
    setProgress(0);

    const shareId = generateShareId();
    let totalUploaded = 0;
    const startTime = Date.now();
    let deleteToken = '';
    let claimToken = '';

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setCurrentFileName(`Uploading [${i + 1}/${files.length}]: ${file.name}`);

        const previousUploaded = totalUploaded;
        const uploaded = await activeStorageProvider.uploadFile({
          file,
          shareId,
          deleteToken,
          senderEmail: senderEmail || senderName || null,
          subject: portal?.title || `Files for ${requestId || 'request'}`,
          message: note || null,
          recipientEmails: null,
          requestId: requestId || null,
          transferType: 'request',
          expiryHours: 168,
          onProgress: (bytesUploaded) => {
            totalUploaded = previousUploaded + bytesUploaded;
            const overallProgress = Math.round((totalUploaded / totalSize) * 100);
            setProgress(overallProgress);

            const elapsed = (Date.now() - startTime) / 1000;
            if (elapsed > 0.1) {
              const speed = totalUploaded / elapsed;
              setUploadSpeed(`${(speed / (1024 * 1024)).toFixed(1)} MB/s`);
              const remaining = (totalSize - totalUploaded) / speed;
              setTimeRemaining(formatTime(remaining));
            }
          },
        });
        if (uploaded.claimToken) claimToken = uploaded.claimToken;
        if (uploaded.deleteToken) deleteToken = uploaded.deleteToken;
        totalUploaded = previousUploaded + file.size;
      }

      saveTransferSecrets(shareId, { claimToken, deleteToken });

      try {
        const localSaved = JSON.parse(localStorage.getItem('itransfer_my_transfers') || '[]');
        if (!localSaved.includes(shareId)) {
          localSaved.unshift(shareId);
          localStorage.setItem('itransfer_my_transfers', JSON.stringify(localSaved));
        }
      } catch {
        /* Local transfer history is optional. */
      }

      setUploadStatus('complete');
      setProgress(100);
      setShareData({
        shareId,
        fileCount: files.length,
        totalSize,
      });

      setTimeout(() => setView('complete'), 800);
    } catch (err) {
      setUploadStatus('error');
      setUploadError(publicMessage(err.message) || 'The upload did not finish. You can try again.');
      setView('form');
    } finally {
      setSubmitting(false);
    }
  };

  const titleCount = requestTitle.trim().length;
  const instructionCount = requestInstructions.trim().length;
  const portalExpiry = formatWhen(portal?.expiresAt);
  const createdExpiry = formatWhen(created?.expiresAt);

  function openAuth(mode = 'login') {
    setAuthMode(mode);
    setAuthOpen(true);
  }

  return (
    <div className="ds-page dl-page">
      {!requestId && (
        <SeoHead
          customTitle="Request files from someone else | SendToAnyone"
          customDescription="Create a request link with a title and instructions. The other person uploads up to 6 GB without an account. The link stays open for 7 days."
          customCanonical="https://sendtoanyone.com/receive"
        />
      )}
      <Navbar onOpenAuth={openAuth} onOpenProfile={() => setProfileOpen(true)} />

      <main className={requestId || view !== 'form' ? 'dl-main ds-wrap rq-stage' : 'flex-1'}>
        {view === 'form' && !requestId && (
          <>
            <header className="ds-page-hero">
              <div className="ds-wrap">
                <p className="ds-kicker"><b>●</b> File request</p>
                <AnimatedHeadline text="Request files from someone else" accent={2} />
                <p className="ds-lead">
                  Create a link and send it to the person who has the files. They upload in the browser. They do not need an account.
                </p>
              </div>
            </header>

            <div className="ds-wrap pb-16 sm:pb-24">
              <div className="rq-layout">
                <div className="ds-frame">
                  <div className="ds-frame-chrome">
                    <span className="ds-frame-dots" aria-hidden="true"><i /><i /><i /></span>
                    <span className="rq-chrome-label">New request link</span>
                    <span className="ds-badge ds-badge-blue">Open 7 days</span>
                  </div>
                  <div className="ds-frame-screen">
                    {user ? (
                      <form className="rq-form" onSubmit={handleCreateRequest} noValidate>
                        <fieldset className="rq-fieldset">
                          <legend className="rq-legend">Optional</legend>
                          <p className="ds-hint">A blank title is saved as File request. Instructions are shown to the person uploading.</p>
                          <div className="ds-field">
                            <label htmlFor="request-portal-title" className="ds-label">Title</label>
                            <input
                              id="request-portal-title"
                              type="text"
                              className="ds-input"
                              value={requestTitle}
                              onChange={(event) => {
                                setRequestTitle(event.target.value);
                                setFieldError('');
                              }}
                              placeholder="What you need"
                              aria-invalid={fieldError.startsWith('Title') || undefined}
                              aria-describedby="request-title-hint"
                            />
                            <p id="request-title-hint" className={`ds-hint rq-count${titleCount > 120 ? ' is-over' : ''}`}>{titleCount} of 120 characters</p>
                          </div>

                          <div className="ds-field">
                            <label htmlFor="request-portal-instructions" className="ds-label">Instructions</label>
                            <textarea
                              id="request-portal-instructions"
                              rows={4}
                              className="ds-textarea"
                              value={requestInstructions}
                              onChange={(event) => {
                                setRequestInstructions(event.target.value);
                                setFieldError('');
                              }}
                              placeholder="What to upload"
                              aria-invalid={fieldError.startsWith('Instructions') || undefined}
                              aria-describedby="request-instructions-hint"
                            />
                            <p id="request-instructions-hint" className={`ds-hint rq-count${instructionCount > 500 ? ' is-over' : ''}`}>{instructionCount} of 500 characters</p>
                          </div>
                        </fieldset>

                        {fieldError ? (
                          <p className="ds-alert is-danger" role="alert">
                            <CircleAlert className="w-4 h-4 shrink-0" aria-hidden="true" />
                            {fieldError}
                          </p>
                        ) : null}
                        {uploadError ? (
                          <p className="ds-alert is-danger" role="alert">
                            <CircleAlert className="w-4 h-4 shrink-0" aria-hidden="true" />
                            {uploadError}
                          </p>
                        ) : null}

                        <button type="submit" className="ds-btn ds-btn-dark ds-btn-lg w-full" disabled={creating} aria-busy={creating}>
                          {creating ? <span className="ds-spinner" aria-hidden="true" /> : <Link2 className="w-4 h-4" aria-hidden="true" />}
                          {creating ? 'Creating request…' : 'Create request link'}
                        </button>
                      </form>
                    ) : (
                      <div className="rq-signin">
                        <span className="ds-icon is-blue" aria-hidden="true"><Inbox /></span>
                        <h2 className="ds-h3">Sign in to create the link.</h2>
                        <p className="dl-lead mt-0">The person who uploads does not need an account. They can send up to 6 GB. The link stays open for 7 days.</p>
                        <div className="dl-actions mt-2">
                          <button type="button" className="ds-btn ds-btn-dark" onClick={() => openAuth('login')}>
                            Sign in
                            <ArrowRight className="ds-btn-arrow w-4 h-4" aria-hidden="true" />
                          </button>
                          <Link to="/" className="ds-btn ds-btn-ghost">Send files instead</Link>
                        </div>
                      </div>
                    )}

                    {created?.url ? (
                      <div className="rq-result">
                        <span className="ds-badge ds-badge-green">
                          <Check className="w-3 h-3" aria-hidden="true" />
                          Link ready
                        </span>
                        <h2 className="rq-result-title">{created.title}</h2>
                        <p className="dl-lead mt-1">Send this link to the person who has the files.</p>
                        {createdExpiry ? <p className="ds-hint mt-1">Open until {createdExpiry}</p> : null}
                        <p className="rq-url">{created.url}</p>
                        <div className="dl-actions mt-3">
                          <button type="button" className="ds-btn ds-btn-dark" onClick={handleCopyCreated}>
                            {copied ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
                            {copied ? 'Copied' : 'Copy link'}
                          </button>
                          <a className="ds-btn ds-btn-ghost" href={created.url}>
                            Open request
                            <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
                          </a>
                        </div>
                        <p role="status" className={`ds-hint mt-2${copyError && !copied ? ' text-[#b42318]' : ''}`}>{copied ? 'Link copied.' : copyError}</p>
                      </div>
                    ) : null}
                  </div>
                </div>

                <aside className="rq-side" aria-labelledby="rq-rules-title" data-reveal style={{ '--d': '120ms' }}>
                  <p className="ds-kicker"><b>●</b> The rules</p>
                  <h2 id="rq-rules-title" className="ds-h3 mt-2">What a request link allows</h2>
                  <ul className="ds-checks">
                    <li><Check aria-hidden="true" />Title, up to 120 characters. A blank title is saved as File request.</li>
                    <li><Check aria-hidden="true" />Instructions, up to 500 characters, are shown on their upload page.</li>
                    <li><Check aria-hidden="true" />They can send up to 6 GB.</li>
                    <li><Check aria-hidden="true" />The link stays open for 7 days, or until you close it.</li>
                    <li><Check aria-hidden="true" />Anyone with the link can upload while it is open.</li>
                    <li><Check aria-hidden="true" />This form does not set a download password.</li>
                  </ul>
                </aside>
              </div>

              <section className="rq-steps" aria-labelledby="rq-steps-title">
                <div className="ds-section-head">
                  <p className="ds-kicker"><b>●</b> How it works</p>
                  <h2 id="rq-steps-title" className="ds-h2">Three steps. They never need an account.</h2>
                </div>
                <ol className="ds-steps is-row" style={{ '--n': 3 }}>
                  <li className="ds-step" data-reveal>
                    <h3>Create the link</h3>
                    <p>Sign in, add a title and instructions, and create the request link.</p>
                  </li>
                  <li className="ds-step" data-reveal style={{ '--d': '120ms' }}>
                    <h3>Send it</h3>
                    <p>Paste the link into a message or an email. They open it in a browser.</p>
                  </li>
                  <li className="ds-step" data-reveal style={{ '--d': '240ms' }}>
                    <h3>Collect the files</h3>
                    <p>They upload up to 6 GB. The files show up under Requests in My Files and stay for 7 days.</p>
                  </li>
                </ol>
              </section>
            </div>
          </>
        )}

        {view === 'form' && requestId && portalLoading && (
          <section className="dl-card" aria-busy="true" aria-live="polite">
            <p className="ds-kicker"><span className="ds-spinner" aria-hidden="true" /> File request</p>
            <h1 className="dl-title">Loading this request…</h1>
            <p className="dl-lead">Checking whether it is still accepting files.</p>
            <div className="dl-skel" aria-hidden="true">
              <span className="ds-skeleton" />
              <span className="ds-skeleton" />
            </div>
          </section>
        )}

        {view === 'form' && requestId && !portalLoading && portalError && (
          <section className="dl-card dl-state" role="alert">
            <span className="dl-state-icon" aria-hidden="true"><Link2Off /></span>
            <p className="ds-kicker"><b>●</b> Unavailable</p>
            <h1 className="dl-title">This request could not be opened</h1>
            <p className="dl-lead">{portalError}</p>
            <div className="dl-actions">
              <button type="button" className="ds-btn ds-btn-dark" onClick={() => setReloadKey((value) => value + 1)}>
                Try again
              </button>
              <Link to="/" className="ds-btn ds-btn-ghost">Send your own file</Link>
            </div>
          </section>
        )}

        {view === 'form' && requestId && !portalLoading && portal?.closed && (
          <section className="dl-card dl-state">
            <span className="dl-state-icon" aria-hidden="true"><Lock /></span>
            <p className="ds-kicker"><b>●</b> Closed</p>
            <h1 className="dl-title">{portal.title || 'File request'}</h1>
            <p className="dl-lead">This request is no longer accepting files.</p>
            {portalExpiry ? <p className="ds-hint mt-2">Listed until {portalExpiry}</p> : null}
            <div className="dl-actions">
              <Link to="/" className="ds-btn ds-btn-dark">
                Send your own file
                <ArrowRight className="ds-btn-arrow w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
          </section>
        )}

        {view === 'form' && requestId && portal && !portal.closed && !portalError && (
          <section aria-labelledby="rq-portal-title">
            <p className="ds-kicker"><b>●</b> File request</p>
            <h1 id="rq-portal-title" className="dl-title">{portal.title || 'File request'}</h1>
            {portal.instructions ? (
              <figure className="dl-note">
                <blockquote>
                  <Quote aria-hidden="true" />
                  {portal.instructions}
                </blockquote>
              </figure>
            ) : (
              <p className="dl-lead">Upload the files they asked for. An account is not required.</p>
            )}
            <dl className="dl-meta">
              <div>
                <dt>Limit</dt>
                <dd>6 GB</dd>
              </div>
              {portalExpiry ? (
                <div>
                  <dt>Open until</dt>
                  <dd>{portalExpiry}</dd>
                </div>
              ) : null}
            </dl>

            <div className="ds-frame mt-6">
              <div className="ds-frame-chrome">
                <span className="ds-frame-dots" aria-hidden="true"><i /><i /><i /></span>
                <span className="rq-chrome-label">Upload to {portal.title || 'File request'}</span>
                <span className="ds-badge">No account</span>
              </div>
              <div className="ds-frame-screen">
                {files.length === 0 ? (
                  <DropZone onFilesSelected={handleFilesSelected} />
                ) : (
                  <div className="rq-upload">
                    <FileList
                      files={files}
                      onRemoveFile={handleRemoveFile}
                      onFilesAdded={handleFilesSelected}
                    />

                    <form onSubmit={handleUploadFiles} className="rq-form">
                      <fieldset className="rq-fieldset">
                        <legend className="rq-legend">Optional</legend>
                        <div className="rq-row">
                          <div className="ds-field">
                            <label htmlFor="uploader-name" className="ds-label">Your name</label>
                            <input
                              id="uploader-name"
                              type="text"
                              className="ds-input"
                              value={senderName}
                              onChange={(event) => setSenderName(event.target.value)}
                              placeholder="Name"
                              autoComplete="name"
                            />
                          </div>
                          <div className="ds-field">
                            <label htmlFor="uploader-email" className="ds-label">Your email</label>
                            <input
                              id="uploader-email"
                              type="email"
                              className="ds-input"
                              value={senderEmail}
                              onChange={(event) => setSenderEmail(event.target.value)}
                              placeholder="you@email.com"
                              autoComplete="email"
                            />
                          </div>
                        </div>
                        <div className="ds-field">
                          <label htmlFor="uploader-note" className="ds-label">Note</label>
                          <textarea
                            id="uploader-note"
                            rows={3}
                            className="ds-textarea"
                            value={note}
                            onChange={(event) => setNote(event.target.value)}
                            placeholder="A short note about these files"
                          />
                        </div>
                      </fieldset>

                      {uploadError ? (
                        <p className="ds-alert is-danger" role="alert">
                          <CircleAlert className="w-4 h-4 shrink-0" aria-hidden="true" />
                          {uploadError}
                        </p>
                      ) : null}
                      <button
                        type="submit"
                        disabled={submitting}
                        aria-busy={submitting}
                        className="ds-btn ds-btn-dark ds-btn-lg w-full whitespace-normal text-center"
                      >
                        {submitting ? <span className="ds-spinner" aria-hidden="true" /> : <Upload className="w-4 h-4 shrink-0" aria-hidden="true" />}
                        {submitting
                          ? 'Uploading…'
                          : `Upload ${files.length} file${files.length === 1 ? '' : 's'} (${formatBytes(files.reduce((a, f) => a + f.size, 0))})`}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>

            <ul className="dl-trust" aria-label="About this upload">
              <li><ShieldCheck aria-hidden="true" />Executable files are blocked</li>
              <li><Timer aria-hidden="true" />Files stay for 7 days</li>
              <li><EyeOff aria-hidden="true" />This page is not indexed</li>
            </ul>
          </section>
        )}

        {view === 'progress' && (
          <div className="send-shell">
            <UploadProgress
              progress={progress}
              fileName={currentFileName}
              uploadSpeed={uploadSpeed}
              timeRemaining={timeRemaining}
              status={uploadStatus}
            />
          </div>
        )}

        {view === 'complete' && (
          <section className="dl-card dl-state">
            <span className="dl-state-icon is-green" aria-hidden="true"><CircleCheck /></span>
            <p className="ds-kicker"><b>●</b> Uploaded</p>
            <h1 className="dl-title">Upload finished</h1>
            <p className="dl-lead">
              {shareData?.fileCount || 0} file{shareData?.fileCount === 1 ? '' : 's'}
              {shareData?.totalSize ? ` (${formatBytes(shareData.totalSize)})` : ''} finished uploading.
              The person who created this request can open them. These files stay available for 7 days.
            </p>
            <div className="dl-actions">
              <Link to="/" className="ds-btn ds-btn-dark">
                Send your own files
                <ArrowRight className="ds-btn-arrow w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
          </section>
        )}
      </main>

      <Footer />
      <AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        initialMode={authMode}
        onAuthSuccess={(next) => setUser(next)}
      />
      {profileOpen ? (
        <ProfileModal
          isOpen
          onClose={() => setProfileOpen(false)}
          user={user}
          onAccountChange={setUser}
          onSignOut={async () => {
            try {
              await signOut();
            } catch {
              /* The local session is cleared below either way. */
            }
            setUser(null);
            setProfileOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
