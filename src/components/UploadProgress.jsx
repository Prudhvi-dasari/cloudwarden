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

  const barPercent = isComplete || isConfirming ? 100 : safeProgress;
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

  const [liveMessage, setLiveMessage] = useState('');
  const liveKey = useRef('');

  useEffect(() => {
    const mark = isComplete || isError || isConfirming || isPaused
      ? statusLabel
      : `${statusLabel} ${Math.floor(safeProgress / 10) * 10}`;
    const next = `${mark}. ${statusHint}`;
    if (liveKey.current === next) return;
    liveKey.current = next;
    setLiveMessage(next);
  }, [statusLabel, statusHint, safeProgress, isComplete, isError, isConfirming, isPaused]);

  return (
    <div className={`snd-progress${isComplete ? ' is-complete' : ''}${isError ? ' is-error' : ''}${isPaused ? ' is-paused' : ''}${reduceMotion ? ' is-reduced' : ''}`}>
      <p className="sr-only" role="status" aria-live="polite">{liveMessage}</p>
      {/* Route strip: the parcel travels along the path as % climbs */}
      <div className="snd-route" aria-hidden="true">
        <svg viewBox="0 0 400 120" preserveAspectRatio="xMidYMid meet">
          <path ref={pathRef} id={`sendpath-${pathId}`} d={PATH_D} className="snd-route-path" />
          <circle cx="28" cy="78" r="5" className="snd-route-start" />
          <circle cx="372" cy="68" r="8" className="snd-route-ring" />
          <circle cx="372" cy="68" r="3.5" className="snd-route-end" />

          <g
            className="snd-route-parcel"
            style={{
              transform: `translate(${parcel.x}px, ${parcel.y}px) rotate(${parcel.angle}deg)`,
            }}
          >
            <g transform="translate(-18 -12)">
              <rect width="36" height="24" rx="5" strokeWidth="1" />
              <path d="M24 0 L24 10 L36 10" className="flap" />
              <path d="M7 13 H22" className="line" strokeWidth="1.8" strokeLinecap="round" />
            </g>
          </g>
        </svg>

        <div className="snd-route-pins">
          <span>You</span>
          <span>Link arrives</span>
        </div>
      </div>

      <div className="snd-progress-top">
        <div className="min-w-0 flex-1">
          <p className="snd-status">
            <span className="snd-status-dot" />
            {statusLabel}
          </p>
          <h3 className="snd-progress-name" title={fileName || 'Your file'}>
            <FileText className="w-4 h-4" aria-hidden="true" />
            <span>{fileName || 'Your file'}</span>
          </h3>
        </div>

        <div aria-hidden="true">
          {isComplete ? (
            <span className="snd-pct is-ok"><CheckCircle2 /></span>
          ) : isError ? (
            <span className="snd-pct is-bad"><AlertCircle /></span>
          ) : (!speedKnown && safeProgress === 0 && !isPaused) ? (
            <span className="snd-pct">…</span>
          ) : (
            <span className="snd-pct">
              {Math.round(safeProgress)}
              <small>%</small>
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-2">
        <div className="ds-progress" aria-hidden="true">
          <i style={{ width: `${barPercent}%` }} />
        </div>
        <p className="snd-progress-hint">{statusHint}</p>
      </div>

      {isOffline && (
        <div className="ds-alert is-warn">
          <WifiOff className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Connection dropped. It resumes when you are back online.</span>
        </div>
      )}

      {!isComplete && !isError && (
        <div className="snd-stats">
          <div className="snd-stat">
            <p>
              <Zap className="w-3 h-3" aria-hidden="true" /> Speed
            </p>
            <strong>{isPaused ? 'Paused' : speedKnown ? uploadSpeed : 'Calculating…'}</strong>
          </div>
          <div className="snd-stat">
            <p>
              <Clock className="w-3 h-3" aria-hidden="true" /> Left
            </p>
            <strong>{isPaused ? 'Waiting' : etaKnown ? timeRemaining : 'Calculating…'}</strong>
          </div>
        </div>
      )}

      {!isComplete && (
        <div className="snd-actions">
          {onRunInBackground && !isError && (
            <button type="button" onClick={onRunInBackground} className="ds-btn ds-btn-ghost ds-btn-sm snd-grow">
              <PlusCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              Send another while this finishes
            </button>
          )}
          {isError && onRetry && (
            <button type="button" onClick={onRetry} className="ds-btn ds-btn-dark ds-btn-sm snd-grow">
              Try again
            </button>
          )}
          {!isError && !isConfirming && onPause && (
            <button type="button" onClick={onPause} className="ds-btn ds-btn-ghost ds-btn-sm">
              {isPaused ? 'Resume' : 'Pause'}
            </button>
          )}
          {onCancel && (
            <button type="button" onClick={onCancel} className="ds-btn ds-btn-ghost ds-btn-sm snd-cancel">
              <X className="w-4 h-4" aria-hidden="true" />
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}
