import { useState, useCallback, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase, publicSupabase } from '../lib/supabase';
import { activeStorageProvider, sanitizeStoragePath } from '../lib/storageProvider';
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
  const [files, setFiles] = useState([]);
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [note, setNote] = useState('');
  
  const [view, setView] = useState('form'); // 'form' | 'progress' | 'complete'
  const [progress, setProgress] = useState(0);
  const [currentFileName, setCurrentFileName] = useState('');
  const [uploadSpeed, setUploadSpeed] = useState('');
  const [timeRemaining, setTimeRemaining] = useState('');
  const [uploadStatus, setUploadStatus] = useState('uploading');
  const [shareData, setShareData] = useState(null);

  const handleFilesSelected = useCallback((newFiles) => {
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const handleRemoveFile = useCallback((index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleUploadFiles = async (e) => {
    if (e) e.preventDefault();
    if (files.length === 0) return;

    setView('progress');
    setUploadStatus('uploading');
    setProgress(0);

    const shareId = generateShareId();
    const totalSize = files.reduce((a, f) => a + f.size, 0);
    let totalUploaded = 0;
    const startTime = Date.now();

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const filePath = sanitizeStoragePath(`requests/${requestId || 'general'}/${shareId}/${file.name}`);
        setCurrentFileName(`Uploading [${i + 1}/${files.length}]: ${file.name}`);

        const previousUploaded = totalUploaded;
        await activeStorageProvider.uploadFile({
          file,
          filePath,
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
        totalUploaded = previousUploaded + file.size;
      }

      // Record in Supabase DB with fast single bulk insert
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const requestPayloads = files.map((file) => ({
        share_id: shareId,
        file_name: file.name,
        file_size: file.size,
        file_path: sanitizeStoragePath(`requests/${requestId || 'general'}/${shareId}/${file.name}`),
        content_type: file.type || 'application/octet-stream',
        subject: `Files received from ${senderName || senderEmail || 'Anonymous'}`,
        message: note || null,
        sender_email: senderEmail || null,
        recipient_emails: requestId ? `request:${requestId}` : null,
        transfer_type: 'request',
        expires_at: expiresAt,
      }));

      try {
        await publicSupabase.from('transfers').insert(requestPayloads);
      } catch (dbErr) {
        console.warn('Request DB insert error:', dbErr);
      }

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
      console.error('Request Upload Error:', err);
      setUploadStatus('error');
      alert('Upload failed: ' + (err.message || 'Network error'));
      setTimeout(() => setView('form'), 1500);
    }
  };

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
          <Link to="/" className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 bg-slate-100 px-3.5 py-1.5 rounded-xl transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to App
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
        
        {view === 'form' && (
          <div className="custom-card p-6 sm:p-9 max-w-xl mx-auto animate-scale-in">
            
            {/* Title */}
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center mx-auto mb-3 shadow-xs">
                <Inbox className="w-7 h-7" />
              </div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                File Drop Request
              </span>
              <h1 className="text-2xl font-black text-slate-900 mt-2">
                Send Files to Requester
              </h1>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                You can upload documents, videos, and archives directly. No account required.
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

                  <button
                    type="submit"
                    className="btn-animated w-full py-3.5 text-xs sm:text-sm font-black shadow-md flex items-center justify-center gap-2 mt-4"
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
          <div className="custom-card p-6 max-w-xl mx-auto">
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
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-9 h-9 stroke-[2.5]" />
            </div>

            <h2 className="text-2xl font-black text-slate-900 mb-1">Files Sent Successfully!</h2>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              Your {shareData?.fileCount} file{shareData?.fileCount !== 1 ? 's' : ''} ({formatBytes(shareData?.totalSize)}) have been delivered to the recipient.
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
