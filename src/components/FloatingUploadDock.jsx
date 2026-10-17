import { useState } from 'react';
import {
  CheckCircle2, AlertCircle, Zap, Clock, ChevronUp, ChevronDown,
  Copy, Check, PlusCircle, ExternalLink, X, Loader2
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
    addToast('Download link copied! 📋', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const currentUpload = activeUploads[0];
  const isUploading = currentUpload.status === 'uploading';
  const isComplete = currentUpload.status === 'complete';
  const isError = currentUpload.status === 'error';

  return (
    <div className="fixed bottom-4 right-4 sm:right-6 z-40 max-w-md w-[calc(100vw-2rem)] sm:w-96 animate-slide-in-right">
      <div className="bg-white/95 backdrop-blur-xl border border-slate-200/90 shadow-2xl rounded-2xl overflow-hidden shadow-indigo-500/10">
        
        {/* Header Bar */}
        <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            {isUploading && <Loader2 className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />}
            {isComplete && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
            {isError && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}

            <span className="text-xs font-bold truncate">
              {isUploading ? `Uploading: ${currentUpload.fileName || 'Files...'}` : isComplete ? 'Upload Finished! 🎉' : 'Upload Failed'}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
            <button
              onClick={() => onDismissUpload(currentUpload.id)}
              className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Expandable Body */}
        {isExpanded && (
          <div className="p-4 space-y-3 bg-white">
            
            {/* Progress Bar & Percentage */}
            {isUploading && (
              <>
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span className="truncate pr-2">{currentUpload.fileName}</span>
                  <span className="text-indigo-600 shrink-0">{Math.round(currentUpload.progress || 0)}%</span>
                </div>

                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                  <div
                    className="h-full theme-btn-primary transition-all duration-300 ease-out"
                    style={{ width: `${currentUpload.progress || 0}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                  <span className="flex items-center gap-1">
                    <Zap className="w-3 h-3 theme-text" /> {currentUpload.speed || '-- MB/s'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" /> {currentUpload.timeRemaining || '--:--'}
                  </span>
                </div>
              </>
            )}

            {/* Completed Share State */}
            {isComplete && currentUpload.shareId && (
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200/80 space-y-2 animate-fadeIn">
                <p className="text-xs font-bold text-emerald-900">Your files are ready in 5TB Cloud Vault!</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopyLink(currentUpload.shareId)}
                    className="flex-1 py-1.5 px-3 rounded-lg theme-btn-primary text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    {copiedId === currentUpload.shareId ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedId === currentUpload.shareId ? 'Copied Link!' : 'Copy Link'}
                  </button>

                  <a
                    href={`${window.location.origin}/download/${currentUpload.shareId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                    title="Open download page"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            )}

            {/* Upload Another Button */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-medium">Continue using app:</span>
              <button
                onClick={onStartAnother}
                className="px-3 py-1 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
              >
                <PlusCircle className="w-3.5 h-3.5" /> Upload Another File
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
