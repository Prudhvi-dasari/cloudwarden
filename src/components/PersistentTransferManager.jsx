import { useRef } from 'react';
import {
  Pause, Play, X, RotateCcw, Plus, CheckCircle2, AlertTriangle,
  Loader2, Zap, Clock, ShieldCheck, Copy, Check, ExternalLink,
  File, Image as ImageIcon, Film, Music, FileText, Archive
} from 'lucide-react';
import { formatBytes } from '../lib/transferManager';
import Portal from './Portal';

function getFileIcon(fileName, fileType) {
  const ext = fileName?.split('.').pop()?.toLowerCase();
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext) || fileType?.startsWith('image/')) return ImageIcon;
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext) || fileType?.startsWith('video/')) return Film;
  if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext) || fileType?.startsWith('audio/')) return Music;
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return Archive;
  if (['pdf', 'doc', 'docx', 'txt'].includes(ext)) return FileText;
  return File;
}

export default function PersistentTransferManager({
  manager,
  snapshot,
  onAddFiles,
  onClose,
  onCancelAndEdit,
  shareUrl,
  copied,
  onCopyLink,
}) {
  const fileInputRef = useRef(null);

  if (!snapshot) return null;

  const {
    transferName,
    files = [],
    totalFiles = 0,
    completedFiles = 0,
    totalBytes = 0,
    totalUploadedBytes = 0,
    uploadedBytes: uploadedBytesAlias = 0,
    overallProgress = 0,
    speedStr,
    timeRemainingStr,
  } = snapshot;

  // Engine emits totalUploadedBytes; keep alias so the bar never sticks at 0%
  const uploadedBytes = totalUploadedBytes || uploadedBytesAlias || 0;

  const isAllComplete = Boolean(
    snapshot.isAllComplete ||
    snapshot.overallStatus === 'complete' ||
    (totalFiles > 0 && completedFiles >= totalFiles)
  );

  const effectiveTransferName =
    transferName ||
    snapshot.transferName ||
    manager?.transferName ||
    'Active Transfer';

  const handleAppendFiles = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onAddFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const effectiveShareId = manager?.shareId || snapshot.shareId;
  const effectiveShareUrl =
    shareUrl ||
    (effectiveShareId ? `${window.location.origin}/d/${effectiveShareId}` : window.location.origin);

  return (
    <Portal>
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[90vh] animate-scale-in">
        
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 bg-gradient-to-r from-slate-900 via-slate-850 to-indigo-950 text-white relative">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 mb-2">
                <Zap className="w-3 h-3 text-indigo-400 animate-pulse" />
                <span>TurboBandwidth™ Transfer Manager</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black truncate tracking-tight">
                {effectiveTransferName}
              </h2>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                {isAllComplete ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> All {totalFiles} files uploaded successfully!
                  </span>
                ) : (
                  <span>Uploading {totalFiles} file{totalFiles !== 1 ? 's' : ''} • {formatBytes(uploadedBytes)} of {formatBytes(totalBytes)} ({overallProgress}%)</span>
                )}
              </p>
            </div>

            {isAllComplete && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Overall Progress Bar */}
          <div className="mt-4 space-y-1.5">
            <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-300 ${isAllComplete ? 'bg-emerald-400' : 'bg-gradient-to-r from-indigo-500 to-violet-400'}`}
                style={{ width: `${overallProgress}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-400" /> {speedStr}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-indigo-400" /> {timeRemainingStr} remaining
              </span>
            </div>
          </div>
        </div>

        {/* File Transfer List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-slate-50 min-h-[220px]">
          {files.map((file) => {
            const Icon = getFileIcon(file.name, file.type);
            const isUploading = file.status === 'uploading';
            const isValidating = file.status === 'validating';
            const isPaused = file.status === 'paused';
            const isQueued = file.status === 'queued';
            const isComplete = file.status === 'completed';
            const isError = file.status === 'error';

            return (
              <div
                key={file.id}
                className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                  isComplete
                    ? 'bg-emerald-50/70 border-emerald-200/80 shadow-2xs'
                    : isValidating
                    ? 'bg-indigo-50/70 border-indigo-200/80 shadow-2xs animate-pulse'
                    : isPaused
                    ? 'bg-amber-50/60 border-amber-200/80'
                    : isError
                    ? 'bg-rose-50/70 border-rose-200/80'
                    : 'bg-white border-slate-200/80 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isComplete ? 'bg-emerald-100 text-emerald-700' : isValidating ? 'bg-indigo-100 text-indigo-700' : 'bg-indigo-50 text-indigo-600'
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-black text-slate-900 truncate">{file.name}</p>
                      <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 mt-0.5">
                        <span>{formatBytes(file.size)}</span>
                        <span>•</span>
                        {isComplete && <span className="text-emerald-700 font-bold">100% Completed</span>}
                        {isValidating && (
                          <span className="text-indigo-700 font-black flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />
                            <span>100% • Validating file integrity...</span>
                          </span>
                        )}
                        {isUploading && <span className="text-indigo-600 font-bold">{file.progress}% • {formatBytes(file.uploadedBytes)} / {formatBytes(file.size)}</span>}
                        {isPaused && <span className="text-amber-700 font-bold">Paused at {file.progress}% ({formatBytes(file.uploadedBytes)})</span>}
                        {isQueued && <span className="text-slate-400 font-bold">Waiting in queue...</span>}
                        {isError && <span className="text-rose-600 font-bold">{file.error || 'Upload error'}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Per-File Action Buttons */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isValidating && (
                      <div className="px-2.5 py-1 bg-indigo-100/80 border border-indigo-200 text-indigo-800 rounded-xl text-[11px] font-extrabold flex items-center gap-1.5 shadow-2xs">
                        <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Validating</span>
                      </div>
                    )}
                    {isUploading && (
                      <>
                        <button
                          onClick={() => manager.pauseFile(file.id)}
                          className="px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          title="Pause Upload"
                        >
                          <Pause className="w-3.5 h-3.5 fill-amber-900" />
                          <span className="hidden xs:inline">Pause</span>
                        </button>
                        <button
                          onClick={() => manager.cancelFile(file.id)}
                          className="p-1.5 bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-700 rounded-xl transition-colors cursor-pointer"
                          title="Cancel Upload"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    {isPaused && (
                      <>
                        <button
                          onClick={() => manager.resumeFile(file.id)}
                          className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors shadow-2xs cursor-pointer"
                          title="Resume Upload"
                        >
                          <Play className="w-3.5 h-3.5 fill-white" />
                          <span className="hidden xs:inline">Resume</span>
                        </button>
                        <button
                          onClick={() => manager.cancelFile(file.id)}
                          className="p-1.5 bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-700 rounded-xl transition-colors cursor-pointer"
                          title="Cancel"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    {isQueued && (
                      <button
                        onClick={() => manager.removeFile(file.id)}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        title="Remove from queue"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span className="hidden xs:inline">Remove</span>
                      </button>
                    )}

                    {isError && (
                      <>
                        <button
                          onClick={() => manager.retryFile(file.id)}
                          className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors shadow-2xs cursor-pointer"
                          title="Retry Upload"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Retry</span>
                        </button>
                        <button
                          onClick={() => manager.removeFile(file.id)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    {isComplete && (
                      <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                        <Check className="w-4 h-4 stroke-[3]" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Per-File Progress Bar & Speed */}
                {!isComplete && !isQueued && (
                  <div className="space-y-1 mt-1">
                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-200 ${
                          isPaused ? 'bg-amber-500' : isError ? 'bg-rose-500' : 'theme-btn-primary'
                        }`}
                        style={{ width: `${file.progress}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                      <span>{file.speedStr}</span>
                      <span>ETA: {file.timeRemainingStr}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Celebration & Share Link Card when Complete */}
        {isAllComplete && (
          <div className="p-4 sm:p-5 bg-emerald-50/90 border-t border-emerald-200/90 space-y-2.5 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-950">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span className="text-xs sm:text-sm font-black">🎉 Transfer Complete & Ready to Share!</span>
              </div>
              <span className="text-[11px] font-bold text-emerald-700">{totalFiles} {totalFiles === 1 ? 'file' : 'files'} ({formatBytes(totalBytes)})</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  readOnly
                  value={effectiveShareUrl}
                  className="w-full pl-3.5 pr-24 py-2.5 bg-white border border-emerald-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(effectiveShareUrl);
                    if (onCopyLink) onCopyLink();
                  }}
                  className="absolute right-1.5 top-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors shadow-2xs cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied!' : 'Copy Link'}</span>
                </button>
              </div>

              <a
                href={effectiveShareUrl}
                target="_blank"
                rel="noreferrer"
                className="p-2.5 bg-white hover:bg-emerald-100 border border-emerald-300 text-emerald-700 rounded-xl text-xs font-bold flex items-center justify-center transition-colors shadow-2xs shrink-0 cursor-pointer"
                title="Open Download Page"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3">
          
          {/* Add More Files Button (Available during or after upload) */}
          <div>
            <input
              type="file"
              ref={fileInputRef}
              multiple
              onChange={handleAppendFiles}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-dashed border-slate-300 hover:border-indigo-500 bg-slate-50 hover:bg-indigo-50/40 text-slate-700 hover:text-indigo-700 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add More Files</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {isAllComplete ? (
              <button
                onClick={onClose}
                className="w-full sm:w-auto theme-btn-primary px-6 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Done & View Transfer</span>
              </button>
            ) : (
              <>
                {onCancelAndEdit && (
                  <button
                    onClick={() => {
                      manager.cancelAll();
                      onCancelAndEdit();
                    }}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4 text-rose-600" />
                    <span>Cancel & Edit Files</span>
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Run in Background
                </button>
              </>
            )}
          </div>

        </div>

      </div>
    </div>
    </Portal>
  );
}
