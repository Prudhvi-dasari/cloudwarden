import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import JSZip from 'jszip';
import { activeStorageProvider } from '../lib/storageProvider';
import { everyFileExhausted, fileDownloadAllowance } from '../lib/downloadLimit';
import { playDownloadChime } from '../lib/sound';
import { useAccount } from '../lib/AccountContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import Portal from '../components/Portal';
import AuthModal from '../components/AuthModal';
import ProfileModal from '../components/ProfileModal';
import {
  Download, FileText, File, Image, Film, Music, Eye, EyeOff, X, Lock, Link2Off, Hourglass,
  ArrowRight, RotateCw, CircleAlert, FileArchive, Cloud, Timer, Quote,
} from 'lucide-react';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatWhen(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function expiresIn(iso) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const minutes = Math.ceil(ms / 60000);
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `in ${hours} hour${hours === 1 ? '' : 's'}`;
  return `in ${Math.round(hours / 24)} days`;
}

function fileExt(name) {
  const parts = String(name || '').split('.');
  if (parts.length < 2) return '';
  return parts.pop().slice(0, 5).toUpperCase();
}

function publicMessage(value) {
  const message = typeof value === 'string' ? value.trim() : '';
  if (!message || message.length > 160 || /password_hash|secret|token|LOCAL_/i.test(message)) return '';
  return message;
}

function loadFailure(res, data) {
  const code = data?.code || '';
  const safe = publicMessage(data?.error);

  if (res.status === 400 || code === 'SHARE_INVALID') {
    return { title: 'This link is not valid.', detail: 'Check the address and try again.' };
  }
  if (res.status === 404 || code === 'NOT_FOUND') {
    return {
      title: 'This link does not match a transfer.',
      detail: 'It may have been deleted, or the address is wrong. It cannot be restored from here.',
    };
  }
  if (code === 'NOT_READY' || res.status === 409) {
    return {
      title: 'This transfer is not ready.',
      detail: safe && safe !== 'This transfer is not ready.' ? safe : 'The files have not finished uploading.',
      retry: true,
    };
  }
  if (code === 'DOWNLOAD_LIMIT') {
    return {
      title: 'This transfer reached its link limit.',
      detail: 'The files are no longer available.',
    };
  }
  if (res.status === 429 || code === 'RATE_LIMITED' || code === 'PASSWORD_RATE_LIMIT') {
    return {
      title: 'Too many attempts.',
      detail: safe || 'Wait a moment, then try again.',
      retry: true,
    };
  }
  if (res.status === 503 || code === 'RATE_LIMIT_UNAVAILABLE' || code === 'LOCAL_API_DISABLED') {
    return {
      title: 'This transfer could not be loaded.',
      detail: 'Try again in a moment.',
      retry: true,
    };
  }
  return {
    title: 'This transfer could not be loaded.',
    detail: safe || 'Try again in a moment.',
    retry: res.status >= 500,
  };
}

function getFileTypeCategory(contentType, fileName) {
  const ext = fileName?.split('.').pop()?.toLowerCase();
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext) || contentType?.startsWith('image/')) return 'image';
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext) || contentType?.startsWith('video/')) return 'video';
  if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext) || contentType?.startsWith('audio/')) return 'audio';
  if (['pdf'].includes(ext) || contentType === 'application/pdf') return 'pdf';
  if (['doc', 'docx', 'txt', 'rtf'].includes(ext)) return 'text';
  return 'file';
}

function getFileIcon(category) {
  if (category === 'image') return Image;
  if (category === 'video') return Film;
  if (category === 'audio') return Music;
  if (category === 'pdf' || category === 'text') return FileText;
  return File;
}

function liveFile(current, file) {
  return current?.files?.find((item) => item.id === file.id) || file;
}

function senderLabel(email) {
  if (!email || String(email).startsWith('guest:')) return null;
  return String(email);
}

function TransferFacts({ subject, fileCount, totalSize, expiresAt, senderEmail, downloadsLeft }) {
  const when = formatWhen(expiresAt);
  const countdown = expiresIn(expiresAt);
  const sender = senderLabel(senderEmail);
  const hasFiles = Number.isFinite(Number(fileCount));
  if (!subject && !hasFiles && !when && !sender && downloadsLeft == null) return null;

  return (
    <dl className="dl-meta">
      {subject ? (
        <div>
          <dt>Title</dt>
          <dd className="truncate" title={subject}>{subject}</dd>
        </div>
      ) : null}
      {hasFiles ? (
        <div>
          <dt>Files</dt>
          <dd>
            {fileCount} {Number(fileCount) === 1 ? 'file' : 'files'}
            <span className="dl-meta-sub">{formatBytes(totalSize || 0)}</span>
          </dd>
        </div>
      ) : null}
      {when ? (
        <div>
          <dt>Open until</dt>
          <dd>
            <time dateTime={expiresAt}>{countdown ? `Expires ${countdown}` : when}</time>
            {countdown ? <span className="dl-meta-sub">{when}</span> : null}
          </dd>
        </div>
      ) : null}
      {downloadsLeft != null ? (
        <div>
          <dt>Links left</dt>
          <dd>{downloadsLeft}</dd>
        </div>
      ) : null}
      {sender ? (
        <div>
          <dt>From</dt>
          <dd>{sender}</dd>
        </div>
      ) : null}
    </dl>
  );
}

function TrustLine() {
  return (
    <ul className="dl-trust" aria-label="About this link">
      <li><Cloud aria-hidden="true" />Stored on Cloudflare R2</li>
      <li><Timer aria-hidden="true" />Deleted after the link expires</li>
      <li><EyeOff aria-hidden="true" />This page is not indexed</li>
    </ul>
  );
}

export default function DownloadPage() {
  const { shareId } = useParams();
  const { user, setUser, signOut } = useAccount();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [profileOpen, setProfileOpen] = useState(false);
  const requestRef = useRef(0);
  const previewCloseRef = useRef(null);
  const [transfer, setTransfer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState({});
  const [actionError, setActionError] = useState('');
  const [zippingAll, setZippingAll] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);

  const [isLocked, setIsLocked] = useState(false);
  const [inputPassword, setInputPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [checkingPassword, setCheckingPassword] = useState(false);

  const [isExpired, setIsExpired] = useState(false);
  const [expiredTransfer, setExpiredTransfer] = useState(null);

  const [previewFile, setPreviewFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    loadTransfer();
  }, [shareId]);

  useEffect(() => {
    if (!previewFile) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setLoadingPreview(false);
        setPreviewFile(null);
        setPreviewUrl((current) => {
          if (current?.startsWith('blob:')) URL.revokeObjectURL(current);
          return null;
        });
      }
    };
    window.addEventListener('keydown', onKey);
    previewCloseRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [previewFile]);

  async function loadTransfer() {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setLoading(true);
    setError(null);
    setActionError('');
    setIsExpired(false);
    setExpiredTransfer(null);
    setTransfer(null);
    setIsLocked(false);
    setPasswordError('');

    try {
      const cleanShareId = (shareId || '').trim();
      const res = await fetch(`/api/r2?action=share-meta&shareId=${encodeURIComponent(cleanShareId)}`);
      const data = await res.json().catch(() => ({}));
      if (requestId !== requestRef.current) return;

      if (res.status === 410 && data.code === 'EXPIRED') {
        setIsExpired(true);
        setExpiredTransfer({
          subject: data.subject || null,
          fileCount: Number.isFinite(Number(data.fileCount)) ? Number(data.fileCount) : null,
          totalSize: data.totalSize || 0,
          expiresAt: data.expiresAt || null,
        });
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError(loadFailure(res, data));
        setLoading(false);
        return;
      }

      const files = (data.files || []).map((file) => ({
        id: file.id,
        file_name: file.fileName,
        file_size: file.fileSize,
        content_type: file.contentType,
        downloadCount: Number(file.downloadCount || 0),
        maxDownloads: Number(file.maxDownloads || 0),
      }));

      if (everyFileExhausted(files)) {
        setError({
          title: 'This transfer reached its link limit.',
          detail: 'The files are no longer available.',
        });
        setLoading(false);
        return;
      }

      if (data.passwordRequired) setIsLocked(true);

      setTransfer({
        shareId: data.shareId,
        files,
        subject: data.subject,
        message: data.message,
        senderEmail: data.senderEmail,
        brandLogo: typeof data.brandLogo === 'string' && data.brandLogo.startsWith('https://') ? data.brandLogo : null,
        brandAccent: /^#[0-9a-f]{6}$/.test(data.brandAccent || '') ? data.brandAccent : null,
        brandInk: /^#[0-9a-f]{6}$/.test(data.brandInk || '') ? data.brandInk : null,
        brandBackground: typeof data.brandBackground === 'string' && data.brandBackground.startsWith('https://') ? data.brandBackground : null,
        brandMessage: typeof data.brandMessage === 'string' ? data.brandMessage.slice(0, 240) : '',
        expiresAt: data.expiresAt,
        totalSize: data.totalSize || 0,
      });
      setLoading(false);
    } catch {
      if (requestId !== requestRef.current) return;
      setError({
        title: 'This transfer could not be loaded.',
        detail: 'Try again in a moment.',
        retry: true,
      });
      setLoading(false);
    }
  }

  async function handleUnlock(e) {
    if (e) e.preventDefault();
    if (checkingPassword) return;
    if (!inputPassword.trim()) {
      setPasswordError('Enter the password.');
      return;
    }

    setCheckingPassword(true);
    setPasswordError('');
    try {
      const res = await fetch('/api/r2?action=verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shareId,
          inputPassword: inputPassword.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      const unlocked = res.ok && data.success;

      if (!unlocked) {
        setPasswordError(publicMessage(data.error) || (res.status === 429
          ? 'Too many password attempts. Wait a moment and try again.'
          : 'Incorrect password.'));
        return;
      }

      setIsLocked(false);
      setPasswordError('');
    } catch {
      setPasswordError('The password could not be checked. Try again.');
    } finally {
      setCheckingPassword(false);
    }
  }

  function noteDownload(fileId) {
    setTransfer((prev) => {
      if (!prev?.files) return prev;
      return {
        ...prev,
        files: prev.files.map((item) => (
          item.id === fileId
            ? { ...item, downloadCount: Number(item.downloadCount || 0) + 1 }
            : item
        )),
      };
    });
  }

  async function handleDownload(file) {
    setDownloading((prev) => ({ ...prev, [file.id]: true }));
    setActionError('');
    try {
      const downloadUrl = await activeStorageProvider.getSignedDownloadUrl(null, file.file_name, {
        shareId: transfer?.shareId || shareId,
        fileId: file.id,
        password: inputPassword || '',
      });

      if (!downloadUrl) {
        throw new Error('Unable to generate download link.');
      }

      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = file.file_name;
      a.rel = 'noopener';
      a.style.display = 'none';

      document.body.appendChild(a);
      a.click();
      a.remove();
      playDownloadChime();
      noteDownload(file.id);
    } catch (err) {
      setActionError(publicMessage(err?.message) || 'This file could not be downloaded.');
    } finally {
      setDownloading((prev) => ({ ...prev, [file.id]: false }));
    }
  }

  async function handleDownloadAllZip() {
    const files = (transfer?.files || []).filter((file) => !fileDownloadAllowance(file).exhausted);
    if (files.length === 0 || zippingAll) return;
    setZippingAll(true);
    setZipProgress(10);
    setActionError('');

    try {
      const zip = new JSZip();

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileBlob = await activeStorageProvider.downloadFile(null, file.file_name, {
          shareId: transfer.shareId || shareId,
          fileId: file.id,
          password: inputPassword || '',
        });
        zip.file(file.file_name, fileBlob);
        noteDownload(file.id);
        setZipProgress(Math.round(((i + 1) / files.length) * 70));
      }

      setZipProgress(85);
      const content = await zip.generateAsync({ type: 'blob' }, (metadata) => {
        setZipProgress(85 + Math.round(metadata.percent * 0.15));
      });

      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${transfer.subject || 'itransfer-files'}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      playDownloadChime();
    } catch (err) {
      setActionError(publicMessage(err?.message) || 'The zip could not be created. You can still download each file on its own.');
    } finally {
      setZippingAll(false);
      setZipProgress(0);
    }
  }

  async function handleOpenPreview(file) {
    setPreviewFile(file);
    setLoadingPreview(true);
    setPreviewUrl(null);
    setActionError('');

    try {
      const streamUrl = await activeStorageProvider.getPreviewUrl(null, file.file_name, {
        shareId: transfer?.shareId || shareId,
        fileId: file.id,
        password: inputPassword || '',
      });
      if (!streamUrl) throw new Error('Preview not available');
      setPreviewUrl(streamUrl);
      noteDownload(file.id);
    } catch {
      setActionError('A preview is not available for this file. You can still download it.');
      setPreviewFile(null);
      setPreviewUrl(null);
    } finally {
      setLoadingPreview(false);
    }
  }

  function handleClosePreview() {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewFile(null);
    setPreviewUrl(null);
  }

  const previewCategory = previewFile
    ? getFileTypeCategory(previewFile.content_type, previewFile.file_name)
    : null;
  const previewAllowance = previewFile ? fileDownloadAllowance(liveFile(transfer, previewFile)) : null;
  const PreviewIcon = previewCategory ? getFileIcon(previewCategory) : File;

  const readyFiles = transfer?.files || [];
  const canZip = readyFiles.filter((file) => !fileDownloadAllowance(file).exhausted).length > 1;
  const singleFile = readyFiles.length === 1 ? readyFiles[0] : null;
  const heroAction = canZip ? 'zip' : singleFile ? 'single' : null;
  const readySender = senderLabel(transfer?.senderEmail);
  const readyTitle = transfer?.subject || (singleFile ? singleFile.file_name : 'Files for you');
  const singleAllowance = singleFile ? fileDownloadAllowance(singleFile) : null;
  const singleDownloading = singleFile ? Boolean(downloading[singleFile.id]) : false;

  function openAuth(mode = 'login') {
    setAuthMode(mode);
    setAuthOpen(true);
  }

  return (
    <div className="ds-page dl-page">
      <Navbar onOpenAuth={openAuth} onOpenProfile={() => setProfileOpen(true)} />

      <main className="dl-main ds-wrap dl-stage">
        {loading && (
          <section className="dl-card" aria-busy="true" aria-live="polite">
            <p className="ds-kicker"><span className="ds-spinner" aria-hidden="true" /> SendToAnyone</p>
            <h1 className="dl-title">Loading this transfer…</h1>
            <p className="dl-lead">Checking whether the files are still available.</p>
            <div className="dl-skel" aria-hidden="true">
              <span className="ds-skeleton" />
              <span className="ds-skeleton" />
              <span className="ds-skeleton" />
            </div>
          </section>
        )}

        {!loading && error && (
          <section className="dl-card dl-state" role="alert">
            <span className="dl-state-icon" aria-hidden="true"><Link2Off /></span>
            <p className="ds-kicker"><b>●</b> Unavailable</p>
            <h1 className="dl-title">{error.title}</h1>
            <p className="dl-lead">{error.detail}</p>
            <div className="dl-actions">
              {error.retry ? (
                <button type="button" className="ds-btn ds-btn-dark" onClick={loadTransfer}>
                  <RotateCw className="w-4 h-4" aria-hidden="true" />
                  Try again
                </button>
              ) : null}
              <Link to="/" className={`ds-btn ${error.retry ? 'ds-btn-ghost' : 'ds-btn-dark'}`}>
                Send your own file
                <ArrowRight className="ds-btn-arrow w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
          </section>
        )}

        {!loading && isExpired && (
          <section className="dl-card dl-state">
            <span className="dl-state-icon" aria-hidden="true"><Hourglass /></span>
            <p className="ds-kicker"><b>●</b> Expired</p>
            <h1 className="dl-title">This transfer has expired</h1>
            <p className="dl-lead">The files are no longer available. Ask the person who sent the link if they can send it again.</p>
            <TransferFacts
              subject={expiredTransfer?.subject}
              fileCount={expiredTransfer?.fileCount}
              totalSize={expiredTransfer?.totalSize}
            />
            <div className="dl-actions">
              <Link to="/" className="ds-btn ds-btn-dark">
                Send your own file
                <ArrowRight className="ds-btn-arrow w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
          </section>
        )}

        {!loading && !error && !isExpired && transfer && isLocked && (
          <>
            <section className="dl-card" aria-labelledby="dl-locked-title">
              <span className="dl-lock" aria-hidden="true"><Lock /></span>
              <p className="ds-kicker mt-5"><b>●</b> Password required</p>
              <h1 id="dl-locked-title" className="dl-title">{transfer.subject || 'This transfer needs a password'}</h1>
              <p className="dl-lead">Enter the password that came with the link. Downloads stay locked until it matches.</p>
              <TransferFacts
                fileCount={transfer.files?.length}
                totalSize={transfer.totalSize}
                expiresAt={transfer.expiresAt}
                senderEmail={transfer.senderEmail}
              />
              <form className="dl-unlock" onSubmit={handleUnlock} noValidate>
                <div className="ds-field">
                  <label htmlFor="transfer-password" className="ds-label">Password</label>
                  <div className="dl-pass">
                    <input
                      id="transfer-password"
                      name="transfer-password"
                      className="ds-input"
                      type={showPassword ? 'text' : 'password'}
                      value={inputPassword}
                      onChange={(event) => {
                        setInputPassword(event.target.value);
                        if (passwordError) setPasswordError('');
                      }}
                      autoComplete="off"
                      spellCheck="false"
                      aria-invalid={passwordError ? 'true' : 'false'}
                      aria-describedby="transfer-password-error"
                      disabled={checkingPassword}
                    />
                    <button
                      type="button"
                      className="dl-pass-toggle"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword((value) => !value)}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                    </button>
                  </div>
                </div>
                <p
                  id="transfer-password-error"
                  className={passwordError ? 'ds-alert is-danger' : 'sr-only'}
                  role="alert"
                  aria-live="polite"
                >
                  {passwordError ? <CircleAlert className="w-4 h-4 shrink-0" aria-hidden="true" /> : null}
                  {passwordError}
                </p>
                <button type="submit" className="ds-btn ds-btn-dark ds-btn-lg dl-cta" disabled={checkingPassword} aria-busy={checkingPassword}>
                  {checkingPassword ? <span className="ds-spinner" aria-hidden="true" /> : <Lock aria-hidden="true" />}
                  {checkingPassword ? 'Checking password…' : 'Continue'}
                </button>
              </form>
              {transfer.files?.length ? (
                <>
                  <div className="dl-tear" aria-hidden="true" />
                  <div className="dl-files-head">
                    <p className="ds-kicker">In this transfer</p>
                    <p className="dl-files-count">{formatBytes(transfer.totalSize || 0)}</p>
                  </div>
                  <ul className="dl-files">
                    {transfer.files.map((file) => {
                      const category = getFileTypeCategory(file.content_type, file.file_name);
                      const Icon = getFileIcon(category);
                      const ext = fileExt(file.file_name);
                      return (
                        <li key={file.id} className="dl-file">
                          <span className="dl-type" data-kind={category} aria-hidden="true"><Icon /></span>
                          <div className="min-w-0">
                            <p className="dl-file-name" title={file.file_name}>{file.file_name}</p>
                            <p className="dl-file-sub">
                              {ext ? <span>{ext}</span> : null}
                              <span>{formatBytes(file.file_size)}</span>
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : null}
            </section>
            <TrustLine />
            <p className="dl-after">
              Have something to send back? <Link to="/" className="ds-link">Send your own file</Link>
            </p>
          </>
        )}

        {!loading && !error && !isExpired && transfer && !isLocked && (
          <>
            <section
              className="dl-card"
              aria-labelledby="dl-ready-title"
              style={transfer.brandAccent ? { borderTopColor: transfer.brandAccent, borderTopWidth: 3 } : undefined}
            >
              {transfer.brandBackground ? (
                <img src={transfer.brandBackground} alt="" className="dl-brand-bg" />
              ) : null}
              <div className="dl-head">
                <p className="ds-kicker"><b>●</b> Shared with you</p>
                <span className="ds-badge ds-badge-green">
                  <span className="ds-dot-live" aria-hidden="true" />
                  Link open
                </span>
              </div>
              {transfer.brandLogo ? (
                <img src={transfer.brandLogo} alt="" className="mt-3 h-8 w-auto max-w-[10rem] object-contain" />
              ) : null}
              {transfer.brandMessage ? <p className="dl-brand-note">{transfer.brandMessage}</p> : null}
              <h1 id="dl-ready-title" className="dl-title" title={readyTitle}>{readyTitle}</h1>
              {transfer.message || readySender ? (
                <figure className="dl-note">
                  {transfer.message ? (
                    <blockquote>
                      <Quote aria-hidden="true" />
                      {transfer.message}
                    </blockquote>
                  ) : null}
                  {readySender ? (
                    <figcaption>
                      <span className="dl-avatar" aria-hidden="true">{readySender.charAt(0).toUpperCase()}</span>
                      <span className="min-w-0 truncate">From <b>{readySender}</b></span>
                    </figcaption>
                  ) : null}
                </figure>
              ) : null}
              <TransferFacts
                fileCount={transfer.files?.length}
                totalSize={transfer.totalSize}
                expiresAt={transfer.expiresAt}
              />

              <div className="dl-tear" aria-hidden="true" />

              <p
                className={actionError ? 'ds-alert is-danger mb-4' : 'sr-only'}
                role={actionError ? 'alert' : undefined}
                aria-live="polite"
              >
                {actionError ? <CircleAlert className="w-4 h-4 shrink-0" aria-hidden="true" /> : null}
                {actionError}
              </p>
              {transfer.files?.length ? (
                <>
                  <div className="dl-files-head">
                    <p className="ds-kicker">In this transfer</p>
                    <p className="dl-files-count">{formatBytes(transfer.totalSize || 0)}</p>
                  </div>
                  <ul className="dl-files">
                    {transfer.files.map((file) => {
                      const category = getFileTypeCategory(file.content_type, file.file_name);
                      const Icon = getFileIcon(category);
                      const canPreview = ['image', 'video', 'audio', 'pdf'].includes(category);
                      const isDownloading = Boolean(downloading[file.id]);
                      const allowance = fileDownloadAllowance(file);
                      const ext = fileExt(file.file_name);
                      const rowDownload = heroAction !== 'single';
                      return (
                        <li key={file.id} className="dl-file">
                          <span className="dl-type" data-kind={category} aria-hidden="true"><Icon /></span>
                          <div className="min-w-0">
                            <p className="dl-file-name" title={file.file_name}>{file.file_name}</p>
                            <p className="dl-file-sub">
                              {ext ? <span>{ext}</span> : null}
                              <span>{formatBytes(file.file_size)}</span>
                              {allowance.limited ? (
                                <span className={allowance.exhausted ? 'is-out' : 'is-limit'}>
                                  {allowance.exhausted ? 'Link limit reached' : `${allowance.remaining} links left`}
                                </span>
                              ) : null}
                            </p>
                          </div>
                          {canPreview || rowDownload ? (
                            <div className="dl-file-actions">
                              {canPreview ? (
                                <button
                                  type="button"
                                  className="ds-btn ds-btn-ghost ds-btn-sm"
                                  onClick={() => handleOpenPreview(file)}
                                  disabled={allowance.exhausted}
                                >
                                  <Eye className="w-4 h-4" aria-hidden="true" />
                                  Preview
                                </button>
                              ) : null}
                              {rowDownload ? (
                                <button
                                  type="button"
                                  className={`ds-btn ${heroAction === 'zip' ? 'ds-btn-ghost' : 'ds-btn-dark'} ds-btn-sm`}
                                  onClick={() => handleDownload(file)}
                                  disabled={isDownloading || zippingAll || allowance.exhausted}
                                  aria-busy={isDownloading}
                                >
                                  {isDownloading ? <span className="ds-spinner" aria-hidden="true" /> : <Download className="w-4 h-4" aria-hidden="true" />}
                                  {isDownloading ? 'Preparing…' : 'Download'}
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : (
                <div className="ds-empty">
                  <h3>Nothing to download</h3>
                  <p>This transfer has no files to download.</p>
                </div>
              )}

              {heroAction === 'zip' ? (
                <div className="dl-cta-block">
                  <button
                    type="button"
                    className="ds-btn ds-btn-dark ds-btn-lg dl-cta"
                    onClick={handleDownloadAllZip}
                    disabled={zippingAll}
                    aria-busy={zippingAll}
                  >
                    {zippingAll ? <span className="ds-spinner" aria-hidden="true" /> : <FileArchive aria-hidden="true" />}
                    {zippingAll ? `Preparing zip… ${zipProgress}%` : 'Download all as a zip'}
                  </button>
                  {zippingAll ? (
                    <div
                      className="ds-progress"
                      role="progressbar"
                      aria-label="Zip progress"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={zipProgress}
                    >
                      <i style={{ width: `${zipProgress}%` }} />
                    </div>
                  ) : null}
                </div>
              ) : null}

              {heroAction === 'single' ? (
                <div className="dl-cta-block">
                  <button
                    type="button"
                    className="ds-btn ds-btn-dark ds-btn-lg dl-cta"
                    onClick={() => handleDownload(singleFile)}
                    disabled={singleDownloading || zippingAll || singleAllowance.exhausted}
                    aria-busy={singleDownloading}
                  >
                    {singleDownloading ? <span className="ds-spinner" aria-hidden="true" /> : <Download aria-hidden="true" />}
                    {singleDownloading ? 'Preparing…' : 'Download'}
                  </button>
                </div>
              ) : null}
            </section>
            <TrustLine />
            <p className="dl-after">
              Have something to send back? <Link to="/" className="ds-link">Send your own file</Link>
            </p>
          </>
        )}
      </main>

      {previewFile && (
        <Portal>
          <div className="ds-modal-backdrop" onClick={handleClosePreview}>
            <div
              className="ds-modal is-wide dl-preview"
              role="dialog"
              aria-modal="true"
              aria-labelledby="receive-preview-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="dl-preview-head">
                <span className="dl-type is-sm" data-kind={previewCategory} aria-hidden="true"><PreviewIcon /></span>
                <div className="min-w-0 flex-1">
                  <p id="receive-preview-title" className="dl-preview-title" title={previewFile.file_name}>{previewFile.file_name}</p>
                  <p className="dl-preview-sub">
                    {fileExt(previewFile.file_name) ? `${fileExt(previewFile.file_name)} · ` : ''}
                    {formatBytes(previewFile.file_size)}
                  </p>
                </div>
                <button
                  ref={previewCloseRef}
                  type="button"
                  className="ds-close"
                  aria-label="Close preview"
                  onClick={handleClosePreview}
                >
                  <X className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>
              <div className="dl-preview-body" aria-live="polite">
                {loadingPreview ? (
                  <p className="dl-preview-wait"><span className="ds-spinner" aria-hidden="true" />Loading preview…</p>
                ) : previewUrl && previewCategory === 'image' ? (
                  <img src={previewUrl} alt={previewFile.file_name} />
                ) : previewUrl && previewCategory === 'video' ? (
                  <video src={previewUrl} controls />
                ) : previewUrl && previewCategory === 'audio' ? (
                  <div className="dl-preview-audio">
                    <span className="dl-type" data-kind="audio" aria-hidden="true"><Music /></span>
                    <audio src={previewUrl} controls />
                  </div>
                ) : previewUrl && previewCategory === 'pdf' ? (
                  <iframe src={previewUrl} title={previewFile.file_name} />
                ) : (
                  <p className="dl-preview-wait">A preview is not available for this file.</p>
                )}
              </div>
              <div className="dl-preview-foot is-end">
                <button
                  type="button"
                  className="ds-btn ds-btn-dark"
                  onClick={() => handleDownload(previewFile)}
                  disabled={Boolean(downloading[previewFile.id]) || previewAllowance?.exhausted}
                >
                  {downloading[previewFile.id] ? <span className="ds-spinner" aria-hidden="true" /> : <Download className="w-4 h-4" aria-hidden="true" />}
                  {downloading[previewFile.id] ? 'Preparing…' : 'Download'}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      <Footer />

      <AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        initialMode={authMode}
        onAuthSuccess={(nextUser) => setUser(nextUser)}
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
