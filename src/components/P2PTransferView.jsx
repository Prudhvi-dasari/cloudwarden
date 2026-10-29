import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { P2PSender, P2PReceiver } from '../lib/p2p';
import DropZone from './DropZone';
import FileList from './FileList';
import { Wifi, ShieldCheck, CheckCircle2, AlertCircle, Loader2, Download, Send, Copy, Check, Smartphone, Laptop, Plus, Monitor, Trash2 } from 'lucide-react';

function resolvePeerCodeFromSearch(searchParams, initialRoom) {
  const room = initialRoom || searchParams.get('room') || '';
  const p2p = searchParams.get('p2p') || '';
  // Ignore boolean flags like p2p=true — only accept real pairing codes
  if (room && room !== 'true') return room.trim().toUpperCase();
  if (p2p && p2p !== 'true') return p2p.trim().toUpperCase();
  return '';
}

export default function P2PTransferView({ initialRoom, preferredCode } = {}) {
  const [searchParams] = useSearchParams();
  const initialCodeFromUrl = resolvePeerCodeFromSearch(searchParams, initialRoom);

  const [p2pRole, setP2pRole] = useState(initialCodeFromUrl ? 'receive' : 'send');
  const [files, setFiles] = useState([]);
  const [p2pCode, setP2pCode] = useState(preferredCode || '');
  const [inputCode, setInputCode] = useState(initialCodeFromUrl);
  const [status, setStatus] = useState({ state: 'IDLE' });
  const [progress, setProgress] = useState(null);
  const [receivedFiles, setReceivedFiles] = useState([]);
  const [copiedCode, setCopiedCode] = useState(false);

  // Saved / Paired Devices State
  const [savedDevices, setSavedDevices] = useState(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem('itransfer_paired_devices') || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [newDeviceName, setNewDeviceName] = useState('');
  const [showAddDevice, setShowAddDevice] = useState(false);

  const senderRef = useRef(null);
  const receiverRef = useRef(null);

  // Auto-connect if p2p query param is in URL
  useEffect(() => {
    if (initialCodeFromUrl && p2pRole === 'receive') {
      setInputCode(initialCodeFromUrl);
      setTimeout(() => {
        handleConnectReceiver();
      }, 500);
    }
  }, [initialCodeFromUrl]);

  // Init P2P Sender Code
  useEffect(() => {
    if (p2pRole === 'send' && !senderRef.current) {
      const sender = new P2PSender(
        (statusUpdate) => {
          setStatus(statusUpdate);
          if (statusUpdate.code) setP2pCode(statusUpdate.code);
        },
        (progressUpdate) => setProgress(progressUpdate),
        preferredCode || null
      );
      sender.init();
      senderRef.current = sender;
    }

    return () => {
      if (senderRef.current) {
        senderRef.current.destroy();
        senderRef.current = null;
      }
      if (receiverRef.current) {
        receiverRef.current.destroy();
        receiverRef.current = null;
      }
    };
  }, [p2pRole]);

  function handleStartSenderTransfer() {
    if (!senderRef.current || files.length === 0) return;
    setStatus({ state: 'TRANSFERRING' });
    senderRef.current.sendFiles(files).catch((err) => {
      setStatus({ state: 'ERROR', message: err.message || 'Transfer failed' });
    });
  }

  function handleConnectReceiver(e) {
    if (e) e.preventDefault();
    const targetCode = (inputCode || '').trim();
    if (!targetCode || targetCode.length < 5) {
      alert('Please enter a valid transfer code (e.g. AIR-7K92)');
      return;
    }

    if (receiverRef.current) receiverRef.current.destroy();

    const receiver = new P2PReceiver(
      targetCode,
      (statusUpdate) => setStatus(statusUpdate),
      (progressUpdate) => setProgress(progressUpdate),
      (completedFiles) => setReceivedFiles(completedFiles)
    );
    receiver.connect();
    receiverRef.current = receiver;
  }

  function handleCopyCode() {
    if (!p2pCode) return;
    navigator.clipboard.writeText(p2pCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }

  function handleSaveCurrentDevice() {
    if (!newDeviceName.trim() || !p2pCode) return;
    const updated = [...savedDevices, { id: Date.now(), name: newDeviceName.trim(), code: p2pCode, date: new Date().toLocaleDateString() }];
    setSavedDevices(updated);
    localStorage.setItem('itransfer_paired_devices', JSON.stringify(updated));
    setNewDeviceName('');
    setShowAddDevice(false);
  }

  function handleRemoveSavedDevice(id) {
    const updated = savedDevices.filter(d => d.id !== id);
    setSavedDevices(updated);
    localStorage.setItem('itransfer_paired_devices', JSON.stringify(updated));
  }

  const qrApiUrl = p2pCode
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${window.location.origin}/?p2p=${p2pCode}`)}`
    : '';

  return (
    <div className="snd-device">
      <p className="ds-callout is-blue">
        <Wifi aria-hidden="true" />
        <span>Both screens stay open, on the same network. The file goes directly between them and is not stored here.</span>
      </p>

      {/* P2P Role Switcher */}
      <div className="ds-tabs snd-role" role="group" aria-label="Send or receive">
        <button
          type="button"
          onClick={() => { setP2pRole('send'); setStatus({ state: 'IDLE' }); }}
          aria-pressed={p2pRole === 'send'}
          className="ds-tab"
        >
          <Send className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Send to device</span>
        </button>

        <button
          type="button"
          onClick={() => { setP2pRole('receive'); setStatus({ state: 'IDLE' }); }}
          aria-pressed={p2pRole === 'receive'}
          className="ds-tab"
        >
          <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Receive here</span>
        </button>
      </div>

      {/* SENDER FLOW */}
      {p2pRole === 'send' && (
        <div className="snd-step">

          {/* Step 1: Pair Code & QR Code display */}
          <div className="snd-panel">
            <p className="ds-kicker"><b>01</b> Open this page on the other device</p>
            <h3 className="snd-step-title">Scan the QR code or type the pair code</h3>

            <div className="snd-pair mt-4">
              {/* QR Code */}
              <div className="snd-qr-tile">
                <div>
                  {qrApiUrl ? (
                    <img src={qrApiUrl} alt="QR code to pair the other device" />
                  ) : (
                    <Loader2 className="w-6 h-6 animate-spin text-[var(--ds-accent)]" aria-hidden="true" />
                  )}
                </div>
                {qrApiUrl && (
                  <small>
                    <Smartphone className="w-3 h-3" aria-hidden="true" /> Scan with a phone camera
                  </small>
                )}
              </div>

              {/* Code Box */}
              <div className="snd-code-wrap">
                <span>Or enter this 6-character code:</span>
                <div className="snd-code-row">
                  <span className="sr-only">{p2pCode || 'Creating a code…'}</span>
                  <span className="snd-code" aria-hidden="true">
                    {p2pCode
                      ? p2pCode.split('').map((ch, i) => (
                        <i key={`${ch}-${i}`} className={ch === '-' ? 'is-dash' : ''} style={{ '--i': i }}>{ch}</i>
                      ))
                      : [0, 1, 2].map((i) => <i key={i} className="is-empty">·</i>)}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="ds-btn ds-btn-ghost snd-icon-btn p-0"
                    title="Copy Code"
                    aria-label={copiedCode ? 'Code copied' : 'Copy code'}
                  >
                    {copiedCode ? <Check className="w-4 h-4 text-[var(--ds-green)]" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                {/* Connection Status Badge */}
                <div>
                  {status.state === 'WAITING' && (
                    <span className="snd-chip is-wait">
                      <span className="snd-chip-dot" aria-hidden="true" />
                      Waiting for the receiver to connect…
                    </span>
                  )}
                  {status.state === 'CONNECTED' && (
                    <span className="snd-chip is-ok">
                      <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      {status.connectionType || 'Connected directly'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Optional Saved Devices Section */}
          <div className="snd-panel snd-devices">
            <div className="snd-devices-head">
              <span>
                <Laptop aria-hidden="true" /> My paired devices ({savedDevices.length})
              </span>
              <button
                type="button"
                onClick={() => setShowAddDevice(!showAddDevice)}
                aria-expanded={showAddDevice}
                className="ds-btn ds-btn-ghost ds-btn-sm"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Save device
              </button>
            </div>

            {showAddDevice && (
              <div className="snd-device-form">
                <input
                  type="text"
                  value={newDeviceName}
                  onChange={(e) => setNewDeviceName(e.target.value)}
                  placeholder="Device name (e.g. MacBook Pro, iPad)"
                  aria-label="Device name"
                  className="ds-input"
                />
                <button
                  type="button"
                  onClick={handleSaveCurrentDevice}
                  className="ds-btn ds-btn-dark"
                >
                  Save
                </button>
              </div>
            )}

            {savedDevices.length > 0 && (
              <div className="snd-device-list">
                {savedDevices.map((dev) => (
                  <div key={dev.id} className="snd-device-item">
                    <Monitor aria-hidden="true" />
                    <span>{dev.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSavedDevice(dev.id)}
                      className="snd-icon-btn is-danger"
                      aria-label={`Remove ${dev.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Step 2: Select Files */}
          <div className="snd-step">
            <p className="ds-kicker"><b>02</b> Choose the files to send</p>

            {files.length === 0 ? (
              <DropZone onFilesSelected={(f) => setFiles(prev => [...prev, ...f])} />
            ) : (
              <div className="snd-step">
                <FileList
                  files={files}
                  onRemoveFile={(idx) => setFiles(prev => prev.filter((_, i) => i !== idx))}
                  onFilesAdded={(f) => setFiles(prev => [...prev, ...f])}
                />

                {/* Progress UI */}
                {progress && status.state === 'TRANSFERRING' && (
                  <div className="snd-live">
                    <div className="snd-live-row">
                      <span title={progress.currentFile}>Sending: {progress.currentFile}</span>
                      <span>{progress.progress}%</span>
                    </div>
                    <div className="ds-progress" aria-hidden="true">
                      <i style={{ width: `${progress.progress}%` }} />
                    </div>
                    <div className="snd-live-meta">
                      <span>Speed: {progress.speed}</span>
                      <span>ETA: {progress.timeRemaining}</span>
                    </div>
                  </div>
                )}

                {status.state === 'COMPLETED' && (
                  <p className="ds-alert is-success">
                    <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Direct transfer complete.</span>
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleStartSenderTransfer}
                  disabled={status.state !== 'CONNECTED'}
                  className="ds-btn ds-btn-dark ds-btn-lg snd-go"
                >
                  <Send className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>
                    {status.state === 'CONNECTED'
                      ? `Send ${files.length} file${files.length !== 1 ? 's' : ''} directly to the receiver`
                      : 'Pair with the receiving device first'}
                  </span>
                </button>
              </div>
            )}
          </div>

        </div>
      )}

      {/* RECEIVER FLOW */}
      {p2pRole === 'receive' && (
        <div className="snd-step">
          <form onSubmit={handleConnectReceiver} className="snd-panel snd-receive">
            <span className="ds-icon is-blue" aria-hidden="true">
              <Download />
            </span>
            <h3 className="snd-step-title">Enter the pair code</h3>
            <p>
              Type the 6-character code shown on the sending device. The file comes straight across to this screen.
            </p>

            <input
              type="text"
              required
              maxLength={8}
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              placeholder="K7P-92X"
              aria-label="Pair code"
              autoComplete="off"
              spellCheck={false}
              className="ds-input snd-code-input"
            />

            <button type="submit" className="ds-btn ds-btn-dark">
              <Wifi className="w-4 h-4" aria-hidden="true" /> Connect and receive
            </button>
          </form>

          {/* Receiver Connection Status */}
          {status.state === 'CONNECTING' && (
            <p className="ds-alert is-info">
              <Loader2 className="w-4 h-4 shrink-0 animate-spin" aria-hidden="true" />
              <span>Connecting to the sending device…</span>
            </p>
          )}

          {status.state === 'CONNECTED' && (
            <p className="ds-alert is-success">
              <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{status.connectionType || 'Connected. Waiting for the sender to start.'}</span>
            </p>
          )}

          {status.state === 'ERROR' && (
            <p className="ds-alert is-danger">
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{status.message}</span>
            </p>
          )}

          {/* Receiver Progress */}
          {progress && (
            <div className="snd-live">
              <div className="snd-live-row">
                <span title={progress.currentFile}>Receiving: {progress.currentFile}</span>
                <span>{progress.progress}%</span>
              </div>
              <div className="ds-progress" aria-hidden="true">
                <i style={{ width: `${progress.progress}%` }} />
              </div>
              <div className="snd-live-meta justify-end">
                <span>Speed: {progress.speed}</span>
              </div>
            </div>
          )}

          {/* Received Files Download Cards */}
          {receivedFiles.length > 0 && (
            <div className="snd-received">
              <h4>Received files ({receivedFiles.length})</h4>
              <ul className="snd-file-list">
                {receivedFiles.map((file, idx) => (
                  <li key={idx} className="snd-file">
                    <div className="snd-file-main">
                      <div className="snd-file-name">
                        <p title={file.name}>{file.name}</p>
                      </div>
                      <p className="snd-size">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                    <a
                      href={file.url}
                      download={file.name}
                      className="ds-btn ds-btn-dark ds-btn-sm shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" aria-hidden="true" /> Save file
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
