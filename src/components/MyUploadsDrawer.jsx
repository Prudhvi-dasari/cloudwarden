import { useEffect, useRef, useState } from 'react';
import {
  X, Eye, Copy, Trash2, Check, ExternalLink, QrCode,
  File, Image as ImageIcon, Film, Music, FileText, RefreshCw,
  Plus, Lock, LogIn, Pencil, Inbox, AlertCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from './Toast';
import FilePreviewModal from './FilePreviewModal';
import { deleteOwnedTransfer, loadOwnedTransfers, renameOwnedTransfer } from '../lib/guestSession';
import { fileDownloadSummary, transferFilesExhausted } from '../lib/downloadLimit';
import Portal from './Portal';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function fileMeta(file) {
  const summary = fileDownloadSummary(file);
  const size = formatBytes(file.size);
  return summary ? `${size} · ${summary}` : size;
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

async function copyText(value) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const field = document.createElement('textarea');
    field.value = value;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.left = '-9999px';
    document.body.appendChild(field);
    field.select();
    const ok = document.execCommand('copy');
    field.remove();
    return ok;
  } catch {
    return false;
  }
}

function getFileIcon(type, name) {
  const ext = name?.split('.').pop()?.toLowerCase();
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext) || type?.startsWith('image/')) return ImageIcon;
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext) || type?.startsWith('video/')) return Film;
  if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext) || type?.startsWith('audio/')) return Music;
  if (['pdf', 'doc', 'docx', 'txt'].includes(ext)) return FileText;
  return File;
}

function timingLabel(transfer) {
  if (transfer?.status === 'expired') return 'Expired';
  if (!transfer?.expiresAt) return null;
  const when = formatWhen(transfer.expiresAt);
  if (!when) return null;
  if (new Date(transfer.expiresAt).getTime() <= Date.now()) return 'Expired';
  if (transferFilesExhausted(transfer)) return 'Link limit reached';
  return `Open until ${when}`;
}

function statusBadgeClass(label) {
  if (label === 'Expired') return 'ds-badge acct-badge-danger';
  if (label === 'Link limit reached') return 'ds-badge acct-badge-warn';
  return 'ds-badge ds-badge-green';
}

export default function MyUploadsDrawer({ isOpen, onClose, user, onOpenAuth, onStartNewTransfer }) {
  const { addToast } = useToast();
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [activeQrId, setActiveQrId] = useState(null);
  const [previewingFile, setPreviewingFile] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [draftName, setDraftName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const closeRef = useRef(null);

  useEffect(() => {
    if (isOpen) loadUserTransfers();
  }, [isOpen, user]);

  useEffect(() => {
    if (!isOpen) return undefined;
    function onKey(event) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (pendingDelete && !deleting) {
        setPendingDelete(null);
        return;
      }
      onClose?.();
    }
    document.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose, pendingDelete, deleting]);

  async function loadUserTransfers() {
    if (!user) {
      setTransfers([]);
      setLoading(false);
      setLoaded(true);
      setLoadError('');
      return;
    }
    setLoading(true);
    setLoadError('');
    try {
      const { data: sessionWrap } = await supabase.auth.getSession();
      const rows = await loadOwnedTransfers(sessionWrap?.session?.access_token);
      setTransfers(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setLoadError(publicMessage(err?.message) || 'Your transfers could not be loaded.');
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }

  async function handleCopyLink(shareId) {
    const ok = await copyText(`${window.location.origin}/download/${shareId}`);
    if (!ok) {
      addToast('Could not copy the link.', 'error');
      return;
    }
    setCopiedId(shareId);
    addToast('Link copied.', 'success');
    window.setTimeout(() => setCopiedId((current) => (current === shareId ? null : current)), 2000);
  }

  async function handleRenameTransfer(event, transfer) {
    event.preventDefault();
    const next = draftName.trim();
    if (!next || next === (transfer.subject || '') || savingName) return;
    setSavingName(true);
    try {
      const { data: sessionWrap } = await supabase.auth.getSession();
      await renameOwnedTransfer({
        shareId: transfer.shareId,
        subject: next,
        accessToken: sessionWrap?.session?.access_token,
      });
      setTransfers((current) => current.map((item) => (
        item.shareId === transfer.shareId ? { ...item, subject: next } : item
      )));
      setRenamingId(null);
      addToast('Name saved.', 'success');
    } catch (err) {
      addToast(publicMessage(err?.message) || 'The name could not be saved.', 'error');
    } finally {
      setSavingName(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    try {
      const { data: sessionWrap } = await supabase.auth.getSession();
      await deleteOwnedTransfer({
        shareId: pendingDelete.shareId,
        accessToken: sessionWrap?.session?.access_token,
      });
      setTransfers((current) => current.filter((item) => item.shareId !== pendingDelete.shareId));
      setPendingDelete(null);
      addToast('Transfer deleted.', 'info');
    } catch (err) {
      addToast(publicMessage(err?.message) || 'This transfer could not be deleted.', 'error');
    } finally {
      setDeleting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <Portal>
      <div className="acct-ui acct-drawer-layer">
        <button type="button" className="acct-drawer-backdrop" aria-label="Close My files" onClick={onClose} />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="files-drawer-title"
          className="ds-drawer acct-drawer"
        >
          <header className="ds-drawer-head">
            <div className="min-w-0">
              <p className="ds-kicker"><b>●</b> My files</p>
              <h2 id="files-drawer-title" className="acct-drawer-title">Your transfers</h2>
              <p className="acct-hint mt-1 acct-truncate" title={user?.email || undefined}>
                {user?.email || 'Sign in to see transfers from this account.'}
              </p>
            </div>
            <div className="acct-head-actions">
              {user ? (
                <button type="button" className="ds-btn ds-btn-ghost ds-btn-sm" onClick={loadUserTransfers} disabled={loading} aria-busy={loading}>
                  <RefreshCw className={`w-4 h-4 ${loading ? 'motion-safe:animate-spin' : ''}`} aria-hidden="true" />
                  {loading ? 'Refreshing…' : 'Refresh'}
                </button>
              ) : null}
              <button ref={closeRef} type="button" className="acct-iconbtn" aria-label="Close My files" onClick={onClose}>
                <X aria-hidden="true" />
              </button>
            </div>
          </header>

          <div className="ds-drawer-body">
            {!user ? (
              <div className="acct-box ds-empty acct-empty">
                <span className="ds-icon is-dark" aria-hidden="true"><Lock /></span>
                <h3>Sign in to see your transfers</h3>
                <p>History is kept for the account that sent them.</p>
                <button
                  type="button"
                  className="ds-btn ds-btn-dark w-full max-w-[18rem]"
                  onClick={() => {
                    onClose?.();
                    onOpenAuth?.('login');
                  }}
                >
                  <LogIn className="w-4 h-4" aria-hidden="true" />
                  Sign in
                </button>
                <button
                  type="button"
                  className="ds-btn ds-btn-light w-full max-w-[18rem] !mt-0"
                  onClick={() => {
                    onClose?.();
                    onStartNewTransfer?.();
                  }}
                >
                  Continue without an account
                </button>
              </div>
            ) : (!loaded || loading) && transfers.length === 0 && !loadError ? (
              <div className="acct-cards" aria-busy="true">
                <h3 className="acct-hint flex items-center gap-2">
                  <span className="ds-spinner !w-3.5 !h-3.5" aria-hidden="true" />
                  Loading transfers…
                </h3>
                {[0, 1, 2].map((key) => (
                  <div key={key} className="acct-tcard" aria-hidden="true">
                    <div className="acct-tcard-top">
                      <span className="ds-skeleton w-9 h-9 shrink-0" />
                      <div className="flex-1 grid gap-2">
                        <span className="ds-skeleton h-3.5 w-2/3" />
                        <span className="ds-skeleton h-3 w-1/3" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : loadError && transfers.length === 0 ? (
              <div className="acct-box ds-empty acct-empty" role="alert">
                <span className="ds-icon acct-icon-danger" aria-hidden="true"><AlertCircle /></span>
                <h3>Transfers could not be loaded</h3>
                <p>{loadError}</p>
                <button type="button" className="ds-btn ds-btn-ghost" onClick={loadUserTransfers}>
                  <RefreshCw className="w-4 h-4" aria-hidden="true" />
                  Try again
                </button>
              </div>
            ) : transfers.length === 0 ? (
              <div className="acct-box is-dashed ds-empty acct-empty">
                <span className="ds-icon is-blue" aria-hidden="true"><Inbox /></span>
                <h3>No transfers yet</h3>
                <p>Transfers you send while signed in are listed here.</p>
                <button type="button" className="ds-btn ds-btn-dark" onClick={() => { onClose?.(); onStartNewTransfer?.(); }}>
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  New transfer
                </button>
              </div>
            ) : (
              <ul className="acct-cards">
                {loadError ? (
                  <li className="ds-alert is-danger" role="alert">
                    <AlertCircle aria-hidden="true" />
                    <span>{loadError}</span>
                  </li>
                ) : null}
                {transfers.map((transfer) => {
                  const created = formatWhen(transfer.createdAt);
                  const status = timingLabel(transfer);
                  const downloadUrl = `${window.location.origin}/download/${transfer.shareId}`;
                  const firstFile = transfer.files?.[0];
                  const LeadIcon = getFileIcon(firstFile?.type, firstFile?.name);
                  const title = transfer.subject || firstFile?.name || 'Untitled transfer';
                  return (
                    <li key={transfer.shareId} className="acct-tcard">
                      <div className="acct-tcard-top">
                        <span className="ds-file-icon" aria-hidden="true"><LeadIcon className="w-4 h-4" /></span>
                        <div className="flex-1 min-w-0">
                          <h3 className="acct-tcard-title acct-truncate" title={title}>{title}</h3>
                          <p className="acct-meta">
                            {transfer.files?.length || 0} files · {formatBytes(transfer.totalSize)}
                            {created ? ` · ${created}` : ''}
                          </p>
                          {status ? <p className="mt-2"><span className={statusBadgeClass(status)}>{status}</span></p> : null}
                        </div>
                      </div>

                      {renamingId === transfer.shareId ? (
                        <form className="acct-inline acct-rename !mt-3" onSubmit={(event) => handleRenameTransfer(event, transfer)}>
                          <label htmlFor={`rename-${transfer.shareId}`} className="ds-label">Name</label>
                          <input
                            id={`rename-${transfer.shareId}`}
                            className="ds-input"
                            value={draftName}
                            onChange={(event) => setDraftName(event.target.value)}
                          />
                          <div className="acct-actions !mt-1">
                            <button type="submit" className="ds-btn ds-btn-dark ds-btn-sm" disabled={savingName} aria-busy={savingName}>
                              {savingName ? 'Saving…' : 'Save name'}
                            </button>
                            <button type="button" className="ds-btn ds-btn-light ds-btn-sm" onClick={() => setRenamingId(null)}>Cancel</button>
                          </div>
                        </form>
                      ) : null}

                      <ul className="acct-files">
                        {(transfer.files || []).map((file, index) => {
                          const Icon = getFileIcon(file.type, file.name);
                          return (
                            <li key={file.id || `${file.name}-${index}`} className="acct-file">
                              <span className="ds-file-icon" aria-hidden="true"><Icon /></span>
                              <span className="acct-file-body">
                                <span className="acct-file-name acct-truncate" title={file.name}>{file.name}</span>
                                <span className="acct-meta block !mt-0.5">{fileMeta(file)}</span>
                              </span>
                              <button
                                type="button"
                                className="ds-btn ds-btn-light ds-btn-sm"
                                onClick={() => setPreviewingFile({
                                  id: file.id,
                                  file_name: file.name,
                                  file_size: file.size,
                                  content_type: file.type,
                                  share_id: transfer.shareId,
                                })}
                              >
                                <Eye className="w-4 h-4" aria-hidden="true" />
                                Preview
                              </button>
                            </li>
                          );
                        })}
                      </ul>

                      <div className="acct-actions">
                        <button type="button" className="ds-btn ds-btn-dark ds-btn-sm" onClick={() => handleCopyLink(transfer.shareId)}>
                          {copiedId === transfer.shareId ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
                          {copiedId === transfer.shareId ? 'Copied' : 'Copy link'}
                        </button>
                        <a className="ds-btn ds-btn-ghost ds-btn-sm" href={downloadUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="w-4 h-4" aria-hidden="true" />
                          Open
                        </a>
                        <button
                          type="button"
                          className="ds-btn ds-btn-ghost ds-btn-sm"
                          aria-expanded={activeQrId === transfer.shareId}
                          onClick={() => setActiveQrId((current) => (current === transfer.shareId ? null : transfer.shareId))}
                        >
                          <QrCode className="w-4 h-4" aria-hidden="true" />
                          QR
                        </button>
                        <button
                          type="button"
                          className="ds-btn ds-btn-ghost ds-btn-sm"
                          onClick={() => {
                            setRenamingId(transfer.shareId);
                            setDraftName(transfer.subject || '');
                          }}
                        >
                          <Pencil className="w-4 h-4" aria-hidden="true" />
                          Rename
                        </button>
                        <button type="button" className="ds-btn ds-btn-danger ds-btn-sm" onClick={() => setPendingDelete(transfer)}>
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                          Delete
                        </button>
                      </div>

                      {activeQrId === transfer.shareId ? (
                        <div className="acct-inline acct-qr">
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(downloadUrl)}`}
                            alt=""
                            width="140"
                            height="140"
                          />
                          <p className="acct-lead text-sm">Scan to open this transfer.</p>
                        </div>
                      ) : null}

                      {pendingDelete?.shareId === transfer.shareId ? (
                        <div className="acct-inline is-danger" role="alertdialog" aria-labelledby={`delete-${transfer.shareId}`}>
                          <p id={`delete-${transfer.shareId}`}>Delete this transfer? The files will be removed.</p>
                          <div className="acct-actions">
                            <button type="button" className="ds-btn ds-btn-ghost ds-btn-sm" onClick={() => setPendingDelete(null)} disabled={deleting}>Keep it</button>
                            <button type="button" className="ds-btn ds-btn-danger ds-btn-sm" onClick={confirmDelete} disabled={deleting} aria-busy={deleting}>
                              {deleting ? 'Deleting…' : 'Delete'}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {user ? (
            <footer className="acct-drawer-foot">
              <button type="button" className="ds-btn ds-btn-dark w-full" onClick={() => { onClose?.(); onStartNewTransfer?.(); }}>
                <Plus className="w-4 h-4" aria-hidden="true" />
                New transfer
              </button>
            </footer>
          ) : null}
        </div>
      </div>

      {previewingFile ? (
        <FilePreviewModal
          file={previewingFile}
          shareId={previewingFile.share_id}
          onClose={() => setPreviewingFile(null)}
        />
      ) : null}
    </Portal>
  );
}
