import { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  UploadCloud, FilePlus, FolderPlus, ShieldCheck,
  Zap, Lock, AlertTriangle, Layers, CheckCircle2
} from 'lucide-react';

const DANGEROUS_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'sh', 'bash', 'vbs', 'vbe', 'jse', 'wsf', 'wsh',
  'msc', 'msi', 'msp', 'com', 'scr', 'hta', 'cpl', 'pif', 'reg', 'dll',
  'ps1', 'ps2', 'apk'
]);

export default function DropZone({ onFilesSelected, maxSizeBytes = 5 * 1024 * 1024 * 1024 }) {
  const [securityAlert, setSecurityAlert] = useState(null);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  // Security guard: blocks executable binaries and malicious payloads
  const filterSafeFiles = useCallback((rawFiles) => {
    const safe = [];
    const blocked = [];
    for (const f of rawFiles) {
      const ext = f.name?.split('.').pop()?.toLowerCase();
      if (ext && DANGEROUS_EXTENSIONS.has(ext)) {
        blocked.push(f.name);
      } else {
        safe.push(f);
      }
    }

    if (blocked.length > 0) {
      setSecurityAlert(`Security Guard: Blocked ${blocked.length} executable file(s) (.${blocked.map(n => n.split('.').pop()).join(', .')}) to prevent malware.`);
      setTimeout(() => setSecurityAlert(null), 8000);
    }
    return safe;
  }, []);

  const onDrop = useCallback(
    (acceptedFiles) => {
      if (acceptedFiles?.length > 0) {
        const safeFiles = filterSafeFiles(acceptedFiles);
        if (safeFiles.length > 0) {
          onFilesSelected(safeFiles);
        }
      }
    },
    [onFilesSelected, filterSafeFiles]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    noClick: false,
    noKeyboard: false,
  });

  const handleNativeFileChange = (e) => {
    e.stopPropagation();
    if (e.target.files?.length > 0) {
      const safe = filterSafeFiles(Array.from(e.target.files));
      if (safe.length > 0) onFilesSelected(safe);
    }
  };

  const handleFolderChange = (e) => {
    e.stopPropagation();
    if (e.target.files?.length > 0) {
      const safe = filterSafeFiles(Array.from(e.target.files));
      if (safe.length > 0) onFilesSelected(safe);
    }
  };

  const triggerFileSelect = (e) => {
    if (e) e.stopPropagation();
    try {
      open();
    } catch (err) {
      fileInputRef.current?.click();
    }
  };

  const triggerFolderSelect = (e) => {
    if (e) e.stopPropagation();
    folderInputRef.current?.click();
  };

  return (
    <div className="w-full relative z-20">
      {/* Hidden Native File & Folder Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleNativeFileChange}
      />
      <input
        ref={folderInputRef}
        type="file"
        webkitdirectory="true"
        mozdirectory="true"
        directory="true"
        multiple
        className="hidden"
        onChange={handleFolderChange}
      />

      {/* Security alert banner if malicious file dropped */}
      {securityAlert && (
        <div className="w-full mb-3.5 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-2xl flex items-center gap-2.5 shadow-sm animate-fadeIn">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          <span className="flex-1 leading-snug">{securityAlert}</span>
        </div>
      )}

      {/* Modern, Tactile Drop Area */}
      <div
        {...getRootProps()}
        onClick={triggerFileSelect}
        className={`group relative rounded-3xl border-2 border-dashed transition-all duration-200 cursor-pointer p-6 sm:p-10 text-center select-none ${
          isDragActive
            ? 'border-indigo-600 bg-indigo-50/70 shadow-xl shadow-indigo-500/10 scale-[1.01]'
            : 'border-slate-300/90 hover:border-indigo-500 bg-white hover:bg-slate-50/50 shadow-xl shadow-slate-900/5'
        }`}
      >
        <input {...getInputProps()} />

        {/* Central Icon Badge */}
        <div className="flex items-center justify-center mb-4">
          <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-xs ${
            isDragActive
              ? 'bg-indigo-600 text-white scale-110 shadow-lg shadow-indigo-600/30'
              : 'bg-indigo-50 text-indigo-600 border border-indigo-100 group-hover:scale-105 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-transparent'
          }`}>
            <UploadCloud className="w-8 h-8 sm:w-10 sm:h-10 stroke-[2.2]" />
          </div>
        </div>

        {/* Heading & Subtitle */}
        <div className="space-y-1.5 mb-6">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
            {isDragActive ? 'Release to upload your files' : 'Drop your files or folders here'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-sm mx-auto leading-relaxed">
            Fast, end-to-end encrypted transfer. Upload videos, archives, or project assets up to 5 GB free.
          </p>
        </div>

        {/* Action Buttons Hub */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex flex-col sm:flex-row items-center justify-center gap-2.5 max-w-xs sm:max-w-md mx-auto"
        >
          <button
            type="button"
            onClick={triggerFileSelect}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm shadow-indigo-600/25 transition-all active:scale-98 cursor-pointer"
          >
            <FilePlus className="w-4 h-4" />
            <span>Browse Files</span>
          </button>

          <button
            type="button"
            onClick={triggerFolderSelect}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 border border-slate-200/80 transition-all active:scale-98 cursor-pointer"
          >
            <FolderPlus className="w-4 h-4 text-slate-600" />
            <span>Select Folder</span>
          </button>
        </div>

        {/* Trust & Spec Badges */}
        <div className="mt-6 pt-5 border-t border-slate-100 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] font-semibold text-slate-500">
          <span className="inline-flex items-center gap-1.5 text-slate-700">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Up to 5 GB Free</span>
          </span>
          <span className="w-1 h-1 rounded-full bg-slate-300 hidden sm:inline" />
          <span className="inline-flex items-center gap-1.5 text-slate-700">
            <Lock className="w-3.5 h-3.5 text-indigo-600" />
            <span>TLS 1.3 / AES-256</span>
          </span>
          <span className="w-1 h-1 rounded-full bg-slate-300 hidden sm:inline" />
          <span className="inline-flex items-center gap-1.5 text-slate-700">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Malware Scanned</span>
          </span>
          <span className="w-1 h-1 rounded-full bg-slate-300 hidden sm:inline" />
          <span className="inline-flex items-center gap-1.5 text-slate-700">
            <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" />
            <span>No Account Required</span>
          </span>
        </div>
      </div>
    </div>
  );
}
