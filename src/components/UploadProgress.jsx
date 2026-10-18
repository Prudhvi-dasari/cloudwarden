import { useEffect, useId, useRef, useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Zap,
  Clock,
  WifiOff,
  PlusCircle,
  X,
  FileText,
} from 'lucide-react';

const PATH_D = 'M 28 78 C 90 40, 150 110, 220 72 C 280 40, 330 55, 372 68';

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    onChange();
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  return reduced;
}

export default function UploadProgress({
  progress,
  fileName,
  uploadSpeed,
  timeRemaining,
  status,
  isPaused,
  isOffline,
  onRunInBackground,
  onCancel,
  onPause,
  onRetry,
}) {
  const safeProgress = Math.max(0, Math.min(100, progress || 0));
  const isComplete = status === 'complete';
  const isConfirming = status === 'confirming';
  const isError = status === 'error';
  const reduceMotion = usePrefersReducedMotion();
  const pathRef = useRef(null);
  const pathId = useId().replace(/:/g, '');
  const [parcel, setParcel] = useState({ x: 40, y: 78, angle: 0 });

  const t = isComplete || isConfirming ? 1 : Math.max(0, Math.min(1, safeProgress / 100));

  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const len = path.getTotalLength();
    const pt = path.getPointAtLength(len * t);
    const ahead = path.getPointAtLength(Math.min(len, len * t + 10));
    const angle = (Math.atan2(ahead.y - pt.y, ahead.x - pt.x) * 180) / Math.PI;
    setParcel({ x: pt.x, y: pt.y, angle });
  }, [t]);

  const ringR = 54;
  const ringC = 2 * Math.PI * ringR;
  const ringOffset = ringC - (ringC * (isComplete || isConfirming ? 100 : safeProgress)) / 100;
  const speedKnown = Boolean(uploadSpeed);
  const etaKnown = Boolean(timeRemaining);

  const statusLabel = isComplete ? 'Link ready' : isConfirming ? 'Saving the link' : isError ? 'Stopped' : isPaused ? 'Paused' : 'Sending';
  const statusHint = isComplete
    ? 'Your download link is on this page.'
    : isConfirming
      ? 'The upload finished. Waiting until the link is saved.'
      : isError
        ? (safeProgress >= 100
          ? 'The files uploaded, but the link was not saved.'
          : 'This send did not finish. You can try again.')
        : isPaused
          ? 'Paused on the bytes already sent.'
          : 'Your file is leaving. The link appears in this card.';

  return (
    <div className={`send-progress ${isComplete ? 'is-complete' : ''} ${isError ? 'is-error' : ''} ${isPaused ? 'is-paused' : ''} ${reduceMotion ? 'is-reduced' : ''}`}>
      {/* Theater: file flies along the path as % climbs */}
      <div className="send-progress-stage" aria-hidden="true">
        <div className="send-progress-glow" />
        <div className="send-progress-radar" />

        <svg className="send-progress-map" viewBox="0 0 400 120" preserveAspectRatio="xMidYMid meet">
          <path
            ref={pathRef}
            id={`sendpath-${pathId}`}
            d={PATH_D}
            fill="none"
            stroke="rgba(255,255,255,0.28)"
            strokeWidth="2.5"
            strokeDasharray="2 12"
            strokeLinecap="round"
          />
          <circle cx="28" cy="78" r="5" fill="rgba(255,255,255,0.55)" />
          <circle cx="372" cy="68" r="7" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" />
          <circle cx="372" cy="68" r="3.5" fill="#ffffff" />

          <g
            className="send-progress-parcel"
            style={{
              transform: `translate(${parcel.x}px, ${parcel.y}px) rotate(${parcel.angle}deg)`,
            }}
          >
            <g transform="translate(-18 -12)">
              <rect width="36" height="24" rx="5" fill="#fff" />
              <path d="M24 0 L24 10 L36 10" fill="#ffe7c2" />
              <path d="M24 0 L36 10" fill="none" stroke="#f0b56a" strokeWidth="1.2" />
              <path d="M7 13 H22" stroke="#1c1917" strokeWidth="1.6" strokeLinecap="round" opacity="0.25" />
            </g>
          </g>
        </svg>

        <div className="send-progress-pins">
          <span>You</span>
          <span>Link arrives</span>
        </div>
      </div>

      <div className="send-progress-body">
        <div className="send-progress-top">
          <div className="min-w-0 flex-1">
            <p className="send-progress-kicker">
              <span className="send-progress-pulse" />
              {statusLabel}
            </p>
            <h3 className="send-progress-title" title={fileName || 'Your file'}>
              <FileText className="w-4 h-4 shrink-0 opacity-40" />
              <span className="truncate">{fileName || 'Your file'}</span>
            </h3>
            <p className="send-progress-hint">{statusHint}</p>
          </div>

          <div className="send-progress-ring-wrap" aria-hidden="true">
            <svg className="send-progress-ring" viewBox="0 0 128 128">
              <circle cx="64" cy="64" r={ringR} className="send-progress-ring-track" />
              <circle
                cx="64"
                cy="64"
                r={ringR}
                className={`send-progress-ring-value ${isError ? 'is-error' : ''} ${isPaused ? 'is-paused' : ''}`}
                style={{
                  strokeDasharray: ringC,
                  strokeDashoffset: isError ? ringC : ringOffset,
                }}
              />
            </svg>
            <div className="send-progress-ring-label">
              {isComplete ? (
                <CheckCircle2 className="w-7 h-7 text-emerald-500" />
              ) : isError ? (
                <AlertCircle className="w-7 h-7 text-rose-500" />
              ) : (!speedKnown && safeProgress === 0 && !isPaused) ? (
                <span className="send-progress-pct">…</span>
              ) : (
                <span className="send-progress-pct">
                  <span className="tabular-nums">{Math.round(safeProgress)}</span>
                  <small>%</small>
                </span>
              )}
            </div>
          </div>
        </div>

        {isOffline && (
          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
            <WifiOff className="w-4 h-4 shrink-0" />
            Connection dropped. It resumes when you are back online.
          </div>
        )}

        {!isComplete && !isError && (
          <div className="send-progress-stats">
            <div className="send-progress-stat">
              <p>
                <Zap className="w-3.5 h-3.5" /> Speed
              </p>
              <strong>{isPaused ? 'Paused' : speedKnown ? uploadSpeed : 'Calculating'}</strong>
            </div>
            <div className="send-progress-stat">
              <p>
                <Clock className="w-3.5 h-3.5" /> Left
              </p>
              <strong>{isPaused ? 'Waiting' : etaKnown ? timeRemaining : 'Calculating'}</strong>
            </div>
          </div>
        )}

        {!isComplete && (
          <div className="send-progress-actions">
            {onRunInBackground && !isError && (
              <button type="button" onClick={onRunInBackground} className="send-progress-btn-secondary">
                <PlusCircle className="w-4 h-4" />
                Send another while this finishes
              </button>
            )}
            {isError && onRetry && (
              <button type="button" onClick={onRetry} className="send-progress-btn-secondary">
                Try again
              </button>
            )}
            {!isError && !isConfirming && onPause && (
              <button type="button" onClick={onPause} className="send-progress-btn-cancel">
                {isPaused ? 'Resume' : 'Pause'}
              </button>
            )}
            {onCancel && (
              <button type="button" onClick={onCancel} className="send-progress-btn-cancel">
                <X className="w-4 h-4" />
                Cancel
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
