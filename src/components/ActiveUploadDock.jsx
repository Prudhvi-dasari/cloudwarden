import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { activeUploadRunning, subscribeActiveUpload } from '../lib/activeUpload';

/**
 * Compact progress that stays on screen when the send page is not.
 * It uses the same progress meter as the upload card.
 */
export default function ActiveUploadDock() {
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState({ snapshot: null, result: null });

  useEffect(() => subscribeActiveUpload(setState), []);

  const snap = state.snapshot;
  const onSendPage = location.pathname === '/' || location.pathname === '/transfers';
  const running = activeUploadRunning() && snap && snap.overallStatus !== 'complete';
  if (onSendPage) return null;
  if (!running && state.result?.shareId) {
    return (
      <div className="fixed bottom-4 left-1/2 z-40 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2">
        <div className="snd-live shadow-lg">
          <div className="snd-live-row">
            <span>Your link is ready</span>
            <span>Done</span>
          </div>
          <button type="button" className="ds-btn ds-btn-dark ds-btn-sm" onClick={() => navigate('/')}>
            Open the link
          </button>
        </div>
      </div>
    );
  }
  if (!running) return null;

  const percent = Math.max(0, Math.min(100, snap.overallProgress || 0));
  const paused = snap.overallStatus === 'paused';
  const failed = snap.overallStatus === 'error';
  const label = failed ? 'Upload stopped' : paused ? 'Upload paused' : 'Uploading';

  return (
    <div className="fixed bottom-4 left-1/2 z-40 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2">
      <div className="snd-live shadow-lg">
        <div className="snd-live-row">
          <span>{label}{snap.activeFileName ? ` · ${snap.activeFileName}` : ''}</span>
          <span>{percent}%</span>
        </div>
        <div className="ds-progress" aria-hidden="true">
          <i style={{ width: `${percent}%` }} />
        </div>
        <button
          type="button"
          className="ds-btn ds-btn-dark ds-btn-sm"
          onClick={() => navigate('/')}
        >
          Back to upload
        </button>
      </div>
    </div>
  );
}
