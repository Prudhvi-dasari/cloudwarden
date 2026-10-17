import { useState, useEffect } from 'react';
import {
  CheckCircle2, Copy, Check, Download, Clock, RotateCcw,
  QrCode, Lock, Share2, Sparkles, ShieldCheck, Mail, MessageSquare,
  ExternalLink, ChevronDown, ChevronUp, File, Image, Film, Music,
  FileText, CheckCircle, Send, HardDrive
} from 'lucide-react';
import { playSuccessChime } from '../lib/sound';
import Confetti from './Confetti';
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

  // Play pleasant success chime once on mount
  useEffect(() => {
    playSuccessChime();
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(downloadUrl);
      setCopied(true);
      addToast('Download link copied to clipboard! 📋', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      const textarea = document.createElement('textarea');
      textarea.value = downloadUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      addToast('Download link copied! 📋', 'success');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: subject || 'iTransfer Files',
          text: `Download ${fileCount} file${fileCount !== 1 ? 's' : ''} (${formatBytes(totalSize)}) via iTransfer`,
          url: downloadUrl,
        });
      } catch (e) {}
    } else {
      handleCopy();
    }
  };

  const emailInvitationText = `Hi,\n\nI have sent you ${fileCount} file${fileCount !== 1 ? 's' : ''} (${formatBytes(totalSize)}) via iTransfer.\n\nClick the link below to download your files:\n${downloadUrl}\n\n${isPasswordProtected ? 'Note: These files are password-protected.\n\n' : ''}Best regards!`;

  const handleCopyInvitation = async () => {
    try {
      await navigator.clipboard.writeText(emailInvitationText);
      setCopiedInvitation(true);
      addToast('Email message copied to clipboard! ✉️', 'success');
      setTimeout(() => setCopiedInvitation(false), 2000);
    } catch (err) {
      setCopiedInvitation(true);
      setTimeout(() => setCopiedInvitation(false), 2000);
    }
  };

  const mailtoUrl = `mailto:${recipientEmails || ''}?subject=${encodeURIComponent(subject || `Files shared with you via iTransfer`)}&body=${encodeURIComponent(emailInvitationText)}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`Here are the files I shared with you (${fileCount} files, ${formatBytes(totalSize)}): ${downloadUrl}`)}`;
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(downloadUrl)}`;

  const recipientList = recipientEmails 
    ? recipientEmails.split(',').map(e => e.trim()).filter(Boolean)
    : [];

  return (
    <div className="custom-card p-5 sm:p-8 text-center animate-scale-in max-w-xl mx-auto relative overflow-hidden bg-white/90">
      
      {/* Full-page slow-motion particle celebration */}
      <Confetti duration={6500} />

      {/* Success Ripple & Animated Checkmark */}
      <div className="relative flex items-center justify-center mb-4 pt-1">
        <div className="absolute w-16 h-16 rounded-full bg-emerald-400/20 animate-success-ripple pointer-events-none" />
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25 z-10 animate-scale-in">
          <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
        </div>
      </div>

      <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mb-1.5 tracking-tight">
        {transferType === 'email' ? 'Transfer Sent Successfully!' : 'Transfer Complete!'}
      </h2>
      
      <p className="text-sm sm:text-base text-slate-600 mb-6 max-w-md mx-auto leading-relaxed font-medium">
        {transferType === 'email'
          ? `Your files are uploaded and recipient notifications are ready to deliver.`
          : 'Your files are ready for instant download via the link below.'}
      </p>

      {/* Instant Email Delivery Confirmation Card */}
      {transferType === 'email' && recipientList.length > 0 && (
        <div className="mb-6 p-4.5 bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/80 border border-indigo-200/80 rounded-2xl text-left space-y-3.5 animate-fadeIn shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-indigo-950 font-black text-sm">
              <Mail className="w-4.5 h-4.5 text-indigo-600" />
              <span>Email Delivery & Notification</span>
            </div>
            <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
              emailResult?.success ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
            }`}>
              {emailResult?.success ? 'Dispatched' : 'Ready to Send'}
            </span>
          </div>

          <div className="space-y-1.5">
            {recipientList.map((rec, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs sm:text-sm bg-white py-2 px-3 rounded-xl border border-slate-200/80 shadow-2xs">
                <span className="font-bold text-slate-800 truncate max-w-[200px] sm:max-w-[280px]">{rec}</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <CheckCircle className="w-3 h-3 text-emerald-600" /> Link Ready
                </span>
              </div>
            ))}
          </div>

          {/* Quick Direct 1-Click Send Actions */}
          <div className="pt-2 border-t border-slate-200/80 space-y-2">
            <p className="text-[11.5px] text-slate-600 font-medium">
              Click below to deliver directly to <strong className="text-slate-900">{recipientEmails}</strong>:
            </p>
            <div className="grid grid-cols-2 gap-2">
              <a
                href={emailResult?.gmailWebUrl || `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recipientEmails)}&su=${encodeURIComponent(subject || 'iTransfer Download Link')}&body=${encodeURIComponent(emailInvitationText)}`}
                target="_blank"
                rel="noreferrer"
                className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-sm hover:scale-[1.02] active:scale-98"
              >
                <span>Send with Gmail Web</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <a
                href={emailResult?.mailtoUrl || mailtoUrl}
                className="py-2.5 px-3 rounded-xl theme-btn-primary text-white text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-sm hover:scale-[1.02] active:scale-98"
              >
                <span>Send with Mail App</span>
                <Send className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Download Link Field */}
      <div className="flex flex-col sm:flex-row items-stretch gap-2 mb-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Download className="h-4.5 w-4.5 text-slate-400" />
          </div>
          <input
            type="text"
            readOnly
            value={downloadUrl}
            onClick={(e) => e.target.select()}
            className="block w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-none"
          />
          <button
            onClick={() => setShowQr(!showQr)}
            className="absolute right-2 top-2.5 p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 rounded-lg transition-colors"
            title="Scan QR Code"
          >
            <QrCode className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={handleCopy}
          className={`px-4 py-3 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs shrink-0 ${
            copied ? 'bg-emerald-500 text-white' : 'theme-btn-primary'
          }`}
          title="Copy Link"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          <span>{copied ? 'Copied Link' : 'Copy Link'}</span>
        </button>
      </div>

      {/* Quick Action Share Buttons */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        <button
          onClick={handleNativeShare}
          className="py-2.5 px-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
        >
          <Share2 className="w-3.5 h-3.5 theme-text" />
          <span>Share</span>
        </button>

        <a
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          className="py-2.5 px-2 rounded-xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-800 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
        >
          <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
          <span>WhatsApp</span>
        </a>

        <button
          onClick={handleCopyInvitation}
          className="py-2.5 px-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-colors shadow-2xs truncate"
        >
          {copiedInvitation ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
          <span className="truncate">{copiedInvitation ? 'Copied!' : 'Copy Note'}</span>
        </button>
      </div>

      {/* QR Code Popup */}
      {showQr && (
        <div className="mb-5 p-3.5 bg-slate-50 border border-slate-200 rounded-xl animate-scale-in text-center">
          <p className="text-xs font-bold text-slate-700 mb-2">Scan QR Code on Mobile:</p>
          <img src={qrApiUrl} alt="QR Code" className="w-32 h-32 mx-auto rounded-lg shadow-sm border border-slate-200 bg-white p-2" />
        </div>
      )}

      {/* Transfer Receipt Card */}
      <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 mb-5 text-left space-y-2 text-xs font-medium text-slate-600">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-800 flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-slate-400" /> Files:
          </span>
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900">{fileCount} file{fileCount !== 1 ? 's' : ''} ({formatBytes(totalSize)})</span>
            {filesList.length > 0 && (
              <button
                onClick={() => setShowFilesList(!showFilesList)}
                className="p-0.5 text-slate-400 hover:text-slate-700 rounded transition-colors"
                title="Toggle file list"
              >
                {showFilesList ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>

        {/* Expandable File List */}
        {showFilesList && filesList.length > 0 && (
          <ul className="space-y-1 pt-1.5 pb-1 border-t border-slate-200/60 max-h-36 overflow-y-auto pr-1 animate-fadeIn">
            {filesList.map((f, idx) => {
              const IconComp = getFileIcon(f.type, f.name);
              return (
                <li key={idx} className="flex items-center justify-between text-[11px] bg-white p-1.5 rounded-lg border border-slate-200/70">
                  <div className="flex items-center gap-1.5 min-w-0 pr-2">
                    <IconComp className="w-3 h-3 text-slate-500 shrink-0" />
                    <span className="truncate text-slate-800 font-medium">{f.name}</span>
                  </div>
                  <span className="text-slate-500 font-mono shrink-0">{formatBytes(f.size)}</span>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
          <span className="font-semibold text-slate-800">Expiration:</span>
          <span className="flex items-center gap-1 text-slate-700 font-semibold">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            {!expiresAt || new Date(expiresAt).getFullYear() > new Date().getFullYear() + 20
              ? '♾️ Never Expires (Permanent)'
              : new Date(expiresAt).toLocaleDateString()}
          </span>
        </div>

        {isPasswordProtected && (
          <div className="flex items-center justify-between text-amber-700 font-semibold pt-1 border-t border-slate-200/60">
            <span>Security:</span>
            <span className="flex items-center gap-1">
              <Lock className="w-3.5 h-3.5" /> Password Protected
            </span>
          </div>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="flex flex-col sm:flex-row items-center gap-2">
        <a
          href={downloadUrl}
          target="_blank"
          rel="noreferrer"
          className="w-full sm:flex-1 py-2.5 px-3 rounded-xl border border-slate-300 font-bold text-xs text-slate-800 hover:bg-slate-50 transition-all flex items-center justify-center gap-1.5"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Preview Download</span>
        </a>

        <button
          onClick={onReset}
          className="w-full sm:flex-1 py-2.5 px-3 rounded-xl theme-btn-primary font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Send Another</span>
        </button>
      </div>

    </div>
  );
}
