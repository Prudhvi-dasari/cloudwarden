import { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  UploadCloud, FilePlus, FolderPlus, ShieldCheck,
  Zap, Lock, AlertTriangle, CheckCircle2
} from 'lucide-react';

const DANGEROUS_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'sh', 'bash', 'vbs', 'vbe', 'jse', 'wsf', 'wsh',
  'msc', 'msi', 'msp', 'com', 'scr', 'hta', 'cpl', 'pif', 'reg', 'dll',
  'ps1', 'ps2', 'apk'
]);

export default function DropZone({ onFilesSelected, variant = 'card' }) {
  const [securityAlert, setSecurityAlert] = useState(null);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

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
      setSecurityAlert(`Blocked ${blocked.length} executable file(s) for your safety.`);
      setTimeout(() => setSecurityAlert(null), 8000);
    }
    return safe;
  }, []);

  const onDrop = useCallback(
    (acceptedFiles) => {
      if (acceptedFiles?.length > 0) {
        const safeFiles = filterSafeFiles(acceptedFiles);
        if (safeFiles.length > 0) onFilesSelected(safeFiles);
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
    } catch {
      fileInputRef.current?.click();
    }
  };

  const triggerFolderSelect = (e) => {
    if (e) e.stopPropagation();
    folderInputRef.current?.click();
  };

  return (
    <div className="w-full relative z-20">
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleNativeFileChange} />
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

      {securityAlert && (
        <div className="w-full mb-3.5 p-3 bg-[#c47a7a]/15 border border-[#c47a7a]/40 text-[#f5f0e8] text-xs font-semibold rounded-2xl flex items-center gap-2.5 animate-fadeIn">
          <AlertTriangle className="w-4 h-4 shrink-0 text-[#c47a7a]" />
          <span className="flex-1 leading-snug">{securityAlert}</span>
        </div>
      )}

      {variant === 'orbit' ? (
        <div className="flex flex-col items-center">
          <div
            {...getRootProps()}
            onClick={triggerFileSelect}
            role="button"
            aria-label="Start, add files"
            className={`relative w-[260px] h-[260px] sm:w-[340px] sm:h-[340px] cursor-pointer select-none orbit-breathe ${
              isDragActive ? 'scale-105' : ''
            } transition-transform duration-300`}
          >
            <input {...getInputProps()} />
            <div className="absolute inset-0 rounded-full border border-[rgba(196,165,116,0.25)]" />
            <div
              className={`absolute inset-[14px] rounded-full border-[10px] transition-colors ${
                isDragActive ? 'border-[#f5f0e8]' : 'border-[#c4a574]'
              }`}
            />
            <div className="absolute inset-[42px] rounded-full bg-[#141311] border border-white/10 flex flex-col items-center justify-center text-[#c4a574] shadow-[inset_0_0_40px_rgba(196,165,116,0.08)]">
              <span className="font-display text-4xl sm:text-5xl font-semibold tracking-tight text-[#f5f0e8]">
                {isDragActive ? 'Drop' : 'Start'}
              </span>
              <span className="mt-2 text-[11px] font-medium text-[#6b665c] uppercase tracking-[0.18em]">
                Transfer
              </span>
            </div>
          </div>
          <p className="mt-5 text-sm font-medium text-[#a39e94]">
            Click or drag files into the ring
          </p>
          <button
            type="button"
            onClick={triggerFolderSelect}
            className="mt-3 text-sm font-semibold text-[#c4a574] underline-offset-4 hover:underline cursor-pointer"
          >
            or choose a folder
          </button>
        </div>
      ) : (
        <div
          {...getRootProps()}
          onClick={triggerFileSelect}
          className={`group relative rounded-[28px] bg-white text-[#1c1917] shadow-[0_30px_70px_-28px_rgba(20,16,70,0.55)] cursor-pointer p-6 sm:p-8 text-center select-none transition-transform duration-300 ${
            isDragActive ? 'scale-[1.02]' : ''
          }`}
        >
          <input {...getInputProps()} />

          <div className={`drop-orbit ${isDragActive ? 'is-hot' : ''}`}>
            <svg className="drop-orbit-svg" viewBox="0 0 120 120" aria-hidden="true">
              <circle className="orbit-dash" cx="60" cy="60" r="54" />
              <circle className="orbit-dash inner" cx="60" cy="60" r="46" />
            </svg>
            <span className="drop-orbit-core">
              <UploadCloud className="w-7 h-7 sm:w-8 sm:h-8 stroke-[2.2]" />
            </span>
          </div>

          <div className="space-y-1.5 mb-6">
            <h3 className="text-base sm:text-lg font-display font-semibold text-[#1c1917] tracking-tight">
              {isDragActive ? 'Release to add your files' : 'Drop files or folders here'}
            </h3>
            <p className="text-xs sm:text-sm text-[#57534e] font-medium max-w-sm mx-auto leading-relaxed">
              Or browse. Folders work too. Up to 6 GB, no account.
            </p>
          </div>

          <div
            onClick={(e) => e.stopPropagation()}
            className="flex flex-col sm:flex-row items-center justify-center gap-2.5 max-w-xs sm:max-w-md mx-auto"
          >
            <button
              type="button"
              onClick={triggerFileSelect}
              className="w-full sm:w-auto px-5 py-2.5 rounded-full bg-[#1c1917] text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer hover:bg-black"
            >
              <FilePlus className="w-4 h-4" />
              Browse Files
            </button>
            <button
              type="button"
              onClick={triggerFolderSelect}
              className="w-full sm:w-auto px-5 py-2.5 rounded-full bg-[#f4f1ea] hover:bg-[#ebe6dc] text-[#1c1917] text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 border border-black/10 cursor-pointer"
            >
              <FolderPlus className="w-4 h-4" />
              Select Folder
            </button>
          </div>

          <div className="mt-6 pt-5 border-t border-black/8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] font-semibold text-[#78716c]">
            <span className="inline-flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" />
              6 GB free
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              Encrypted
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              No ads
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              No signup
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
