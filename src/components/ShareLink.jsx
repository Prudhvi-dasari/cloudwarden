import { useState, useEffect } from 'react';
import {
  CheckCircle2, Copy, Check, Download, Clock, RotateCcw,
  QrCode, Lock, Share2, Sparkles, ShieldCheck, Mail, MessageSquare,
  ExternalLink, ChevronDown, ChevronUp, File, Image, Film, Music,
  FileText, Send, HardDrive
} from 'lucide-react';
import { describeEmailResult, describeExcludedRecipients } from '../lib/emailStatus';
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
  const emailState = describeEmailResult(emailResult);
  const exclusionNote = describeExcludedRecipients(emailResult?.excludedCount);

  return (
    <div className="custom-card p-5 sm:p-8 text-center animate-scale-in max-w-xl mx-auto relative overflow-hidden ">
      
      {/* Full-page slow-motion particle celebration */}
      <Confetti duration={6500} />

      {/* Success Ripple & Animated Checkmark */}
      <div className="relative flex items-center justify-center mb-4 pt-1">
        <div className="absolute w-16 h-16 rounded-full bg-[#c4a574]/20 animate-success-ripple pointer-events-none" />
        <div className="w-14 h-14 rounded-2xl theme-btn-primary flex items-center justify-center shadow-lg shadow-[#c4a574]/25 z-10 animate-scale-in">
          <CheckCircle2 className="w-8 h-8 stroke-[2.5] text-[#0c0b0a]" />
        </div>
      </div>

      <h2 className="text-2xl sm:text-3xl font-display font-semibold text-[#f5f0e8] mb-1.5 tracking-tight">
        {transferType === 'email' ? 'Transfer ready to share' : 'Transfer complete'}
      </h2>
      
      <p className="text-sm sm:text-base text-[#a39e94] mb-6 max-w-md mx-auto leading-relaxed font-medium">
        {transferType === 'email'
          ? emailState.summary
          : 'Your files are ready. Share the download link below.'}
      </p>

      {/* Instant Email Delivery Confirmation Card */}
      {transferType === 'email' && recipientList.length > 0 && (
        <div className="mb-6 p-4.5 bg-[#141311] border border-[#c4a574]/25 rounded-2xl text-left space-y-3.5 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#f5f0e8] font-black text-sm">
              <Mail className="w-4.5 h-4.5 theme-text" />
              <span>Email Delivery & Notification</span>
            </div>
            <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
              emailState.state === 'accepted' || emailState.state === 'delivered'
                ? 'bg-[#8fbc8f]/15 text-[#8fbc8f] border border-[#8fbc8f]/30'
                : 'theme-bg-light theme-text border border-[#c4a574]/25'
            }`}>
              {emailState.badge}
            </span>
          </div>

          <div className="space-y-1.5">
            {recipientList.map((rec, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs sm:text-sm bg-[#1a1916] py-2 px-3 rounded-xl border border-white/10 shadow-2xs">
                <span className="font-bold text-[#f5f0e8] truncate max-w-[200px] sm:max-w-[280px]">{rec}</span>
                <span className="inline-flex items-center text-[11px] font-bold theme-text theme-bg-light px-2 py-0.5 rounded-full border border-[#c4a574]/25">
                  Download link ready
                </span>
              </div>
            ))}
          </div>

          {/* Quick Direct 1-Click Send Actions */}
          <div className="pt-2 border-t border-white/10 space-y-2">
            <p className="text-[11.5px] text-[#a39e94] font-medium">
              {emailState.showFallback
                ? <>Open your mail app to send this link to <strong className="text-[#f5f0e8]">{recipientEmails}</strong>. {emailState.detail}</>
                : emailState.detail}
            </p>
            {exclusionNote ? (
              <p className="text-[11.5px] text-[#a39e94] font-medium">{exclusionNote}</p>
            ) : null}
            {emailState.showFallback ? (
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
            ) : null}
          </div>
        </div>
      )}

      {/* Download Link Field */}
      <div className="flex flex-col sm:flex-row items-stretch gap-2 mb-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Download className="h-4.5 w-4.5 text-[#6b665c]" />
          </div>
          <input
            type="text"
            readOnly
            value={downloadUrl}
            onClick={(e) => e.target.select()}
            className="noir-input block w-full pl-10 pr-10 py-3 text-xs sm:text-sm font-semibold focus:outline-none"
          />
          <button
            onClick={() => setShowQr(!showQr)}
            className="absolute right-2 top-2.5 p-1 text-[#6b665c] hover:text-[#a39e94] hover:bg-white/5 rounded-lg transition-colors"
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
          className="py-2.5 px-2 rounded-xl border border-white/10 bg-[#1a1916] hover:bg-[#22211d] text-[#a39e94] text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
        >
          <Share2 className="w-3.5 h-3.5 theme-text" />
          <span>Share</span>
        </button>

        <a
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          className="py-2.5 px-2 rounded-xl border border-[#8fbc8f]/25 bg-[#8fbc8f]/8 hover:bg-[#8fbc8f]/12 text-[#8fbc8f] text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors"
        >
          <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
          <span>WhatsApp</span>
        </a>

        <button
          onClick={handleCopyInvitation}
          className="py-2.5 px-2 rounded-xl border border-white/10 bg-[#1a1916] hover:bg-[#22211d] text-[#a39e94] text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-colors shadow-2xs truncate"
        >
          {copiedInvitation ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-[#a39e94]" />}
          <span className="truncate">{copiedInvitation ? 'Copied!' : 'Copy Note'}</span>
        </button>
      </div>

      {/* QR Code Popup */}
      {showQr && (
        <div className="mb-5 p-3.5 bg-[#141311] border border-white/10 rounded-xl animate-scale-in text-center">
          <p className="text-xs font-bold text-[#a39e94] mb-2">Scan QR Code on Mobile:</p>
          <img src={qrApiUrl} alt="QR Code" className="w-32 h-32 mx-auto rounded-lg shadow-sm border border-white/10 bg-[#1a1916] p-2" />
        </div>
      )}

      {/* Transfer Receipt Card */}
      <div className="bg-[#141311] rounded-xl p-3.5 border border-white/10 mb-5 text-left space-y-2 text-xs font-medium text-[#a39e94]">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-[#f5f0e8] flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-[#6b665c]" /> Files:
          </span>
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#f5f0e8]">{fileCount} file{fileCount !== 1 ? 's' : ''} ({formatBytes(totalSize)})</span>
            {filesList.length > 0 && (
              <button
                onClick={() => setShowFilesList(!showFilesList)}
                className="p-0.5 text-[#6b665c] hover:text-[#a39e94] rounded transition-colors"
                title="Toggle file list"
              >
                {showFilesList ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>

        {/* Expandable File List */}
        {showFilesList && filesList.length > 0 && (
          <ul className="space-y-1 pt-1.5 pb-1 border-t border-white/10 max-h-36 overflow-y-auto pr-1 animate-fadeIn">
            {filesList.map((f, idx) => {
              const IconComp = getFileIcon(f.type, f.name);
              return (
                <li key={idx} className="flex items-center justify-between text-[11px] bg-[#1a1916] p-1.5 rounded-lg border border-white/10">
                  <div className="flex items-center gap-1.5 min-w-0 pr-2">
                    <IconComp className="w-3 h-3 text-[#a39e94] shrink-0" />
                    <span className="truncate text-[#f5f0e8] font-medium">{f.name}</span>
                  </div>
                  <span className="text-[#a39e94] font-mono shrink-0">{formatBytes(f.size)}</span>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex items-center justify-between pt-1 border-t border-white/10">
          <span className="font-semibold text-[#f5f0e8]">Expiration:</span>
          <span className="flex items-center gap-1 text-[#a39e94] font-semibold">
            <Clock className="w-3.5 h-3.5 text-[#6b665c]" />
            {!expiresAt || new Date(expiresAt).getFullYear() > new Date().getFullYear() + 20
              ? '♾️ Never Expires (Permanent)'
              : new Date(expiresAt).toLocaleDateString()}
          </span>
        </div>

        {isPasswordProtected && (
          <div className="flex items-center justify-between text-[#c4a574] font-semibold pt-1 border-t border-white/10">
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
          className="w-full sm:flex-1 py-2.5 px-3 rounded-xl border border-white/12 font-bold text-xs text-[#f5f0e8] hover:bg-[#141311] transition-all flex items-center justify-center gap-1.5"
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
