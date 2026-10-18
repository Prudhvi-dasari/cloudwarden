import { useState, useEffect } from 'react';
import {
  X, Eye, Download, Copy, Trash2, Check, ExternalLink, HardDrive,
  Clock, ShieldCheck, QrCode, Share2, Sparkles, FolderDown, File,
  Image as ImageIcon, Film, Music, FileText, ArrowRight, RefreshCw,
  PlusCircle, Lock, User, UserCheck, LogIn, Edit3
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from './Toast';
import FilePreviewModal from './FilePreviewModal';
import { deleteOwnedTransfer, loadOwnedTransfers, renameOwnedTransfer } from '../lib/guestSession';
import Portal from './Portal';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileIcon(type, name) {
  const ext = name?.split('.').pop()?.toLowerCase();
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext) || type?.startsWith('image/')) return ImageIcon;
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext) || type?.startsWith('video/')) return Film;
  if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext) || type?.startsWith('audio/')) return Music;
  if (['pdf', 'doc', 'docx', 'txt'].includes(ext)) return FileText;
  return File;
}

export default function MyUploadsDrawer({ isOpen, onClose, user, onOpenAuth, onStartNewTransfer }) {
  const { addToast } = useToast();
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [activeQrId, setActiveQrId] = useState(null);
  const [previewingFile, setPreviewingFile] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadUserTransfers();
    }
  }, [isOpen, user]);

  const loadUserTransfers = async () => {
    if (!user) {
      setTransfers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: sessionWrap } = await supabase.auth.getSession();
      const accessToken = sessionWrap?.session?.access_token;
      const rows = await loadOwnedTransfers(accessToken);
      setTransfers(rows);
    } catch (err) {
      console.warn('Failed to load user uploads:', err);
      setTransfers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = (shareId) => {
    const url = `${window.location.origin}/download/${shareId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(shareId);
    addToast('Download link copied! 📋', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRenameTransfer = async (shareId, currentName) => {
    const newName = prompt('Enter new transfer name:', currentName || '');
    if (!newName || !newName.trim() || newName.trim() === currentName) return;
    try {
      const { data: sessionWrap } = await supabase.auth.getSession();
      await renameOwnedTransfer({
        shareId,
        subject: newName.trim(),
        accessToken: sessionWrap?.session?.access_token,
      });
      setTransfers(prev => prev.map(t => t.shareId === shareId ? { ...t, subject: newName.trim() } : t));
      addToast('Transfer renamed successfully ✏️', 'success');
    } catch (e) {
      addToast('Failed to rename transfer', 'error');
    }
  };

  const handleDeleteTransfer = async (t) => {
    if (!confirm(`Permanently delete this transfer (${t.files.length} files)?`)) return;
    try {
      const { data: sessionWrap } = await supabase.auth.getSession();
      await deleteOwnedTransfer({
        shareId: t.shareId,
        accessToken: sessionWrap?.session?.access_token,
      });
      setTransfers(prev => prev.filter(item => item.shareId !== t.shareId));
      addToast('Transfer permanently deleted 🗑️', 'info');
    } catch (err) {
      addToast(err.message || 'Delete failed.', 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <Portal>
    <div className="fixed inset-0 z-[10000] flex justify-end bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
      
      {/* Background Click to Dismiss */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Slide-Over Drawer Container */}
      <div className="relative w-full max-w-xl h-full bg-white shadow-2xl flex flex-col z-10 border-l border-slate-200 animate-slide-in-right overflow-hidden">
        
        {/* Drawer Header */}
        <div className="p-4 sm:p-6 border-b border-slate-200/80 bg-slate-50/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl theme-btn-primary flex items-center justify-center text-white shadow-sm">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                My Uploads
                {user && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-bold">
                    {transfers.length}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {user ? `Signed in as ${user.email}` : 'Private Upload History'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {user && (
              <button
                onClick={loadUserTransfers}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 transition-colors"
                title="Refresh list"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* User Status Bar */}
        {user && (
          <div className="px-4 sm:px-6 py-2.5 bg-emerald-50/70 border-b border-emerald-100 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-bold text-emerald-950 truncate">Account Verified: {user.email}</span>
            </div>
            <span className="text-[11px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded-md border border-emerald-200">
              Private Vault
            </span>
          </div>
        )}

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          
          {/* 1. NOT SIGNED IN VIEW (PRIVACY GATE) */}
          {!user ? (
            <div className="text-center py-12 sm:py-16 px-4 space-y-5">
              <div className="w-16 h-16 rounded-3xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto text-indigo-600 shadow-sm">
                <Lock className="w-8 h-8" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-lg font-black text-slate-900">Sign in to View Your Uploads</h3>
                <p className="text-xs sm:text-sm text-slate-600 max-w-sm mx-auto leading-relaxed">
                  For your privacy and security, upload history is only accessible to authenticated accounts. Sign in or create a free account to track and manage your transfers.
                </p>
              </div>

              <div className="pt-2 space-y-2 max-w-xs mx-auto">
                <button
                  onClick={() => {
                    onClose();
                    if (onOpenAuth) onOpenAuth('login');
                  }}
                  className="w-full py-3 rounded-xl theme-btn-primary text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all"
                >
                  <LogIn className="w-4 h-4" /> Sign In / Create Account
                </button>

                <button
                  onClick={() => {
                    onClose();
                    onStartNewTransfer();
                  }}
                  className="w-full py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors"
                >
                  Continue as Guest (No History)
                </button>
              </div>
            </div>
          ) : loading ? (
            /* 2. LOADING SPINNER */
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin theme-text" />
              <span className="text-sm font-semibold">Loading your transfers...</span>
            </div>
          ) : transfers.length === 0 ? (
            /* 3. LOGGED IN BUT NO UPLOADS YET */
            <div className="text-center py-16 px-4 space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <FolderDown className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-800">No uploads found</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  Files you upload with this account will be securely listed here for 1-click preview and management.
                </p>
              </div>
              <button
                onClick={() => { onClose(); onStartNewTransfer(); }}
                className="px-5 py-2.5 rounded-xl theme-btn-primary text-white text-xs font-bold inline-flex items-center gap-2 shadow-md"
              >
                <PlusCircle className="w-4 h-4" /> Upload Files Now
              </button>
            </div>
          ) : (
            /* 4. LIST OF CURRENT USER'S UPLOADS ONLY */
            transfers.map((t) => {
              const isPermanent = !t.expiresAt || new Date(t.expiresAt).getFullYear() > new Date().getFullYear() + 20;
              const isExpired = t.expiresAt && !isPermanent && new Date() > new Date(t.expiresAt);
              const downloadUrl = `${window.location.origin}/download/${t.shareId}`;

              return (
                <div
                  key={t.shareId}
                  className={`p-4 rounded-2xl border transition-all ${
                    isExpired ? 'bg-slate-100/80 border-slate-200 opacity-60' : 'bg-white border-slate-200/90 shadow-xs hover:border-indigo-300'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-sm font-bold text-slate-900 truncate">
                          {t.subject || (t.files[0]?.name ? `${t.files[0].name}${t.files.length > 1 ? ` +${t.files.length - 1} more` : ''}` : 'Untitled Transfer')}
                        </h4>
                        <button
                          onClick={() => handleRenameTransfer(t.shareId, t.subject)}
                          className="p-1 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition-colors"
                          title="Rename transfer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span>{t.files.length} file{t.files.length !== 1 ? 's' : ''} ({formatBytes(t.totalSize)})</span>
                        <span>•</span>
                        <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                      </p>
                    </div>

                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1 ${
                      isPermanent ? 'bg-indigo-100 text-indigo-800' : isExpired ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      <Clock className="w-3 h-3" />
                      {isPermanent ? 'Permanent' : isExpired ? 'Expired' : `${Math.max(1, Math.ceil((new Date(t.expiresAt) - new Date()) / (1000 * 60 * 60 * 24)))}d left`}
                    </span>
                  </div>

                  {/* Individual Files inside this Transfer */}
                  <div className="space-y-1.5 mb-3">
                    {t.files.map((file, fIdx) => {
                      const IconComp = getFileIcon(file.type, file.name);
                      return (
                        <div
                          key={fIdx}
                          className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs hover:bg-slate-100/70 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            <IconComp className="w-4 h-4 text-slate-500 shrink-0" />
                            <span className="font-medium text-slate-800 truncate">{file.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono shrink-0">({formatBytes(file.size)})</span>
                          </div>

                          {/* Quick Preview Button */}
                          <button
                            onClick={() => setPreviewingFile({
                              id: file.id,
                              file_name: file.name,
                              file_size: file.size,
                              content_type: file.type,
                              share_id: t.shareId,
                            })}
                            className="px-2 py-1 rounded-lg bg-white border border-slate-200 hover:border-indigo-400 text-slate-700 font-bold text-[11px] flex items-center gap-1 shrink-0 shadow-2xs"
                            title="Preview file"
                          >
                            <Eye className="w-3.5 h-3.5 theme-text" /> Preview
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleCopyLink(t.shareId)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition-all shadow-2xs"
                      >
                        {copiedId === t.shareId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedId === t.shareId ? 'Copied' : 'Copy Link'}
                      </button>

                      <a
                        href={downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
                        title="Open download page"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>

                      <button
                        onClick={() => setActiveQrId(activeQrId === t.shareId ? null : t.shareId)}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
                        title="Scan QR code"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      onClick={() => handleDeleteTransfer(t)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Delete permanently"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* QR Code expansion */}
                  {activeQrId === t.shareId && (
                    <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-center animate-scale-in">
                      <p className="text-xs font-bold text-slate-700 mb-2">Scan with Phone Camera:</p>
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(downloadUrl)}`}
                        alt="QR Code"
                        className="w-28 h-28 mx-auto rounded-lg shadow-sm border border-slate-200 bg-white p-1.5"
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Drawer Footer CTA */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <button
            onClick={() => { onClose(); onStartNewTransfer(); }}
            className="w-full py-3 rounded-xl theme-btn-primary text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-md"
          >
            <PlusCircle className="w-4 h-4" /> Upload New Files
          </button>
        </div>
      </div>

      {/* In-App Media Preview Modal */}
      {previewingFile && (
        <FilePreviewModal
          file={previewingFile}
          shareId={previewingFile.share_id}
          onClose={() => setPreviewingFile(null)}
        />
      )}
    </div>
    </Portal>
  );
}
