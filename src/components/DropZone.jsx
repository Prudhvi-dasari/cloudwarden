import { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  UploadCloud, FilePlus, FolderPlus, Camera, Image,
  ShieldCheck, Sparkles, Wifi, ArrowRight, AlertTriangle, Lock
} from 'lucide-react';

const DANGEROUS_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'sh', 'bash', 'vbs', 'vbe', 'jse', 'wsf', 'wsh',
  'msc', 'msi', 'msp', 'com', 'scr', 'hta', 'cpl', 'pif', 'reg', 'dll',
  'ps1', 'ps2', 'apk'
]);

export default function DropZone({ onFilesSelected, maxSizeBytes = 25 * 1024 * 1024 * 1024 }) {
  const [securityAlert, setSecurityAlert] = useState(null);
  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  // Filter out malicious/executable files to protect users and recipients
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
      setTimeout(() => setSecurityAlert(null), 7000);
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

  const handleCameraCapture = (e) => {
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

  return (
    <div className="w-full flex flex-col items-center justify-center relative z-20">
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
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        className="hidden"
        onChange={handleCameraCapture}
      />

      {securityAlert && (
        <div className="w-full max-w-sm mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-2xl flex items-center gap-2.5 shadow-sm animate-fadeIn">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          <span className="flex-1 leading-snug">{securityAlert}</span>
        </div>
      )}

      {/* =========================================================================
          THE SIGNATURE 3D GLOWING "START" WHEEL
          ========================================================================= */}
      <div
        {...getRootProps()}
        onClick={triggerFileSelect}
        className="group relative cursor-pointer flex flex-col items-center justify-center select-none"
      >
        <input {...getInputProps()} />

        {/* Orbit Rotating Outer Radiant Glow Aura */}
        <div className="relative flex items-center justify-center w-48 h-48 sm:w-56 sm:h-56">
          
          {/* Animated Vibrant Coral/Orange Conic Gradient Ring */}
          <div
            className={`absolute inset-0 rounded-full p-2.5 sm:p-3 transition-transform duration-500 group-hover:scale-105 ${
              isDragActive ? 'scale-110 shadow-2xl shadow-orange-500/50' : 'shadow-xl shadow-orange-500/25'
            }`}
            style={{
              background: 'conic-gradient(from 0deg, #ff5722, #ff9800, #ffb300, #ff5722)',
              animation: 'spinOrbit 8s linear infinite',
            }}
          >
            {/* Inner Ring Mask */}
            <div className="w-full h-full rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center" />
          </div>

          {/* Concentric Dashed Pulse Line */}
          <div
            className="absolute inset-1.5 sm:inset-2 rounded-full border-2 border-dashed border-white/60 pointer-events-none"
            style={{ animation: 'spinCounter 16s linear infinite' }}
          />

          {/* Central 3D Pure White Start Core */}
          <button
            type="button"
            className="relative z-10 w-36 h-36 sm:w-44 sm:h-44 rounded-full bg-white shadow-2xl flex flex-col items-center justify-center text-center transition-all duration-300 group-hover:scale-105 group-active:scale-95 border-4 border-white cursor-pointer"
          >
            <span className="text-2xl sm:text-3xl font-black tracking-tight text-[#ff5722] group-hover:text-[#f4511e] transition-colors">
              Start
            </span>
          </button>
        </div>

        {/* =========================================================================
            CONNECTED SPEECH BUBBLE TOOLTIP & SELECTOR CARD
            ========================================================================= */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative mt-4 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/90 p-4 sm:p-5 max-w-xs sm:max-w-sm w-full text-center animate-fadeIn"
        >
          {/* Arrow Pointer */}
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-t border-l border-slate-200 rotate-45" />

          <p className="text-xs sm:text-sm font-bold text-slate-800 leading-snug">
            {isDragActive ? 'Drop your files or folders now!' : 'Click or drag-and-drop your files here'}
          </p>

          <div className="relative my-3 flex items-center justify-center">
            <div className="border-t border-slate-200 w-full" />
            <span className="bg-white px-2.5 text-[10px] font-black uppercase tracking-wider text-slate-400 absolute">
              OR
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={triggerFileSelect}
              className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border border-indigo-100 cursor-pointer"
            >
              <FilePlus className="w-3.5 h-3.5" />
              <span>Select Files</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                folderInputRef.current?.click();
              }}
              className="px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border border-purple-100 cursor-pointer"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>Add Folder</span>
            </button>
          </div>

          <p className="text-[10px] text-slate-400 font-semibold mt-2.5">
            Up to 5 GB Free • 25 GB with Pro
          </p>
        </div>

      </div>
    </div>
  );
}
