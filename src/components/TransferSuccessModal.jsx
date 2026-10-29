import { useEffect, useState, useRef } from 'react';
import {
  X, Copy, Check, Share2, QrCode, MessageCircle, ArrowRight, FolderKanban
} from 'lucide-react';
import Portal from './Portal';
import { playSuccessChime } from '../lib/sound';
import { useToast } from './Toast';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatExpiry(expiresAt) {
  if (!expiresAt) return 'Standard retention';
  const d = new Date(expiresAt);
  if (Number.isNaN(d.getTime())) return 'Standard retention';
  const years = d.getFullYear() - new Date().getFullYear();
  if (years > 50) return 'No end date set';
  return `Expires ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

export default function TransferSuccessModal({
  open,
  shareId,
  fileCount = 0,
  totalSize = 0,
  expiresAt,
  subject,
  onClose,
  onSendAnother,
  onViewDashboard,
}) {
  const { addToast } = useToast();
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const dialogRef = useRef(null);
  const downloadUrl = shareId ? `${window.location.origin}/d/${shareId}` : '';

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(mq.matches);
    const handler = () => setReduceMotion(mq.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    playSuccessChime();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    dialogRef.current?.focus?.();
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || !shareId) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(downloadUrl);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = downloadUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    addToast('Link copied', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent(`${subject || 'Files for you'} — ${downloadUrl}`);
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: subject || 'SendToAnyone',
          text: 'Your files are ready on SendToAnyone',
          url: downloadUrl,
        });
      } catch {
        /* user cancelled */
      }
    } else {
      handleCopy();
    }
  };

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(downloadUrl)}`;

  return (
    <Portal>
    <div
      className="ds-modal-backdrop z-[10000]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="transfer-success-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close transfer modal"
        onClick={onClose}
      />

      <div
        ref={dialogRef}
        tabIndex={-1}
        className="ds-modal outline-none"
      >
        <button
          type="button"
          onClick={onClose}
          className="ds-close"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="ds-modal-head snd-modal-head">
          <span className="snd-done" aria-hidden="true">
            <Check />
          </span>
          <h2 id="transfer-success-title" className="ds-modal-title">
            Your transfer is ready
          </h2>
          <p className="ds-modal-sub">
            Your files are uploaded. Share the download link below.
          </p>
          <div className="snd-meta">
            <span>{fileCount} file{fileCount === 1 ? '' : 's'}</span>
            <span>{formatBytes(totalSize)}</span>
            <span className="is-blue">{formatExpiry(expiresAt)}</span>
          </div>
        </div>

        <div className="ds-modal-body">
          <div className="snd-share">
          <div className="snd-link">
            <div className="snd-link-field">
              <input
                readOnly
                value={downloadUrl}
                aria-label="Download link"
                className="ds-input"
                onFocus={(e) => e.target.select()}
              />
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className={`ds-btn ds-btn-dark snd-copy${copied ? ' is-copied' : ''}`}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>

          <div className="snd-quick">
            <button type="button" onClick={handleWhatsApp} className="ds-btn ds-btn-ghost is-wa">
              <MessageCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>WhatsApp</span>
            </button>
            <button type="button" onClick={handleNativeShare} className="ds-btn ds-btn-ghost">
              <Share2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Share</span>
            </button>
            <button
              type="button"
              onClick={() => setShowQr((v) => !v)}
              aria-expanded={showQr}
              className="ds-btn ds-btn-ghost"
            >
              <QrCode className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>QR code</span>
            </button>
          </div>

          {showQr && (
            <div className="snd-panel snd-qr">
              <img src={qrUrl} alt="Download QR code" />
            </div>
          )}
          </div>
        </div>

        <div className={`ds-modal-foot snd-modal-foot${onViewDashboard ? ' has-two' : ''}`}>
          <button
            type="button"
            onClick={onSendAnother}
            className="ds-btn ds-btn-dark"
          >
            Send another
            <ArrowRight className="w-4 h-4 ds-btn-arrow" aria-hidden="true" />
          </button>
          {onViewDashboard && (
            <button
              type="button"
              onClick={onViewDashboard}
              className="ds-btn ds-btn-ghost"
            >
              <FolderKanban className="w-4 h-4" aria-hidden="true" />
              Dashboard
            </button>
          )}
        </div>
      </div>
    </div>
    </Portal>
  );
}
