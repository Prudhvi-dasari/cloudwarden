import { useState } from 'react';
import {
  CheckCircle2, AlertCircle, Zap, Clock, ChevronUp, ChevronDown,
  Copy, Check, PlusCircle, ExternalLink, X
} from 'lucide-react';
import { useToast } from './Toast';

export default function FloatingUploadDock({
  activeUploads = [],
  onStartAnother,
  onDismissUpload,
}) {
  const { addToast } = useToast();
  const [isExpanded, setIsExpanded] = useState(true);
  const [copiedId, setCopiedId] = useState(null);

  if (!activeUploads || activeUploads.length === 0) return null;

  const handleCopyLink = (shareId) => {
    const url = `${window.location.origin}/download/${shareId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(shareId);
    addToast('Link copied.', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const currentUpload = activeUploads[0];
  const isUploading = currentUpload.status === 'uploading';
  const isComplete = currentUpload.status === 'complete';
  const isError = currentUpload.status === 'error';

  return (
    <div className="fixed bottom-4 right-4 sm:right-6 z-40 max-w-md w-[calc(100vw-2rem)] sm:w-96">
      <div className="snd-dock">

        {/* Header Bar */}
        <div className="snd-dock-head">
          <span>
            {isUploading && <span className="ds-spinner shrink-0 text-[var(--ds-accent)]" aria-hidden="true" />}
            {isComplete && <CheckCircle2 className="w-4 h-4 shrink-0 text-[var(--ds-green)]" aria-hidden="true" />}
            {isError && <AlertCircle className="w-4 h-4 shrink-0 text-[#b42318]" aria-hidden="true" />}

            <span>
              {isUploading ? `Uploading: ${currentUpload.fileName || 'Files…'}` : isComplete ? 'Upload finished' : 'Upload failed'}
            </span>
          </span>

          <span className="flex items-center">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? 'Collapse upload details' : 'Expand upload details'}
              className="snd-icon-btn"
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => onDismissUpload(currentUpload.id)}
              aria-label="Dismiss"
              className="snd-icon-btn"
            >
              <X className="w-4 h-4" />
            </button>
          </span>
        </div>

        {/* Expandable Body */}
        {isExpanded && (
          <div className="snd-dock-body">

            {/* Progress Bar & Percentage */}
            {isUploading && (
              <div className="snd-live p-0 border-0">
                <div className="snd-live-row">
                  <span title={currentUpload.fileName}>{currentUpload.fileName}</span>
                  <span>{Math.round(currentUpload.progress || 0)}%</span>
                </div>

                <div className="ds-progress" aria-hidden="true">
                  <i style={{ width: `${currentUpload.progress || 0}%` }} />
                </div>

                <div className="snd-live-meta">
                  <span className="flex items-center gap-1">
                    <Zap className="w-3 h-3" aria-hidden="true" /> {currentUpload.speed || '-- MB/s'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" aria-hidden="true" /> {currentUpload.timeRemaining || '--:--'}
                  </span>
                </div>
              </div>
            )}

            {/* Completed Share State */}
            {isComplete && currentUpload.shareId && (
              <div className="ds-alert is-success grid gap-2">
                <p>Your link is ready.</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyLink(currentUpload.shareId)}
                    className={`ds-btn ds-btn-dark ds-btn-sm flex-1 snd-copy${copiedId === currentUpload.shareId ? ' is-copied' : ''}`}
                  >
                    {copiedId === currentUpload.shareId ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedId === currentUpload.shareId ? 'Copied' : 'Copy link'}
                  </button>

                  <a
                    href={`${window.location.origin}/download/${currentUpload.shareId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="ds-btn ds-btn-ghost ds-btn-sm"
                    title="Open download page"
                    aria-label="Open download page"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            )}

            {/* Upload Another Button */}
            <div className="snd-dock-foot">
              <span>Keep going while it runs</span>
              <button
                type="button"
                onClick={onStartAnother}
                className="ds-btn ds-btn-ghost ds-btn-sm"
              >
                <PlusCircle className="w-3.5 h-3.5" aria-hidden="true" /> Send another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
