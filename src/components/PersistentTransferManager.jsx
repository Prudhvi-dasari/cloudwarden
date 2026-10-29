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

const KIND_BY_ICON = new Map([
  [ImageIcon, 'image'],
  [Film, 'video'],
  [Music, 'audio'],
  [Archive, 'archive'],
  [FileText, 'doc'],
]);

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
    <div className="ds-modal-backdrop z-[10000]">
      <div className="ds-modal is-wide snd-manager">

        {/* Header */}
        <div className="snd-manager-head">
          <p className="ds-kicker"><b>●</b> Transfer manager</p>
          <h2 className="ds-modal-title mt-2 truncate" title={effectiveTransferName}>
            {effectiveTransferName}
          </h2>
          <p className="ds-modal-sub">
            {isAllComplete ? (
              <span className="inline-flex items-center gap-1.5 font-semibold text-[#0d6b36]">
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> All {totalFiles} files uploaded.
              </span>
            ) : (
              <span>Uploading {totalFiles} file{totalFiles !== 1 ? 's' : ''} · <span className="snd-mono">{formatBytes(uploadedBytes)} of {formatBytes(totalBytes)} ({overallProgress}%)</span></span>
            )}
          </p>

          {isAllComplete && (
            <button
              type="button"
              onClick={onClose}
              className="ds-close"
              title="Close"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          {/* Overall Progress Bar */}
          <div className={`snd-manager-bar${isAllComplete ? ' is-complete' : ''}`}>
            <div className="ds-progress" aria-hidden="true">
              <i style={{ width: `${overallProgress}%` }} />
            </div>
            <div className="snd-live-meta">
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3" aria-hidden="true" /> {speedStr}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" aria-hidden="true" /> {timeRemainingStr} remaining
              </span>
            </div>
          </div>
        </div>

        {/* File Transfer List */}
        <div className="snd-manager-body">
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
                className={`snd-job${isComplete ? ' is-done' : ''}${isPaused ? ' is-paused' : ''}${isError ? ' is-error' : ''}`}
              >
                <div className="snd-job-top">
                  <span className="snd-ftile" data-kind={KIND_BY_ICON.get(Icon) || 'other'}>
                    <Icon aria-hidden="true" />
                  </span>
                  <div className="snd-file-main">
                    <div className="snd-file-name">
                      <p title={file.name}>{file.name}</p>
                    </div>
                    <div className="snd-job-state">
                      <span>{formatBytes(file.size)}</span>
                      <span aria-hidden="true">·</span>
                      {isComplete && <span className="is-ok">Uploaded</span>}
                      {isValidating && (
                        <span className="is-blue inline-flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                          <span>Checking the upload…</span>
                        </span>
                      )}
                      {isUploading && <span className="is-blue">{file.progress}% · {formatBytes(file.uploadedBytes)} / {formatBytes(file.size)}</span>}
                      {isPaused && <span className="is-warn">Paused at {file.progress}% ({formatBytes(file.uploadedBytes)})</span>}
                      {isQueued && <span>Waiting in queue…</span>}
                      {isError && <span className="is-bad">{file.error || 'Upload error'}</span>}
                    </div>
                  </div>

                  {/* Per-File Action Buttons */}
                  <div className="snd-job-actions">
                    {isValidating && (
                      <span className="ds-badge ds-badge-blue">
                        <ShieldCheck className="w-3 h-3" aria-hidden="true" />
                        Checking
                      </span>
                    )}
                    {isUploading && (
                      <>
                        <button
                          type="button"
                          onClick={() => manager.pauseFile(file.id)}
                          className="ds-btn ds-btn-ghost ds-btn-sm"
                          title="Pause Upload"
                          aria-label="Pause upload"
                        >
                          <Pause className="w-3.5 h-3.5" aria-hidden="true" />
                          <span className="hidden sm:inline">Pause</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => manager.cancelFile(file.id)}
                          className="snd-icon-btn is-danger"
                          title="Cancel Upload"
                          aria-label="Cancel upload"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    {isPaused && (
                      <>
                        <button
                          type="button"
                          onClick={() => manager.resumeFile(file.id)}
                          className="ds-btn ds-btn-dark ds-btn-sm"
                          title="Resume Upload"
                          aria-label="Resume upload"
                        >
                          <Play className="w-3.5 h-3.5" aria-hidden="true" />
                          <span className="hidden sm:inline">Resume</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => manager.cancelFile(file.id)}
                          className="snd-icon-btn is-danger"
                          title="Cancel"
                          aria-label="Cancel upload"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    {isQueued && (
                      <button
                        type="button"
                        onClick={() => manager.removeFile(file.id)}
                        className="ds-btn ds-btn-ghost ds-btn-sm"
                        title="Remove from queue"
                        aria-label="Remove from queue"
                      >
                        <X className="w-3.5 h-3.5" aria-hidden="true" />
                        <span className="hidden sm:inline">Remove</span>
                      </button>
                    )}

                    {isError && (
                      <>
                        <button
                          type="button"
                          onClick={() => manager.retryFile(file.id)}
                          className="ds-btn ds-btn-dark ds-btn-sm"
                          title="Retry Upload"
                        >
                          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Retry</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => manager.removeFile(file.id)}
                          className="snd-icon-btn is-danger"
                          aria-label="Remove file"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    {isComplete && (
                      <span className="ds-icon is-green is-sm rounded-full" aria-hidden="true">
                        <Check />
                      </span>
                    )}
                  </div>
                </div>

                {/* Per-File Progress Bar & Speed */}
                {!isComplete && !isQueued && (
                  <div className="grid gap-1">
                    <div className="ds-progress" aria-hidden="true">
                      <i style={{ width: `${file.progress}%` }} />
                    </div>
                    <div className="snd-live-meta">
                      <span>{file.speedStr}</span>
                      <span>ETA: {file.timeRemainingStr}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Share link card when complete */}
        {isAllComplete && (
          <div className="snd-ready">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#0d6b36]">
                <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                Transfer complete. The link is ready.
              </span>
              <span className="snd-mono text-xs text-[#0d6b36]">{totalFiles} {totalFiles === 1 ? 'file' : 'files'} ({formatBytes(totalBytes)})</span>
            </div>

            <div className="snd-link">
              <div className="snd-link-field">
                <input
                  type="text"
                  readOnly
                  value={effectiveShareUrl}
                  aria-label="Download link"
                  className="ds-input bg-white"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(effectiveShareUrl);
                    if (onCopyLink) onCopyLink();
                  }}
                  className={`ds-btn ds-btn-dark snd-copy flex-1${copied ? ' is-copied' : ''}`}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Copied' : 'Copy link'}</span>
                </button>
                <a
                  href={effectiveShareUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ds-btn ds-btn-ghost min-h-12"
                  title="Open Download Page"
                  aria-label="Open download page"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="snd-manager-foot">

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
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="ds-btn ds-btn-ghost border-dashed"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Add more files</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div>
            {isAllComplete ? (
              <button
                type="button"
                onClick={onClose}
                className="ds-btn ds-btn-dark"
              >
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                <span>Done, view the transfer</span>
              </button>
            ) : (
              <>
                {onCancelAndEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      manager.cancelAll();
                      onCancelAndEdit();
                    }}
                    className="ds-btn ds-btn-danger"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                    <span>Cancel and edit files</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="ds-btn ds-btn-ghost"
                >
                  Run in background
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
