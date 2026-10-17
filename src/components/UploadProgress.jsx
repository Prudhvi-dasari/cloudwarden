import { CheckCircle2, AlertCircle, Zap, Clock, Pause, Play, WifiOff, RefreshCw, PlusCircle, Minimize2, Sparkles, Server, Cpu, X } from 'lucide-react';

export default function UploadProgress({
  progress,
  fileName,
  uploadSpeed,
  timeRemaining,
  status,
  isPaused,
  isOffline,
  telemetry,
  onPause,
  onResume,
  onRunInBackground,
  onCancel,
}) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  const isComplete = status === 'complete';
  const isError = status === 'error';

  return (
    <div className="flex flex-col items-center text-center p-5 sm:p-8 animate-scale-in">
      
      {/* Turbo Acceleration Active Pill Badge */}
      {!isComplete && !isError && (
        <div className="mb-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-amber-500/10 border border-indigo-200 text-indigo-700 text-[11px] font-bold shadow-2xs">
          <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-400 animate-pulse" />
          <span>TurboBandwidth™ Acceleration Engine Active</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
        </div>
      )}

      {/* Offline Warning Alert */}
      {isOffline && (
        <div className="w-full max-w-sm mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-bold flex items-center justify-center gap-2 animate-pulse">
          <WifiOff className="w-4 h-4 text-amber-600" />
          <span>Connection lost! Upload paused. Waiting to auto-resume...</span>
        </div>
      )}

      {/* Circular Ring */}
      <div className="relative flex items-center justify-center mb-5">
        <svg className="w-32 h-32 sm:w-36 sm:h-36 transform -rotate-90">
          <circle
            className="text-slate-100"
            strokeWidth="8"
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx="64"
            cy="64"
          />
          <circle
            className={`transition-all duration-300 ease-out ${
              isError ? 'text-rose-500' : isPaused ? 'text-amber-500' : 'theme-text'
            }`}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx="64"
            cy="64"
          />
        </svg>

        <div className="absolute flex flex-col items-center justify-center">
          {isComplete ? (
            <CheckCircle2 className="w-12 h-12 text-emerald-500 animate-scale-in" />
          ) : isError ? (
            <AlertCircle className="w-12 h-12 text-rose-500 animate-scale-in" />
          ) : isPaused ? (
            <span className="text-sm font-black text-amber-600 uppercase tracking-wider">Paused</span>
          ) : (
            <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {Math.round(progress)}%
            </span>
          )}
        </div>
      </div>

      {/* File Info */}
      <div className="w-full max-w-sm space-y-3">
        <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate mb-1">{fileName}</h3>
        
        {isComplete ? (
          <p className="text-xs sm:text-sm font-bold text-emerald-600 mt-1">Files uploaded successfully to Cloud Vault!</p>
        ) : isError ? (
          <p className="text-xs sm:text-sm font-bold text-rose-600 mt-1">Upload failed. Please retry.</p>
        ) : progress >= 100 ? (
          <p className="text-xs sm:text-sm font-black text-indigo-600 mt-1 flex items-center justify-center gap-1.5 animate-pulse">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <span>100% • Validating file integrity & securing in Cloud Vault...</span>
          </p>
        ) : (
          <>
            {/* Linear Bar with Shimmer */}
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden my-2.5 border border-slate-200 animate-shimmer">
              <div
                className={`h-full transition-all duration-300 ease-out ${
                  isPaused ? 'bg-amber-500' : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-400'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Metrics Bar */}
            <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-600 mb-3">
              <div className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="font-bold text-slate-900">{isPaused ? 'Paused' : uploadSpeed || '-- MB/s'}</span>
              </div>
              <div className="flex items-center gap-1.5 justify-end">
                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{isPaused ? 'Waiting' : timeRemaining || 'Estimating...'}</span>
              </div>
            </div>

            {/* Real-time Hardware Telemetry Bar */}
            {telemetry && (
              <div className="flex items-center justify-between px-1 text-[11px] font-bold text-slate-400">
                <span className="flex items-center gap-1 text-indigo-600">
                  <Server className="w-3 h-3" />
                  {telemetry.isDirect ? 'Direct 0-Hop Edge' : 'Proxy Accelerated'}
                </span>
                <span>
                  📦 {telemetry.chunkSizeMB || '16'}MB Dynamic Chunk
                </span>
              </div>
            )}

            {/* Action Buttons: Background Multitask & Cancel Transfer */}
            <div className="flex flex-col gap-2 mt-3 w-full">
              {onRunInBackground && !isComplete && !isError && (
                <button
                  type="button"
                  onClick={onRunInBackground}
                  className="w-full py-2.5 px-4 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-2xs active:scale-98 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4 text-indigo-600" /> Upload Another File in Background
                </button>
              )}

              {onCancel && !isComplete && !isError && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="w-full py-2.5 px-4 bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-600 hover:text-rose-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-2xs active:scale-98 cursor-pointer"
                >
                  <X className="w-4 h-4 text-rose-500" /> Cancel Transfer & Edit Files
                </button>
              )}
            </div>
          </>
        )}
      </div>

    </div>
  );
}
