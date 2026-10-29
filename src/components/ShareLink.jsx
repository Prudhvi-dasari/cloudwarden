import { lazy, Suspense, useState, useEffect } from 'react';
import {
  CheckCircle2, Copy, Check, Download, Clock, RotateCcw,
  QrCode, Lock, Share2, Mail, MessageSquare,
  ExternalLink, ChevronDown, ChevronUp, File, Image, Film, Music,
  FileText, Send, HardDrive
} from 'lucide-react';
import { describeEmailResult, describeExcludedRecipients } from '../lib/emailStatus';
import { playSuccessChime } from '../lib/sound';

const LinkCheer = lazy(() => import('./LinkCheer'));

function cheerOnce(shareId) {
  const key = `sta_link_cheer_${shareId || 'ready'}`;
  try {
    if (sessionStorage.getItem(key) === '1') return false;
    sessionStorage.setItem(key, '1');
    return true;
  } catch {
    return true;
  }
}
import { useToast } from './Toast';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileIcon(type, name) {
  const ext = name?.split('.').pop()?.toLowerCase();
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext) || type?.startsWith('image/')) return Image;
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext) || type?.startsWith('video/')) return Film;
  if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext) || type?.startsWith('audio/')) return Music;
  if (['pdf', 'doc', 'docx', 'txt'].includes(ext)) return FileText;
  return File;
}

const KIND_BY_ICON = new Map([
  [Image, 'image'],
  [Film, 'video'],
  [Music, 'audio'],
  [FileText, 'doc'],
]);

const EMAIL_BADGE = {
  delivered: 'ds-badge ds-badge-green',
  accepted: 'ds-badge ds-badge-blue',
  partial: 'ds-badge ds-badge-blue',
};

export default function ShareLink({
  shareId,
  fileCount,
  totalSize,
  expiresAt,
  transferType,
  recipientEmails,
  senderEmail,
  isPasswordProtected,
  maxDownloads,
  subject,
  message,
  filesList = [],
  emailResult,
  onReset,
}) {
  const { addToast } = useToast();
  const [copied, setCopied] = useState(false);
  const [copiedInvitation, setCopiedInvitation] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [showFilesList, setShowFilesList] = useState(false);
  const downloadUrl = `${window.location.origin}/d/${shareId}`;
  const [celebrate] = useState(() => cheerOnce(shareId));
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(media.matches);
  }, []);

  useEffect(() => {
    if (celebrate) playSuccessChime();
  }, [celebrate]);

  const copyText = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(textarea);
        return ok;
      } catch {
        return false;
      }
    }
  };

  const handleCopy = async () => {
    const ok = await copyText(downloadUrl);
    if (!ok) {
      addToast('Could not copy the link. Select it and copy it yourself.', 'error');
      return;
    }
    setCopied(true);
    addToast('Link copied.', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: subject || 'SendToAnyone Files',
          text: `Download ${fileCount} file${fileCount !== 1 ? 's' : ''} (${formatBytes(totalSize)}) via SendToAnyone`,
          url: downloadUrl,
        });
      } catch (e) {}
    } else {
      handleCopy();
    }
  };

  const emailInvitationText = `Hi,\n\nI have sent you ${fileCount} file${fileCount !== 1 ? 's' : ''} (${formatBytes(totalSize)}) via SendToAnyone.\n\nClick the link below to download your files:\n${downloadUrl}\n\n${isPasswordProtected ? 'Note: These files are password-protected.\n\n' : ''}Best regards!`;

  const handleCopyInvitation = async () => {
    const ok = await copyText(emailInvitationText);
    if (!ok) {
      addToast('Could not copy that note.', 'error');
      return;
    }
    setCopiedInvitation(true);
    addToast('Note copied.', 'success');
    setTimeout(() => setCopiedInvitation(false), 2000);
  };

  const mailtoUrl = `mailto:${recipientEmails || ''}?subject=${encodeURIComponent(subject || `Files shared with you via SendToAnyone`)}&body=${encodeURIComponent(emailInvitationText)}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`Here are the files I shared with you (${fileCount} files, ${formatBytes(totalSize)}): ${downloadUrl}`)}`;
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(downloadUrl)}`;

  const recipientList = recipientEmails 
    ? recipientEmails.split(',').map(e => e.trim()).filter(Boolean)
    : [];
  const emailState = describeEmailResult(emailResult);
  const exclusionNote = describeExcludedRecipients(emailResult?.excludedCount);

  return (
    <div className={`snd-share${celebrate ? ' is-cheer' : ''}`}>
      {celebrate && !reduceMotion ? (
        <Suspense fallback={null}>
          <LinkCheer />
        </Suspense>
      ) : null}
      <div className="snd-head">
        <span className="snd-done" aria-hidden="true">
          <Check />
        </span>
        <h2 className="snd-title">
          {transferType === 'email' ? 'Transfer ready to share' : 'Your transfer is ready'}
        </h2>
        <p className="snd-sub">
          {transferType === 'email'
            ? emailState.summary
            : 'Your files are uploaded. Share the download link below.'}
        </p>
      </div>

      {/* Email delivery status */}
      {transferType === 'email' && recipientList.length > 0 && (
        <div className="snd-panel">
          <div className="snd-email-head">
            <span>
              <Mail aria-hidden="true" />
              Email
            </span>
            <span className={EMAIL_BADGE[emailState.state] || 'ds-badge'}>
              {emailState.badge}
            </span>
          </div>

          <ul className="snd-recipients">
            {recipientList.map((rec) => (
              <li key={rec}>{rec}</li>
            ))}
          </ul>

          <div className="snd-email-detail">
            <p>
              {emailState.showFallback
                ? <>Open your mail app to send this link to <strong>{recipientEmails}</strong>. {emailState.detail}</>
                : emailState.detail}
            </p>
            {exclusionNote ? (
              <p className="text-[var(--ds-muted)]">{exclusionNote}</p>
            ) : null}
            {emailState.showFallback ? (
              <div className="snd-pair-btns">
                <a
                  href={emailResult?.gmailWebUrl || `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recipientEmails)}&su=${encodeURIComponent(subject || 'SendToAnyone Download Link')}&body=${encodeURIComponent(emailInvitationText)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="ds-btn ds-btn-ghost"
                >
                  <span>Gmail</span>
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
                <a
                  href={emailResult?.mailtoUrl || mailtoUrl}
                  className="ds-btn ds-btn-dark"
                >
                  <span>Mail app</span>
                  <Send className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Download Link Field */}
      <div className="snd-link">
        <div className="snd-link-field">
          <Download aria-hidden="true" />
          <input
            type="text"
            readOnly
            value={downloadUrl}
            onClick={(e) => e.target.select()}
            className="ds-input has-action"
          />
          <button
            type="button"
            onClick={() => setShowQr(!showQr)}
            aria-label={showQr ? 'Hide QR code' : 'Show QR code'}
            aria-expanded={showQr}
            className="snd-icon-btn"
          >
            <QrCode className="w-4 h-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          aria-live="polite"
          aria-label={copied ? 'Download link copied' : 'Copy download link'}
          className={`ds-btn ds-btn-dark snd-copy${copied ? ' is-copied' : ''}`}
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          <span>{copied ? 'Copied' : 'Copy link'}</span>
        </button>
      </div>

      {/* QR Code */}
      {showQr && (
        <div className="snd-panel snd-qr">
          <p>Scan to open the link on a phone</p>
          <img src={qrApiUrl} alt="QR code for the download link" />
        </div>
      )}

      {/* Quick Action Share Buttons */}
      <div className="snd-quick">
        <button type="button" onClick={handleNativeShare} className="ds-btn ds-btn-ghost">
          <Share2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Share</span>
        </button>

        <a href={whatsappUrl} target="_blank" rel="noreferrer" className="ds-btn ds-btn-ghost is-wa">
          <MessageSquare className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>WhatsApp</span>
        </a>

        <button type="button" onClick={handleCopyInvitation} aria-live="polite" className="ds-btn ds-btn-ghost">
          {copiedInvitation
            ? <Check className="w-4 h-4 shrink-0 text-[var(--ds-green)]" aria-hidden="true" />
            : <Copy className="w-4 h-4 shrink-0" aria-hidden="true" />}
          <span>{copiedInvitation ? 'Copied' : 'Copy note'}</span>
        </button>
      </div>

      {/* Transfer details */}
      <div className="snd-facts">
        <div className="snd-fact">
          <span>
            <HardDrive aria-hidden="true" /> Files
          </span>
          <span className="snd-fact-value">
            <span className="snd-mono">{fileCount} file{fileCount !== 1 ? 's' : ''} · {formatBytes(totalSize)}</span>
            {filesList.length > 0 && (
              <button
                type="button"
                onClick={() => setShowFilesList(!showFilesList)}
                className="snd-icon-btn"
                title="Toggle file list"
                aria-label={showFilesList ? 'Hide file list' : 'Show file list'}
                aria-expanded={showFilesList}
              >
                {showFilesList ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            )}
          </span>
        </div>

        {showFilesList && filesList.length > 0 && (
          <ul className="snd-mini">
            {filesList.map((f, idx) => {
              const IconComp = getFileIcon(f.type, f.name);
              return (
                <li key={idx}>
                  <span className="snd-ftile is-sm" data-kind={KIND_BY_ICON.get(IconComp) || 'other'}>
                    <IconComp aria-hidden="true" />
                  </span>
                  <span title={f.name}>{f.name}</span>
                  <span className="snd-size shrink-0">{formatBytes(f.size)}</span>
                </li>
              );
            })}
          </ul>
        )}

        <div className="snd-fact">
          <span>
            <Clock aria-hidden="true" /> Link closes
          </span>
          <span className="snd-fact-value">
            {!expiresAt || new Date(expiresAt).getFullYear() > new Date().getFullYear() + 20
              ? 'No end date set'
              : new Date(expiresAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
          </span>
        </div>

        {isPasswordProtected && (
          <div className="snd-fact">
            <span>
              <Lock aria-hidden="true" /> Password
            </span>
            <span className="snd-fact-value">
              <span className="ds-badge ds-badge-blue">Required to download</span>
            </span>
          </div>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="snd-pair-btns">
        <a href={downloadUrl} target="_blank" rel="noreferrer" className="ds-btn ds-btn-ghost">
          <ExternalLink className="w-4 h-4" aria-hidden="true" />
          <span>Open download page</span>
        </a>

        <button type="button" onClick={onReset} className="ds-btn ds-btn-dark">
          <RotateCcw className="w-4 h-4" aria-hidden="true" />
          <span>Send another</span>
        </button>
      </div>
    </div>
  );
}
