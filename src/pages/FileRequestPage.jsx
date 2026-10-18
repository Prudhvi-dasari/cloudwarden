import { useState, useCallback, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { createFileRequest, saveTransferSecrets } from '../lib/guestSession';
import { useAccount } from '../lib/AccountContext';
import { activeStorageProvider } from '../lib/storageProvider';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import DropZone from '../components/DropZone';
import FileList from '../components/FileList';
import UploadProgress from '../components/UploadProgress';
import { Send, Download, Inbox, CheckCircle2, ArrowLeft, Clock, ShieldCheck, Sparkles, User, Mail, MessageSquare } from 'lucide-react';

function generateShareId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatTime(seconds) {
  if (!seconds || seconds === Infinity || isNaN(seconds)) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export default function FileRequestPage() {
  const { requestId } = useParams();
  const { user } = useAccount();
  const [files, setFiles] = useState([]);
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [note, setNote] = useState('');
  const [portal, setPortal] = useState(null);
  const [portalLoading, setPortalLoading] = useState(!!requestId);
  const [portalError, setPortalError] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [requestTitle, setRequestTitle] = useState('');
  const [requestInstructions, setRequestInstructions] = useState('');
  const [createdUrl, setCreatedUrl] = useState('');
  const [creating, setCreating] = useState(false);
  
  const [view, setView] = useState('form'); // 'form' | 'progress' | 'complete'
  const [progress, setProgress] = useState(0);
  const [currentFileName, setCurrentFileName] = useState('');
  const [uploadSpeed, setUploadSpeed] = useState('');
  const [timeRemaining, setTimeRemaining] = useState('');
  const [uploadStatus, setUploadStatus] = useState('uploading');
  const [shareData, setShareData] = useState(null);

  useEffect(() => {
    if (!requestId) {
      setPortalLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/r2?action=request-meta&requestId=${encodeURIComponent(requestId)}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setPortal(null);
          setPortalError(data.error || 'This request link is not available.');
          return;
        }
        setPortal(data);
        setPortalError('');
      } catch {
        if (!cancelled) {
          setPortal(null);
          setPortalError('This request link could not be loaded.');
        }
      } finally {
        if (!cancelled) setPortalLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [requestId]);

  const handleFilesSelected = useCallback((newFiles) => {
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const handleRemoveFile = useCallback((index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleCreateRequest = async (event) => {
    event.preventDefault();
    if (creating) return;
    setCreating(true);
    setUploadError('');
    try {
      const { data: sessionWrap } = await supabase.auth.getSession();
      const created = await createFileRequest({
        accessToken: sessionWrap?.session?.access_token,
        title: requestTitle.trim() || 'File request',
        instructions: requestInstructions.trim(),
      });
      setCreatedUrl(`${window.location.origin}/request/${created.requestId}`);
    } catch (err) {
      setUploadError(err.message || 'Could not create the request link.');
    } finally {
      setCreating(false);
    }
  };

  const handleUploadFiles = async (e) => {
    if (e) e.preventDefault();
    if (submitting || files.length === 0 || !portal) return;
    const totalSize = files.reduce((a, f) => a + f.size, 0);
    if (totalSize > 6_000_000_000) {
      setUploadError('This transfer is larger than the 6 GB limit.');
      return;
    }

    setSubmitting(true);
    setUploadError('');
    setView('progress');
    setUploadStatus('uploading');
    setProgress(0);

    const shareId = generateShareId();
    let totalUploaded = 0;
    const startTime = Date.now();
    let deleteToken = '';
    let claimToken = '';

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setCurrentFileName(`Uploading [${i + 1}/${files.length}]: ${file.name}`);

        const previousUploaded = totalUploaded;
        const uploaded = await activeStorageProvider.uploadFile({
          file,
          shareId,
          deleteToken,
          senderEmail: senderEmail || senderName || null,
          subject: portal?.title || `Files for ${requestId || 'request'}`,
          message: note || null,
          recipientEmails: null,
          requestId: requestId || null,
          transferType: 'request',
          expiryHours: 168,
          onProgress: (bytesUploaded) => {
            totalUploaded = previousUploaded + bytesUploaded;
            const overallProgress = Math.round((totalUploaded / totalSize) * 100);
            setProgress(overallProgress);

            const elapsed = (Date.now() - startTime) / 1000;
            if (elapsed > 0.1) {
              const speed = totalUploaded / elapsed;
              setUploadSpeed(`${(speed / (1024 * 1024)).toFixed(1)} MB/s`);
              const remaining = (totalSize - totalUploaded) / speed;
              setTimeRemaining(formatTime(remaining));
            }
          },
        });
        if (uploaded.claimToken) claimToken = uploaded.claimToken;
        if (uploaded.deleteToken) deleteToken = uploaded.deleteToken;
        totalUploaded = previousUploaded + file.size;
      }

      saveTransferSecrets(shareId, { claimToken, deleteToken });

      // Also track in local storage
      try {
        const localSaved = JSON.parse(localStorage.getItem('itransfer_my_transfers') || '[]');
        if (!localSaved.includes(shareId)) {
          localSaved.unshift(shareId);
          localStorage.setItem('itransfer_my_transfers', JSON.stringify(localSaved));
        }
      } catch (err) {}

      setUploadStatus('complete');
      setProgress(100);
      setShareData({
        shareId,
        fileCount: files.length,
        totalSize,
      });

      setTimeout(() => setView('complete'), 800);

    } catch (err) {
      setUploadStatus('error');
      setUploadError(err.message || 'The upload did not finish. You can try again.');
      setView('form');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col text-white relative overflow-hidden bg-[#07080d]">
      <div className="page-sky" aria-hidden="true" />

      <header className="sticky top-0 z-40 px-3 sm:px-4 pt-3">
        <div className="max-w-6xl mx-auto h-14 px-3 rounded-full border border-white/25 bg-white/10 backdrop-blur-md flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
              <Send className="w-3.5 h-3.5 text-black" />
            </div>
            <span className="text-base font-semibold tracking-tight text-white">iTransfer</span>
          </Link>
          <Link to="/" className="text-xs font-semibold text-white/70 hover:text-white flex items-center gap-1 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Send files
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
        
        {view === 'form' && !requestId && (
          <div className="custom-card p-6 sm:p-9 max-w-xl mx-auto">
            <div className="text-center mb-6">
              <h1 className="font-display text-2xl font-semibold text-[#f5f0e8]">Receive files</h1>
              <p className="text-xs text-[#a39e94] max-w-sm mx-auto mt-2">
                Create a link, share it, and visitors can upload without an account. Files stay available for 7 days.
              </p>
            </div>
            {user ? (
              <form onSubmit={handleCreateRequest} className="space-y-3">
                <input
                  type="text"
                  value={requestTitle}
                  onChange={(e) => setRequestTitle(e.target.value)}
                  placeholder="Name this request"
                  className="w-full px-3.5 py-2.5 bg-[#141311] border border-white/12 rounded-xl text-sm text-[#f5f0e8]"
                />
                <textarea
                  rows={3}
                  value={requestInstructions}
                  onChange={(e) => setRequestInstructions(e.target.value)}
                  placeholder="Optional instructions"
                  className="w-full px-3.5 py-2.5 bg-[#141311] border border-white/12 rounded-xl text-sm text-[#f5f0e8] resize-none"
                />
                <button type="submit" disabled={creating} className="btn-animated w-full py-3 text-sm font-semibold disabled:opacity-60">
                  {creating ? 'Creating…' : 'Create request link'}
                </button>
              </form>
            ) : (
              <p className="text-sm text-center text-[#d9d3c7]">Sign in to create a request link. Sending a file still does not require an account.</p>
            )}
            {createdUrl && (
              <div className="mt-4 space-y-2">
                <input readOnly value={createdUrl} className="w-full px-3 py-2 rounded-lg bg-[#1a1916] text-xs text-[#f5f0e8]" />
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(createdUrl)}
                  className="theme-btn-primary w-full py-2 rounded-xl text-xs font-semibold"
                >
                  Copy link
                </button>
              </div>
            )}
            {uploadError && <p className="mt-3 text-sm text-[#c47a7a]" role="alert">{uploadError}</p>}
          </div>
        )}

        {view === 'form' && requestId && (portalLoading || portalError || !portal) && (
          <div className="custom-card p-8 text-center max-w-xl mx-auto" role="status">
            <h1 className="text-xl font-semibold text-[#f5f0e8] mb-2">
              {portalLoading ? 'Loading request…' : 'This request is unavailable'}
            </h1>
            {!portalLoading && <p className="text-sm text-[#a39e94]">{portalError || 'This request link is not available.'}</p>}
          </div>
        )}

        {view === 'form' && requestId && portal && !portalError && (
          <div className="custom-card p-6 sm:p-9 max-w-xl mx-auto animate-scale-in">
            
            {/* Title */}
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-[#c4a574]/12 text-[#c4a574] border border-[#c4a574]/25 flex items-center justify-center mx-auto mb-3 shadow-xs">
                <Inbox className="w-7 h-7" />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#c4a574] bg-[#c4a574]/10 px-3 py-1 rounded-full border border-[#c4a574]/25">
                File drop request
              </span>
              <h1 className="font-display text-2xl font-semibold text-[#f5f0e8] mt-2">
                {portalLoading ? 'Loading portal…' : (portal?.title || 'Send files to requester')}
              </h1>
              <p className="text-xs text-[#a39e94] max-w-sm mx-auto mt-1">
                {portal?.instructions || 'Upload documents, videos, and archives directly. No account required.'}
              </p>
            </div>

            {/* DropZone or FileList */}
            {files.length === 0 ? (
              <DropZone onFilesSelected={handleFilesSelected} />
            ) : (
              <div className="space-y-4 animate-scale-in">
                <FileList
                  files={files}
                  onRemoveFile={handleRemoveFile}
                  onFilesAdded={handleFilesSelected}
                />

                <form onSubmit={handleUploadFiles} className="space-y-3 pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Your Name (optional)</label>
                      <input
                        type="text"
                        value={senderName}
                        onChange={(e) => setSenderName(e.target.value)}
                        placeholder="e.g. Sarah Connor"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Your Email (optional)</label>
                      <input
                        type="email"
                        value={senderEmail}
                        onChange={(e) => setSenderEmail(e.target.value)}
                        placeholder="you@email.com"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Note or description (optional)</label>
                    <textarea
                      rows={2}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Add any instructions or notes about these files..."
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:border-indigo-500 resize-none"
                    />
                  </div>

                  {uploadError && <p className="text-sm text-[#c47a7a]" role="alert">{uploadError}</p>}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-animated w-full py-3.5 text-xs sm:text-sm font-black shadow-md flex items-center justify-center gap-2 mt-4 disabled:opacity-60"
                  >
                    <Send className="w-4 h-4" />
                    <span>Upload & Send {files.length} File{files.length !== 1 ? 's' : ''} ({formatBytes(files.reduce((a, f) => a + f.size, 0))})</span>
                  </button>
                </form>
              </div>
            )}

          </div>
        )}

        {view === 'progress' && (
          <div className="max-w-xl mx-auto send-shell">
            <UploadProgress
              progress={progress}
              fileName={currentFileName}
              uploadSpeed={uploadSpeed}
              timeRemaining={timeRemaining}
              status={uploadStatus}
            />
          </div>
        )}

        {view === 'complete' && (
          <div className="custom-card p-8 sm:p-10 text-center max-w-md mx-auto animate-scale-in">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-[#0c0b0a] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-9 h-9 stroke-[2.5]" />
            </div>

            <h2 className="text-2xl font-black text-slate-900 mb-1">Files Sent Successfully!</h2>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              Your {shareData?.fileCount} file{shareData?.fileCount !== 1 ? 's' : ''} ({formatBytes(shareData?.totalSize)}) finished uploading. The person who created this request can see them. They stay available for 7 days.
            </p>

            <Link
              to="/"
              className="w-full theme-btn-primary py-3 px-4 rounded-xl text-xs font-bold shadow-md inline-flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>Send Your Own Files on iTransfer</span>
            </Link>
          </div>
        )}

      </main>

      <Footer />

    </div>
  );
}
