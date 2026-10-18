import { useEffect, useState, useRef } from 'react';
import {
  X, Copy, Check, Share2, QrCode, MessageCircle, Sparkles, ArrowRight, FolderKanban
} from 'lucide-react';
import Confetti from './Confetti';
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
  if (years > 50) return 'Permanent vault';
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
          title: subject || 'iTransfer',
          text: 'Your files are ready on iTransfer',
          url: downloadUrl,
        });
      } catch {
        /* user cancelled */
      }
    } else {
      handleCopy();
    }
  };

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(downloadUrl)}&bgcolor=0c0b0a&color=c4a574`;

  return (
    <Portal>
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="transfer-success-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#1c1917]/40 backdrop-blur-sm cursor-default"
        aria-label="Close celebration"
        onClick={onClose}
      />
      {!reduceMotion && <Confetti duration={3200} />}

      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative w-full max-w-lg custom-card p-6 sm:p-8 animate-modal-rise outline-none"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-white/50 hover:text-white hover:bg-white/10 cursor-pointer"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center mb-6">
          <div className="relative inline-flex items-center justify-center w-16 h-16 mb-4">
            {!reduceMotion && <span className="cele-burst" />}
            <span className="cele-ring absolute inset-0 rounded-full border border-white/70" />
            <span className="cele-ring absolute inset-0 rounded-full border border-white/30" style={{ animationDelay: '0.35s' }} />
            <div className="relative w-14 h-14 rounded-full bg-white text-black flex items-center justify-center">
              <Sparkles className="w-7 h-7" />
            </div>
          </div>
          <h2
            id="transfer-success-title"
            className="font-display text-3xl sm:text-4xl font-semibold text-white tracking-tight"
          >
            Congratulations
          </h2>
          <p className="mt-2 text-sm text-white/60 font-medium">
            Your transfer is live. Share the link below.
          </p>
          <p className="mt-3 text-xs text-white/45 font-medium">
            {fileCount} file{fileCount === 1 ? '' : 's'} · {formatBytes(totalSize)} · {formatExpiry(expiresAt)}
          </p>
        </div>

        <div className="flex items-stretch gap-2 mb-4">
          <input
            readOnly
            value={downloadUrl}
            className="noir-input flex-1 px-3.5 py-3 text-sm font-medium truncate"
            onFocus={(e) => e.target.select()}
          />
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 px-4 py-3 rounded-xl theme-btn-primary text-sm font-semibold flex items-center gap-2 cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-5">
          <button
            type="button"
            onClick={handleWhatsApp}
            className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-white/5 border border-white/10 hover:border-[#c4a574]/40 text-[#f5f0e8] text-xs font-semibold cursor-pointer"
          >
            <MessageCircle className="w-4 h-4 text-[#c4a574]" />
            WhatsApp
          </button>
          <button
            type="button"
            onClick={handleNativeShare}
            className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-white/5 border border-white/10 hover:border-[#c4a574]/40 text-[#f5f0e8] text-xs font-semibold cursor-pointer"
          >
            <Share2 className="w-4 h-4 text-[#c4a574]" />
            Share
          </button>
          <button
            type="button"
            onClick={() => setShowQr((v) => !v)}
            className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-white/5 border border-white/10 hover:border-[#c4a574]/40 text-[#f5f0e8] text-xs font-semibold cursor-pointer"
          >
            <QrCode className="w-4 h-4 text-[#c4a574]" />
            QR Code
          </button>
        </div>

        {showQr && (
          <div className="mb-5 flex justify-center animate-fadeIn">
            <img src={qrUrl} alt="Download QR code" className="w-40 h-40 rounded-xl border border-white/10" />
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={onSendAnother}
            className="flex-1 py-3 rounded-full theme-btn-primary text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
          >
            Send another
            <ArrowRight className="w-4 h-4" />
          </button>
          {onViewDashboard && (
            <button
              type="button"
              onClick={onViewDashboard}
              className="flex-1 py-3 rounded-full bg-white/5 border border-white/10 text-[#f5f0e8] text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer hover:bg-white/10"
            >
              <FolderKanban className="w-4 h-4 text-[#c4a574]" />
              Dashboard
            </button>
          )}
        </div>
      </div>
    </div>
    </Portal>
  );
}
