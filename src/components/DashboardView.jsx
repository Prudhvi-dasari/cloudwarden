import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  Copy, Check, Trash2, ExternalLink, Search, RefreshCw,
  Plus, Inbox, Users, Settings, Volume2, VolumeX, Lock,
  AlertCircle, ArrowLeft, Ban, FolderOpen, MousePointerClick,
  File, Image as ImageIcon, Film, Music, FileText,
} from 'lucide-react';
import { isSoundEnabled, setSoundEnabled, playSuccessChime } from '../lib/sound';
import { useToast } from './Toast';
import Portal from './Portal';
import {
  closeFileRequest,
  createFileRequest,
  deleteOwnedTransfer,
  loadFileRequests,
  loadOwnedTransfers,
  renameOwnedTransfer,
} from '../lib/guestSession';
import { fileDownloadSummary, transferFilesExhausted } from '../lib/downloadLimit';

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

function requestStatus(portal, now = Date.now()) {
  if (!portal) return 'Status unavailable';
  if (portal.status === 'closed') return 'Closed';
  if (portal.status === 'active') {
    const expiry = portal.expiresAt ? new Date(portal.expiresAt).getTime() : NaN;
    if (Number.isFinite(expiry) && expiry <= now) return 'No longer accepting files';
    return 'Accepting files';
  }
  return portal.status ? String(portal.status) : 'Status unavailable';
}

function visibleSender(email) {
  const value = String(email || '').trim();
  if (!value || value.toLowerCase().startsWith('guest:')) return '';
  return value;
}

function requestLimitError(title, instructions) {
  if (title.trim().length > 120) return 'Title must be 120 characters or fewer.';
  if (instructions.trim().length > 500) return 'Instructions must be 500 characters or fewer.';
  return '';
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
    /* fall through to the older copy path */
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

function transferTiming(transfer, now = Date.now()) {
  if (transfer?.status === 'expired') return { state: 'expired', label: 'Expired' };
  const expires = transfer?.expiresAt ? new Date(transfer.expiresAt).getTime() : NaN;
  if (!Number.isFinite(expires)) return { state: 'open', label: null };
  if (expires <= now) return { state: 'expired', label: 'Expired' };
  if (transferFilesExhausted(transfer)) {
    return { state: 'limit', label: 'Link limit reached' };
  }
  return { state: 'open', label: `Open until ${formatWhen(transfer.expiresAt)}` };
}

function transferTitle(transfer) {
  return transfer?.subject || transfer?.files?.[0]?.name || 'Untitled transfer';
}

function matchesQuery(transfer, query) {
  if (!query) return true;
  const haystack = [
    transfer.subject,
    transfer.recipientEmails,
    transfer.message,
    ...(transfer.files || []).map((file) => file.name),
  ].filter(Boolean).join(' ').toLowerCase();
  return haystack.includes(query);
}

const SECTIONS = [
  { id: 'transfers', label: 'Transfers' },
  { id: 'requests', label: 'Requests' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'preferences', label: 'Preferences' },
];

const SECTION_ICONS = {
  transfers: FolderOpen,
  requests: Inbox,
  contacts: Users,
  preferences: Settings,
};

function getFileIcon(type, name) {
  const ext = name?.split('.').pop()?.toLowerCase();
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext) || type?.startsWith('image/')) return ImageIcon;
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext) || type?.startsWith('video/')) return Film;
  if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext) || type?.startsWith('audio/')) return Music;
  if (['pdf', 'doc', 'docx', 'txt'].includes(ext)) return FileText;
  return File;
}

function timingBadgeClass(state) {
  if (state === 'expired') return 'ds-badge acct-badge-danger';
  if (state === 'limit') return 'ds-badge acct-badge-warn';
  return 'ds-badge ds-badge-green';
}

function requestBadgeClass(status) {
  if (status === 'Accepting files') return 'ds-badge ds-badge-green';
  if (status === 'No longer accepting files') return 'ds-badge acct-badge-warn';
  return 'ds-badge';
}

export default function DashboardView({ user, onStartTransfer, onOpenAuth }) {
  const { addToast } = useToast();
  const [section, setSection] = useState('transfers');
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [draftName, setDraftName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [soundEnabled, setSoundEnabledState] = useState(() => isSoundEnabled());

  const [requestName, setRequestName] = useState('');
  const [requestInstructions, setRequestInstructions] = useState('');
  const [requestComposerOpen, setRequestComposerOpen] = useState(false);
  const [requestFieldError, setRequestFieldError] = useState('');
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [isCreatingRequest, setIsCreatingRequest] = useState(false);
  const [newRequestUrl, setNewRequestUrl] = useState('');
  const newRequestButtonRef = useRef(null);
  const [requestLinks, setRequestLinks] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsError, setRequestsError] = useState('');

  const [contacts, setContacts] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('itransfer_contacts') || '[]');
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });
  const [contactQuery, setContactQuery] = useState('');
  const [newContactName, setNewContactName] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newContactGroup, setNewContactGroup] = useState('Clients');

  useEffect(() => {
    setSoundEnabledState(isSoundEnabled());
    loadUserTransfers();
    const refresh = () => loadUserTransfers();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [user]);

  useEffect(() => {
    if (section === 'requests' && user) refreshRequests();
  }, [section, user]);

  useEffect(() => {
    if (!confirmTarget) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape' && !confirming) setConfirmTarget(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmTarget, confirming]);

  useEffect(() => {
    if (!requestComposerOpen) return undefined;
    document.getElementById('request-title')?.focus();
    return undefined;
  }, [requestComposerOpen]);

  useEffect(() => {
    if (!requestComposerOpen) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape' && !isCreatingRequest && !confirmTarget) {
        setRequestComposerOpen(false);
        window.setTimeout(() => newRequestButtonRef.current?.focus(), 0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [requestComposerOpen, isCreatingRequest, confirmTarget]);

  async function loadUserTransfers() {
    if (!user) {
      setTransfers([]);
      setLoading(false);
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
    }
  }

  async function refreshRequests() {
    setRequestsLoading(true);
    setRequestsError('');
    try {
      const { data: sessionWrap } = await supabase.auth.getSession();
      const payload = await loadFileRequests(sessionWrap?.session?.access_token);
      setRequestLinks(Array.isArray(payload.requests) ? payload.requests : []);
    } catch (err) {
      setRequestsError(publicMessage(err?.message) || 'Request links could not be loaded.');
    } finally {
      setRequestsLoading(false);
    }
  }

  const selected = transfers.find((item) => item.shareId === selectedId) || null;

  function openTransfer(transfer) {
    setSelectedId(transfer.shareId);
    setDraftName(transfer.subject || '');
  }

  async function handleCopy(value, id, success) {
    const ok = await copyText(value);
    if (!ok) {
      addToast('Could not copy that.', 'error');
      return;
    }
    if (id) {
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 2000);
    }
    addToast(success, 'success');
  }

  async function handleRename(event) {
    event.preventDefault();
    if (!selected || renaming) return;
    const next = draftName.trim();
    if (!next || next === (selected.subject || '')) return;
    setRenaming(true);
    try {
      const { data: sessionWrap } = await supabase.auth.getSession();
      await renameOwnedTransfer({
        shareId: selected.shareId,
        subject: next,
        accessToken: sessionWrap?.session?.access_token,
      });
      setTransfers((current) => current.map((item) => (
        item.shareId === selected.shareId ? { ...item, subject: next } : item
      )));
      addToast('Name saved.', 'success');
    } catch (err) {
      addToast(publicMessage(err?.message) || 'The name could not be saved.', 'error');
    } finally {
      setRenaming(false);
    }
  }

  async function runConfirm() {
    if (!confirmTarget || confirming) return;
    setConfirming(true);
    try {
      const { data: sessionWrap } = await supabase.auth.getSession();
      const accessToken = sessionWrap?.session?.access_token;
      if (confirmTarget.kind === 'transfer') {
        await deleteOwnedTransfer({ shareId: confirmTarget.transfer.shareId, accessToken });
        setTransfers((current) => current.filter((item) => item.shareId !== confirmTarget.transfer.shareId));
        if (selectedId === confirmTarget.transfer.shareId) setSelectedId(null);
        addToast('Transfer deleted.', 'info');
      } else if (confirmTarget.kind === 'request') {
        await closeFileRequest({ accessToken, requestId: confirmTarget.request.requestId });
        setRequestLinks((current) => current.map((item) => (
          item.requestId === confirmTarget.request.requestId ? { ...item, status: 'closed' } : item
        )));
        addToast('Request link closed.', 'info');
      } else if (confirmTarget.kind === 'contact') {
        const updated = contacts.filter((item) => item.id !== confirmTarget.contact.id);
        setContacts(updated);
        localStorage.setItem('itransfer_contacts', JSON.stringify(updated));
        addToast('Contact removed.', 'info');
      }
      setConfirmTarget(null);
    } catch (err) {
      addToast(publicMessage(err?.message) || 'That could not be completed.', 'error');
    } finally {
      setConfirming(false);
    }
  }

  function closeRequestComposer() {
    if (isCreatingRequest) return;
    setRequestComposerOpen(false);
    window.setTimeout(() => newRequestButtonRef.current?.focus(), 0);
  }

  async function handleCreateRequest() {
    if (isCreatingRequest) return;
    const title = requestName.trim();
    const instructions = requestInstructions.trim();
    const problem = requestLimitError(title, instructions);
    if (problem) {
      setRequestFieldError(problem);
      return;
    }
    setRequestFieldError('');
    setIsCreatingRequest(true);
    try {
      const { data: sessionWrap } = await supabase.auth.getSession();
      const created = await createFileRequest({
        accessToken: sessionWrap?.session?.access_token,
        title: title || 'File request',
        instructions,
      });
      if (!created?.requestId) throw new Error('The request link was not returned.');
      const url = `${window.location.origin}/request/${created.requestId}`;
      setNewRequestUrl(url);
      setSelectedRequestId(created.requestId);
      setRequestName('');
      setRequestInstructions('');
      setRequestComposerOpen(false);
      addToast('Request link created.', 'success');
      window.setTimeout(() => newRequestButtonRef.current?.focus(), 0);
      await refreshRequests();
    } catch (err) {
      setRequestFieldError(publicMessage(err?.message) || 'Could not create the request link. Try again.');
    } finally {
      setIsCreatingRequest(false);
    }
  }

  function handleAddContact(event) {
    event.preventDefault();
    const email = newContactEmail.trim();
    if (!email) return;
    const entry = {
      id: Date.now(),
      name: newContactName.trim() || email,
      email,
      group: newContactGroup,
    };
    const updated = [entry, ...contacts];
    setContacts(updated);
    localStorage.setItem('itransfer_contacts', JSON.stringify(updated));
    setNewContactName('');
    setNewContactEmail('');
    addToast('Contact saved on this device.', 'success');
  }

  function handleToggleSound(next) {
    setSoundEnabledState(next);
    setSoundEnabled(next);
    if (next) playSuccessChime();
    addToast(next ? 'Sound is on.' : 'Sound is off.', 'info');
  }

  const now = Date.now();
  const query = searchQuery.trim().toLowerCase();
  const filteredTransfers = transfers.filter((transfer) => {
    const timing = transferTiming(transfer, now);
    if (filter === 'open' && timing.state === 'expired') return false;
    if (filter === 'expired' && timing.state !== 'expired') return false;
    return matchesQuery(transfer, query);
  });
  const selectedRequest = requestLinks.find((item) => item.requestId === selectedRequestId) || null;
  const visibleContacts = contacts.filter((contact) => {
    const q = contactQuery.trim().toLowerCase();
    if (!q) return true;
    return `${contact.name} ${contact.email} ${contact.group}`.toLowerCase().includes(q);
  });

  if (!user) {
    return (
      <section className="acct-ui acct-dash">
        <div className="acct-box is-dashed ds-empty acct-empty">
          <span className="ds-icon is-dark" aria-hidden="true"><Lock /></span>
          <p className="ds-kicker"><b>●</b> My files</p>
          <h1 className="acct-dash-title !mt-0">Sign in to see your transfers</h1>
          <p className="acct-lead">Transfer history is available after you sign in. Guest sends stay on the link you were given.</p>
          <button
            type="button"
            className="ds-btn ds-btn-dark"
            onClick={() => onOpenAuth?.('login')}
          >
            <Lock className="w-4 h-4" aria-hidden="true" />
            Sign in
          </button>
        </div>
      </section>
    );
  }

  const openCount = transfers.filter((transfer) => transferTiming(transfer, now).state === 'open').length;
  const totalBytes = transfers.reduce((sum, transfer) => sum + (Number(transfer.totalSize) || 0), 0);

  return (
    <section className="acct-ui acct-dash">
      <header className="acct-dash-head">
        <div>
          <p className="ds-kicker"><b>●</b> My files</p>
          <h1 className="acct-dash-title">Your transfers</h1>
          <p className="acct-hint mt-1 acct-truncate" title={user.email}>{user.email}</p>
        </div>
        <div className="acct-head-actions flex-wrap">
          <button
            type="button"
            className="ds-btn ds-btn-ghost ds-btn-sm"
            onClick={loadUserTransfers}
            disabled={loading}
            aria-busy={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'motion-safe:animate-spin' : ''}`} aria-hidden="true" />
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          {onStartTransfer ? (
            <button type="button" className="ds-btn ds-btn-dark ds-btn-sm" onClick={onStartTransfer}>
              <Plus className="w-4 h-4" aria-hidden="true" />
              New transfer
            </button>
          ) : null}
        </div>
      </header>

      <nav className="ds-tabs acct-dash-tabs" aria-label="My files sections">
        {SECTIONS.map((item) => {
          const Icon = SECTION_ICONS[item.id];
          return (
            <button
              key={item.id}
              type="button"
              className="ds-tab"
              aria-pressed={section === item.id}
              onClick={() => setSection(item.id)}
            >
              {Icon ? <Icon aria-hidden="true" /> : null}
              {item.label}
            </button>
          );
        })}
      </nav>

      {section === 'transfers' && (
        <div className="acct-stack">
          {transfers.length > 0 ? (
            <dl className="acct-stats">
              <div className="acct-stat">
                <dt><small>Transfers</small></dt>
                <dd><b>{transfers.length}</b></dd>
              </div>
              <div className="acct-stat">
                <dt><small>Open links</small></dt>
                <dd><b>{openCount}</b></dd>
              </div>
              <div className="acct-stat">
                <dt><small>Total size</small></dt>
                <dd><b>{formatBytes(totalBytes)}</b></dd>
              </div>
            </dl>
          ) : null}

          <div className="acct-tools">
            <label className="ds-input-wrap acct-search">
              <Search aria-hidden="true" />
              <span className="acct-sr">Search transfers</span>
              <input
                type="search"
                className="ds-input"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Title, filename, or recipient"
              />
            </label>
            <div className="ds-tabs" role="group" aria-label="Filter transfers">
              {[
                ['all', 'All'],
                ['open', 'Open'],
                ['expired', 'Expired'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className="ds-tab"
                  aria-pressed={filter === id}
                  onClick={() => setFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {loadError ? (
            <p className="ds-alert is-danger" role="alert">
              <AlertCircle aria-hidden="true" />
              <span>{loadError}</span>
            </p>
          ) : null}

          {loading && transfers.length === 0 && !loadError ? (
            <div className="acct-rows" aria-busy="true" aria-live="polite">
              <h2 className="acct-hint flex items-center gap-2">
                <span className="ds-spinner !w-3.5 !h-3.5" aria-hidden="true" />
                Loading transfers…
              </h2>
              <p className="acct-sr">Checking the transfers on this account.</p>
              {[0, 1, 2].map((key) => (
                <div key={key} className="acct-row pointer-events-none" aria-hidden="true">
                  <span className="ds-skeleton w-9 h-9 shrink-0" />
                  <span className="flex-1 grid gap-2">
                    <span className="ds-skeleton h-3.5 w-1/2" />
                    <span className="ds-skeleton h-3 w-1/4" />
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {!loading && !loadError && transfers.length === 0 ? (
            <div className="acct-box is-dashed ds-empty acct-empty">
              <span className="ds-icon is-blue" aria-hidden="true"><Inbox /></span>
              <h2>No transfers yet</h2>
              <p>Transfers you send while signed in are listed here.</p>
              {onStartTransfer ? (
                <button type="button" className="ds-btn ds-btn-dark" onClick={onStartTransfer}>
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  New transfer
                </button>
              ) : null}
            </div>
          ) : null}

          {(transfers.length > 0 || (loadError && transfers.length > 0)) && !(loading && transfers.length === 0) ? (
            <div className="acct-split">
              <div className={`acct-list ${selected ? 'has-selection' : ''}`}>
                {filteredTransfers.length === 0 ? (
                  <div className="acct-box ds-empty acct-empty">
                    <span className="ds-icon" aria-hidden="true"><Search /></span>
                    <h2>Nothing matches</h2>
                    <p>Try another title, filename, or filter.</p>
                  </div>
                ) : (
                  <ul className="acct-rows">
                    {filteredTransfers.map((transfer) => {
                      const timing = transferTiming(transfer, now);
                      const created = formatWhen(transfer.createdAt);
                      const firstFile = transfer.files?.[0];
                      const Icon = getFileIcon(firstFile?.type, firstFile?.name);
                      const badge = timing.label ? <span className={timingBadgeClass(timing.state)}>{timing.label}</span> : null;
                      return (
                        <li key={transfer.shareId}>
                          <button
                            type="button"
                            className={`acct-row ${selectedId === transfer.shareId ? 'is-selected' : ''}`}
                            onClick={() => openTransfer(transfer)}
                            aria-pressed={selectedId === transfer.shareId}
                            aria-label={`${transferTitle(transfer)}. View details`}
                          >
                            <span className="ds-file-icon" aria-hidden="true"><Icon className="w-4 h-4" /></span>
                            <span className="acct-row-body">
                              <span className="acct-row-title acct-truncate">{transferTitle(transfer)}</span>
                              <span className="acct-meta block">
                                {transfer.files?.length || 0} files · {formatBytes(transfer.totalSize)}
                                {created ? ` · ${created}` : ''}
                              </span>
                              {badge ? <span className="acct-row-badge-mobile">{badge}</span> : null}
                            </span>
                            {badge ? <span className="acct-row-side">{badge}</span> : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <aside className={`acct-detail ${selected ? '' : 'is-empty'}`} aria-live="polite">
                {selected ? (
                  <TransferDetail
                    transfer={selected}
                    copied={copiedId === selected.shareId}
                    draftName={draftName}
                    renaming={renaming}
                    onDraftName={setDraftName}
                    onRename={handleRename}
                    onBack={() => setSelectedId(null)}
                    onCopy={() => handleCopy(`${window.location.origin}/download/${selected.shareId}`, selected.shareId, 'Link copied.')}
                    onDelete={() => setConfirmTarget({ kind: 'transfer', transfer: selected })}
                  />
                ) : (
                  <div className="acct-box is-dashed ds-empty acct-empty">
                    <span className="ds-icon" aria-hidden="true"><MousePointerClick /></span>
                    <h2>Transfer details</h2>
                    <p>Select a transfer to see its files, expiry, and actions.</p>
                  </div>
                )}
              </aside>
            </div>
          ) : null}
        </div>
      )}

      {section === 'requests' && (
        <div className="acct-stack">
          <header className="acct-panel-head">
            <div>
              <h2>Requests</h2>
              <p className="acct-lead mt-1 text-sm">Ask someone else to send you files. They open your link and upload. They do not need an account.</p>
            </div>
            <button
              ref={newRequestButtonRef}
              type="button"
              className="ds-btn ds-btn-dark ds-btn-sm"
              onClick={() => {
                setRequestFieldError('');
                setRequestComposerOpen(true);
              }}
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              New request
            </button>
          </header>

          {newRequestUrl ? (
            <div className="ds-callout is-blue flex-col !gap-0">
              <p className="ds-kicker"><b>●</b> Request link</p>
              <p className="acct-lead mt-1 text-sm !text-[var(--ds-text)]">The link is ready. Send it to the person who has the files.</p>
              <p className="ds-url acct-url bg-white"><span>{newRequestUrl}</span></p>
              <div className="acct-actions">
                <button type="button" className="ds-btn ds-btn-dark ds-btn-sm" onClick={() => handleCopy(newRequestUrl, 'request', 'Request link copied.')}>
                  {copiedId === 'request' ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
                  {copiedId === 'request' ? 'Copied' : 'Copy link'}
                </button>
                <a className="ds-btn ds-btn-ghost ds-btn-sm" href={newRequestUrl}>
                  <ExternalLink className="w-4 h-4" aria-hidden="true" />
                  Open
                </a>
              </div>
            </div>
          ) : null}

          {requestsError && requestLinks.length > 0 ? (
            <p className="ds-alert is-danger" role="alert">
              <AlertCircle aria-hidden="true" />
              <span>{requestsError}</span>
            </p>
          ) : null}

          {requestsLoading && requestLinks.length === 0 ? (
            <div className="acct-box ds-empty acct-empty" aria-busy="true" aria-live="polite">
              <span className="ds-spinner" aria-hidden="true" />
              <h2>Loading requests…</h2>
              <p>Checking the links on this account.</p>
            </div>
          ) : null}

          {!requestsLoading && requestsError && requestLinks.length === 0 ? (
            <div className="acct-box ds-empty acct-empty" role="alert">
              <span className="ds-icon acct-icon-danger" aria-hidden="true"><AlertCircle /></span>
              <h2>Requests could not be loaded</h2>
              <p>{requestsError}</p>
              <button type="button" className="ds-btn ds-btn-ghost" onClick={refreshRequests}>
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
                Try again
              </button>
            </div>
          ) : null}

          {!requestsLoading && !requestsError && requestLinks.length === 0 ? (
            <div className="acct-box is-dashed ds-empty acct-empty">
              <span className="ds-icon is-blue" aria-hidden="true"><Inbox /></span>
              <h2>No requests yet</h2>
              <p>A request link lets someone upload files to you without creating an account.</p>
              <button
                type="button"
                className="ds-btn ds-btn-dark"
                onClick={() => {
                  setRequestFieldError('');
                  setRequestComposerOpen(true);
                }}
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                Create your first request
              </button>
            </div>
          ) : null}

          {requestLinks.length > 0 ? (
            <div className="acct-split">
              <div className={`acct-list ${selectedRequest ? 'has-selection' : ''}`}>
                <ul className="acct-rows">
                  {requestLinks.map((portal) => {
                    const status = requestStatus(portal, now);
                    const created = formatWhen(portal.createdAt);
                    const badge = <span className={requestBadgeClass(status)}>{status}</span>;
                    return (
                      <li key={portal.requestId}>
                        <button
                          type="button"
                          className={`acct-row ${selectedRequest?.requestId === portal.requestId ? 'is-selected' : ''}`}
                          aria-pressed={selectedRequest?.requestId === portal.requestId}
                          onClick={() => setSelectedRequestId(portal.requestId)}
                        >
                          <span className="ds-file-icon" aria-hidden="true"><Inbox className="w-4 h-4" /></span>
                          <span className="acct-row-body">
                            <span className="acct-row-title acct-truncate">{portal.title || 'File request'}</span>
                            {created ? <span className="acct-meta block">{created}</span> : null}
                            <span className="acct-row-badge-mobile">{badge}</span>
                          </span>
                          <span className="acct-row-side">{badge}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <aside className={`acct-detail ${selectedRequest ? '' : 'is-empty'}`} aria-live="polite">
                {selectedRequest ? (
                  <RequestDetail
                    portal={selectedRequest}
                    copied={copiedId === selectedRequest.requestId}
                    onBack={() => setSelectedRequestId(null)}
                    onCopy={() => handleCopy(`${window.location.origin}/request/${selectedRequest.requestId}`, selectedRequest.requestId, 'Request link copied.')}
                    onClose={() => setConfirmTarget({ kind: 'request', request: selectedRequest })}
                  />
                ) : (
                  <div className="acct-box is-dashed ds-empty acct-empty">
                    <span className="ds-icon" aria-hidden="true"><MousePointerClick /></span>
                    <h2>Request details</h2>
                    <p>Select a request to copy its link, see uploads, or close it.</p>
                  </div>
                )}
              </aside>
            </div>
          ) : null}
        </div>
      )}

      {section === 'contacts' && (
        <div className="acct-stack">
          <form className="acct-box p-4 sm:p-5 acct-stack" onSubmit={handleAddContact}>
            <div className="acct-panel-head">
              <div>
                <h2>Contacts</h2>
                <p className="acct-lead mt-1 text-sm">Saved on this device. These names are not stored with your transfers.</p>
              </div>
            </div>
            <div className="acct-form-grid is-3">
              <div className="ds-field">
                <label htmlFor="contact-name" className="ds-label">Name</label>
                <input id="contact-name" className="ds-input" value={newContactName} onChange={(event) => setNewContactName(event.target.value)} />
              </div>
              <div className="ds-field">
                <label htmlFor="contact-email" className="ds-label">Email</label>
                <input id="contact-email" className="ds-input" type="email" required value={newContactEmail} onChange={(event) => setNewContactEmail(event.target.value)} />
              </div>
              <div className="ds-field">
                <label htmlFor="contact-group" className="ds-label">Group</label>
                <select id="contact-group" className="ds-select" value={newContactGroup} onChange={(event) => setNewContactGroup(event.target.value)}>
                  <option>Clients</option>
                  <option>Team</option>
                  <option>Friends</option>
                  <option>Family</option>
                </select>
              </div>
            </div>
            <div>
              <button type="submit" className="ds-btn ds-btn-dark">
                <Plus className="w-4 h-4" aria-hidden="true" />
                Save contact
              </button>
            </div>
          </form>

          {contacts.length > 0 ? (
            <label className="ds-input-wrap acct-search">
              <Search aria-hidden="true" />
              <span className="acct-sr">Search contacts</span>
              <input
                type="search"
                className="ds-input"
                value={contactQuery}
                onChange={(event) => setContactQuery(event.target.value)}
                placeholder="Name or email"
              />
            </label>
          ) : null}

          {contacts.length === 0 ? (
            <div className="acct-box is-dashed ds-empty acct-empty">
              <span className="ds-icon" aria-hidden="true"><Users /></span>
              <h2>No contacts saved</h2>
            </div>
          ) : visibleContacts.length === 0 ? (
            <div className="acct-box ds-empty acct-empty">
              <span className="ds-icon" aria-hidden="true"><Search /></span>
              <h2>Nothing matches</h2>
            </div>
          ) : (
            <ul className="acct-rows">
              {visibleContacts.map((contact) => (
                <li key={contact.id} className="acct-contact">
                  <span className="acct-avatar !w-9 !h-9 !text-base !rounded-[10px]" aria-hidden="true">
                    {String(contact.name || contact.email || '?').trim().charAt(0).toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <h3 className="acct-truncate">{contact.name}</h3>
                    <p className="acct-meta acct-truncate !mt-0.5">{contact.email}{contact.group ? ` · ${contact.group}` : ''}</p>
                  </div>
                  <button type="button" className="ds-btn ds-btn-danger ds-btn-sm shrink-0" onClick={() => setConfirmTarget({ kind: 'contact', contact })}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {section === 'preferences' && (
        <div className="acct-stack">
          <div className="acct-pref">
            <div className="acct-pref-main">
              <span className="ds-icon" aria-hidden="true">
                {soundEnabled ? <Volume2 /> : <VolumeX />}
              </span>
              <div className="min-w-0">
                <h2>Sound</h2>
                <p className="acct-lead mt-0.5 text-sm">Play a chime when a transfer on this device finishes.</p>
              </div>
            </div>
            <button
              type="button"
              className="acct-toggle"
              role="switch"
              aria-checked={soundEnabled}
              onClick={() => handleToggleSound(!soundEnabled)}
            >
              <span className="acct-toggle-track" aria-hidden="true" />
              {soundEnabled ? 'On' : 'Off'}
            </button>
          </div>
        </div>
      )}

      {requestComposerOpen ? (
        <Portal>
          <div className="ds-modal-backdrop acct-modal-backdrop acct-ui" onClick={closeRequestComposer}>
            <div
              className="ds-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="request-dialog-title"
              onClick={(event) => event.stopPropagation()}
            >
              <span className="acct-grabber" aria-hidden="true" />
              <div className="ds-modal-head">
                <p className="ds-kicker"><b>●</b> File request</p>
                <h2 id="request-dialog-title" className="ds-modal-title mt-2">New request</h2>
                <p className="ds-modal-sub">You are asking someone else to send you files. They open the link and upload. They do not need an account.</p>
              </div>
              <form
                className="ds-modal-body acct-stack"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleCreateRequest();
                }}
              >
                <p className="ds-hint">Both fields are optional. A blank title is saved as File request.</p>
                <div className="ds-field">
                  <label htmlFor="request-title" className="ds-label">Title</label>
                  <input
                    id="request-title"
                    className="ds-input"
                    value={requestName}
                    onChange={(event) => {
                      setRequestName(event.target.value);
                      setRequestFieldError('');
                    }}
                    placeholder="What you need"
                    aria-invalid={requestFieldError.startsWith('Title') || undefined}
                    aria-describedby="request-title-count"
                  />
                  <p id="request-title-count" className="acct-count">{requestName.trim().length} of 120 characters</p>
                </div>
                <div className="ds-field">
                  <label htmlFor="request-instructions" className="ds-label">Instructions</label>
                  <textarea
                    id="request-instructions"
                    className="ds-textarea"
                    rows={4}
                    value={requestInstructions}
                    onChange={(event) => {
                      setRequestInstructions(event.target.value);
                      setRequestFieldError('');
                    }}
                    placeholder="What to upload"
                    aria-invalid={requestFieldError.startsWith('Instructions') || undefined}
                    aria-describedby="request-instructions-count"
                  />
                  <p id="request-instructions-count" className="acct-count">{requestInstructions.trim().length} of 500 characters</p>
                </div>
                {requestFieldError ? (
                  <p className="ds-alert is-danger" role="alert">
                    <AlertCircle aria-hidden="true" />
                    <span>{requestFieldError}</span>
                  </p>
                ) : null}
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                  <button type="button" className="ds-btn ds-btn-ghost" onClick={closeRequestComposer} disabled={isCreatingRequest}>
                    Cancel
                  </button>
                  <button type="submit" className="ds-btn ds-btn-dark" disabled={isCreatingRequest} aria-busy={isCreatingRequest}>
                    {isCreatingRequest && <span className="ds-spinner" aria-hidden="true" />}
                    {isCreatingRequest ? 'Creating…' : 'Create request link'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Portal>
      ) : null}

      {confirmTarget ? (
        <Portal>
          <div className="ds-modal-backdrop acct-modal-backdrop acct-ui" onClick={() => { if (!confirming) setConfirmTarget(null); }}>
            <div
              className="ds-modal acct-modal-narrow"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="files-confirm-title"
              onClick={(event) => event.stopPropagation()}
            >
              <span className="acct-grabber" aria-hidden="true" />
              <div className="ds-modal-head">
                <span className="ds-icon acct-icon-danger" aria-hidden="true">
                  {confirmTarget.kind === 'request' ? <Ban /> : <Trash2 />}
                </span>
                <h2 id="files-confirm-title" className="ds-modal-title mt-3 !text-[1.3rem]">
                  {confirmTarget.kind === 'transfer' && 'Delete this transfer?'}
                  {confirmTarget.kind === 'request' && 'Close this request link?'}
                  {confirmTarget.kind === 'contact' && 'Remove this contact?'}
                </h2>
                <p className="ds-modal-sub">
                  {confirmTarget.kind === 'transfer' && 'The files will be removed. This cannot be undone from here.'}
                  {confirmTarget.kind === 'request' && 'People will no longer be able to upload with this link.'}
                  {confirmTarget.kind === 'contact' && `${confirmTarget.contact.name} will be removed from this device.`}
                </p>
              </div>
              <div className="ds-modal-body flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <button type="button" className="ds-btn ds-btn-ghost" onClick={() => setConfirmTarget(null)} disabled={confirming}>
                  Cancel
                </button>
                <button type="button" className="ds-btn ds-btn-danger" onClick={runConfirm} disabled={confirming} aria-busy={confirming}>
                  {confirming && <span className="ds-spinner" aria-hidden="true" />}
                  {confirming ? 'Working…' : confirmTarget.kind === 'transfer' ? 'Delete' : confirmTarget.kind === 'request' ? 'Close link' : 'Remove'}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      ) : null}
    </section>
  );
}

function TransferDetail({ transfer, copied, draftName, renaming, onDraftName, onRename, onBack, onCopy, onDelete }) {
  const timing = transferTiming(transfer);
  const created = formatWhen(transfer.createdAt);
  return (
    <div className="acct-detail-card">
      <button type="button" className="acct-back" onClick={onBack}>
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        Back to list
      </button>
      <p className="ds-kicker"><b>●</b> Transfer</p>
      <h2 className="acct-detail-title">{transferTitle(transfer)}</h2>
      <dl className="acct-facts">
        <div>
          <dt>Files</dt>
          <dd>{transfer.files?.length || 0} · {formatBytes(transfer.totalSize)}</dd>
        </div>
        {created ? (
          <div>
            <dt>Created</dt>
            <dd>{created}</dd>
          </div>
        ) : null}
        {timing.label ? (
          <div>
            <dt>Status</dt>
            <dd>{timing.label}</dd>
          </div>
        ) : null}
        {transfer.passwordRequired ? (
          <div>
            <dt>Password</dt>
            <dd>Required</dd>
          </div>
        ) : null}
        {transfer.recipientEmails ? (
          <div>
            <dt>Recipients</dt>
            <dd>{transfer.recipientEmails}</dd>
          </div>
        ) : null}
        {transfer.transferType && transfer.transferType !== 'link' ? (
          <div>
            <dt>Type</dt>
            <dd>{transfer.transferType}</dd>
          </div>
        ) : null}
      </dl>
      {transfer.message ? <p className="ds-callout !text-sm mb-4">{transfer.message}</p> : null}
      <ul className="acct-files !mt-0">
        {(transfer.files || []).map((file) => {
          const Icon = getFileIcon(file.type, file.name);
          return (
            <li key={file.id || file.name} className="acct-file">
              <span className="ds-file-icon" aria-hidden="true"><Icon /></span>
              <span className="acct-file-body">
                <span className="acct-file-name acct-truncate" title={file.name}>{file.name}</span>
                <span className="acct-meta block !mt-0.5">{fileMeta(file)}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <form className="acct-rename" onSubmit={onRename}>
        <label htmlFor="transfer-name" className="ds-label">Name</label>
        <div className="acct-rename-row">
          <input
            id="transfer-name"
            className="ds-input"
            value={draftName}
            onChange={(event) => onDraftName(event.target.value)}
          />
          <button type="submit" className="ds-btn ds-btn-ghost shrink-0" disabled={renaming || !draftName.trim() || draftName.trim() === (transfer.subject || '')}>
            {renaming ? 'Saving…' : 'Save name'}
          </button>
        </div>
      </form>
      <div className="acct-actions">
        <button type="button" className="ds-btn ds-btn-dark ds-btn-sm" onClick={onCopy}>
          {copied ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy link'}
        </button>
        <a className="ds-btn ds-btn-ghost ds-btn-sm" href={`/download/${transfer.shareId}`} target="_blank" rel="noreferrer">
          <ExternalLink className="w-4 h-4" aria-hidden="true" />
          Open
        </a>
        <button type="button" className="ds-btn ds-btn-danger ds-btn-sm" onClick={onDelete}>
          <Trash2 className="w-4 h-4" aria-hidden="true" />
          Delete
        </button>
      </div>
    </div>
  );
}

function RequestDetail({ portal, copied, onBack, onCopy, onClose }) {
  const status = requestStatus(portal);
  const created = formatWhen(portal.createdAt);
  const expires = formatWhen(portal.expiresAt);
  const url = `${window.location.origin}/request/${portal.requestId}`;
  const uploads = Array.isArray(portal.received) ? portal.received : [];
  return (
    <div className="acct-detail-card">
      <button type="button" className="acct-back" onClick={onBack}>
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        Back to list
      </button>
      <p className="ds-kicker"><b>●</b> Request</p>
      <h2 className="acct-detail-title">{portal.title || 'File request'}</h2>
      <dl className="acct-facts">
        <div>
          <dt>Status</dt>
          <dd>{status}</dd>
        </div>
        {created ? (
          <div>
            <dt>Created</dt>
            <dd>{created}</dd>
          </div>
        ) : null}
        {expires ? (
          <div>
            <dt>Listed until</dt>
            <dd>{expires}</dd>
          </div>
        ) : null}
      </dl>
      {portal.instructions ? <p className="ds-callout !text-sm mb-3">{portal.instructions}</p> : null}
      {status === 'Closed' || status === 'No longer accepting files' ? (
        <p className="acct-lead text-sm">People can no longer upload with this link.</p>
      ) : (
        <p className="acct-lead text-sm">Send this link to the person who has the files.</p>
      )}
      <p className="ds-url acct-url"><span>{url}</span></p>
      {uploads.length > 0 ? (
        <ul className="acct-received">
          {uploads.map((item) => {
            const sender = visibleSender(item.senderEmail);
            const when = formatWhen(item.createdAt);
            return (
              <li key={item.shareId}>
                {item.fileCount} files · {formatBytes(item.totalSize)}
                {sender ? ` · ${sender}` : ''}
                {when ? ` · ${when}` : ''}
                {item.subject ? ` · ${item.subject}` : ''}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="acct-hint mt-3">No uploads yet.</p>
      )}
      <div className="acct-actions">
        <button type="button" className="ds-btn ds-btn-dark ds-btn-sm" onClick={onCopy}>
          {copied ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy link'}
        </button>
        <a className="ds-btn ds-btn-ghost ds-btn-sm" href={url} target="_blank" rel="noreferrer">
          <ExternalLink className="w-4 h-4" aria-hidden="true" />
          Open
        </a>
        {portal.status === 'active' ? (
          <button type="button" className="ds-btn ds-btn-danger ds-btn-sm" onClick={onClose}>
            Close request
          </button>
        ) : null}
      </div>
    </div>
  );
}
