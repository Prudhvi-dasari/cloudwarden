import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import JSZip from 'jszip';
import { activeStorageProvider } from '../lib/storageProvider';
import { playDownloadChime } from '../lib/sound';
import Footer from '../components/Footer';
import Portal from '../components/Portal';
import { Send, Download, FileText, Clock, AlertTriangle, Loader2, ArrowLeft, File, Image, Film, Music, Lock, Flame, CheckCircle2, Eye, EyeOff, ShieldCheck, Sparkles, FolderDown, Archive, Play, X } from 'lucide-react';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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

export default function DownloadPage() {
  const { shareId } = useParams();
  const [transfer, setTransfer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState({});
  const [actionError, setActionError] = useState('');
  const [zippingAll, setZippingAll] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);

  // Password Unlock State
  const [isLocked, setIsLocked] = useState(false);
  const [inputPassword, setInputPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState(false);

  // Expired Transfer State
  const [isExpired, setIsExpired] = useState(false);
  const [expiredTransfer, setExpiredTransfer] = useState(null);

  // File Preview Modal State
  const [previewFile, setPreviewFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    loadTransfer();
  }, [shareId]);

  async function loadTransfer() {
    try {
      const cleanShareId = (shareId || '').trim();
      const res = await fetch(`/api/r2?action=share-meta&shareId=${encodeURIComponent(cleanShareId)}`);
      const data = await res.json().catch(() => ({}));

      if (res.status === 404) {
        setError('This file transfer does not exist, was deleted, or reached its max download limit.');
        setLoading(false);
        return;
      }
      if (res.status === 410 && data.code === 'EXPIRED') {
        setIsExpired(true);
        setExpiredTransfer({
          subject: data.subject || 'Transfer',
          fileCount: data.fileCount || 0,
          totalSize: data.totalSize || 0,
          expiresAt: data.expiresAt,
        });
        setLoading(false);
        return;
      }
      if (res.status === 410 && data.code === 'DOWNLOAD_LIMIT') {
        setError('This transfer reached its maximum download limit and has self-destructed.');
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setError(res.status === 503 ? 'Could not load this transfer.' : (data.error || 'Failed to load file transfer.'));
        setLoading(false);
        return;
      }

      if (data.maxDownloads > 0 && (data.downloadCount || 0) >= data.maxDownloads) {
        setError('This transfer reached its maximum download limit and has self-destructed.');
        setLoading(false);
        return;
      }

      if (data.passwordRequired) setIsLocked(true);

      setTransfer({
        shareId: data.shareId,
        files: (data.files || []).map((file) => ({
          id: file.id,
          file_name: file.fileName,
          file_size: file.fileSize,
          content_type: file.contentType,
        })),
        subject: data.subject,
        message: data.message,
        senderEmail: data.senderEmail,
        expiresAt: data.expiresAt,
        maxDownloads: data.maxDownloads || 0,
        downloadCount: data.downloadCount || 0,
        totalSize: data.totalSize || 0,
      });
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError('Failed to load file transfer.');
      setLoading(false);
    }
  }

  async function handleUnlock(e) {
    if (e) e.preventDefault();
    if (!inputPassword.trim()) return;

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
        setPasswordError(true);
        return;
      }

      setIsLocked(false);
      setPasswordError(false);
    } catch (err) {
      setPasswordError(true);
    }
  }

  async function handleDownload(file) {
    setDownloading(prev => ({ ...prev, [file.id]: true }));
    try {
      // 1. Get Direct High-Speed Download URL
      const downloadUrl = await activeStorageProvider.getSignedDownloadUrl(null, file.file_name, {
        shareId: transfer?.shareId || shareId,
        fileId: file.id,
        password: inputPassword || '',
      });

      if (!downloadUrl) {
        throw new Error('Unable to generate download link. File may have expired.');
      }

      // Let the browser download directly from the signed R2 URL.
      // Avoid buffering the entire file in JavaScript memory.
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = file.file_name;
      a.rel = 'noopener';
      a.style.display = 'none';

      document.body.appendChild(a);
      a.click();
      a.remove();
      playDownloadChime();

      const newCount = (transfer.downloadCount || 0) + 1;
      setTransfer(prev => ({ ...prev, downloadCount: newCount }));

      if (transfer.maxDownloads > 0 && newCount >= transfer.maxDownloads) {
        setError('This transfer has reached its maximum download limit.');
      }

    } catch (err) {
      console.error('Download failed:', err);
      setActionError(err.message || 'This file could not be downloaded. It may have expired or the link may be wrong.');
    } finally {
      setDownloading(prev => ({ ...prev, [file.id]: false }));
    }
  }

  async function handleDownloadAllZip() {
    if (!transfer?.files || transfer.files.length === 0) return;
    setZippingAll(true);
    setZipProgress(10);

    try {
      const zip = new JSZip();

      for (let i = 0; i < transfer.files.length; i++) {
        const file = transfer.files[i];
        const fileBlob = await activeStorageProvider.downloadFile(null, file.file_name, {
          shareId: transfer.shareId || shareId,
          fileId: file.id,
          password: inputPassword || '',
        });
        zip.file(file.file_name, fileBlob);
        setZipProgress(Math.round(((i + 1) / transfer.files.length) * 70));
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
      console.error('ZIP Error:', err);
      setActionError(err.message || 'The zip could not be created. You can still download each file on its own.');
    } finally {
      setZippingAll(false);
      setZipProgress(0);
    }
  }

  async function handleOpenPreview(file) {
    setPreviewFile(file);
    setLoadingPreview(true);

    try {
      const streamUrl = await activeStorageProvider.getPreviewUrl(null, file.file_name, {
        shareId: transfer?.shareId || shareId,
        fileId: file.id,
        password: inputPassword || '',
      });
      if (streamUrl) {
        setPreviewUrl(streamUrl);
      } else {
        throw new Error('Preview not available');
      }
    } catch (err) {
      console.error('Preview error:', err);
      setActionError('A preview is not available for this file. You can still download it.');
      setPreviewFile(null);
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

  return (
    <div className="min-h-screen flex flex-col text-white relative overflow-hidden bg-[#07080d]">
      <div className="page-sky" aria-hidden="true" />

      <header className="sticky top-0 z-40 px-3 sm:px-4 pt-3">
        <div className="max-w-6xl mx-auto h-14 px-3 rounded-full border border-white/25 bg-white/10 backdrop-blur-md flex items-center justify-between relative z-10">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
              <Send className="w-3.5 h-3.5 text-black" />
            </div>
            <span className="text-base font-semibold tracking-tight text-white">iTransfer</span>
          </Link>
          <Link to="/" className="text-xs font-semibold text-white/70 hover:text-white flex items-center gap-1.5 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Send files
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 relative z-10">
        
        {loading && (
          <div className="custom-card p-12 text-center">
            <Loader2 className="w-10 h-10 theme-text animate-spin mx-auto mb-3" />
            <p className="text-sm font-semibold text-white/75">Retrieving transfer details...</p>
          </div>
        )}

        {isExpired && expiredTransfer && (
          <div className="custom-card p-8 sm:p-12 text-center max-w-lg mx-auto animate-scale-in">
            <div className="w-16 h-16 rounded-3xl bg-[#141311] border border-white/10 text-[#6b665c] flex items-center justify-center mx-auto mb-5">
              <Clock className="w-8 h-8" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-white mb-1">
              {expiredTransfer.subject || 'Transfer'}
            </h1>
            <p className="text-sm text-white/75 font-medium mb-6">
              {expiredTransfer.fileCount} {expiredTransfer.fileCount === 1 ? 'file' : 'files'} · {formatBytes(expiredTransfer.totalSize)}
            </p>

            <div className="p-4 bg-[#c47a7a]/10 border border-[#c47a7a]/30 rounded-2xl mb-6 space-y-1">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#c47a7a]">
                <AlertTriangle className="w-4 h-4" />
                <span>Link expired</span>
              </div>
              <p className="text-sm text-white/80 font-medium">
                Expired on {new Date(expiredTransfer.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}. These files are no longer available.
              </p>
            </div>

            <div className="mt-8 pt-6 border-t border-white/10">
              <Link to="/" className="theme-btn-primary px-6 py-3 text-xs font-semibold inline-flex items-center gap-2 rounded-full">
                <Send className="w-4 h-4" /> Send your own files free
              </Link>
            </div>
          </div>
        )}

        {error && !isExpired && (
          <div className="custom-card p-8 sm:p-10 text-center animate-scale-in">
            <div className="w-16 h-16 rounded-2xl bg-[#c47a7a]/15 border border-[#c47a7a]/30 text-[#c47a7a] flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Transfer unavailable</h2>
            <p className="text-sm text-white/75 mb-6 max-w-md mx-auto">{error}</p>
            <Link to="/" className="theme-btn-primary px-6 py-3 text-xs font-bold inline-flex items-center gap-2 shadow-sm">
              <ArrowLeft className="w-4 h-4" /> Go to iTransfer Homepage
            </Link>
          </div>
        )}

        {transfer && !error && (
          <>
            {isLocked ? (
              <div className={`custom-card p-6 sm:p-10 text-center max-w-md mx-auto animate-scale-in ${passwordError ? 'animate-shake' : ''}`}>
                <div className="w-16 h-16 rounded-2xl theme-bg-light theme-text flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-semibold text-white mb-1">Password required</h2>
                <p className="text-sm text-white/75 mb-6 leading-relaxed">
                  The sender set a password for this transfer. Enter it below to unlock and download {transfer.files.length} file{transfer.files.length !== 1 ? 's' : ''}.
                </p>

                {passwordError && (
                  <div className="mb-4 p-3 bg-[#c47a7a]/10 border border-[#c47a7a]/30 rounded-xl text-[#c47a7a] text-xs font-bold flex items-center justify-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Incorrect password. Please try again.</span>
                  </div>
                )}

                <form onSubmit={handleUnlock} className="space-y-4">
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoFocus
                      value={inputPassword}
                      onChange={(e) => { setInputPassword(e.target.value); setPasswordError(false); }}
                      placeholder="Enter transfer password"
                      className="noir-input w-full px-4 py-3 text-sm text-center font-semibold pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-[#6b665c] hover:text-[#a39e94] p-0.5"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <button
                    type="submit"
                    className="w-full theme-btn-primary py-3.5 text-xs font-bold shadow-md flex items-center justify-center gap-2"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Unlock & Access Files</span>
                  </button>
                </form>
              </div>
            ) : (
              <div className="space-y-5 animate-scale-in">
                
                {/* Info Card */}
                <div className="custom-card p-4 sm:p-8 text-center relative overflow-hidden">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl theme-btn-primary flex items-center justify-center mx-auto mb-3.5 sm:mb-4 shadow-md">
                    <FolderDown className="w-7 h-7 sm:w-8 sm:h-8 text-[#0c0b0a]" />
                  </div>
                  
                  <h1 className="text-2xl sm:text-4xl font-semibold text-white mb-1.5 sm:mb-2 tracking-tight">
                    {transfer.subject || 'Files ready for download'}
                  </h1>

                  {transfer.senderEmail && !String(transfer.senderEmail).startsWith('guest:') && (
                    <p className="text-sm text-white/70 mb-2 font-medium">
                      Sent by <span className="font-semibold text-white">{transfer.senderEmail}</span>
                    </p>
                  )}

                  <div className="flex items-center justify-center gap-2 text-sm font-semibold text-white/70 mb-4 sm:mb-5">
                    <span>{transfer.files.length} file{transfer.files.length !== 1 ? 's' : ''}</span>
                    <span>·</span>
                    <span className="text-white">{formatBytes(transfer.totalSize)}</span>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/8 rounded-full text-sm font-semibold text-white/80 border border-white/10">
                      <Clock className="w-3.5 h-3.5 text-[#a39e94]" />
                      <span>Expires in {Math.max(1, Math.ceil((new Date(transfer.expiresAt) - new Date()) / (1000 * 60 * 60 * 24)))} days</span>
                    </div>

                    {transfer.maxDownloads > 0 && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#c47a7a]/10 rounded-full text-xs font-bold text-[#c47a7a] border border-[#c47a7a]/30">
                        <Flame className="w-3.5 h-3.5" />
                        <span>Limit: {transfer.downloadCount} / {transfer.maxDownloads}</span>
                      </div>
                    )}
                  </div>

                  {transfer.message && (
                    <div className="mt-4 p-3.5 bg-[#141311] border border-white/10 rounded-2xl text-left">
                      <p className="text-[10px] sm:text-xs text-[#a39e94] font-bold uppercase tracking-wider mb-1">Message from sender:</p>
                      <p className="text-xs sm:text-sm text-[#f5f0e8] italic">"{transfer.message}"</p>
                    </div>
                  )}
                </div>

                {actionError && (
                  <p className="mb-4 rounded-xl border border-[#c47a7a]/40 bg-[#c47a7a]/10 px-4 py-3 text-sm text-[#f0d0d0]" role="alert">
                    {actionError}
                  </p>
                )}

                {/* File List */}
                <div className="custom-card p-4 sm:p-8">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <h3 className="text-xs sm:text-sm font-bold text-[#a39e94] uppercase tracking-wider">
                      Files Included ({transfer.files.length})
                    </h3>
                    {transfer.files.length > 1 && (
                      <button
                        onClick={handleDownloadAllZip}
                        disabled={zippingAll}
                        className="theme-btn-primary w-full sm:w-auto px-4 py-2.5 text-xs sm:text-sm font-bold shadow-xs inline-flex items-center justify-center gap-2 rounded-xl"
                      >
                        {zippingAll ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Zipping {zipProgress}%</span>
                          </>
                        ) : (
                          <>
                            <Archive className="w-4 h-4" />
                            <span>Download All as ZIP ({formatBytes(transfer.totalSize)})</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  <ul className="space-y-2.5 sm:space-y-3">
                    {transfer.files.map((file) => {
                      const category = getFileTypeCategory(file.content_type, file.file_name);
                      const IconComponent = getFileIcon(category);
                      const isDownloading = downloading[file.id];
                      const canPreview = ['image', 'video', 'audio', 'text', 'pdf'].includes(category);

                      return (
                        <li key={file.id} className="flex flex-col xs:flex-row xs:items-center justify-between gap-3 p-3 sm:p-4 bg-[#141311] border border-white/10 rounded-2xl hover:bg-[#1a1916]/70 transition-colors">
                          <div className="flex items-center gap-3 min-w-0 pr-1">
                            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl theme-bg-light theme-text flex items-center justify-center shrink-0">
                              <IconComponent className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm sm:text-base font-semibold text-white truncate">{file.file_name}</p>
                              <p className="text-sm text-white/70">{formatBytes(file.file_size)}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end xs:self-center w-full xs:w-auto">
                            {canPreview && (
                              <button
                                onClick={() => handleOpenPreview(file)}
                                className="flex-1 xs:flex-initial px-3 py-2 text-xs font-bold text-[#a39e94] bg-[#1a1916] hover:bg-[#1a1916] border border-white/10 rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Preview</span>
                              </button>
                            )}

                            <button
                              onClick={() => handleDownload(file)}
                              disabled={isDownloading}
                              className="flex-1 xs:flex-initial theme-btn-primary px-3.5 py-2 text-xs font-bold rounded-xl shadow-xs flex items-center justify-center gap-1.5"
                            >
                              {isDownloading ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>Downloading...</span>
                                </>
                              ) : (
                                <>
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Download</span>
                                </>
                              )}
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div className="custom-card p-5 sm:p-6 text-center border-[#c4a574]/25">
                  <p className="text-xs sm:text-sm text-[#a39e94] mb-3 font-medium">
                    Need to send files to someone else?
                  </p>
                  <Link
                    to="/"
                    className="theme-btn-primary w-full sm:w-auto px-6 py-3 text-xs sm:text-sm font-semibold rounded-full inline-flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>Send your own files free</span>
                  </Link>
                </div>

              </div>
            )}
          </>
        )}

      </main>

      {/* File Preview Modal */}
      {previewFile && (
        <Portal>
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-[#0c0b0a]/85 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-2xl custom-card shadow-2xl border border-white/10 overflow-hidden flex flex-col max-h-[85vh]">
            
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#141311]">
              <span className="text-xs font-bold text-[#f5f0e8] truncate pr-2">{previewFile.file_name}</span>
              <button
                onClick={handleClosePreview}
                className="p-1 rounded-lg hover:bg-[#22211d] text-[#a39e94] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 p-4 overflow-auto flex items-center justify-center bg-[#1a1916] min-h-[300px]">
              {loadingPreview ? (
                <Loader2 className="w-8 h-8 animate-spin theme-text" />
              ) : previewUrl ? (
                <>
                  {getFileTypeCategory(previewFile.content_type, previewFile.file_name) === 'image' && (
                    <img src={previewUrl} alt={previewFile.file_name} className="max-h-[60vh] max-w-full rounded-lg object-contain shadow-md" />
                  )}
                  {getFileTypeCategory(previewFile.content_type, previewFile.file_name) === 'video' && (
                    <video src={previewUrl} controls className="max-h-[60vh] max-w-full rounded-lg shadow-md" />
                  )}
                  {getFileTypeCategory(previewFile.content_type, previewFile.file_name) === 'audio' && (
                    <div className="p-8 custom-card shadow-md text-center space-y-4">
                      <Music className="w-12 h-12 theme-text mx-auto" />
                      <audio src={previewUrl} controls className="w-full" />
                    </div>
                  )}
                  {getFileTypeCategory(previewFile.content_type, previewFile.file_name) === 'pdf' && (
                    <iframe src={previewUrl} className="w-full h-[60vh] rounded-lg border border-white/10" title="PDF Preview" />
                  )}
                </>
              ) : (
                <p className="text-xs text-[#a39e94]">Preview not available.</p>
              )}
            </div>

            <div className="p-3 border-t border-white/10 bg-[#1a1916] flex justify-end gap-2">
              <button
                onClick={() => handleDownload(previewFile)}
                className="theme-btn-primary px-4 py-2 text-xs font-bold shadow-xs flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download File</span>
              </button>
            </div>

          </div>
        </div>
        </Portal>
      )}

      <Footer />
    </div>
  );
}
