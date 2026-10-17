import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import JSZip from 'jszip';
import { publicSupabase } from '../lib/supabase';
import { activeStorageProvider } from '../lib/storageProvider';
import { playDownloadChime } from '../lib/sound';
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
      let { data, error: dbError } = await publicSupabase
        .from('transfers')
        .select('*')
        .eq('share_id', cleanShareId);

      if (dbError) throw dbError;
      if (!data || data.length === 0) {
        const { data: fallbackData } = await publicSupabase
          .from('transfers')
          .select('*')
          .ilike('share_id', cleanShareId);
        if (fallbackData && fallbackData.length > 0) {
          data = fallbackData;
        }
      }

      if (!data || data.length === 0) {
        try {
          const cached = localStorage.getItem('itransfer_transfer_' + cleanShareId);
          if (cached) {
            data = JSON.parse(cached);
          }
        } catch (e) {}
      }

      if (!data || data.length === 0) {
        setError('This file transfer does not exist, was deleted, or reached its max download limit.');
        setLoading(false);
        return;
      }

      const firstFile = data[0];
      if (new Date() > new Date(firstFile.expires_at)) {
        setIsExpired(true);
        setExpiredTransfer({
          subject: firstFile.subject || 'Transfer',
          fileCount: data.length,
          totalSize: data.reduce((acc, f) => acc + (f.file_size || 0), 0),
          expiresAt: firstFile.expires_at,
        });
        setLoading(false);
        // Trigger server-side purge of expired transfers in background
        fetch('/api/r2?action=cleanup').catch(() => {});
        return;
      }

      if (firstFile.max_downloads > 0 && (firstFile.download_count || 0) >= firstFile.max_downloads) {
        setError('This transfer reached its maximum download limit and has self-destructed.');
        setLoading(false);
        return;
      }

      if (firstFile.password_hash) {
        setIsLocked(true);
      }

      setTransfer({
        files: data,
        subject: firstFile.subject,
        message: firstFile.message,
        senderEmail: firstFile.sender_email,
        expiresAt: firstFile.expires_at,
        passwordHash: firstFile.password_hash,
        maxDownloads: firstFile.max_downloads || 0,
        downloadCount: firstFile.download_count || 0,
        totalSize: data.reduce((acc, f) => acc + (f.file_size || 0), 0),
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
          expectedPasswordHash: transfer.passwordHash,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
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
      const downloadUrl = await activeStorageProvider.getSignedDownloadUrl(file.file_path, file.file_name);

      if (!downloadUrl) {
        throw new Error('Unable to generate download link. File may have expired.');
      }

      // 2. Stream as blob to guarantee native save dialog without popup blockers
      try {
        const response = await fetch(downloadUrl);
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = file.file_name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      } catch (streamErr) {
        console.warn('Blob download fallback to direct anchor click:', streamErr);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = file.file_name;
        a.target = '_self';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      playDownloadChime();

      const newCount = (file.download_count || 0) + 1;

      try {
        await publicSupabase
          .from('transfers')
          .update({ download_count: newCount })
          .eq('id', file.id);
      } catch (e) {}

      setTransfer(prev => ({ ...prev, downloadCount: newCount }));

      if (transfer.maxDownloads > 0 && newCount >= transfer.maxDownloads) {
        for (const f of transfer.files) {
          if (f.file_path) {
            await activeStorageProvider.deleteFile(f.file_path);
          }
        }
        await publicSupabase.from('transfers').delete().eq('share_id', shareId);
        setError('This transfer has reached its maximum download limit and self-destructed.');
      }

    } catch (err) {
      console.error('Download failed:', err);
      alert('Download failed: ' + (err.message || 'File not found in storage. It may have expired.'));
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
        const fileBlob = await activeStorageProvider.downloadFile(file.file_path);
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
      alert('ZIP download failed. Downloading files individually...');
      for (const file of transfer.files) {
        await handleDownload(file);
      }
    } finally {
      setZippingAll(false);
      setZipProgress(0);
    }
  }

  async function handleOpenPreview(file) {
    setPreviewFile(file);
    setLoadingPreview(true);

    try {
      const streamUrl = await activeStorageProvider.getPreviewUrl(file.file_path, file.file_name);
      if (streamUrl) {
        setPreviewUrl(streamUrl);
      } else {
        throw new Error('Preview not available');
      }
    } catch (err) {
      console.error('Preview error:', err);
      alert('Unable to generate preview for this file.');
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
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl theme-btn-primary flex items-center justify-center shadow-md">
              <Send className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-black tracking-tight text-slate-900">iTransfer</span>
          </Link>
          <Link to="/" className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 px-3.5 py-1.5 rounded-xl transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Send Files
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
        
        {loading && (
          <div className="custom-card p-12 text-center">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-600">Retrieving transfer details...</p>
          </div>
        )}

        {isExpired && expiredTransfer && (
          <div className="custom-card p-8 sm:p-12 text-center max-w-lg mx-auto animate-scale-in">
            <div className="w-16 h-16 rounded-3xl bg-slate-100 border border-slate-200 text-slate-400 flex items-center justify-center mx-auto mb-5 shadow-xs">
              <Clock className="w-8 h-8" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mb-1">
              {expiredTransfer.subject || 'Transfer'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-semibold mb-6">
              {expiredTransfer.fileCount} {expiredTransfer.fileCount === 1 ? 'file' : 'files'} • {formatBytes(expiredTransfer.totalSize)}
            </p>

            <div className="p-4 bg-rose-50/80 border border-rose-200/80 rounded-2xl mb-6 space-y-1">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Link expired</span>
              </div>
              <p className="text-xs text-rose-900 font-medium">
                Expired on {new Date(expiredTransfer.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>

            <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-500 rounded-xl text-xs font-bold border border-slate-200 cursor-not-allowed select-none">
              <span>[Deleted from Cloud Vault]</span>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-200">
              <Link to="/" className="theme-btn-primary px-6 py-3 text-xs font-bold inline-flex items-center gap-2 shadow-sm rounded-xl">
                <ArrowLeft className="w-4 h-4" /> Send your own files with iTransfer
              </Link>
            </div>
          </div>
        )}

        {error && !isExpired && (
          <div className="custom-card p-8 sm:p-10 text-center animate-scale-in">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-slate-900 mb-2">Transfer Unavailable</h2>
            <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">{error}</p>
            <Link to="/" className="theme-btn-primary px-6 py-3 text-xs font-bold inline-flex items-center gap-2 shadow-sm">
              <ArrowLeft className="w-4 h-4" /> Go to iTransfer Homepage
            </Link>
          </div>
        )}

        {transfer && !error && (
          <>
            {isLocked ? (
              <div className={`custom-card p-6 sm:p-10 text-center max-w-md mx-auto animate-scale-in ${passwordError ? 'animate-shake' : ''}`}>
                <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto mb-4 shadow-xs">
                  <Lock className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 mb-1">Protected Files</h2>
                <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                  The sender set a password for this transfer. Enter it below to unlock and download {transfer.files.length} file{transfer.files.length !== 1 ? 's' : ''}.
                </p>

                {passwordError && (
                  <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center justify-center gap-1.5">
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
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm text-center font-bold text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 p-0.5"
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
                    <FolderDown className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                  </div>
                  
                  <h1 className="text-2xl sm:text-4xl font-black text-slate-900 mb-1.5 sm:mb-2 tracking-tight">
                    {transfer.subject || 'Files Ready for Download'}
                  </h1>

                  {transfer.senderEmail && (
                    <p className="text-xs sm:text-sm text-slate-600 mb-2 font-medium">
                      Sent by <span className="font-bold text-slate-900">{transfer.senderEmail}</span>
                    </p>
                  )}

                  <div className="flex items-center justify-center gap-2 text-xs sm:text-sm font-bold text-slate-600 mb-4 sm:mb-5">
                    <span>{transfer.files.length} file{transfer.files.length !== 1 ? 's' : ''}</span>
                    <span>•</span>
                    <span className="text-slate-900 font-extrabold">{formatBytes(transfer.totalSize)}</span>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-700 border border-slate-200">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>Expires in {Math.max(1, Math.ceil((new Date(transfer.expiresAt) - new Date()) / (1000 * 60 * 60 * 24)))} days</span>
                    </div>

                    {transfer.maxDownloads > 0 && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 rounded-full text-xs font-bold text-rose-700 border border-rose-200">
                        <Flame className="w-3.5 h-3.5 text-rose-500" />
                        <span>Limit: {transfer.downloadCount} / {transfer.maxDownloads}</span>
                      </div>
                    )}
                  </div>

                  {transfer.message && (
                    <div className="mt-4 p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-left">
                      <p className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Message from sender:</p>
                      <p className="text-xs sm:text-sm text-slate-800 italic">"{transfer.message}"</p>
                    </div>
                  )}
                </div>

                {/* File List */}
                <div className="custom-card p-4 sm:p-8">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-700 uppercase tracking-wider">
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
                        <li key={file.id} className="flex flex-col xs:flex-row xs:items-center justify-between gap-3 p-3 sm:p-4 bg-slate-50 border border-slate-200/80 rounded-2xl hover:bg-slate-100/70 transition-colors">
                          <div className="flex items-center gap-3 min-w-0 pr-1">
                            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl theme-bg-light theme-text flex items-center justify-center shrink-0">
                              <IconComponent className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm sm:text-base font-bold text-slate-900 truncate">{file.file_name}</p>
                              <p className="text-xs text-slate-500 font-semibold">{formatBytes(file.file_size)}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end xs:self-center w-full xs:w-auto">
                            {canPreview && (
                              <button
                                onClick={() => handleOpenPreview(file)}
                                className="flex-1 xs:flex-initial px-3 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
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

                <div className="text-center pt-3">
                  <Link to="/" className="text-xs font-bold theme-text hover:underline inline-flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5" /> Send your own files with iTransfer
                  </Link>
                </div>

              </div>
            )}
          </>
        )}

      </main>

      {/* File Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
              <span className="text-xs font-bold text-slate-800 truncate pr-2">{previewFile.file_name}</span>
              <button
                onClick={handleClosePreview}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 p-4 overflow-auto flex items-center justify-center bg-slate-100 min-h-[300px]">
              {loadingPreview ? (
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              ) : previewUrl ? (
                <>
                  {getFileTypeCategory(previewFile.content_type, previewFile.file_name) === 'image' && (
                    <img src={previewUrl} alt={previewFile.file_name} className="max-h-[60vh] max-w-full rounded-lg object-contain shadow-md" />
                  )}
                  {getFileTypeCategory(previewFile.content_type, previewFile.file_name) === 'video' && (
                    <video src={previewUrl} controls className="max-h-[60vh] max-w-full rounded-lg shadow-md" />
                  )}
                  {getFileTypeCategory(previewFile.content_type, previewFile.file_name) === 'audio' && (
                    <div className="p-8 bg-white rounded-2xl shadow-md text-center space-y-4">
                      <Music className="w-12 h-12 text-indigo-600 mx-auto" />
                      <audio src={previewUrl} controls className="w-full" />
                    </div>
                  )}
                  {getFileTypeCategory(previewFile.content_type, previewFile.file_name) === 'pdf' && (
                    <iframe src={previewUrl} className="w-full h-[60vh] rounded-lg border border-slate-200" title="PDF Preview" />
                  )}
                </>
              ) : (
                <p className="text-xs text-slate-500">Preview not available.</p>
              )}
            </div>

            <div className="p-3 border-t border-slate-200 bg-white flex justify-end gap-2">
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
      )}

      <footer className="border-t border-slate-200/80 bg-white py-6 text-center text-xs text-slate-500">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© 2026 iTransfer. Fast, secure & private file sharing.</span>
          <span className="font-medium text-slate-700">Made in India with ❤️ and lots of ☕️</span>
        </div>
      </footer>
    </div>
  );
}
