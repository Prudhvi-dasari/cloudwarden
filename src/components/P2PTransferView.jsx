import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { P2PSender, P2PReceiver } from '../lib/p2p';
import DropZone from './DropZone';
import FileList from './FileList';
import { Wifi, QrCode, ArrowRight, ShieldCheck, CheckCircle2, AlertCircle, Loader2, Download, Send, RotateCcw, Copy, Check, Smartphone, Laptop, Sparkles, Plus, Monitor, Trash2 } from 'lucide-react';

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
    } catch (e) {
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
    <div className="custom-card p-5 sm:p-8 max-w-3xl mx-auto animate-scale-in">
      
      {/* P2P Role Switcher */}
      <div className="flex rounded-2xl bg-slate-100 p-1.5 mb-6 border border-slate-200">
        <button
          onClick={() => { setP2pRole('send'); setStatus({ state: 'IDLE' }); }}
          className={`flex-1 py-2.5 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
            p2pRole === 'send' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Send className="w-4 h-4 theme-text" />
          <span>Send to Device</span>
        </button>

        <button
          onClick={() => { setP2pRole('receive'); setStatus({ state: 'IDLE' }); }}
          className={`flex-1 py-2.5 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
            p2pRole === 'receive' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Download className="w-4 h-4 theme-text" />
          <span>Receive on this Device</span>
        </button>
      </div>

      {/* SENDER FLOW */}
      {p2pRole === 'send' && (
        <div className="space-y-6">
          
          {/* Step 1: Pair Code & QR Code display */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-5 sm:p-6 text-center space-y-4">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-xs">
                Step 1: Open on Receiver Device
              </span>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-2.5">
                Scan QR Code or Enter Pair Code
              </h3>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-1">
              {/* QR Code */}
              {qrApiUrl ? (
                <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center">
                  <img src={qrApiUrl} alt="P2P QR Code" className="w-32 h-32 rounded-lg" />
                  <span className="text-[10px] font-bold text-slate-500 mt-2 flex items-center gap-1">
                    <Smartphone className="w-3 h-3" /> Scan with phone camera
                  </span>
                </div>
              ) : (
                <div className="w-32 h-32 bg-slate-100 rounded-2xl flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                </div>
              )}

              {/* Code Box */}
              <div className="space-y-2 text-center sm:text-left">
                <span className="text-xs text-slate-500 font-semibold block">Or enter this 6-character code:</span>
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <span className="text-2xl sm:text-3xl font-black tracking-widest text-slate-900 bg-white px-4 py-2 rounded-xl border border-slate-300 font-mono shadow-xs">
                    {p2pCode || '...'}
                  </span>
                  <button
                    onClick={handleCopyCode}
                    className="p-3 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-700 transition-colors shadow-xs"
                    title="Copy Code"
                  >
                    {copiedCode ? <Check className="w-5 h-5 text-emerald-600" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>

                {/* Connection Status Badge */}
                <div className="pt-2">
                  {status.state === 'WAITING' && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200 animate-pulse">
                      <Wifi className="w-3.5 h-3.5 text-amber-500" /> Waiting for receiver to connect...
                    </span>
                  )}
                  {status.state === 'CONNECTED' && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> {status.connectionType || 'Connected direct peer-to-peer!'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Optional Saved Devices Section */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Laptop className="w-4 h-4 theme-text" /> My Paired Devices ({savedDevices.length})
              </h4>
              <button
                onClick={() => setShowAddDevice(!showAddDevice)}
                className="text-xs font-bold theme-text hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Save Device
              </button>
            </div>

            {showAddDevice && (
              <div className="flex gap-2 pt-1 animate-fadeIn">
                <input
                  type="text"
                  value={newDeviceName}
                  onChange={(e) => setNewDeviceName(e.target.value)}
                  placeholder="Device Name (e.g. MacBook Pro, iPad)"
                  className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none"
                />
                <button
                  onClick={handleSaveCurrentDevice}
                  className="theme-btn-primary px-3 py-1.5 text-xs font-bold shadow-2xs"
                >
                  Save
                </button>
              </div>
            )}

            {savedDevices.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {savedDevices.map((dev) => (
                  <div key={dev.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    <div className="flex items-center gap-2">
                      <Monitor className="w-4 h-4 text-slate-500" />
                      <span className="font-bold text-slate-800">{dev.name}</span>
                    </div>
                    <button
                      onClick={() => handleRemoveSavedDevice(dev.id)}
                      className="text-slate-400 hover:text-rose-600 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Step 2: Select Files */}
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-xs mb-3 inline-block">
              Step 2: Choose Files to Stream
            </span>

            {files.length === 0 ? (
              <DropZone onFilesSelected={(f) => setFiles(prev => [...prev, ...f])} />
            ) : (
              <div className="space-y-4 animate-scale-in">
                <FileList
                  files={files}
                  onRemoveFile={(idx) => setFiles(prev => prev.filter((_, i) => i !== idx))}
                  onFilesAdded={(f) => setFiles(prev => [...prev, ...f])}
                />

                {/* Progress UI */}
                {progress && status.state === 'TRANSFERRING' && (
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                    <div className="flex justify-between text-xs font-bold text-slate-800">
                      <span className="truncate max-w-[200px]">Streaming: {progress.currentFile}</span>
                      <span>{progress.progress}%</span>
                    </div>
                    <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full theme-btn-primary transition-all duration-200" style={{ width: `${progress.progress}%` }} />
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500 font-semibold">
                      <span>Speed: {progress.speed}</span>
                      <span>ETA: {progress.timeRemaining}</span>
                    </div>
                  </div>
                )}

                {status.state === 'COMPLETED' && (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center text-emerald-800 font-bold text-sm flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Direct Transfer Complete!
                  </div>
                )}

                <button
                  onClick={handleStartSenderTransfer}
                  disabled={status.state !== 'CONNECTED'}
                  className="btn-animated w-full py-4 text-xs sm:text-sm font-black shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>
                    {status.state === 'CONNECTED'
                      ? `Stream ${files.length} File${files.length !== 1 ? 's' : ''} Directly to Recipient`
                      : 'Pair with Receiver Device First'}
                  </span>
                </button>
              </div>
            )}
          </div>

        </div>
      )}

      {/* RECEIVER FLOW */}
      {p2pRole === 'receive' && (
        <div className="space-y-6">
          <form onSubmit={handleConnectReceiver} className="bg-slate-50 p-6 sm:p-8 rounded-2xl border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl theme-bg-light theme-text flex items-center justify-center mx-auto mb-2">
              <Download className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Enter Transfer Code</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Type the 6-character pairing code displayed on the sender device to establish a direct P2P link.
            </p>

            <div className="max-w-xs mx-auto">
              <input
                type="text"
                required
                maxLength={8}
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                placeholder="AIR-7K92"
                className="w-full text-center text-2xl font-black font-mono tracking-widest px-4 py-3 bg-white border border-slate-300 rounded-xl shadow-xs focus:outline-none uppercase"
              />
            </div>

            <button type="submit" className="theme-btn-primary px-8 py-3 text-xs font-bold shadow-sm inline-flex items-center gap-2">
              <Wifi className="w-4 h-4" /> Connect & Receive Files
            </button>
          </form>

          {/* Receiver Connection Status */}
          {status.state === 'CONNECTING' && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl text-center text-blue-800 text-xs font-bold flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" /> Connecting to sender device...
            </div>
          )}

          {status.state === 'CONNECTED' && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center text-emerald-800 text-xs font-bold flex items-center justify-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> {status.connectionType || 'Connected! Waiting for sender to stream files.'}
            </div>
          )}

          {status.state === 'ERROR' && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-center text-rose-800 text-xs font-bold flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600" /> {status.message}
            </div>
          )}

          {/* Receiver Progress */}
          {progress && (
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
              <div className="flex justify-between text-xs font-bold text-slate-800">
                <span className="truncate max-w-[200px]">Receiving: {progress.currentFile}</span>
                <span>{progress.progress}%</span>
              </div>
              <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full theme-btn-primary transition-all duration-200" style={{ width: `${progress.progress}%` }} />
              </div>
              <div className="text-[11px] text-slate-500 font-semibold text-right">
                Speed: {progress.speed}
              </div>
            </div>
          )}

          {/* Received Files Download Cards */}
          {receivedFiles.length > 0 && (
            <div className="space-y-3 pt-2 animate-fadeIn">
              <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Received Files ({receivedFiles.length})</h4>
              {receivedFiles.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
                  <div className="min-w-0 pr-2">
                    <p className="text-sm font-bold text-slate-800 truncate">{file.name}</p>
                    <p className="text-xs text-slate-500 font-medium">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                  </div>
                  <a
                    href={file.url}
                    download={file.name}
                    className="theme-btn-primary px-4 py-2 text-xs font-bold shadow-xs inline-flex items-center gap-1.5 shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" /> Save File
                  </a>
                </div>
              ))}
            </div>
          )}

        </div>
      )}

    </div>
  );
}
